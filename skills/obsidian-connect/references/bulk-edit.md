# Bulk edits and tag rename

Use this for any change that touches more than 5 files, any rename, move or trash, and any tag rename.

## Protocol
1. **Dry-run.** Collect every file and every exact line change. Show the user a list of `path:line  old → new` (or a count per file if there are more than 30). Nothing is written yet.
2. **Confirm.** Wait for an explicit yes on that list.
3. **Snapshot.**
   - `--rename`, `--move` and `--tag-rename … apply` do this step themselves; report the snapshot folder and `git <sha>` from their `OK:` line.
   - If the vault is a git repo: `git -C <vault> add -A && git -C <vault> commit -m "snapshot before <op>"`. If the tree is already clean, do not make an empty commit; record `git rev-parse HEAD` as the restore point. Do not commit after applying unless the user asks.
   - Otherwise copy each file to be touched into `<vault>/.trash/obsidian-connect-snapshots/<UTC timestamp>/<same relative path>`.
4. **Apply** with line-anchored file edits (the Edit tool, or `sed -i '<n>s/…/…/'`), one file at a time. Never rewrite whole files, because the vault may be synced by Google Drive. Keep the file's line endings.
5. **Verify.** Re-run the dry-run query; it must find 0 remaining matches. Check that `obs unresolved total` is unchanged. Look for sync conflict copies: list `*conflict*` and `* (<n>).md` names **before** applying and compare afterwards, because ordinary notes often have parentheses in their names. Report them, do not delete them.
6. **Report:** files changed, files skipped (and why), verification numbers, and where the snapshot is.

## Tag rename `#old` → `#new`
Obsidian has no CLI command for this (Tag Wrangler works only inside the app). The bridge does the whole protocol:

1. `obs --tag-rename from=old to=new` is the dry run. It prints `NOT DONE: dry run` and every `path:line  old -> new`. Nothing is written.
   - It changes `#old` in the body (not in code, not `#older`, `#old-x` or `#olds`) and `old` in frontmatter `tags:` lists, keeping the list style. Case does not matter, as in Obsidian.
   - Nested `#old/sub` stays, and the output counts them. Ask the user; `nested=yes` renames them to `#new/sub`.
2. Show the list to the user and wait for a yes.
3. The same command with `apply` snapshots the files, edits them line by line, checks that no `#old` is left, and prints `OK:` with the snapshot folder and any new sync conflict copies.

`obs tag name=old` also counts kept nested tags, so do not expect 0 from it. A tag that does not exist returns `Error: Tag … not found` (exit 3), not an empty result.

## Multi-file property change
- List the files: `obs search query='"key:"' path=<folder> format=json` is approximate. Better is `obs properties name=<key> total` for the count, then `grep -rl --include='*.md' '^<key>:' <folder>` for the paths (frontmatter only; check each hit is inside the leading `---` block).
- Dry-run and confirm, then run `obs --prop-set path=<p> name=<key> value=<v>` (or `add=`/`remove=`) once per file. It keeps the type from `types.json` and reads its own result back; stop at the first `NOT DONE`. Its snapshot is your job: step 3 above.
- Never `property:set type=`: it rewrites `types.json` for the whole vault.

## Rename or move many notes
One `obs --rename`/`--move` per note, after the protocol's dry-run and confirmation. Each one snapshots the note and the notes linking to it, and checks the link counts. Stop at the first `NOT DONE` and report it. Do not continue with the remaining files.
