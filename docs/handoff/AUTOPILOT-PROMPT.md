# Goal: finish every board item an agent can do alone, Obsidian work first

Use this as the goal for an orchestrating agent in `~/projects/obsidian-agentkit`. Reply to the user in Vietnamese. Write code, docs in `tests/`, and commit messages in English; board and plan files stay in Vietnamese, matching their current style.

## Done when
Every open item on [`docs/BACKLOG.md`](../BACKLOG.md) is in exactly one of these states:
- ✅ with evidence;
- waiting on the user, with the agent-side preparation already ✅;
- excluded for a reason written on the board (cost, handed to another agent, real-vault write).

Then stop and report. Do not invent new work to stay busy.

## Phase 1: triage the board (you, sequentially, no sub-agents)

Read `docs/BACKLOG.md`, every plan in `docs/plans/`, and `docs/GATES.md`. For each item that is not ✅ or ❌, classify it:

| Class | Meaning | Action |
|---|---|---|
| **A: agent alone** | Can be done and verified without the user | Queue it |
| **M: mixed** | Has agent work (code, scripts, dry-runs, test fixtures, docs) and a step that needs the user (hardware, a decision, the real vault, watching a live run) | Split it into two child items, `Ex.ya` (agent prep, class A) and `Ex.yb` (test with the user, needs the user). Queue `Ex.ya` |
| **U: user only** | Nothing to prepare | Leave it; make sure it is listed under "Cần user" |
| **X: excluded** | Spends money or needs keys (E8.13), is handed to another agent (E9, unless the user says otherwise), or writes to the real vault | Note the reason on the board |

How to split a mixed item:
- Add both child rows to the plan's table and to the board. The parent row's "Bằng chứng / ghi chú" says "tách thành a/b".
- `a` must have its own "Xong khi" that the agent can verify. For example: "script and dry-run pass on `vault-copy`", or "checklist written and walked through once on the test vault".
- `b` says exactly what the user does and how long it takes.
- Keep the counts in "Tổng quan tiến độ" correct, and update the epic's progress bar.

**Order of the queue:**
1. Items that talk to Obsidian directly: CLI probes, measurements on a test vault, bridge features, scenario runs. The user's Obsidian must be running for these, and they are the reason the toolkit exists.
2. Then the remaining items by priority (P1, P2, P3), and by ID within the same priority.

Commit the triaged board on its own before starting any work (`docs: triage board for autopilot`). Show the user the queue in a short Vietnamese table, then go on without waiting.

## Phase 2: one sub-agent per queued item

Launch one sub-agent per item. Give each a self-contained brief:
- the item ID and its "Xong khi";
- the files to read first;
- the safety rules below, copied in full;
- the rule to verify its own work.

Each sub-agent must report back:
- changed files;
- evidence, meaning test output or numbers;
- what it could not finish.

**Concurrency:**
- **Obsidian items run one at a time.** There is a single Obsidian app, write probes change vault settings, and the vaults are shared.
- Pure code or docs items may run in parallel, in separate git worktrees, at most 3 at once.
- Never run an Obsidian item while an E8 or E9 matrix run is active.

**After each sub-agent returns:**
- Check its evidence yourself: re-run its tests, then read the diff.
- Then update the board, the plan and `docs/GATES.md` (one dated section per item: what was done, evidence, open points).
- Run:
  - `node --test tests/*.test.mjs`;
  - `node tests/size-check.mjs`;
  - `node tests/showcase/privacy-scan.mjs`.
- Commit and push. One commit per item. End the message with the `Co-Authored-By` line your environment gives you.
- If the evidence does not hold, send the sub-agent back once with the exact gap. If it fails twice, mark the item ⏸ with the reason and move on.

If an item turns out to need the user after all, split it as in Phase 1, finish the `a` part, and continue.

## Safety rules (copy into every sub-agent brief)

1. **Never touch the real vault.** Its name is not in this repo.
   - The bridge remembers the last `--preflight` vault for 12 h, and that may be the real vault.
   - So **every** `obs.mjs` call must name its vault: `--preflight --vault <test vault>` first, or `OBS_VAULT=<test vault>` on each call.
   - Before any write, check that `obs vault info=path` is one of the test vaults below.
2. **Test vaults:**

   | Vault | Use | Reset |
   |---|---|---|
   | `vault-synth` | Synthetic. The only vault allowed for third-party models | `node tests/models/run.mjs calibrate` |
   | `vault-copy` | A copy of a real vault | Claude only, never a third-party model; git in the vault |
   | `obsidian-agentkit-drive-test` | Test vault on Google Drive | Git dir outside Drive, under `~/.local/state/obs-e2/` |

   Reset after every write. Leave each vault clean (`git status` empty) when done.
3. **Do not click or answer dialogs in the user's Obsidian windows,** except for a probe that is designed to do so (P15).
4. **Secrets** live in `~/.config/obsidian-agentkit/*.env`. Never print, log or commit them. No item in this goal needs OpenRouter.
5. **The repo is public.** No real note names, vault names, personal folder paths, user names or e-mail addresses. Run `node tests/showcase/privacy-scan.mjs` before every commit.
6. **No new spending.** Claude subscription runs are fine; paid API calls are not.
7. **Destructive git** (`reset --hard`, `clean`) only inside a test vault, on a named path.

## Phase 3: final report to the user (Vietnamese)

- **Done:** one line per item, with its commit.
- **Split items:** the `b` steps waiting for the user. For each one, say what the user does and about how long it takes.
- **Excluded items:** each with its reason.
- **Changes the user should know about:** for example, a new bridge command, a new probe, or a changed `TESTED_CLI`.
- **Board progress:** before and after.
