#!/usr/bin/env node
// Install helper for the obsidian-connect skill. No dependencies.
// Default is a dry run: it only checks and prints. It writes nothing unless --link is given,
// and then it creates exactly one link: <skills dir>/obsidian-connect -> <repo>/skills/obsidian-connect
// (a junction on Windows). It never runs a vault command.
//   node install.mjs [--link] [--skills-dir <dir>]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const MIN_NODE = 18;
const here = path.dirname(fileURLToPath(import.meta.url));
export const SKILL_SRC = path.join(here, 'skills', 'obsidian-connect');

// "v18.19.0" or "18.19.0" -> true when the major version is at least `min`.
export function nodeOk(version, min = MIN_NODE) {
  const m = String(version).match(/^v?(\d+)/);
  return !!m && Number(m[1]) >= min;
}

export function defaultSkillsDir(env = process.env, home = os.homedir()) {
  return path.join(env.CLAUDE_CONFIG_DIR || path.join(home, '.claude'), 'skills');
}

// Decide what to do about <skillsDir>/obsidian-connect. Reads only.
// -> { action: 'create' | 'ok' | 'conflict', link, reason? }
export function planLink(skillsDir, src = SKILL_SRC) {
  const link = path.join(skillsDir, 'obsidian-connect');
  let st;
  try { st = fs.lstatSync(link); } catch { return { action: 'create', link }; }
  if (!st.isSymbolicLink()) return { action: 'conflict', link, reason: 'exists and is not a link (a copy or a folder)' };
  let cur;
  try { cur = path.resolve(path.dirname(link), fs.readlinkSync(link)); } catch { cur = ''; }
  const norm = (p) => path.resolve(p).replace(/^\\\\\?\\/, '').toLowerCase();
  if (cur && norm(cur) === norm(src)) return { action: 'ok', link };
  return { action: 'conflict', link, reason: `already links to a different place (${cur || 'unreadable'})` };
}

// Creates the single link. Refuses to touch anything that exists.
export function makeLink(plan, src = SKILL_SRC, platform = process.platform) {
  if (plan.action !== 'create') throw new Error('refusing to overwrite: ' + plan.action);
  fs.mkdirSync(path.dirname(plan.link), { recursive: true });
  fs.symlinkSync(src, plan.link, platform === 'win32' ? 'junction' : 'dir');
}

// Harmless check: `<cli> version`, nothing else. Returns the version text or null.
function cliVersion(cli, env) {
  const cwd = env === 'wsl' ? '/mnt/c' : undefined;
  const r = spawnSync(cli, ['version'], { encoding: 'utf8', timeout: 10000, cwd, killSignal: 'SIGKILL' });
  const out = ((r.stdout || '') + '').trim().split(/\r?\n/).filter(Boolean).pop();
  return r.status === 0 && out ? out : null;
}

// Core: returns { code, lines }. `deps` lets tests avoid the real CLI and platform.
export async function run(argv, deps = {}) {
  const lines = [];
  const say = (s = '') => lines.push(s);
  const platform = deps.platform || process.platform;
  const nodeVersion = deps.nodeVersion || process.version;
  const src = deps.src || SKILL_SRC;
  const doLink = argv.includes('--link');
  const i = argv.indexOf('--skills-dir');
  const skillsDir = i >= 0 && argv[i + 1] ? path.resolve(argv[i + 1]) : defaultSkillsDir();
  let code = 0;

  say(doLink ? 'obsidian-connect install (--link: will create the skill link)' : 'obsidian-connect install (dry run: nothing is written; add --link to create the link)');
  say();

  // 1. Node
  if (nodeOk(nodeVersion)) say(`[ok]   Node ${nodeVersion} (need ${MIN_NODE} or later)`);
  else { say(`[FAIL] Node ${nodeVersion} is too old (need ${MIN_NODE} or later). Install a current LTS from https://nodejs.org and run this again.`); code = 1; }

  // 2. Obsidian CLI (same detection as the skill's bridge)
  let env = deps.env, cli = deps.cli, ver = deps.cliVersion;
  if (!deps.skipCli) {
    const obs = await import(pathToFileURL(path.join(src, 'scripts', 'obs.mjs')).href);
    env = env || obs.detectEnv();
    cli = cli === undefined ? obs.findCli(env) : cli;
    ver = ver === undefined ? (cli ? cliVersion(cli, env) : null) : ver;
  }
  if (!cli) {
    say(`[warn] Obsidian CLI not found (environment: ${env || 'unknown'}).`);
    say('       Install Obsidian 1.12 or later, then enable it: Settings > General > Command line interface.');
    say('       On WSL the bridge looks for the Windows Obsidian.com; elsewhere set OBS_CLI to its full path.');
    say('       Without the CLI the skill still works in a file-only mode and labels answers as approximate.');
  } else if (!ver) {
    say(`[warn] Found the CLI at ${cli} but "version" gave no answer. Start Obsidian (it must be open) and run this again.`);
  } else say(`[ok]   Obsidian CLI ${ver} at ${cli}`);

  // 3. Skill link
  const plan = planLink(skillsDir, src);
  if (plan.action === 'ok') say(`[ok]   Skill already linked: ${plan.link}`);
  else if (plan.action === 'conflict') { say(`[FAIL] ${plan.link} ${plan.reason}. Not touching it; remove or rename it yourself, then run this again.`); code = 1; }
  else if (doLink) {
    try { makeLink(plan, src, platform); say(`[ok]   Created ${platform === 'win32' ? 'junction' : 'symlink'}: ${plan.link} -> ${src}`); }
    catch (e) { say(`[FAIL] Could not create the link: ${e.message}`); code = 1; }
  } else say(`[todo] Would create ${platform === 'win32' ? 'junction' : 'symlink'}: ${plan.link} -> ${src}  (run with --link)`);

  // 4. Vault reminder and first command
  say();
  const first = `node "${path.join(plan.link, 'scripts', 'obs.mjs')}" --preflight --vault "<vault name>"`;
  say('Next: tell the skill which vault to use. Replace <vault name> with the name shown in Obsidian.');
  say(platform === 'win32'
    ? '  PowerShell: $env:OBS_VAULT = "<vault name>"   (keep it for later sessions: setx OBS_VAULT "<vault name>")'
    : '  Shell: export OBS_VAULT="<vault name>"   (add it to your shell profile to keep it)');
  say(process.env.OBS_VAULT ? '  OBS_VAULT is set in this shell.' : '  OBS_VAULT is not set in this shell.');
  say('First command (checks the vault, changes nothing):');
  say('  ' + first);
  return { code, lines };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { code, lines } = await run(process.argv.slice(2));
  console.log(lines.join('\n'));
  process.exitCode = code;
}
