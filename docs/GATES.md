# Gate log

The user let the agent pass the review gates of `docs/handoff/BUILD-PROMPT.md` on its own, provided each gate records what came up, what was decided and why. Read this before approving v1.

## Gate 0: inputs (2026-10-22)

- The copy was made by the agent with `robocopy` (read-only on the source), from the Google Drive vault to `C:\obsidian-agentkit-test\vault-copy`: 5,893 files and 3,074,425,871 bytes, matching the source exactly. The user opened it in Obsidian as `vault-copy`.
- The git repo in the copy tracks only `.md`, `.canvas`, `.base` and `.obsidian` config, with `core.autocrlf=false`. Binary attachments are left out to keep `.git` small (4.7 MB). Tests never edit attachments.
- User answers: skill name `obsidian-connect`; test 10 skipped; no MCP comparison; short adapted references instead of installing kepano skills; plugin packaging later; settings changes allowed in the copy only; 1 run per scenario test (3 if it fails); commit and push after each phase.
- Added later by the user:
  - the skill records the CLI version it was tested on;
  - a re-runnable probe suite with method, measurements and scoring, plus a score history so versions can be compared;
  - a troubleshooting log inside the test kit.

## Gate 1: FINDINGS review (2026-10-22)

**Issues met**

1. **The research spec is out of date for CLI 1.14.4.**
   - `tasks all` and `tags all` no longer exist; plain `tasks` and `tags` are vault-wide, and `active` is the opt-in.
   - `properties format=json` now returns JSON.
   - `create` makes parent folders, honours `path=` with `template=`, and opens no UI.
   - BUILD-PROMPT section 6 says "always pass `tasks all`, `tags all`" and "use `silent`".
2. **Rename and move do NOT always update links** (F4c). With `alwaysUpdateLinks` off, a modal blocks the CLI; on timeout the file is already renamed and its links are broken. YARDSTICK lists this as an unverified assumption, so it is a measurement, not a contradiction.
3. **CLI `delete` ignores `trashOption: local`** (F5) and always uses the Windows Recycle Bin. The user decision says "delete always goes to `.trash`".
4. **`property:set` rewrites `types.json` vault-wide** (F9b) and mangles lists of links and numbers (F9a).
5. **`create` on an existing path silently makes `name 1.md`** (F9c), and `daily:append` repeats on rerun (F9g).

**Decisions and reasons**

1. **Follow the measured 1.14.4 behaviour, and keep the old safety intent.**
   - The bridge passes no `all` flag; it would be ignored, and the default is already vault-wide.
   - The skill teaches "never use `active`" and "always pass `path=`".
   - The version check makes the skill warn when the CLI is not the tested 1.14.x, because the old `all` behaviour may return on another version.
   - Why: the BUILD-PROMPT rule is "if a measurement contradicts the docs, ask". The user pre-authorised the agent to decide at gates, and the safest reading of the intent (explicit scope, no active-file reliance) is kept.
2. **Rename and move go through a bridge command that refuses unless the live `alwaysUpdateLinks` is `true`.**
   - The bridge counts `unresolved total` and the target's backlinks before and after, and fails loudly on any change.
   - Why: a hung modal after the rename is the worst case, because it is half-applied and silent.
3. **`delete` goes through the bridge, which moves the file into `<vault>/.trash/` itself**, a plain file move that mirrors Obsidian's `local` option.
   - It never calls CLI `delete`. Links to a deleted note become unresolved either way.
   - Why: the user decision "delete always goes to `.trash`" is not achievable through the CLI (F5), and the Recycle Bin on a Google Drive virtual drive is unverified.
4. **Typed properties (list, number, date, checkbox, links) are edited in the file**, with line-anchored edits, then validated with a YAML read-back (`properties path=… format=json`).
   - `property:set` is used only for plain text values on keys not registered in `types.json`.
   - Why: F9a and F9b; data safety beats convenience.
5. **Creates check for an existing file first (`file path=`), and daily appends check for the line first.**
   - Why: F9c and F9g.

**Not verified at this gate:** admin terminal, Drive Recycle Bin, MCP.

## Gate 2: SPEC approval (2026-10-22)

**Issues met**

1. **Bridge shape.** BUILD-PROMPT suggests a POSIX shell script plus a PowerShell script, or one Node script. Node runs on both sides (Windows v22, WSL v24).
2. **Where the profile goes.** Writing into the vault would sync through Drive and mix generated files with notes.
3. **Reading `alwaysUpdateLinks` live needs `eval`,** which is on the "never without request" list. The file value can differ from the live one (F11).
4. **New user requests:** a version pin, a re-runnable probe suite with scoring and history, and a troubleshooting log.

**Decisions and reasons**

1. **One Node bridge.** It means a single implementation of exit-code parsing and guards, and it sidesteps the Git Bash `.exe` trap. The cost: Node must be installed. Preflight reports `no-node` implicitly, because the script cannot start, so the skill says "if `node` is missing, use file mode".
2. **The profile goes to stdout, or `--out` to a gitignored file in the agent's working dir, never into the vault.** Why: Drive sync and no vault pollution.
3. **The bridge may use `eval` read-only, for one `getConfig` call inside `--rename`/`--move`/`--preflight`.** The agent itself is still denied `eval`. Why: a stale file value could let a rename through while the modal blocks and links break (F4c), which is worse than one controlled read-only eval.
4. **Probe suite, `HISTORY.md` with weighted scores, `RESULTS.md` rows per version, and `tested-cli` in the SKILL metadata** (SPEC §5).

## Phase 3 build notes (no gate)

- **`backlinks … total` lagged** after a move into a new folder (9 → 1 for 8+ s). Decision: the guarded move polls for up to 30 s instead of sleeping once. Why: a fixed sleep either wastes time or reports a false failure.
- **With Obsidian closed, the "unable to find Obsidian" message comes on stderr from WSL.** The first bridge version read only stdout and mapped it to exit 3. Fixed: the bridge checks both streams, and a test was added.
- **Probe harness flakiness.** Write probes left ghost index entries that broke a later read probe, and a reset right after an app start left the index stale. Decision: read-only probes run first; the start does a reset, then `reload`, then waits until backlinks equal the file-only ground truth. Every lesson went into `tests/compat/TROUBLESHOOTING.md`.

## Gate 3: accepting the gaps (2026-10-22)

**Issues met in Phase 4**

1. **Case 4 answered correctly but cost about 6,100 tokens**, because SKILL.md said "`total`, then `format=json`".
2. **Case 5 found that `daily:read` creates an empty daily note** (a new finding, F9j).
3. **Case 6 found that diacritics change search results** ("Đà Nẵng" ≠ "Da Nang").
4. **Agents in cases 2, 3, 7 and 8b reported gaps in the skill text:**
   - empty snapshot commits;
   - date-like values on unregistered keys;
   - alias-name links;
   - verifying a tag rename when nested tags are kept;
   - conflict-copy patterns that match ordinary notes;
   - `rg` broken by a shell hook.
5. **One agent in case 2 wrongly stated that `[[TN Alias]]` resolves.** It does not (F4e). This did not affect the result, and the skill's backlink row now states the rule.

**Decisions and reasons**

1. **Every gap was fixed in the skill text, not in the bridge,** with one new probe (P29). Only case 4 was re-run to confirm the token fix (about 60 tokens).
   - The other cases had already passed. The fixes either add guidance for situations those runs handled correctly anyway, or clarify wording.
   - Why: the user asked for 1 run per case and 3 only on failure. No case failed its pass criteria.
2. **Gaps accepted for v1, recorded in `tests/RESULTS.md`:**
   - *Case 9:* bridge-level only. Answers are identical from PowerShell and WSL, but no Windows-native agent session was run.
   - *Case 10, Google Drive Recycle Bin, sync conflicts:* not tested (user decision).
   - *Admin terminal:* not tested.
   - *Token estimates:* they count bridge output and Read lines, not output from the agent's own `grep`/`cat`. This undercounts cases 1, 2, 7 and 8b.
   - *Sample size:* single runs, so variance between sessions is unknown.
3. **The pre-authorised gate decision (user, 2026-10-22) is applied:** the agent accepts these gaps and reports them for review rather than blocking. They are what the user should look at first.
