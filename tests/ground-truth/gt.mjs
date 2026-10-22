#!/usr/bin/env node
// Ground truth from files alone (no Obsidian CLI). Used to judge CLI and agent answers.
// Usage: node tests/ground-truth/gt.mjs <command> <vaultDir> [args]
//   tasks [folder]           open/done task counts (outside code blocks)
//   backlinks <notePath>     files linking to note (wikilink, embed, heading, block, md link)
//   unresolved [folder]      wikilink targets that match no file name or alias-free path
//   tags <tag> [folder]      occurrences of #tag (body, outside code) and in frontmatter tags
//   yaml <notePath>          frontmatter parses; prints keys and JS types
//   crlf <notePath>          line count and line-ending mix
// Output is JSON on stdout. Exit 0 ok, 2 usage error.
import fs from 'node:fs';
import path from 'node:path';

const [cmd, vault, ...rest] = process.argv.slice(2);
if (!cmd || !vault) {
  console.error('usage: gt.mjs <tasks|backlinks|unresolved|tags|yaml|crlf> <vaultDir> [args]');
  process.exit(2);
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue; // .obsidian, .trash, .git: not indexed by Obsidian
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(vault, p).split(path.sep).join('/');
const notes = (folder = '') => walk(path.join(vault, folder)).filter((p) => p.endsWith('.md'));
const read = (p) => fs.readFileSync(p, 'utf8');

// Split note into frontmatter text and body lines with code (fenced and inline) blanked out.
function parse(text) {
  const lines = text.split(/\r?\n/);
  let fm = null;
  let start = 0;
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) { fm = lines.slice(1, end).join('\n'); start = end + 1; }
  }
  const body = [];
  let fence = null;
  for (let i = start; i < lines.length; i++) {
    const l = lines[i];
    const m = l.match(/^\s*(`{3,}|~{3,})/);
    if (fence) { if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null; body.push(''); continue; }
    if (m) { fence = m[1]; body.push(''); continue; }
    body.push(l.replace(/`[^`]*`/g, (s) => ' '.repeat(s.length)));
  }
  return { fm, body, start };
}

// Link targets in a body: [[target#sub|alias]], ![[...]], [text](url.md)
function links(bodyLines, fm) {
  const out = [];
  const text = bodyLines.join('\n') + '\n' + (fm || '');
  for (const m of text.matchAll(/!?\[\[([^\]|#^]*)(?:[#^][^\]|]*)?(?:\|[^\]]*)?\]\]/g)) out.push({ kind: 'wiki', target: m[1].trim() });
  for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+?\.md)(?:#[^)]*)?\)/g)) {
    if (/^[a-z]+:\/\//i.test(m[1])) continue;
    out.push({ kind: 'md', target: decodeURIComponent(m[1]) });
  }
  return out;
}

const all = notes();
const byBase = new Map();
for (const p of all) {
  const b = path.basename(p, '.md').toLowerCase();
  if (!byBase.has(b)) byBase.set(b, []);
  byBase.get(b).push(rel(p));
}
const files = new Set(walk(vault).map(rel));

// Resolve like Obsidian: exact vault path, then path relative to source, then unique-ish basename.
function resolve(target, fromRel) {
  if (!target) return fromRel; // [[#heading]] links to self
  const t = target.replace(/\\/g, '/');
  const cands = [t, t + '.md', path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), t))];
  for (const c of cands) if (files.has(c)) return c;
  if (t.includes('/')) {
    const tail = (t.endsWith('.md') ? t : t + '.md').toLowerCase();
    const hit = [...files].find((f) => f.toLowerCase().endsWith('/' + tail) || f.toLowerCase() === tail);
    if (hit) return hit;
  }
  const hits = byBase.get(path.posix.basename(t, '.md').toLowerCase());
  if (hits) return hits.sort((a, b) => a.split('/').length - b.split('/').length)[0];
  // non-md attachments by basename
  const att = [...files].find((f) => path.posix.basename(f).toLowerCase() === path.posix.basename(t).toLowerCase());
  return att || null;
}

const res = {};
switch (cmd) {
  case 'tasks': {
    let open = 0, done = 0, other = 0, inFiles = 0;
    for (const p of notes(rest[0] || '')) {
      const { body } = parse(read(p));
      let n = 0;
      for (const l of body) {
        const m = l.match(/^\s*(?:[-*+]|\d+[.)])\s+\[(.)\]/);
        if (!m) continue;
        n++;
        if (m[1] === ' ') open++; else if (m[1] === 'x' || m[1] === 'X') done++; else other++;
      }
      if (n) inFiles++;
    }
    Object.assign(res, { open, done, other, total: open + done + other, files: inFiles });
    break;
  }
  case 'backlinks': {
    const target = rest[0];
    const refs = [];
    for (const p of all) {
      const r = rel(p);
      if (r === target) continue;
      const { fm, body } = parse(read(p));
      const n = links(body, fm).filter((l) => resolve(l.target, r) === target).length;
      if (n) refs.push({ file: r, count: n });
    }
    Object.assign(res, { target, total: refs.length, files: refs.sort((a, b) => a.file.localeCompare(b.file)) });
    break;
  }
  case 'unresolved': {
    const out = [];
    for (const p of notes(rest[0] || '')) {
      const r = rel(p);
      const { fm, body } = parse(read(p));
      for (const l of links(body, fm)) if (l.kind === 'wiki' && !resolve(l.target, r)) out.push({ file: r, target: l.target });
    }
    Object.assign(res, { total: out.length, targets: new Set(out.map((o) => o.target)).size, links: out });
    break;
  }
  case 'tags': {
    const tag = rest[0].replace(/^#/, '');
    const re = new RegExp(`(^|[\\s(])#${tag.replace(/[/.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[\\s,.;:!?)\\]])`, 'g');
    const body = [], front = [];
    for (const p of notes(rest[1] || '')) {
      const { fm, body: b, start } = parse(read(p));
      b.forEach((l, i) => { for (const _ of l.matchAll(re)) body.push(`${rel(p)}:${start + i + 1}`); });
      if (fm) {
        const m = fm.match(/^tags:[ \t]*(.*)$/m);
        if (m) {
          const inline = m[1].replace(/[\[\]]/g, '').split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean);
          // block list: indented "- x" lines right after "tags:", stopping at the next key
          const after = fm.slice(m.index + m[0].length).split('\n').slice(1);
          const items = [];
          for (const l of after) { const x = l.match(/^\s+-\s+(.+)$/); if (!x) break; items.push(x[1].trim().replace(/^#|["']/g, '')); }
          const block = m[1] ? [] : items;
          if ([...inline, ...block].includes(tag)) front.push(rel(p));
        }
      }
    }
    Object.assign(res, { tag, body: body.length, frontmatter: front.length, bodyAt: body, frontmatterIn: front });
    break;
  }
  case 'yaml': {
    const { parse: parseYaml } = await import('yaml');
    const { fm } = parse(read(path.join(vault, rest[0])));
    try {
      const obj = fm === null ? {} : parseYaml(fm) ?? {};
      res.valid = true;
      res.keys = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, Array.isArray(v) ? 'list' : v instanceof Date ? 'date' : typeof v]));
      res.values = obj;
    } catch (e) {
      Object.assign(res, { valid: false, error: String(e.message).split('\n')[0] });
    }
    break;
  }
  case 'crlf': {
    const t = read(path.join(vault, rest[0]));
    const crlf = (t.match(/\r\n/g) || []).length;
    const lf = (t.match(/\n/g) || []).length - crlf;
    Object.assign(res, { lines: crlf + lf, crlf, lf, mixed: crlf > 0 && lf > 0 });
    break;
  }
  default:
    console.error(`unknown command: ${cmd}`);
    process.exit(2);
}
console.log(JSON.stringify(res, null, 1));
