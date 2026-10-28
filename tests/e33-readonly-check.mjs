#!/usr/bin/env node
// E3.3a read-only check: 10 read-only questions answered through the bridge on ONE test vault, each compared with a
// ground truth computed from the vault files alone (no Obsidian). Re-runnable. It never writes to the vault.
//
// Usage: node tests/e33-readonly-check.mjs --vault <name> [--word <w>] [--tag <t>] [--backlinks-note <p.md>]
//        [--props-note <p.md>] [--outline-note <p.md>]
//   --vault  required; a test vault open in Obsidian. The probe items (word, note, tag) are picked from the files
//            by a fixed rule unless given. Nothing real is named in this file.
// Read-only: only commands in READ_ONLY_COMMANDS go through the bridge (checked in code); the vault is fingerprinted
// before and after (every file except .obsidian/ and .git/: path, size, mtime; plus git HEAD and status when the vault
// is a git work tree) and the run fails if anything changed.
// Guard: refuses unless `vault info=path` ends in one of ALLOWED_VAULTS (the three test vaults). There is no bypass.
// Exit 0 = 10/10 correct (known-benign differences are printed as "pass (benign: ...)"); 1 = a question failed or the
// vault changed; 2 = refused or could not run.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOWED_VAULTS, isAllowedVault, vaultNameOf, listFiles, readText } from './e35-write-check.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const bridge = path.join(here, '..', 'skills', 'obsidian-connect', 'scripts', 'obs.mjs');

// The only bridge commands this script may run. Everything here only reads (`daily:read` through the bridge checks
// first and creates nothing; `--preflight` only stores the vault name in the bridge's state file).
export const READ_ONLY_COMMANDS = new Set(['--preflight', 'vault', '--find', '--backlinks', '--tasks-count', 'tag', 'tags', 'properties', 'outline',
  'unresolved', 'orphans', 'daily:path', 'daily:read', 'recents', 'read']);
export function assertReadOnly(args) {
  if (!READ_ONLY_COMMANDS.has(args[0])) throw new Error(`read-only guard: "${args[0]}" is not an allowed command`);
}

// ---------- file-based helpers (pure) ----------
const nl = (t) => String(t).replace(/\r\n?/g, '\n');
// Lines outside fenced code blocks, as [lineNo (1-based), text]. A fence opens with ``` or ~~~ and closes with the same char.
export function bodyLines(text) {
  const out = []; let fence = null;
  nl(text).split('\n').forEach((l, i) => {
    const m = l.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) { if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null; return; }
    if (m) { fence = m[1]; return; }
    out.push([i + 1, l]);
  });
  return out;
}
const noInlineCode = (l) => l.replace(/`[^`]*`/g, '');
// Frontmatter block text, or null.
export function frontmatterOf(text) {
  const m = nl(text).match(/^---\n([\s\S]*?)\n---(\n|$)/);
  return m ? m[1] : null;
}
// Open tasks: `- [ ]` (also * and +, and numbered `1. [ ]`: Obsidian counts those too) outside code fences, frontmatter excluded. Known to differ from Obsidian only in edge cases.
export function countOpenTasks(text) {
  const fm = frontmatterOf(text);
  const skip = fm === null ? 0 : fm.split('\n').length + 2;
  return bodyLines(text).filter(([n, l]) => n > skip && /^\s*([-*+]|\d+[.)])\s+\[ \]/.test(l)).length;
}
// ATX headings outside fences: [{level, heading, line}].
export function headingsOf(text) {
  return bodyLines(text).flatMap(([line, l]) => {
    const m = l.match(/^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/);
    return m && m[2] !== '' ? [{ level: m[1].length, heading: m[2].trim(), line }] : [];
  });
}
// Simple frontmatter parser: `key: scalar`, `key:` + `- item` lines, `key: [a, b]`. Returns null when a line is outside that subset.
export function parseProps(text) {
  const fm = frontmatterOf(text);
  if (fm === null) return null;
  const unq = (s) => s.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  const out = {}; let key = null;
  for (const l of fm.split('\n')) {
    let m;
    if ((m = l.match(/^([A-Za-z0-9_-]+):\s*(.*)$/))) {
      key = m[1];
      const v = m[2].trim();
      if (v === '') out[key] = [];
      else if (/^\[.*\]$/.test(v)) out[key] = v.slice(1, -1).split(',').map(unq).filter((x) => x !== '');
      else if (/^[|>{]/.test(v)) return null;
      else out[key] = unq(v);
    } else if ((m = l.match(/^\s+-\s+(.*)$/)) && key && Array.isArray(out[key])) out[key].push(unq(m[1]));
    else if (l.trim() !== '') return null;
  }
  return out;
}
// Wikilink and embed targets in a note (outside code): path without alias, heading or block part, and without .md.
export const SELF = '\0self';
export function linkTargets(text) {
  const out = [];
  for (const [, l0] of bodyLines(text)) {
    const l = noInlineCode(l0);
    for (const m of l.matchAll(/!?\[\[([^\]]+?)\]\]/g)) {
      const [raw, ...alias] = m[1].split('|');
      let t = raw.split('#')[0];
      if (alias.length) t = t.replace(/\\+$/, ''); // `\|` is an escaped pipe inside a table; Obsidian drops them
      t = t.trim();
      if (t) out.push(t); else if (raw.includes('#')) out.push(SELF); // [[#Heading]] links to the note itself
    }
  }
  return out;
}
// Markdown links `[x](target)` pointing inside the vault (not URLs): decoded, anchor removed.
export function mdLinkTargets(text) {
  const out = [];
  for (const [, l0] of bodyLines(text)) {
    // `[x](dest)` or `[x](<dest with spaces>)`; a bare destination with spaces or unbalanced parentheses is not a link
    for (const m of noInlineCode(l0).matchAll(/(?<!\\)!?\[[^\]]*(?<!\\)\]\(\s*(?:<([^>]+)>|([^\s()]*(?:\([^\s()]*\)[^\s()]*)*))\s*(?:"[^"]*")?\)/g)) {
      let t = m[1] ?? m[2];
      if (!t || /^[a-z][a-z0-9+.-]*:/i.test(t) || t.startsWith('//')) continue;
      t = t.split('#')[0];
      if (!t) { out.push(SELF); continue; }
      try { t = decodeURIComponent(t); } catch { /* keep raw */ }
      if (t) out.push(t);
    }
  }
  return out;
}
// Resolve a link target the way Obsidian does for the common cases: a full vault path (with or without .md), a path
// relative to the linking note, or a unique/any basename match. Returns the vault file path or null.
const ATTACHMENT = /\.(png|jpe?g|gif|svg|webp|bmp|avif|pdf|mp3|wav|m4a|ogg|mp4|webm|mov|mkv|base|canvas|excalidraw)$/i;
// Among same-named files, the one sharing the longest folder prefix with the linking note (then the shortest path).
function nearest(c, from) {
  const common = (f) => { const a = f.split('/'), b = from.split('/'); let i = 0; while (i < a.length - 1 && i < b.length - 1 && a[i] === b[i]) i++; return i; };
  return c.slice().sort((x, y) => common(y) - common(x) || x.length - y.length || (x < y ? -1 : 1))[0] || null;
}
export function resolveLink(target, from, idx) {
  if (target === SELF) return from;
  const explicitRel = /^\.{1,2}\//.test(target); // ./x and ../x are relative to the linking note only
  const t = target.replace(/^\//, '');
  const rel = path.posix.normalize(path.posix.join(path.posix.dirname(from), t));
  const plain = ATTACHMENT.test(t); // `x.jpg` never resolves to `x.jpg.md`
  const md = (x) => (plain ? [x] : [x, `${x}.md`]);
  for (const c of explicitRel ? md(rel) : [...md(t), ...md(rel)]) { const hit = idx.lower.get(path.posix.normalize(c).toLowerCase()); if (hit) return hit; }
  if (explicitRel) return null;
  const tl = t.toLowerCase();
  if (!tl.includes('/')) { const c = md(tl).flatMap((x) => idx.byBase.get(x) || []); return nearest(c, from); }
  // a path with folders matches any file whose path ends with it (Obsidian's shortest-path form)
  for (const c of md(tl)) { const hit = (idx.byBase.get(path.posix.basename(c)) || []).find((f) => f.toLowerCase().endsWith(`/${c}`)); if (hit) return hit; }
  return null;
}
export function indexFiles(files) {
  const byBase = new Map(), lower = new Map();
  for (const f of files) { const b = path.posix.basename(f).toLowerCase(); (byBase.get(b) || byBase.set(b, []).get(b)).push(f); lower.set(f.toLowerCase(), f); }
  return { files, byBase, lower };
}
// Notes that link to `target` (a .md path): wikilinks, embeds and markdown links, outside code. `texts`: Map path -> text.
export function linkersOf(target, texts, idx) {
  const out = [];
  for (const [p, t] of texts) {
    if (!p.endsWith('.md')) continue; // a note that links to itself counts (Obsidian lists it among its own backlinks)
    const hit = [...linkTargets(t), ...mdLinkTargets(t)].some((x) => resolveLink(x, p, idx) === target);
    if (hit) out.push(p);
  }
  return out.sort();
}
// Files without any incoming link from a note (the Obsidian definition of an orphan): every non-hidden vault file.
export function orphansOf(files, texts, idx, canvases = new Map()) {
  const linked = new Set();
  for (const [p, t] of canvases) { // file nodes of a .canvas count as incoming links
    let nodes = []; try { nodes = JSON.parse(t).nodes || []; } catch { /* unreadable canvas: no links */ }
    for (const n of nodes) if (n.type === 'file' && typeof n.file === 'string') { const r = resolveLink(n.file.replace(/#.*$/, ''), p, idx); if (r) linked.add(r); }
  }
  for (const [p, t] of texts) {
    if (!p.endsWith('.md')) continue;
    for (const x of [...linkTargets(t), ...mdLinkTargets(t)]) { const r = resolveLink(x, p, idx); if (r) linked.add(r); }
  }
  return files.filter((f) => !linked.has(f)).sort();
}
// Wikilink targets (distinct) that match no vault file.
export function unresolvedWikilinks(texts, idx) {
  const out = new Set();
  for (const [p, t] of texts) {
    if (!p.endsWith('.md')) continue;
    for (const x of linkTargets(t)) if (!resolveLink(x, p, idx)) out.add(x);
  }
  return [...out].sort();
}
// Occurrences of #tag (word boundary, nested children excluded) in the body outside code, plus frontmatter `tags`.
export function tagNotes(text, tag) {
  const re = new RegExp(`(^|[^\\w/&#])#${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w/-])`, 'gi'); // tags are case-insensitive
  const body = bodyLines(text).map(([, l]) => noInlineCode(l)).join('\n');
  const fm = parseProps(text);
  const inFm = fm && Array.isArray(fm.tags) ? fm.tags.filter((x) => x.replace(/^#/, '').toLowerCase() === tag.toLowerCase()).length : (fm && typeof fm.tags === 'string' ? fm.tags.split(/[,\s]+/).filter((x) => x.replace(/^#/, '').toLowerCase() === tag.toLowerCase()).length : 0);
  const fmText = frontmatterOf(text);
  const bodyOnly = fmText === null ? body : bodyLines(text).filter(([n]) => n > fmText.split('\n').length + 2).map(([, l]) => noInlineCode(l)).join('\n');
  return { occurrences: (bodyOnly.match(re) || []).length + inFm, inFrontmatter: inFm };
}
// Notes whose text or file name contains `word` as a whole word, case-insensitive (what `--find` and Obsidian search do:
// "abandon" does not match "abandoned").
export function wordNotes(files, texts, word) {
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu');
  return files.filter((f) => f.endsWith('.md') && !f.startsWith('.') && (re.test(path.posix.basename(f)) || re.test(nl(texts.get(f) || '')))).sort();
}

// ---------- parsing of bridge output ----------
const firstOkLine = (s) => s.split('\n').find((l) => l.startsWith('OK:')) || '';
export function parseFind(out) {
  const m = out.match(/^OK: (\d+) note\(s\) match/m);
  const notes = out.split('\n').filter((l) => /  \(\d+ matching lines?[,)]/.test(l)).map((l) => l.replace(/  \(\d+ matching lines?.*$/, ''));
  return m ? { count: Number(m[1]), notes } : null;
}
export function parseBacklinks(out) {
  const m = out.match(/^OK: (\d+) note\(s\) link to /m);
  if (!m) return /No backlinks|NOT DONE|^obs: 4/m.test(out) ? { count: 0, notes: [] } : null;
  return { count: Number(m[1]), notes: out.split('\n').slice(1).filter((l) => l.endsWith('.md')).sort() };
}
export function parseOpenTasks(out) { const m = out.match(/^OK: (\d+) open tasks/m); return m ? Number(m[1]) : null; }
export function listLines(out) { return out.split('\n').map((l) => l.trim()).filter(Boolean); }

// ---------- comparison logic (pure; each returns {ok, benign?, detail}) ----------
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const diff = (a, b) => ({ onlyBridge: a.filter((x) => !b.includes(x)), onlyFiles: b.filter((x) => !a.includes(x)) });
const short = (a) => a.slice(0, 3).join(' | ') + (a.length > 3 ? ` (+${a.length - 3})` : '');

export function cmpFind(bridge, files) {
  if (!bridge) return { ok: false, detail: 'bridge output has no "N note(s) match" line' };
  const d = diff(bridge.notes, files);
  if (bridge.count === files.length && !d.onlyBridge.length && !d.onlyFiles.length) return { ok: true, detail: `${files.length} notes, same set as the file search` };
  return { ok: false, detail: `bridge ${bridge.count} notes, files ${files.length}; only bridge: ${short(d.onlyBridge)}; only files: ${short(d.onlyFiles)}` };
}
export function cmpBacklinks(bridge, files) {
  if (!bridge) return { ok: false, detail: 'bridge output not understood' };
  const d = diff(bridge.notes, files);
  if (!d.onlyBridge.length && !d.onlyFiles.length && bridge.count === files.length) return { ok: true, detail: `${files.length} linking notes, same set` };
  if (!d.onlyBridge.length && d.onlyFiles.length) return { ok: false, detail: `bridge misses ${short(d.onlyFiles)} (bridge ${bridge.count}, files ${files.length})` };
  return { ok: false, detail: `bridge lists notes the file scan does not find: ${short(d.onlyBridge)} (bridge ${bridge.count}, files ${files.length})` };
}
export function cmpTasks(bridgeCount, fileCount) {
  if (bridgeCount === null) return { ok: false, detail: 'bridge output has no task count' };
  if (bridgeCount === fileCount) return { ok: true, detail: `${fileCount} open tasks` };
  return { ok: false, detail: `bridge ${bridgeCount}, files ${fileCount}` };
}
export function cmpTag(bridgeTotal, c) {
  if (Number.isNaN(bridgeTotal)) return { ok: false, detail: 'bridge gave no number' };
  if (bridgeTotal === c.occurrences) return { ok: true, detail: `${c.occurrences} occurrences of the tag (body and frontmatter)` };
  return { ok: false, detail: `bridge ${bridgeTotal}, files ${c.occurrences} occurrences` };
}
export function cmpProps(bridgeJson, fileProps) {
  let b; try { b = JSON.parse(bridgeJson); } catch { return { ok: false, detail: 'bridge did not return JSON' }; }
  const bad = [];
  for (const k of new Set([...Object.keys(b), ...Object.keys(fileProps)])) {
    const x = b[k], y = fileProps[k];
    const norm = (v) => (Array.isArray(v) ? v.map(String) : v === undefined ? undefined : String(v));
    if (JSON.stringify(norm(x)) !== JSON.stringify(norm(y))) bad.push(`${k}: bridge ${JSON.stringify(x)} vs file ${JSON.stringify(y)}`);
  }
  return bad.length ? { ok: false, detail: short(bad) } : { ok: true, detail: `${Object.keys(fileProps).length} properties equal (numbers and booleans compared as text)` };
}
export function cmpOutline(bridgeJson, heads) {
  let b; try { b = JSON.parse(bridgeJson); } catch { return { ok: false, detail: 'bridge did not return JSON' }; }
  const bad = [];
  if (b.length !== heads.length) bad.push(`count bridge ${b.length}, files ${heads.length}`);
  heads.forEach((h, i) => { const x = b[i]; if (!x || x.level !== h.level || x.line !== h.line || x.heading !== h.heading) bad.push(`#${i + 1}: bridge ${JSON.stringify(x)} vs file ${JSON.stringify(h)}`); });
  return bad.length ? { ok: false, detail: short(bad) } : { ok: true, detail: `${heads.length} headings: level, text and line equal` };
}
// `unresolved` lists link targets Obsidian could not resolve; it also lists markdown-link and URL-like targets. So: the
// total equals the list length (self-consistency), no listed wikilink target exists as a file, and every wikilink target
// the file scan finds missing is in the list. Extra bridge entries of other link kinds are benign.
export function cmpUnresolved(total, list, wikiMissing, idx) {
  const bad = [];
  if (total !== list.length) bad.push(`total ${total} but the list has ${list.length} entries`);
  const norm = (s) => s.replace(/^\.\//, '').replace(/\.md$/, '');
  const listed = new Set(list.map(norm));
  const missed = wikiMissing.filter((x) => !listed.has(norm(x)));
  if (missed.length) bad.push(`file scan finds unresolved wikilinks the bridge does not list: ${short(missed)}`);
  const exist = list.filter((x) => resolveLink(x, '', idx));
  if (exist.length) bad.push(`listed as unresolved but the file exists: ${short(exist)}`);
  if (bad.length) return { ok: false, detail: bad.join('; ') };
  const extra = list.length - wikiMissing.length;
  return { ok: true, benign: extra > 0 ? `${extra} of ${list.length} entries are markdown links or URL-like targets, not wikilinks (the file scan counts wikilinks only)` : undefined, detail: `total ${total} = list length; ${wikiMissing.length} unresolved wikilinks all listed` };
}
// Notes (.md) must match exactly. Attachments (images, pdf, docx...) are compared too, but a difference there is only
// reported: Obsidian's link resolution for escaped characters and same-named files cannot be rebuilt exactly from the files.
export function cmpOrphans(total, list, fileOrphans) {
  const bad = [];
  if (total !== list.length) bad.push(`total ${total} but the list has ${list.length} entries`);
  const notes = (a) => a.filter((x) => x.endsWith('.md')), other = (a) => a.filter((x) => !x.endsWith('.md'));
  const dn = diff(notes(list), notes(fileOrphans)), da = diff(other(list), other(fileOrphans));
  if (dn.onlyBridge.length || dn.onlyFiles.length) bad.push(`orphan notes differ. only bridge: ${short(dn.onlyBridge)} (${dn.onlyBridge.length}); only files: ${short(dn.onlyFiles)} (${dn.onlyFiles.length})`);
  if (bad.length) return { ok: false, detail: bad.join('; ') };
  const nAtt = da.onlyBridge.length + da.onlyFiles.length;
  return { ok: true, benign: nAtt ? `attachment orphans differ for ${nAtt} of ${other(list).length} files (bridge-only ${da.onlyBridge.length}, files-only ${da.onlyFiles.length}); links with escaped characters or same-named files resolve differently in Obsidian` : undefined, detail: `${notes(list).length} orphan notes, same set; total ${total} = list length` };
}
export function cmpDaily(bridgeRes, dailyRel, existsOnDisk, diskText) {
  if (!existsOnDisk) return bridgeRes.code === 4 && /does not exist/.test(bridgeRes.err + bridgeRes.out)
    ? { ok: true, detail: `today's note (${dailyRel}) does not exist; the bridge said so and created nothing` }
    : { ok: false, detail: `file absent but bridge answered code ${bridgeRes.code}: ${bridgeRes.out.slice(0, 60)}` };
  const same = nl(bridgeRes.out).trim() === nl(diskText).trim();
  return same ? { ok: true, detail: `daily note ${dailyRel} read back equal (${nl(diskText).length} chars)` } : { ok: false, detail: `daily:read differs from the file ${dailyRel}` };
}
export function cmpRead(bridgeOut, diskText) {
  return nl(bridgeOut).trim() === nl(diskText).trim() ? { ok: true, detail: `${nl(diskText).length} chars equal` } : { ok: false, detail: 'read output differs from the file' };
}
export function cmpRecents(list, lastOpen) {
  const want = lastOpen.slice(0, list.length);
  if (JSON.stringify(list) === JSON.stringify(lastOpen.slice(0, 10)) || JSON.stringify(list) === JSON.stringify(want)) return { ok: true, detail: `${list.length} recent files, same order as workspace.json lastOpenFiles` };
  if (sameSet(list, want)) return { ok: true, benign: 'same files, different order', detail: `${list.length} files` };
  return { ok: false, detail: `bridge ${short(list)} vs workspace.json ${short(want)}` };
}

// ---------- probe picking (fixed rules, deterministic) ----------
const ASCII_WORD = /^[a-z]{6,12}$/;
// A word found in 5..25 notes (document frequency), alphabetical first.
export function pickWord(texts) {
  const df = new Map();
  for (const [p, t] of texts) {
    if (!p.endsWith('.md') || p.startsWith('_') || p.startsWith('.')) continue;
    for (const w of new Set(nl(t).toLowerCase().match(/[a-z]{6,12}/g) || [])) df.set(w, (df.get(w) || 0) + 1);
  }
  return [...df].filter(([w, n]) => ASCII_WORD.test(w) && n >= 5 && n <= 25).map(([w]) => w).sort()[0] || null;
}
export function pickBacklinkNote(texts, idx) {
  const cnt = new Map();
  for (const [p, t] of texts) {
    if (!p.endsWith('.md')) continue;
    for (const x of new Set([...linkTargets(t), ...mdLinkTargets(t)])) { const r = resolveLink(x, p, idx); if (r && r.endsWith('.md')) cnt.set(r, (cnt.get(r) || new Set()).add(p)); }
  }
  return [...cnt].filter(([r, s]) => s.size >= 2 && s.size <= 8 && idx.byBase.get(path.posix.basename(r).toLowerCase()).length === 1 && !r.startsWith('_')).map(([r]) => r).sort()[0] || null;
}
export function pickPropsNote(texts) {
  return [...texts].filter(([p]) => p.endsWith('.md') && !p.startsWith('_') && !p.startsWith('.')).map(([p, t]) => [p, parseProps(t)]).filter(([, o]) => o && Object.keys(o).length >= 2).map(([p]) => p).sort()[0] || null;
}
export function pickOutlineNote(texts) {
  return [...texts].filter(([p]) => p.endsWith('.md') && !p.startsWith('_') && !p.startsWith('.')).filter(([, t]) => { const h = headingsOf(t); return h.length >= 4 && h.length <= 30 && h.every((x) => /^[\p{L}\p{N} .,:'-]+$/u.test(x.heading)); }).map(([p]) => p).sort()[0] || null;
}
export function pickTag(counts, texts) {
  const cand = counts.map((c) => ({ tag: c.tag.replace(/^#/, ''), count: Number(c.count) })).filter((c) => c.count >= 3 && c.count <= 30 && /^[A-Za-z][\w-]*$/.test(c.tag)).map((c) => c.tag).sort();
  return cand.find((t) => ![...texts].some(([p, x]) => p.endsWith('.md') && new RegExp(`#${t}/`).test(x))) || null; // no nested children
}

// ---------- fingerprint (no-write proof) ----------
export function fingerprint(vaultPath, files) {
  const root = rootOf(vaultPath), fp = {};
  for (const f of files) {
    if (f.startsWith('.obsidian/') || f.startsWith('.git/')) continue;
    try { const s = fs.statSync(path.join(root, ...f.split('/'))); fp[f] = `${s.size}:${Math.floor(s.mtimeMs)}`; } catch { fp[f] = 'gone'; }
  }
  const git = (...a) => spawnSync('git', ['-C', root, ...a], { encoding: 'utf8' });
  const head = git('rev-parse', 'HEAD'), st = git('status', '--short');
  return { head: head.status === 0 ? head.stdout.trim() : null, status: st.status === 0 ? st.stdout.trim() : null, files: fp };
}
export function sameFingerprint(a, b) {
  const keys = new Set([...Object.keys(a.files), ...Object.keys(b.files)]);
  const changed = [...keys].filter((k) => a.files[k] !== b.files[k]);
  return { same: a.head === b.head && a.status === b.status && !changed.length, changed, head: a.head === b.head, status: a.status === b.status };
}
function rootOf(vaultPath) {
  if (/^[A-Za-z]:[\\/]/.test(vaultPath)) { const w = spawnSync('wslpath', ['-u', vaultPath], { encoding: 'utf8' }); if (w.status === 0) return w.stdout.trim(); }
  return vaultPath;
}

export const visible = (f) => !f.split('/').some((seg) => seg.startsWith('.')); // Obsidian ignores dot folders and dot files at any depth

// ---------- runner ----------
function obs(vault, args) {
  assertReadOnly(args);
  const r = spawnSync(process.execPath, [bridge, ...args], { encoding: 'utf8', env: { ...process.env, OBS_VAULT: vault }, maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

function parseArgs(argv) {
  const o = {};
  const keys = { '--vault': 'vault', '--word': 'word', '--tag': 'tag', '--backlinks-note': 'blNote', '--props-note': 'propsNote', '--outline-note': 'outlineNote' };
  for (let i = 0; i < argv.length; i++) { if (keys[argv[i]]) o[keys[argv[i]]] = argv[++i]; else { console.error(`unknown argument ${argv[i]}`); process.exit(2); } }
  if (!o.vault) { console.error('usage: node tests/e33-readonly-check.mjs --vault <name> [--word <w>] [--tag <t>] [--backlinks-note <p.md>] [--props-note <p.md>] [--outline-note <p.md>]'); process.exit(2); }
  return o;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (!ALLOWED_VAULTS.includes(o.vault)) { console.error(`REFUSED: --vault "${o.vault}" is not one of the test vaults (${ALLOWED_VAULTS.join(', ')}). Nothing was run.`); return 2; }
  const pf = obs(o.vault, ['--preflight', '--vault', o.vault]);
  if (pf.code !== 0 && /still loading|NEXT:.*wait/i.test(pf.out + pf.err)) await new Promise((r) => setTimeout(r, 5000));
  const vp = obs(o.vault, ['vault', 'info=path']);
  if (vp.code !== 0 || !isAllowedVault(vp.out)) { console.error(`REFUSED: \`vault info=path\` gave "${vp.out.slice(0, 80)}", which is not a test vault. Nothing was run.`); return 2; }
  const vaultPath = vp.out.split(/\r?\n/)[0].trim();
  console.log(`vault ok: ${vaultNameOf(vaultPath)}`);

  let files;
  try { files = listFiles(vaultPath).filter(visible).sort(); } catch (e) { console.error(`cannot list the vault folder: ${e.message}`); return 2; }
  const before = fingerprint(vaultPath, files);
  const texts = new Map();
  for (const f of files) if (f.endsWith('.md')) texts.set(f, readText(vaultPath, f));
  const idx = indexFiles(files);
  const canvases = new Map();
  for (const f of files) if (f.endsWith('.canvas')) canvases.set(f, readText(vaultPath, f));
  console.log(`${files.length} files, ${texts.size} notes read from disk`);

  const results = [];
  const record = (n, name, cmd, r) => {
    results.push({ n, ...r });
    console.log(`${String(n).padStart(2)}/10 ${name.padEnd(15)} ${r.ok ? (r.benign ? 'PASS (benign difference)' : 'PASS') : 'FAIL'}  [${cmd}]  ${r.detail}${r.benign ? `\n      benign: ${r.benign}` : ''}`);
  };
  const need = (n, name, what) => { results.push({ n, ok: false }); console.log(`${String(n).padStart(2)}/10 ${name.padEnd(15)} FAIL  could not pick ${what} from the vault; pass it as an argument`); };

  // 1 search
  const word = o.word || pickWord(texts);
  if (!word) need(1, 'search', 'a word'); else {
    const r = obs(o.vault, ['--find', word]);
    record(1, 'search', '--find', cmpFind(parseFind(r.out), wordNotes(files, texts, word)));
  }
  // 2 backlinks
  const bl = o.blNote || pickBacklinkNote(texts, idx);
  if (!bl) need(2, 'backlinks', 'a note with 2-8 linking notes'); else {
    const r = obs(o.vault, ['--backlinks', `path=${bl}`]);
    record(2, 'backlinks', '--backlinks', cmpBacklinks(parseBacklinks(r.out + '\n' + r.err), linkersOf(bl, texts, idx)));
  }
  // 3 count open tasks
  {
    const r = obs(o.vault, ['--tasks-count']);
    record(3, 'count tasks', '--tasks-count', cmpTasks(parseOpenTasks(r.out), [...texts.values()].reduce((s, t) => s + countOpenTasks(t), 0)));
  }
  // 4 tags
  {
    const tj = obs(o.vault, ['tags', 'counts', 'sort=count', 'format=json']);
    let counts = []; try { counts = JSON.parse(tj.out); } catch { /* reported below */ }
    const tag = o.tag || pickTag(counts, texts);
    if (!tag) need(4, 'tags', 'a tag');
    else {
      const r = obs(o.vault, ['tag', `name=${tag}`, 'total']);
      const fileCount = [...texts.values()].reduce((s, t) => s + tagNotes(t, tag).occurrences, 0);
      record(4, 'tags', 'tag name= total', cmpTag(Number(r.out), { occurrences: fileCount }));
    }
  }
  // 5 properties
  const pn = o.propsNote || pickPropsNote(texts);
  if (!pn) need(5, 'properties', 'a note with properties'); else {
    const r = obs(o.vault, ['properties', `path=${pn}`, 'format=json']);
    record(5, 'properties', 'properties', cmpProps(r.out, parseProps(texts.get(pn))));
  }
  // 6 outline
  const on = o.outlineNote || pickOutlineNote(texts);
  if (!on) need(6, 'outline', 'a note with 4+ headings'); else {
    const r = obs(o.vault, ['outline', `path=${on}`, 'format=json']);
    record(6, 'outline', 'outline', cmpOutline(r.out, headingsOf(texts.get(on))));
  }
  // 7 unresolved links
  {
    const t = obs(o.vault, ['unresolved', 'total']), l = obs(o.vault, ['unresolved']);
    record(7, 'unresolved', 'unresolved', cmpUnresolved(Number(t.out), l.code === 0 ? listLines(l.out) : [], unresolvedWikilinks(texts, idx), idx));
  }
  // 8 daily note read (and a read of an existing note by path)
  {
    const dp = obs(o.vault, ['daily:path']).out.split(/\r?\n/)[0].trim();
    const exists = files.includes(dp);
    const d = obs(o.vault, ['daily:read']);
    let res = cmpDaily(d, dp, exists, exists ? texts.get(dp) : '');
    if (res.ok && !exists) {
      const any = [...texts].filter(([p, t]) => /^\d{4}-\d{2}-\d{2}\.md$/.test(path.posix.basename(p)) && nl(t).trim()).map(([p]) => p).sort()[0] || pn;
      const rr = any ? obs(o.vault, ['read', `path=${any}`]) : null;
      const c = rr ? cmpRead(rr.out, texts.get(any)) : { ok: false, detail: 'no note to read' };
      res = c.ok ? { ok: true, benign: "today's daily note does not exist; the existing-note read (read path=) was compared instead", detail: `${res.detail}; ${c.detail}` } : c;
    }
    record(8, 'daily note', 'daily:read, read', res);
  }
  // 9 orphans
  {
    const t = obs(o.vault, ['orphans', 'total']), l = obs(o.vault, ['orphans']);
    record(9, 'orphan notes', 'orphans', cmpOrphans(Number(t.out), l.code === 0 ? listLines(l.out) : [], orphansOf(files, texts, idx, canvases)));
  }
  // 10 recent files
  {
    const r = obs(o.vault, ['recents']);
    let last = [];
    try { last = JSON.parse(readText(vaultPath, '.obsidian/workspace.json')).lastOpenFiles || []; } catch { /* reported by the comparison */ }
    record(10, 'recent files', 'recents', cmpRecents(listLines(r.out), last));
  }

  // no-write proof
  const after = fingerprint(vaultPath, listFiles(vaultPath).filter(visible).sort());
  const s = sameFingerprint(before, after);
  console.log(`vault unchanged: ${s.same ? 'yes' : 'NO'} (git HEAD ${s.head ? 'same' : 'DIFFERENT'}, git status ${s.status ? 'same' : 'DIFFERENT'}${before.head === null ? ', not a git repo' : ''}, ${Object.keys(before.files).length} files fingerprinted${s.changed.length ? `, changed: ${s.changed.slice(0, 5).join(', ')}` : ''})`);
  const good = results.filter((r) => r.ok).length;
  console.log(`${good}/10 answers correct`);
  const pass = good === 10 && s.same;
  console.log(pass ? 'E3.3 CHECK PASS' : 'E3.3 CHECK FAIL');
  return pass ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main();
