#!/usr/bin/env node
// Build the redaction list: names of real notes and folders in the vault copy (everything outside the lab),
// plus every line of the synthetic fixture (always safe to show).
// Usage: node names.mjs > tests/out/showcase/real-names.json   (raw, gitignored: it holds real names)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = '/mnt/c/obsidian-agentkit-test/vault-copy';
const LAB = '_agentkit-lab';
const names = new Set(); const allNames = new Set(); const fixtureLines = new Set();
// Words that also appear in commands and fixture text; masking on them would hide harmless lines.
const common = new Set(['readme', 'index', 'tasks', 'daily', 'notes', 'inbox', 'archive', 'templates', 'attachments', 'untitled', 'assets', 'images', 'resources', 'projects', 'project', 'clippings', 'evernote', 'excalidraw']);
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(d, e.name); const rel = path.relative(DIR, p);
    if (rel === LAB) { for (const f of fs.readdirSync(p, { recursive: true })) { const q = path.join(p, f); if (fs.statSync(q).isFile()) fs.readFileSync(q, 'utf8').split(/\r?\n/).forEach((l) => l.trim() && fixtureLines.add(l.trim())); } continue; }
    const base = e.isDirectory() ? e.name : e.name.replace(/\.[^.]+$/, '');
    if (!e.isDirectory() && e.name.endsWith('.md')) allNames.add(base.toLowerCase());
    if (base.length >= 5 && /\p{L}{3}/u.test(base) && !common.has(base.toLowerCase())) names.add(base);
    if (e.isDirectory()) walk(p);
  }
})(DIR);
const winUser = fs.readFileSync(path.join(os.homedir(), '.local/state/obs-showcase/real-cli'), 'utf8').match(/Users\/([^/]+)/)[1];
console.log(JSON.stringify({ names: [...names], allNames: [...allNames], fixtureLines: [...fixtureLines], user: { winUser, home: os.homedir(), email: process.env.SHOWCASE_EMAIL || '<no-email>' } }));
