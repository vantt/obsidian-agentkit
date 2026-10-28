#!/usr/bin/env node
// E3.6a rehearsal of the bulk operations (rename note, move note, rename tag) on ONE test vault, then a reset.
// Re-runnable. Fixtures are created by the script under _agentkit-lab/e36/ and removed again; no other note is touched.
//
// Usage: node tests/e36-bulk-rehearsal.mjs --vault <name> [--wait <seconds>] [--index-timeout <seconds>]
//   --vault          required; the vault must be open in Obsidian and be a git work tree with a clean tree
//   --wait           seconds to wait after the final `obs reload` (default 45; 0 = none)
//   --index-timeout  seconds to wait for Obsidian's index to settle after each step (default 60)
// Per operation: (1) preview first and check the vault did not change (tag rename: the bridge's own dry run; rename and
// move have no dry-run mode in the bridge, so the preview is `--backlinks`, the list of notes Obsidian will rewrite),
// (2) run it for real, (3) `unresolved total` unchanged and the referring notes updated, (4) the git snapshot the bridge
// took before the change exists (commit "obsidian-connect: snapshot before ..." holding the pre-state).
// Finally: git reset --hard to the starting commit, git clean of the fixture and snapshot folders, `git status` empty,
// `obs reload`, wait, `unresolved total` back to its starting value.
// Guard: refuses unless `vault info=path` ends in one of ALLOWED_VAULTS (reused from e35-write-check.mjs).
// Exit 0 = every check passed and the vault is clean; 1 = a check failed; 2 = refused or could not run.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOWED_VAULTS, isAllowedVault, vaultNameOf } from './e35-write-check.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const bridge = path.join(here, '..', 'skills', 'obsidian-connect', 'scripts', 'obs.mjs');

export const LAB = '_agentkit-lab/e36';
export const SNAP_DIR = '.trash/obsidian-connect-snapshots';
export const TAG_OLD = 'e36oldtag', TAG_NEW = 'e36newtag';
export const PLAN = {
  rename: { src: `${LAB}/E36 Rename Src.md`, name: 'E36 Rename Done', dest: `${LAB}/E36 Rename Done.md`, referrers: [`${LAB}/E36 Ref A.md`, `${LAB}/E36 Ref B.md`] },
  move: { src: `${LAB}/E36 Move Src.md`, to: `${LAB}/moved/`, dest: `${LAB}/moved/E36 Move Src.md`, referrers: [`${LAB}/E36 Ref A.md`, `${LAB}/E36 Ref B.md`] },
  tag: { files: [`${LAB}/E36 Tag 1.md`, `${LAB}/E36 Tag 2.md`] },
};

// Notes the script creates (path -> text). Every link and tag in them resolves, so `unresolved total` must not move.
export function fixtures() {
  return {
    [PLAN.rename.src]: '# E36 rename source\n\nA note to rename.\n',
    [PLAN.move.src]: '# E36 move source\n\nA note to move.\n',
    [`${LAB}/E36 Ref A.md`]: 'Plain: [[E36 Rename Src]], with alias: [[E36 Rename Src|shown alias]], other: [[E36 Move Src]].\n',
    [`${LAB}/E36 Ref B.md`]: `Full path: [[${LAB}/E36 Move Src]], with heading: [[E36 Rename Src#E36 rename source]].\n`,
    [PLAN.tag.files[0]]: `---\ntags:\n  - ${TAG_OLD}\n---\nBody tag #${TAG_OLD} here.\n`,
    [PLAN.tag.files[1]]: `Only a body tag #${TAG_OLD} and a code span \`#${TAG_OLD}\` stays.\n`,
  };
}

// ---------- pure checks (unit-tested offline) ----------
// Number from `unresolved total` / `backlinks total` output; the bridge's "empty" answer (no output) means 0.
export function parseTotal(out) { const m = String(out || '').trim().match(/^\d+/); return m ? Number(m[0]) : (String(out || '').trim() === '' ? 0 : NaN); }
// `(git <sha>)` at the end of the bridge's OK line.
export function parseSnapshot(line) {
  const m = String(line || '').match(/snapshot in (\S+\/)(?: \(git ([0-9a-f]{4,40})\))?/);
  return m ? { dir: m[1], sha: m[2] || null } : null;
}
// A referrer after a rename/move: the old target is gone from its links, the new one is there.
export function linksUpdated(text, oldName, newName) {
  return !text.includes(`[[${oldName}`) && text.includes(`[[${newName}`);
}
// The old full-path link (rename of folder part) is gone and the note is still linked.
export function pathLinkMoved(text, oldPath, baseName) {
  return !text.includes(`[[${oldPath.replace(/\.md$/, '')}`) && text.includes(`${baseName}]]`);
}
export function isDryRun(out) { return /NOT DONE: dry run/.test(out) && /nothing written/i.test(out); }
export function mentionsAll(out, items) { return items.every((i) => out.includes(i)); }
// Vault state before/after a dry run: HEAD, `git status --porcelain` and a hash per file (all must be identical).
export function sameState(a, b) {
  return a.head === b.head && a.status === b.status && JSON.stringify(a.files) === JSON.stringify(b.files);
}
export function snapshotSubject(s) { return /^obsidian-connect: snapshot before /.test(s); }

// ---------- plumbing ----------
function obs(vault, args) {
  const r = spawnSync(process.execPath, [bridge, ...args], { encoding: 'utf8', env: { ...process.env, OBS_VAULT: vault }, timeout: 240000 });
  return { code: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function toLocal(p) {
  if (/^[A-Za-z]:[\\/]/.test(p)) { const w = spawnSync('wslpath', ['-u', p], { encoding: 'utf8' }); if (w.status === 0) return w.stdout.trim(); }
  return p;
}
const git = (root, ...a) => { const r = spawnSync('git', ['-C', root, ...a], { encoding: 'utf8', timeout: 120000 }); return { code: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }; };
const rd = (root, rel) => fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8');
const wr = (root, rel, text) => { const f = path.join(root, ...rel.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
function stateOf(root) {
  const files = {};
  const walk = (rel) => {
    const d = path.join(root, ...(rel ? rel.split('/') : []));
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(r); else files[r] = crypto.createHash('sha1').update(fs.readFileSync(path.join(root, ...r.split('/')))).digest('hex');
    }
  };
  walk('_agentkit-lab');
  return { head: git(root, 'rev-parse', 'HEAD').out, status: git(root, 'status', '--porcelain').out, files };
}

async function settle(vault, want, timeoutS) { // poll `unresolved total` until it equals `want`
  const end = Date.now() + timeoutS * 1000;
  let got;
  do { got = parseTotal(obs(vault, ['unresolved', 'total']).out); if (got === want) return got; await sleep(2000); } while (Date.now() < end);
  return got;
}

export function parseArgs(argv) {
  const o = { wait: 45, indexTimeout: 60 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--vault') o.vault = argv[++i];
    else if (k === '--wait') o.wait = Number(argv[++i]);
    else if (k === '--index-timeout') o.indexTimeout = Number(argv[++i]);
    else { console.error(`unknown argument ${k}`); process.exit(2); }
  }
  if (!o.vault || !Number.isFinite(o.wait) || !Number.isFinite(o.indexTimeout)) { console.error('usage: node tests/e36-bulk-rehearsal.mjs --vault <name> [--wait <seconds>] [--index-timeout <seconds>]'); process.exit(2); }
  return o;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (!ALLOWED_VAULTS.includes(o.vault)) { console.error(`REFUSED: --vault "${o.vault}" is not one of the test vaults (${ALLOWED_VAULTS.join(', ')}). Nothing was written.`); return 2; }
  const pf = obs(o.vault, ['--preflight', '--vault', o.vault]);
  if (pf.code !== 0 && /still loading|NEXT:.*wait/i.test(pf.out + pf.err)) await sleep(5000);
  const vp = obs(o.vault, ['vault', 'info=path']);
  if (vp.code !== 0 || !isAllowedVault(vp.out)) { console.error(`REFUSED: \`vault info=path\` gave "${vp.out.slice(0, 80)}", which is not a test vault. Nothing was written.`); return 2; }
  const root = toLocal(vp.out.split(/\r?\n/)[0].trim());
  if (!fs.existsSync(root)) { console.error('REFUSED: the vault folder is not readable from here. Nothing was written.'); return 2; }
  if (git(root, 'rev-parse', '--is-inside-work-tree').out !== 'true') { console.error('REFUSED: the vault is not a git work tree (needed for the snapshot check and the reset). Nothing was written.'); return 2; }
  const topPath = git(root, 'rev-parse', '--show-toplevel').out;
  if (path.resolve(topPath) !== path.resolve(root)) { console.error('REFUSED: the git work tree is not the vault folder itself. Nothing was written.'); return 2; }
  if (git(root, 'status', '--porcelain').out) { console.error('REFUSED: the vault has uncommitted changes; reset it first. Nothing was written.'); return 2; }
  const startHead = git(root, 'rev-parse', 'HEAD').out;
  console.log(`vault ok: ${vaultNameOf(vp.out)}; start commit ${startHead.slice(0, 8)}`);

  const checks = [];
  const check = (name, ok, detail = '') => { checks.push(ok); console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`); return ok; };
  const unres0 = parseTotal(obs(o.vault, ['unresolved', 'total']).out);
  console.log(`unresolved total at start: ${unres0}`);
  let aborted = null;

  try {
    // Fixtures, then wait until Obsidian has indexed them.
    for (const [rel, text] of Object.entries(fixtures())) wr(root, rel, text);
    const idxEnd = Date.now() + o.indexTimeout * 1000;
    let indexed = false;
    do { indexed = mentionsAll(obs(o.vault, ['backlinks', `path=${PLAN.rename.src}`]).out, PLAN.rename.referrers); if (indexed) break; await sleep(2000); } while (Date.now() < idxEnd);
    check('fixtures indexed by Obsidian (both referrers listed as backlinks of the rename source)', indexed);
    if (!indexed) throw new Error('Obsidian did not index the fixtures in time');
    const unresBase = await settle(o.vault, unres0, o.indexTimeout);
    check('fixtures add no unresolved link', unresBase === unres0, `${unres0} -> ${unresBase}`);

    // ----- rename / move -----
    for (const op of ['rename', 'move']) {
      const p = PLAN[op];
      console.log(`\n== ${op} note ==`);
      const before = stateOf(root);
      const u0 = parseTotal(obs(o.vault, ['unresolved', 'total']).out);
      const prev = obs(o.vault, ['--backlinks', `path=${p.src}`]);
      check(`${op} preview lists the notes that will be rewritten`, prev.code === 0 && mentionsAll(prev.out, p.referrers), `${p.referrers.length} expected`);
      check(`${op} preview changed nothing`, sameState(before, stateOf(root)));
      const args = op === 'rename' ? ['--rename', `path=${p.src}`, `name=${p.name}`] : ['--move', `path=${p.src}`, `to=${p.to}`];
      const r = obs(o.vault, args);
      console.log(`  bridge: ${r.out.split('\n')[0] || r.err.split('\n')[0]}`);
      if (!check(`${op} ran for real`, r.code === 0 && /^OK/m.test(r.out))) throw new Error(`${op} failed`);
      check(`${op}: old file gone, new file there`, !fs.existsSync(path.join(root, ...p.src.split('/'))) && fs.existsSync(path.join(root, ...p.dest.split('/'))));
      const u1 = await settle(o.vault, u0, o.indexTimeout);
      check(`${op}: unresolved total unchanged`, u1 === u0, `${u0} -> ${u1}`);
      const refsOk = p.referrers.every((f) => (op === 'rename'
        ? linksUpdated(rd(root, f), 'E36 Rename Src', 'E36 Rename Done')
        : pathLinkMoved(rd(root, f), `${LAB}/E36 Move Src`, 'E36 Move Src') || !rd(root, f).includes('E36 Move Src')));
      check(`${op}: links in referring notes updated`, refsOk);
      checkSnapshot(root, r.out, op === 'rename' ? { path: p.src, has: '# E36 rename source' } : { path: p.src, has: '# E36 move source' }, check, `snapshot before ${op} ${p.src}`);
    }

    // ----- tag rename -----
    {
      console.log('\n== rename tag ==');
      const before = stateOf(root);
      const u0 = parseTotal(obs(o.vault, ['unresolved', 'total']).out);
      const dry = obs(o.vault, ['--tag-rename', `from=${TAG_OLD}`, `to=${TAG_NEW}`]);
      check('tag dry run printed the list and wrote nothing', dry.code === 0 && isDryRun(dry.out) && mentionsAll(dry.out, PLAN.tag.files));
      check('tag dry run changed nothing', sameState(before, stateOf(root)));
      const r = obs(o.vault, ['--tag-rename', `from=${TAG_OLD}`, `to=${TAG_NEW}`, 'apply']);
      console.log(`  bridge: ${r.out.split('\n')[0] || r.err.split('\n')[0]}`);
      if (!check('tag rename ran for real', r.code === 0 && /^OK: renamed/m.test(r.out))) throw new Error('tag rename failed');
      const texts = PLAN.tag.files.map((f) => rd(root, f));
      check('tag: new tag in both notes, old tag only in the code span', texts.every((t) => t.includes(`#${TAG_NEW}`) || t.includes(`- ${TAG_NEW}`))
        && texts.every((t) => t.replace(/`[^`]*`/g, '').split(TAG_OLD).length === 1) && texts[1].includes(`\`#${TAG_OLD}\``));
      const u1 = await settle(o.vault, u0, o.indexTimeout);
      check('tag: unresolved total unchanged', u1 === u0, `${u0} -> ${u1}`);
      checkSnapshot(root, r.out, { path: PLAN.tag.files[0], has: `- ${TAG_OLD}` }, check, `snapshot before tag rename #${TAG_OLD} -> #${TAG_NEW}`);
    }
  } catch (e) {
    aborted = e.message; console.error(`ABORTED: ${aborted}`);
  } finally {
    // ----- reset (destructive git only here, inside the allowlisted test vault, on named paths) -----
    console.log('\n== reset ==');
    git(root, 'reset', '-q', '--hard', startHead);
    git(root, 'clean', '-fdq', '--', LAB, SNAP_DIR);
    const clean = git(root, 'status', '--porcelain').out === '' && git(root, 'rev-parse', 'HEAD').out === startHead;
    check('git status empty and HEAD back at the start commit', clean, clean ? '' : git(root, 'status', '--short').out.split('\n').slice(0, 5).join('; '));
    obs(o.vault, ['reload']);
    if (o.wait > 0) { console.log(`waiting ${o.wait} s after obs reload...`); await sleep(o.wait * 1000); }
    const uEnd = await settle(o.vault, unres0, o.indexTimeout);
    check('unresolved total back to the start value after reload', uEnd === unres0, `${unres0} -> ${uEnd}`);
  }
  const ok = !aborted && checks.every(Boolean);
  console.log(`\n${checks.filter(Boolean).length}/${checks.length} checks passed`);
  console.log(ok ? 'E3.6a REHEARSAL PASS' : 'E3.6a REHEARSAL FAIL');
  return ok ? 0 : 1;
}

// The bridge's OK line names the snapshot: a folder of copies plus a git commit holding the pre-state.
function checkSnapshot(root, out, pre, check, subjectPart) {
  const snap = parseSnapshot(out);
  check('snapshot reported in the OK line', !!snap && !!snap.sha, snap ? `git ${snap.sha || 'none'}` : 'no snapshot text');
  if (!snap) return;
  check('snapshot folder exists with the copy of the note', fs.existsSync(path.join(root, ...snap.dir.split('/'), ...pre.path.split('/'))));
  if (!snap.sha) return;
  const type = git(root, 'cat-file', '-t', snap.sha).out;
  const subject = git(root, 'log', '-1', '--format=%s', snap.sha).out;
  check('snapshot commit exists', type === 'commit' && snapshotSubject(subject) && subject.includes(subjectPart), subject.slice(0, 70));
  const old = git(root, 'show', `${snap.sha}:${pre.path}`);
  check('snapshot commit holds the pre-state of the note', old.code === 0 && old.out.includes(pre.has));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main();
