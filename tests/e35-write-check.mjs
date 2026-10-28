#!/usr/bin/env node
// E3.5 write check: 10 writes through the bridge on ONE test vault, each read back, then a wait and a Drive
// conflict-copy check. Re-runnable. It never resets the vault (see tests/scenarios/README.md, "E3.5 write check").
//
// Usage: node tests/e35-write-check.mjs --vault <name> [--note <path.md>] [--wait <seconds>] [--tag <text>]
//   --vault  required; the vault must be open in Obsidian
//   --note   note whose property `e35_check` is edited (default: _agentkit-lab/props/Property Note.md)
//   --wait   seconds to wait before the conflict check (default 180; 0 = no wait)
//   --tag    marker put in every written value (default e35-<UTC time>)
// Writes: 5 x `--daily-append-once` to today's daily note, 5 x `--prop-set` on --note. Each is read back
// from the file on disk and must match exactly; the Obsidian CLI view (`daily:read`, `properties`) is reported alongside.
// Guard: refuses unless `vault info=path` ends in one of ALLOWED_VAULTS (the test vaults). The real vault is never allowed.
// Exit 0 = 10/10 correct and no new conflict copy; 1 = a check failed; 2 = refused or could not run.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ALLOWED_VAULTS = ['vault-synth', 'vault-copy', 'obsidian-agentkit-drive-test'];
const here = path.dirname(fileURLToPath(import.meta.url));
const bridge = path.join(here, '..', 'skills', 'obsidian-connect', 'scripts', 'obs.mjs');

// Folder name of a vault path (Windows or POSIX separators); true only for the hard-coded test vaults.
export function vaultNameOf(p) { return String(p || '').trim().replace(/[\\/]+$/, '').split(/[\\/]/).pop(); }
export function isAllowedVault(p) { return ALLOWED_VAULTS.includes(vaultNameOf(p)); }

// Google Drive for desktop conflict copies: "name (1).md", "name (2)", "... conflict ...", "- Copy".
export function isConflictName(name) {
  return /\(\d+\)(\.[^.\\/]+)?$/.test(name) || /conflict/i.test(name) || /[ _-]copy(\.[^.\\/]+)?$/i.test(name);
}
// Conflict-looking files present now that were not in `before` (both are arrays of vault-relative paths).
export function newConflicts(before, after) {
  const had = new Set(before);
  return after.filter((f) => !had.has(f) && isConflictName(path.posix.basename(f.replace(/\\/g, '/'))));
}

export function expectedWrites(tag, n = 5) {
  const out = [];
  for (let i = 1; i <= n; i++) out.push({ kind: 'daily', line: `- ${tag} daily ${i}` });
  for (let i = 1; i <= n; i++) out.push({ kind: 'prop', value: `${tag}-prop-${i}` });
  return out;
}
// A daily note must hold the line exactly once (a duplicated append would be a bug in the retry logic).
export function dailyHas(text, line) { return text.split(/\r?\n/).filter((l) => l.trim() === line).length === 1; }
export function propHas(json, name, value) {
  try { return String(JSON.parse(json)[name]) === value; } catch { return false; }
}
// Same check on the note's file text: the frontmatter holds `name: value` exactly once.
export function fileHasProp(text, name, value) {
  const m = text.replace(/\r/g, '').match(/^---\n([\s\S]*?)\n---(\n|$)/);
  if (!m) return false;
  return m[1].split('\n').filter((l) => l.startsWith(`${name}:`)).map((l) => l.slice(name.length + 1).trim().replace(/^["']|["']$/g, '')).join('|') === value;
}

function obs(vault, args) {
  const r = spawnSync(process.execPath, [bridge, ...args], { encoding: 'utf8', env: { ...process.env, OBS_VAULT: vault } });
  return { code: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

// Vault-relative file list: through the file system when the vault folder is readable from here, else PowerShell (WSL with a stale /mnt mount).
export function listFiles(vaultPath) {
  const candidates = [vaultPath];
  if (/^[A-Za-z]:[\\/]/.test(vaultPath)) {
    const w = spawnSync('wslpath', ['-u', vaultPath], { encoding: 'utf8' });
    if (w.status === 0) candidates.unshift(w.stdout.trim());
  }
  for (const root of candidates) {
    try { return walk(root, ''); } catch { /* try the next route */ }
  }
  const ps = spawnSync('powershell.exe', ['-NoProfile', '-Command', `Get-ChildItem -Recurse -Force -File -Name -LiteralPath '${vaultPath.replace(/'/g, "''")}' | ForEach-Object { $_ -replace '\\\\','/' }`], { encoding: 'utf8' });
  if (ps.status === 0 && ps.stdout.trim()) return ps.stdout.split(/\r?\n/).filter(Boolean);
  throw new Error('cannot list the vault folder (file system and PowerShell both failed)');
}
// Text of a vault file read from disk (what Drive syncs), with the same two routes as listFiles.
export function readText(vaultPath, rel) {
  const roots = [vaultPath];
  if (/^[A-Za-z]:[\\/]/.test(vaultPath)) { const w = spawnSync('wslpath', ['-u', vaultPath], { encoding: 'utf8' }); if (w.status === 0) roots.unshift(w.stdout.trim()); }
  for (const root of roots) { try { return fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8'); } catch { /* next route */ } }
  const full = `${vaultPath.replace(/[\\/]+$/, '')}\\${rel.replace(/\//g, '\\')}`.replace(/'/g, "''");
  const ps = spawnSync('powershell.exe', ['-NoProfile', '-Command', `[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-Content -Raw -Encoding UTF8 -LiteralPath '${full}'`], { encoding: 'utf8' });
  return ps.status === 0 ? ps.stdout : '';
}
function walk(root, rel) {
  const out = [];
  for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    if (e.name === '.git' || e.name === '.trash') continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(root, r)); else out.push(r);
  }
  return out;
}

function parseArgs(argv) {
  const o = { wait: 180, note: '_agentkit-lab/props/Property Note.md', tag: `e35-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}` };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--vault') o.vault = argv[++i];
    else if (k === '--note') o.note = argv[++i];
    else if (k === '--wait') o.wait = Number(argv[++i]);
    else if (k === '--tag') o.tag = argv[++i];
    else { console.error(`unknown argument ${k}`); process.exit(2); }
  }
  if (!o.vault || !Number.isFinite(o.wait)) { console.error('usage: node tests/e35-write-check.mjs --vault <name> [--note <path.md>] [--wait <seconds>] [--tag <text>]'); process.exit(2); }
  return o;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (!ALLOWED_VAULTS.includes(o.vault)) { console.error(`REFUSED: --vault "${o.vault}" is not one of the test vaults (${ALLOWED_VAULTS.join(', ')}). Nothing was written.`); return 2; }
  // Guard on what Obsidian reports, not on what we were told.
  const pf = obs(o.vault, ['--preflight', '--vault', o.vault]);
  if (pf.code !== 0 && /still loading|NEXT:.*wait/i.test(pf.out + pf.err)) { await new Promise((r) => setTimeout(r, 5000)); }
  const vp = obs(o.vault, ['vault', 'info=path']);
  if (vp.code !== 0 || !isAllowedVault(vp.out)) { console.error(`REFUSED: \`vault info=path\` gave "${vp.out.slice(0, 80)}", which is not a test vault. Nothing was written.`); return 2; }
  const vaultPath = vp.out.split(/\r?\n/)[0].trim();
  console.log(`vault ok: ${vaultNameOf(vaultPath)}; tag ${o.tag}`);

  let before;
  try { before = listFiles(vaultPath); } catch (e) { console.error(`REFUSED: ${e.message}; the conflict check would be blind. Nothing was written.`); return 2; }

  // Read-back is from the file on disk (what Drive syncs). Obsidian's own view (CLI read) is checked too and reported
  // separately: the bridge edits the file directly, and the CLI may not see it at once (see the summary line).
  const dailyRel = obs(o.vault, ['daily:path']).out.split(/\r?\n/)[0].trim();
  const results = [], seen = [];
  for (const [i, w] of expectedWrites(o.tag).entries()) {
    let r, disk, cli;
    if (w.kind === 'daily') {
      r = obs(o.vault, ['--daily-append-once', `content=${w.line}`]);
      disk = dailyHas(readText(vaultPath, dailyRel), w.line);
      cli = dailyHas(obs(o.vault, ['daily:read']).out, w.line);
    } else {
      r = obs(o.vault, ['--prop-set', `path=${o.note}`, 'name=e35_check', `value=${w.value}`]);
      disk = fileHasProp(readText(vaultPath, o.note), 'e35_check', w.value);
      cli = propHas(obs(o.vault, ['properties', `path=${o.note}`, 'format=json']).out, 'e35_check', w.value);
    }
    const ok = r.code === 0 && /^OK/m.test(r.out) && disk;
    results.push(ok); seen.push(cli);
    console.log(`${String(i + 1).padStart(2)}/10 ${w.kind.padEnd(5)} ${ok ? 'PASS' : 'FAIL'} file=${disk ? 'ok' : 'WRONG'} obsidian=${cli ? 'ok' : 'stale'}${ok ? '' : ` write: ${r.out.split('\n')[0] || r.err.split('\n')[0]}`}`);
  }
  const good = results.filter(Boolean).length;
  console.log(`writes read back correctly from the file: ${good}/10; Obsidian CLI saw ${seen.filter(Boolean).length}/10 at once`);

  if (o.wait > 0) { console.log(`waiting ${o.wait} s for Drive sync...`); await new Promise((r) => setTimeout(r, o.wait * 1000)); }
  let conflicts;
  try { conflicts = newConflicts(before, listFiles(vaultPath)); } catch (e) { console.error(e.message); return 1; }
  const late = [obs(o.vault, ['daily:read']).out, obs(o.vault, ['properties', `path=${o.note}`, 'format=json']).out];
  console.log(`after the wait, Obsidian CLI shows the last daily line: ${dailyHas(late[0], expectedWrites(o.tag)[4].line)}, the last property value: ${propHas(late[1], 'e35_check', expectedWrites(o.tag)[9].value)}`);
  console.log(conflicts.length ? `CONFLICT COPIES: ${conflicts.join(', ')}` : 'no new conflict copy');
  console.log(good === 10 && !conflicts.length ? 'E3.5 CHECK PASS' : 'E3.5 CHECK FAIL');
  console.log('The vault was left changed. Reset it (tests/scenarios/README.md, "E3.5 write check").');
  return good === 10 && !conflicts.length ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main();
