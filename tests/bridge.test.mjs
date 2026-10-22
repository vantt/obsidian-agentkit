// Bridge exit codes and argument handling, against a fake CLI (no Obsidian needed).
// Run: node --test tests/bridge.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, detectEnv } from '../skills/obsidian-connect/scripts/obs.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const bridge = path.join(here, '..', 'skills', 'obsidian-connect', 'scripts', 'obs.mjs');
const fake = path.join(here, 'fake-obsidian.mjs');
fs.chmodSync(fake, 0o755);

function obs(args, mode, extraEnv = {}) {
  const env = { ...process.env, OBS_CLI: fake, OBS_VAULT: 'test-vault', FAKE_MODE: mode, OBS_TIMEOUT: '2', ...extraEnv };
  const r = spawnSync(process.execPath, [bridge, ...args], { encoding: 'utf8', env });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

test('0 ok passes stdout through unchanged', () => {
  const r = obs(['search', 'query=x'], 'ok');
  assert.equal(r.code, 0);
  assert.equal(r.out, 'result line\n');
  assert.equal(r.err, '');
});

test('vault is always the first argument', () => {
  const r = obs(['search', 'query=x', 'vault=other'], 'args');
  assert.deepEqual(JSON.parse(r.out), ['vault=test-vault', 'search', 'query=x', 'vault=other']);
});

test('--vault flag overrides OBS_VAULT', () => {
  const r = obs(['--vault', 'v2', 'search', 'query=x'], 'args');
  assert.equal(JSON.parse(r.out)[0], 'vault=v2');
});

test('2 unreachable: Obsidian closed', () => {
  assert.equal(obs(['version'], 'closed').code, 2);
});

test('2 unreachable: Obsidian closed, message on stderr', () => {
  assert.equal(obs(['version'], 'closed-stderr').code, 2);
  assert.equal(obs(['--preflight'], 'closed-stderr').code, 2);
});

test('2 unreachable: CLI binary missing', () => {
  assert.equal(obs(['version'], 'ok', { OBS_CLI: '/nonexistent/Obsidian.com' }).code, 2);
});

test('2 unreachable: exit 127 from Obsidian.exe', () => {
  assert.equal(obs(['property:read', 'name=a', 'path=b.md'], 'exe-127').code, 2);
});

test('3 Error: text with exit 0', () => {
  const r = obs(['read', 'path=x.md'], 'error');
  assert.equal(r.code, 3);
  assert.match(r.err, /^obs: 3 Error: File/);
});

test('3 Vault not found. (no Error: prefix)', () => {
  assert.equal(obs(['vault'], 'vault-missing').code, 3);
});

test('4 empty: No … found.', () => {
  assert.equal(obs(['search', 'query=x'], 'empty-msg').code, 4);
});

test('4 empty: blank stdout on a read/list command', () => {
  assert.equal(obs(['daily:read'], 'empty-out').code, 4);
});

test('0 blank stdout on a non-list command is not "empty"', () => {
  assert.equal(obs(['append', 'path=a.md', 'content=x'], 'empty-out').code, 0);
});

test('leading blank line from Obsidian.exe is stripped', () => {
  assert.equal(obs(['search', 'query=x'], 'leading-blank').out, 'real output\n');
});

test('5 usage: no vault configured', () => {
  assert.equal(obs(['search', 'query=x'], 'ok', { OBS_VAULT: '' }).code, 5);
});

test('6 not ready: command not found while loading', () => {
  assert.equal(obs(['eval', 'code=1', '--allow-unsafe'], 'not-ready').code, 6);
});

test('7 guard: delete, eval, overwrite, typed property:set, raw rename/move/create', () => {
  for (const args of [['delete', 'path=a.md'], ['eval', 'code=1'], ['append', 'path=a.md', 'content=x', 'overwrite'],
    ['property:set', 'name=a', 'value=1', 'type=number', 'path=a.md'], ['rename', 'path=a.md', 'name=b'], ['move', 'path=a.md', 'to=b/'],
    ['create', 'path=a.md'], ['plugin:install', 'id=x'], ['dev:cdp', 'method=x']]) {
    assert.equal(obs(args, 'ok').code, 7, args.join(' '));
  }
});

test('--allow-unsafe lets a denied command through', () => {
  assert.equal(obs(['delete', 'path=a.md', '--allow-unsafe'], 'ok').code, 0);
});

test('124 timeout without retry', () => {
  const t = Date.now();
  const r = obs(['search', 'query=x'], 'hang', { OBS_TIMEOUT: '1' });
  assert.equal(r.code, 124);
  assert.ok(Date.now() - t < 5000, 'returned within 5 s');
});

test('--preflight without vault: env and version lines, exit 5', () => {
  const r = obs(['--preflight'], 'ok', { OBS_VAULT: '' });
  assert.equal(r.code, 5);
  assert.ok(r.out.split('\n').filter(Boolean).length <= 5);
  assert.match(r.out, /^env=/);
});

test('--preflight with Obsidian closed: one call, exit 2, says file mode', () => {
  const r = obs(['--preflight'], 'closed');
  assert.equal(r.code, 2);
  assert.match(r.out, /file mode/);
});

test('--abs translates the vault path for this environment', { skip: detectEnv() !== 'wsl' && 'needs WSL' }, () => {
  const r = obs(['--abs', 'sub dir/Ghi chú.md'], 'vault-path');
  assert.equal(r.code, 0);
  assert.equal(r.out.trim(), '/mnt/c/Some Dir/Vault Đà Nẵng/sub dir/Ghi chú.md');
});

test('classify unit cases', () => {
  assert.deepEqual(classify({ status: 0, stdout: 'Error: x' }, 'read')[0], 3);
  assert.deepEqual(classify({ status: 0, stdout: 'No backlinks found.\n' }, 'backlinks')[0], 4);
  assert.deepEqual(classify({ status: 0, stdout: '' }, 'tasks')[0], 4);
  assert.deepEqual(classify({ status: null, stdout: '', error: { code: 'ETIMEDOUT' } }, 'x')[0], 124);
  assert.deepEqual(classify({ status: 0, stdout: 'Renamed: a -> b\n' }, 'rename')[0], 0);
});

test('detectEnv', () => {
  assert.equal(detectEnv('win32', ''), 'windows');
  assert.equal(detectEnv('linux', 'Linux version 5.15.133.1-microsoft-standard-WSL2'), 'wsl');
  assert.equal(detectEnv('linux', 'Linux version 6.1 generic'), 'other');
  assert.equal(detectEnv('darwin', ''), 'other');
});
