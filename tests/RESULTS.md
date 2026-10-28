# Scenario test results

Cases and judging: `tests/scenarios/README.md`.
- Each run is a fresh subagent session (Claude Code general-purpose subagent, same model as the builder) that has only the skill path as guidance and was told not to read the repo docs or tests.
- **Turns** = tool calls the agent reported.
- **Tokens** = an estimate of tool output: (bridge output bytes from `OBS_LOG` + bytes of file lines the agent reported reading) ÷ 4. It does not include SKILL.md/reference reads (those are skill load, measured by `tests/size-check.mjs`).
- Raw logs are in `tests/out/` (gitignored, may contain note text).
- New CLI versions add rows below; rows are never edited.

| Date | Env | CLI | Case | Run | Result | Turns | Tokens (est) | Evidence |
|---|---|---|---|---|---|---|---|---|
| 2026-10-22 | WSL | 1.14.4 | 1 backlinks | 1 | **pass**: 9 files = ground truth; code-block excluded; incompleteness explained | 5 | ~300 + unlogged grep | `gt.mjs backlinks` total 9; bridge log 5 calls / 1,215 B |
| 2026-10-22 | WSL | 1.14.4 | 2 rename | 1 | **pass**: `--rename` verified 9→9 backlinks, unresolved 87→87; dry-run shown first | 9 | ~380 + unlogged cat/grep | `git diff --stat`: 1 rename + 9 link lines; `gt.mjs backlinks` new path 9. Note: agent made an empty snapshot commit (skill now says: record HEAD instead) |
| 2026-10-22 | WSL | 1.14.4 | 3 property edit | 1 | **pass**: YAML valid; status string, tags list of 3, due changed; `types.json` unchanged | 4 | ~200 | `git diff`: 3 lines in 1 file; `gt.mjs yaml` valid |
| 2026-10-22 | WSL | 1.14.4 | 4 open tasks | 1 | **pass** (answer 114 = ground truth) but **token waste**: listed all tasks after `total` | 4 | ~6,100 | `gt.mjs tasks` open 114; bridge log 24,499 B. Skill fixed: "for a count stop at `total`" |
| 2026-10-22 | WSL | 1.14.4 | 4 open tasks | 2 | **pass** after fix: 114 | 3 | ~60 | bridge log 2 calls / 248 B |
| 2026-10-22 | WSL | 1.14.4 | 5 daily append | 1 (2 sessions) | **pass**: note at root `YYYY-MM-DD.md` (profile default), line present once after both sessions, no tab opened | 6 + 5 | ~80 + ~70 | file has 1 occurrence; `tabs` md5 unchanged. Found: `daily:read` creates an empty note (F9j, probe P29; skill fixed) |
| 2026-10-22 | WSL | 1.14.4 | 6 search budget | 1 | **pass**: 3 tool calls (8 bridge invocations batched in 2 Bash calls), ~960 tokens ≤ 4k; results contain the phrase | 4 | ~960 | bridge log 3,824 B. Agent found diacritics variants matter (skill fixed: search accented + unaccented) |
| 2026-10-22 | WSL | 1.14.4 | 7 fallback | 1 | **pass**: unreachable detected in 1 bridge call (exit 2), no retry; case 1 list correct and labelled approximate; case 3 edit 3 lines | 8 | ~30 bridge + unlogged grep | bridge log: 1 call `--preflight` exit 2; `git diff` 3 lines. Agent's shell hook (rtk) broke `rg` (environment; file-mode now names a grep fallback) |
| 2026-10-22 | WSL | 1.14.4 | 8a CRLF section edit | 1 | **pass**: outline + 8-line ranged read, 1-line diff, CRLF kept | 5 | ~680 | `gt.mjs crlf` 2974/2974 CRLF, lf 0; `git diff --stat` 1+/1- |
| 2026-10-22 | WSL | 1.14.4 | 8b tag rename | 1 | **pass**: dry-run listed 4 edits + 2 skips first; exact `#proj` 0 left; `#projects`, `#proj/sub`, code untouched; frontmatter updated | 10 | ~2,100 | `gt.mjs tags proj` 0/0, `project/active` 2 body + 2 frontmatter; diff 4 files 4 lines. Verify rule fixed for kept nested tags |
| 2026-10-22 | WSL + PowerShell | 1.14.4 | 9 WSL vs Windows | 1 | **partial**: bridge gives identical answers (backlinks 9, open tasks 114) from PowerShell and WSL; no Windows-native *agent* session was available | — | — | PowerShell 372/254 ms vs WSL 198/204 ms per call (bridge incl. node start) |
| 2026-10-22 | — | — | 10 Drive sync bulk edit | — | **not run**: skipped by user decision (no Drive test folder) | — | — | — |
| 2026-10-28 | WSL, vault on `G:` (Google Drive for desktop) | 1.15.0 | 10 Drive sync bulk edit | 1 | **pass**: bridge `--append` on 6 notes, then `--rename` of the target (9 more files rewritten); after 3 min of sync no conflict copy (`(1)`, "conflict"), 25 notes, backlinks 9→9, unresolved 2→2 | 7 bridge calls | — | Run by the builder with the bridge directly, not a subagent. Single device, so a second editor (phone) was not part of the test. `git status`: 13 modified + 1 rename, nothing else |
| 2026-10-28 | WSL | 1.15.0 | 12 Tasks: add task with due date, list open | 1 with skill | **pass**: line `- [ ] Pay the electricity bill 📅 2026-11-05` appended as one line; 3 open tasks listed (`[/]` named as in progress, `[-]`/`[x]` excluded); used `status= ` filter | 3 | — | `e65-plugins.mjs` checks: one new line, syntax, 5 other lines intact, only `_agentkit-lab/e65/` changed; reset to clean |
| 2026-10-28 | WSL | 1.15.0 | 12 Tasks (without skill, comparison) | 1 without | **fail on the open count**: line and syntax correct, but 4 open (counted the `[/]` task as open) and a blank line was inserted before the new task | 2 | — | same checks pass; answer differs from the skill's definition of open (`[ ]` only, F12) |
| 2026-10-28 | WSL | 1.15.0 | 13 Templater: note from a template with `<% %>` | 1 with skill | **pass**: `create template=` failed (`No template folder configured`), agent rendered `{{title}}` and both tags by hand, wrote the note with `content=`, and said the CLI does not fill Templater tags. It used the meeting date for `tp.date.now`, not today, and said so | 5 | — | note has no `<%`/`{{` left; trigger `false` and core folder unset before, after and after reset |
| 2026-10-28 | WSL | 1.15.0 | 13 Templater (without skill, comparison) | 1 without | **pass**: same route; said Templater did not run and that it resolved the tags by hand | 4 | — | same checks |

## Summary for CLI 1.14.4 (2026-10-22)

- **Passed:** 10 of 11 cases on WSL (1, 2, 3, 4, 5, 6, 7, 8a, 8b, and 9 at bridge level). Every case passed on its first run, so none needed the 3-run repeat.
- **Partial:** case 9. There is no Windows-native agent session, only bridge calls from PowerShell.
- **Not run:** case 10 (user decision).
- **Fixed during the runs** (skill text only; the bridge was unchanged):
  - stop at `total` for count questions;
  - search the accented and unaccented spellings;
  - backlink coverage notes;
  - date-like properties are edited in the file;
  - do not use `daily:read` to check for a note;
  - snapshot when the tree is already clean;
  - tag-rename verification with kept nested tags;
  - conflict-copy check by listing before and after;
  - a grep fallback in file mode.
- **Known gaps** (see `docs/GATES.md`, gate 3):
  - the token estimates miss output from the agent's own grep/cat;
  - Windows-native agent not tested;
  - Google Drive Recycle Bin and sync conflicts not tested;
  - admin terminal not tested.

## E6.5 plugin cases (CLI 1.15.0, 2026-10-28)
- Cases 12 and 13 ran once with and once without the skill, on `vault-copy` only, with `tests/scenarios/e65-plugins.mjs`. Both with-skill runs passed first time. Tokens were not estimated (the runner reads the transcript, not the bridge log).
- Case 13 ran with the Templater trigger off (the default), so it did not need any setting change; the trigger-on behaviour stays covered by probe P31.
- Observation, not a skill fault: the with-skill agent rendered `tp.date.now()` as the meeting date from the note name, not today's date; it said so. `references/plugins.md` says "render them yourself" but does not say what `tp.*` values to use.
- Case 13 first with-skill run (4 turns, same outcome) was repeated after the judge check was widened (tags rendered by the agent count as a pass); only the second is listed.
