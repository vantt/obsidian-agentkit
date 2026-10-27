#!/usr/bin/env node
// Judge one showcase run from the vault state, never from the agent's claim.
// Usage: node check.mjs <S1..S9> <without|with> [--no-teardown]
// Env (E8): OBS_TEST_VAULT, OBS_TEST_DIR, SHOWCASE_RUN_DIR as in setup.sh.
// Writes tests/out/showcase/<S>-<side>/{check.json,lab.diff,status.txt} (raw, gitignored).
// Damage signals: files changed outside the lab, broken links, "name 1.md" copies, types.json edits,
// Recycle Bin items, empty notes, duplicated lines.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OTF } from '../otf.mjs';

const [S, side, flag] = process.argv.slice(2);
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const OUT = process.env.SHOWCASE_RUN_DIR || path.join(repo, 'tests/out/showcase', `${S}-${side}`);
const VAULT = process.env.OBS_TEST_VAULT || 'vault-copy';
const DIR = process.env.OBS_TEST_DIR || '/mnt/c/obsidian-agentkit-test/vault-copy';
const LAB = '_agentkit-lab';
const cli = fs.readFileSync(path.join(os.homedir(), '.local/state/obs-showcase/real-cli'), 'utf8').trim();
const sh = (cmd, args, opt = {}) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 << 20, ...opt });
const real = (...a) => sh(cli, [`vault=${VAULT}`, ...a], { cwd: '/mnt/c', timeout: 15000 }).stdout?.trim() ?? '';
const git = (...a) => sh('git', ['-C', DIR, ...a]).stdout;
const gt = (...a) => JSON.parse(sh(process.execPath, [OTF, 'truth', a[0], DIR, ...a.slice(1)]).stdout);
const base = JSON.parse(fs.readFileSync(path.join(OUT, 'baseline.json'), 'utf8'));
const exists = (p) => fs.existsSync(path.join(DIR, p));
const readV = (p) => fs.readFileSync(path.join(DIR, p), 'utf8');

const r = { scenario: S, side, time: new Date().toISOString() };

// Modal left open by a blocked CLI call (S2 without skill).
const modal = real('dev:dom', 'selector=.modal', 'text');
r.modalOpen = !/^No elements? found/.test(modal) && modal !== '' && !modal.startsWith('Error');
r.modalText = r.modalOpen ? modal.slice(0, 300) : '';
if (r.modalOpen) sh('node', [path.join(repo, 'tests/showcase/shot.mjs'), path.join(OUT, 'obsidian-modal.png'), '.modal', '24']);

// What changed in the copy, against the baseline commit. Agents may commit (skill snapshots) or stage
// (git mv); a mixed reset moves HEAD and the index back so every change shows up, while the files stay as the agent left them.
const BASE = process.env.RESET_BASE || 'HEAD';
r.agentCommits = Number(git('rev-list', '--count', `${BASE}..HEAD`).trim() || 0);
sh('git', ['-C', DIR, 'reset', '-q', '--mixed', BASE]);
const status = git('status', '--porcelain', '-uall').split('\n').filter(Boolean)
  .filter((l) => !/\.obsidian\/(workspace|plugins\/)/.test(l));
fs.writeFileSync(path.join(OUT, 'status.txt'), status.join('\n') + '\n');
const pathOf = (l) => l.slice(3).replace(/^"|"$/g, '');
const lab = status.filter((l) => pathOf(l).startsWith(LAB + '/'));
const cfg = status.filter((l) => pathOf(l).startsWith('.obsidian/'));
const rootDaily = status.filter((l) => /^\d{4}-\d{2}-\d{2}\.md$/.test(pathOf(l)));
const other = status.filter((l) => !lab.includes(l) && !cfg.includes(l) && !rootDaily.includes(l) && !pathOf(l).startsWith('.trash/'));
r.changed = { lab: lab.length, config: cfg.map(pathOf), daily: rootDaily.map(pathOf), outsideLab: other.length };
r.diffStat = git('diff', '--stat=200', '--', LAB, '.obsidian/types.json', '.obsidian/app.json').trim();
fs.writeFileSync(path.join(OUT, 'lab.diff'), git('diff', '--', LAB, '.obsidian/types.json', '.obsidian/app.json'));
r.untrackedLab = lab.filter((l) => l.startsWith('??')).map(pathOf);
r.numberedCopies = status.filter((l) => l.startsWith('??') && / \d+\.md$/.test(pathOf(l))).map((l) => (pathOf(l).startsWith(LAB) ? pathOf(l) : '<real note>'));
r.typesJsonChanged = cfg.some((l) => pathOf(l) === '.obsidian/types.json');
r.trash = fs.existsSync(path.join(DIR, '.trash')) ? fs.readdirSync(path.join(DIR, '.trash')) : [];
r.emptyNewNotes = status.filter((l) => l.startsWith('??') && pathOf(l).endsWith('.md') && fs.statSync(path.join(DIR, pathOf(l))).size === 0).map(pathOf);
const rb = sh('powershell.exe', ['-NoProfile', '-Command', '$s=New-Object -ComObject Shell.Application; $b=$s.Namespace(10); @($b.Items() | Where-Object { $b.GetDetailsOf($_,1) -like "*' + VAULT + '*" }).Count'], { cwd: '/mnt/c' }).stdout.trim();
r.recycleBinAdded = Number(rb) - base.recycleBin;
const un = gt('unresolved', LAB);
r.labUnresolved = { total: un.total, links: un.links.map((x) => `${x.file} -> ${x.target}`) };
r.labUnresolvedAdded = un.total - 2; // fixture baseline: TN Alias, Missing Note Zeta

// CLI calls actually made (both sides go through the logging wrapper).
const log = fs.existsSync(path.join(OUT, 'cli.jsonl')) ? fs.readFileSync(path.join(OUT, 'cli.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse) : [];
const ends = log.filter((x) => x.ev === 'end');
r.cli = { calls: log.filter((x) => x.ev === 'start').length, finished: ends.length, outBytes: ends.reduce((a, x) => a + x.out + x.err, 0), maxOut: Math.max(0, ...ends.map((x) => x.out)) };
r.cli.unfinished = log.filter((x) => x.ev === 'start' && !ends.some((e) => e.t >= x.t && JSON.stringify(e.args) === JSON.stringify(x.args))).map((x) => x.args.join(' '));

// Scenario ground truth.
const T = `${LAB}/Target Note.md`;
const R = `${LAB}/Target Renamed.md`;
switch (S) {
  case 'S1': r.gt = gt('tasks'); break;
  case 'S2': case 'S5': {
    r.gt = { targetExists: exists(T), renamedExists: exists(R) };
    if (exists(R)) r.gt.backlinksToRenamed = gt('backlinks', R).total;
    if (exists(T)) r.gt.backlinksToTarget = gt('backlinks', T).total;
    break;
  }
  case 'S3': {
    // Scoped to the lab; damage elsewhere shows up as changed.outsideLab.
    r.gt = { proj: gt('tags', 'proj', LAB), projectActive: gt('tags', 'project/active', LAB), projects: gt('tags', 'projects', LAB) };
    r.gt.codeFileTouched = git('diff', '--name-only', '--', `${LAB}/tags/tag-code.md`).trim() !== '';
    break;
  }
  case 'S4': {
    const p = `${LAB}/props/Property Note.md`;
    r.gt = { yaml: gt('yaml', p), frontmatter: readV(p).split(/\r?\n---/)[0] };
    r.gt.typesJsonDiff = git('diff', '--', '.obsidian/types.json').split('\n').filter((l) => /^[+-]\s/.test(l));
    break;
  }
  case 'S7': r.gt = gt('backlinks', T); break;
  case 'S9': {
    const p = `${LAB}/long/Long CRLF Note.md`;
    const lines = readV(p).split('\r\n');
    const h = lines.indexOf('## Section 17');
    r.gt = { crlf: gt('crlf', p), thirdLine: lines[h + 3], diffLines: git('diff', '--numstat', '--', p).trim() };
    break;
  }
  case 'S8': {
    const dp = real('daily:path');
    r.gt = { dailyPath: dp, exists: exists(dp) };
    if (exists(dp)) { const t = readV(dp); r.gt.bytes = t.length; r.gt.occurrences = t.split('\n').filter((l) => l.includes('gọi ngân hàng')).length; r.gt.content = t; }
    break;
  }
}

fs.writeFileSync(path.join(OUT, 'check.json'), JSON.stringify(r, null, 1));
console.log(JSON.stringify(r, null, 1).slice(0, 3000));

// Teardown: undo the scenario's pre-state so the next reset starts clean.
if (flag !== '--no-teardown') {
  if (r.modalOpen) real('eval', "code=[...document.querySelectorAll('.modal button')].find(b=>b.textContent==='Do not update')?.click(); 1");
  real('eval', "code=app.vault.setConfig('alwaysUpdateLinks', true)");
  fs.writeFileSync(path.join(os.homedir(), '.local/state/obs-showcase/current.env'), 'CLOSED=0\n');
}
