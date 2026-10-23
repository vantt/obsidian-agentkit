#!/usr/bin/env node
// E8 runner: one run, or the whole matrix, on the synthetic vault only.
// Usage:
//   node tests/models/run.mjs preflight                       guard, wrapper, keys, budget; runs nothing
//   node tests/models/run.mjs calibrate                       reset the vault, record its baseline unresolved count
//   node tests/models/run.mjs one <model> <S> <side> <rep> [--round N]
//   node tests/models/run.mjs matrix [--round N] [--models a,b] [--scenarios S1,S2] [--sides with,without] [--reps 3]
// A run = setup.sh (reset + pre-state) → cc-run.sh (fresh agent) → check.mjs → transcript.mjs → judge.mjs.
// Raw output: tests/out/models/r<N>/<model>/<S>-<side>-<rep>/ (gitignored); one line per run in tests/out/models/results.jsonl.
// The matrix skips runs that already have a verdict, so it can stop and resume.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prompt } from './prompt.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const repo = path.resolve(here, '../..');
const VAULT = process.env.OBS_TEST_VAULT || 'vault-synth';
const DIR = process.env.OBS_TEST_DIR || `/mnt/c/obsidian-agentkit-test/${VAULT}`;
const STATE = process.env.E8_STATE || path.join(os.homedir(), '.local/state/obs-e8');
const OUT = path.join(repo, 'tests/out/models');
const CFG = path.join(os.homedir(), '.config/obsidian-agentkit');
const RUN_TIMEOUT_S = 900;
const SCENARIOS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9'];

const sh = (cmd, args, opt = {}) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 << 20, ...opt });
const die = (msg, code = 1) => { console.error(`run: ${msg}`); process.exit(code); };
const readEnv = (f) => {
  const e = {};
  if (!fs.existsSync(f)) return e;
  for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) e[m[1]] = m[2].trim().replace(/^"(.*)"$/, '$1');
  }
  return e;
};
const or = readEnv(path.join(CFG, 'openrouter.env'));
const isOpenRouter = (m) => m.includes('/');
const slug = (m) => m.replace(/[^a-z0-9.-]+/gi, '_');
const realCli = () => fs.readFileSync(path.join(os.homedir(), '.local/state/obs-showcase/real-cli'), 'utf8').trim();
const real = (...a) => sh(realCli(), [`vault=${VAULT}`, ...a], { cwd: '/mnt/c', timeout: 20000 }).stdout?.trim() ?? '';
const testEnv = (runDir) => ({ ...process.env, OBS_TEST_VAULT: VAULT, OBS_TEST_DIR: DIR, SHOWCASE_RUN_DIR: runDir, RESET_UNRESOLVED: String(calibration().unresolved),
  RESET_BASE: calibration().base, RESET_CLEAN_ALL: '1' });

async function keyUsage() {
  for (let i = 1; ; i++) { // a network blip here must not cost a run
    try {
      const r = await fetch('https://openrouter.ai/api/v1/key', { headers: { authorization: `Bearer ${or.OPENROUTER_API_KEY}` } });
      if (!r.ok) throw new Error(`OpenRouter /key ${r.status}`);
      return (await r.json()).data;
    } catch (e) { if (i >= 5) throw e; await new Promise((r) => setTimeout(r, 5000 * i)); }
  }
}

// Never send a real vault to a third-party model: the target must be the generated one.
function guard() {
  if (!fs.existsSync(path.join(DIR, '.e8-synthetic'))) die(`${DIR} has no .e8-synthetic marker; generate it with gen-synth-vault.mjs`, 7);
  const p = real('vault', 'info=path');
  if (!p) die(`Obsidian does not answer for vault "${VAULT}" (is it open in Obsidian?)`, 2);
  const wsl = sh('wslpath', ['-u', p.replace(/\r/g, '')]).stdout.trim();
  if (path.resolve(wsl) !== path.resolve(DIR)) die(`vault "${VAULT}" is at ${wsl}, expected ${DIR}`, 7);
}

function calibration() {
  const f = path.join(STATE, 'calibration.json');
  if (!fs.existsSync(f)) die('no calibration yet: run `node tests/models/run.mjs calibrate` once', 5);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

// A frozen copy of the skill per round, outside this repo, so the agent never sees tests or answers.
function skillCopy(round) {
  const dst = path.join(STATE, `skill-r${round}`, 'obsidian-connect');
  if (!fs.existsSync(dst)) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.cpSync(path.join(repo, 'skills/obsidian-connect'), dst, { recursive: true });
    const rev = sh('git', ['-C', repo, 'log', '-1', '--format=%h', '--', 'skills/obsidian-connect']).stdout.trim();
    const dirty = sh('git', ['-C', repo, 'status', '--porcelain', '--', 'skills/obsidian-connect']).stdout.trim() !== '';
    fs.writeFileSync(path.join(dst, '..', 'rev.txt'), `${rev}${dirty ? '+dirty' : ''}\n`);
  }
  return { dir: dst, rev: fs.readFileSync(path.join(dst, '..', 'rev.txt'), 'utf8').trim() };
}

async function budgetLeft() {
  if (!or.OPENROUTER_API_KEY) return Infinity;
  const f = path.join(STATE, 'budget.json');
  const u = await keyUsage();
  if (!fs.existsSync(f)) fs.writeFileSync(f, JSON.stringify({ startUsage: u.usage, at: new Date().toISOString() }));
  const start = JSON.parse(fs.readFileSync(f, 'utf8')).startUsage;
  return Number(or.E8_BUDGET_USD || 40) - (u.usage - start);
}

// One agent session: prompt → cc-run.sh → transcript → check. Returns cost and exit info.
async function session(model, S, side, runDir, skill, keep) {
  fs.mkdirSync(runDir, { recursive: true });
  const env = testEnv(runDir);
  const st = sh(path.join(repo, 'tests/showcase/setup.sh'), [S, side, ...(keep ? ['--keep'] : [])], { env });
  if (st.status !== 0) throw new Error(`setup failed: ${st.stderr || st.stdout}`);
  fs.writeFileSync(path.join(runDir, 'prompt.txt'), prompt(S, side, VAULT, skill.dir));
  const work = path.join(STATE, 'work');
  fs.rmSync(work, { recursive: true, force: true }); fs.mkdirSync(work, { recursive: true });
  const before = isOpenRouter(model) ? (await keyUsage()).usage : null;
  const t0 = Date.now();
  const run = sh(path.join(here, 'cc-run.sh'), [model, work, path.join(runDir, 'prompt.txt'), path.join(runDir, 'transcript.jsonl')],
    { env: { ...process.env, E8_STATE: STATE }, timeout: RUN_TIMEOUT_S * 1000, killSignal: 'SIGTERM' });
  const wall = Math.round((Date.now() - t0) / 1000);
  fs.writeFileSync(path.join(runDir, 'cc-stderr.txt'), (run.stderr || '').split('\n').filter((l) => !/unrecognized_model/.test(l)).join('\n'));
  let cost = null;
  if (before !== null) {
    // OpenRouter books usage a few seconds after the response; wait until it stops moving.
    let prev = before;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const u = (await keyUsage()).usage;
      if (u === prev && u !== before) break;
      prev = u;
    }
    cost = prev - before;
  }
  sh('node', [path.join(repo, 'tests/showcase/transcript.mjs'), path.join(runDir, 'transcript.jsonl'), runDir]);
  const lines = fs.existsSync(path.join(runDir, 'transcript.jsonl')) ? fs.readFileSync(path.join(runDir, 'transcript.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return {}; } }) : [];
  const res = lines.find((d) => d.type === 'result');
  if (res?.result) fs.writeFileSync(path.join(runDir, 'answer.txt'), res.result);
  // Through OpenRouter the streamed per-message usage is all zeros; the result line carries the real totals.
  // Use them for every model so Claude and OpenRouter runs are counted the same way.
  const mf = path.join(runDir, 'metrics.json');
  if (res?.usage && fs.existsSync(mf)) {
    const m = JSON.parse(fs.readFileSync(mf, 'utf8')); const u = res.usage;
    Object.assign(m, { inputTokensTotal: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0),
      cacheReadTokens: u.cache_read_input_tokens || 0, outputTokensTotal: u.output_tokens || 0, thinkingTokens: u.output_tokens_details?.thinking_tokens ?? null,
      modelCalls: m.modelCalls, numTurns: res.num_turns, tokenSource: 'result.usage', models: Object.keys(res.modelUsage || {}) });
    fs.writeFileSync(mf, JSON.stringify(m, null, 1));
  }
  const ck = sh('node', [path.join(repo, 'tests/showcase/check.mjs'), S, side], { env });
  if (ck.status !== 0) throw new Error(`check failed: ${ck.stderr}`);
  const apiError = /^API Error/.test(res?.result || '') ? res.result.slice(0, 200) : null;
  return { exit: run.status, signal: run.signal, timedOut: run.signal === 'SIGTERM', wall, cost, resultError: res?.is_error ?? null, apiError, turns: res?.num_turns ?? null };
}

async function one(model, S, side, rep, round) {
  const runDir = path.join(OUT, `r${round}`, slug(model), `${S}-${side}-${rep}`);
  if (fs.existsSync(path.join(runDir, 'verdict.json'))) { console.log(`skip ${runDir} (done)`); return null; }
  const left = await budgetLeft();
  if (left <= 0) die(`budget reached (E8_BUDGET_USD=${or.E8_BUDGET_USD})`, 8);
  fs.mkdirSync(OUT, { recursive: true });
  const skill = skillCopy(round);
  let sessions, dirs, spent = 0;
  // A provider error (429, 5xx) says nothing about the model or the skill: wait, reset, run again.
  for (let attempt = 1; ; attempt++) {
    fs.rmSync(runDir, { recursive: true, force: true }); fs.rmSync(`${runDir}-session2`, { recursive: true, force: true });
    sessions = [await session(model, S, side, runDir, skill, false)]; dirs = [runDir];
    if (S === 'S8' && !sessions[0].apiError) { // second session on the same vault state, same prompt
      const d2 = `${runDir}-session2`;
      sessions.push(await session(model, S, `${side}2`, d2, skill, true));
      dirs.push(d2);
    }
    spent += sessions.reduce((a, s) => a + (s.cost || 0), 0);
    const err = sessions.find((s) => s.apiError)?.apiError;
    if (!err) break;
    const row = { round, model, scenario: S, side, rep, attempt, date: new Date().toISOString(), result: 'error', error: err, costUsd: spent };
    fs.appendFileSync(path.join(OUT, 'errors.jsonl'), JSON.stringify(row) + '\n');
    console.log(`${model} ${S} ${side} #${rep}: provider error (attempt ${attempt}): ${err}`);
    if (attempt >= 3) { fs.writeFileSync(path.join(runDir, 'error.json'), JSON.stringify(row, null, 1)); return null; }
    await new Promise((r) => setTimeout(r, 60000 * attempt));
  }
  const j = sh('node', [path.join(here, 'judge.mjs'), ...dirs], { env: testEnv(runDir) });
  if (j.status !== 0) throw new Error(`judge failed: ${j.stderr}`);
  const v = JSON.parse(j.stdout);
  const m = dirs.map((d) => (fs.existsSync(path.join(d, 'metrics.json')) ? JSON.parse(fs.readFileSync(path.join(d, 'metrics.json'), 'utf8')) : {}));
  const sum = (k) => m.reduce((a, x) => a + (x[k] || 0), 0);
  const row = {
    round, model, scenario: S, side, rep, date: new Date().toISOString(), skillRev: side === 'with' ? skill.rev : null,
    result: v.result, incidents: v.incidents.length, incidentList: v.incidents, reasons: v.reasons,
    toolCalls: sum('toolCalls'), toolErrors: sum('toolErrors'), modelCalls: sum('modelCalls'),
    inputTokensTotal: sum('inputTokensTotal'), cacheReadTokens: sum('cacheReadTokens'), outputTokensTotal: sum('outputTokensTotal'), thinkingTokens: sum('thinkingTokens'),
    taskOutputBytes: sum('taskOutputBytes'), skillLoadBytes: sum('skillLoadBytes'), modelsSeen: [...new Set(m.flatMap((x) => x.models || []))],
    wallSeconds: sessions.reduce((a, s) => a + s.wall, 0),
    costUsd: sessions.every((s) => s.cost !== null) ? sessions.reduce((a, s) => a + s.cost, 0) : null,
    costIncludingRetries: isOpenRouter(model) ? spent : null,
    costSource: isOpenRouter(model) ? 'openrouter-key-usage' : 'tokens-x-list-price (computed in report)',
    timedOut: sessions.some((s) => s.timedOut), agentError: sessions.some((s) => s.resultError || (s.exit !== 0 && !s.timedOut)),
    runDir: path.relative(repo, runDir),
  };
  fs.appendFileSync(path.join(OUT, 'results.jsonl'), JSON.stringify(row) + '\n');
  console.log(`${model} ${S} ${side} #${rep}: ${row.result}, ${row.incidents} incident(s), ${row.toolCalls} calls, ${row.wallSeconds}s, $${row.costUsd?.toFixed(4) ?? '?'}`);
  return row;
}

const opt = (name, dflt) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : dflt; };
const [cmd, ...rest] = process.argv.slice(2);
const round = Number(opt('--round', 0));

if (cmd === 'preflight') {
  guard();
  const wrapper = sh('bash', ['-c', 'command -v obsidian']).stdout.trim();
  console.log(`vault ${VAULT} at ${DIR}: synthetic, open in Obsidian`);
  console.log(`obsidian on PATH: ${wrapper || 'MISSING (run tests/showcase/install.sh)'}`);
  console.log(`openrouter key: ${or.OPENROUTER_API_KEY ? 'set' : 'MISSING'}; claude token: ${readEnv(path.join(CFG, 'claude.env')).CLAUDE_CODE_OAUTH_TOKEN ? 'set' : 'MISSING'}`);
  if (or.OPENROUTER_API_KEY) { const u = await keyUsage(); console.log(`openrouter: spent $${u.usage.toFixed(4)}, key limit left $${u.limit_remaining}, expires ${u.expires_at}; E8 budget left $${(await budgetLeft()).toFixed(2)}`); }
  console.log(`calibration: ${fs.existsSync(path.join(STATE, 'calibration.json')) ? fs.readFileSync(path.join(STATE, 'calibration.json'), 'utf8').trim() : 'not yet'}`);
} else if (cmd === 'calibrate') {
  guard();
  // Start from the previous baseline, never from a commit an agent left behind.
  const prevBase = fs.existsSync(path.join(STATE, "calibration.json")) ? JSON.parse(fs.readFileSync(path.join(STATE, "calibration.json"), "utf8")).base : null;
  if (prevBase) sh("git", ["-C", DIR, "reset", "-q", "--hard", prevBase]);
  // Files Obsidian writes on first open (appearance.json, …) belong to the baseline, not to any agent.
  const own = sh('git', ['-C', DIR, 'status', '--porcelain', '--', '.obsidian']).stdout.split('\n').filter(Boolean).map((l) => l.slice(3))
    .filter((p) => !/workspace|plugins\//.test(p));
  if (own.length) { sh('git', ['-C', DIR, 'add', '--', ...own]); sh('git', ['-C', DIR, 'commit', '-qm', `obsidian first-open files: ${own.join(', ')}`]); console.log(`committed app-written files: ${own.join(', ')}`); }
  sh('git', ['-C', DIR, 'checkout', '-q', '--', '.']); sh('git', ['-C', DIR, 'clean', '-fdq', '--', '_agentkit-lab']);
  real('reload');
  let b = '', u = '', stable = 0, prev = '';
  for (let i = 0; i < 90 && stable < 5; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    b = real('backlinks', 'path=_agentkit-lab/Target Note.md', 'total'); u = real('unresolved', 'total');
    stable = b === '9' && u === prev ? stable + 1 : 0; prev = u;
  }
  if (b !== '9' || stable < 5) die(`index did not settle (backlinks=${b}, unresolved=${u})`);
  fs.mkdirSync(STATE, { recursive: true });
  const base = sh('git', ['-C', DIR, 'rev-parse', 'HEAD']).stdout.trim();
  fs.writeFileSync(path.join(STATE, 'calibration.json'), JSON.stringify({ vault: VAULT, unresolved: Number(u), base, at: new Date().toISOString() }));
  console.log(`calibrated: backlinks=9 unresolved=${u} base=${base.slice(0, 7)}`);
} else if (cmd === 'one') {
  const [model, S, side, rep] = rest;
  if (!model || !SCENARIOS.includes(S) || !['with', 'without'].includes(side)) die('usage: one <model> <S1..S9> <with|without> <rep> [--round N]', 2);
  guard();
  await one(model, S, side, Number(rep || 1), round);
} else if (cmd === 'matrix') {
  guard();
  const models = opt('--models', null)?.split(',') ?? [...(or.E8_MODELS || '').split(/\s+/).filter(Boolean), 'haiku', 'sonnet'];
  const scen = opt('--scenarios', SCENARIOS.join(',')).split(',');
  const sides = opt('--sides', 'with,without').split(',');
  const reps = Number(opt('--reps', 3));
  // Rep-major order: a stopped matrix still has one full pass over every cell before the second rep.
  for (let rep = 1; rep <= reps; rep++) for (const S of scen) for (const side of sides) for (const model of models) {
    try { await one(model, S, side, rep, round); } catch (e) { console.error(`ERROR ${model} ${S} ${side} #${rep}: ${e.message}`); }
  }
} else {
  die('usage: run.mjs preflight | calibrate | one <model> <S> <side> <rep> | matrix [...]', 2);
}
