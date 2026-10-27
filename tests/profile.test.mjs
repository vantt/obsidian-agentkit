// profile.mjs: values match the source JSON, size budget holds, no note content leaks.
// Run: node --test tests/profile.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OTF } from './otf.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const profile = path.join(here, '..', 'skills', 'obsidian-connect', 'scripts', 'profile.mjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-fixture-'));
spawnSync(process.execPath, [OTF, 'generate', '--preset', 'hard-cases', '--out', dir, '--standalone'], { encoding: 'utf8' });
const run = (vault) => spawnSync(process.execPath, [profile, vault], { encoding: 'utf8' });

test('fixture profile reports the configured values with their source file', () => {
  const r = run(dir);
  assert.equal(r.status, 0, r.stderr);
  const out = r.stdout;
  for (const [re, label] of [
    [/new_link_format: "relative"  # from app\.json/, 'link format'],
    [/new_note_location: "folder"  # from app\.json/, 'new note location'],
    [/new_note_folder: "inbox"/, 'new note folder'],
    [/attachment_folder: "attachments"/, 'attachments'],
    [/trash_option: "local"/, 'trash'],
    [/excluded: \["bulk\/"\]/, 'excluded'],
    [/folder: "daily"  # from daily-notes\.json; exists/, 'daily folder'],
    [/format: "YYYY\/MM\/YYYY-MM-DD"/, 'daily format'],
    [/template: "templates\/daily"/, 'daily template'],
    [/core_folder: "templates"/, 'templates folder'],
    [/"rating=number"/, 'types'],
    [/"related=multitext"/, 'types list'],
    [/app \(conflict 2026-01-01-00-00-00\)\.json/, 'conflict copy listed'],
  ]) assert.match(out, re, label);
  assert.doesNotMatch(out, /alwaysUpdateLinks: false|auto_update_on_rename: false/, 'conflict copy must not be read');
});

test('profile stays within ~35 lines and holds no note text', () => {
  const out = run(dir).stdout;
  assert.ok(out.trim().split('\n').length <= 35);
  for (const s of ['Body of section', 'Đường dẫn', 'Broken on purpose', 'Line 1 of section']) assert.ok(!out.includes(s), s);
});

test('missing .obsidian exits 5', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-empty-'));
  assert.equal(run(empty).status, 5);
});
