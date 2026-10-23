#!/usr/bin/env node
// Print the exact prompt given to the fresh subagent for one showcase run.
// Usage: node prompt.mjs <S1..S8> <without|with>
// Both sides get the same request, vault name and CLI; only the "with" side gets the skill path.
import path from 'node:path';

export const TASKS = {
  S1: { request: 'Trong cả vault có bao nhiêu task chưa xong?' },
  S2: { request: 'Đổi tên note `_agentkit-lab/Target Note.md` thành `Target Renamed`.', approved: true },
  S3: { request: 'Đổi tag `#proj` thành `#project/active` trên toàn vault.', approved: true },
  S4: { request: 'Trong note `_agentkit-lab/props/Property Note.md`, thêm `next` vào danh sách `tags` và đặt `rating` thành 5.' },
  S5: { request: 'Xoá note `_agentkit-lab/Target Note.md`, tôi không cần nó nữa.', approved: true },
  S6: { request: 'Tìm các note của tôi về Đà Nẵng và cho tôi 3 note liên quan nhất.' },
  S7: { request: 'Liệt kê mọi note có link tới `_agentkit-lab/Target Note.md`. Nói rõ nếu danh sách có thể chưa đủ.' },
  S8: { request: 'Thêm dòng `- [ ] gọi ngân hàng` vào daily note hôm nay.' },
};

export function prompt(S, side) {
  const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
  const skill = path.join(repo, 'skills/obsidian-connect');
  const t = TASKS[S];
  const withSkill = /^with(?!out)/.test(side); // 'with', 'with2' (S8 session 2)
  const head = withSkill
    ? `You are an agent working on a user's Obsidian vault. Your only guidance is the Agent Skill at ${skill}/ — read its SKILL.md first and follow it; open its references/ files only when SKILL.md tells you to. Do NOT read anything else under ${repo}.`
    : `You are an agent working on a user's Obsidian vault. Do NOT read anything under ${repo} (an unrelated project) and do not use any skill.`;
  const env = withSkill
    ? `Environment: WSL2 shell; Obsidian 1.14.4 runs on Windows. The vault name is \`vault-copy\`. The official Obsidian CLI is installed as \`obsidian\` (see \`obsidian help\`). Shell env vars do not persist between your Bash calls, so prefix every bridge call with \`OBS_VAULT=vault-copy node ${skill}/scripts/obs.mjs ...\`.`
    : 'Environment: WSL2 shell; Obsidian 1.14.4 runs on Windows. The vault name is `vault-copy`. The official Obsidian CLI is installed as `obsidian` (see `obsidian help`).';
  return [head, '', env, '',
    `User request: "${t.request}"`,
    t.approved ? 'The user has already approved this change; go ahead.' : null,
    'Nobody can answer questions during the task: where you would normally ask the user, decide yourself and say what you decided in NOTES.', '',
    'When finished, reply in exactly this format:',
    'ANSWER: <your answer to the user>',
    'NOTES: <what you did, anything that surprised you or went wrong>',
  ].filter((l) => l !== null).join('\n');
}

if (process.argv[1] === new URL(import.meta.url).pathname) console.log(prompt(process.argv[2], process.argv[3]));
