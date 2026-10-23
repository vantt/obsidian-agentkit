#!/usr/bin/env node
// Mask anything from the real vault before it goes into docs/showcase:
// lines naming a real note or folder, task lines not from the fixture, the Windows user, home dir and email.
// Usage as a filter: node redact.mjs < raw > safe      (list: tests/out/showcase/real-names.json from names.mjs)
import fs from 'node:fs';
import path from 'node:path';

const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
export const NAMES = path.join(repo, 'tests/out/showcase/real-names.json');

// Real note names that are also everyday words or the search topic; showing them reveals nothing.
export const GENERIC = new Set(['references', 'câu hỏi', 'cửa sổ', 'cẩm nang', 'da nang', 'đà nẵng', 'kỹ năng']);
// A Windows path outside the test folder (other vaults listed in obsidian.json, Drive folders, user dirs).
export const winPath = (l) => /"vaults"|(?<![A-Za-z])[A-Za-z]:\\+(?!\\)(?!obsidian-agentkit-test|Users\\+<user>\\+AppData|Program Files)/.test(l);
export const pickNames = (names) => names.filter((n) => (/\s/.test(n.trim()) || n.length >= 10) && !GENERIC.has(n.toLowerCase())).map((n) => n.toLowerCase());

export function makeRedactor({ names, allNames = [], fixtureLines, user } = JSON.parse(fs.readFileSync(NAMES, 'utf8'))) {
  // Multi-word names, or long single words, as whole words: a note called "Questions" reveals little,
  // and masking on it would hide ordinary English.
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const picked = pickNames(names);
  const login = path.basename(user.home);
  const res = [];
  for (let i = 0; i < picked.length; i += 300) res.push(new RegExp(`(?<![\\p{L}\\p{N}])(?:${picked.slice(i, i + 300).map(esc).join('|')})(?![\\p{L}\\p{N}])`, 'u'));
  const fx = new Set(fixtureLines);
  const files = new Set(allNames); // every real note basename, however short ("Bản", "2025-07-09")
  const namesFile = (l) => [...l.matchAll(/([^\s/\\"'`(\[]+)\.md\b/g)].some((m) => files.has(m[1].toLowerCase()));
  return (text) => String(text)
    .replaceAll(user.winUser, '<user>').replaceAll(user.home, '/home/<user>').replaceAll(user.email, '<email>')
    .replace(new RegExp(`(?<![\\w-])${login}(?![\\w-])|-home-${login}-`, 'gi'), (m) => (m.startsWith('-') ? '-home-<user>-' : '<user>'))
    .split('\n').map((l) => {
      const t = l.trim().toLowerCase();
      if (!t || l.includes('_agentkit-lab') || fx.has(l.trim())) return l;
      if (winPath(l)) return '[ẩn: đường dẫn ngoài thư mục test]';
      if (res.some((re) => re.test(t)) || namesFile(l)) return '[ẩn: dòng nhắc tới note thật]';
      if (/^\s*([-*+]|\d+[.)])\s+\[.\]/.test(l)) return '[ẩn: task trong note thật]';
      return l;
    }).join('\n');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  process.stdout.write(makeRedactor()(fs.readFileSync(0, 'utf8')));
}
