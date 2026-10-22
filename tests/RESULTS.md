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
