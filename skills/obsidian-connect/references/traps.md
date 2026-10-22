# Obsidian CLI traps (measured on 1.14.4)

Evidence: `docs/FINDINGS.md` in the obsidian-connect repo (`F#`). Re-test on other versions with `tests/compat/`.

## Outputs that mean failure or nothing (all exit 0)

| stdout starts with | Means | Bridge exit |
|---|---|---|
| `Error: …` (not found, missing parameter, no active file, ENOENT, no template folder, folder not found, failed to open daily note) | failure | 3 |
| `Error: Command "x" not found` | app still loading after start or reload, or no such command | 6 |
| `Vault not found.` | wrong `vault=` name | 3 |
| `No matches found.` / `No backlinks found.` / `No links found.` / `No tags found.` / `No headings found.` / `No frontmatter found.` / `No aliases found.` | empty; check `path=` and spelling before saying "none" | 4 |
| empty stdout from `daily:read` | today's note is empty, or did not exist and was **just created empty** | 4 |
| `The CLI is unable to find Obsidian…` (exit 1) | app closed; switch to file mode | 2 |

## Scope and output size
- `vault=` is honoured only as the **first** argument. Later, it is ignored and the focused vault answers. The bridge always puts it first.
- `tasks` and `tags` are vault-wide by default. `active` limits them to the open file; never use it. `all` no longer exists and is ignored.
- `search query=a b` matches the words `a` and `b` anywhere in a note. Use `query='"a b"'` for a phrase. Search is case-insensitive but diacritics-sensitive (`Da Nang` ≠ `Đà Nẵng`).
- `search … total` returns the number of **files**. `search:context` and `bases` ignore `total` and print everything. `search:context` repeats a line once per matched term, so one 4-file query printed 410 KB.
- `search format=json` gives a list of paths only; `matches` is ignored. For line numbers use `search:context … format=json` (`{"file","matches":[{"line","text"}]}`, 1-based).
- `outline format=json` gives `{"level","heading","line"}` with 1-based lines, which feed straight into a ranged Read.
- `backlinks` and `unresolved` lag after a move into a new folder (up to about 10 s) and after `reload` (up to about 40 s). Poll; never trust a single reading.

## Writes
- `create` on an existing path silently creates `name 1.md`. Use `obs --create`, which refuses.
- `create` makes parent folders, opens no tab, and honours `path=` together with `template=`. `name=` without `path=` lands in the new-note location (profile).
- `move` into a missing folder fails with `Error: ENOENT`. `obs --move` creates the folder first.
- Rename and move rewrite markdown links into the vault's `newLinkFormat` (for example `../../A%20B.md` becomes `A%20B.md`). They still resolve, but the diff includes the restyle.
- With `alwaysUpdateLinks` off, rename and move pop up an "Update links" modal and the CLI blocks. On timeout the file is **already renamed** and its links are broken. `obs --rename`/`--move` check the live setting first.
- `delete` always goes to the OS Recycle Bin, even when the vault trash setting is `.trash`. Use `obs --trash`.
- `property:set` pitfalls:
  - `value="a, b"` becomes the single string `"a, b"`.
  - A list of links needs a JSON array: `value='["[[A]]","[[B]]"]'`.
  - A number without `type=number` becomes `"5"`.
  - Any list write, or `type=`, **rewrites `.obsidian/types.json` vault-wide** (for example `tags: tags` becomes `multitext`).
  - So edit typed properties in the file instead.
- `daily:append` creates the note from its template and the `YYYY/MM` subfolders, but the root daily folder must already exist. Running it again appends again.
- `daily:read` **creates** today's note as an empty file when it does not exist (bridge exit 4, empty output). Check for the note with `obs --abs $(obs daily:path)` and file tools instead.
- `\n` inside `content=` becomes LF. In a CRLF note, append with the file tools instead if the line endings must match.

## Environment
- Git Bash: `obsidian` resolves to `Obsidian.exe`, and colon commands exit 127. The bridge calls `Obsidian.com` directly.
- WSL: no `obsidian` on PATH. The bridge finds `Obsidian.com` through `cmd.exe` and `wslpath`, and runs it from a `/mnt/c` cwd.
- A call costs about 80–190 ms (median); the first search after start can take about 400 ms.
- Plugins (for example colored-tags) rewrite their own `data.json`. Ignore `.obsidian/plugins/*/data.json` when judging a diff.
