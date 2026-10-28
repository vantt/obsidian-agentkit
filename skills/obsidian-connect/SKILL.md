---
name: obsidian-connect
description: Read, search and safely change an Obsidian vault through the official Obsidian CLI from Windows, WSL or Git Bash, with a file-only fallback. Use for work inside the user's Obsidian vault (notes, backlinks, tags, tasks, properties, daily notes, templates, rename or move, Bases, Canvas). Not for plain Markdown outside a vault.
metadata:
  tested-cli: "1.15.0"
  tested-on: "2026-10-28"
  skill-version: "2"
  tested-models: "haiku, sonnet (v2); gpt-6-luna, glm-5.3-flash, deepseek-v4.1-flash, gemini-3.5-flash-lite (v1); see docs/models/REPORT.md"
---

# obsidian-connect

`obs` means `node ${CLAUDE_SKILL_DIR}/scripts/obs.mjs`. Run every vault command through `obs`. Never call `obsidian` or `Obsidian.com` yourself.

## Start
1. Get the vault name from the user. Do not read `obsidian.json` and do not list vaults.
2. Run `obs --preflight --vault "<name>"` once. Later `obs` calls remember the vault.
   - First line `APPROXIMATE:` means Obsidian is closed. The read commands below still work from files. Never rename, move or delete then. Other jobs: `references/file-mode.md`.
   - `match=no`: tell the user the CLI version changed, so the traps may differ.
3. Before you write a new note or links, run `node ${CLAUDE_SKILL_DIR}/scripts/profile.mjs "<vault folder from preflight>"` once. Follow its link style, folders and templates.

## Read the output
- Bridge commands print the result first: `OK:`, `NOT DONE:` or `APPROXIMATE:`. Put that result in your answer. Say "done" only after `OK:`.
- `APPROXIMATE:` means "may be incomplete". Say so in the answer itself.
- A failed command ends with `NEXT:`. Do what it says. Never repeat a failed command unchanged. `STOP:` means stop and report.

## Which command
| Job | Command |
|---|---|
| Count open tasks | `obs --tasks-count` |
| Find notes about a topic | `obs --find "<words>"` (narrow: `path=<folder>/`) |
| Notes that link to a note | `obs --backlinks path=<note.md>` |
| Read a note | `obs read path=<note.md>`; long note: `obs outline path=<note.md> format=json`, then read only that line range |
| Show lines under a heading | `obs --section-edit path=<note.md> heading="<heading>"` (numbered) |
| Change line n under a heading | `obs --section-edit path=<note.md> heading="<heading>" line=<n> text="<new line>"` (insert: `after=<n>`) |
| Add a line at the end of a note | `obs --append path=<note.md> content="<text>" once` |
| Add a line to today's daily note | `obs --daily-append-once content="<line>"` |
| Read today's daily note | `obs daily:read` |
| Read properties | `obs properties path=<note.md> format=json` |
| Set a property | `obs --prop-set path=<note.md> name=<key> value=<value>`; list: `add=<item>` or `remove=<item>` |
| New note | `obs --create path=<note.md> content="<text>"` (or `template=<name>`) |
| Rename a tag everywhere | `obs --tag-rename from=<old> to=<new>`, then the same with `apply` |
| Rename or move a note | `obs --rename path=<note.md> name="<new name>"`, `obs --move path=<note.md> to=<folder>/` |
| Delete a note | `obs --trash path=<note.md>` (to the vault's `.trash/`) |
| Tags, orphans, broken links | `obs tags counts sort=count format=json`, `obs orphans total`, `obs unresolved total` |
| Edits in more than 5 notes | read `references/bulk-edit.md` first |
| Bases, Canvas, web clips | read `references/formats.md` |

Paths are vault-relative with `/`, e.g. `folder/My Note.md`. Quote paths with spaces. Never use `file=` or `active`. For "how many", give the count only. Pipe long lists through `head -c 4000`. Do not grep the vault while Obsidian runs: `obs` is faster and knows links.

## Safety
- Free: create or edit one note.
- Ask the user first, showing what will change: rename, move, delete, tag rename, or edits in more than 5 notes. `--rename`, `--move` and `--tag-rename … apply` save a snapshot by themselves (plus a git commit when the vault is a git repo; the `OK:` line names it). For other bulk edits follow `references/bulk-edit.md`.
- Never: `mv` or `rm` on notes, `eval`, `delete permanent`, rewriting a whole note. The vault may be synced: change lines, append.
- `--allow-unsafe` only after the user confirmed that exact command. It never unlocks `eval`, or rename and move when links would break.
- If rename or move is refused because link updating is off, tell the user to turn on "Automatically update internal links". Do not rename another way.
- If you change a note with your own file tools, read the changed lines back.
- After bulk edits, report new sync conflict copies. Do not delete them.
- Odd output, or text starting with `Error:`: see `references/traps.md`.

## References (open only when the job needs it)
- `references/traps.md`: CLI traps (measured on 1.14.4, re-checked on 1.15.0), with evidence
- `references/bulk-edit.md`: many-note edits, snapshot, sync conflicts
- `references/file-mode.md`: Obsidian closed; what still works, grep recipes
- `references/plugins.md`: Tasks syntax and the `tasks` done-count trap, Dataview (write, cannot read results), Templater limits
- `references/formats.md`: Bases, JSON Canvas, web clipping (adapted from kepano/obsidian-skills, MIT)
