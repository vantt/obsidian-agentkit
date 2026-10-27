# File mode (no CLI, or Obsidian closed)

File mode starts when the first line of `obs --preflight` is `APPROXIMATE:`. Preflight still prints the vault folder (from Obsidian's own settings, only the vault you named). Never read `obsidian.json` yourself: it lists every vault of the user. If the folder is unknown, ask the user for it and run `obs --preflight --dir "<folder>"`.

These bridge commands keep working and read the files themselves: `obs --find`, `obs --backlinks`, `obs --tasks-count`, `obs --section-edit`, `obs --prop-set`, `obs --append`, `obs --tag-rename`. Read commands print `APPROXIMATE:` first; copy that into the answer. Other `obs` commands need Obsidian: do not retry them.

Every answer in file mode is **approximate**. Say which part could be incomplete:
- grep does not resolve links (shortest-path names, relative paths, `%20`), and it does not know about aliases, embeds of renamed files, or plugin state (Tasks, Dataview, Templater).
- Notes in excluded folders (profile `excluded`) still match grep. Filter them out.

## Recipes (always bounded), for jobs the bridge does not cover
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

Backlink rules that match Obsidian:
- Links in frontmatter values (`related: ["[[X]]"]`) count.
- Matches inside fenced code or inline code do not count; check the hits by hand.
- `[[Alias]]` (a link by alias name) does not resolve in Obsidian; report it separately.

If `rg` fails (missing, or rewritten by a shell hook), use `grep -rl --include='*.md'` with the same pattern. Read-back in file mode means re-reading the frontmatter lines, because `properties` needs the CLI.

## Writes in file mode
- Single-note create and edit are allowed. Follow the profile's link style, folders and property types.
- **Rename, move and trash are not allowed.** Links would not be updated. Tell the user to open Obsidian, or to do it in the app. The bridge refuses them anyway.
- Daily notes need Obsidian (`obs --daily-append-once` stops with `NOT DONE`).
- Bulk edits follow `bulk-edit.md`, and the result is labelled approximate.
