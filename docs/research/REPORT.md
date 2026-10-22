# Report: Obsidian agent skills vs the confirmed goal

Date 2026-10-22. Goal and criteria: `docs/distillery/distill.yaml`, `YARDSTICK.md`. 37 lessons in `docs/distillery/lessons/`, all `candidate`. Scores below are my judgement from source reading; **no scenario test has been run**.

## Sources and pinned commits

| Source | Commit | Skill text read |
|---|---|---|
| kepano/obsidian-skills | 3ccff5338ea7 | 6 skills, CLI skill 106 lines (~800 tokens) |
| jackal092927/obsidian-official-cli-skills | ab6533943454 | 1 skill 162 lines (~1.8k) + test report and 57-row matrix |
| pablo-mano/Obsidian-CLI-skill | d7782314eadf | SKILL 289 lines (~3.4k) + reference 651 lines (~5.4k) |
| Roasbeef/obsidian-claude-code | 03a22a8b563d | vault-search skill 169 lines (~1.4k) + plugin MCP server |

## Criteria scores (0-5 each, weighted to 100)

| # | Criterion (weight) | kepano | jackal | pablo | roasbeef |
|---|---|---|---|---|---|
| 1 | Silent-failure coverage (15) | 1.5 | 4 | 3 | 0.5 |
| 2 | Destructive-op safety (12) | 0.5 | 2.5 | 1 | 1 |
| 3 | Works without CLI / env (12) | 0.5 | 2.5 | 2 | 0 |
| 4 | Always-loaded cost, parts (10) | 5 | 3.5 | 1.5 | 3 |
| 5 | Output economy (10) | 1.5 | 3 | 2.5 | 3 |
| 6 | Link integrity (10) | 1.5 | 2 | 1.5 | 0 |
| 7 | Routing clarity (8) | 1 | 2.5 | 2 | 1 |
| 8 | Coverage of 15 jobs (8) | 2.5 | 3 | 2.5 | 1 |
| 9 | Vault conventions (7) | 0.5 | 1 | 0.5 | 1 |
| 10 | Read-back checks (5) | 1.5 | 1 | 0 | 0 |
| 11 | Evidence and maintenance (3) | 1 | 4.5 | 2 | 2.5 |
| | **Total /100** | **31** | **55** | **36** | **22** |

Nobody scores above 55. Criteria 2, 3, 6, 9 and 10 are weak everywhere. No source mentions WSL, Google Drive or CRLF; none teaches a ranged read, a section edit or a tag rename.

## Conflicts between sources (resolve by test, do not copy either side)

- `search format=json matches`: jackal says it returns line-numbered matches; pablo says `matches` is a no-op and json returns paths only.
- Plain `tasks`: jackal says active file only; pablo says it equals `tasks all` in v1.12.
- All jackal evidence is CLI 1.12.1 from 2026-02-13.

## Top lessons (full list: `distill.mjs rank --all`)

1-6 tie at 36: append-over-overwrite-guard, create-silent-no-ui, file-path-active-target, link-graph-commands, search-bounded-structured-output, scoped-task-and-tag-queries. Next: error-text-exit-zero (30), count-first-total-flag, daily-note-commands-and-prepend, skill-load-cost-profile (27).

## Recommended build (components, not a repo)

1. **Base:** kepano `obsidian-cli` structure (small, defers to `obsidian help`), dropping its plugin-dev half.
2. **Add from jackal:** gotcha list, preflight, fallback table, never-without-request list. Re-test on the installed CLI version first.
3. **Add from pablo:** `property:set` list trap, `template:insert` active-file trap, Windows wrapper idea (adapt to WSL), history and diff recovery.
4. **On demand:** kepano `obsidian-bases`, `json-canvas`, `defuddle`; skip `knap` unless bulk generation is needed.
5. **Build ourselves (no prior art):** WSL to Windows bridge, vault profile from `.obsidian/*.json`, Google Drive-aware snapshot and bulk-edit protocol, rename-keeps-links proof, ranged-read and section-edit guidance, a wrapper that parses stdout for `Error:` and empty results.
6. **Skip:** roasbeef as a skill. Only its idea of a frontmatter SQL index and folder exclusions is worth a note.

## Not yet verified

- CLI reachable from WSL and per-call latency; whether `move` and `rename` update links; where `delete` sends files with Drive; whether the 13 silent failures persist on the current CLI.
- Scenario tests 1-10 in `YARDSTICK.md`.
- Lessons stay `candidate`; none decided by the user.
