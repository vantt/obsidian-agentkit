#!/usr/bin/env node
// E2.1a rehearsal of the case 9 prompts (cases 1 and 4) in WSL on vault-copy, read-only.
// Usage: node tests/scenarios/case9-rehearsal.mjs <1|4> [--model sonnet]
// One fresh headless `claude -p` agent (E8 harness tests/models/cc-run.sh, same pattern as e65-plugins.mjs),
// asked EXACTLY the prompt printed in tests/scenarios/CASE9-WINDOWS.md. Judged from the files (otf truth), never
// from the agent's claim. Refuses unless the bridge resolves to vault-copy and git is clean; checks HEAD and the
// git status are unchanged afterwards. Output (gitignored): tests/out/case9/<case>/. Claude subscription only.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeAgentObsidianJson } from '../models/obsidian-json.mjs';
import { OTF } from '../otf.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const repo = path.resolve(here, '../..');
const VAULT = 'vault-copy', DIR = '/mnt/c/obsidian-agentkit-test/vault-copy';
const STATE = path.join(os.homedir(), '.local/state/obs-e8');
const C = process.argv[2];
const model = process.argv.includes('--model') ? process.argv[process.argv.indexOf('--model') + 1] : 'sonnet';
if (!['1', '4'].includes(C)) { console.error('usage: case9-rehearsal.mjs <1|4>'); process.exit(2); }

const sh = (c, a, o = {}) => spawnSync(c, a, { encoding: 'utf8', maxBuffer: 64 << 20, ...o });
const git = (...a) => sh('git', ['-C', DIR, ...a]).stdout.trim();
const bridge = (...a) => sh('node', [path.join(repo, 'skills/obsidian-connect/scripts/obs.mjs'), ...a], { env: { ...process.env, OBS_VAULT: VAULT } });
const vp = bridge('vault', 'info=path').stdout.trim();
if (!/vault-copy$/.test(vp)) { console.error('refuse: bridge vault is not vault-copy'); process.exit(2); }
if (git('status', '--porcelain')) { console.error('refuse: vault-copy git tree not clean'); process.exit(2); }
const HEAD0 = git('rev-parse', 'HEAD');

// The user prompt, word for word as in CASE9-WINDOWS.md ({VAULT} is the vault name).
const PROMPTS = {
  '1': `Use the obsidian-connect skill. The Obsidian vault is "${VAULT}"; use only that vault and do not change anything in it. List every note that links to \`_agentkit-lab/Target Note.md\`. Say if the list might be incomplete.`,
  '4': `Use the obsidian-connect skill. The Obsidian vault is "${VAULT}"; use only that vault and do not change anything in it. How many open tasks are there in the whole vault?`,
};
const skillDir = path.join(STATE, 'skill-case9', 'obsidian-connect');
const run = path.join(repo, 'tests/out/case9', C);
fs.rmSync(run, { recursive: true, force: true }); fs.mkdirSync(run, { recursive: true });
fs.rmSync(path.dirname(skillDir), { recursive: true, force: true }); fs.mkdirSync(path.dirname(skillDir), { recursive: true });
fs.cpSync(path.join(repo, 'skills/obsidian-connect'), skillDir, { recursive: true });
const prompt = [
  `You are an agent working on a user's Obsidian vault. The skill is installed at ${skillDir}/ (read its SKILL.md and follow it). Do not read any other docs or tests.`,
  `Environment: WSL2 shell; Obsidian runs on Windows. Shell env vars do not persist between Bash calls, so prefix every bridge call with \`OBS_VAULT=${VAULT} node ${skillDir}/scripts/obs.mjs ...\`.`,
  '', `User request: "${PROMPTS[C]}"`, 'Nobody can answer questions during the task.',
  '', 'Reply in exactly this format:', 'ANSWER: <your answer to the user>', 'NOTES: <what you did, anything that surprised you>'].join('\n');
fs.writeFileSync(path.join(run, 'prompt.txt'), prompt);
const sdir = path.join(os.homedir(), '.local/state/obs-showcase');
fs.writeFileSync(path.join(sdir, 'current.env'), `CLI_LOG=${path.join(run, 'cli.jsonl')}\nCLOSED=0\n`);
fs.writeFileSync(path.join(os.tmpdir(), 'obsidian-connect-cli.json'), JSON.stringify({ env: 'wsl', cli: path.join(os.homedir(), '.local/bin/obsidian') }));
const oj = path.join(STATE, 'obsidian.json'), ojAt = writeAgentObsidianJson(DIR, oj);
const work = path.join(STATE, 'work'); fs.rmSync(work, { recursive: true, force: true }); fs.mkdirSync(work, { recursive: true });
const t0 = Date.now();
sh(path.join(repo, 'tests/models/cc-run.sh'), [model, work, path.join(run, 'prompt.txt'), path.join(run, 'transcript.jsonl')],
  { env: { ...process.env, E8_STATE: STATE, E8_TIMEOUT_S: '600', E8_VAULT_DIR: DIR, E8_SKILL_DIR: skillDir, E8_OBSIDIAN_JSON: oj, E8_OBSIDIAN_JSON_AT: ojAt }, stdio: 'ignore', timeout: 720000, killSignal: 'SIGKILL' });
fs.writeFileSync(path.join(sdir, 'current.env'), 'CLOSED=0\n');

const lines = fs.readFileSync(path.join(run, 'transcript.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const final = lines.filter((l) => l.type === 'result').map((l) => l.result).pop() ?? '';
const turns = lines.filter((l) => l.type === 'assistant').flatMap((l) => l.message.content).filter((c) => c.type === 'tool_use').length;
const otf = (...a) => JSON.parse(sh('node', [OTF, 'truth', ...a]).stdout);
const result = { case: C, model, turns, wallS: Math.round((Date.now() - t0) / 1000), final };
const answer = (final.match(/ANSWER:([\s\S]*?)(?:\nNOTES:|$)/) ?? [, final])[1];
if (C === '1') {
  const truth = otf('backlinks', DIR, '_agentkit-lab/Target Note.md');
  const base = (f) => path.basename(f, '.md');
  result.truthTotal = truth.total;
  result.missing = truth.files.map((f) => base(f.file)).filter((b) => !answer.includes(b));
  result.codeBlockListed = answer.includes('ref-code-block');
  result.aliasNameListed = answer.includes('ref-alias-name');
  result.mentionsIncomplete = /incomplete|unresolved|may miss|might|alias/i.test(final);
  result.pass = !result.missing.length && !result.codeBlockListed && result.mentionsIncomplete;
} else {
  const truth = otf('tasks', DIR);
  result.truthOpen = truth.open;
  result.numbersInAnswer = answer.match(/\d[\d,.]*/g) ?? [];
  result.pass = new RegExp(`(^|[^\\d.,])${truth.open}([^\\d]|$)`).test(answer);
}
result.headUnchanged = git('rev-parse', 'HEAD') === HEAD0;
result.statusEmpty = git('status', '--porcelain') === '';
result.pass = result.pass && result.headUnchanged && result.statusEmpty;
fs.writeFileSync(path.join(run, 'result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
process.exit(result.pass ? 0 : 1);
