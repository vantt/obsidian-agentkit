// Guard and verification logic of tests/e35-write-check.mjs, offline (fake CLI). Run: node --test tests/e35-write-check.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAllowedVault, isConflictName, newConflicts, dailyHas, propHas, expectedWrites } from './e35-write-check.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, 'e35-write-check.mjs');
const fake = path.join(here, 'fake-obsidian.mjs');
fs.chmodSync(fake, 0o755);

test('allowlist: test vault folders only', () => {
  assert.ok(isAllowedVault('G:\\My Drive\\x\\obsidian-agentkit-drive-test'));
  assert.ok(isAllowedVault('/home/u/vault-copy/'));
  assert.ok(isAllowedVault('/tmp/vault-synth'));
  assert.ok(!isAllowedVault('/home/u/vault-copy-2'));
  assert.ok(!isAllowedVault('/home/u/vault-copy/sub'));
  assert.ok(!isAllowedVault('D:\\Notes\\Main'));
  assert.ok(!isAllowedVault(''));
});

test('conflict names and diff against the before list', () => {
  for (const n of ['Note (1).md', 'Note (12)', 'a conflict b.md', 'Note - Copy.md', 'app (1).json']) assert.ok(isConflictName(n), n);
  for (const n of ['Note.md', 'Copy of ideas.md', 'Rule (draft) x.md', 'Plan 1.md']) assert.ok(!isConflictName(n), n);
  const before = ['a.md', 'old (1).md'];
  assert.deepEqual(newConflicts(before, ['a.md', 'old (1).md', 'b.md', 'dir/a (2).md']), ['dir/a (2).md']);
});

test('read-back checks', () => {
  assert.ok(dailyHas('# x\n- t daily 1\n', '- t daily 1'));
  assert.ok(!dailyHas('- t daily 1\n- t daily 1\n', '- t daily 1'));
  assert.ok(!dailyHas('', '- t daily 1'));
  assert.ok(propHas('{"e35_check":"v1"}', 'e35_check', 'v1'));
  assert.ok(!propHas('{"e35_check":"v0"}', 'e35_check', 'v1'));
  assert.ok(!propHas('not json', 'e35_check', 'v1'));
  assert.equal(expectedWrites('t').length, 10);
});

function run(args, vaultDir, log) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...process.env, OBS_CLI: fake, FAKE_MODE: 'vault', FAKE_VAULT: vaultDir, FAKE_LOG: log, OBS_STATE: path.join(path.dirname(log), 'state.json'), OBS_TIMEOUT: '2' } });
}

test('refuses a --vault name outside the allowlist, before any CLI call', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'e35-'));
  const log = path.join(d, 'log');
  const r = run(['--vault', 'my-real-vault', '--wait', '0'], d, log);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /REFUSED/);
  assert.ok(!fs.existsSync(log));
});

test('refuses when `vault info=path` is not a test vault, and writes nothing', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'e35-'));
  const root = path.join(d, 'some-other-vault');
  fs.mkdirSync(root);
  const log = path.join(d, 'log');
  const r = run(['--vault', 'vault-synth', '--wait', '0'], root, log);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /REFUSED/);
  const calls = fs.readFileSync(log, 'utf8');
  assert.ok(!/daily|property|prop/.test(calls.replace(/vault=[^"]*/g, '')), 'no write command was sent');
});
