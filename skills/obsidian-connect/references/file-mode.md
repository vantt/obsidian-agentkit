# File mode (no CLI, or Obsidian closed)

Enter file mode when `obs --preflight` exits 2 or prints `cli=none`. Say so once to the user ("Obsidian CLI not reachable, answers from files are approximate"). Then do not call `obs` again this session, unless the user starts Obsidian.

Every answer in file mode is **approximate**. Say which part could be incomplete:
- grep does not resolve links (shortest-path names, relative paths, `%20`), and it does not know about aliases, embeds of renamed files, or plugin state (Tasks, Dataview, Templater).
- Notes in excluded folders (profile `excluded`) still match grep. Filter them out.

## Recipes (always bounded)
Run from the vault root. Use `rg` if it exists, otherwise `grep -r`. From WSL on `/mnt/c`, a vault-wide scan takes several seconds, so scope it to a folder when you can.

| Job | Command | Gaps |
|---|---|---|
| Find notes | `rg -l -i --glob '*.md' 'phrase' <folder> \| head -20`, then `\| wc -l` for the count | no ranking |
| Outline | `rg -n '^#{1,6} ' 'path/note.md'`, then Read only the needed line range | headings in code blocks also match |
| Backlinks to `Note Name` | `rg -l -F -e '[[Note Name' -e '[[Note Name\|' -e '](Note%20Name.md' -e '(Note Name.md' --glob '*.md' . \| head -50` | misses relative-path links; includes code blocks; alias-only links are unresolved in Obsidian anyway |
| Open tasks | `rg -c '^\s*[-*+] \[ \]' --glob '*.md' . \| awk -F: '{s+=$2} END {print s}'` | counts tasks inside code blocks |
| Tag occurrences | `rg -n '(^\|\s)#tag(\b\|/)' --glob '*.md' .` plus the frontmatter `tags:` lists | code blocks and inline code match |
| Properties | Read the frontmatter (the first lines up to the second `---`) | — |
| Daily note path | profile `daily_notes.format` (moment.js tokens) + `folder` | the template is not applied; copy it by hand |

## Writes in file mode
- Single-note create and edit are allowed. Follow the profile's link style, folders and property types.
- **Rename, move and trash are not allowed.** Links would not be updated. Tell the user to open Obsidian, or to do it in the app.
- Bulk edits follow `bulk-edit.md`, and the result is labelled approximate.
