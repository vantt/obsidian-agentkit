#!/usr/bin/env node
// Judge a finished round again with the current judge.mjs, offline: no Obsidian, no model call.
// Usage: node tests/models/rejudge.mjs [--round N] [--out <file>]
// Reads tests/out/models/results.jsonl (last row per model|scenario|side|rep wins) and the run folders; writes
// tests/out/models/results-rejudged-r<N>.jsonl with every original field (tokens, cost, time) kept and
// result, incidents, incidentList, reasons, ruleBreaks replaced. results.jsonl and verdict.json stay untouched.
// Prints the before/after table per model × side. Read the new file with: summary.mjs --file results-rejudged-r<N>.jsonl
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const repo = path.resolve(here, '../..');
const OUT = path.join(repo, 'tests/out/models');
const opt = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const round = Number(opt('--round', 0));
const outFile = path.resolve(OUT, opt('--out', `results-rejudged-r${round}.jsonl`));
const DIR = process.env.OBS_TEST_DIR || `/mnt/c/obsidian-agentkit-test/${process.env.OBS_TEST_VAULT || 'vault-synth'}`;

const rows = [...new Map(fs.readFileSync(path.join(OUT, 'results.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse)
  .filter((r) => r.round === round).map((r) => [`${r.model}|${r.scenario}|${r.side}|${r.rep}`, r])).values()];
if (!rows.length) { console.error(`rejudge: no rows for round ${round}`); process.exit(2); }

const out = [];
for (const r of rows) {
  const dir = path.join(repo, r.runDir);
  const dirs = [dir, ...(r.scenario === 'S8' ? [`${dir}-session2`] : [])].filter((d) => fs.existsSync(d));
  const j = spawnSync('node', [path.join(here, 'judge.mjs'), '--dry', ...dirs], { encoding: 'utf8', env: { ...process.env, OBS_TEST_DIR: DIR } });
  if (j.status !== 0) { console.error(`rejudge: ${r.runDir}: judge exit ${j.status}: ${j.stderr.trim()}`); out.push(r); continue; }
  const v = JSON.parse(j.stdout);
  out.push({ ...r, result: v.result, incidents: v.incidents.length, incidentList: v.incidents, reasons: v.reasons, ruleBreaks: v.ruleBreaks,
    rejudged: { at: new Date().toISOString(), before: { result: r.result, incidents: r.incidents, incidentList: r.incidentList } } });
}
fs.writeFileSync(outFile, out.map((r) => JSON.stringify(r)).join('\n') + '\n');

const clean = (r) => (r.result === 'pass' || r.result === 'refused-safely') && r.incidents === 0;
const changed = out.filter((r) => r.rejudged && (r.result !== r.rejudged.before.result || r.incidents !== r.rejudged.before.incidents));
console.log(`${out.length} runs re-judged, ${changed.length} changed → ${path.relative(repo, outFile)}\n`);
console.log('| Model | Side | Runs | Clean before | Clean after | Incidents before | Incidents after | refused-safely before → after |\n|---|---|---:|---:|---:|---:|---:|---:|');
for (const m of [...new Set(out.map((r) => r.model))]) for (const side of ['with', 'without']) {
  const rs = out.filter((r) => r.model === m && r.side === side); if (!rs.length) continue;
  const b = rs.map((r) => ({ ...r, ...(r.rejudged?.before || {}) }));
  const n = (a, f) => a.filter(f).length; const inc = (a) => a.reduce((s, r) => s + r.incidents, 0);
  const ref = (r) => r.result === 'refused-safely';
  console.log(`| \`${m}\` | ${side} | ${rs.length} | ${n(b, clean)} | ${n(rs, clean)} | ${inc(b)} | ${inc(rs)} | ${n(b, ref)} → ${n(rs, ref)} |`);
}
if (process.argv.includes('--changes')) for (const r of changed) {
  console.log(`\n${r.runDir}: ${r.rejudged.before.result}/${r.rejudged.before.incidents} → ${r.result}/${r.incidents}`);
  for (const x of [...r.incidentList, ...r.reasons]) console.log(`  ${x.slice(0, 160)}`);
}
