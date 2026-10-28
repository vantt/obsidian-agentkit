// E2.4a: the CLI "fails silently" (prints nothing, exits 0), the failure mode feared for an elevated terminal.
// Offline only: FAKE_MODE=empty-out stands in for the CLI. Run: node --test tests/admin-silent.test.mjs
// The bridge catches silence on list/read commands (exit 4, "empty") and on `version` / `--preflight` (exit 2, NEXT line).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bridge = path.join(here, '..', 'skills', 'obsidian-connect', 'scripts', 'obs.mjs');
const fake = path.join(here, 'fake-obsidian.mjs');
fs.chmodSync(fake, 0o755);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-admin-'));
let n = 0;
function obs(args) {
  const env = { ...process.env, OBS_CLI: fake, OBS_VAULT: 'test-vault', FAKE_MODE: 'empty-out', OBS_TIMEOUT: '2', OBS_STATE: path.join(tmp, `s${n++}.json`) };
  const r = spawnSync(process.execPath, [bridge, ...args], { encoding: 'utf8', env });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

test('silent CLI: a search never looks like success, exit 4 with a NEXT line', () => {
  const r = obs(['search', 'query=x']);
  assert.equal(r.code, 4);
  assert.match(r.err, /^NEXT: /m);
});

test('silent CLI: reading a note is not reported as success', () => {
  const r = obs(['read', 'path=a.md']);
  assert.equal(r.code, 4);
  assert.match(r.err, /^NEXT: /m);
});

test('silent CLI: --preflight must not report OK (exit 2, NEXT line)', () => {
  const r = obs(['--preflight']);
  assert.equal(r.code, 2);
  assert.doesNotMatch(r.out, /^OK:/m);
  assert.match(r.err, /^NEXT: /m);
});

test('silent CLI: version must not look like success (exit 2 with a NEXT line)', () => {
  const r = obs(['version']);
  assert.equal(r.code, 2);
  assert.match(r.err, /^NEXT: /m);
});
