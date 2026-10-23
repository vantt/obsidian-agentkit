#!/usr/bin/env node
// E7.8: scan everything that may be published for traces of the real vault or the user.
// Usage: node tests/showcase/privacy-scan.mjs [dir ...]   (default: docs/showcase tests/showcase)
// Flags: real note/folder names (multi-word or >= 10 chars, whole words), the Windows user name,
// the home path, the email, and task lines that are not from the fixture. Exit 1 when anything is found.
import fs from 'node:fs';
import path from 'node:path';
import { NAMES, pickNames, winPath } from './redact.mjs';

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ['docs/showcase', 'tests/showcase'];
const { names, allNames = [], fixtureLines, user } = JSON.parse(fs.readFileSync(NAMES, 'utf8'));
const fx = new Set(fixtureLines);
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const picked = pickNames(names);
const res = [];
for (let i = 0; i < picked.length; i += 300) res.push(new RegExp(`(?<![\\p{L}\\p{N}])(${picked.slice(i, i + 300).map(esc).join('|')})(?![\\p{L}\\p{N}])`, 'u'));
const secrets = [user.winUser, user.home, user.email, path.basename(user.home)].filter((s) => s && s.length > 3 && s !== '<no-email>');
const textExt = /\.(md|txt|json|csv|diff|svg|html|tape|mjs|sh|jsonl)$|\/obsidian$/;
const files = new Set(allNames);
const noteFile = (l) => [...l.matchAll(/([^\s/\\"'`(\[]+)\.md\b/g)].map((m) => m[1]).find((b) => files.has(b.toLowerCase()));
let hits = 0;
function scan(p) {
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const f = path.join(p, e.name);
    if (e.isDirectory()) { scan(f); continue; }
    if (!textExt.test(f) || /(redact|privacy-scan)\.mjs$/.test(f)) continue; // the rule files name what they look for
    fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
      const t = l.toLowerCase();
      const why = secrets.find((s) => l.toLowerCase().includes(s.toLowerCase())) ? 'user/home/email'
        : winPath(l) ? 'windows path outside test folder'
        : (!l.includes('_agentkit-lab') && !fx.has(l.trim()) && (res.map((re) => t.match(re)).find(Boolean)?.[1] || noteFile(l))) || null;
      if (why) { hits++; console.log(`${path.relative(repo, f)}:${i + 1}: ${/^(user\/home\/email|windows path)/.test(why) ? why : `real name "${why}"`}`); }
    });
  }
}
for (const d of dirs) scan(path.resolve(repo, d));
console.log(hits ? `\n${hits} hit(s)` : 'clean: no real names, user name, home path or email');
process.exit(hits ? 1 : 0);
