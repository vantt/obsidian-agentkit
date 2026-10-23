#!/usr/bin/env node
// Turn one subagent transcript (Claude Code jsonl) into metrics and a readable step log.
// Usage: node transcript.mjs <agent.jsonl> <outDir> [--redact]
// Writes <outDir>/metrics.json and <outDir>/transcript.md (redacted when --redact is given).
// Token figures come from the API usage the transcript records, not from estimates.
import fs from 'node:fs';
import path from 'node:path';
import { makeRedactor } from './redact.mjs';

const [src, outDir, flag] = process.argv.slice(2);
const lines = fs.readFileSync(src, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const redact = flag === '--redact' ? makeRedactor() : (s) => s;

const steps = []; const byId = new Map(); const usage = new Map();
let prompt = ''; let answer = ''; let t0 = null; let t1 = null;
for (const d of lines) {
  if (d.timestamp) { const t = Date.parse(d.timestamp); t0 ??= t; t1 = t; }
  const m = d.message; if (!m) continue;
  if (m.usage && m.id) usage.set(m.id, m.usage);
  const content = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content || [];
  for (const b of content) {
    if (d.type === 'user' && b.type === 'text' && !prompt && !b.text.startsWith('<')) prompt = b.text;
    if (b.type === 'tool_use') {
      if (b.name === 'SubagentHandback') { answer = b.input.message; continue; }
      if (b.name.startsWith('mcp__ccd_')) continue; // app task-list UI, not work on the vault
      const s = { n: steps.length + 1, tool: b.name, input: b.input, t: Date.parse(d.timestamp) };
      steps.push(s); byId.set(b.id, s);
    }
    if (b.type === 'tool_result' && byId.has(b.tool_use_id)) {
      const s = byId.get(b.tool_use_id);
      const text = typeof b.content === 'string' ? b.content : (b.content || []).map((c) => c.text ?? `[${c.type}]`).join('\n');
      Object.assign(s, { out: text, bytes: Buffer.byteLength(text), error: !!b.is_error, ms: Date.parse(d.timestamp) - s.t });
    }
  }
}
if (!answer) {
  const last = lines.filter((d) => d.type === 'assistant').flatMap((d) => (Array.isArray(d.message.content) ? d.message.content : [])).filter((b) => b.type === 'text').pop();
  answer = last?.text ?? '';
}

// Skill load = reading SKILL.md or references/, by the Read tool or by cat in Bash (not bridge calls).
const isSkillRead = (s) => (s.tool === 'Read' && /skills\/obsidian-connect\//.test(s.input.file_path || ''))
  || (s.tool === 'Bash' && /skills\/obsidian-connect\/(SKILL\.md|references\/)/.test(s.input.command || '') && !/obs\.mjs/.test(s.input.command || ''));
const u = [...usage.values()];
const ctx = (x) => (x.input_tokens || 0) + (x.cache_read_input_tokens || 0) + (x.cache_creation_input_tokens || 0);
const metrics = {
  source: path.basename(src),
  toolCalls: steps.length,
  byTool: steps.reduce((a, s) => ((a[s.tool] = (a[s.tool] || 0) + 1), a), {}),
  toolErrors: steps.filter((s) => s.error).length,
  timeouts: steps.filter((s) => s.tool === 'Bash' && /Command timed out|exit[ =]124|^timeout/im.test(s.out || '')).length,
  toolOutputBytes: steps.reduce((a, s) => a + (s.bytes || 0), 0),
  skillLoadBytes: steps.filter(isSkillRead).reduce((a, s) => a + (s.bytes || 0), 0),
  modelCalls: u.length,
  contextFirst: u.length ? ctx(u[0]) : 0,
  contextLast: u.length ? ctx(u[u.length - 1]) : 0,
  inputTokensTotal: u.reduce((a, x) => a + ctx(x), 0),
  outputTokensTotal: u.reduce((a, x) => a + (x.output_tokens || 0), 0),
  wallSeconds: Math.round((t1 - t0) / 1000),
};
metrics.taskOutputBytes = metrics.toolOutputBytes - metrics.skillLoadBytes;
metrics.taskOutputTokensEst = Math.round(metrics.taskOutputBytes / 4);
metrics.contextGrowth = metrics.contextLast - metrics.contextFirst;
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'metrics.json'), JSON.stringify(metrics, null, 1));

const fence = (s) => '```text\n' + s.replace(/```/g, "'''") + '\n```';
const clip = (s, n) => (s.length > n ? s.slice(0, n) + `\n… [${s.length - n} more chars, ${Buffer.byteLength(s)} bytes total]` : s);
const showInput = (s) => s.tool === 'Bash' ? s.input.command : s.tool === 'Read' ? `${s.input.file_path}${s.input.offset ? ` (offset ${s.input.offset}, limit ${s.input.limit})` : ''}` : JSON.stringify(s.input, null, 1);
let md = `# Transcript: ${path.basename(outDir)}\n\nSource: \`${metrics.source}\` · ${metrics.toolCalls} tool calls · ${metrics.toolOutputBytes} B tool output · ${metrics.wallSeconds}s\n\n## Prompt\n\n${fence(redact(prompt))}\n\n## Steps\n`;
for (const s of steps) {
  md += `\n### ${s.n}. ${s.tool}${s.error ? ' (error)' : ''} · ${s.bytes ?? '?'} B · ${s.ms ?? '?'} ms\n\n${fence(redact(showInput(s)))}\n\n${fence(redact(clip(s.out ?? '(no result)', 2500)))}\n`;
}
md += `\n## Final answer\n\n${fence(redact(answer))}\n`;
fs.writeFileSync(path.join(outDir, 'transcript.md'), md);
fs.writeFileSync(path.join(outDir, 'answer.txt'), redact(answer));
console.log(JSON.stringify(metrics));

