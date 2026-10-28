#!/usr/bin/env node
// E6.5 plugin scenarios 12 (Tasks) and 13 (Templater): one fresh headless `claude -p` agent per run, on vault-copy only.
// Usage: node tests/scenarios/e65-plugins.mjs <12|13> <with|without> [--model sonnet]
// Setup: guard, fixture under _agentkit-lab/e65/ -> cc-run.sh (sandboxed agent, E8 harness) -> check -> reset.
// Output (tests/out/e65/, gitignored): <case>-<side>/transcript.jsonl and result.json. Claude subscription only.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeAgentObsidianJson } from '../models/obsidian-json.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const repo = path.resolve(here, '../..');
const VAULT = 'vault-copy', DIR = '/mnt/c/obsidian-agentkit-test/vault-copy';
const STATE = path.join(os.homedir(), '.local/state/obs-e8');
const [C, side] = process.argv.slice(2);
const model = process.argv.includes('--model') ? process.argv[process.argv.indexOf('--model') + 1] : 'sonnet';
if (!['12', '13'].includes(C) || !['with', 'without'].includes(side)) { console.error('usage: e65-plugins.mjs <12|13> <with|without>'); process.exit(2); }

const sh = (c, a, o = {}) => spawnSync(c, a, { encoding: 'utf8', maxBuffer: 64 << 20, ...o });
const real = (...a) => sh(fs.readFileSync(path.join(os.homedir(), '.local/state/obs-showcase/real-cli'), 'utf8').trim(), [`vault=${VAULT}`, ...a], { cwd: '/mnt/c', timeout: 30000 }).stdout.trim();
const ev = (code) => real('eval', `code=${code}`).replace(/^=> /, '');
const sleep = (s) => sh('sleep', [String(s)]);
const bridge = (...a) => sh('node', [path.join(repo, 'skills/obsidian-connect/scripts/obs.mjs'), ...a], { env: { ...process.env, OBS_VAULT: VAULT } });

// Guard: the bridge must resolve to vault-copy, the git tree must be clean.
const vp = bridge('vault', 'info=path').stdout.trim();
if (!/vault-copy$/.test(vp)) { console.error(`refuse: vault path is not vault-copy (${vp ? 'other' : 'empty'})`); process.exit(2); }
if (sh('git', ['-C', DIR, 'status', '--porcelain']).stdout.trim()) { console.error('refuse: vault-copy git tree not clean'); process.exit(2); }
const BASE = sh('git', ['-C', DIR, 'rev-parse', 'HEAD']).stdout.trim();

const LAB = '_agentkit-lab/e65';
const TP = 'app.plugins.plugins["templater-obsidian"]', CO = 'app.internalPlugins.plugins.templates.instance.options';
const settings = () => `trigger=${ev(`${TP}.settings.trigger_on_file_creation`)} folder=${ev(`${CO}.folder`)}`;
const FIX = {
  '12': { [`${LAB}/Project Plan.md`]: '# Project Plan\n\n- [ ] Draft the outline\n- [/] Review the budget 🛫 2026-10-20\n- [-] Cancel the old vendor\n- [x] Book the room ✅ 2026-10-25\n- [ ] Send the invoice ⏫ 📅 2026-10-30\n' },
  '13': { [`${LAB}/templates/Meeting Template.md`]: '# {{title}}\n\nDate: <% tp.date.now("YYYY-MM-DD") %>\nAttendees: <% "team".toUpperCase() %>\n\n## Notes\n' },
};
const REQ = {
  '12': `In the note \`${LAB}/Project Plan.md\`, add a task "Pay the electricity bill" due on 2026-11-05. Then tell me which open tasks that note has now.`,
  '13': `Create the note \`${LAB}/Meeting 2026-11-02.md\` from the template \`${LAB}/templates/Meeting Template.md\`, and tell me what the new note contains.`,
};

function prompt(skill) {
  const head = side === 'with'
    ? `You are an agent working on a user's Obsidian vault. Your only guidance is the Agent Skill at ${skill}/ — read its SKILL.md first and follow it; open its references/ files only when SKILL.md tells you to.`
    : "You are an agent working on a user's Obsidian vault. Do not use any skill.";
  const env = side === 'with'
    ? `Environment: WSL2 shell; Obsidian runs on Windows. The vault name is \`${VAULT}\`. The official Obsidian CLI is installed as \`obsidian\` (see \`obsidian help\`). Shell env vars do not persist between your Bash calls, so prefix every bridge call with \`OBS_VAULT=${VAULT} node ${skill}/scripts/obs.mjs ...\`.`
    : `Environment: WSL2 shell; Obsidian runs on Windows. The vault name is \`${VAULT}\`. The official Obsidian CLI is installed as \`obsidian\` (see \`obsidian help\`).`;
  return [head, '', env, '', `User request: "${REQ[C]}"`,
    'Nobody can answer questions during the task: where you would normally ask the user, decide yourself and say what you decided in NOTES.', '',
    'When finished, reply in exactly this format:', 'ANSWER: <your answer to the user>', 'NOTES: <what you did, anything that surprised you or went wrong>'].join('\n');
}

const run = path.join(repo, 'tests/out/e65', `${C}-${side}`);
fs.rmSync(run, { recursive: true, force: true }); fs.mkdirSync(run, { recursive: true });
const result = { case: C, side, model, base: BASE };
let settingsBefore;
try {
  for (const [f, body] of Object.entries(FIX[C])) { fs.mkdirSync(path.dirname(path.join(DIR, f)), { recursive: true }); fs.writeFileSync(path.join(DIR, f), body); }
  settingsBefore = settings(); result.settingsBefore = settingsBefore;
  const probe = Object.keys(FIX[C])[0];
  for (let i = 0; i < 40 && !real('read', `path=${probe}`).includes('#'); i++) sleep(1); // the app must see the fixture
  const skillDir = path.join(STATE, 'skill-e65', 'obsidian-connect');
  fs.rmSync(path.dirname(skillDir), { recursive: true, force: true });
  fs.mkdirSync(path.dirname(skillDir), { recursive: true });
  fs.cpSync(path.join(repo, 'skills/obsidian-connect'), skillDir, { recursive: true });
  result.skillRev = sh('git', ['-C', repo, 'log', '-1', '--format=%h', '--', 'skills/obsidian-connect']).stdout.trim();
  fs.writeFileSync(path.join(run, 'prompt.txt'), prompt(skillDir));
  const sdir = path.join(os.homedir(), '.local/state/obs-showcase');
  fs.writeFileSync(path.join(sdir, 'current.env'), `CLI_LOG=${path.join(run, 'cli.jsonl')}\nCLOSED=0\n`);
  fs.writeFileSync(path.join(os.tmpdir(), 'obsidian-connect-cli.json'), JSON.stringify({ env: 'wsl', cli: path.join(os.homedir(), '.local/bin/obsidian') }));
  const oj = path.join(STATE, 'obsidian.json'), ojAt = writeAgentObsidianJson(DIR, oj);
  const work = path.join(STATE, 'work'); fs.rmSync(work, { recursive: true, force: true }); fs.mkdirSync(work, { recursive: true });
  const t0 = Date.now();
  sh(path.join(repo, 'tests/models/cc-run.sh'), [model, work, path.join(run, 'prompt.txt'), path.join(run, 'transcript.jsonl')],
    { env: { ...process.env, E8_STATE: STATE, E8_TIMEOUT_S: '600', E8_VAULT_DIR: DIR, E8_SKILL_DIR: side === 'with' ? skillDir : '', E8_OBSIDIAN_JSON: oj, E8_OBSIDIAN_JSON_AT: ojAt }, stdio: 'ignore', timeout: 720000, killSignal: 'SIGKILL' });
  result.wallS = Math.round((Date.now() - t0) / 1000);
  sleep(5);
  // Judge from the files and the app, never from the agent's claim.
  const lines = fs.readFileSync(path.join(run, 'transcript.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  result.turns = lines.filter((l) => l.type === 'assistant').flatMap((l) => l.message.content).filter((c) => c.type === 'tool_use').length;
  result.final = lines.filter((l) => l.type === 'result').map((l) => l.result).pop() ?? '';
  result.status = sh('git', ['-C', DIR, 'status', '--porcelain']).stdout.trim().split('\n').filter(Boolean);
  result.settingsAfter = settings();
  result.settingsUnchanged = result.settingsAfter === settingsBefore;
  const rd = (f) => { try { return fs.readFileSync(path.join(DIR, f), 'utf8'); } catch { return null; } };
  if (C === '12') {
    const t = rd(`${LAB}/Project Plan.md`) ?? '';
    const added = t.split('\n').filter((l) => /electricity/i.test(l));
    result.noteTail = t.split('\n').slice(2);
    result.checks = { oneNewLine: added.length === 1, syntax: added.length === 1 && /^- \[ \] .*Pay the electricity bill.* 📅 2026-11-05\s*$/.test(added[0]),
      othersIntact: ['- [ ] Draft the outline', '- [/] Review the budget 🛫 2026-10-20', '- [-] Cancel the old vendor', '- [x] Book the room ✅ 2026-10-25', '- [ ] Send the invoice ⏫ 📅 2026-10-30'].every((l) => t.includes(l)),
      onlyFixtureChanged: result.status.every((s) => s.includes('_agentkit-lab/e65')) };
  } else {
    const t = rd(`${LAB}/Meeting 2026-11-02.md`);
    result.note = t;
    result.checks = { created: t !== null, titleRendered: t !== null && /^# Meeting 2026-11-02/m.test(t) && !t.includes('{{title}}'), tagsLiteral: t !== null && t.includes('<% tp.date.now'), tagsRenderedByAgent: t !== null && !/<%|{{/.test(t), settingsUnchanged: result.settingsUnchanged, onlyFixtureChanged: result.status.every((s) => s.includes('_agentkit-lab/e65')) };
  }
} finally {
  fs.writeFileSync(path.join(run, 'result.json'), JSON.stringify(result, null, 2));
  // Reset: named paths in the test vault only, then reload and wait for the index.
  sh('git', ['-C', DIR, 'reset', '-q', '--hard', BASE]);
  sh('git', ['-C', DIR, 'clean', '-fdq', '--', '_agentkit-lab']);
  fs.rmSync(path.join(DIR, '.trash'), { recursive: true, force: true });
  real('reload'); sleep(45);
  result.cleanAfter = sh('git', ['-C', DIR, 'status', '--porcelain']).stdout.trim() === '';
  result.settingsAfterReset = settings();
  fs.writeFileSync(path.join(run, 'result.json'), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(os.homedir(), '.local/state/obs-showcase/current.env'), 'CLOSED=0\n');
  console.log(JSON.stringify(result, null, 2));
}
