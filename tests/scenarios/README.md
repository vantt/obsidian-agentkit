# Scenario tests (YARDSTICK.md tests 1-10, 11 cases)

Each case is one task given to a **fresh agent session** that has only the `obsidian-connect` skill as guidance. The case is judged by `git diff` in the vault copy plus file-only ground truth (`otf truth` from `obsidian-test-fixture`, see `tests/otf.mjs`), never by the agent's own claim.

## Common setup per run
- Vault copy: a git repo with the fixture `_agentkit-lab/` committed (see `tests/compat/README.md`). Before each run: `git -C <copy> checkout -q . && git -C <copy> clean -fdq -- _agentkit-lab`, then remove any untracked daily note in the root. Wait until `obs backlinks path="_agentkit-lab/Target Note.md" total` prints 9.
- Agent environment:
  - `OBS_VAULT=<copy name>`
  - `OBS_LOG=tests/out/<case>-<run>.jsonl`
  - the skill folder path
  - the task text below
  - "Do not read the obsidian-agentkit repo docs or tests"
- **Turns** = tool calls the agent made, as it reports them, cross-checked with the log.
- **Tool-output tokens (estimate)** = (bridge output bytes from `OBS_LOG` + bytes of file content the agent read, as reported) ÷ 4.
- Record one row per run in `tests/RESULTS.md`: date, environment, CLI version, pass/fail, turns, token estimate, evidence. New versions add rows; nothing is overwritten.

## Cases
| # | Task given to the agent | Pass when |
|---|---|---|
| 1 | "List every note that links to `_agentkit-lab/Target Note.md`. Say if the list might be incomplete." | The set equals `otf truth backlinks` (9 files: alias-display, heading, block, embed, `%20` markdown, other folder, Vietnamese, frontmatter list, plain). The code-block file is excluded. The alias-name file is either not listed or flagged as unresolved. |
| 2 | "Rename `_agentkit-lab/Target Note.md` to `Target Renamed`." *(user pre-confirms)* | Exactly 1 renamed file plus link-text edits in referrers (`git diff --stat`); `obs unresolved total` unchanged; `otf truth backlinks` on the new path = 9 |
| 3 | "In `_agentkit-lab/props/Property Note.md` set `status` to `review`, add `next` to the `tags` list, and set `due` to 2026-03-15T10:00." | `otf truth yaml` valid; `status` string, `tags` list of 3, `due` changed; every other key byte-identical (`git diff`); `types.json` unchanged |
| 4 | "How many open tasks are there in the whole vault?" | The answer equals `otf truth tasks <copy>` open count (114); an active-file-only answer fails |
| 5 | "Append `- [ ] call the bank` to today's daily note." Then the same again in a 2nd session. | The note is at the profile's folder/format; the line appears once after both runs; no new tab (`obs tabs` unchanged) |
| 6 | "Find my notes about Đà Nẵng and give me the three most relevant." (real copy content) | ≤ 4 calls to `obs` or grep, ≤ 4k tool-output tokens; the answer names notes that do contain the phrase |
| 7 | With `OBS_CLI=/nonexistent/Obsidian.com`: do case 1, then case 3. | CLI unreachable is detected in ≤ 1 call; no retry loop; the answers are labelled approximate; case 1's list matches ground truth minus the known file-mode gaps; case 3 passes its own check |
| 8a | "In `_agentkit-lab/long/Long CRLF Note.md`, replace the 3rd line under `## Section 17` with `Edited line.`" | The agent did not read the whole file (bounded reads only); `otf truth crlf` gives `lf: 0`; the diff is 1 line |
| 8b | "Rename the tag `#proj` to `#project/active` across the vault." *(user pre-confirms after the dry-run)* | A dry-run listing is shown before any write; `#projects`, the code-block and inline-code `#proj`, and the heading `# proj` are untouched; frontmatter `proj` entries are updated; `obs tag name=proj total` (exact) has no plain `#proj` left |
| 9 | Cases 1 and 4 from a Windows-native shell (PowerShell) vs WSL | Same answers; latency recorded per call |
| 10 | Bulk edit under Google Drive sync | **Skipped by user decision**: needs a Drive test folder |

## E3.5 write check (`tests/e35-write-check.mjs`)
Run before opening write access on a real vault, on a test vault first:
`node tests/e35-write-check.mjs --vault <test vault> [--note <path.md>] [--wait 180] [--tag <text>]`
- Does 10 writes through the bridge (5 `--daily-append-once`, 5 `--prop-set` of `e35_check` on `--note`), reads each back from the file on disk (the Obsidian CLI view is printed beside it), waits `--wait` seconds (default 180), then lists the vault folder and fails on any new file named like a Google Drive conflict copy (`name (1).md`, "conflict", "- Copy"). Exit 0 = 10/10 and no conflict copy.
- Refuses (exit 2, nothing written) unless `vault info=path` ends in `vault-synth`, `vault-copy` or `obsidian-agentkit-drive-test`. The allowlist is hard-coded; it is the guard that keeps this off a real vault.
- Measured on the Drive vault (CLI 1.15.0): the bridge's file edits are not seen by Obsidian, even after 3 minutes (`obsidian=stale`), and after an outside change (a reset) Obsidian's view is out of date, so the next `daily:append` fails with ENOENT. Run `obs reload` and wait about 45 s after every reset, before the next run. For that reason the pass test reads the file, not the CLI.
- It does not reset the vault. Reset afterwards: in the vault (git dir outside Drive for the Drive vault), `git checkout -q -- <note>`, then remove the new daily note (`git clean -fdq -- <daily note>`), and check `git status` is empty, then `obs reload`. If the shell cannot read the Drive folder (stale `/mnt/g`), run the script with Windows `node.exe` through PowerShell. From WSL with a dead `/mnt/g` mount, run Windows git with `-c core.fileMode=false --git-dir=<UNC path of the .git dir> --work-tree=<vault>`.
- Offline test of the guard and the checks: `node --test tests/e35-write-check.test.mjs`.

## E3.6a bulk-operation rehearsal (`tests/e36-bulk-rehearsal.mjs`)
Run before the first bulk operation on a real vault (E3.6b), on a test vault with a clean git tree:
`node tests/e36-bulk-rehearsal.mjs --vault <test vault> [--wait 45] [--index-timeout 60]`
- Creates its own fixtures under `_agentkit-lab/e36/` (2 notes to rename/move, 2 referrers, 2 notes with a tag), then for rename, move and tag rename: preview first and check nothing changed, run it for real, check `unresolved total` is unchanged and the referring notes were rewritten, and check the bridge's git snapshot (commit `obsidian-connect: snapshot before ...` holding the pre-state, plus the copies in `.trash/obsidian-connect-snapshots/`).
- Rename and move have no dry-run mode in the bridge; their preview is `--backlinks` (the notes Obsidian will rewrite). Only `--tag-rename` has a real dry run (`NOT DONE: dry run`).
- Resets itself: `git reset --hard` to the starting commit and `git clean` of the fixture and snapshot folders (named paths, test vault only), `git status` empty, `obs reload`, wait `--wait` seconds, `unresolved total` back to its start value.
- Refuses (exit 2, nothing written) unless `vault info=path` ends in a test vault (same allowlist as the write check), the folder is a git work tree, and the tree is clean. Exit 0 = all checks pass and the vault is clean.
- Offline test (guard, checks and a full run against the fake CLI): `node --test tests/e36-bulk-rehearsal.test.mjs`.
