#!/usr/bin/env node
// Vault profile from .obsidian/*.json only (no note content). About 30 lines of YAML.
// Usage: node profile.mjs <vaultDir> [--out <file>]
// Missing keys are Obsidian defaults (measured on 1.14.4, see docs/FINDINGS.md F11).
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const vault = args.find((a) => !a.startsWith('--'));
const outIdx = args.indexOf('--out');
if (!vault) {
  console.error('usage: profile.mjs <vaultDir> [--out <file>]');
  process.exit(5);
}
const cfgDir = path.join(vault, '.obsidian');
if (!fs.existsSync(cfgDir)) {
  console.error(`obs: 5 no .obsidian folder in ${vault}`);
  process.exit(5);
}

const conflicts = fs.readdirSync(cfgDir).filter((f) => /\(conflict[^)]*\)|\(\d+\)\.json$/i.test(f));
function load(rel) {
  try { return JSON.parse(fs.readFileSync(path.join(cfgDir, rel), 'utf8')); } catch { return null; }
}
const app = load('app.json') || {};
const core = load('core-plugins.json') || {};
const community = load('community-plugins.json') || [];
const daily = load('daily-notes.json');
const templates = load('templates.json');
const templater = load('plugins/templater-obsidian/data.json');
const types = (load('types.json') || {}).types || {};

const lines = [];
const q = (v) => (v === undefined || v === null || v === '' ? '""' : JSON.stringify(v));
// value with provenance: from <file> when set there, else default
function kv(key, obj, k, dflt, file, note = '') {
  const set = obj && obj[k] !== undefined && obj[k] !== '';
  lines.push(`${key}: ${q(set ? obj[k] : dflt)}  # ${set ? `from ${file}` : 'default'}${note ? '; ' + note : ''}`);
}
const enabled = (id) => core[id] === true;
const dirExists = (rel) => !!rel && fs.existsSync(path.join(vault, ...String(rel).split('/')));

lines.push(`# Vault profile: ${path.basename(path.resolve(vault))}`);
lines.push(`generated: ${q(new Date().toISOString())}  # from .obsidian/*.json only`);
lines.push('links:');
kv('  markdown_links', app, 'useMarkdownLinks', false, 'app.json', 'false = [[wikilinks]]');
kv('  new_link_format', app, 'newLinkFormat', 'shortest', 'app.json', 'move/rename rewrites md links to this form');
kv('  auto_update_on_rename', app, 'alwaysUpdateLinks', false, 'app.json', 'live value: obs --preflight');
lines.push('files:');
kv('  new_note_location', app, 'newFileLocation', 'root', 'app.json');
if (app.newFileLocation === 'folder') kv('  new_note_folder', app, 'newFileFolderPath', '/', 'app.json');
kv('  attachment_folder', app, 'attachmentFolderPath', '/', 'app.json');
kv('  trash_option', app, 'trashOption', 'system', 'app.json', 'CLI delete ignores it; use obs --trash');
lines.push(`  excluded: ${q(app.userIgnoreFilters || [])}  # ${app.userIgnoreFilters ? 'from app.json' : 'default'}`);
lines.push(`daily_notes:  # core plugin ${enabled('daily-notes') ? 'on' : 'off'}`);
kv('  folder', daily, 'folder', '', 'daily-notes.json', dirExists(daily?.folder) || !daily?.folder ? 'exists' : 'MISSING: daily:* fails until created');
kv('  format', daily, 'format', 'YYYY-MM-DD', 'daily-notes.json');
kv('  template', daily, 'template', '', 'daily-notes.json');
lines.push('templates:');
kv('  core_folder', templates, 'folder', '', 'templates.json', enabled('templates') ? 'core plugin on' : 'core plugin off');
if (community.includes('templater-obsidian')) kv('  templater_folder', templater, 'templates_folder', '', 'plugins/templater-obsidian/data.json');
const agentPlugins = ['obsidian-tasks-plugin', 'dataview', 'templater-obsidian', 'tag-wrangler', 'obsidian-kanban', 'omnisearch'].filter((p) => community.includes(p));
const coreFeat = ['bases', 'canvas', 'properties', 'bookmarks'].filter(enabled);
lines.push(`plugins: ${q([...coreFeat, ...agentPlugins])}  # from core-plugins.json, community-plugins.json (${community.length} community on)`);
// Property types: show user keys, collapse plugin-prefixed families (e.g. TQ_*) into counts.
const fam = {};
const own = [];
for (const [k, t] of Object.entries(types)) {
  const m = k.match(/^([A-Za-z]+)_/);
  if (m && Object.keys(types).filter((x) => x.startsWith(m[1] + '_')).length > 3) fam[m[1]] = (fam[m[1]] || 0) + 1;
  else own.push(`${k}=${t}`);
}
lines.push(`property_types: ${q(own)}  # from types.json; never change these with property:set`);
if (Object.keys(fam).length) lines.push(`property_type_families: ${q(Object.entries(fam).map(([p, n]) => `${p}_*(${n})`))}  # plugin keys`);
lines.push(`sync_conflict_files: ${q(conflicts)}  # skipped; Drive conflict copies`);

const text = lines.join('\n') + '\n';
if (outIdx >= 0 && args[outIdx + 1]) {
  fs.writeFileSync(args[outIdx + 1], text);
  console.log(`wrote ${lines.length} lines to ${args[outIdx + 1]}`);
} else process.stdout.write(text);
