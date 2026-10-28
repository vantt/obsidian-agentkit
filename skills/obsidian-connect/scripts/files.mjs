// File-only helpers for the obsidian-connect bridge (obs.mjs). Node built-ins only, no Obsidian needed.
// Every edit keeps the note's line endings (CRLF stays CRLF, FINDINGS F10a), its BOM and its final newline.
// The rules mirror the file-only ground truth (obsidian-test-fixture `otf truth`): code blocks and inline code
// never count, dot folders (.obsidian, .trash, .git) are not notes, links by alias name do not resolve (F4e).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// ---------- text and lines ----------
export function splitText(text) {
  const bom = text.startsWith('﻿') ? '﻿' : '';
  const body = bom ? text.slice(1) : text;
  const eol = body.includes('\r\n') ? '\r\n' : '\n';
  const lines = body.split(/\r?\n/);
  const finalEol = lines.length > 1 && lines[lines.length - 1] === '';
  if (finalEol) lines.pop();
  if (lines.length === 1 && lines[0] === '') lines.pop(); // empty file
  return { bom, eol, lines, finalEol };
}
export function joinText({ bom, eol, lines, finalEol }) {
  return bom + lines.join(eol) + (finalEol && lines.length ? eol : '');
}
export const readNote = (abs) => splitText(fs.readFileSync(abs, 'utf8'));
export const writeNote = (abs, doc) => fs.writeFileSync(abs, joinText(doc));

export const unaccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFC');

// Frontmatter: [start, end) line indexes of the YAML between the leading '---' lines, or null.
export function fmRange(lines) {
  if (lines[0] !== '---') return null;
  const end = lines.indexOf('---', 1);
  return end > 0 ? [1, end] : null;
}

// For each line: is it inside a fenced code block (or a fence line)? Frontmatter lines are never code.
export function codeMask(lines) {
  const mask = new Array(lines.length).fill(false);
  const fm = fmRange(lines);
  let fence = null;
  for (let i = fm ? fm[1] + 1 : 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*(`{3,}|~{3,})/);
    if (fence) { mask[i] = true; if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null; continue; }
    if (m) { fence = m[1]; mask[i] = true; }
  }
  return mask;
}
const blankInline = (l) => l.replace(/`[^`]*`/g, (s) => ' '.repeat(s.length));

// ---------- vault walk ----------
export function walkNotes(root, folder = '') {
  const out = [];
  const walk = (rel) => {
    let entries;
    try { entries = fs.readdirSync(path.join(root, ...rel.split('/').filter(Boolean)), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue; // not indexed by Obsidian
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(r);
      else if (e.name.endsWith('.md')) out.push(r);
    }
  };
  walk(folder.replace(/\/+$/, ''));
  return out.sort();
}
const abs = (root, rel) => path.join(root, ...rel.split('/'));

// ---------- find ----------
// Case-insensitive phrase search over every note, for each variant. Rank: name match, then matching lines.
export function findInFiles(root, variants, { folder = '', limit = 20 } = {}) {
  const vs = variants.map((v) => v.toLowerCase());
  const hits = [];
  for (const rel of walkNotes(root, folder)) {
    const { lines } = readNote(abs(root, rel));
    const n = lines.filter((l) => vs.some((v) => l.toLowerCase().includes(v))).length;
    const name = vs.some((v) => path.posix.basename(rel, '.md').toLowerCase().includes(v));
    if (n || name) hits.push({ path: rel, lines: n, name });
  }
  return rankHits(hits).slice(0, limit);
}
export const rankHits = (hits) => hits.sort((a, b) => (b.name - a.name) || (b.lines - a.lines) || a.path.localeCompare(b.path));

// ---------- tasks ----------
export function countTasks(root) {
  let open = 0, done = 0;
  for (const rel of walkNotes(root)) {
    const { lines } = readNote(abs(root, rel));
    const code = codeMask(lines);
    const fm = fmRange(lines);
    lines.forEach((l, i) => {
      if (code[i] || (fm && i <= fm[1])) return;
      const m = blankInline(l).match(/^\s*(?:[-*+]|\d+[.)])\s+\[(.)\]/);
      if (!m) return;
      if (m[1] === ' ') open++; else if (/[xX]/.test(m[1])) done++;
    });
  }
  return { open, done };
}

// ---------- links ----------
const WIKI = /!?\[\[([^\]|#^]*)(?:[#^][^\]|]*)?(?:\|[^\]]*)?\]\]/g;
const MDLINK = /\[[^\]]*\]\(([^)\s]+?\.md)(?:#[^)]*)?\)/g;

// Link targets of one note: body outside code, plus frontmatter values.
export function linkTargets(lines) {
  const code = codeMask(lines);
  const out = [];
  lines.forEach((l, i) => {
    if (code[i]) return;
    const t = blankInline(l);
    for (const m of t.matchAll(WIKI)) out.push({ kind: 'wiki', target: m[1].trim() });
    for (const m of t.matchAll(MDLINK)) {
      if (/^[a-z]+:\/\//i.test(m[1])) continue;
      try { out.push({ kind: 'md', target: decodeURIComponent(m[1]) }); } catch { out.push({ kind: 'md', target: m[1] }); }
    }
  });
  return out;
}

export function makeResolver(root, notes = walkNotes(root)) {
  const set = new Set(notes);
  const byBase = new Map();
  for (const n of notes) {
    const b = path.posix.basename(n, '.md').toLowerCase();
    if (!byBase.has(b)) byBase.set(b, []);
    byBase.get(b).push(n);
  }
  return (target, from) => {
    if (!target) return from;
    const t = target.replace(/\\/g, '/').replace(/^\//, '');
    for (const c of [t, t + '.md', path.posix.normalize(path.posix.join(path.posix.dirname(from), t))]) if (set.has(c)) return c;
    if (t.includes('/')) {
      const tail = (t.endsWith('.md') ? t : t + '.md').toLowerCase();
      const hit = notes.find((f) => f.toLowerCase() === tail || f.toLowerCase().endsWith('/' + tail));
      if (hit) return hit;
    }
    const hits = byBase.get(path.posix.basename(t, '.md').toLowerCase());
    return hits ? [...hits].sort((a, b) => a.split('/').length - b.split('/').length)[0] : null;
  };
}

// Notes linking to `target` (vault-relative), and notes that only link by one of its aliases (unresolved in Obsidian).
export function backlinksFromFiles(root, target) {
  const notes = walkNotes(root);
  const resolve = makeResolver(root, notes);
  const aliases = new Set((fmList(readNote(abs(root, target)).lines, 'aliases') || []).map((a) => a.toLowerCase()));
  const files = [], aliasOnly = [];
  for (const rel of notes) {
    if (rel === target) continue;
    const links = linkTargets(readNote(abs(root, rel)).lines);
    if (links.some((l) => resolve(l.target, rel) === target)) files.push(rel);
    else if (links.some((l) => l.kind === 'wiki' && aliases.has(l.target.toLowerCase()) && !resolve(l.target, rel))) aliasOnly.push(rel);
  }
  return { files, aliasOnly };
}

// ---------- frontmatter ----------
// The lines of one top-level key: [first, endExclusive) inside the frontmatter, or null.
export function keyBlock(lines, key) {
  const fm = fmRange(lines);
  if (!fm) return null;
  for (let i = fm[0]; i < fm[1]; i++) {
    if (!lines[i].startsWith(`${key}:`)) continue;
    let j = i + 1;
    while (j < fm[1] && (/^\s/.test(lines[j]) || lines[j] === '')) j++;
    while (j > i + 1 && lines[j - 1] === '') j--;
    return [i, j];
  }
  return null;
}
const unquote = (s) => {
  const t = s.trim();
  if (/^".*"$/.test(t)) { try { return JSON.parse(t); } catch { return t.slice(1, -1); } }
  if (/^'.*'$/.test(t)) return t.slice(1, -1).replace(/''/g, "'");
  return t;
};
const splitInline = (s) => (s.trim() === '' ? [] : s.split(',').map((x) => unquote(x)).filter((x) => x !== ''));

// Value of a key: { kind: 'list'|'scalar', items|value, style, quoted }.
export function readKey(lines, key) {
  const b = keyBlock(lines, key);
  if (!b) return null;
  let rest = lines[b[0]].slice(key.length + 1).trim();
  if (!/^["']/.test(rest)) rest = rest.replace(/\s+#.*$/, '');
  if (rest.startsWith('[')) return { kind: 'list', style: 'inline', items: splitInline(rest.replace(/^\[|\]$/g, '')) };
  if (rest === '') {
    const items = lines.slice(b[0] + 1, b[1]).map((l) => l.match(/^\s*-\s*(.*)$/)).filter(Boolean).map((m) => unquote(m[1]));
    return items.length || b[1] > b[0] + 1 ? { kind: 'list', style: 'block', items } : { kind: 'scalar', value: '' };
  }
  return { kind: 'scalar', value: unquote(rest), quoted: /^["']/.test(rest) };
}
export function fmList(lines, key) {
  const v = readKey(lines, key);
  if (!v) return null;
  return v.kind === 'list' ? v.items : splitInline(v.value);
}

const NUM = /^-?\d+(\.\d+)?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
const LIST_TYPES = new Set(['multitext', 'tags', 'aliases']);

// YAML scalar for a text value: quoted only when plain YAML would change it.
export function yamlText(v, forceQuote = false) {
  const plainUnsafe = v === '' || forceQuote || /^[\s\-?:,[\]{}#&*!|>'"%@`]/.test(v) || /\s$/.test(v) || /: |\s#/.test(v)
    || NUM.test(v) || /^(true|false|null|yes|no|on|off|~)$/i.test(v) || DATE.test(v) || DATETIME.test(v);
  return plainUnsafe ? JSON.stringify(v) : v;
}

export class EditError extends Error {}

// Set, add to, remove from, or unset one property. types = .obsidian/types.json "types" object.
// Returns { doc, type, shown } and never touches any other line.
export function propSet(doc, key, op, types = {}) {
  if (!/^[^\s:#][^:]*$/.test(key)) throw new EditError(`bad property name "${key}"`);
  const lines = [...doc.lines];
  let fm = fmRange(lines);
  const cur = readKey(lines, key);
  const declared = types[key];
  let type = declared || (cur?.kind === 'list' ? 'list' : cur?.kind === 'scalar'
    ? (cur.quoted ? 'text' : NUM.test(cur.value) ? 'number' : /^(true|false)$/.test(cur.value) ? 'checkbox' : DATETIME.test(cur.value) ? 'datetime' : DATE.test(cur.value) ? 'date' : 'text')
    : null);
  if (LIST_TYPES.has(type)) type = 'list';
  if (op.unset) {
    if (!cur) return { doc, type, shown: '(not set)', unchanged: true };
    const b = keyBlock(lines, key);
    lines.splice(b[0], b[1] - b[0]);
    return { doc: { ...doc, lines }, type, shown: '(removed)' };
  }
  if ((op.add !== undefined || op.remove !== undefined) && type && type !== 'list') throw new EditError(`${key} is a ${type} property, not a list; use value=`);
  if (op.add !== undefined || op.remove !== undefined) type = 'list';
  if (!type) { // new key, no declared type: infer from the value
    const v = op.value;
    type = /^\[.*\]$/.test(v.trim()) ? 'list' : NUM.test(v) ? 'number' : /^(true|false)$/.test(v) ? 'checkbox' : DATETIME.test(v) ? 'datetime' : DATE.test(v) ? 'date' : 'text';
  }

  let newBlock;
  if (type === 'list') {
    let items = cur?.kind === 'list' ? [...cur.items] : cur?.kind === 'scalar' && cur.value ? splitInline(cur.value) : [];
    if (op.add !== undefined) { if (items.includes(op.add)) return { doc, type, shown: `[${items.join(', ')}]`, unchanged: true }; items.push(op.add); }
    else if (op.remove !== undefined) { if (!items.includes(op.remove)) return { doc, type, shown: `[${items.join(', ')}]`, unchanged: true }; items = items.filter((x) => x !== op.remove); }
    else {
      const v = op.value.trim();
      if (v.startsWith('[')) { try { items = JSON.parse(v).map(String); } catch { items = splitInline(v.replace(/^\[|\]$/g, '')); } }
      else items = splitInline(v);
    }
    if (cur?.kind === 'list' && cur.style === 'block' && (op.add !== undefined || op.remove !== undefined)) {
      // Keep existing item lines byte for byte; add or drop only the one line.
      const b = keyBlock(lines, key);
      const block = lines.slice(b[0], b[1]);
      const itemLines = block.slice(1);
      const indent = (itemLines.find((l) => /^\s*-/.test(l)) || '  - ').match(/^(\s*)-/)[1];
      if (op.add !== undefined) newBlock = [...block, `${indent}- ${yamlText(op.add, /^\[\[/.test(op.add))}`];
      else newBlock = [block[0], ...itemLines.filter((l) => { const m = l.match(/^\s*-\s*(.*)$/); return !m || unquote(m[1]) !== op.remove; })];
    } else if (cur?.kind === 'list' && cur.style === 'inline') {
      newBlock = [`${key}: [${items.map((x) => yamlText(x, /^\[\[/.test(x))).join(', ')}]`];
    } else {
      newBlock = items.length ? [`${key}:`, ...items.map((x) => `  - ${yamlText(x, /^\[\[/.test(x))}`)] : [`${key}: []`];
    }
    return finish(`[${items.join(', ')}]`);
  }
  if (op.value === undefined) throw new EditError('give value=<v> (or add=/remove= for a list)');
  const v = op.value.trim();
  let out;
  if (type === 'number') { if (!NUM.test(v)) throw new EditError(`${key} is a number property; "${v}" is not a number`); out = v; }
  else if (type === 'checkbox') { if (!/^(true|false)$/i.test(v)) throw new EditError(`${key} is a checkbox property; use true or false`); out = v.toLowerCase(); }
  else if (type === 'date') { if (!DATE.test(v)) throw new EditError(`${key} is a date property; use YYYY-MM-DD`); out = v; }
  else if (type === 'datetime') { if (!DATETIME.test(v) && !DATE.test(v)) throw new EditError(`${key} is a datetime property; use YYYY-MM-DDTHH:mm`); out = v; }
  else out = yamlText(v, cur?.kind === 'scalar' && cur.quoted);
  newBlock = [`${key}: ${out}`];
  return finish(type === 'text' ? v : out);

  function finish(shown) {
    if (!fm) { lines.unshift('---', ...newBlock, '---'); fm = true; }
    else {
      const b = keyBlock(lines, key);
      if (b) lines.splice(b[0], b[1] - b[0], ...newBlock);
      else lines.splice(fmRange(lines)[1], 0, ...newBlock);
    }
    return { doc: { ...doc, lines, finalEol: doc.finalEol || doc.lines.length === 0 }, type, shown };
  }
}

// ---------- sections ----------
const headingText = (h) => h.replace(/^\s*#+\s*/, '').trim();
// Find a heading by its text (with or without the leading #). Returns { line, level, end } (0-based, end exclusive).
export function findSection(lines, heading, nth = null) {
  const want = headingText(heading);
  const wantLevel = (heading.trim().match(/^#+/) || [''])[0].length;
  const code = codeMask(lines);
  const fm = fmRange(lines);
  const all = [];
  lines.forEach((l, i) => {
    if (code[i] || (fm && i <= fm[1])) return;
    const m = l.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (m) all.push({ line: i, level: m[1].length, text: m[2] });
  });
  let hits = all.filter((h) => h.text === want && (!wantLevel || h.level === wantLevel));
  if (!hits.length) hits = all.filter((h) => h.text.toLowerCase() === want.toLowerCase());
  if (!hits.length) return { error: 'none', headings: all };
  if (hits.length > 1 && !nth) return { error: 'many', hits };
  const h = hits[(nth || 1) - 1];
  if (!h) return { error: 'many', hits };
  const next = all.find((x) => x.line > h.line && x.level <= h.level);
  return { line: h.line, level: h.level, text: h.text, end: next ? next.line : lines.length };
}

// ---------- tag rename ----------
const TAGCH = '[\\p{L}\\p{N}_\\-/]';
export const validTag = (t) => new RegExp(`^${TAGCH}+$`, 'u').test(t) && !/^\d+$/.test(t) && !t.startsWith('/') && !t.endsWith('/');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');

// Plan every change: body tags outside code, and frontmatter tags/tag lists. Nothing is written.
export function tagPlan(root, from, to, { nested = false, only = null } = {}) {
  const bodyRe = new RegExp(`(^|[\\s(])#(${esc(from)})(${nested ? '(?:/' + TAGCH + '*)?' : ''})(?!${nested ? '[\\p{L}\\p{N}_\\-]' : TAGCH})`, 'giu');
  const keptRe = new RegExp(`(^|[\\s(])#${esc(from)}/`, 'giu');
  const changes = [];
  let keptNested = 0;
  for (const rel of only || walkNotes(root)) {
    const doc = readNote(abs(root, rel));
    const { lines } = doc;
    const code = codeMask(lines);
    const fm = fmRange(lines);
    const newLines = [...lines];
    lines.forEach((l, i) => {
      if (fm && i >= fm[0] && i < fm[1]) return;
      if (code[i] || (fm && i === fm[1])) return;
      const masked = blankInline(l);
      let out = '', last = 0, n = 0;
      for (const m of masked.matchAll(bodyRe)) {
        const at = m.index + m[1].length; // position of '#'
        out += l.slice(last, at) + `#${to}${m[3] || ''}`;
        last = at + 1 + m[2].length + (m[3] || '').length;
        n++;
      }
      if (!nested) keptNested += [...masked.matchAll(keptRe)].length;
      if (n) { newLines[i] = out + l.slice(last); changes.push({ path: rel, line: i + 1, where: 'body', old: l.trim(), new: newLines[i].trim() }); }
    });
    if (fm) for (const key of ['tags', 'tag']) {
      const b = keyBlock(lines, key);
      if (!b) continue;
      const map = (item) => {
        const m = item.match(/^(\s*)(["']?)(#?)(.*?)\2(\s*)$/);
        if (!m) return item;
        const v = m[4];
        if (v.toLowerCase() === from.toLowerCase()) return `${m[1]}${m[2]}${m[3]}${to}${m[2]}${m[5]}`;
        if (v.toLowerCase().startsWith(from.toLowerCase() + '/')) {
          if (nested) return `${m[1]}${m[2]}${m[3]}${to}${v.slice(from.length)}${m[2]}${m[5]}`;
          keptNested++;
        }
        return item;
      };
      for (let i = b[0]; i < b[1]; i++) {
        const l = lines[i];
        let nl = l;
        if (i === b[0]) {
          const m = l.match(/^([^:]+:\s*)(.*?)(\s*)$/);
          if (m[2].startsWith('[')) nl = m[1] + '[' + m[2].replace(/^\[|\]$/g, '').split(',').map(map).join(',') + ']' + m[3];
          else if (m[2]) nl = m[1] + m[2].split(',').map(map).join(',') + m[3];
        } else {
          const m = l.match(/^(\s*-)(\s.*)$/);
          if (m) nl = m[1] + map(m[2]);
        }
        if (nl !== l) { newLines[i] = nl; changes.push({ path: rel, line: i + 1, where: 'frontmatter', old: l.trim(), new: nl.trim() }); }
      }
    }
    if (changes.some((c) => c.path === rel)) changes.push({ path: rel, doc: { ...doc, lines: newLines }, file: true });
  }
  const files = changes.filter((c) => c.file);
  return { changes: changes.filter((c) => !c.file), files, keptNested };
}

// ---------- snapshot and conflict copies ----------
export function snapshot(root, rels, op = 'edit') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = `.trash/obsidian-connect-snapshots/${stamp}`;
  for (const rel of rels) {
    const dst = abs(root, `${dir}/${rel}`);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(abs(root, rel), dst);
  }
  const sha = gitSnapshot(root, op);
  return dir + '/' + (sha ? ` (git ${sha})` : '');
}

// When the vault is a git work tree (a `.git` dir, or a `.git` file pointing outside a synced folder), commit the
// pre-state too, so a multi-file change can be undone in one step. A clean tree gives HEAD; no git gives null.
export function gitSnapshot(root, op) {
  if (!fs.existsSync(path.join(root, '.git'))) return null;
  const git = (...a) => spawnSync('git', ['-C', root, ...a], { encoding: 'utf8', timeout: 120000 });
  if (git('add', '-A').status !== 0) return null;
  if (git('diff', '--cached', '--quiet').status !== 0
    && git('-c', 'user.name=obsidian-connect', '-c', 'user.email=obsidian-connect@localhost', 'commit', '-q', '-m', `obsidian-connect: snapshot before ${op}`).status !== 0) return null;
  const head = git('rev-parse', '--short', 'HEAD');
  return head.status === 0 ? head.stdout.trim() : null;
}
export const conflictCopies = (root) => walkNotes(root).filter((r) => /conflict|\s\(\d+\)\.md$/i.test(path.posix.basename(r)));
