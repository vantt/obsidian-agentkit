#!/usr/bin/env node
// Summarise E8 results for one round: per model × side, and a scenario grid.
// Usage: node tests/models/summary.mjs [--round N] [--md]
// Claude runs use the subscription, so their USD is computed: tokens × list price, cache reads at 10%.
// Provider errors (errors.jsonl) are counted separately and never as model failures.
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.resolve(here, '../../tests/out/models');
const opt = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const round = Number(opt('--round', 0));
const md = process.argv.includes('--md');
const read = (f) => (fs.existsSync(path.join(OUT, f)) ? fs.readFileSync(path.join(OUT, f), 'utf8').split('\n').filter(Boolean).map(JSON.parse) : []);
// Last row wins if a run was repeated.
const rows = [...new Map(read('results.jsonl').filter((r) => r.round === round).map((r) => [`${r.model}|${r.scenario}|${r.side}|${r.rep}`, r])).values()];
const errors = read('errors.jsonl').filter((r) => r.round === round);
const PRICE = { haiku: [0.10, 0.50], sonnet: [2.0, 10.0], opus: [5.0, 25.0] }; // USD per 1M in / out (OpenRouter list, 2026-10-23)
const usd = (r) => {
  if (r.costUsd != null) return r.costUsd;
  const p = PRICE[r.model]; if (!p) return null;
  const fresh = r.inputTokensTotal - (r.cacheReadTokens || 0);
  return (fresh * p[0] + (r.cacheReadTokens || 0) * p[0] * 0.1 + r.outputTokensTotal * p[1]) / 1e6;
};
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : 0; };
const models = [...new Set(rows.map((r) => r.model))];
const scen = [...new Set(rows.map((r) => r.scenario))].sort();
const ok = (r) => r.result === 'pass' || r.result === 'refused-safely';
const clean = (r) => ok(r) && r.incidents === 0;

const table = [];
for (const m of models) for (const side of ['with', 'without']) {
  const rs = rows.filter((r) => r.model === m && r.side === side); if (!rs.length) continue;
  const cost = rs.reduce((a, r) => a + (usd(r) || 0), 0);
  const nClean = rs.filter(clean).length;
  table.push({ model: m, side, runs: rs.length, goal: rs.filter(ok).length, clean: nClean, incidents: rs.reduce((a, r) => a + r.incidents, 0),
    usd: cost, usdPerClean: nClean ? cost / nClean : null, medianWall: median(rs.map((r) => r.wallSeconds)), medianCalls: median(rs.map((r) => r.toolCalls)),
    inTok: rs.reduce((a, r) => a + r.inputTokensTotal, 0), outTok: rs.reduce((a, r) => a + r.outputTokensTotal, 0), timeouts: rs.filter((r) => r.timedOut).length });
}
const f = (x, d = 4) => (x == null ? '—' : x.toFixed(d));
const cell = (r) => (!r ? ' ' : r.incidents ? '!' : r.result === 'pass' ? '✓' : r.result === 'refused-safely' ? 'r' : '✗');

if (process.argv.includes('--csv')) {
  // One line per run; USD for Claude rows is the computed list-price figure.
  // `Untitled 1` and the like are Obsidian's default names, generalised so the privacy scan stays clean.
  const cols = ['round', 'model', 'scenario', 'side', 'rep', 'date', 'skillRev', 'result', 'incidents', 'incidentList', 'toolCalls', 'toolErrors', 'modelCalls',
    'inputTokensTotal', 'cacheReadTokens', 'outputTokensTotal', 'thinkingTokens', 'wallSeconds', 'usd', 'costSource', 'timedOut'];
  const esc = (v) => { const s = (Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : x.kind || JSON.stringify(x))).join('; ') : v == null ? '' : String(v)).replace(/Untitled \d+/g, 'Untitled N'); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  console.log(cols.join(','));
  for (const r of rows) console.log(cols.map((c) => esc(c === 'usd' ? usd(r) : c === 'costSource' ? r.costSource || 'list-price' : r[c])).join(','));
  process.exit(0);
}
if (md) {
  console.log(`| Model | Side | Runs | Goal met | Clean (goal, 0 incidents) | Incidents | USD | USD / clean run | Median s | Median tool calls |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---:|`);
  for (const t of table) console.log(`| \`${t.model}\` | ${t.side} | ${t.runs} | ${t.goal} | ${t.clean} | ${t.incidents} | ${f(t.usd)} | ${f(t.usdPerClean)} | ${t.medianWall} | ${t.medianCalls} |`);
  console.log(`\nScenario grid (✓ pass, r refused safely, ! incident, ✗ fail):\n\n| Model | Side | ${scen.join(' | ')} |\n|---|---|${scen.map(() => ':-:').join('|')}|`);
  for (const m of models) for (const side of ['with', 'without']) console.log(`| \`${m}\` | ${side} | ${scen.map((S) => rows.filter((r) => r.model === m && r.side === side && r.scenario === S).map(cell).join('')).join(' | ')} |`);
} else {
  for (const t of table) console.log(`${t.model.padEnd(30)} ${t.side.padEnd(7)} runs=${t.runs} goal=${t.goal} clean=${t.clean} incidents=${t.incidents} usd=${f(t.usd)} usd/clean=${f(t.usdPerClean)} wall=${t.medianWall}s calls=${t.medianCalls} timeouts=${t.timeouts}`);
  console.log(`\n${''.padEnd(38)}${scen.join('  ')}`);
  for (const m of models) for (const side of ['with', 'without']) console.log(`${m.padEnd(30)} ${side.padEnd(7)} ${scen.map((S) => rows.filter((r) => r.model === m && r.side === side && r.scenario === S).map(cell).join('').padEnd(2)).join('  ')}`);
}
console.log(`\nprovider errors (retried, not counted): ${errors.length}`);
