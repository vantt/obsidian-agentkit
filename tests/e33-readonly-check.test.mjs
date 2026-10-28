// Guard and comparison logic of tests/e33-readonly-check.mjs, offline (fake CLI). Run: node --test tests/e33-readonly-check.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as m from './e33-readonly-check.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, 'e33-readonly-check.mjs');
const fake = path.join(here, 'fake-obsidian.mjs');
fs.chmodSync(fake, 0o755);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'e33-'));

test('read-only guard: only read commands may run', () => {
  for (const c of ['--find', '--backlinks', '--tasks-count', 'tags', 'tag', 'properties', 'outline', 'unresolved', 'orphans', 'daily:path', 'daily:read', 'recents', 'read', 'vault', '--preflight']) assert.doesNotThrow(() => m.assertReadOnly([c]), c);
  for (const c of ['--append', '--prop-set', '--create', '--rename', '--move', '--trash', '--tag-rename', '--daily-append-once', '--section-edit', 'create', 'delete', 'eval', 'daily:append', 'property:set', 'reload', '']) assert.throws(() => m.assertReadOnly([c]), /not an allowed command/, c);
});

test('guard: refuses a vault that is not a test vault, and a CLI vault path that is not one', () => {
  let r = spawnSync(process.execPath, [script, '--vault', 'Real Notes'], { encoding: 'utf8' });
  assert.equal(r.status, 2); assert.match(r.stderr, /REFUSED/);
  const dir = path.join(fs.mkdtempSync(path.join(tmp, 'v-')), 'my-real-vault');
  fs.mkdirSync(dir);
  r = spawnSync(process.execPath, [script, '--vault', 'vault-copy'], { encoding: 'utf8', env: { ...process.env, OBS_CLI: fake, FAKE_MODE: 'vault', FAKE_VAULT: dir, OBS_STATE: path.join(tmp, 's.json') } });
  assert.equal(r.status, 2); assert.match(r.stderr, /not a test vault/);
  assert.ok(!/OK|PASS/.test(r.stdout));
  r = spawnSync(process.execPath, [script, '--vault', 'vault-copy', '--allow-readonly-any'], { encoding: 'utf8' });
  assert.equal(r.status, 2); assert.match(r.stderr, /unknown argument/); // no bypass flag
});

test('tasks, headings, properties, code fences', () => {
  const t = '---\ntags: [a]\n---\n- [ ] one\n  * [ ] two\n1. [ ] three\n- [x] done\n- [/] doing\n```\n- [ ] in code\n```\ntext - [ ] not a task\n';
  assert.equal(m.countOpenTasks(t), 3);
  assert.deepEqual(m.headingsOf('# A\r\ntext\r\n```\n# not\n```\n## B ##\n#tag\n'), [{ level: 1, heading: 'A', line: 1 }, { level: 2, heading: 'B', line: 6 }]);
  assert.deepEqual(m.parseProps('---\ntitle: "x: y"\nn: 4\nl:\n  - a\n  - "b"\ni: [p, q]\n---\nbody'), { title: 'x: y', n: '4', l: ['a', 'b'], i: ['p', 'q'] });
  assert.equal(m.parseProps('---\nk: |\n  multi\n---\n'), null);
  assert.equal(m.parseProps('no frontmatter'), null);
});

test('links: wikilink forms, escaped pipe, markdown links, self links, case-insensitive resolution', () => {
  assert.deepEqual(m.linkTargets('[[A]] [[B|alias]] [[C#Head]] ![[D.png|100]] [[E\\|alias]] `[[no]]`\n```\n[[no2]]\n```'), ['A', 'B', 'C', 'D.png', 'E']);
  assert.deepEqual(m.linkTargets('[[#Heading]]'), [m.SELF]);
  assert.deepEqual(m.mdLinkTargets('[x](a%20b.md) [y](https://e.com) [z](<c d.md>) [w](#h) \\[esc\\](#no) [p](bad space.md)'), ['a b.md', 'c d.md', m.SELF]);
  const files = ['n/Target.md', 'n/Src.md', 'other/Src2.md', 'img/pic.png', 'img/pic.png.md'];
  const idx = m.indexFiles(files);
  assert.equal(m.resolveLink('target', 'x.md', idx), 'n/Target.md');
  assert.equal(m.resolveLink('n/Target', 'x.md', idx), 'n/Target.md');
  assert.equal(m.resolveLink('./Target.md', 'n/Src.md', idx), 'n/Target.md');
  assert.equal(m.resolveLink('./Target.md', 'other/Src2.md', idx), null); // explicit relative stays relative
  assert.equal(m.resolveLink('pic.png', 'x.md', idx), 'img/pic.png'); // never pic.png.md
  assert.equal(m.resolveLink('nope', 'x.md', idx), null);
  const texts = new Map([['n/Src.md', 'see [[Target]] and [[#H]]'], ['other/Src2.md', '[Target](../n/Target.md)'], ['n/Target.md', '![](pic.png)']]);
  assert.deepEqual(m.linkersOf('n/Target.md', texts, idx), ['n/Src.md', 'other/Src2.md']);
  assert.deepEqual(m.linkersOf('n/Src.md', texts, idx), ['n/Src.md']); // a self link counts
  const canvas = new Map([['c.canvas', JSON.stringify({ nodes: [{ type: 'file', file: 'other/Src2.md' }, { type: 'text', text: 'x' }] })]]);
  assert.deepEqual(m.orphansOf(files, texts, idx, canvas), ['img/pic.png.md']); // Src.md links to itself, which counts
  assert.deepEqual(m.unresolvedWikilinks(new Map([['a.md', '[[Target]] [[Ghost]] [[Ghost2|x]]']]), idx), ['Ghost', 'Ghost2']);
});

test('tags and words', () => {
  const t = '---\ntags:\n  - Proj\n---\n#proj and #proj/child and #projects and `#proj` and x#proj\n```\n#proj\n```\n#PROJ';
  assert.deepEqual(m.tagNotes(t, 'proj'), { occurrences: 3, inFrontmatter: 1 }); // fm + #proj + #PROJ
  const texts = new Map([['a.md', 'An abandon here'], ['b.md', 'abandoned only'], ['Abandon x.md', ''], ['c.png', 'abandon']]);
  assert.deepEqual(m.wordNotes([...texts.keys()], texts, 'abandon'), ['Abandon x.md', 'a.md']);
});

test('parsers of bridge output', () => {
  assert.deepEqual(m.parseFind('OK: 2 note(s) match "x", best first\nA/b.md  (3 matching lines, in the name)\nc.md  (1 matching line)\n'), { count: 2, notes: ['A/b.md', 'c.md'] });
  assert.equal(m.parseFind('NOT DONE'), null);
  assert.deepEqual(m.parseBacklinks('OK: 2 note(s) link to x.md (Obsidian index)\nb.md\na.md\n'), { count: 2, notes: ['a.md', 'b.md'] });
  assert.deepEqual(m.parseBacklinks('NOT DONE: backlinks: No backlinks found.\nobs: 4'), { count: 0, notes: [] });
  assert.equal(m.parseOpenTasks('OK: 114 open tasks in the whole vault'), 114);
  assert.equal(m.parseOpenTasks('NOT DONE'), null);
});

test('comparisons report real differences and accept benign ones', () => {
  assert.ok(m.cmpFind({ count: 1, notes: ['a.md'] }, ['a.md']).ok);
  assert.ok(!m.cmpFind({ count: 1, notes: ['a.md'] }, ['a.md', 'b.md']).ok);
  assert.ok(!m.cmpFind({ count: 1, notes: ['z.md'] }, ['a.md']).ok);
  assert.ok(!m.cmpFind(null, []).ok);
  assert.ok(m.cmpBacklinks({ count: 1, notes: ['a.md'] }, ['a.md']).ok);
  assert.match(m.cmpBacklinks({ count: 0, notes: [] }, ['a.md']).detail, /misses a\.md/);
  assert.ok(m.cmpTasks(5, 5).ok && !m.cmpTasks(5, 6).ok && !m.cmpTasks(null, 0).ok);
  assert.ok(m.cmpTag(4, { occurrences: 4 }).ok && !m.cmpTag(4, { occurrences: 3 }).ok && !m.cmpTag(NaN, { occurrences: 3 }).ok);
  assert.ok(m.cmpProps('{"a":5,"b":["x"],"c":false}', { a: '5', b: ['x'], c: 'false' }).ok);
  assert.ok(!m.cmpProps('{"a":5}', { a: '6' }).ok && !m.cmpProps('{"a":5}', { a: '5', z: '1' }).ok && !m.cmpProps('nope', {}).ok);
  const h = [{ level: 1, heading: 'A', line: 1 }];
  assert.ok(m.cmpOutline(JSON.stringify(h), h).ok && !m.cmpOutline(JSON.stringify([{ ...h[0], line: 2 }]), h).ok && !m.cmpOutline('[]', h).ok);
  const idx = m.indexFiles(['a.md']);
  assert.ok(m.cmpUnresolved(2, ['Ghost', 'https://x'], ['Ghost'], idx).benign);
  assert.ok(!m.cmpUnresolved(3, ['Ghost', 'x'], ['Ghost'], idx).ok); // total != list length
  assert.ok(!m.cmpUnresolved(1, ['a'], [], idx).ok); // listed but exists
  assert.ok(!m.cmpUnresolved(0, [], ['Ghost'], idx).ok); // bridge misses a missing link
  assert.ok(m.cmpOrphans(2, ['a.md', 'p.png'], ['a.md', 'p.png']).ok);
  assert.ok(m.cmpOrphans(2, ['a.md', 'p.png'], ['a.md']).benign);
  assert.ok(!m.cmpOrphans(2, ['a.md', 'b.md'], ['a.md']).ok && !m.cmpOrphans(3, ['a.md'], ['a.md']).ok);
  assert.ok(m.cmpDaily({ code: 4, out: '', err: "today's daily note x.md does not exist yet" }, 'x.md', false, '').ok);
  assert.ok(!m.cmpDaily({ code: 0, out: 'created', err: '' }, 'x.md', false, '').ok);
  assert.ok(m.cmpDaily({ code: 0, out: 'a\r\nb\n', err: '' }, 'x.md', true, 'a\nb').ok && !m.cmpDaily({ code: 0, out: 'a', err: '' }, 'x.md', true, 'b').ok);
  assert.ok(m.cmpRead('x\r\n', 'x\n').ok && !m.cmpRead('x', 'y').ok);
  assert.ok(m.cmpRecents(['a', 'b'], ['a', 'b', 'c']).ok && m.cmpRecents(['b', 'a'], ['a', 'b']).benign && !m.cmpRecents(['z'], ['a']).ok);
});

test('probe picking is deterministic and generic', () => {
  const texts = new Map();
  for (let i = 0; i < 6; i++) texts.set(`n${i}.md`, 'zebrafish common');
  texts.set('rare.md', 'unicorn');
  assert.equal(m.pickWord(texts), 'common'); // alphabetical first among words in 5..25 notes
  assert.equal(m.pickPropsNote(new Map([['a.md', 'x'], ['b.md', '---\na: 1\nb: 2\n---\n']])), 'b.md');
  assert.equal(m.pickOutlineNote(new Map([['a.md', '# A\n## B\n### C\n#### D\n']])), 'a.md');
  assert.equal(m.pickTag([{ tag: '#few', count: '1' }, { tag: '#mid', count: '5' }, { tag: '#par', count: '6' }], new Map([['a.md', '#par/child']])), 'mid');
});

test('fingerprint detects a changed file, a new file and a git change', () => {
  const dir = fs.mkdtempSync(path.join(tmp, 'fp-'));
  fs.writeFileSync(path.join(dir, 'a.md'), 'x');
  const a = m.fingerprint(dir, ['a.md']);
  assert.equal(a.head, null);
  assert.ok(m.sameFingerprint(a, m.fingerprint(dir, ['a.md'])).same);
  fs.writeFileSync(path.join(dir, 'a.md'), 'xy');
  assert.deepEqual(m.sameFingerprint(a, m.fingerprint(dir, ['a.md'])).changed, ['a.md']);
  assert.ok(!m.sameFingerprint(a, { ...a, status: '?? new' }).same);
  assert.ok(m.visible('a/b.md') && !m.visible('vantt/.obsidian/app.json') && !m.visible('.git/x'));
});
