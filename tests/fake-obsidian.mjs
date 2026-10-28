#!/usr/bin/env node
// Stand-in for Obsidian.com in bridge tests. FAKE_MODE picks the canned behaviour.
// Every mode echoes nothing about argv except "args", which prints the argv as JSON.
// FAKE_MODE=vault emulates a small part of CLI 1.14.4 over a real folder (FAKE_VAULT), see vaultMode() below.
import fs from 'node:fs';
import path from 'node:path';

const mode = process.env.FAKE_MODE || 'ok';
const out = (s, code = 0) => { process.stdout.write(s); process.exit(code); };
if (process.env.FAKE_LOG) fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify(process.argv.slice(2)) + '\n');
switch (mode) {
  case 'ok': out('result line\n');
  case 'args': out(JSON.stringify(process.argv.slice(2)) + '\n');
  case 'closed': out('The CLI is unable to find Obsidian. Please make sure Obsidian is running and try again.\n', 1);
  case 'closed-stderr': process.stderr.write('The CLI is unable to find Obsidian. Please make sure Obsidian is running and try again.\n'); process.exit(1);
  case 'error': out('Error: File "x.md" not found.\n');
  case 'vault-missing': out('Vault not found.\n');
  case 'empty-msg': out('No matches found.\n');
  case 'empty-out': out('');
  case 'not-ready': out('Error: Command "eval" not found. It may require a plugin to be enabled.\n');
  case 'exe-127': out('', 127);
  case 'leading-blank': out('\nreal output\n');
  case 'hang': setTimeout(() => out('late\n'), 60000); break;
  case 'hang-vault': if (process.argv.slice(2).some((x) => x === 'version')) out('1.15.0 (installer 1.14.4)\n'); else setTimeout(() => out('late\n'), 60000); break;
  case 'vault-path': out('C:\\Some Dir\\Vault Đà Nẵng\n');
  case 'vault': vaultMode(); break;
  default: out(`unknown FAKE_MODE ${mode}\n`, 9);
}

// FAKE_VAULT: the vault folder (printed by `vault info=path`). FAKE_LINKS: alwaysUpdateLinks (default true; false makes
// rename/move hang like the "Update links" dialog, F4c). FAKE_DAILY: daily:path answer. Commands not listed print "result line".
function vaultMode() {
  const root = process.env.FAKE_VAULT;
  const args = process.argv.slice(2).filter((a) => !a.startsWith('vault='));
  const [cmd, ...rest] = args;
  const a = {};
  for (const x of rest) { const i = x.indexOf('='); if (i > 0) a[x.slice(0, i)] = x.slice(i + 1); else a[x] = true; }
  const abs = (rel) => path.join(root, ...rel.split('/'));
  const notes = () => walk('');
  function walk(rel) {
    const o = [];
    for (const e of fs.readdirSync(abs(rel || '.'), { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) o.push(...walk(r)); else if (r.endsWith('.md')) o.push(r);
    }
    return o;
  }
  const links = process.env.FAKE_LINKS !== 'false';
  const linkers = (p) => notes().filter((n) => n !== p && ((t) => t.includes(`[[${path.posix.basename(p, '.md')}`) || t.includes(`[[${p.replace(/\.md$/, '')}`))(fs.readFileSync(abs(n), 'utf8')));
  switch (cmd) {
    case 'version': out('1.14.4 (installer 1.14.4)\n');
    case 'vault': out(`${root}\n`);
    case 'eval': {
      const code = a.code || '';
      if (code.includes("'trashOption'")) out(`=> alwaysUpdateLinks=${links} trashOption=local\n`);
      if (code.includes('alwaysUpdateLinks')) out(`=> ${links}\n`);
      out('=> undefined\n');
    }
    case 'file': out(fs.existsSync(abs(a.path)) ? `path\t${a.path}\n` : `Error: File "${a.path}" not found.\n`);
    case 'backlinks': {
      if (!fs.existsSync(abs(a.path))) out(`Error: File "${a.path}" not found.\n`);
      const l = linkers(a.path);
      if (a.total) out(`${l.length}\n`);
      out(l.length ? l.join('\n') + '\n' : 'No backlinks found.\n');
    }
    case 'unresolved': out('0\n');
    case 'rename': case 'move': {
      if (!links) setTimeout(() => out('Renamed\n'), 60000); // the dialog blocks the CLI
      const dest = cmd === 'rename' ? path.posix.join(path.posix.dirname(a.path), a.name + '.md') : path.posix.join(a.to, path.posix.basename(a.path));
      if (cmd === 'move' && !fs.existsSync(abs(path.posix.dirname(dest)))) out(`Error: ENOENT: no such file or directory, rename '${a.path}' -> '${dest}'\n`);
      const old = path.posix.basename(a.path, '.md'), neu = path.posix.basename(dest, '.md');
      for (const n of linkers(a.path)) fs.writeFileSync(abs(n), fs.readFileSync(abs(n), 'utf8').split(`[[${a.path.replace(/\.md$/, '')}`).join(`[[${dest.replace(/\.md$/, '')}`).split(`[[${old}`).join(`[[${neu}`)); // full-path links too
      fs.renameSync(abs(a.path), abs(dest));
      if (cmd === 'rename' || cmd === 'move') { if (!links) break; out(`Renamed: ${a.path} -> ${dest}\n`); }
      break;
    }
    case 'create': {
      if (fs.existsSync(abs(a.path))) { const p = a.path.replace(/\.md$/, ' 1.md'); fs.writeFileSync(abs(p), a.content || ''); out(`Created: ${p}\n`); }
      fs.mkdirSync(path.dirname(abs(a.path)), { recursive: true });
      fs.writeFileSync(abs(a.path), (a.content || '').replace(/\\n/g, '\n'));
      out(`Created: ${a.path}\n`);
    }
    case 'daily:path': out(`${process.env.FAKE_DAILY || '2026-10-27.md'}\n`);
    case 'daily:read': {
      const p = abs(process.env.FAKE_DAILY || '2026-10-27.md');
      if (!fs.existsSync(p)) fs.writeFileSync(p, ''); // F9j: reading creates an empty note
      out(fs.readFileSync(p, 'utf8'));
    }
    case 'daily:append': {
      const p = abs(process.env.FAKE_DAILY || '2026-10-27.md');
      if (!fs.existsSync(path.dirname(p))) out('Error: Failed to open daily note.\n');
      if (!fs.existsSync(p)) fs.writeFileSync(p, '# Daily\n\n## Log\n');
      fs.appendFileSync(p, (a.content || '').replace(/\\n/g, '\n') + '\n');
      out('');
    }
    case 'tasks': {
      const want = a.done ? /^\s*- \[x\]/i : /^\s*- \[ \]/;
      const n = notes().reduce((s, f) => s + fs.readFileSync(abs(f), 'utf8').split(/\r?\n/).filter((l) => want.test(l)).length, 0);
      out(`${n}\n`);
    }
    case 'search:context': {
      const q = (a.query || '').replace(/^"|"$/g, '').toLowerCase();
      const res = [];
      for (const f of notes()) {
        if (a.path && !f.startsWith(a.path)) continue;
        const m = fs.readFileSync(abs(f), 'utf8').split(/\r?\n/).map((t, i) => ({ line: i + 1, text: t })).filter((x) => x.text.toLowerCase().includes(q));
        if (m.length) res.push({ file: f, matches: m });
      }
      out(res.length ? JSON.stringify(res.slice(0, Number(a.limit || 100))) + '\n' : 'No matches found.\n');
    }
    default: out('result line\n');
  }
}
