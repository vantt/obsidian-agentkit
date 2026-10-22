#!/usr/bin/env node
// Deterministic synthetic vault fixture with the hard cases from YARDSTICK.md.
// Usage: node tests/fixtures/gen-fixture.mjs <outDir> [--bulk N] [--seed S]
// Writes only synthetic text. Expected answers come from tests/ground-truth/, not from here.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const outDir = args[0];
if (!outDir) {
  console.error('usage: gen-fixture.mjs <outDir> [--bulk N] [--seed S]');
  process.exit(2);
}
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : dflt;
};
const bulk = opt('--bulk', 0);
let seed = opt('--seed', 42);

// mulberry32: small seeded PRNG so reruns produce identical files.
function rand() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (a) => a[Math.floor(rand() * a.length)];

const files = new Map();
const put = (rel, text) => files.set(rel, text);

// Link target with alias, headings and a block.
put('Target Note.md', `---
aliases:
  - TN Alias
tags:
  - fixture
---
# Target Note

## Section A
Body of section A. ^blk1

## Section B
Body of section B.
`);

// One referrer per link form; the code-block one must NOT count as a backlink.
put('refs/ref-wikilink.md', 'Plain link: [[Target Note]]\n');
put('refs/ref-alias-display.md', 'Display text: [[Target Note|shown text]]\n');
put('refs/ref-alias-name.md', 'Via alias: [[TN Alias]]\n');
put('refs/ref-heading.md', 'Heading: [[Target Note#Section A]]\n');
put('refs/ref-block.md', 'Block: [[Target Note#^blk1]]\n');
put('refs/ref-embed.md', 'Embed:\n\n![[Target Note]]\n');
put('refs/deeper/ref-markdown.md', 'Markdown link: [target](../../Target%20Note.md)\n');
put('other folder/ref-other-folder.md', 'From another folder: [[Target Note#Section B|B]]\n');
put('refs/ref-code-block.md', 'Not a link:\n\n```\n[[Target Note]]\n```\n\nInline `[[Target Note]]` is not one either.\n');
put('refs/ref-unresolved.md', 'Broken on purpose: [[Missing Note Zeta]]\n');

// Properties with types that a naive set would break.
put('props/Property Note.md', `---
title: "Quoted: value with colon"
status: draft
created: 2026-01-15
due: 2026-02-01T09:30
rating: 4
done: false
tags:
  - proj
  - fixture
related:
  - "[[Target Note]]"
  - plain item
---
# Property Note

Body.
`);

// Tags: #proj must be renamed; #projects and code-block #proj must stay.
put('tags/tag-body.md', 'Work on #proj today. Also #proj/sub and #projects stay apart.\n');
put('tags/tag-frontmatter.md', '---\ntags: [proj, other]\n---\nFront matter tag only.\n');
put('tags/tag-code.md', 'Code:\n\n```\n#proj inside code\n```\n\n`#proj` inline code.\n');
put('tags/tag-projects.md', 'Only #projects here, and a heading:\n\n# proj is not a tag\n');

// Tasks spread across files and folders.
for (let i = 1; i <= 6; i++) {
  const lines = [`# Task list ${i}`, ''];
  lines.push(`- [ ] open task ${i}a`);
  lines.push(`- [x] done task ${i}b`);
  if (i % 2) lines.push(`    - [ ] nested open task ${i}c`);
  if (i === 3) lines.push('```', '- [ ] task inside code block', '```');
  put(`tasks/${i % 2 ? 'odd' : 'even'}/tasks-${i}.md`, lines.join('\n') + '\n');
}

// Vietnamese file names and text.
put('tiếng việt/Ghi chú tiếng Việt.md', '# Ghi chú\n\nĐường dẫn có dấu: Nguyễn, Đà Nẵng, thử nghiệm.\nLink: [[Target Note]]\n');
put('tiếng việt/Kế hoạch dự án.md', '# Kế hoạch\n\n- [ ] Viết báo cáo #proj\n');

// 3,000-line CRLF note with headed sections, for outline + ranged edit.
{
  const out = ['---', 'tags: [long]', '---', '# Long CRLF Note'];
  for (let s = 1; s <= 30; s++) {
    out.push('', `## Section ${String(s).padStart(2, '0')}`);
    for (let l = 1; l <= 97; l++) out.push(`Line ${l} of section ${s}: ${pick(['alpha', 'beta', 'gamma', 'delta'])} text.`);
  }
  put('long/Long CRLF Note.md', out.join('\r\n') + '\r\n');
}

// Optional bulk notes for search-budget tests.
const words = ['ledger', 'harbor', 'quartz', 'meadow', 'cobalt', 'lantern', 'thử', 'nghiệm', 'Đà', 'Nẵng'];
for (let i = 0; i < bulk; i++) {
  const body = Array.from({ length: 12 }, () => pick(words)).join(' ');
  const link = rand() < 0.1 ? `\n[[bulk-${String(Math.floor(rand() * bulk)).padStart(5, '0')}]]` : '';
  put(`bulk/${String(Math.floor(i / 100)).padStart(2, '0')}/bulk-${String(i).padStart(5, '0')}.md`, `# Bulk ${i}\n\n${body}${link}\n`);
}

// --standalone: also write .obsidian config so the fixture can be opened as its own vault
// and so profile.mjs has non-default values to report.
if (args.includes('--standalone')) {
  const j = (o) => JSON.stringify(o, null, 2);
  put('.obsidian/app.json', j({ alwaysUpdateLinks: true, useMarkdownLinks: false, newLinkFormat: 'relative', newFileLocation: 'folder', newFileFolderPath: 'inbox', attachmentFolderPath: 'attachments', trashOption: 'local', userIgnoreFilters: ['bulk/'] }));
  put('.obsidian/core-plugins.json', j({ 'daily-notes': true, templates: true, bases: true, canvas: true, properties: true }));
  put('.obsidian/community-plugins.json', j(['obsidian-tasks-plugin', 'dataview']));
  put('.obsidian/daily-notes.json', j({ folder: 'daily', format: 'YYYY/MM/YYYY-MM-DD', template: 'templates/daily' }));
  put('.obsidian/templates.json', j({ folder: 'templates' }));
  put('.obsidian/types.json', j({ types: { aliases: 'aliases', tags: 'tags', created: 'date', due: 'datetime', rating: 'number', done: 'checkbox', related: 'multitext' } }));
  put('.obsidian/app (conflict 2026-01-01-00-00-00).json', j({ alwaysUpdateLinks: false }));
  put('templates/daily.md', '---\ntype: daily\n---\n# {{date:YYYY-MM-DD}}\n\n## Log\n');
  put('daily/.keep', '');
  put('inbox/.keep', '');
}

for (const [rel, text] of files) {
  const p = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
}
console.log(`wrote ${files.size} files to ${outDir}`);
