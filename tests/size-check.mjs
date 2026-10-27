#!/usr/bin/env node
// Size budget check (docs/SPEC.md §6). Tokens are an ESTIMATE: characters / 4.
// Exit 1 if any limit is exceeded. Run: node tests/size-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'obsidian-connect');
const skill = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');
const [, fm, body] = skill.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
const desc = (fm.match(/^description: (.*)$/m) || [])[1] || '';
const tok = (s) => Math.round(s.length / 4);
const rows = [
  ['description words', desc.split(/\s+/).filter(Boolean).length, 60],
  // v2 (E8.7): SKILL.md may not grow past v1 (65 lines, ~1,630 tokens); limits tightened from 100 lines / 1,700 tokens.
  ['SKILL.md body lines', body.trim().split('\n').length, 70],
  ['SKILL.md tokens (est)', tok(skill), 1630],
];
let biggestRef = 0;
for (const f of fs.readdirSync(path.join(root, 'references'))) {
  const t = tok(fs.readFileSync(path.join(root, 'references', f), 'utf8'));
  biggestRef = Math.max(biggestRef, t);
  rows.push([`ref ${f} tokens (est)`, t, 3000]);
}
rows.push(['typical load: SKILL + largest ref (est)', tok(skill) + biggestRef, 3000]);
for (const k of ['name: obsidian-connect', 'tested-cli:']) if (!fm.includes(k)) rows.push([`frontmatter has "${k}"`, 0, -1]);

let fail = false;
for (const [label, val, max] of rows) {
  const ok = max >= 0 && val <= max;
  fail ||= !ok;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}: ${val}${max >= 0 ? ` (max ${max})` : ''}`);
}
process.exit(fail ? 1 : 0);
