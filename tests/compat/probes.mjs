#!/usr/bin/env node
// Compatibility probes: re-check every CLI behaviour the skill relies on, score it, keep history.
// Usage: node tests/compat/probes.mjs --vault <name> --dir <local vault path> [--env-label X] [--only P01,P02] [--no-write]
//        node tests/compat/probes.mjs --compare            (diff the last two runs)
// Needs: the vault copy is a git repo with the fixture committed under _agentkit-lab/ (see README.md).
// NEVER point this at a real vault: write probes rename, delete and change settings.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { OTF } from '../otf.mjs';
import { detectEnv, findCli, makeRunner, TESTED_CLI } from '../../skills/obsidian-connect/scripts/obs.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const histDir = path.join(here, 'history');
const histMd = path.join(here, 'HISTORY.md');
const argv = process.argv.slice(2);
const arg = (k, d = '') => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };

if (argv.includes('--compare')) { compare(); process.exit(0); }

const vault = arg('--vault');
const dir = arg('--dir');
if (!vault || !dir) { console.error('usage: probes.mjs --vault <name> --dir <local path> | --compare'); process.exit(5); }
const L = '_agentkit-lab';
const T = `${L}/Target Note.md`;
const env = detectEnv();
const cli = findCli(env);
if (!cli) { console.error('Obsidian CLI not found'); process.exit(2); }
const run = makeRunner(cli, env, vault);
const raw = makeRunner(cli, env, null); // no vault prefix, for targeting probes
const out = (args) => run(args).out.replace(/^\r?\n/, '').trim();
const num = (s) => Number(String(s).trim().split(/\s+/)[0]);
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const git = (...a) => spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' });
const evalJs = (code) => out(['eval', `code=${code}`]).replace(/^=> /, '');
const gt = (...a) => JSON.parse(spawnSync(process.execPath, [OTF, 'truth', ...a], { encoding: 'utf8' }).stdout);

// Safety: refuse unless the CLI's vault path is the --dir we were given and it is a git repo.
const winPath = out(['vault', 'info=path']);
const localPath = env === 'wsl' ? spawnSync('wslpath', ['-u', winPath], { encoding: 'utf8' }).stdout.trim() : winPath;
if (path.resolve(localPath) !== path.resolve(dir)) { console.error(`vault path ${localPath} != --dir ${dir}; refusing`); process.exit(7); }
if (git('rev-parse', '--is-inside-work-tree').stdout.trim() !== 'true') { console.error('--dir is not a git repo; refusing'); process.exit(7); }

function reset() {
  git('checkout', '-q', '--', '.');
  git('clean', '-fdq', '--', L);
  for (const f of fs.readdirSync(dir)) if (/^\d{4}-\d{2}-\d{2}\.md$/.test(f) && !git('ls-files', '--error-unmatch', f).stdout) fs.rmSync(path.join(dir, f));
  fs.rmSync(path.join(dir, '.trash'), { recursive: true, force: true });
  if (base && !waitBaseline(60)) { console.log('  (index drifted after reset; reloading)'); reloadAndSettle(); }
}
let base = null;
function counts() { return { back: num(out(['backlinks', `path=${T}`, 'total'])), unres: num(out(['unresolved', 'total'])) }; }
function waitBaseline(sec) {
  for (let i = 0; i < sec; i++) { const c = counts(); if (c.back === base.back && c.unres === base.unres) return true; sleep(1000); }
  return false;
}
// After an app start or reload the metadata cache rebuilds for 10-40 s (TROUBLESHOOTING.md).
// Settled = target backlinks equal the file-only ground truth and unresolved is stable for 3 reads.
function reloadAndSettle() {
  out(['reload']);
  const want = gt('backlinks', dir, T).total;
  let last = '', same = 0;
  for (let i = 0; i < 60; i++) {
    sleep(2000);
    const r = run(['unresolved', 'total']);
    if (r.code !== 0) { same = 0; continue; } // commands not registered yet
    const c = counts();
    const key = `${c.back}/${c.unres}`;
    same = c.back === want && key === last ? same + 1 : 0;
    last = key;
    if (same >= 2) return c;
  }
  throw new Error('index did not settle after reload (see TROUBLESHOOTING.md)');
}
function poll(fn, ms = 20000) {
  const end = Date.now() + ms;
  let v;
  do { v = fn(); if (v.ok) return v; sleep(1000); } while (Date.now() < end);
  return v;
}

// Windows Recycle Bin entries named `name` that came from `folder` (Windows path). Only these are ever touched.
// Returns null when PowerShell is not reachable (then P18 cannot clean up and says so).
function recycleBin(name, folder) {
  if (env !== 'wsl' && env !== 'windows') return null;
  const ps = `$sh=New-Object -ComObject Shell.Application; $rb=$sh.Namespace(10); foreach($i in $rb.Items()){ '{0}|{1}|{2}' -f $i.Name,$rb.GetDetailsOf($i,1),$i.Path }`;
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', cwd: env === 'wsl' ? '/mnt/c' : undefined });
  if (r.status !== 0) return null;
  const want = folder.replace(/[\\/]+$/, '').toLowerCase();
  return r.stdout.split(/\r?\n/).map((l) => l.split('|')).filter((a) => a.length === 3 && a[0] === name && a[1].replace(/[\\/]+$/, '').toLowerCase() === want).map((a) => a[2].trim());
}
// Delete one entry (the $R data file and its $I info file) by exact path.
function purgeBinEntry(p) {
  const info = p.replace(/\\\$R([^\\]*)$/, '\\$$I$1');
  const ps = `foreach($x in @('${p.replace(/'/g, "''")}','${info.replace(/'/g, "''")}')){ if(Test-Path -LiteralPath $x){ Remove-Item -LiteralPath $x -Recurse -Force } }`;
  return spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', cwd: env === 'wsl' ? '/mnt/c' : undefined }).status === 0;
}

// Weight = damage tier (YARDSTICK): data loss 5, links 4, silent wrong answer 3, metadata 3, tokens 2, env/UI 1.
// pass = the CLI still behaves as recorded in docs/FINDINGS.md, so the skill's guidance holds.
const probes = [
  { id: 'P01', f: 'F1', w: 1, name: 'version string', run: () => { const v = out(['version']); return { pass: /^\d+\.\d+\.\d+/.test(v), obs: v }; } },
  { id: 'P02', f: 'F6', w: 3, name: 'Error: text with exit 0', run: () => { const r = raw([`vault=${vault}`, 'read', 'path=__nope__.md']); return { pass: r.out.trim().startsWith('Error:') && r.code === 3, obs: r.out.trim().slice(0, 60) }; } },
  { id: 'P03', f: 'F1c', w: 5, name: 'vault= ignored unless first', run: () => { const r = raw(['version', 'vault=__nope__']).out.trim(); return { pass: /^\d+\./.test(r), obs: r.slice(0, 40) }; } },
  { id: 'P04', f: 'F1c', w: 3, name: 'wrong vault prints "Vault not found." (no Error:)', run: () => { const r = raw(['vault=__nope__', 'vault']).out.trim(); return { pass: r === 'Vault not found.', obs: r }; } },
  { id: 'P05', f: 'F6', w: 3, name: 'empty search string', run: () => { const r = out(['search', 'query=zzqq-no-such-text']); return { pass: r === 'No matches found.', obs: r }; } },
  { id: 'P06', f: 'F8b', w: 3, name: 'plain tasks is vault-wide', run: () => { out(['open', `path=${L}/tasks/odd/tasks-1.md`]); const c = num(out(['tasks', 'total'])); const g = gt('tasks', dir).total; return { pass: c === g, obs: `cli=${c} gt=${g}` }; } },
  { id: 'P07', f: 'F7', w: 3, name: 'plain tags is vault-wide; active is file-only', run: () => { const all = num(out(['tags', 'total'])); const act = num(out(['tags', 'active', 'total'])); return { pass: all > act, obs: `all=${all} active=${act}` }; } },
  { id: 'P08', f: 'F8a', w: 2, name: 'search format=json is a path list', run: () => { const r = out(['search', 'query="Section A"', `path=${L}`, 'format=json']); let a; try { a = JSON.parse(r); } catch { a = null; } return { pass: Array.isArray(a) && a.length === 2 && typeof a[0] === 'string', obs: r.slice(0, 80) }; } },
  { id: 'P09', f: 'F8a', w: 2, name: 'search:context json has 1-based lines', run: () => { const a = JSON.parse(out(['search:context', 'query="Section A"', `path=${L}`, 'format=json'])); const m = a.find((x) => x.file === T)?.matches?.[0]; return { pass: m?.line === 9, obs: JSON.stringify(m) }; } },
  { id: 'P10', f: 'F8c', w: 2, name: 'search total counts files', run: () => { const r = out(['search', 'query="Section A"', `path=${L}`, 'total']); return { pass: r === '2', obs: r }; } },
  { id: 'P11', f: 'F9f', w: 2, name: 'search:context ignores total', run: () => { const r = out(['search:context', 'query="Section A"', `path=${L}`, 'total']); return { pass: !/^\d+$/.test(r), obs: r.slice(0, 50) }; } },
  { id: 'P12', f: 'F9h', w: 2, name: 'outline json line numbers', run: () => { const a = JSON.parse(out(['outline', `path=${L}/long/Long CRLF Note.md`, 'format=json'])); return { pass: a[1]?.line === 6 && a.length === 31, obs: `n=${a.length} h2line=${a[1]?.line}` }; } },
  { id: 'P13', f: 'F4e', w: 4, name: 'backlinks: all forms, not code/alias-name', run: () => { const got = JSON.parse(out(['backlinks', `path=${T}`, 'format=json']).replace(/^No .*found\.$/, '[]')).map((x) => x.file).sort(); const want = gt('backlinks', dir, T).files.map((x) => x.file).sort(); return { pass: JSON.stringify(got) === JSON.stringify(want), obs: `cli=${got.length} gt=${want.length}` }; } },
  { id: 'P14', f: 'F4a', w: 4, name: 'rename updates links when alwaysUpdateLinks on', write: true, run: () => { evalJs("app.vault.setConfig('alwaysUpdateLinks', true)"); out(['rename', `path=${T}`, 'name=Target Renamed']); const v = poll(() => { const b = num(out(['backlinks', `path=${L}/Target Renamed.md`, 'total'])); const u = num(out(['unresolved', 'total'])); return { ok: b === base.back && u === base.unres, b, u }; }); return { pass: v.ok, obs: `backlinks=${v.b} unresolved=${v.u} (base ${base.back}/${base.unres})` }; } },
  { id: 'P15', f: 'F4c', w: 4, name: 'rename blocks on modal when alwaysUpdateLinks off', write: true, run: () => {
    evalJs("app.vault.setConfig('alwaysUpdateLinks', false)");
    const child = spawnSync(process.execPath, ['-e', `
      const { spawn } = require('child_process');
      const p = spawn(${JSON.stringify(cli)}, [${JSON.stringify(`vault=${vault}`)}, 'rename', ${JSON.stringify(`path=${T}`)}, 'name=Target Renamed'], { cwd: ${JSON.stringify(env === 'wsl' ? '/mnt/c' : process.cwd())} });
      setTimeout(() => { console.log(p.exitCode === null ? 'blocked' : 'returned'); process.exit(0); }, 3000);`], { encoding: 'utf8', timeout: 8000 });
    const modal = out(['dev:dom', 'selector=.modal', 'text']);
    evalJs("[...document.querySelectorAll('.modal button')].find(b=>b.textContent==='Do not update')?.click(); 1");
    evalJs("app.vault.setConfig('alwaysUpdateLinks', true)");
    return { pass: child.stdout.includes('blocked') && /Update links/.test(modal), obs: `${child.stdout.trim()}; modal=${modal.slice(0, 30)}` }; } },
  { id: 'P16', f: 'F4d', w: 2, name: 'move into missing folder: ENOENT, exit 0', write: true, run: () => { const r = raw([`vault=${vault}`, 'move', `path=${T}`, `to=${L}/no/such/dir/`]); return { pass: /ENOENT/.test(r.out) && fs.existsSync(path.join(dir, T)), obs: r.out.trim().slice(0, 50) }; } },
  { id: 'P17', f: 'F4b', w: 1, name: 'move restyles md links to newLinkFormat', write: true, run: () => { fs.mkdirSync(path.join(dir, L, 'moved'), { recursive: true }); sleep(1000); out(['move', `path=${T}`, `to=${L}/moved/`]); sleep(1500); const t = fs.readFileSync(path.join(dir, L, 'refs/deeper/ref-markdown.md'), 'utf8'); return { pass: t.includes('](Target%20Note.md)'), obs: t.trim() }; } },
  { id: 'P18', f: 'F5', w: 5, name: 'CLI delete ignores trashOption local (Recycle Bin)', write: true, run: () => {
    const f = `${L}/refs/ref-block.md`, folder = `${winPath}\\${L}\\refs`;
    const before = recycleBin('ref-block.md', folder);
    evalJs("app.vault.setConfig('trashOption','local')");
    const r = out(['delete', `path=${f}`]);
    sleep(1000);
    const local = fs.existsSync(path.join(dir, '.trash'));
    evalJs("app.vault.setConfig('trashOption','system')");
    // Clean up our own Recycle Bin entry: only new entries with this exact name from this exact folder.
    let bin = '; bin=n/a';
    if (before) {
      const mine = (recycleBin('ref-block.md', folder) || []).filter((x) => !before.includes(x));
      for (const x of mine) purgeBinEntry(x);
      const after = recycleBin('ref-block.md', folder) || [];
      bin = `; bin before=${before.length} added=${mine.length} after=${after.length}`;
    }
    return { pass: /Moved to trash/.test(r) && !local, obs: `${r.slice(0, 40)}; .trash=${local}${bin}` }; } },
  { id: 'P19', f: 'F9c', w: 5, name: 'create on existing path makes "name 1.md"', write: true, run: () => { const r = out(['create', `path=${L}/refs/ref-wikilink.md`, 'content=x']); return { pass: /ref-wikilink 1\.md/.test(r), obs: r }; } },
  { id: 'P20', f: 'F9c', w: 1, name: 'create makes parent folders', write: true, run: () => { out(['create', `path=${L}/p20/a/b.md`, 'content=x']); return { pass: fs.existsSync(path.join(dir, L, 'p20/a/b.md')), obs: '' }; } },
  { id: 'P21', f: 'F9e', w: 1, name: 'create opens no tab', write: true, run: () => { const a = out(['tabs']); out(['create', `path=${L}/p21.md`, 'content=x']); const b = out(['tabs']); return { pass: a === b, obs: '' }; } },
  { id: 'P22', f: 'F9a', w: 3, name: 'property:set "a, b" writes a string', write: true, run: () => { out(['property:set', 'name=status', 'value=a, b', `path=${L}/props/Property Note.md`]); const y = gt('yaml', dir, `${L}/props/Property Note.md`); return { pass: y.keys.status === 'string', obs: y.keys.status }; } },
  { id: 'P23', f: 'F9b', w: 3, name: 'property:set list rewrites types.json', write: true, run: () => { const before = fs.readFileSync(path.join(dir, '.obsidian/types.json'), 'utf8'); out(['property:set', 'name=tags', 'value=["proj","x"]', `path=${L}/props/Property Note.md`]); sleep(1500); const after = fs.readFileSync(path.join(dir, '.obsidian/types.json'), 'utf8'); return { pass: before !== after, obs: before !== after ? 'types.json changed' : 'unchanged' }; } },
  { id: 'P24', f: 'F9a', w: 3, name: 'property:set number without type gives string', write: true, run: () => { out(['property:set', 'name=rating', 'value=7', `path=${L}/props/Property Note.md`]); const y = gt('yaml', dir, `${L}/props/Property Note.md`); return { pass: y.keys.rating === 'string', obs: y.keys.rating }; } },
  { id: 'P25', f: 'F9d', w: 1, name: 'properties format=json is JSON', run: () => { try { JSON.parse(out(['properties', `path=${L}/props/Property Note.md`, 'format=json'])); return { pass: true, obs: '' }; } catch (e) { return { pass: false, obs: e.message }; } } },
  { id: 'P26', f: 'F9g', w: 2, name: 'daily:append twice duplicates', write: true, run: () => { const p = out(['daily:path']); out(['daily:append', 'content=P26 marker']); out(['daily:append', 'content=P26 marker']); const t = fs.existsSync(path.join(dir, p)) ? fs.readFileSync(path.join(dir, p), 'utf8') : ''; const n = (t.match(/P26 marker/g) || []).length; return { pass: n === 2, obs: `${p} count=${n}` }; } },
  { id: 'P29', f: 'F9j', w: 2, name: 'daily:read creates the daily note (empty, or from the template)', write: true, run: () => { const p = out(['daily:path']); for (let i = 0; i < 15 && run(['file', `path=${p}`]).code === 0; i++) sleep(1000); const before = fs.existsSync(path.join(dir, p)) || run(['file', `path=${p}`]).code === 0; out(['daily:read']); sleep(800); const after = fs.existsSync(path.join(dir, p)); const size = after ? fs.statSync(path.join(dir, p)).size : 0; return { pass: !before && after, obs: `before=${before} after=${after} bytes=${size}` }; } },
  { id: 'P30', f: 'F12', w: 3, name: 'tasks: raw text only; any non-space status counts as done', write: true, run: () => {
    const f = `${L}/p30-tasks.md`;
    fs.writeFileSync(path.join(dir, f), ['- [ ] a', '- [ ] b ⏫ 📅 2026-10-30', '- [/] c 🔼', '- [-] d', '- [x] e ✅ 2026-10-27'].join('\n') + '\n');
    const v = poll(() => { const t = num(out(['tasks', `path=${f}`, 'total'])); return { ok: t === 5, t }; });
    const todo = num(out(['tasks', `path=${f}`, 'todo', 'total'])), done = num(out(['tasks', `path=${f}`, 'done', 'total']));
    let j = []; try { j = JSON.parse(out(['tasks', `path=${f}`, 'format=json'])); } catch { /* shown in obs */ }
    const keys = [...new Set(j.flatMap((x) => Object.keys(x)))].sort().join(',');
    const byS = out(['tasks', `path=${f}`, 'status=/']);
    const pass = v.ok && todo === 2 && done === 3 && keys === 'file,line,status,text' && j[1]?.text.includes('📅 2026-10-30') && j.map((x) => x.status).join('') === '  /-x' && /^- \[\/\] c/.test(byS);
    return { pass, obs: `total=${v.t} todo=${todo} done=${done} keys=${keys} status=/ -> ${byS.slice(0, 20)}` }; } },
  { id: 'P31', f: 'F13', w: 3, name: 'create template= runs core Templates only; Templater runs only if its create trigger is on', write: true, run: () => {
    const TP = 'app.plugins.plugins["templater-obsidian"]', CO = 'app.internalPlugins.plugins.templates.instance.options';
    if (evalJs(`!!${TP}`) !== 'true') return { pass: false, obs: 'Templater not loaded' };
    const f = `${L}/p31-tpl.md`, tag = '<% 1+1 %>';
    fs.writeFileSync(path.join(dir, f), `T={{title}} X=${tag}\n`);
    const prevTrig = evalJs(`${TP}.settings.trigger_on_file_creation`), prevFolder = evalJs(`${CO}.folder`);
    const mk = (n, extra) => { out(['create', `path=${L}/${n}.md`, ...extra]); sleep(3500); try { return fs.readFileSync(path.join(dir, `${L}/${n}.md`), 'utf8').trim(); } catch { return ''; } }; // fixed wait: Templater rewrites the new file a moment after it appears
    const setTrig = (v) => evalJs(`(()=>{${TP}.settings.trigger_on_file_creation=${v};${TP}.event_handler.update_trigger_file_on_creation();return "ok"})()`);
    let off = '', on = '', plain = '';
    try {
      evalJs(`(()=>{${CO}.folder="${L}";return "ok"})()`);
      setTrig(false); off = mk('p31-off', ['template=p31-tpl']);
      setTrig(true); on = mk('p31-on', ['template=p31-tpl']); plain = mk('p31-plain', [`content=Z=<% 2+2 %>`]);
    } finally {
      setTrig(prevTrig === 'true');
      evalJs(`(()=>{${prevFolder === 'undefined' || prevFolder === '' ? `delete ${CO}.folder` : `${CO}.folder=${JSON.stringify(prevFolder)}`};return "ok"})()`);
    }
    const pass = off === `T=p31-off X=${tag}` && on === 'T=p31-on X=2' && plain === 'Z=4';
    return { pass, obs: `trigger off: ${off}; on: ${on}; plain content, on: ${plain}` }; } },
  { id: 'P27', f: 'F6', w: 1, name: 'unknown flags ignored silently', run: () => { const r = out(['search', 'query="Section A"', `path=${L}`, 'bogusflag=1', 'matches']); return { pass: r.split('\n').length === 2, obs: r.replace(/\n/g, ' | ').slice(0, 60) }; } },
  { id: 'P28', f: 'F1', w: 1, name: 'bridge --preflight <= 5 lines, exit 0', run: () => { const r = spawnSync(process.execPath, [path.join(here, '..', '..', 'skills/obsidian-connect/scripts/obs.mjs'), '--preflight'], { encoding: 'utf8', env: { ...process.env, OBS_VAULT: vault } }); return { pass: r.status === 0 && r.stdout.trim().split('\n').length <= 5, obs: `exit=${r.status}` }; } },
];

const only = arg('--only') ? new Set(arg('--only').split(',')) : null;
const noWrite = argv.includes('--no-write');
reset();
if (!fs.existsSync(path.join(dir, T))) { console.error(`fixture missing after git reset: ${T}`); process.exit(5); }
base = reloadAndSettle();
console.log(`baseline: backlinks=${base.back} unresolved=${base.unres}`);
const results = [];
for (const p of [...probes.filter((x) => !x.write), ...probes.filter((x) => x.write)]) { // read-only first: write probes can leave ghost index entries
  if ((only && !only.has(p.id)) || (noWrite && p.write)) { results.push({ id: p.id, finding: p.f, weight: p.w, name: p.name, pass: null, observed: 'skipped' }); continue; }
  let r;
  try { r = p.run(); } catch (e) { r = { pass: false, obs: `threw: ${e.message}` }; }
  results.push({ id: p.id, finding: p.f, weight: p.w, name: p.name, pass: !!r.pass, observed: String(r.obs ?? '') });
  console.log(`${r.pass ? 'PASS' : 'FAIL'} ${p.id} ${p.name}${r.obs ? ' :: ' + r.obs : ''}`);
  if (p.write) reset();
}
reset();

const ran = results.filter((r) => r.pass !== null);
const passed = ran.filter((r) => r.pass);
const wTotal = ran.reduce((s, r) => s + r.weight, 0);
const wPass = passed.reduce((s, r) => s + r.weight, 0);
const cliVer = out(['version']).split(/\s+/)[0];
const date = new Date().toISOString();
const record = { date, cli: cliVer, tested_cli: TESTED_CLI, env: arg('--env-label', env), node: process.versions.node, score: { passed: passed.length, ran: ran.length, weighted_pct: Math.round((1000 * wPass) / (wTotal || 1)) / 10 }, results };
fs.mkdirSync(histDir, { recursive: true });
const file = path.join(histDir, `${date.slice(0, 19).replace(/[:T]/g, '-')}_${cliVer}_${record.env}.json`);
fs.writeFileSync(file, JSON.stringify(record, null, 1) + '\n');
rebuildHistory();
console.log(`\nscore ${passed.length}/${ran.length} weighted ${record.score.weighted_pct}%  -> ${path.relative(process.cwd(), file)}`);
if (cliVer !== TESTED_CLI) console.log(`CLI ${cliVer} differs from tested ${TESTED_CLI}: update FINDINGS, traps.md and SKILL metadata for every changed probe.`);

// HISTORY.md is derived from history/*.json (the source of truth), so it is rebuilt on every run.
// "Changed" compares only probes that ran in both this run and the previous run that ran them.
function rebuildHistory() {
  const runs = fs.readdirSync(histDir).filter((x) => x.endsWith('.json')).sort().map((f) => JSON.parse(fs.readFileSync(path.join(histDir, f), 'utf8')));
  const last = {};
  const rows = runs.map((r) => {
    const flips = [];
    for (const x of r.results) {
      if (x.pass === null) continue;
      if (x.id in last && last[x.id] !== x.pass) flips.push(`${x.id}:${x.pass ? 'now pass' : 'now FAIL'}`);
      last[x.id] = x.pass;
    }
    const ran = r.results.filter((x) => x.pass !== null);
    const kind = ran.length < r.results.length ? ` (partial: ${ran.map((x) => x.id).join(' ')})` : '';
    return `| ${r.date.slice(0, 16).replace('T', ' ')} | ${r.cli} | ${r.env} | ${r.score.passed}/${r.score.ran}${kind} | ${r.score.weighted_pct}% | ${flips.join(', ') || 'none'} | ${ran.filter((x) => !x.pass).map((x) => x.id).join(', ') || '—'} |`;
  });
  fs.writeFileSync(histMd, '# Probe score history\n\nGenerated from `history/*.json` on every run of `tests/compat/probes.mjs`. Method and scoring: `README.md`.\n"Changed" lists probes whose result differs from the last run that ran them.\n\n| Date (UTC) | CLI | Env | Passed / ran | Weighted score | Changed | Failed probes |\n|---|---|---|---|---|---|---|\n' + rows.join('\n') + '\n');
}

function previous(exclude) {
  if (!fs.existsSync(histDir)) return null;
  const f = fs.readdirSync(histDir).filter((x) => x.endsWith('.json')).map((x) => path.join(histDir, x)).filter((x) => x !== exclude).sort().pop();
  return f ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}
function compare() {
  const files = fs.existsSync(histDir) ? fs.readdirSync(histDir).filter((x) => x.endsWith('.json')).sort() : [];
  if (files.length < 2) { console.log('need at least two runs in history/'); return; }
  const [a, b] = files.slice(-2).map((f) => JSON.parse(fs.readFileSync(path.join(histDir, f), 'utf8')));
  console.log(`${a.date} cli ${a.cli} ${a.score.weighted_pct}%  ->  ${b.date} cli ${b.cli} ${b.score.weighted_pct}%`);
  for (const r of b.results) { const o = a.results.find((x) => x.id === r.id); if (!o || o.pass !== r.pass) console.log(`${r.id} ${r.name}: ${o ? o.pass : 'new'} -> ${r.pass}  (${r.observed})`); }
}
