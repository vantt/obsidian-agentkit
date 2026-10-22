#!/usr/bin/env node
// obsidian-connect bridge: call the Windows Obsidian CLI from WSL, PowerShell, cmd or Git Bash.
// Usage: node obs.mjs [--vault <name>] <obsidian args...> | --preflight | --abs <rel>
//        | --rename path=… name=… | --move path=… to=… | --trash path=… | --create path=… [content=…|template=…]
// Vault: OBS_VAULT or --vault, always passed first. Timeout: OBS_TIMEOUT seconds (default 10).
// Exit: 0 ok, 2 unreachable, 3 CLI error, 4 empty, 5 usage, 6 not ready, 7 guard refused/verify failed, 124 timeout.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const TESTED_CLI = '1.14.4';
const EXIT = { ok: 0, unreachable: 2, error: 3, empty: 4, usage: 5, notReady: 6, guard: 7, timeout: 124 };
const DENY = [/^delete$/, /^eval$/, /^dev:/, /^devtools$/, /^plugin:(install|uninstall|enable|disable)$/, /^theme:(install|uninstall)$/, /^history:restore$/];
const LIST_CMDS = /^(search|search:context|backlinks|links|tags|tag|tasks|orphans|deadends|unresolved|aliases|properties|outline|files|folders|bases|base:query|templates|recents|bookmarks|daily:read|read|property:read)$/;
const EMPTY_RE = /^No [\w ]+ found\.$/;

class Fail extends Error {
  constructor(code, reason, out = '') { super(reason); this.code = code; this.out = out; }
}

export function detectEnv(platform = process.platform, procVersion = readSafe('/proc/version')) {
  if (platform === 'win32') return 'windows';
  if (platform === 'linux' && /microsoft/i.test(procVersion)) return 'wsl';
  return 'other';
}

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

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
      const p = spawnSync('wslpath', ['-u', `${win}\\Programs\\Obsidian\\Obsidian.com`], { encoding: 'utf8' }).stdout.trim();
      if (p && fs.existsSync(p)) cli = p;
    }
  }
  if (cli) { try { fs.writeFileSync(cacheFile, JSON.stringify({ env, cli })); } catch { /* cache is optional */ } }
  return cli;
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
  if (/^Error: Command ".*" not found/.test(first)) return [EXIT.notReady, first];
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
    const full = vault ? [`vault=${vault}`, ...args] : args;
    const r = spawnSync(cli, full, { encoding: 'utf8', timeout, cwd, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 * 1024 });
    const [code, reason] = classify(r, args[0] || '');
    return { code, reason, out: r.stdout || '' };
  };
}

// key=value parsing for guarded ops
function kv(args) {
  const o = {};
  for (const a of args) { const i = a.indexOf('='); if (i > 0) o[a.slice(0, i)] = a.slice(i + 1); }
  return o;
}

function must(run, args, okCodes = [EXIT.ok]) {
  const r = run(args);
  if (!okCodes.includes(r.code)) throw new Fail(r.code, `${args[0]}: ${r.reason}`, r.out);
  return r.out.replace(/^\r?\n/, '').trim();
}
const num = (s) => Number(String(s).trim().split(/\s+/)[0]) || 0;
const evalOut = (s) => s.replace(/^=> /, '').trim();

function exists(run, p) {
  return run(['file', `path=${p}`]).code === EXIT.ok;
}

function vaultPaths(run, env) {
  const win = must(run, ['vault', 'info=path']);
  let local = win;
  if (env === 'wsl') local = spawnSync('wslpath', ['-u', win], { encoding: 'utf8' }).stdout.trim();
  return { win, local };
}

function linkGuard(run) {
  const v = evalOut(must(run, ['eval', "code=app.vault.getConfig('alwaysUpdateLinks')"]));
  if (v !== 'true') throw new Fail(EXIT.guard, `alwaysUpdateLinks is ${v}: rename/move would open a modal and leave links broken (F4c). Ask the user to turn on Settings > Files and links > Automatically update internal links.`);
}

function guardedMove(run, env, op, a) {
  if (!a.path) throw new Fail(EXIT.usage, `--${op} needs path=`);
  const dest = op === 'rename'
    ? path.posix.join(path.posix.dirname(a.path), `${a.name}${a.name?.endsWith('.md') ? '' : '.md'}`)
    : (a.to?.endsWith('/') || !a.to?.endsWith('.md') ? path.posix.join(a.to || '', path.posix.basename(a.path)) : a.to);
  if (op === 'rename' && !a.name) throw new Fail(EXIT.usage, '--rename needs name=');
  if (op === 'move' && !a.to) throw new Fail(EXIT.usage, '--move needs to=');
  if (!exists(run, a.path)) throw new Fail(EXIT.error, `source not found: ${a.path}`);
  if (exists(run, dest)) throw new Fail(EXIT.guard, `destination exists: ${dest}`);
  linkGuard(run);
  const before = { back: num(must(run, ['backlinks', `path=${a.path}`, 'total'])), unres: num(must(run, ['unresolved', 'total'])) };
  if (op === 'move') {
    const dir = path.posix.dirname(dest);
    if (dir !== '.') fs.mkdirSync(path.join(vaultPaths(run, env).local, ...dir.split('/')), { recursive: true }); // CLI move does not create folders (F4d)
  }
  const args = op === 'rename' ? ['rename', `path=${a.path}`, `name=${a.name}`] : ['move', `path=${a.path}`, `to=${a.to}`];
  const r = run(args);
  if (r.code !== EXIT.ok) throw new Fail(r.code === EXIT.timeout ? EXIT.guard : r.code, `${op} returned ${r.reason}; check for an open "Update links" modal and run: obs unresolved total`, r.out);
  // The metadata cache can lag 10+ s after a move into a new folder: poll instead of one fixed wait.
  let after, ok;
  const deadline = Date.now() + Number(process.env.OBS_VERIFY_MS ?? 30000);
  do {
    sleep(1000);
    after = { back: num(must(run, ['backlinks', `path=${dest}`, 'total'], [EXIT.ok, EXIT.empty])), unres: num(must(run, ['unresolved', 'total'])) };
    ok = exists(run, dest) && after.back === before.back && after.unres === before.unres;
  } while (!ok && Date.now() < deadline);
  const line = `${op} ${a.path} -> ${dest}; backlinks ${before.back}->${after.back}; unresolved ${before.unres}->${after.unres}`;
  if (!ok) throw new Fail(EXIT.guard, `verify failed: ${line}`);
  return `${line}; verified\n`;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function trash(run, env, a) {
  if (!a.path) throw new Fail(EXIT.usage, '--trash needs path=');
  if (!exists(run, a.path)) throw new Fail(EXIT.error, `not found: ${a.path}`);
  const back = num(must(run, ['backlinks', `path=${a.path}`, 'total'], [EXIT.ok, EXIT.empty]));
  const root = vaultPaths(run, env).local;
  const src = path.join(root, ...a.path.split('/'));
  const dir = path.join(root, '.trash');
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(src), base = path.basename(src, ext);
  let dst = path.join(dir, base + ext);
  for (let i = 1; fs.existsSync(dst); i++) dst = path.join(dir, `${base} ${i}${ext}`);
  fs.renameSync(src, dst);
  return `trashed ${a.path} -> .trash/${path.basename(dst)}; ${back} backlinks now unresolved\n`;
}

function create(run, rest) {
  const a = kv(rest);
  if (!a.path) throw new Fail(EXIT.usage, '--create needs path= (never rely on name= or the active file)');
  if (exists(run, a.path)) throw new Fail(EXIT.guard, `exists: ${a.path} (CLI would silently create "name 1.md", F9c)`);
  const out = must(run, ['create', ...rest.filter((x) => !/^(overwrite|open|newtab)$/.test(x))]);
  if (!exists(run, a.path)) throw new Fail(EXIT.guard, `create reported "${out}" but ${a.path} is missing`);
  return out + '\n';
}

function preflight(env, cli, vault) {
  const lines = [`env=${env} node=${process.versions.node}`];
  if (!cli) return { code: EXIT.unreachable, text: lines.concat('cli=none -> use file mode (answers approximate)').join('\n') + '\n' };
  const run = makeRunner(cli, env, null);
  const v = run(['version']);
  if (v.code !== EXIT.ok) return { code: v.code, text: lines.concat(`cli=${cli}`, `cli-status=${v.reason} -> use file mode`).join('\n') + '\n' };
  const ver = v.out.trim().split(/\s+/)[0];
  const match = ver.split('.').slice(0, 2).join('.') === TESTED_CLI.split('.').slice(0, 2).join('.');
  lines.push(`cli=${ver} tested=${TESTED_CLI} match=${match ? 'yes' : 'no -> run tests/compat before trusting traps'}`);
  if (!vault) return { code: EXIT.usage, text: lines.concat('vault=unset -> set OBS_VAULT (never rely on the focused vault)').join('\n') + '\n' };
  const runV = makeRunner(cli, env, vault);
  try {
    const p = vaultPaths(runV, env);
    lines.push(`vault=${vault} win=${p.win} local=${p.local}`);
    const cfg = evalOut(must(runV, ['eval', "code=['alwaysUpdateLinks','trashOption'].map(k=>k+'='+app.vault.getConfig(k)).join(' ')"]));
    lines.push(`${cfg} (bridge --trash uses .trash/ regardless)`);
  } catch (e) {
    return { code: e.code, text: lines.concat(`vault=${vault} status=${e.message}`).join('\n') + '\n' };
  }
  return { code: EXIT.ok, text: lines.join('\n') + '\n' };
}

export function main(argv = process.argv.slice(2)) {
  let vault = process.env.OBS_VAULT || '';
  const args = [...argv];
  const vi = args.indexOf('--vault');
  if (vi >= 0) { vault = args[vi + 1] || ''; args.splice(vi, 2); }
  const allowUnsafe = args.includes('--allow-unsafe');
  const rest = args.filter((a) => a !== '--allow-unsafe');
  const env = detectEnv();
  const op = rest[0] || '';

  if (op === '--abs') {
    const rel = rest[1] || '';
    const cli = findCli(env);
    if (!cli || !vault) return done(EXIT.usage, '', 'needs CLI and vault');
    try { const p = vaultPaths(makeRunner(cli, env, vault), env); return done(EXIT.ok, path.join(p.local, ...rel.split('/')) + '\n'); } catch (e) { return done(e.code, e.out, e.message); }
  }
  const cli = findCli(env);
  if (op === '--preflight') { const p = preflight(env, cli, vault); return done(p.code, p.text, p.code ? 'preflight' : ''); }
  if (!op) return done(EXIT.usage, '', 'no command');
  if (!cli) return done(EXIT.unreachable, '', 'Obsidian CLI not found -> use file mode');
  if (!vault) return done(EXIT.usage, '', 'no vault: set OBS_VAULT or pass --vault <name>');
  const run = makeRunner(cli, env, vault);

  try {
    if (op === '--rename' || op === '--move') return done(EXIT.ok, guardedMove(run, env, op.slice(2), kv(rest.slice(1))));
    if (op === '--trash') return done(EXIT.ok, trash(run, env, kv(rest.slice(1))));
    if (op === '--create') return done(EXIT.ok, create(run, rest.slice(1)));
    if (op.startsWith('--')) return done(EXIT.usage, '', `unknown bridge option ${op}`);
    if (!allowUnsafe) {
      if (DENY.some((re) => re.test(op))) throw new Fail(EXIT.guard, `"${op}" needs user confirmation and --allow-unsafe (use --trash instead of delete)`);
      if (rest.includes('overwrite')) throw new Fail(EXIT.guard, 'overwrite needs user confirmation and --allow-unsafe');
      if (op === 'property:set' && rest.some((x) => x.startsWith('type='))) throw new Fail(EXIT.guard, 'property:set type= rewrites types.json vault-wide (F9b); edit the frontmatter in the file instead');
      if (op === 'rename' || op === 'move') throw new Fail(EXIT.guard, `use --${op} (verifies links)`);
      if (op === 'create') throw new Fail(EXIT.guard, 'use --create (refuses to clobber or duplicate)');
    }
    const r = run(rest);
    return done(r.code, r.out.replace(/^\r?\n/, ''), r.reason);
  } catch (e) {
    if (e instanceof Fail) return done(e.code, e.out, e.message);
    return done(EXIT.usage, '', e.message);
  }
}

function done(code, out, reason = '') {
  if (out) process.stdout.write(out);
  if (code !== 0 && reason) process.stderr.write(`obs: ${code} ${reason}\n`);
  // OBS_LOG=<file>: one JSON line per call (args, exit, output bytes), used to measure test runs.
  if (process.env.OBS_LOG) {
    try { fs.appendFileSync(process.env.OBS_LOG, JSON.stringify({ t: new Date().toISOString(), args: process.argv.slice(2), code, bytes: Buffer.byteLength(out || '') + (code && reason ? reason.length + 8 : 0) }) + '\n'); } catch { /* logging is best effort */ }
  }
  return code;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('obs.mjs')) {
  process.exitCode = main();
}
