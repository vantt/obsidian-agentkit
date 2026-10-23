#!/usr/bin/env node
// Rebuild every run's metrics from the raw transcripts, join them with check.json and verdicts.json,
// and write docs/showcase/data/{results.json,results.csv} plus the SVG charts in docs/showcase/assets/charts/.
// Usage: node tests/showcase/report.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { makeRedactor } from './redact.mjs';

const redact = makeRedactor();

const here = path.dirname(new URL(import.meta.url).pathname);
const repo = path.resolve(here, '../..');
const RAW = path.join(repo, 'tests/out/showcase');
const PUB = path.join(repo, 'docs/showcase');
const verdicts = JSON.parse(fs.readFileSync(path.join(here, 'verdicts.json'), 'utf8'));
const S = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'];
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// 1. Re-derive metrics (transcript.mjs may have changed since the run).
const runs = fs.readdirSync(RAW).filter((d) => /^S\d-with/.test(d));
for (const d of runs) {
  const [s, side] = d.split('-');
  const src = path.join(RAW, d, 'transcript.jsonl');
  spawnSync('node', [path.join(here, 'transcript.mjs'), src, path.join(RAW, d)]);
  const pub = path.join(PUB, 'scenarios', s, side);
  if (s === 'S6') { // numbers only
    fs.copyFileSync(path.join(RAW, d, 'metrics.json'), path.join(pub, 'metrics.json'));
  } else {
    spawnSync('node', [path.join(here, 'transcript.mjs'), src, pub, '--redact']);
    for (const f of ['check.json', 'lab.diff']) fs.writeFileSync(path.join(pub, f), redact(fs.readFileSync(path.join(RAW, d, f), 'utf8')));
    if (fs.existsSync(path.join(pub, 'cli-calls.txt'))) fs.writeFileSync(path.join(pub, 'cli-calls.txt'), redact(fs.readFileSync(path.join(pub, 'cli-calls.txt'), 'utf8')));
  }
}

// 2. One row per scenario and side; S8 adds its two sessions.
const sum = (a, b) => Object.fromEntries(Object.keys(a).map((k) => [k, typeof a[k] === 'number' ? a[k] + (b[k] ?? 0) : a[k]]));
const rows = [];
for (const s of S) for (const side of ['without', 'with']) {
  let m = read(path.join(RAW, `${s}-${side}`, 'metrics.json'));
  const c = read(path.join(RAW, `${s}-${side}`, 'check.json'));
  let cliCalls = c.cli.calls; let cliBytes = c.cli.outBytes;
  const second = path.join(RAW, `${s}-${side}2`);
  if (fs.existsSync(second)) {
    m = sum(m, read(path.join(second, 'metrics.json')));
    const c2 = read(path.join(second, 'check.json'));
    cliCalls += c2.cli.calls; cliBytes += c2.cli.outBytes;
  }
  const v = verdicts[s][side];
  rows.push({
    scenario: s, title: verdicts[s].title, side, result: v.result, answer: v.answer,
    incidents: v.incidents.length, incidentList: v.incidents, notes: v.notes,
    toolCalls: m.toolCalls, wallSeconds: m.wallSeconds, contextGrowth: m.contextGrowth,
    inputTokensTotal: m.inputTokensTotal, outputTokensTotal: m.outputTokensTotal,
    toolOutputBytes: m.toolOutputBytes, skillLoadBytes: m.skillLoadBytes, taskOutputBytes: m.taskOutputBytes,
    cliCalls, cliOutBytes: cliBytes,
  });
}
fs.mkdirSync(path.join(PUB, 'data'), { recursive: true });
fs.writeFileSync(path.join(PUB, 'data/results.json'), JSON.stringify(rows, null, 1));
const cols = ['scenario', 'side', 'result', 'incidents', 'toolCalls', 'wallSeconds', 'contextGrowth', 'inputTokensTotal', 'outputTokensTotal', 'toolOutputBytes', 'skillLoadBytes', 'taskOutputBytes', 'cliCalls', 'cliOutBytes'];
fs.writeFileSync(path.join(PUB, 'data/results.csv'), [cols.join(','), ...rows.map((r) => cols.map((k) => JSON.stringify(r[k])).join(','))].join('\n') + '\n');

// 3. Charts: grouped horizontal bars, one per measure. Without = orange, with = blue (validated pair).
const C = { without: '#eb6834', with: '#2a78d6', ink: '#0b0b0b', ink2: '#52514e', grid: '#e4e3df', surface: '#fcfcfb' };
const LBL = { without: 'Không có skill', with: 'Có skill' };
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function chart(file, title, subtitle, key, fmt = (x) => x.toLocaleString('vi-VN')) {
  const W = 960, left = 250, right = 90, top = 104, band = 50, barH = 16, gap = 2;
  const H = top + S.length * band + 40;
  const max = Math.max(...rows.map((r) => r[key])) || 1;
  const x = (v) => (v / max) * (W - left - right);
  let g = '';
  S.forEach((s, i) => {
    const y0 = top + i * band;
    const t = verdicts[s].title;
    g += `<text x="${left - 14}" y="${y0 + 15}" text-anchor="end" font-size="14" font-weight="600" fill="${C.ink}">${s}</text>`;
    g += `<text x="${left - 14}" y="${y0 + 33}" text-anchor="end" font-size="12" fill="${C.ink2}">${esc(t.length > 30 ? t.slice(0, 29) + '…' : t)}</text>`;
    ['without', 'with'].forEach((side, j) => {
      const r = rows.find((q) => q.scenario === s && q.side === side);
      const w = Math.max(x(r[key]), r[key] > 0 ? 4 : 0);
      const y = y0 + j * (barH + gap) + 2;
      g += `<path d="M${left},${y} h${Math.max(w - 4, 0)} a4,4 0 0 1 4,4 v${barH - 8} a4,4 0 0 1 -4,4 h-${Math.max(w - 4, 0)} z" fill="${C[side]}"><title>${s} ${LBL[side]}: ${fmt(r[key])}</title></path>`;
      g += `<text x="${left + w + 6}" y="${y + 12.5}" font-size="12" fill="${C.ink}">${fmt(r[key])}</text>`;
    });
  });
  const legend = ['without', 'with'].map((side, j) => `<rect x="${left + j * 170}" y="70" width="14" height="14" rx="3" fill="${C[side]}"/><text x="${left + j * 170 + 20}" y="82" font-size="13" fill="${C.ink}">${LBL[side]}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif">
<rect width="${W}" height="${H}" fill="${C.surface}"/>
<text x="24" y="36" font-size="22" font-weight="700" fill="${C.ink}">${esc(title)}</text>
<text x="24" y="58" font-size="13" fill="${C.ink2}">${esc(subtitle)}</text>
${legend}
<line x1="${left}" y1="${top - 6}" x2="${left}" y2="${H - 34}" stroke="${C.grid}"/>
${g}
<text x="24" y="${H - 12}" font-size="11" fill="${C.ink2}">obsidian-agentkit · E7 · Obsidian CLI 1.14.4 · 1 lượt mỗi phía · S8 = tổng 2 phiên · dữ liệu: docs/showcase/data/results.csv</text>
</svg>\n`;
  fs.mkdirSync(path.join(PUB, 'assets/charts'), { recursive: true });
  fs.writeFileSync(path.join(PUB, 'assets/charts', file), svg);
}
chart('context-tokens.svg', 'Token thêm vào ngữ cảnh của agent', 'Ngữ cảnh cuối trừ ngữ cảnh đầu, từ usage API trong transcript. Phía có skill đã gồm ~1.700 token đọc SKILL.md.', 'contextGrowth');
chart('wall-time.svg', 'Thời gian chạy (giây)', 'Từ lúc agent nhận việc tới lúc trả lời, theo timestamp transcript.', 'wallSeconds');
chart('tool-calls.svg', 'Số lần gọi công cụ', 'Bash, Read… mà agent gọi; một lệnh Bash có thể chứa nhiều lệnh CLI.', 'toolCalls');
chart('cli-output.svg', 'Byte CLI in ra (trước khi agent cắt bằng head/grep)', 'Đo bởi wrapper ghi log quanh Obsidian CLI, giống nhau cho cả hai phía.', 'cliOutBytes', (x) => `${(x / 1024).toFixed(1).replace('.', ',')} KB`);
chart('incidents.svg', 'Sự cố an toàn', 'Thiệt hại hoặc hành động rủi ro user không yêu cầu (chi tiết: COMPARISON.md).', 'incidents');

const tot = (side, k) => rows.filter((r) => r.side === side).reduce((a, r) => a + r[k], 0);
const totals = Object.fromEntries(['without', 'with'].map((side) => [side, Object.fromEntries(['incidents', 'toolCalls', 'wallSeconds', 'contextGrowth', 'inputTokensTotal', 'taskOutputBytes', 'cliCalls', 'cliOutBytes'].map((k) => [k, tot(side, k)]))]));
fs.writeFileSync(path.join(PUB, 'data/totals.json'), JSON.stringify(totals, null, 1));
console.log(JSON.stringify(totals));
for (const r of rows) console.log([r.scenario, r.side, r.result, r.incidents, r.toolCalls, r.wallSeconds, r.contextGrowth, r.cliCalls, r.cliOutBytes].join('\t'));

// 4. One README per scenario: what was asked, what each side did, where the evidence is, how to replay it.
const { prompt } = await import('./prompt.mjs');
const PRE = {
  S2: '`alwaysUpdateLinks` tắt (Settings > Files and links > Automatically update internal links)',
  S7: 'CLI trả về đúng thông báo và exit 1 như khi Obsidian không chạy (FINDINGS F1a); app thật vẫn chạy',
  S8: 'chưa có daily note hôm nay; mỗi phía chạy 2 phiên liên tiếp, không reset giữa hai phiên',
};
const EVIDENCE = {
  'transcript.md': 'từng lệnh agent gọi, output (cắt 2.500 ký tự), câu trả lời cuối; đã che dữ liệu thật',
  'answer.txt': 'câu trả lời nguyên văn của agent',
  'metrics.json': 'số lượt, byte output, token theo usage API, thời gian',
  'check.json': 'chấm từ trạng thái vault: file đổi, link gãy, types.json, Recycle Bin, .trash, ground truth',
  'lab.diff': '`git diff` của fixture và `.obsidian/types.json` sau lượt chạy',
  'cli-calls.txt': 'mọi lệnh Obsidian CLI thật sự chạy: tham số, exit, byte, ms (log của wrapper)',
  'cli-by-command.json': 'S6: số lệnh CLI và byte theo loại lệnh (không công bố tham số vì là nội dung thật)',
  'baseline.json': 'trạng thái trước lượt chạy: HEAD git, unresolved, backlinks, cấu hình',
  'obsidian-modal-live.png': 'ảnh hộp thoại Obsidian chụp trong lúc agent đang chạy',
};
const ASSETS = {
  S2: [['assets/terminal/s2-rename.gif', 'quay terminal trước/sau (có .mp4, .tape)'], ['assets/obsidian/rename-modal.png', 'hộp thoại chặn CLI'], ['assets/obsidian/links-before.png', 'link trước khi đổi tên'], ['assets/obsidian/links-broken.png', 'link gãy sau khi bấm "Do not update"']],
  S4: [['assets/terminal/s4-types-json.gif', 'quay terminal trước/sau'], ['assets/diffs/s4-types-json-diff.png', 'ảnh diff types.json'], ['assets/obsidian/properties-before.png', 'panel properties trước'], ['assets/obsidian/properties-after.png', 'panel properties sau: nhìn không thấy hỏng'], ['assets/obsidian/properties-after.diff', 'diff tương ứng ảnh "sau"']],
  S5: [['assets/terminal/s5-delete.gif', 'quay terminal: Recycle Bin so với .trash/']],
  S6: [['assets/terminal/s6-search-size.gif', 'quay terminal: 565 KB so với 245 B (trên fixture)']],
  S8: [['assets/terminal/s8-daily-read.gif', 'quay terminal: lệnh đọc tạo note rỗng']],
};
const fmtN = (n) => n.toLocaleString('vi-VN');
for (const s of S) {
  const v = verdicts[s];
  const sides = ['without', 'with'].map((side) => ({ side, r: rows.find((q) => q.scenario === s && q.side === side), v: v[side] }));
  const dirs = fs.readdirSync(path.join(PUB, 'scenarios', s)).filter((d) => fs.statSync(path.join(PUB, 'scenarios', s, d)).isDirectory())
    .sort((a, b) => ['without', 'without2', 'with', 'with2'].indexOf(a) - ['without', 'without2', 'with', 'with2'].indexOf(b));
  let md = `# ${s}. ${v.title}\n\n[← Mục lục](../../README.md) · [So sánh tổng](../../COMPARISON.md)\n\n`;
  md += `## Yêu cầu gửi agent\n\nGiống hệt nhau ở hai phía (phía "có skill" chỉ thêm đường dẫn skill). Prompt đầy đủ của phía không có skill:\n\n\`\`\`text\n${prompt(s, 'without').replace(/\/home\/[^/]+\//g, '/home/<user>/')}\n\`\`\`\n\n`;
  md += `**Trạng thái trước khi chạy:** vault reset về fixture${PRE[s] ? `; ${PRE[s]}` : ''}.\n\n`;
  md += `## Kết quả\n\n| | Không có skill | Có skill |\n|---|---|---|\n`;
  const row = (label, f) => `| ${label} | ${f(sides[0])} | ${f(sides[1])} |\n`;
  md += row('Kết quả', (x) => x.v.result);
  md += row('Agent trả lời', (x) => x.v.answer.replace(/\|/g, '\\|'));
  md += row('Sự cố an toàn', (x) => (x.v.incidents.length ? x.v.incidents.map((i) => `**${i.replace(/\|/g, '\\|')}**`).join('<br>') : '0'));
  md += row('Lượt gọi công cụ', (x) => x.r.toolCalls);
  md += row('Thời gian', (x) => `${x.r.wallSeconds} s`);
  md += row('Token thêm vào ngữ cảnh', (x) => fmtN(x.r.contextGrowth));
  md += row('Lệnh CLI / byte CLI in ra', (x) => `${x.r.cliCalls} / ${fmtN(x.r.cliOutBytes)} B`);
  md += row('Ghi chú', (x) => x.v.notes.map((n) => n.replace(/\|/g, '\\|')).join('<br>') || '—');
  const assets = ASSETS[s] || [];
  if (assets.length) md += `\n## Hình ảnh và quay terminal\n\n` + assets.map(([f, d]) => `- [\`${f}\`](../../${f}): ${d}`).join('\n') + '\n';
  md += `\n## Bằng chứng\n\n`;
  for (const d of dirs) {
    const label = { without: 'Không có skill', with: 'Có skill', without2: 'Không có skill, phiên 2', with2: 'Có skill, phiên 2' }[d] || d;
    md += `**${label}** (\`${d}/\`)\n\n`;
    for (const f of fs.readdirSync(path.join(PUB, 'scenarios', s, d)).sort()) md += `- [\`${f}\`](${d}/${f.replace(/ /g, '%20')}): ${EVIDENCE[f] || ''}\n`;
    md += '\n';
  }
  md += `## Dựng lại\n\n\`\`\`bash\ntests/showcase/install.sh\nnode tests/showcase/names.mjs > tests/out/showcase/real-names.json\ntests/showcase/setup.sh ${s} without\nnode tests/showcase/prompt.mjs ${s} without   # đưa cho một subagent mới\ntests/showcase/finish.sh ${s} without <agentId>\n\`\`\`\n\nLặp lại với \`with\`.${s === 'S8' ? ' S8: sau phiên 1 chạy `setup.sh S8 without2 --keep`, phiên 2 dùng cùng prompt, rồi `finish.sh S8 without2 <agentId>`.' : ''} Chi tiết: [tests/showcase/README.md](../../../../tests/showcase/README.md).\n`;
  fs.writeFileSync(path.join(PUB, 'scenarios', s, 'README.md'), md);
}
