// Bridge exit codes and argument handling, against a fake CLI (no Obsidian needed).
// Run: node --test tests/bridge.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, detectEnv } from '../skills/obsidian-connect/scripts/obs.mjs';
import { OTF } from './otf.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const bridge = path.join(here, '..', 'skills', 'obsidian-connect', 'scripts', 'obs.mjs');
const fake = path.join(here, 'fake-obsidian.mjs');
fs.chmodSync(fake, 0o755);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-bridge-'));
let stateN = 0;
// Each call gets its own state file (remembered vault, loop breaker) unless the test passes OBS_STATE.
function obs(args, mode, extraEnv = {}) {
  const env = { ...process.env, OBS_CLI: fake, OBS_VAULT: 'test-vault', FAKE_MODE: mode, OBS_TIMEOUT: '2', OBS_STATE: path.join(tmp, `state-${stateN++}.json`), ...extraEnv };
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

// v2: uses `open` because raw `append` is now routed to obs --append (exit 5).
test('0 blank stdout on a non-list command is not "empty"', () => {
  assert.equal(obs(['open', 'path=a.md'], 'empty-out').code, 0);
});

test('leading blank line from Obsidian.exe is stripped', () => {
  assert.equal(obs(['search', 'query=x'], 'leading-blank').out, 'real output\n');
});

test('5 usage: no vault configured', () => {
  assert.equal(obs(['search', 'query=x'], 'ok', { OBS_VAULT: '' }).code, 5);
});

// v2: eval can no longer be unlocked, so the not-ready case uses a known read command.
test('6 not ready: command not found while loading', () => {
  assert.equal(obs(['tags'], 'not-ready').code, 6);
});

// v2 (intended change): raw writes that have a bridge command now exit 5 and name that command; v1 gave 7.
test('7 guard: eval, dev, overwrite, plugin install; 5 route: raw delete/rename/move/create/property:set', () => {
  for (const args of [['eval', 'code=1'], ['search', 'query=x', 'overwrite'],
    ['plugin:install', 'id=x'], ['dev:cdp', 'method=x'], ['command', 'id=app:delete-file']]) {
    assert.equal(obs(args, 'ok').code, 7, args.join(' '));
  }
  for (const [args, want] of [[['delete', 'path=a.md'], /obs --trash/], [['property:set', 'name=a', 'value=1', 'type=number', 'path=a.md'], /obs --prop-set/],
    [['rename', 'path=a.md', 'name=b'], /obs --rename/], [['move', 'path=a.md', 'to=b/'], /obs --move/], [['create', 'path=a.md'], /obs --create/],
    [['append', 'path=a.md', 'content=x'], /obs --append/], [['daily:append', 'content=x'], /obs --daily-append-once/]]) {
    const r = obs(args, 'ok');
    assert.equal(r.code, 5, args.join(' '));
    assert.match(lastLine(r.err), new RegExp('^NEXT: .*' + want.source), args.join(' '));
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

test('--preflight timeout on a vault that is still opening: wait and run --preflight once more', () => {
  const r = obs(['--preflight', '--vault', 'v'], 'hang-vault', { OBS_TIMEOUT: '1' });
  assert.equal(r.code, 124);
  assert.match(lastLine(r.err), /^NEXT: Obsidian may be opening this vault; wait 60 s and run obs --preflight once more/);
});

// v2 (intended change): the first line is NOT DONE, and NEXT says to ask the user (never to read obsidian.json).
test('--preflight without vault: NOT DONE, ask the user, exit 5', () => {
  const r = obs(['--preflight'], 'ok', { OBS_VAULT: '' });
  assert.equal(r.code, 5);
  assert.ok(r.out.split('\n').filter(Boolean).length <= 5);
  assert.match(r.out, /^NOT DONE: /);
  assert.match(lastLine(r.err), /^NEXT: ask the user for the vault name/);
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

// ---------- v2: output contract and new bridge commands (E8.6, E8.7) ----------
const lastLine = (s) => s.trim().split('\n').pop();
const firstLine = (s) => s.split('\n')[0];
const CONTRACT = /^(OK|NOT DONE|APPROXIMATE): /;

// A fresh copy of the hard-cases fixture (obsidian-test-fixture) per test, plus a CLI log of the fake.
function fixture() {
  const dir = fs.mkdtempSync(path.join(tmp, 'vault-'));
  const r = spawnSync(process.execPath, [OTF, 'generate', '--preset', 'hard-cases', '--out', dir, '--standalone'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const log = path.join(dir, '..', path.basename(dir) + '.log');
  const call = (args, extra = {}) => obs(args, 'vault', { FAKE_VAULT: dir, FAKE_LOG: log, OBS_VERIFY_MS: '0', ...extra });
  const cliCalls = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  const read = (rel) => fs.readFileSync(path.join(dir, ...rel.split('/')), 'utf8');
  const truth = (...a) => JSON.parse(spawnSync(process.execPath, [OTF, 'truth', ...a], { encoding: 'utf8' }).stdout);
  // File mode: no CLI at all, vault folder given.
  const offline = (args, extra = {}) => obs(args, 'ok', { OBS_CLI: path.join(tmp, 'no-such-cli'), OBS_VAULT_DIR: dir, ...extra });
  return { dir, call, offline, cliCalls, read, truth };
}

test('contract: every non-zero exit ends with a NEXT: line', () => {
  const cases = [[['version'], 'closed'], [['read', 'path=x.md'], 'error'], [['vault'], 'vault-missing'], [['search', 'query=x'], 'empty-msg'],
    [['search', 'query=x'], 'ok', { OBS_VAULT: '' }], [['tags'], 'not-ready'], [['eval', 'code=1'], 'ok'], [['rename', 'path=a.md', 'name=b'], 'ok'],
    [['search', 'query=x'], 'hang', { OBS_TIMEOUT: '1' }], [['--nope'], 'ok'], [['grep', '-r', 'x'], 'ok'], [['exec', 'ls'], 'ok'], [['frobnicate'], 'not-ready'],
    [['--preflight'], 'closed'], [['--prop-set', 'path=nope.md', 'name=a', 'value=1'], 'ok', { OBS_VAULT_DIR: tmp }]];
  for (const [args, mode, extra] of cases) {
    const r = obs(args, mode, extra);
    assert.notEqual(r.code, 0, args.join(' '));
    assert.match(lastLine(r.err), /^NEXT: \S/, `${args.join(' ')} -> ${r.err}`);
  }
});

test('contract: bridge commands start with OK:, NOT DONE: or APPROXIMATE:', () => {
  const f = fixture();
  for (const [args, file] of [[['--tasks-count']], [['--find', 'Đà Nẵng']], [['--backlinks', 'path=Target Note.md']],
    [['--prop-set', 'path=props/Property Note.md', 'name=status', 'value=done']], [['--section-edit', 'path=long/Long CRLF Note.md', 'heading=Section 02']],
    [['--tag-rename', 'from=proj', 'to=p2']], [['--append', 'path=refs/ref-wikilink.md', 'content=x']], [['--prop-set', 'path=props/Property Note.md', 'name=rating', 'value=x']],
    [['--tasks-count'], true], [['--find', 'Nguyễn'], true]]) {
    const r = file ? f.offline(args) : f.call(args);
    assert.match(firstLine(r.out), CONTRACT, `${args.join(' ')}: ${r.out}${r.err}`);
    if (file) assert.match(firstLine(r.out), /^APPROXIMATE: .*may be incomplete/);
  }
});

test('unknown command exits 5 (not "still loading"); shell words and vault listing are refused', () => {
  assert.equal(obs(['frobnicate'], 'not-ready').code, 5);
  for (const op of ['grep', 'exec', 'cat', 'vaults']) assert.equal(obs([op, 'x'], 'ok').code, 5, op);
  assert.match(lastLine(obs(['vaults'], 'ok').err), /never list vaults/);
  assert.match(lastLine(obs(['eval', 'code=grep -r x'], 'ok').err), /obs --find/);
});

test('a note path is accepted without path=, quoted or not', () => {
  assert.deepEqual(JSON.parse(obs(['read', 'sub/a b.md'], 'args').out).slice(1), ['read', 'path=sub/a b.md']);
  assert.deepEqual(JSON.parse(obs(['outline', 'sub/a', 'b.md', 'format=json'], 'args').out).slice(1), ['outline', 'path=sub/a b.md', 'format=json']);
  assert.deepEqual(JSON.parse(obs(['backlinks', 'a.md', 'total'], 'args').out).slice(1), ['backlinks', 'path=a.md', 'total']);
});

test('--allow-unsafe cannot unlock eval, dev:* or raw rename/move', () => {
  assert.equal(obs(['eval', 'code=1', '--allow-unsafe'], 'ok').code, 7);
  assert.equal(obs(['dev:cdp', 'method=x', '--allow-unsafe'], 'ok').code, 7);
  assert.equal(obs(['rename', 'path=a.md', 'name=b', '--allow-unsafe'], 'ok').code, 5);
  assert.equal(obs(['move', 'path=a.md', 'to=b/', '--allow-unsafe'], 'ok').code, 5);
  assert.equal(obs(['plugin:install', 'id=x', '--allow-unsafe'], 'ok').code, 0); // still unlockable after user confirmation
});

test('--rename with alwaysUpdateLinks off: hard refusal, no rename call, even with --allow-unsafe', () => {
  const f = fixture();
  const r = f.call(['--rename', 'path=Target Note.md', 'name=Target Renamed', '--allow-unsafe'], { FAKE_LINKS: 'false' });
  assert.equal(r.code, 7);
  assert.match(firstLine(r.out), /^NOT DONE: alwaysUpdateLinks is false/);
  assert.match(lastLine(r.err), /^NEXT: tell the user: turn on .*Automatically update internal links.*do not retry/i);
  assert.ok(!f.cliCalls().some((a) => a.includes('rename')), 'rename never sent to the CLI');
  assert.ok(fs.existsSync(path.join(f.dir, 'Target Note.md')));
});

test('--rename: OK line with link counts, snapshot of the note and its referrers', () => {
  const f = fixture();
  const r = f.call(['--rename', 'Target Note.md', 'name=Target Renamed']);
  assert.equal(r.code, 0, r.err);
  assert.match(firstLine(r.out), /^OK: renamed Target Note\.md -> Target Renamed\.md; backlinks (\d+)->\1; unresolved 0->0; snapshot in \.trash\/obsidian-connect-snapshots\//);
  const snap = firstLine(r.out).match(/snapshot in (\S+)/)[1];
  assert.ok(fs.existsSync(path.join(f.dir, snap, 'Target Note.md')));
  assert.ok(fs.existsSync(path.join(f.dir, snap, 'refs', 'ref-wikilink.md')));
});

test('--rename in a git vault: also commits the pre-state, including unrelated pending edits', () => {
  const f = fixture();
  const git = (...a) => spawnSync('git', ['-C', f.dir, ...a], { encoding: 'utf8' });
  git('init', '-q'); git('add', '-A'); git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'base');
  fs.appendFileSync(path.join(f.dir, 'refs', 'ref-block.md'), 'pending edit\n');
  const r = f.call(['--rename', 'Target Note.md', 'name=Target Renamed']);
  assert.equal(r.code, 0, r.err);
  const sha = firstLine(r.out).match(/snapshot in \S+ \(git ([0-9a-f]+)\)/)[1];
  assert.match(git('log', '-1', '--format=%s', sha).stdout, /^obsidian-connect: snapshot before rename Target Note\.md/);
  assert.match(git('show', `${sha}:refs/ref-block.md`).stdout, /pending edit/);
  assert.equal(git('show', `${sha}:Target Note.md`).status, 0, 'the commit holds the note under its old name');
});

test('--trash: OK line, file in the vault .trash/', () => {
  const f = fixture();
  const r = f.call(['--trash', 'path=refs/ref-block.md']);
  assert.equal(r.code, 0, r.err);
  assert.match(firstLine(r.out), /^OK: moved refs\/ref-block\.md to \.trash\/ref-block\.md/);
  assert.ok(fs.existsSync(path.join(f.dir, '.trash', 'ref-block.md')));
});

test('--create: OK line; refuses an existing path', () => {
  const f = fixture();
  assert.match(firstLine(f.call(['--create', 'path=inbox/New.md', 'content=hello']).out), /^OK: created inbox\/New\.md/);
  const r = f.call(['--create', 'path=inbox/New.md', 'content=again']);
  assert.equal(r.code, 7);
  assert.match(firstLine(r.out), /^NOT DONE: exists/);
});

test('--preflight: OK, at most 5 lines, remembers the vault so OBS_VAULT is optional', () => {
  const f = fixture();
  const state = path.join(tmp, 'remember.json');
  const r = f.call(['--preflight'], { OBS_STATE: state });
  assert.equal(r.code, 0, r.err);
  assert.match(firstLine(r.out), new RegExp(`^OK: vault "test-vault" at ${f.dir.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`));
  assert.ok(r.out.trim().split('\n').length <= 5);
  const later = obs(['search', 'query=x'], 'args', { OBS_STATE: state, OBS_VAULT: '' });
  assert.equal(JSON.parse(later.out)[0], 'vault=test-vault');
  assert.equal(JSON.parse(obs(['search', 'query=x'], 'args', { OBS_STATE: state, OBS_VAULT: 'other' }).out)[0], 'vault=other', 'OBS_VAULT still wins');
});

test('--preflight with Obsidian closed: vault path from obsidian.json, only the selected vault is printed', () => {
  const f = fixture();
  const json = path.join(tmp, 'obsidian.json');
  fs.writeFileSync(json, JSON.stringify({ vaults: { a: { path: f.dir }, b: { path: '/private/Other Secret Vault' } } }));
  const r = obs(['--preflight', '--vault', path.basename(f.dir)], 'closed', { OBS_OBSIDIAN_JSON: json });
  assert.equal(r.code, 2);
  assert.match(firstLine(r.out), /^APPROXIMATE: Obsidian is not running/);
  assert.ok(r.out.includes(f.dir));
  assert.ok(!(r.out + r.err).includes('Other Secret Vault'), 'other vaults never printed');
  assert.match(lastLine(r.err), /^NEXT: Obsidian is not running; do not retry/);
});

test('--tasks-count: index count when Obsidian runs, APPROXIMATE from files when not', () => {
  const f = fixture();
  assert.match(f.call(['--tasks-count']).out, /^OK: \d+ open tasks in the whole vault/);
  const want = f.truth('tasks', f.dir).open;
  const r = obs(['--tasks-count'], 'closed', { OBS_VAULT_DIR: f.dir });
  assert.equal(r.code, 0);
  assert.equal(firstLine(r.out), `APPROXIMATE: ${want} open tasks in the whole vault. Obsidian is not running; read from files, so this may be incomplete`);
});

test('--find: quotes the phrase, adds the unaccented form, ranks name matches first', () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.dir, 'Da Nang trip.md'), 'Notes about Da Nang.\n');
  fs.writeFileSync(path.join(f.dir, 'Cam Nang.md'), 'Not the city.\n');
  const r = f.call(['--find', 'Đà Nẵng']);
  assert.equal(r.code, 0, r.err);
  assert.match(firstLine(r.out), /^OK: 2 note\(s\) match "Đà Nẵng" or "Da Nang", best first/);
  assert.match(r.out.split('\n')[1], /^Da Nang trip\.md  \(1 matching line, in the name\)/);
  assert.ok(!r.out.includes('Cam Nang'));
  const queries = f.cliCalls().filter((a) => a[1] === 'search:context').map((a) => a.find((x) => x.startsWith('query=')));
  assert.deepEqual(queries, ['query="Đà Nẵng"', 'query="Da Nang"']);
  const off = f.offline(['--find', 'Đà Nẵng']);
  assert.match(firstLine(off.out), /^APPROXIMATE: 2 note\(s\) match/);
  const none = f.call(['--find', 'zzzz nothing']);
  assert.equal(none.code, 0);
  assert.match(firstLine(none.out), /^OK: 0 notes match/);
  assert.match(lastLine(none.err), /^NEXT: /);
});

test('--backlinks in file mode: same files as the ground truth, alias-only links listed apart', () => {
  const f = fixture();
  const r = f.offline(['--backlinks', 'path=Target Note.md']);
  assert.equal(r.code, 0, r.err);
  const want = f.truth('backlinks', f.dir, 'Target Note.md').files.map((x) => x.file);
  assert.match(firstLine(r.out), new RegExp(`^APPROXIMATE: ${want.length} note\\(s\\) link to Target Note\\.md`));
  for (const w of want) assert.ok(r.out.includes(`\n${w}\n`), w);
  assert.ok(!r.out.includes('ref-code-block'));
  assert.match(r.out, /alias name.*refs\/ref-alias-name\.md/);
});

test('--prop-set: typed edit in the file, other lines unchanged, types.json untouched', () => {
  const f = fixture();
  const types = f.read('.obsidian/types.json');
  const P = 'path=props/Property Note.md';
  assert.match(f.call(['--prop-set', P, 'name=tags', 'add=next']).out, /^OK: tags = \[proj, fixture, next\] \(list\)/);
  assert.match(f.call(['--prop-set', P, 'name=rating', 'value=5']).out, /^OK: rating = 5 \(number\)/);
  assert.match(f.call(['--prop-set', P, 'name=tags', 'add=next']).out, /^OK: tags already .*nothing changed/);
  const y = f.truth('yaml', f.dir, 'props/Property Note.md');
  assert.deepEqual(y.values, { title: 'Quoted: value with colon', status: 'draft', created: '2026-01-15', due: '2026-02-01T09:30', rating: 5, done: false,
    tags: ['proj', 'fixture', 'next'], related: ['[[Target Note]]', 'plain item'] });
  assert.equal(f.read('.obsidian/types.json'), types);
  const bad = f.call(['--prop-set', P, 'name=done', 'value=maybe']);
  assert.equal(bad.code, 5);
  assert.match(firstLine(bad.out), /^NOT DONE: done is a checkbox property/);
  assert.match(f.call(['--prop-set', P, 'name=note', 'value=a: b']).out, /^OK: note = a: b \(text\)/);
  assert.equal(f.truth('yaml', f.dir, 'props/Property Note.md').values.note, 'a: b');
  assert.ok(!f.cliCalls().some((a) => a.includes('property:set')), 'never property:set');
});

test('--section-edit: shows numbered lines, replaces line n under a heading, keeps CRLF', () => {
  const f = fixture();
  const N = 'path=long/Long CRLF Note.md';
  const show = f.call(['--section-edit', N, 'heading=## Section 17']);
  assert.match(firstLine(show.out), /^OK: "## Section 17" has 97 lines below it/);
  assert.match(show.out.split('\n')[3], /^3 \| Line 3 of section 17: \w+ text\.$/);
  const r = f.call(['--section-edit', N, 'heading=## Section 17', 'line=3', 'text=Edited line.']);
  assert.equal(r.code, 0, r.err);
  assert.match(firstLine(r.out), /^OK: replaced line 3 under "## Section 17" \(file line \d+\): "Line 3 of section 17: .*" -> "Edited line\."; line endings kept \(CRLF\)/);
  const lines = f.read('long/Long CRLF Note.md').split('\r\n');
  assert.equal(lines[lines.indexOf('## Section 17') + 3], 'Edited line.');
  assert.deepEqual(f.truth('crlf', f.dir, 'long/Long CRLF Note.md'), { lines: 2974, crlf: 2974, lf: 0, mixed: false });
  const out = f.call(['--section-edit', N, 'heading=## Section 17', 'line=500', 'text=x']);
  assert.equal(out.code, 5);
  assert.match(lastLine(out.err), /^NEXT: show the section first/);
  assert.equal(f.call(['--section-edit', N, 'heading=## Nope']).code, 4);
});

test('--daily-append-once: creates through daily:append, never daily:read, never twice', () => {
  const f = fixture();
  const D = { FAKE_DAILY: 'daily/2026/10/2026-10-27.md' };
  const a = f.call(['--daily-append-once', 'content=- [ ] gọi ngân hàng'], D);
  assert.equal(a.code, 0, a.err);
  assert.match(firstLine(a.out), /^OK: created today's note daily\/2026\/10\/2026-10-27\.md/);
  const b = f.call(['--daily-append-once', 'content=- [ ] gọi ngân hàng'], D);
  assert.match(firstLine(b.out), /^OK: already in daily\/2026\/10\/2026-10-27\.md; not added again/);
  assert.equal(f.read(D.FAKE_DAILY).split('\n').filter((l) => l === '- [ ] gọi ngân hàng').length, 1);
  assert.ok(!f.cliCalls().some((x) => x.includes('daily:read')));
  // An existing empty note (left by an earlier daily:read): no blank first line.
  fs.writeFileSync(path.join(f.dir, '2026-10-28.md'), '');
  f.call(['--daily-append-once', 'content=- [ ] x'], { FAKE_DAILY: '2026-10-28.md' });
  assert.equal(f.read('2026-10-28.md'), '- [ ] x\n');
});

test('daily:read is guarded: no note is created when it does not exist', () => {
  const f = fixture();
  const r = f.call(['daily:read'], { FAKE_DAILY: '2026-10-29.md' });
  assert.equal(r.code, 4);
  assert.ok(!fs.existsSync(path.join(f.dir, '2026-10-29.md')));
  assert.match(lastLine(r.err), /^NEXT: .*--daily-append-once/);
});

test('--append: adds at the end with the note line endings; once skips a repeat', () => {
  const f = fixture();
  const r = f.call(['--append', 'path=refs/ref-wikilink.md', 'content=- added']);
  assert.match(firstLine(r.out), /^OK: added 1 line\(s\) at the end of refs\/ref-wikilink\.md/);
  assert.match(firstLine(f.call(['--append', 'path=refs/ref-wikilink.md', 'content=- added', 'once']).out), /^OK: already in/);
  assert.equal(f.read('refs/ref-wikilink.md'), 'Plain link: [[Target Note]]\n- added\n');
});

test('--tag-rename: dry run writes nothing; apply matches the ground truth and leaves #projects, nested and code alone', () => {
  const f = fixture();
  const before = f.read('tags/tag-body.md');
  const dry = f.call(['--tag-rename', 'from=proj', 'to=project/active']);
  assert.equal(dry.code, 0);
  assert.match(firstLine(dry.out), /^NOT DONE: dry run, nothing written yet\. Would make 4 change\(s\) in 4 file\(s\)/);
  assert.match(lastLine(dry.err), /^NEXT: show this list to the user; after they say yes run: obs --tag-rename from=proj to=project\/active apply/);
  assert.equal(f.read('tags/tag-body.md'), before);
  const r = f.call(['--tag-rename', 'from=#proj', 'to=project/active', 'apply']);
  assert.match(firstLine(r.out), /^OK: renamed #proj to #project\/active: 4 change\(s\) in 4 file\(s\).*0 left outside code; snapshot in /);
  const old = f.truth('tags', f.dir, 'proj'), neu = f.truth('tags', f.dir, 'project/active'), keep = f.truth('tags', f.dir, 'projects');
  assert.deepEqual([old.body, old.frontmatter, neu.body, neu.frontmatter, keep.body], [0, 0, 2, 2, 2]);
  assert.match(f.read('tags/tag-body.md'), /#proj\/sub/);
  assert.match(f.read('tags/tag-code.md'), /#proj inside code/);
});

test('loop breaker: the same failing call three times ends with STOP', () => {
  const state = path.join(tmp, 'loop.json');
  const run = () => obs(['read', 'path=x.md'], 'error', { OBS_STATE: state });
  run(); run();
  assert.match(lastLine(run().err), /^NEXT: STOP: same error 3 times/);
  obs(['search', 'query=x'], 'ok', { OBS_STATE: state });
  assert.doesNotMatch(lastLine(run().err), /STOP/);
});
