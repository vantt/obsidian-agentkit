#!/usr/bin/env node
// The agent's own Obsidian `obsidian.json` (E8.12). The real one, in Windows %APPDATA%\obsidian, lists every vault
// of the user; agents read it to find the vault when Obsidian is closed (S7), and SKILL.md once suggested that.
// cc-run.sh binds the file written here read-only over the real path inside the sandbox, so the agent and the
// bridge see only the vault under test. The real file is read here, outside the sandbox, and never printed:
// only the matching entry's id, ts and open flag are kept, plus the boolean `cli` setting.
// Usage: node tests/models/obsidian-json.mjs <vault-dir> <out-file> [--win-path <windows-path>]
//   prints `<path of the real obsidian.json, as seen from WSL>` on stdout (where cc-run.sh binds the file).
//   --win-path: a vault Obsidian does not know (sandbox-check.sh's dummy vault): written under that Windows
//   path with a random id, and never matched against the real file.
// Env: E8_WIN_APPDATA overrides the Windows %APPDATA% folder (WSL path).
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sh = (cmd, args, opt = {}) => spawnSync(cmd, args, { encoding: 'utf8', timeout: 10000, ...opt });

// WSL path of Windows %APPDATA% (…/AppData/Roaming): the variable itself, else next to the Obsidian install.
export function appDataDir() {
  if (process.env.E8_WIN_APPDATA) return process.env.E8_WIN_APPDATA;
  const r = sh('cmd.exe', ['/c', 'echo %APPDATA%'], { cwd: '/mnt/c' });
  const win = (r.stdout || '').trim();
  if (win && !win.includes('%')) {
    const p = sh('wslpath', ['-u', win]).stdout?.trim();
    if (p) return p;
  }
  try {
    const cli = fs.readFileSync(path.join(os.homedir(), '.local/state/obs-showcase/real-cli'), 'utf8').trim();
    const m = cli.match(/^(.*\/AppData)\/Local\//i);
    if (m) return `${m[1]}/Roaming`;
  } catch { /* no install record */ }
  throw new Error('cannot find Windows %APPDATA% (set E8_WIN_APPDATA)');
}

export const realObsidianJson = () => path.join(appDataDir(), 'obsidian', 'obsidian.json');

const winNorm = (p) => p.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();

// Build the synthetic file's content. `real` is the parsed real file (or null); `winPath` the vault's Windows path.
export function synthesize(real, winPath, { matchReal = true } = {}) {
  let id = null, entry = null;
  if (matchReal) {
    for (const [k, v] of Object.entries(real?.vaults || {})) {
      if (typeof v?.path === 'string' && winNorm(v.path) === winNorm(winPath)) { id = k; entry = v; break; }
    }
    if (!id) throw new Error('the vault under test is not registered in Obsidian (open it in Obsidian once)');
  }
  const out = { vaults: { [id || crypto.randomBytes(8).toString('hex')]: {
    path: entry?.path ?? winPath, ts: Number.isFinite(entry?.ts) ? entry.ts : Date.now(), ...(entry?.open === true ? { open: true } : {}),
  } } };
  if (typeof real?.cli === 'boolean') out.cli = real.cli;
  return out;
}

// Write the agent's file; return the WSL path of the real one (the bind target).
export function writeAgentObsidianJson(vaultDir, outFile, winPath = null) {
  const target = realObsidianJson();
  let real = null;
  try { real = JSON.parse(fs.readFileSync(target, 'utf8')); } catch { /* no real file: nothing to copy */ }
  const wp = winPath || sh('wslpath', ['-w', vaultDir]).stdout?.trim();
  if (!wp || !/^[A-Za-z]:\\/.test(wp)) throw new Error('the vault under test must be on a Windows drive');
  const data = synthesize(real, wp, { matchReal: !winPath });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(data));
  return target;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const [vaultDir, outFile] = process.argv.slice(2);
  const i = process.argv.indexOf('--win-path');
  if (!vaultDir || !outFile) { console.error('usage: obsidian-json.mjs <vault-dir> <out-file> [--win-path <windows-path>]'); process.exit(2); }
  try { console.log(writeAgentObsidianJson(vaultDir, outFile, i > 0 ? process.argv[i + 1] : null)); } catch (e) { console.error(`obsidian-json: ${e.message}`); process.exit(7); }
}
