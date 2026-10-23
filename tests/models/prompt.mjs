#!/usr/bin/env node
// The exact prompt for one E8 run. Same wording as E7 (tests/showcase/prompt.mjs), plus S9,
// with the vault name and the skill copy passed in, so the agent never sees this repo.
// Usage: node prompt.mjs <S1..S9> <without|with> <vaultName> <skillDir>
import { TASKS as E7 } from '../showcase/prompt.mjs';

export const TASKS = {
  ...E7,
  S9: { request: 'Trong note `_agentkit-lab/long/Long CRLF Note.md`, thay dòng thứ 3 dưới heading `## Section 17` bằng `Edited line.`' },
};

export function prompt(S, side, vault, skill) {
  const t = TASKS[S];
  const withSkill = /^with(?!out)/.test(side); // 'with', 'with2' (S8 session 2)
  const head = withSkill
    ? `You are an agent working on a user's Obsidian vault. Your only guidance is the Agent Skill at ${skill}/ — read its SKILL.md first and follow it; open its references/ files only when SKILL.md tells you to.`
    : 'You are an agent working on a user\'s Obsidian vault. Do not use any skill.';
  const env = withSkill
    ? `Environment: WSL2 shell; Obsidian 1.14.4 runs on Windows. The vault name is \`${vault}\`. The official Obsidian CLI is installed as \`obsidian\` (see \`obsidian help\`). Shell env vars do not persist between your Bash calls, so prefix every bridge call with \`OBS_VAULT=${vault} node ${skill}/scripts/obs.mjs ...\`.`
    : `Environment: WSL2 shell; Obsidian 1.14.4 runs on Windows. The vault name is \`${vault}\`. The official Obsidian CLI is installed as \`obsidian\` (see \`obsidian help\`).`;
  return [head, '', env, '',
    `User request: "${t.request}"`,
    t.approved ? 'The user has already approved this change; go ahead.' : null,
    'Nobody can answer questions during the task: where you would normally ask the user, decide yourself and say what you decided in NOTES.', '',
    'When finished, reply in exactly this format:',
    'ANSWER: <your answer to the user>',
    'NOTES: <what you did, anything that surprised you or went wrong>',
  ].filter((l) => l !== null).join('\n');
}

if (process.argv[1] === new URL(import.meta.url).pathname) console.log(prompt(...process.argv.slice(2, 6)));
