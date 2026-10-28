# Spec: obsidian-connect v1

Every decision cites a finding (`F#` in `FINDINGS.md`) or a lesson key. Tested on Obsidian CLI **1.14.4**; the 32 probes pass on **1.15.0** (2026-10-28).

> **v2 (E8.6, E8.7, 2026-10-27).** This spec describes v1. v2 keeps every rule here and moves more into the bridge; see §8.

## 1. Bridge: `skills/obsidian-connect/scripts/obs.mjs`

One Node script (Node ≥ 18; Windows has v22 and WSL has v24) for WSL, PowerShell, cmd and Git Bash. Node avoids keeping a shell and a PowerShell copy in sync. It sidesteps the Git Bash `.exe` trap by calling `Obsidian.com` directly (F1, `windows-com-redirector-and-wrapper`).

- **Call:** `node obs.mjs <obsidian args…>` passes the args through. The vault comes from `OBS_VAULT` or `--vault <name>` and is **always inserted as the first arg** (`vault-targeting-first-param`, F1c). With no vault set, the bridge exits 5 and never falls back to the focused vault.
- **Locate the CLI:**
  1. `OBS_CLI` if set.
  2. Windows: `obsidian.com` from `where`, else `%LOCALAPPDATA%\Programs\Obsidian\Obsidian.com`.
  3. WSL: `/mnt/c/Users/*/AppData/Local/Programs/Obsidian/Obsidian.com`, resolved through `cmd.exe /c echo %LOCALAPPDATA%` + `wslpath`.

  The result is cached in the OS temp dir (`obsidian-connect-cli.json`). The process runs with a drive-letter cwd (F1d).
- **Streams:** stdout is the CLI stdout, unchanged; stderr carries bridge diagnostics only, as one line `obs: <code> <reason>`.
- **Timeout:** `OBS_TIMEOUT` (default 10 s). The bridge kills the child and **never retries** (`preflight-and-fallback-table`).
- **Exit codes:** stdout is parsed because the CLI's exit 0 is not trusted (F6, `error-text-exit-zero`).

  | Code | Meaning | Detected by |
  |---|---|---|
  | 0 | ok | — |
  | 2 | CLI unreachable: not installed, or Obsidian closed | spawn failure, or `unable to find Obsidian` with exit 1 (F1a) |
  | 3 | CLI error | first stdout line starts with `Error:`, or `Vault not found.` (F1c) |
  | 4 | empty result | `No … found.` lines, or empty stdout, for read/list commands (F6) |
  | 5 | bridge usage or config error | no vault, bad args |
  | 6 | not ready | `Command "…" not found` while the app is loading (F1b); the caller waits once and retries once |
  | 7 | safety guard refused, or a verification after a write failed | see the guarded ops below |
  | 124 | timeout | — |

- **Bridge-own commands** (prefixed `--`):
  - `--preflight`: at most 5 lines: environment (`wsl` / `windows` / `other`), CLI path and `version`, tested version and a match flag, vault name and Windows + local path, `alwaysUpdateLinks` and `trashOption`. Exit 2 on unreachable, or `no-cli` when nothing was found, so the skill switches to file mode after **one** call.
  - `--abs <vault-rel>`: prints the absolute path in the caller's environment (`wslpath -u` in WSL) (F3).
  - `--rename path=… name=…` and `--move path=… to=…`: refuse (7) unless the live `alwaysUpdateLinks` is `true` (F4c).
    - Before: `backlinks total` of the target and `unresolved total`.
    - After: the target exists at its new path, backlinks are unchanged, and unresolved is unchanged. Any difference exits 7 with both numbers printed.
    - A missing destination folder is created first (F4d).
    - `eval` is used read-only, for that one `getConfig` call.
  - `--trash path=…`: moves the file into `<vault>/.trash/`, adding a numeric suffix on a name clash, and prints where it went. It never calls CLI `delete`, which uses the Recycle Bin (F5). It prints how many backlinks will break.
  - `--create path=… [content=…|template=…]`: exits 7 if the path exists. The CLI would silently create `name 1.md` (F9c).
- **Deny list:** passing `delete`, `eval`, `dev:*`, `plugin:install|uninstall|enable|disable`, `theme:install|uninstall`, `history:restore`, `property:set … type=`, or `overwrite` exits 7 unless `--allow-unsafe` is given (`never-without-request-and-confirm`, F9b). The skill passes `--allow-unsafe` only after explicit user confirmation.
- **Path translation:** CLI paths are vault-relative with `/` (F3). Absolute paths come from `vault info=path` (cached for the session) joined with the relative path; in WSL they go through `wslpath`.

## 2. Vault profile: `skills/obsidian-connect/scripts/profile.mjs <vaultDir>`

Reads `.obsidian/*.json` from files only and skips `* (conflict *).json`. It prints about 30 lines of YAML to stdout, or `--out <file>`. The default suggestion is `.vault-profile.md` in the agent's working directory, which `.gitignore` already covers. It never writes into the vault, because the vault is synced by Drive.

The output has these fields, each tagged `# from <file>` or `# default`:
- `generated`
- link style: `useMarkdownLinks`, `newLinkFormat`
- `alwaysUpdateLinks`, `trashOption`
- new-note location and folder, attachment folder
- daily notes: folder, format, template, and whether the folder exists (F9g)
- templates folder, core and Templater
- the plugins in use that matter to agents: tasks, dataview, templater, bases, canvas
- property types from `types.json`, plugin-prefixed keys collapsed into a count
- `userIgnoreFilters`
- conflict-copy files found
- tag conventions, only from `types.json` and settings (no note content)

Lessons: `conventions-ignored-or-hardcoded`, `properties-type-table`.

## 3. Routing table (15 jobs)

`obs` = bridge. "File" = agent file tools. In file-only mode every answer is labelled **approximate**: grep misses alias, embed and markdown-link resolution and plugin state (`cli-vs-files-routing-rule`).

| # | Job | Mechanism | Bounds / read-back | File-only fallback |
|---|---|---|---|---|
| 1 | Find notes about X | `obs search query='"X"' path= limit=20 format=json`, `total` first (F8c, F9f) | quote phrases; if total > 20, narrow `path=` | `rg -l` in a folder (slow from WSL, F2a) |
| 2 | Read part of a long note | `obs outline path= format=json`, then File Read with offset/limit (F9h) | read only the section's line range | `rg -n '^#'` then Read range |
| 3 | List backlinks | `obs backlinks path= format=json` (+`total`) (F4e) | — | grep basename and `%20` forms; approximate |
| 4 | Update a property | text on an unregistered key: `obs property:set name= value= path=`; otherwise a File edit of the frontmatter line(s) (F9a, F9b) | `obs properties path= format=json`, check that only that key changed | File edit + `gt.mjs yaml` |
| 5 | Append to daily note | `obs daily:path`; make sure the daily root folder exists; `obs daily:read` to check for the line; `obs daily:append content=` (F9g) | read back; no duplicate | profile folder/format + File append |
| 6 | Rename / move + fix links | `obs --rename` / `obs --move` (F4) | built-in before/after link check | **refuse**: tell the user that links would break |
| 7 | Create from template | `obs --create path= template=` (F7, F9c) | `obs read path=` | read the template, fill it, write |
| 8 | Query a Base | `obs base:query path= format=json` (`base-query-via-cli`) | pipe through `head` | read the `.base` YAML; approximate |
| 9 | Edit one section of a long note | outline → Read range → File Edit (line-anchored; CRLF kept, F10a) | re-read the range | same |
| 10 | Rename a tag everywhere | dry-run: `obs tag name= verbose` + File grep for body and frontmatter forms; confirm; snapshot; File edits (`references/bulk-edit.md`) | `obs tag name=<old> total` → 0 for the exact tag; `#projects` and code untouched | same; approximate |
| 11 | List open tasks vault-wide | `obs tasks todo total`, then `obs tasks todo format=json` with `head` (F8b) | never `active` | `rg '^\s*[-*] \[ \]'`; approximate |
| 12 | Create a canvas | File write JSON Canvas (`references/formats.md`) | parse the JSON back | same |
| 13 | Clip a web page | fetch → Markdown with source and date properties (`references/formats.md`, `defuddle-token-saver`) | read back | same |
| 14 | Orphans / unresolved | `obs orphans total` / `obs unresolved verbose format=json` | `total` first | — (refuse; needs index) |
| 15 | Write a new note with links | `obs --create path= content=`, link style from the profile (`link-forms-and-style`) | `obs links path=`; `obs unresolved` count unchanged | File write |

**Autonomy:**
- Free: creating or editing a single note.
- Needs a dry-run listing every file and change, then user confirmation, then a snapshot (git commit if the vault is a repo, else a copy of the touched files under `.trash/obsidian-connect-snapshots/<time>/`), and only then apply: rename, move, trash, or any change touching more than 5 files.
- Never: CLI `delete`, `delete permanent`, `overwrite`, or whole-file rewrites of synced notes.
- After a bulk edit, look for Drive conflict copies (`* (1).md`, `*conflict*`).

Lessons: `append-over-overwrite-guard`, `never-without-request-and-confirm`.

## 4. Layout and packaging

```
skills/obsidian-connect/SKILL.md          frontmatter: name, description, metadata.tested-cli
skills/obsidian-connect/references/       traps.md, bulk-edit.md, file-mode.md, formats.md
skills/obsidian-connect/scripts/          obs.mjs, profile.mjs
tests/bridge.test.mjs                     node:test, fake CLI, no Obsidian needed
tests/compat/                             probes.mjs, README.md (method + scoring), HISTORY.md, history/*.json, TROUBLESHOOTING.md
tests/scenarios/README.md                 the 13 cases: prompt, setup, judge commands
tests/RESULTS.md                          per-run rows, appended per version
tests/fixtures/, tests/ground-truth/      already built in Phase 1
```

No `.claude-plugin/` in v1 (user decision).

Licenses checked:
- kepano/obsidian-skills: MIT. Ideas from `obsidian-bases`, `json-canvas` and `defuddle` are adapted with attribution, nothing copied verbatim.
- jackal092927: MIT (gotcha list ideas).
- Roasbeef: MIT (not used).
- pablo-mano: **no license file**, so ideas only, no text.

## 5. Re-test kit (user request)

- **Version pin:** SKILL.md `metadata.tested-cli: "1.15.0"` and `tested-on`. `--preflight` prints `tested=1.15.0 match=yes|no`. On `no`, the skill tells the agent to run the probe suite before trusting the trap list.
- **Probe suite** (`tests/compat/probes.mjs --vault <copy>`): about 25 probes, each tied to an `F#`, with an expected result and a severity weight (data loss 5, links 4, silent wrong answer 3, metadata 3, tokens 2, UI 1). It writes `history/<date>_<cli>.json` and appends a row to `HISTORY.md`: date, CLI, environment, passed/total, weighted score (%), and the probes that changed since the last run. `--compare` prints the diff from the previous run.
- **Scenario results:** `RESULTS.md` keeps one row per run with date and CLI version; new versions append, nothing is overwritten.
- **Troubleshooting:** `tests/compat/TROUBLESHOOTING.md`, updated whenever a probe needs more than one retry.

## 6. Size budget and measurement

- description ≤ 60 words
- SKILL.md body ≤ 100 lines
- each reference ≤ 3k tokens
- typical load ≤ 3k tokens

Measured with `wc -w`, `wc -l` and characters ÷ 4 as a **token estimate** (`tests/size-check.mjs`, run in the test suite) (`skill-load-cost-profile`).

## 7. Definition of done

| Deliverable | Done when |
|---|---|
| `obs.mjs` | `bridge.test.mjs` covers exit codes 0/2/3/4/5/6/7/124 and path translation; live `--preflight` ≤ 5 lines in WSL and in PowerShell |
| `profile.mjs` | runs on the copy and on the fixture; ≤ 35 lines; no note content; values match the source JSON (spot-checked in the tests) |
| SKILL.md and references | size check passes; contains preflight, routing pointer, thresholds, traps; every example is bounded (`examples-teach-unbounded-output`) |
| `tests/compat` | a run on 1.14.4 recorded in `HISTORY.md`; README documents method and scoring |
| `RESULTS.md` | every one of the 13 cases has a row with evidence, or is listed as not run with the reason |

## 8. v2 changes (E8.6, E8.7)

Driven by the round-0 failure analysis (`docs/models/FAILURES.md`). Every v1 rule still holds; some moved from SKILL.md into the bridge.

- **Output contract.** Bridge commands print a first line `OK:` (done and read back), `NOT DONE:` (with the reason; dry runs too) or `APPROXIMATE:` (read from files because Obsidian is closed). Every non-zero exit ends with a stderr line `NEXT: <what to do>`. The third identical failure in a row says `NEXT: STOP: …`. Pass-through reads keep the CLI's stdout.
- **New commands:** `--find` (quoted phrase plus the unaccented form, F8c), `--backlinks`, `--tasks-count` (F8b), `--section-edit` (outline + line edit, CRLF kept, F9h, F10a), `--prop-set` (frontmatter edit keeping types, never `property:set`, F9a, F9b), `--append`, `--daily-append-once` (`daily:path`, never `daily:read`, F9g, F9j), `--tag-rename` (dry run, then `apply` with snapshot, F9i), `--help`. The read commands fall back to files when Obsidian is closed.
- **Routing instead of refusal.** Raw `create`, `append`, `prepend`, `property:set`, `property:remove`, `daily:append`, `daily:prepend`, `delete`, `rename`, `move` exit 5 and name the bridge command. A command that does not exist exits 5 (v1 said 6, "not ready"). `eval`, `dev:*` and raw `rename`/`move` can no longer be unlocked by `--allow-unsafe`; `command` joins the deny list. `daily:read` checks `daily:path` first and creates nothing.
- **Vault.** `--preflight --vault <name>` remembers the vault for 12 h (`OBS_STATE`, default in the OS temp dir), so `OBS_VAULT` is optional afterwards; an explicit vault always wins. With Obsidian closed, preflight finds the folder of that one vault in `obsidian.json` and never prints the others.
- **Snapshots.** `--rename`/`--move` copy the note and its referrers, and `--tag-rename … apply` copies every file it edits, to `.trash/obsidian-connect-snapshots/<time>/` before writing.
