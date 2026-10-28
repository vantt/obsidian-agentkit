// Guard and verification logic of tests/e36-bulk-rehearsal.mjs, offline (fake CLI). Run: node --test tests/e36-bulk-rehearsal.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTotal, parseSnapshot, linksUpdated, pathLinkMoved, isDryRun, mentionsAll, sameState, snapshotSubject, fixtures, PLAN } from './e36-bulk-rehearsal.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, 'e36-bulk-rehearsal.mjs');
const fake = path.join(here, 'fake-obsidian.mjs');
fs.chmodSync(fake, 0o755);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'e36-'));

test('parseTotal and parseSnapshot', () => {
  assert.equal(parseTotal('89\n'), 89);
  assert.equal(parseTotal(''), 0);
  assert.ok(Number.isNaN(parseTotal('Error: x')));
  const line = 'OK: renamed a.md -> b.md; backlinks 2->2; unresolved 3->3; snapshot in .trash/obsidian-connect-snapshots/2026-10-28T10-00-00-000Z/ (git abc1234)';
  assert.deepEqual(parseSnapshot(line), { dir: '.trash/obsidian-connect-snapshots/2026-10-28T10-00-00-000Z/', sha: 'abc1234' });
  assert.equal(parseSnapshot('OK: x; snapshot in .trash/s/2026/').sha, null);
  assert.equal(parseSnapshot('OK: nothing'), null);
});

test('link, dry-run and state checks', () => {
  assert.ok(linksUpdated('see [[New|alias]]', 'Old', 'New'));
  assert.ok(!linksUpdated('see [[Old]] and [[New]]', 'Old', 'New'));
  assert.ok(!linksUpdated('see [[Old]]', 'Old', 'New'));
  assert.ok(pathLinkMoved('[[a/moved/N]]', 'a/N.md', 'N'));
  assert.ok(!pathLinkMoved('[[a/N]]', 'a/N.md', 'N'));
  assert.ok(isDryRun('NOT DONE: dry run, nothing written yet. Would make 1 change'));
  assert.ok(!isDryRun('OK: renamed #a to #b'));
  assert.ok(mentionsAll('x/a.md:1\nx/b.md:2', ['x/a.md', 'x/b.md']) && !mentionsAll('x/a.md', ['x/a.md', 'x/b.md']));
  const s = { head: 'h', status: '', files: { a: '1' } };
  assert.ok(sameState(s, { ...s, files: { a: '1' } }));
  assert.ok(!sameState(s, { ...s, files: { a: '2' } }));
  assert.ok(!sameState(s, { ...s, status: '?? x' }));
  assert.ok(!sameState(s, { ...s, head: 'g' }));
  assert.ok(snapshotSubject('obsidian-connect: snapshot before rename x') && !snapshotSubject('fixture'));
});

test('fixtures: every planned path exists, all under the lab folder', () => {
  const f = fixtures();
  for (const p of [PLAN.rename.src, PLAN.move.src, ...PLAN.rename.referrers, ...PLAN.tag.files]) assert.ok(p in f, p);
  assert.ok(Object.keys(f).every((p) => p.startsWith('_agentkit-lab/e36/')));
});

function run(vaultArg, dir, extra = {}) {
  return spawnSync(process.execPath, [script, '--vault', vaultArg, '--wait', '0', '--index-timeout', '2'], {
    encoding: 'utf8', env: { ...process.env, OBS_CLI: fake, FAKE_MODE: 'vault', FAKE_VAULT: dir, OBS_STATE: path.join(tmp, 'state.json'), OBS_VERIFY_MS: '0', ...extra },
  });
}
function gitVault(name) {
  const dir = path.join(fs.mkdtempSync(path.join(tmp, 'v-')), name);
  fs.mkdirSync(dir, { recursive: true });
  const g = (...a) => spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@localhost', ...a], { encoding: 'utf8' });
  g('init', '-q'); fs.writeFileSync(path.join(dir, 'keep.md'), 'x\n'); g('add', '-A'); g('commit', '-q', '-m', 'base');
  return { dir, g };
}

test('refuses a vault name that is not a test vault, and a path that is not one', () => {
  const r = run('some-real-vault', tmp);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /REFUSED: --vault "some-real-vault"/);
  const v = gitVault('my-notes');
  const r2 = run('vault-copy', v.dir);
  assert.equal(r2.status, 2);
  assert.match(r2.stderr, /not one of the test vaults|which is not a test vault/);
  assert.ok(!fs.existsSync(path.join(v.dir, '_agentkit-lab')), 'nothing written');
});

test('refuses a dirty tree and a vault that is not a git work tree', () => {
  const v = gitVault('vault-copy');
  fs.writeFileSync(path.join(v.dir, 'dirt.md'), 'x');
  const r = run('vault-copy', v.dir);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /uncommitted changes/);
  assert.ok(!fs.existsSync(path.join(v.dir, '_agentkit-lab')));
  const plain = path.join(fs.mkdtempSync(path.join(tmp, 'p-')), 'vault-copy');
  fs.mkdirSync(plain);
  const r2 = run('vault-copy', plain);
  assert.equal(r2.status, 2);
  assert.match(r2.stderr, /not a git work tree/);
});

test('full rehearsal against the fake CLI: all checks pass and the vault is reset', () => {
  const v = gitVault('vault-copy');
  const head = v.g('rev-parse', 'HEAD').stdout.trim();
  const r = run('vault-copy', v.dir);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /E3\.6a REHEARSAL PASS/);
  assert.ok(!/FAIL /.test(r.stdout.replace(/E3\.6a REHEARSAL FAIL/g, '')), r.stdout);
  assert.equal(v.g('status', '--porcelain').stdout.trim(), '');
  assert.equal(v.g('rev-parse', 'HEAD').stdout.trim(), head);
  assert.ok(!fs.existsSync(path.join(v.dir, '_agentkit-lab', 'e36')));
});
