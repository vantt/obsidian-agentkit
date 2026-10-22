# Yardstick: agent skills for Obsidian

Drafted with Opus before any repo was analyzed. Goal and domains live in `docs/distillery/distill.yaml`; this file holds priorities, criteria and tests.

## User decisions (2026-10-22)

1. Obsidian runs on **Windows**. Best path: call the CLI from Windows; must also work from **WSL** (we may build a wrapper).
2. Agent autonomy: single-note create/edit is free. Rename, move, delete, or any change to >5 files needs dry-run + confirmation. Delete always goes to `.trash`.
3. Vault is synced by **Google Drive**. Assume sync is active: avoid whole-file rewrites, expect conflicts, snapshot before bulk ops.
4. Features in use: **all** (Bases, Canvas, Templater, Dataview, Tasks, web clipping).
5. Deliverable shape: **generic routing skill + generated vault profile** (~30 lines from `.obsidian/*.json`).

## Priority when wants conflict

accurate (data safety, then completeness) > cheap > fast > easy.
Fast and cheap move together: treat as "turns x tool-output tokens".

## Framing rules

- Score components of each candidate, not whole repos. Likely result: own thin routing skill + borrowed parts.
- MCP servers: compare on the same jobs; setup and schema cost go under effort.
- Tokens are mostly tool output, not skill size.
- Working without the CLI is first-class (WSL has no `obsidian` on PATH).

## Size budget

- description <= ~60 words; SKILL.md body <= ~100 lines (~1.5k tokens); each reference <= 2-3k tokens; typical task loads <= 3k tokens of skill text.

## Criteria (weights sum to 100)

| # | Criterion | Weight | Evidence from repo |
|---|---|---|---|
| 1 | Silent-failure / gotcha coverage | 15 | known CLI traps handled (`all` scope, `silent`, json/YAML quirk, search format, `Error:` with exit 0) + grep-incompleteness warning |
| 2 | Safety protocol for destructive ops | 12 | dry-run, snapshot/git, delete-to-trash, overwrite guard, confirm thresholds |
| 3 | Works without CLI / environment robustness | 12 | preflight, file-only path, WSL/Windows, sync awareness |
| 4 | Always-loaded cost, loading in parts | 10 | description words, SKILL.md lines/tokens, reference split, overlapping skills |
| 5 | Output-economy guidance | 10 | `limit=`, `format=paths/json`, `total`, ranged reads, exclusion globs |
| 6 | Link integrity | 10 | rename via Obsidian, link-style detection, alias/heading/embed forms |
| 7 | Routing clarity | 8 | decision table task -> mechanism with reason |
| 8 | Coverage of the 15 jobs | 8 | count of jobs with concrete instructions |
| 9 | Vault-convention awareness | 7 | reads app.json, daily-notes.json, types.json, templates, property names |
| 10 | Read-back checks after writes | 5 | explicit verification steps, exit code + output check |
| 11 | Evidence and maintenance | 3 | tests, version pins, recent commits |

Mapping to distill scores: relevance = domain/job hit; impact = failure-cost tier; evidence = tested > documented with example > claimed; effort = adoption cost (deps, setup, always-loaded tokens, rewrite needed).

## 15 jobs

1 find notes about X · 2 read part of long note · 3 list backlinks · 4 update frontmatter property · 5 append to daily note · 6 rename/move + fix links · 7 create from template · 8 query a Base · 9 edit one section of long note · 10 rename a tag everywhere · 11 list open tasks vault-wide · 12 create a canvas · 13 clip a web page · 14 find orphans/unresolved · 15 write new note with links.

Pattern: files win on content edits and bounded reads; Obsidian (CLI) wins where its link/metadata index or plugin behaviour is needed (3, 6, 11, 14, 5, 7, 8).

## Failure modes, by damage

1 data loss · 2 link-graph damage · 3 silent wrong answers · 4 metadata corruption · 5 convention drift · 6 token blowups · 7 environment brittleness (WSL, CLI absent) · 8 UI side effects · 9 trigger misfire. Added by user's setup: Google Drive sync conflicts (under 1).

## Scenario tests (git-tracked copy of vault, same model, 3 runs, record tokens + turns, judge by diff + ground-truth script)

1. Backlinks complete: alias, heading, embed, %20 markdown link, other folder; code-block link excluded; says so if incomplete.
2. Rename keeps links: >=5 referrers; zero new unresolved; diff limited to renamed file + link text.
3. Property edit: list/date/quoted values; YAML parses; only that key changes; no variant keys.
4. Open tasks vault-wide: count equals ground truth; active-file-only is a fail.
5. Daily note append when missing: right folder/format/template; no window; no duplicate on rerun.
6. Search budget: 1000+ notes, <= 4k tool-output tokens, <= 4 calls; include Vietnamese diacritics query.
7. Fallback: CLI unreachable detected in <= 1 call; tests 1 and 3 done via files with limits; no hang/retry loop/false "none".
8. (a) Section edit in 3,000-line CRLF note, no full read, endings preserved. (b) Tag rename `#proj` -> `#project/active`: dry-run first; `#projects` and code blocks untouched; frontmatter tags updated.

Extra for this setup: 9. Same tests run from WSL via bridge vs from Windows directly: compare latency and correctness. 10. Bulk edit under Google Drive sync: no conflict copies produced.

## Unverified assumptions (measure, do not assume)

- CLI reachable from WSL through interop; per-call latency.
- CLI `move`/`rename` updates links regardless of "Automatically update internal links".
- The 13 silent failures (CLI 1.12) may be fixed in newer versions; pin the version tested.
- Claude Code Edit on CRLF files.
- MCP vs CLI token cost: measure in test 6.
