# Scenario tests (YARDSTICK.md tests 1-10, 11 cases)

Each case is one task given to a **fresh agent session** that has only the `obsidian-connect` skill as guidance. The case is judged by `git diff` in the vault copy plus file-only ground truth (`tests/ground-truth/gt.mjs`), never by the agent's own claim.

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
| 1 | "List every note that links to `_agentkit-lab/Target Note.md`. Say if the list might be incomplete." | The set equals `gt.mjs backlinks` (9 files: alias-display, heading, block, embed, `%20` markdown, other folder, Vietnamese, frontmatter list, plain). The code-block file is excluded. The alias-name file is either not listed or flagged as unresolved. |
| 2 | "Rename `_agentkit-lab/Target Note.md` to `Target Renamed`." *(user pre-confirms)* | Exactly 1 renamed file plus link-text edits in referrers (`git diff --stat`); `obs unresolved total` unchanged; `gt.mjs backlinks` on the new path = 9 |
| 3 | "In `_agentkit-lab/props/Property Note.md` set `status` to `review`, add `next` to the `tags` list, and set `due` to 2026-03-15T10:00." | `gt.mjs yaml` valid; `status` string, `tags` list of 3, `due` changed; every other key byte-identical (`git diff`); `types.json` unchanged |
| 4 | "How many open tasks are there in the whole vault?" | The answer equals `gt.mjs tasks <copy>` open count (114); an active-file-only answer fails |
| 5 | "Append `- [ ] call the bank` to today's daily note." Then the same again in a 2nd session. | The note is at the profile's folder/format; the line appears once after both runs; no new tab (`obs tabs` unchanged) |
| 6 | "Find my notes about Đà Nẵng and give me the three most relevant." (real copy content) | ≤ 4 calls to `obs` or grep, ≤ 4k tool-output tokens; the answer names notes that do contain the phrase |
| 7 | With `OBS_CLI=/nonexistent/Obsidian.com`: do case 1, then case 3. | CLI unreachable is detected in ≤ 1 call; no retry loop; the answers are labelled approximate; case 1's list matches ground truth minus the known file-mode gaps; case 3 passes its own check |
| 8a | "In `_agentkit-lab/long/Long CRLF Note.md`, replace the 3rd line under `## Section 17` with `Edited line.`" | The agent did not read the whole file (bounded reads only); `gt.mjs crlf` gives `lf: 0`; the diff is 1 line |
| 8b | "Rename the tag `#proj` to `#project/active` across the vault." *(user pre-confirms after the dry-run)* | A dry-run listing is shown before any write; `#projects`, the code-block and inline-code `#proj`, and the heading `# proj` are untouched; frontmatter `proj` entries are updated; `obs tag name=proj total` (exact) has no plain `#proj` left |
| 9 | Cases 1 and 4 from a Windows-native shell (PowerShell) vs WSL | Same answers; latency recorded per call |
| 10 | Bulk edit under Google Drive sync | **Skipped by user decision**: needs a Drive test folder |
