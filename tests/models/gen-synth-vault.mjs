#!/usr/bin/env node
// Synthetic stand-in for the real vault copy, for runs that send tool output to third-party models (E8.3).
// Same shape as vault-copy: ~1,800 notes, root daily notes, tasks, tags, properties, Vietnamese text,
// plus the hard-case fixture in _agentkit-lab/ (tests/fixtures/gen-fixture.mjs). Every word is generated.
// Usage: node tests/models/gen-synth-vault.mjs <outDir> [--seed S]
// Writes <outDir>/.e8-synthetic (the marker run.mjs checks before any run) and makes <outDir> a git repo.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const outDir = args[0];
if (!outDir) { console.error('usage: gen-synth-vault.mjs <outDir> [--seed S]'); process.exit(2); }
if (fs.existsSync(outDir) && fs.readdirSync(outDir).length) { console.error(`refusing: ${outDir} is not empty`); process.exit(2); }
const i = args.indexOf('--seed');
let seed = i >= 0 ? Number(args[i + 1]) : 7;
const here = path.dirname(new URL(import.meta.url).pathname);

// mulberry32, as in gen-fixture.mjs, so reruns produce identical files.
function rand() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (a) => a[Math.floor(rand() * a.length)];
const some = (a, n) => Array.from({ length: n }, () => pick(a));
const chance = (p) => rand() < p;

const files = new Map();
const put = (rel, text) => files.set(rel, text);
const fm = (o) => '---\n' + Object.entries(o).map(([k, v]) => Array.isArray(v) ? `${k}:\n${v.map((x) => `  - ${x}`).join('\n')}` : `${k}: ${v}`).join('\n') + '\n---\n';

const vnWords = ['công việc', 'kế hoạch', 'gia đình', 'sức khoẻ', 'đọc sách', 'chạy bộ', 'họp nhóm', 'báo cáo', 'khách hàng', 'ngân sách', 'học tiếng Anh', 'nấu ăn', 'cuối tuần', 'dự án', 'ý tưởng', 'ghi chú', 'thói quen', 'tài chính'];
const enWords = ['roadmap', 'review', 'draft', 'budget', 'meeting', 'ideas', 'reading', 'notes', 'follow-up', 'release', 'design', 'research', 'habit', 'workout'];
const sentence = () => {
  const w = some(chance(0.7) ? vnWords : enWords, 5 + Math.floor(rand() * 6)).join(' ');
  return w[0].toUpperCase() + w.slice(1) + '.';
};
const para = (n) => Array.from({ length: n }, sentence).join(' ');
const pad = (n, w = 2) => String(n).padStart(w, '0');

// People, projects, books: link targets for everything else.
const given = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Hải', 'Hoa', 'Hùng', 'Khánh', 'Lan', 'Linh', 'Long', 'Mai', 'Minh', 'Nam', 'Ngọc', 'Phúc', 'Quân', 'Sơn', 'Thảo', 'Trang', 'Tuấn', 'Vy', 'Yến'];
const family = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Ngô'];
const people = [...new Set(Array.from({ length: 150 }, () => `${pick(family)} ${pick(given)}`))];
const projects = Array.from({ length: 50 }, (_, k) => `${pick(['Website', 'App', 'Báo cáo', 'Kho dữ liệu', 'Sự kiện', 'Khoá học', 'Chiến dịch'])} ${pick(['Alpha', 'Sao Mai', 'Hướng Dương', 'Beta', 'Biển Xanh', 'Mùa Thu'])} ${k + 1}`);
const books = Array.from({ length: 60 }, (_, k) => `Sách ${k + 1} - ${pick(['Thói quen', 'Tư duy', 'Lịch sử', 'Kinh tế', 'Tiểu thuyết', 'Khoa học'])} ${pick(['nhanh', 'chậm', 'mới', 'cổ điển'])}`);
const link = (name) => `[[${name}]]`;

for (const p of people) {
  put(`People/${p}.md`, fm({ type: 'person', birthday: `19${70 + Math.floor(rand() * 30)}-${pad(1 + Math.floor(rand() * 12))}-${pad(1 + Math.floor(rand() * 28))}`, tags: ['people'] })
    + `# ${p}\n\n${para(2)}\n\nGặp lần đầu ở ${link(pick(projects))}.\n`);
}

for (const pr of projects) {
  const lines = [fm({ type: 'project', status: pick(['active', 'paused', 'done']), created: `2025-${pad(1 + Math.floor(rand() * 12))}-${pad(1 + Math.floor(rand() * 28))}`, tags: ['projects'] }), `# ${pr}`, '', para(3), '', '## Việc cần làm', ''];
  for (let k = 0; k < 2 + Math.floor(rand() * 5); k++) lines.push(`- [${chance(0.45) ? ' ' : 'x'}] ${sentence()}${chance(0.3) ? ' ' + link(pick(people)) : ''}`);
  if (chance(0.2)) lines.push('', `Thẻ liên quan: #project/${pick(['active', 'idea', 'archive'])} #projects`);
  put(`Projects/${pr}.md`, lines.join('\n') + '\n');
}

for (const b of books) put(`Books/${b}.md`, fm({ type: 'book', rating: 1 + Math.floor(rand() * 5), tags: ['books'] }) + `# ${b}\n\n${para(4)}\n`);

// Root daily notes, YYYY-MM-DD.md, ending well before any run date so "today" never exists yet.
const day0 = Date.UTC(2025, 0, 1);
for (let d = 0; d < 650; d++) {
  if (!chance(0.62)) continue;
  const date = new Date(day0 + d * 864e5).toISOString().slice(0, 10);
  if (date > '2026-10-15') break;
  const lines = [`# ${date}`, '', '## Log', `- ${sentence()}`];
  if (chance(0.4)) lines.push(`- Gặp ${link(pick(people))} về ${link(pick(projects))}.`);
  if (chance(0.5)) lines.push('', '## Tasks', `- [${chance(0.5) ? ' ' : 'x'}] ${sentence()}`);
  if (chance(0.15)) lines.push(`- [ ] ${sentence()} #journal`);
  put(`${date}.md`, lines.join('\n') + '\n');
}

for (let k = 0; k < 300; k++) {
  const pr = pick(projects);
  const lines = [fm({ type: 'meeting', date: `2026-${pad(1 + Math.floor(rand() * 9))}-${pad(1 + Math.floor(rand() * 28))}` }), `# Họp ${k + 1}: ${pr}`, '', `Dự án: ${link(pr)}`, `Người dự: ${some(people, 3).map(link).join(', ')}`, '', para(2)];
  if (chance(0.5)) lines.push('', `- [ ] ${sentence()}`);
  put(`Work/Meetings/Họp ${pad(k + 1, 3)}.md`, lines.join('\n') + '\n');
}

for (let k = 0; k < 700; k++) {
  const lines = [`# Bài viết ${k + 1}`, '', para(5), '', para(4)];
  if (chance(0.08)) lines.push('', '```markdown', `- [ ] ví dụ task trong code ${k}`, '#proj trong code', '```');
  if (chance(0.05)) lines.push('', `Xem thêm ${link(`Bài viết chưa có ${k}`)}.`);
  put(`Reference/Articles/Bài viết ${pad(k + 1, 3)}.md`, lines.join('\n') + '\n');
}

for (let k = 0; k < 80; k++) put(`Recipes/Món ${k + 1}.md`, fm({ type: 'recipe', tags: ['recipes'] }) + `# Món ${k + 1}\n\n## Nguyên liệu\n${some(['trứng', 'gạo', 'hành', 'tỏi', 'cá', 'thịt gà', 'rau muống'], 4).map((x) => `- ${x}`).join('\n')}\n\n## Cách làm\n${para(2)}\n`);
for (let k = 0; k < 40; k++) put(`Inbox/Ghi nhanh ${k + 1}.md`, `${sentence()}\n\n- [ ] ${sentence()}\n`);

// S6: notes about Đà Nẵng. "relevant" ones are about the city; decoys only look similar
// ("Nẵng" vs "Năng"/"Nang" inside other words), the accentless ones need the "Da Nang" search.
const danang = {
  'Travel/Đà Nẵng 2025.md': `# Đà Nẵng 2025\n\nChuyến đi Đà Nẵng tháng 6 cùng gia đình. Biển Mỹ Khê, cầu Rồng, chợ Hàn.\n\n- [x] Đặt khách sạn\n`,
  'Travel/Ăn gì ở Đà Nẵng.md': `# Ăn gì ở Đà Nẵng\n\nMì Quảng, bánh tráng cuốn thịt heo, bún chả cá. Ghi lại các quán ngon ở Đà Nẵng.\n`,
  'Travel/Lịch trình Đà Nẵng - Hội An.md': `# Lịch trình Đà Nẵng - Hội An\n\nNgày 1: Đà Nẵng, bán đảo Sơn Trà. Ngày 2: Hội An. Ngày 3: Bà Nà.\n`,
  'Travel/Da Nang coworking.md': `# Da Nang coworking\n\nCoworking spaces in Da Nang near the beach, good wifi, monthly passes.\n`,
  'Work/Chi nhánh Da Nang.md': `# Chi nhánh Da Nang\n\nKế hoạch mở văn phòng ở Da Nang năm 2027. Ngân sách và tuyển dụng.\n`,
};
const passing = ['Travel/Bà Nà Hills.md', 'Travel/Hội An cuối tuần.md', 'Travel/Huế mùa mưa.md', '_agentkit-lab/tiếng việt/Ghi chú tiếng Việt.md'];
put(passing[0], `# Bà Nà Hills\n\nCáp treo dài, cách trung tâm Đà Nẵng khoảng 40 km.\n`);
put(passing[1], `# Hội An cuối tuần\n\nĐi xe từ Đà Nẵng mất 45 phút.\n`);
put(passing[2], `# Huế mùa mưa\n\nMưa nhiều, nên đi vào mùa hè. Có thể nối chuyến với Đà Nẵng.\n`);
for (const [p, t] of Object.entries(danang)) put(p, t);
const decoys = ['Reference/Cẩm Nang du lịch.md', 'Work/Kỹ Năng thuyết trình.md', 'Reference/Năng lượng tái tạo.md'];
put(decoys[0], '# Cẩm Nang du lịch\n\nCẩm nang chung khi đi xa: hành lý, giấy tờ, bảo hiểm.\n');
put(decoys[1], '# Kỹ Năng thuyết trình\n\nKỹ năng mềm: chuẩn bị slide, luyện nói.\n');
put(decoys[2], '# Năng lượng tái tạo\n\nĐiện mặt trời, điện gió.\n');
for (let k = 0; k < 30; k++) put(`Travel/Chuyến đi ${k + 1}.md`, `# Chuyến đi ${k + 1}\n\n${pick(['Sapa', 'Đà Lạt', 'Phú Quốc', 'Hà Giang', 'Nha Trang', 'Quy Nhơn'])}: ${para(2)}\n`);

put('Templates/Daily.md', '# {{date}}\n\n## Log\n\n## Tasks\n');
const j = (o) => JSON.stringify(o, null, 2);
put('.obsidian/app.json', j({ alwaysUpdateLinks: true, newLinkFormat: 'shortest', useMarkdownLinks: false, trashOption: 'local' }));
put('.obsidian/core-plugins.json', j({ 'file-explorer': true, 'global-search': true, backlink: true, 'daily-notes': true, templates: true, properties: true, bases: true, canvas: true }));
put('.obsidian/daily-notes.json', j({ format: 'YYYY-MM-DD', folder: '', template: 'Templates/Daily' }));
put('.obsidian/templates.json', j({ folder: 'Templates' }));
put('.obsidian/types.json', j({ types: { aliases: 'aliases', cssclasses: 'multitext', tags: 'tags', created: 'date', birthday: 'date', date: 'date' } }));

// Marker + answer key for the judge. Dot file: Obsidian does not index it.
const marker = {
  about: 'Synthetic vault for E8 (docs/plans/E8-small-models.md). Generated; contains no real notes.',
  generator: 'tests/models/gen-synth-vault.mjs', seed: i >= 0 ? Number(args[i + 1]) : 7,
  s6: { relevant: Object.keys(danang), passing, decoys },
};
put('.e8-synthetic', j(marker));
put('.gitignore', '.obsidian/workspace*.json\n.obsidian/plugins/\n.trash/\n');

for (const [rel, text] of files) {
  const p = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
}
const fx = spawnSync('node', [path.join(here, '../fixtures/gen-fixture.mjs'), path.join(outDir, '_agentkit-lab')], { encoding: 'utf8' });
if (fx.status !== 0) { console.error(fx.stderr); process.exit(1); }
const git = (...a) => {
  const r = spawnSync('git', ['-C', outDir, ...a], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(`git ${a[0]}: ${r.stderr}`); process.exit(1); }
};
git('init', '-q');
git('config', 'core.autocrlf', 'false');
git('config', 'user.name', 'e8-synth'); git('config', 'user.email', 'e8-synth@example.invalid');
git('add', '-A');
git('commit', '-qm', 'synthetic vault');
const md = [...files.keys()].filter((f) => f.endsWith('.md')).length;
console.log(`wrote ${md} notes + _agentkit-lab fixture to ${outDir}; git initialised`);
