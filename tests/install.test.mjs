import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { nodeOk, planLink, makeLink, run, SKILL_SRC } from '../install.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'install-test-'));
const fake = { skipCli: true, env: 'other', cli: '/x/obsidian', cliVersion: '1.15.0', nodeVersion: 'v20.0.0' };

test('nodeOk compares the major version', () => {
  assert.equal(nodeOk('v18.0.0'), true);
  assert.equal(nodeOk('20.11.1'), true);
  assert.equal(nodeOk('v16.20.2'), false);
  assert.equal(nodeOk('v9.9.9'), false);
  assert.equal(nodeOk('garbage'), false);
});

test('dry run prints the plan and writes nothing', async () => {
  const d = tmp();
  const { code, lines } = await run(['--skills-dir', d], fake);
  const text = lines.join('\n');
  assert.equal(code, 0);
  assert.match(text, /dry run/);
  assert.match(text, /\[todo\] Would create/);
  assert.match(text, /OBS_VAULT/);
  assert.ok(text.includes(path.join(d, 'obsidian-connect', 'scripts', 'obs.mjs') + '" --preflight --vault'));
  assert.deepEqual(fs.readdirSync(d), []);
});

test('old Node fails; missing CLI only warns', async () => {
  const d = tmp();
  const old = await run(['--skills-dir', d], { ...fake, nodeVersion: 'v16.0.0' });
  assert.equal(old.code, 1);
  const nocli = await run(['--skills-dir', d], { ...fake, cli: null });
  assert.equal(nocli.code, 0);
  assert.match(nocli.lines.join('\n'), /CLI not found/);
  assert.match(nocli.lines.join('\n'), /Command line interface/);
});

test('--link creates the link in a temp dir, then reports it as already linked', async () => {
  const d = path.join(tmp(), 'skills');
  const r = await run(['--link', '--skills-dir', d], fake);
  assert.equal(r.code, 0);
  const link = path.join(d, 'obsidian-connect');
  assert.ok(fs.lstatSync(link).isSymbolicLink());
  assert.equal(fs.realpathSync(link), fs.realpathSync(SKILL_SRC));
  const again = await run(['--link', '--skills-dir', d], fake);
  assert.equal(again.code, 0);
  assert.match(again.lines.join('\n'), /already linked/);
});

test('refuses to overwrite a different link or a real folder', async () => {
  const d = tmp();
  const other = tmp();
  fs.symlinkSync(other, path.join(d, 'obsidian-connect'), 'dir');
  const r = await run(['--link', '--skills-dir', d], fake);
  assert.equal(r.code, 1);
  assert.match(r.lines.join('\n'), /different place/);
  assert.equal(fs.realpathSync(path.join(d, 'obsidian-connect')), fs.realpathSync(other));

  const d2 = tmp();
  fs.mkdirSync(path.join(d2, 'obsidian-connect'));
  const plan = planLink(d2);
  assert.equal(plan.action, 'conflict');
  assert.throws(() => makeLink(plan));
});
