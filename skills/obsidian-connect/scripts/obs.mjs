#!/usr/bin/env node
// obsidian-connect bridge v2: call the Windows Obsidian CLI from WSL, PowerShell, cmd or Git Bash.
// Usage: node obs.mjs --help. Read commands pass through to the CLI; every write goes through a bridge command.
// Vault: --vault <name>, else OBS_VAULT, else the vault remembered by the last --preflight (12 h). Always sent first.
// Output contract: bridge commands print a first line "OK: ...", "NOT DONE: ..." or "APPROXIMATE: ..." (file mode).
// Every non-zero exit ends with a stderr line "NEXT: <what to do>". Pass-through stdout is the CLI's, unchanged.
// Exit: 0 ok, 2 unreachable, 3 CLI error, 4 empty, 5 usage, 6 not ready, 7 guard refused/verify failed, 124 timeout.
// Env: OBS_VAULT, OBS_VAULT_DIR, OBS_TIMEOUT (s, default 10), OBS_CLI, OBS_VERIFY_MS, OBS_LOG, OBS_STATE, OBS_OBSIDIAN_JSON.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as F from './files.mjs';

export const TESTED_CLI = '1.14.4';
const EXIT = { ok: 0, unreachable: 2, error: 3, empty: 4, usage: 5, notReady: 6, guard: 7, timeout: 124 };
const LIST_CMDS = /^(search|search:context|backlinks|links|tags|tag|tasks|orphans|deadends|unresolved|aliases|properties|outline|files|folders|bases|base:query|templates|recents|bookmarks|daily:read|read|property:read)$/;
const EMPTY_RE = /^No [\w ]+ found\.$/;
// Commands that exist on CLI 1.14.4 (obsidian help). "Command not found" for one of these means the app is still loading.
const KNOWN = new Set(('aliases append backlinks base:create base:query base:views bases bookmark bookmarks command commands create daily daily:append '
  + 'daily:path daily:prepend daily:read deadends delete diff file files folder folders help history history:list history:open history:read '
  + 'history:restore hotkey hotkeys links move open orphans outline plugin plugin:disable plugin:enable plugin:install plugin:reload '
  + 'plugin:uninstall plugins plugins:enabled prepend properties property:read property:remove property:set read recents reload rename '
  + 'search search:context tabs tag tags task tasks template:insert template:read templates theme themes unresolved vault version wordcount eval').split(' '));
const NOTE = '<note.md>';
// Raw CLI writes: the bridge refuses them (exit 5) and names the bridge command that does the job with a read-back.
// lock: true = --allow-unsafe cannot unlock it (rename/move with links off open a modal and break links, F4c).
const ROUTE = {
  create: { next: `obs --create path=${NOTE} content="<text>"` },
  'base:create': { next: `obs --create path=${NOTE} content="<text>"` },
  rename: { next: `obs --rename path=${NOTE} name="<new name>"`, lock: true },
  move: { next: `obs --move path=${NOTE} to=<folder>/`, lock: true },
  delete: { next: `obs --trash path=${NOTE}  (keeps it in the vault's .trash/; CLI delete goes to the OS Recycle Bin, F5)` },
  append: { next: `obs --append path=${NOTE} content="<text>"` },
  prepend: { next: `obs --section-edit path=${NOTE} heading="<heading>" after=0 text="<text>"` },
  'property:set': { next: `obs --prop-set path=${NOTE} name=<key> value=<value>  (lists: add=<item> or remove=<item>)` },
  'property:remove': { next: `obs --prop-set path=${NOTE} name=<key> unset` },
  'daily:append': { next: 'obs --daily-append-once content="<line>"' },
  'daily:prepend': { next: 'obs --daily-append-once content="<line>"' },
  daily: { next: 'obs --daily-append-once content="<line>" to add a line; obs daily:read to read today\'s note' },
};
// Refused for safety (exit 7). never: --allow-unsafe cannot unlock it either (eval runs any JS inside the app).
const DENY = [
  { re: /^(eval|devtools)$|^dev:/, never: true, next: 'eval and dev commands are never allowed. To search text: obs --find "<words>"; to read a note: obs read path=<note.md>' },
  { re: /^(plugin:(install|uninstall|enable|disable)|theme:(install|uninstall)|history:restore|command)$/, next: 'tell the user what you wanted to run and why; run it only after they confirm that exact command, adding --allow-unsafe' },
];
const SHELL = /^(grep|rg|find|ls|cat|head|tail|wc|sed|awk|mv|rm|cp|exec|sh|bash|cmd|powershell|node|python3?|echo|vaults)$/;

class Fail extends Error {
  constructor(code, reason, { out = '', next = '' } = {}) { super(reason); this.code = code; this.out = out; this.next = next; }
}

export function detectEnv(platform = process.platform, procVersion = readSafe('/proc/version')) {
  if (platform === 'win32') return 'windows';
  if (platform === 'linux' && /microsoft/i.test(procVersion)) return 'wsl';
  return 'other';
}
function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

// ---------- state: remembered vault and last failure ----------
const stateFile = () => process.env.OBS_STATE || path.join(os.tmpdir(), 'obsidian-connect-state.json');
const STATE_TTL = 12 * 3600 * 1000;
function loadState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')) || {}; } catch { return {}; }
}
function saveState(s) {
  try { fs.writeFileSync(stateFile(), JSON.stringify(s)); } catch { /* state is optional */ }
}

// ---------- CLI discovery ----------
const cacheFile = path.join(os.tmpdir(), 'obsidian-connect-cli.json');

export function findCli(env) {
  if (process.env.OBS_CLI) return process.env.OBS_CLI;
  const cached = readSafe(cacheFile);
  if (cached) {
    try { const c = JSON.parse(cached); if (c.env === env && fs.existsSync(c.cli)) return c.cli; } catch { /* rebuild */ }
  }
  let cli = null;
  if (env === 'windows') {
    const w = spawnSync('where', ['obsidian.com'], { encoding: 'utf8', timeout: 5000 });
    cli = (w.stdout || '').split(/\r?\n/).find(Boolean) || null;
    const local = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Obsidian', 'Obsidian.com');
    if (!cli && fs.existsSync(local)) cli = local;
  } else if (env === 'wsl') {
    const r = spawnSync('cmd.exe', ['/c', 'echo %LOCALAPPDATA%'], { encoding: 'utf8', timeout: 5000, cwd: '/mnt/c' });
    const win = (r.stdout || '').trim();
    if (win && !win.includes('%')) {
      const p = toLocal(`${win}\\Programs\\Obsidian\\Obsidian.com`, env);
      if (p && fs.existsSync(p)) cli = p;
    }
    if (!cli) cli = globUsers('AppData/Local/Programs/Obsidian/Obsidian.com'); // cmd.exe hidden (sandbox)
  }
  if (cli) { try { fs.writeFileSync(cacheFile, JSON.stringify({ env, cli })); } catch { /* cache is optional */ } }
  return cli;
}
// /mnt/c/Users/*/<rel>: the first user folder that has it (WSL only; works when cmd.exe is hidden).
function globUsers(rel) {
  let users = [];
  try { users = fs.readdirSync('/mnt/c/Users'); } catch { return null; }
  for (const u of users) { const p = path.posix.join('/mnt/c/Users', u, rel); if (fs.existsSync(p)) return p; }
  return null;
}
function toLocal(win, env) {
  if (!win || win.startsWith('/') || env !== 'wsl') return win;
  const r = spawnSync('wslpath', ['-u', win], { encoding: 'utf8' });
  const p = (r.stdout || '').trim();
  if (p) return p;
  const m = win.match(/^([A-Za-z]):\\(.*)$/);
  return m ? `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}` : win;
}

// Classify one CLI result into an exit code. Exported for tests.
export function classify({ status, stdout, stderr, signal, error }, cmd = '') {
  if (error && error.code === 'ETIMEDOUT') return [EXIT.timeout, 'timeout'];
  if (signal === 'SIGTERM' || signal === 'SIGKILL') return [EXIT.timeout, 'timeout'];
  if (error) return [EXIT.unreachable, `spawn failed: ${error.code || error.message}`];
  const out = (stdout || '').replace(/^\r?\n/, ''); // Obsidian.exe prints a leading blank line
  const first = out.split(/\r?\n/)[0].trim();
  // The "app closed" message goes to stderr (seen from WSL interop) or stdout (PowerShell).
  if (/unable to find Obsidian/i.test(out + (stderr || ''))) return [EXIT.unreachable, 'Obsidian is not running'];
  if (status === 127) return [EXIT.unreachable, 'exit 127 (Obsidian.exe instead of Obsidian.com?)'];
  if (/^Error: Command ".*" not found/.test(first)) return cmd && !KNOWN.has(cmd) ? [EXIT.usage, `no such command "${cmd}"`] : [EXIT.notReady, first];
  if (first.startsWith('Error:')) return [EXIT.error, first];
  if (first === 'Vault not found.') return [EXIT.error, first];
  if (status !== 0) return [EXIT.error, `exit ${status}`];
  if (EMPTY_RE.test(first) || (LIST_CMDS.test(cmd) && out.trim() === '')) return [EXIT.empty, first || 'empty output'];
  return [EXIT.ok, ''];
}

export function makeRunner(cli, env, vault) {
  const timeout = Number(process.env.OBS_TIMEOUT || 10) * 1000;
  const cwd = env === 'wsl' ? '/mnt/c' : env === 'windows' ? (process.env.SystemDrive || 'C:') + '\\' : process.cwd();
  return (args) => {
    if (!cli) return { code: EXIT.unreachable, reason: 'Obsidian CLI not found', out: '' };
    const full = vault ? [`vault=${vault}`, ...args] : args;
    const r = spawnSync(cli, full, { encoding: 'utf8', timeout, cwd, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 * 1024 });
    const [code, reason] = classify(r, args[0] || '');
    return { code, reason, out: r.stdout || '' };
  };
}

// ---------- argument helpers ----------
// key=value pairs; bare words land in o._ (in order).
function kv(args) {
  const o = { _: [] };
  for (const a of args) { const i = a.indexOf('='); if (i > 0 && /^[\w:-]+$/.test(a.slice(0, i))) o[a.slice(0, i)] = a.slice(i + 1); else o._.push(a); }
  return o;
}
const FLAG_WORDS = /^(total|verbose|counts|todo|done|apply|once|unset|inline|open|newtab|overwrite|active|format|sort|case|limit)$/;
// Accept a note path given without path= (`obs read "a b.md"`, even unquoted `obs read a b.md`).
export function fixPathArgs(args) {
  if (args.some((a) => a.startsWith('path=') || a.startsWith('file='))) return args;
  const i = args.findIndex((a, k) => k > 0 && !a.includes('=') && /\.(md|canvas|base)$/i.test(a));
  if (i < 0) return args;
  let s = i;
  while (s > 1 && !args[s - 1].includes('=') && !FLAG_WORDS.test(args[s - 1]) && !args[s - 1].startsWith('--')) s--;
  return [...args.slice(0, s), `path=${args.slice(s, i + 1).join(' ')}`, ...args.slice(i + 1)];
}

function must(run, args, okCodes = [EXIT.ok]) {
  const r = run(args);
  if (!okCodes.includes(r.code)) throw new Fail(r.code, `${args[0]}: ${r.reason}`, { next: nextFor(r.code, r.reason) });
  return r.out.replace(/^\r?\n/, '').trim();
}
const num = (s) => Number(String(s).trim().split(/\s+/)[0]) || 0;
const evalOut = (s) => s.replace(/^=> /, '').trim();
const exists = (run, p) => run(['file', `path=${p}`]).code === EXIT.ok;
const absIn = (root, rel) => path.join(root, ...rel.split('/'));
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// ---------- vault location ----------
function obsidianJson(env, cli) {
  const c = [process.env.OBS_OBSIDIAN_JSON];
  if (env === 'windows') c.push(path.join(process.env.APPDATA || '', 'obsidian', 'obsidian.json'));
  if (env === 'wsl') {
    if (cli && /\/AppData\/Local\//.test(cli)) c.push(cli.replace(/\/AppData\/Local\/.*$/, '/AppData/Roaming/obsidian/obsidian.json'));
    c.push(globUsers('AppData/Roaming/obsidian/obsidian.json'));
  }
  if (env === 'other') c.push(path.join(os.homedir(), '.config', 'obsidian', 'obsidian.json'), path.join(os.homedir(), 'Library', 'Application Support', 'obsidian', 'obsidian.json'));
  return c.find((p) => p && fs.existsSync(p)) || null;
}
// The folder of ONE vault, by name, from obsidian.json. Never returns or prints the other vaults (privacy).
function vaultFromJson(env, cli, name) {
  const f = obsidianJson(env, cli);
  if (!f) return null;
  let vaults;
  try { vaults = Object.values(JSON.parse(fs.readFileSync(f, 'utf8')).vaults || {}); } catch { return null; }
  const base = (p) => String(p).split(/[\\/]/).filter(Boolean).pop();
  let hits = vaults.filter((v) => base(v.path) === name);
  if (!hits.length) hits = vaults.filter((v) => base(v.path)?.toLowerCase() === name.toLowerCase());
  if (hits.length !== 1) return null;
  return { win: hits[0].path, local: toLocal(hits[0].path, env), source: 'obsidian.json' };
}
function vaultPaths(run, env) {
  const win = must(run, ['vault', 'info=path']);
  return { win, local: toLocal(win, env), source: 'cli' };
}

// ---------- context ----------
function context(argv) {
  const args = [...argv];
  const take = (flag) => { const i = args.indexOf(flag); if (i < 0) return null; const v = args[i + 1] || ''; args.splice(i, 2); return v; };
  const state = loadState();
  const fresh = state.vault && Date.now() - (state.savedAt || 0) < STATE_TTL;
  let vault = take('--vault') ?? process.env.OBS_VAULT ?? '';
  let remembered = false;
  if (!vault && fresh) { vault = state.vault; remembered = true; }
  const dir = take('--dir') ?? process.env.OBS_VAULT_DIR ?? '';
  const allowUnsafe = args.includes('--allow-unsafe');
  const rest = args.filter((a) => a !== '--allow-unsafe');
  const env = detectEnv();
  return { vault, dir, allowUnsafe, rest, env, state, remembered };
}
// Local folder of the vault: --dir, remembered state, live CLI, then obsidian.json.
function localVault(ctx, run) {
  if (ctx.dir) return { local: ctx.dir, source: '--dir' };
  if (ctx.state.vault === ctx.vault && ctx.state.local && fs.existsSync(path.join(ctx.state.local, '.obsidian'))) return { local: ctx.state.local, source: 'remembered' };
  if (run) { const r = run(['vault', 'info=path']); if (r.code === EXIT.ok) return { local: toLocal(r.out.replace(/^\r?\n/, '').trim(), ctx.env), source: 'cli' }; }
  return vaultFromJson(ctx.env, ctx.cli, ctx.vault);
}
function needLocal(ctx, run) {
  const v = localVault(ctx, run);
  if (!v?.local || !fs.existsSync(v.local)) throw new Fail(EXIT.usage, `vault folder of "${ctx.vault}" not found`, { next: 'ask the user for the vault folder, then run: obs --preflight --dir "<folder>"' });
  return v.local;
}
function needNote(root, rel) {
  if (!rel) throw new Fail(EXIT.usage, 'needs path=<note.md>', { next: 'add path=<note.md> (vault-relative, / separators); find it with obs --find "<words>"' });
  const p = absIn(root, rel);
  if (!fs.existsSync(p)) throw new Fail(EXIT.error, `note not found: ${rel}`, { next: 'check the path: obs --find "<part of the name>" lists matching notes' });
  return p;
}

// ---------- NEXT lines ----------
export function nextFor(code, reason = '') {
  if (code === EXIT.unreachable) return 'Obsidian is not running; do not retry. obs --find, obs --backlinks and obs --tasks-count still work from files and print APPROXIMATE; copy that word into your answer. Do not rename, move or delete.';
  if (code === EXIT.error && /Vault not found/.test(reason)) return 'the vault name is wrong; ask the user for the exact name, then: obs --preflight --vault "<name>"';
  if (code === EXIT.error && /(File|note|source)\b.*not found|not found: /i.test(reason)) return 'check the path: obs --find "<part of the name>" lists matching notes; paths are vault-relative with / (folder/Note.md)';
  if (code === EXIT.error) return 'read the error, fix the command once (obs help <command>); do not repeat the same command';
  if (code === EXIT.empty) return 'nothing found. Check path= and spelling before you say "none"; for words with accents use obs --find "<words>" (it also tries the unaccented form)';
  if (code === EXIT.usage) return 'run obs --help and use one of the commands it lists';
  if (code === EXIT.notReady) return 'Obsidian is still loading; wait 2 s and run the same command once more';
  if (code === EXIT.guard) return 'stop and tell the user why it was refused; do not try another way';
  if (code === EXIT.timeout) return 'Obsidian did not answer (a dialog may be open in the app); do not retry, tell the user';
  return 'tell the user what failed';
}

// ---------- bridge commands ----------
function preflight(ctx) {
  const { env, cli, vault } = ctx;
  const run = makeRunner(cli, env, null);
  const v = cli ? run(['version']) : { code: EXIT.unreachable, reason: 'Obsidian CLI not found' };
  const verLine = (ver) => `env=${env} cli=${ver} tested=${TESTED_CLI} match=${ver.split('.').slice(0, 2).join('.') === TESTED_CLI.split('.').slice(0, 2).join('.') ? 'yes' : 'no -> tell the user the CLI changed; traps may differ (tests/compat)'}`;
  if (!vault) throw new Fail(EXIT.usage, 'no vault name', { out: `NOT DONE: no vault name given\n${cli && v.code === EXIT.ok ? verLine(v.out.trim().split(/\s+/)[0]) : `env=${env}`}\n`, next: 'ask the user for the vault name, then run: obs --preflight --vault "<name>". Do not look for it in obsidian.json or list vaults.' });
  if (v.code !== EXIT.ok) {
    const loc = localVault(ctx, null);
    const lines = ['APPROXIMATE: Obsidian is not running, so answers come from files and may be incomplete (file mode)'];
    if (loc?.local && fs.existsSync(loc.local)) {
      lines.push(`vault "${vault}" at ${loc.local} (from ${loc.source})`);
      saveState({ ...ctx.state, vault, local: loc.local, savedAt: Date.now() });
    } else lines.push(`vault "${vault}": folder unknown`);
    lines.push(`env=${env} cli=${cli ? 'found' : 'none'} (${v.reason})`);
    throw new Fail(EXIT.unreachable, v.reason, { out: lines.join('\n') + '\n', next: loc?.local ? nextFor(EXIT.unreachable) + ' For other jobs read references/file-mode.md.' : 'ask the user to start Obsidian, or for the vault folder: obs --preflight --dir "<folder>"' });
  }
  const runV = makeRunner(cli, env, vault);
  const p = ctx.dir ? { local: ctx.dir } : vaultPaths(runV, env);
  const cfg = evalOut(must(runV, ['eval', "code=['alwaysUpdateLinks','trashOption'].map(k=>k+'='+app.vault.getConfig(k)).join(' ')"]));
  saveState({ ...ctx.state, vault, local: p.local, savedAt: Date.now() });
  const links = /alwaysUpdateLinks=true/.test(cfg) ? '' : ' -> --rename and --move will refuse until the user turns on "Automatically update internal links"';
  return [`OK: vault "${vault}" at ${p.local}`, verLine(v.out.trim().split(/\s+/)[0]), `${cfg} (obs --trash uses .trash/ anyway)${links}`,
    'remembered: the next obs commands use this vault for 12 h; OBS_VAULT is optional now'].join('\n') + '\n';
}

function linkGuard(run) {
  const v = evalOut(must(run, ['eval', "code=app.vault.getConfig('alwaysUpdateLinks')"]));
  if (v !== 'true') throw new Fail(EXIT.guard, `alwaysUpdateLinks is ${v}: rename/move would open a dialog in Obsidian and leave links broken (F4c)`, {
    next: 'tell the user: turn on Settings > Files and links > Automatically update internal links, then ask again. Do not retry and do not rename any other way (no mv, no raw rename, no --allow-unsafe).' });
}

function guardedMove(ctx, run, op, a) {
  if (!a.path) throw new Fail(EXIT.usage, `--${op} needs path=`, { next: op === 'rename' ? ROUTE.rename.next : ROUTE.move.next });
  if (op === 'rename' && !a.name) throw new Fail(EXIT.usage, '--rename needs name=', { next: ROUTE.rename.next });
  if (op === 'move' && !a.to) throw new Fail(EXIT.usage, '--move needs to=', { next: ROUTE.move.next });
  const dest = op === 'rename'
    ? path.posix.join(path.posix.dirname(a.path), `${a.name}${a.name.endsWith('.md') ? '' : '.md'}`)
    : (a.to.endsWith('/') || !a.to.endsWith('.md') ? path.posix.join(a.to, path.posix.basename(a.path)) : a.to);
  if (!exists(run, a.path)) throw new Fail(EXIT.error, `source not found: ${a.path}`, { next: nextFor(EXIT.error, 'note not found') });
  if (exists(run, dest)) throw new Fail(EXIT.guard, `destination exists: ${dest}`, { next: 'tell the user a note with that name already exists; ask for another name' });
  linkGuard(run);
  const root = vaultPaths(run, ctx.env).local;
  const before = { back: num(must(run, ['backlinks', `path=${a.path}`, 'total'], [EXIT.ok, EXIT.empty])), unres: num(must(run, ['unresolved', 'total'], [EXIT.ok, EXIT.empty])) };
  // Snapshot the note and every note that links to it (Obsidian rewrites those links).
  const snap = F.snapshot(root, [a.path, ...F.backlinksFromFiles(root, a.path).files]);
  if (op === 'move') {
    const dir = path.posix.dirname(dest);
    if (dir !== '.') fs.mkdirSync(absIn(root, dir), { recursive: true }); // CLI move does not create folders (F4d)
  }
  const args = op === 'rename' ? ['rename', `path=${a.path}`, `name=${a.name}`] : ['move', `path=${a.path}`, `to=${a.to}`];
  const r = run(args);
  if (r.code !== EXIT.ok) throw new Fail(r.code === EXIT.timeout ? EXIT.guard : r.code, `${op} returned ${r.reason}; snapshot in ${snap}`, { next: 'tell the user: check Obsidian for an open "Update links" dialog, then run obs unresolved total. Do not retry.' });
  // The metadata cache can lag 10+ s after a move into a new folder: poll instead of one fixed wait.
  let after, ok;
  const deadline = Date.now() + Number(process.env.OBS_VERIFY_MS ?? 30000);
  do {
    sleep(1000);
    after = { back: num(must(run, ['backlinks', `path=${dest}`, 'total'], [EXIT.ok, EXIT.empty])), unres: num(must(run, ['unresolved', 'total'], [EXIT.ok, EXIT.empty])) };
    ok = exists(run, dest) && after.back === before.back && after.unres === before.unres;
  } while (!ok && Date.now() < deadline);
  const line = `${a.path} -> ${dest}; backlinks ${before.back}->${after.back}; unresolved ${before.unres}->${after.unres}; snapshot in ${snap}`;
  if (!ok) throw new Fail(EXIT.guard, `verify failed: ${line}`, { next: 'tell the user the links did not check out (numbers above) and where the snapshot is; do not retry' });
  return `OK: ${op === 'rename' ? 'renamed' : 'moved'} ${line}\n`;
}

function trash(ctx, run, a) {
  if (!a.path) throw new Fail(EXIT.usage, '--trash needs path=', { next: `obs --trash path=${NOTE}` });
  if (!exists(run, a.path)) throw new Fail(EXIT.error, `not found: ${a.path}`, { next: nextFor(EXIT.error, 'note not found') });
  const back = num(must(run, ['backlinks', `path=${a.path}`, 'total'], [EXIT.ok, EXIT.empty]));
  const root = vaultPaths(run, ctx.env).local;
  const src = absIn(root, a.path);
  const dir = path.join(root, '.trash');
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(src), base = path.basename(src, ext);
  let dst = path.join(dir, base + ext);
  for (let i = 1; fs.existsSync(dst); i++) dst = path.join(dir, `${base} ${i}${ext}`);
  fs.renameSync(src, dst);
  if (fs.existsSync(src) || !fs.existsSync(dst)) throw new Fail(EXIT.guard, `verify failed: ${a.path} still there or not in .trash/`, { next: nextFor(EXIT.guard) });
  return `OK: moved ${a.path} to .trash/${path.basename(dst)} (restore by moving it back); ${back} link(s) to it are now broken\n`;
}

function create(ctx, run, rest) {
  const a = kv(rest);
  if (!a.path) throw new Fail(EXIT.usage, '--create needs path=', { next: ROUTE.create.next });
  if (exists(run, a.path)) throw new Fail(EXIT.guard, `exists: ${a.path} (the CLI would silently create "name 1.md", F9c)`, { next: 'pick another name, or edit the existing note (obs --append / --section-edit / --prop-set)' });
  const out = must(run, ['create', ...rest.filter((x) => !/^(overwrite|open|newtab)$/.test(x))]);
  if (!exists(run, a.path)) throw new Fail(EXIT.guard, `create reported "${out}" but ${a.path} is missing`, { next: nextFor(EXIT.guard) });
  let lines = '';
  try { lines = ` (${F.readNote(absIn(needLocal(ctx, run), a.path)).lines.length} lines)`; } catch { /* count is optional */ }
  return `OK: created ${a.path}${lines}\n`;
}

// Append text at the end of a note, as new line(s), keeping its line endings. once: skip when already there.
function appendTo(abs, rel, content, once) {
  const text = content.replace(/\\n/g, '\n');
  const add = text.split(/\r?\n/);
  const doc = F.readNote(abs);
  if (once && (add.length === 1 ? doc.lines.some((l) => l.trim() === add[0].trim()) : doc.lines.join('\n').includes(add.join('\n'))))
    return `OK: already in ${rel}; not added again\n`;
  const before = doc.lines.length;
  F.writeNote(abs, { ...doc, lines: [...doc.lines, ...add], finalEol: true });
  const back = F.readNote(abs);
  const tail = back.lines.slice(before);
  if (tail.join('\n') !== add.join('\n') || back.eol !== doc.eol && before > 0) throw new Fail(EXIT.guard, `read-back failed after appending to ${rel}`, { next: nextFor(EXIT.guard) });
  return `OK: added ${add.length} line(s) at the end of ${rel} (line ${before + 1})\n`;
}

function dailyAppendOnce(ctx, run, a) {
  const content = a.content ?? a._.join(' ');
  if (!content) throw new Fail(EXIT.usage, 'needs content=', { next: ROUTE['daily:append'].next });
  const rel = must(run, ['daily:path']); // daily:path never creates the note; daily:read would (F9j)
  const root = needLocal(ctx, run);
  const abs = absIn(root, rel);
  if (fs.existsSync(abs)) return appendTo(abs, rel, content, true);
  fs.mkdirSync(path.dirname(abs), { recursive: true }); // daily:append needs the root daily folder (F9g)
  must(run, ['daily:append', `content=${content}`], [EXIT.ok, EXIT.empty]);
  for (let i = 0; i < 30 && !fs.existsSync(abs); i++) sleep(100);
  const n = fs.existsSync(abs) ? F.readNote(abs).lines.filter((l) => l.trim() === content.replace(/\\n/g, '\n').split('\n')[0].trim()).length : 0;
  if (n !== 1) throw new Fail(EXIT.guard, `read-back failed: ${rel} has the line ${n} time(s)`, { next: nextFor(EXIT.guard) });
  return `OK: created today's note ${rel} from the template and added the line\n`;
}

function propSet(ctx, run, a) {
  const root = needLocal(ctx, run);
  const abs = needNote(root, a.path);
  if (!a.name) throw new Fail(EXIT.usage, 'needs name=<key>', { next: ROUTE['property:set'].next });
  const op = { value: a.value, add: a.add, remove: a.remove, unset: a._.includes('unset') };
  if (op.value === undefined && op.add === undefined && op.remove === undefined && !op.unset) throw new Fail(EXIT.usage, 'needs value=, add=, remove= or unset', { next: ROUTE['property:set'].next });
  let types = {};
  try { types = JSON.parse(fs.readFileSync(path.join(root, '.obsidian', 'types.json'), 'utf8')).types || {}; } catch { /* no types.json */ }
  const doc = F.readNote(abs);
  let r;
  try { r = F.propSet(doc, a.name, op, types); } catch (e) {
    if (e instanceof F.EditError) throw new Fail(EXIT.usage, e.message, { next: 'fix the value as the message says and run the command once more' });
    throw e;
  }
  if (r.unchanged) return `OK: ${a.name} already ${r.shown} in ${a.path}; nothing changed\n`;
  F.writeNote(abs, r.doc);
  // Read back: the key has the new value and every other frontmatter and body line is unchanged.
  const back = F.readNote(abs);
  const got = F.readKey(back.lines, a.name);
  const strip = (lines) => { const b = F.keyBlock(lines, a.name); return b ? [...lines.slice(0, b[0]), ...lines.slice(b[1])] : lines; };
  const others = JSON.stringify(strip(back.lines)) === JSON.stringify(strip(F.fmRange(doc.lines) ? doc.lines : ['---', '---', ...doc.lines]));
  const shownBack = !got ? '(removed)' : got.kind === 'list' ? `[${got.items.join(', ')}]` : String(got.value);
  if (shownBack !== r.shown || !others || back.eol !== doc.eol) throw new Fail(EXIT.guard, `read-back failed for ${a.name} in ${a.path} (got ${shownBack})`, { next: nextFor(EXIT.guard) });
  return `OK: ${a.name} = ${r.shown}${r.type ? ` (${r.type})` : ''} in ${a.path}; other lines unchanged\n`;
}

function sectionEdit(ctx, run, a) {
  const root = needLocal(ctx, run);
  const abs = needNote(root, a.path);
  if (!a.heading) throw new Fail(EXIT.usage, 'needs heading="<heading text>"', { next: `obs --section-edit path=${NOTE} heading="<heading>"  (shows the numbered lines)` });
  const doc = F.readNote(abs);
  const s = F.findSection(doc.lines, a.heading, a.nth ? Number(a.nth) : null);
  if (s.error === 'none') throw new Fail(EXIT.empty, `no heading "${a.heading}" in ${a.path}`, { next: `list the headings: obs outline path="${a.path}" format=json` });
  if (s.error === 'many') throw new Fail(EXIT.usage, `${s.hits.length} headings match "${a.heading}" (file lines ${s.hits.map((h) => h.line + 1).join(', ')})`, { next: 'add nth=<1..n> to pick one' });
  let len = s.end - s.line - 1; // lines below the heading, without the blank lines before the next heading
  while (len > 0 && doc.lines[s.line + len].trim() === '') len--;
  const label = `${'#'.repeat(s.level)} ${s.text}`;
  const text = a.text?.replace(/\\n/g, '\n');
  if (text === undefined) { // show
    const from = Math.max(1, Number(a.from || 1));
    const upto = Math.min(len, from + 39);
    const rows = doc.lines.slice(s.line + from, s.line + upto + 1).map((l, k) => `${from + k} | ${l}`);
    return [`OK: "${label}" has ${len} lines below it (file lines ${s.line + 2}-${s.line + 1 + len})${upto < len ? `; showing ${from}-${upto}, add from=${upto + 1} for more` : ''}`, ...rows].join('\n') + '\n';
  }
  if (text.includes('\n') && a.line) throw new Fail(EXIT.usage, 'line= replaces one line; text= must not contain a newline', { next: 'use after=<n> to insert several lines' });
  const lines = [...doc.lines];
  let msg, at;
  if (a.line !== undefined) {
    const n = Number(a.line);
    if (!(n >= 1 && n <= len)) throw new Fail(EXIT.usage, `line=${a.line} is outside "${label}" (it has ${len} lines below the heading)`, { next: `show the section first: obs --section-edit path="${a.path}" heading="${a.heading}"` });
    at = s.line + n;
    if (a.expect !== undefined && lines[at] !== a.expect) throw new Fail(EXIT.guard, `line ${n} is "${lines[at]}", not the expected text`, { next: 'show the section again and pick the right line' });
    msg = `replaced line ${n} under "${label}" (file line ${at + 1}): "${lines[at]}" -> "${text}"`;
    lines[at] = text;
  } else if (a.after !== undefined) {
    const n = Number(a.after);
    if (!(n >= 0 && n <= len)) throw new Fail(EXIT.usage, `after=${a.after} is outside "${label}" (0..${len})`, { next: `show the section first: obs --section-edit path="${a.path}" heading="${a.heading}"` });
    at = s.line + n + 1;
    lines.splice(at, 0, ...text.split('\n'));
    msg = `inserted ${text.split('\n').length} line(s) after line ${n} under "${label}" (file line ${at + 1})`;
  } else throw new Fail(EXIT.usage, 'give line=<n> text="<new line>" or after=<n> text="<text>"', { next: `obs --section-edit path="${a.path}" heading="${a.heading}" line=<n> text="<new line>"` });
  F.writeNote(abs, { ...doc, lines });
  const back = F.readNote(abs);
  if (JSON.stringify(back.lines) !== JSON.stringify(lines) || back.eol !== doc.eol) throw new Fail(EXIT.guard, `read-back failed for ${a.path}`, { next: nextFor(EXIT.guard) });
  return `OK: ${msg}; line endings kept (${doc.eol === '\r\n' ? 'CRLF' : 'LF'})\n`;
}

// Read commands with a file fallback. tryCli returns output, or null when Obsidian is unreachable.
function withFallback(ctx, run, tryCli, fromFiles) {
  if (ctx.cli) {
    const out = tryCli();
    if (out !== null) return out;
  }
  const root = needLocal(ctx, null);
  return fromFiles(root);
}
const APPROX = 'Obsidian is not running; read from files, so this may be incomplete';

function find(ctx, run, a) {
  const q = (a.query ?? a._.join(' ')).replace(/^["']|["']$/g, '').trim();
  if (!q) throw new Fail(EXIT.usage, 'needs the words to find', { next: 'obs --find "<words>"' });
  const limit = Math.min(Number(a.limit || 20) || 20, 50);
  const variants = [...new Set([q, F.unaccent(q)])];
  const said = variants.map((v) => `"${v}"`).join(' or ');
  const show = (hits) => hits.map((h) => `${h.path}  (${h.lines} matching line${h.lines === 1 ? '' : 's'}${h.name ? ', in the name' : ''})`).join('\n');
  return withFallback(ctx, run, () => {
    const merged = new Map();
    for (const v of variants) {
      const r = run(['search:context', `query="${v}"`, ...(a.path ? [`path=${a.path}`] : []), `limit=${limit}`, 'format=json']);
      if (r.code === EXIT.unreachable) return null;
      if (r.code === EXIT.empty) continue;
      if (r.code !== EXIT.ok) throw new Fail(r.code, `search: ${r.reason}`, { next: nextFor(r.code, r.reason) });
      let list;
      try { list = JSON.parse(r.out.replace(/^\r?\n/, '')); } catch { throw new Fail(EXIT.error, 'search:context did not return JSON', { next: 'use obs search query="\\"<words>\\"" limit=20 format=json instead' }); }
      for (const f of list) {
        const p = f.file || f.path;
        const h = merged.get(p) || { path: p, lines: 0, name: false };
        h.lines += new Set((f.matches || []).map((m) => m.line)).size;
        h.name ||= variants.some((x) => path.posix.basename(p, '.md').toLowerCase().includes(x.toLowerCase()));
        merged.set(p, h);
      }
    }
    const hits = F.rankHits([...merged.values()]).slice(0, limit);
    if (!hits.length) return { out: `OK: 0 notes match ${said}${a.path ? ` in ${a.path}` : ''}\n`, next: 'try fewer or other words, or another spelling; say "none found" only after that' };
    return `OK: ${hits.length} note(s) match ${said}${a.path ? ` in ${a.path}` : ''}, best first${hits.length === limit ? ` (first ${limit}; add limit= or path= to change)` : ''}\n${show(hits)}\n`;
  }, (root) => {
    const hits = F.findInFiles(root, variants, { folder: a.path || '', limit });
    return `APPROXIMATE: ${hits.length} note(s) match ${said}. ${APPROX}\n${hits.length ? show(hits) + '\n' : ''}`;
  });
}

function tasksCount(ctx, run, a) {
  const done = a._.includes('done');
  return withFallback(ctx, run, () => {
    const r = run(['tasks', done ? 'done' : 'todo', 'total']);
    if (r.code === EXIT.unreachable) return null;
    if (r.code !== EXIT.ok && r.code !== EXIT.empty) throw new Fail(r.code, `tasks: ${r.reason}`, { next: nextFor(r.code, r.reason) });
    return `OK: ${num(r.out)} ${done ? 'done' : 'open'} tasks in the whole vault (Obsidian index)\n`;
  }, (root) => {
    const c = F.countTasks(root);
    return `APPROXIMATE: ${done ? c.done : c.open} ${done ? 'done' : 'open'} tasks in the whole vault. ${APPROX}\n`;
  });
}

function backlinks(ctx, run, a) {
  if (!a.path) throw new Fail(EXIT.usage, 'needs path=<note.md>', { next: `obs --backlinks path=${NOTE}` });
  return withFallback(ctx, run, () => {
    const r = run(['backlinks', `path=${a.path}`]);
    if (r.code === EXIT.unreachable) return null;
    if (r.code === EXIT.empty) {
      if (!exists(run, a.path)) throw new Fail(EXIT.error, `note not found: ${a.path}`, { next: nextFor(EXIT.error, 'note not found') });
      return `OK: no notes link to ${a.path}\n`;
    }
    if (r.code !== EXIT.ok) throw new Fail(r.code, `backlinks: ${r.reason}`, { next: nextFor(r.code, r.reason) });
    const rows = r.out.replace(/^\r?\n/, '').split(/\r?\n/).map((l) => l.split('\t')[0].trim()).filter(Boolean);
    return `OK: ${rows.length} note(s) link to ${a.path} (Obsidian index; links by alias name and .canvas files are not counted)\n${rows.join('\n')}\n`;
  }, (root) => {
    needNote(root, a.path);
    const b = F.backlinksFromFiles(root, a.path);
    return `APPROXIMATE: ${b.files.length} note(s) link to ${a.path}. ${APPROX}\n${b.files.map((f) => f + '\n').join('')}`
      + (b.aliasOnly.length ? `not counted, they link by an alias name (Obsidian leaves those unresolved): ${b.aliasOnly.join(', ')}\n` : '');
  });
}

function tagRename(ctx, run, a) {
  const from = (a.from || '').replace(/^#/, ''), to = (a.to || '').replace(/^#/, '');
  if (!F.validTag(from) || !F.validTag(to) || from.toLowerCase() === to.toLowerCase()) throw new Fail(EXIT.usage, 'needs from=<old tag> to=<new tag> (letters, digits, _ - /; not the same tag)', { next: 'obs --tag-rename from=<old> to=<new>' });
  const root = needLocal(ctx, run);
  const nested = a.nested === 'yes';
  const plan = F.tagPlan(root, from, to, { nested });
  const fm = plan.changes.filter((c) => c.where === 'frontmatter').length;
  const summary = `${plan.changes.length} change(s) in ${plan.files.length} file(s) (body ${plan.changes.length - fm}, frontmatter ${fm})`;
  const kept = plan.keptNested ? `kept: ${plan.keptNested} nested #${from}/... tag(s); add nested=yes to rename those too\n` : '';
  if (!plan.changes.length) return `OK: no #${from} tag outside code; nothing to change\n${kept}`;
  if (!a._.includes('apply')) {
    const rows = plan.changes.slice(0, 30).map((c) => `${c.path}:${c.line}  ${c.old}  ->  ${c.new}`);
    if (plan.changes.length > 30) rows.push(`... and ${plan.changes.length - 30} more`);
    const out = `NOT DONE: dry run, nothing written yet. Would make ${summary}:\n${rows.join('\n')}\n${kept}`;
    return { out, next: `show this list to the user; after they say yes run: obs --tag-rename from=${from} to=${to}${nested ? ' nested=yes' : ''} apply` };
  }
  const conflictsBefore = new Set(F.conflictCopies(root));
  const snap = F.snapshot(root, plan.files.map((f) => f.path));
  for (const f of plan.files) F.writeNote(absIn(root, f.path), f.doc);
  // Verify: no #from left in the changed files, and the new tag is there.
  const again = F.tagPlan(root, from, to, { nested, only: plan.files.map((f) => f.path) });
  const newCount = F.tagPlan(root, to, `${to}-x`, { only: plan.files.map((f) => f.path) }).changes.length;
  const newConflicts = F.conflictCopies(root).filter((c) => !conflictsBefore.has(c));
  if (again.changes.length || !newCount) throw new Fail(EXIT.guard, `verify failed: ${again.changes.length} #${from} left after the edit; snapshot in ${snap}`, { next: 'tell the user the numbers and where the snapshot is; do not retry' });
  return `OK: renamed #${from} to #${to}: ${summary}; 0 left outside code; snapshot in ${snap}\n${kept}`
    + (newConflicts.length ? `new sync conflict copies (report them, do not delete): ${newConflicts.join(', ')}\n` : '');
}

const HELP = `obsidian-connect bridge (paths are vault-relative with /, e.g. folder/Note.md)
  obs --preflight --vault "<name>"            once per session; remembers the vault
  obs --find "<words>" [path=<folder>]        find notes (adds quotes and the unaccented form)
  obs --backlinks path=<note.md>              notes that link to a note
  obs --tasks-count [done]                    open (or done) tasks in the whole vault
  obs --section-edit path=<note.md> heading="<h>" [line=<n> text="<t>" | after=<n> text="<t>"]
  obs --prop-set path=<note.md> name=<key> value=<v> | add=<item> | remove=<item> | unset
  obs --append path=<note.md> content="<text>" [once]
  obs --daily-append-once content="<line>"
  obs --create path=<note.md> content="<text>" | template=<name>
  obs --tag-rename from=<old> to=<new> [nested=yes] [apply]
  obs --rename path=<note.md> name="<new name>"   obs --move path=<note.md> to=<folder>/   obs --trash path=<note.md>
  obs --abs <note.md>                         absolute path of a vault file
Any other words go to the Obsidian CLI as a read, e.g. obs outline path=<note.md> format=json
`;

const BRIDGE = {
  '--find': find, '--tasks-count': tasksCount, '--backlinks': backlinks, '--prop-set': propSet, '--section-edit': sectionEdit,
  '--tag-rename': tagRename, '--daily-append-once': dailyAppendOnce,
  '--append': (ctx, run, a) => { const root = needLocal(ctx, run); const abs = needNote(root, a.path); if (a.content === undefined) throw new Fail(EXIT.usage, 'needs content=', { next: ROUTE.append.next }); return appendTo(abs, a.path, a.content, a._.includes('once')); },
};
const FILE_OK = new Set(['--find', '--tasks-count', '--backlinks', '--prop-set', '--section-edit', '--tag-rename', '--append']); // work without the CLI

export function main(argv = process.argv.slice(2)) {
  const ctx = context(argv);
  const { env, vault } = ctx;
  let rest = ctx.rest;
  const op = rest[0] || '';
  if (!op || op === '--help') return done(ctx, op ? EXIT.ok : EXIT.usage, HELP, op ? '' : 'no command', op ? '' : 'run one of the commands above');
  ctx.cli = findCli(env);

  try {
    if (op === '--preflight') return done(ctx, EXIT.ok, preflight(ctx));
    if (!vault) throw new Fail(EXIT.usage, 'no vault', { next: 'run obs --preflight --vault "<name>" once (ask the user for the vault name); later commands remember it' });
    const run = makeRunner(ctx.cli, env, vault);
    if (op === '--abs') {
      const v = localVault(ctx, run); // the folder may not be visible from here (e.g. a sandbox): print it anyway
      if (!v?.local) throw new Fail(EXIT.usage, `vault folder of "${vault}" not found`, { next: 'ask the user for the vault folder, then run: obs --preflight --dir "<folder>"' });
      return done(ctx, EXIT.ok, absIn(v.local, rest.slice(1).join(' ').replace(/^path=/, '')) + '\n');
    }
    if (op.startsWith('--')) {
      if (op !== '--find') rest = fixPathArgs(rest);
      const a = kv(rest.slice(1));
      if (BRIDGE[op]) {
        if (!ctx.cli && !FILE_OK.has(op)) throw new Fail(EXIT.unreachable, 'Obsidian CLI not found', { next: nextFor(EXIT.unreachable) });
        const r = BRIDGE[op](ctx, run, a);
        return typeof r === 'string' ? done(ctx, EXIT.ok, r) : done(ctx, EXIT.ok, r.out, '', r.next);
      }
      if (!ctx.cli) throw new Fail(EXIT.unreachable, 'Obsidian CLI not found', { next: nextFor(EXIT.unreachable) });
      if (op === '--rename' || op === '--move') return done(ctx, EXIT.ok, guardedMove(ctx, run, op.slice(2), a));
      if (op === '--trash') return done(ctx, EXIT.ok, trash(ctx, run, a));
      if (op === '--create') return done(ctx, EXIT.ok, create(ctx, run, rest.slice(1)));
      throw new Fail(EXIT.usage, `unknown bridge option ${op}`, { out: HELP, next: 'use one of the commands listed above' });
    }
    // Pass-through to the CLI, after the guards.
    if (SHELL.test(op)) throw new Fail(EXIT.usage, `"${op}" is not an Obsidian command`, { next: op === 'vaults' ? 'ask the user for the vault name; never list vaults' : 'obs runs Obsidian commands only. To search note text: obs --find "<words>"; to read a note: obs read path=<note.md>' });
    const deny = DENY.find((d) => d.re.test(op));
    if (deny && (deny.never || !ctx.allowUnsafe)) throw new Fail(EXIT.guard, `"${op}" is refused${deny.never ? ' (never allowed)' : ''}`, { next: deny.next });
    const route = ROUTE[op];
    if (route && (route.lock || !ctx.allowUnsafe)) throw new Fail(EXIT.usage, `raw "${op}" is not used: it writes without a read-back`, { next: route.next });
    if (rest.includes('overwrite') && !ctx.allowUnsafe) throw new Fail(EXIT.guard, 'overwrite replaces the whole note', { next: 'edit only the lines you need: obs --section-edit or obs --append; overwrite needs the user to confirm that exact command and --allow-unsafe' });
    if (op === 'property:set' && rest.some((x) => x.startsWith('type='))) throw new Fail(EXIT.guard, 'property:set type= rewrites types.json vault-wide (F9b)', { next: ROUTE['property:set'].next });
    if (rest.includes('active')) throw new Fail(EXIT.usage, '"active" limits the command to the open file (wrong scope)', { next: 'drop active; tasks and tags are vault-wide by default, and notes take path=<note.md>' });
    rest = fixPathArgs(rest);
    if (op === 'daily:read') { // daily:read creates an empty note when it does not exist (F9j)
      const p = must(run, ['daily:path']);
      if (!exists(run, p)) throw new Fail(EXIT.empty, `today's daily note ${p} does not exist yet (nothing read, nothing created)`, { next: 'to add a line: obs --daily-append-once content="<line>"' });
    }
    const r = run(rest);
    return done(ctx, r.code, r.out.replace(/^\r?\n/, ''), r.reason, r.code ? nextFor(r.code, r.reason) : '');
  } catch (e) {
    if (e instanceof Fail) {
      const own = op.startsWith('--');
      const out = e.out || (own ? `NOT DONE: ${e.message}\n` : '');
      return done(ctx, e.code, out, own && !e.out ? '' : e.message, e.next || nextFor(e.code, e.message));
    }
    return done(ctx, EXIT.usage, `NOT DONE: ${e.message}\n`, '', 'tell the user the bridge failed with the message above');
  }
}

function done(ctx, code, out, reason = '', next = '') {
  if (out) process.stdout.write(out);
  // Loop breaker: the same failing call three times in a row ends with STOP.
  const key = JSON.stringify(ctx.rest);
  const st = loadState();
  if (code !== 0) {
    const n = st.last?.key === key && st.last?.code === code ? st.last.n + 1 : 1;
    saveState({ ...st, last: { key, code, n } });
    if (n >= 3) next = 'STOP: same error 3 times. Do not run this command again; report the error to the user.';
    process.stderr.write(`obs: ${code}${reason ? ' ' + reason : ''}\n`);
  } else if (st.last) { delete st.last; saveState(st); }
  if (next || code !== 0) process.stderr.write(`NEXT: ${next || nextFor(code, reason)}\n`);
  // OBS_LOG=<file>: one JSON line per call (args, exit, output bytes), used to measure test runs.
  if (process.env.OBS_LOG) {
    try { fs.appendFileSync(process.env.OBS_LOG, JSON.stringify({ t: new Date().toISOString(), args: process.argv.slice(2), code, bytes: Buffer.byteLength(out || '') + (code && reason ? reason.length + 8 : 0) + (next ? next.length + 7 : 0) }) + '\n'); } catch { /* logging is best effort */ }
  }
  return code;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('obs.mjs')) {
  process.exitCode = main();
}
