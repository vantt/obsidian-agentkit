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
