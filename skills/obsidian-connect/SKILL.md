---
name: obsidian-connect
description: Read, search and safely change an Obsidian vault through the official Obsidian CLI from Windows, WSL or Git Bash, with a file-only fallback. Use for work inside the user's Obsidian vault (notes, backlinks, tags, tasks, properties, daily notes, templates, rename or move, Bases, Canvas). Not for plain Markdown outside a vault.
metadata:
  tested-cli: "1.14.4"
  tested-on: "2026-10-22"
---

# obsidian-connect

Tested on Obsidian CLI **1.14.4**. `obs` below means `node <this skill's folder>/scripts/obs.mjs`.

## Once per session
1. Get the vault **name** from the user (or `obsidian.json`), then `export OBS_VAULT="<name>"` (PowerShell: `$env:OBS_VAULT=`). The bridge always sends `vault=` first; never call the raw CLI without it, because it would hit whichever vault is focused.
2. Run `obs --preflight` **once** and reuse the answer: env, CLI version, vault path, `alwaysUpdateLinks`.
   - Exit 2, or `cli=none`: **file mode**. Read `references/file-mode.md`. Never retry in a loop.
   - `match=no`: warn the user that the traps below may have changed (re-test kit: `tests/compat/` in the obsidian-agentkit repo).
3. Run `node <skill>/scripts/profile.mjs "<vault local path>"` once. Follow its link style, folders, daily-note format and template, and property types. Never hard-code conventions.

## Bridge exit codes (CLI exit 0 is not trusted)
`0` ok · `2` unreachable (go to file mode) · `3` `Error:` from the CLI · `4` empty result, check your scope before saying "none" · `5` usage or no vault · `6` app still loading, wait 2 s and retry once · `7` safety guard refused or verification failed, report it to the user · `124` timeout, do not retry.

## Routing
| Job | Do |
|---|---|
| Find notes | `obs search query='"exact phrase"' path=<folder> total` first, then the same with `limit=20 format=json`. Quote multi-word phrases. Search is diacritics-sensitive: for Vietnamese and similar text, also search the unaccented form (`"Đà Nẵng"` and `"Da Nang"`). |
| Matching lines | `obs search:context query='"…"' path=<folder> limit=10 format=json`; it ignores `total`, so always pass `limit` |
| Read part of a long note | `obs outline path=<p> format=json` (1-based `line`), then read only that range with the file Read tool |
| Edit one section | outline, read the range, then a line-anchored file Edit (CRLF is preserved); re-read the range |
| Backlinks / links | `obs backlinks path=<p> format=json`; `obs links path=<p>`. The index covers every link form, including links in frontmatter, and excludes code. It does not include `.canvas` files or links by alias name (`[[Alias]]`), which `obs unresolved` lists instead. |
| Open tasks, vault-wide | `obs tasks todo total`. List them only if the user asks, with `format=json \| head -c 4000`. Never use `active`. |
| Tags | `obs tags counts sort=count format=json` (vault-wide); `obs tag name=<t> verbose` also counts `#t/sub` |
| Read a property | `obs properties path=<p> format=json` |
| Change a property | plain text (not a date, number, boolean, list or link) on a key not listed in profile `property_types`: `obs property:set name= value= path=`. Anything else (including date-like values on unlisted keys): edit those frontmatter lines in the file and keep the existing value style. Then read back with `properties … format=json`; only that key may differ |
| New note | `obs --create path=<p> content='…'` (or `template=<name>`). Refuses an existing path, where the raw CLI would make `name 1.md` |
| Daily note append | `obs daily:path`, then `obs --abs <that path>`; make sure the profile's daily folder exists; check with grep on that file whether the line is already there (if so, report it and do not append); then `obs daily:append content='…'`. Do not use `daily:read` to check: it creates an empty note |
| Rename / move | `obs --rename path=<p> name=<new>` / `obs --move path=<p> to=<folder>/` (needs confirmation, see below). The bridge checks backlinks and unresolved counts before and after. Never `mv` a note |
| Delete | `obs --trash path=<p>` moves it to `<vault>/.trash/`. Never CLI `delete`: it goes to the OS Recycle Bin |
| Orphans / broken links | `obs orphans total`, `obs unresolved total`, then `obs unresolved verbose format=json` |
| Bases, Canvas, web clips | `obs base:query path=<p> format=json`; for authoring read `references/formats.md` |
| Rename a tag, or bulk edits | read `references/bulk-edit.md` first |

Always pass `path=` (exact, vault-relative, `/` separators), never `file=` or the active file. If the user asks for a count, stop at `total`. Pipe long output through `head -c 4000`. The profile step can wait until the first write.

## Safety thresholds
- **Free:** create or edit a single note.
- **Needs a dry-run, user confirmation and a snapshot first:** rename, move, trash, `overwrite`, or a change touching more than 5 files.
  The dry-run lists every file and change; snapshot and apply as in `references/bulk-edit.md`.
- **Never:** `delete permanent`, plain `mv`/`rm` on notes, or whole-file rewrites of synced notes.
- The bridge refuses `delete`, `eval`, `dev:*`, plugin and theme installs, `overwrite`, `property:set type=`, and raw `rename`/`move`/`create`. Pass `--allow-unsafe` only after the user confirms that exact command.
- The vault may be synced (Google Drive): prefer line edits and appends; after bulk edits report new conflict copies.
- Read back after every write. A bridge exit `7` means stop and tell the user.

## Traps on 1.14.4 (details: `references/traps.md`)
- `Error: …`, `Vault not found.`, `No … found.` and an empty stdout all come with exit 0. The bridge maps them to exit codes.
- If `alwaysUpdateLinks` is off, rename and move open a modal and block, and links break. `--rename`/`--move` refuse in that case.
- Unknown flags are ignored silently (`matches`, `silent`, `all`). `search … total` counts files, not matches.
- An unquoted `query=two words` matches each word; `search:context` output then explodes.
- From WSL, grep over `/mnt/c` is slow (5–8 s per 2k notes); prefer `obs search`.

## References (load only when the job needs it)
- `references/traps.md`: full trap list with evidence, plus the empty-result strings
- `references/bulk-edit.md`: tag rename, multi-file edits, snapshot, sync conflicts
- `references/file-mode.md`: no CLI or Obsidian closed; grep recipes, labelled approximate
- `references/formats.md`: Bases, JSON Canvas, web clipping (adapted from kepano/obsidian-skills, MIT)
