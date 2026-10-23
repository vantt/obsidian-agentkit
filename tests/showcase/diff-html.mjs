#!/usr/bin/env node
// Render a unified diff as a standalone HTML page (for a PNG via png.sh).
// Usage: node diff-html.mjs <file.diff> "<title>" "<caption>" > out.html
import fs from 'node:fs';
const [file, title, caption = ''] = process.argv.slice(2);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const rows = fs.readFileSync(file, 'utf8').split('\n').filter((l) => !/^(index |\\ No newline)/.test(l)).map((l) => {
  const cls = l.startsWith('+++') || l.startsWith('---') || l.startsWith('diff ') ? 'h' : l.startsWith('@@') ? 'at' : l[0] === '+' ? 'add' : l[0] === '-' ? 'del' : '';
  return `<div class="${cls}">${esc(l) || '&nbsp;'}</div>`;
}).join('');
console.log(`<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#fcfcfb;font:15px/1.45 "Cascadia Mono",Consolas,monospace;color:#0b0b0b}
.w{padding:28px 32px}h1{font:700 22px Segoe UI,Arial,sans-serif;margin:0 0 4px}p{font:14px Segoe UI,Arial,sans-serif;color:#52514e;margin:0 0 16px}
.d{border:1px solid #e4e3df;border-radius:8px;overflow:hidden}.d div{padding:0 12px;white-space:pre}
.h{color:#52514e;background:#f3f2ee;font-weight:600}.at{color:#6250d6;background:#f6f5fb}.add{background:#e3f4ea;color:#0b5d2a}.del{background:#fbe6e4;color:#8f1d16}
</style><div class="w"><h1>${esc(title)}</h1><p>${esc(caption)}</p><div class="d">${rows}</div></div>`);
