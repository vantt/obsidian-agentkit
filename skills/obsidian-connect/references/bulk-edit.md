# Bulk edits and tag rename

Use this for any change that touches more than 5 files, any rename, move or trash, and any tag rename.

## Protocol
1. **Dry-run.** Collect every file and every exact line change. Show the user a list of `path:line  old → new` (or a count per file if there are more than 30). Nothing is written yet.
2. **Confirm.** Wait for an explicit yes on that list.
3. **Snapshot.**
   - If the vault is a git repo: `git -C <vault> add -A && git -C <vault> commit -m "snapshot before <op>"`. If the tree is already clean, do not make an empty commit; record `git rev-parse HEAD` as the restore point. Do not commit after applying unless the user asks.
   - Otherwise copy each file to be touched into `<vault>/.trash/obsidian-connect-snapshots/<UTC timestamp>/<same relative path>`.
4. **Apply** with line-anchored file edits (the Edit tool, or `sed -i '<n>s/…/…/'`), one file at a time. Never rewrite whole files, because the vault may be synced by Google Drive. Keep the file's line endings.
5. **Verify.** Re-run the dry-run query; it must find 0 remaining matches. Check that `obs unresolved total` is unchanged. Look for sync conflict copies: list `*conflict*` and `* (<n>).md` names **before** applying and compare afterwards, because ordinary notes often have parentheses in their names. Report them, do not delete them.
6. **Report:** files changed, files skipped (and why), verification numbers, and where the snapshot is.

## Tag rename `#old` → `#new`
Obsidian has no CLI command for this. Tag Wrangler works only inside the app. Use files, guided by the index:

1. `obs tag name=old verbose` lists the files that have `#old` or `#old/…`, with a count. Decide with the user whether nested `#old/sub` becomes `#new/sub`.
2. For each listed file, find the exact occurrences:
   - **Body:** `#old` followed by end of line, whitespace, punctuation or `/` (when nested tags are in scope). Skip fenced code blocks and inline code. **Do not touch** `#older`, `#old-x` or `#olds`; the regex needs a boundary after `old`.
   - **Frontmatter `tags:`:** inline `tags: [old, x]` or block items `- old`. Values have no `#`. Keep the existing list style.
3. Dry-run, confirm, snapshot, apply (protocol above).
4. Verify: `obs tag name=new total` must equal the number of occurrences you changed, and a file grep for the exact `#old` (boundary after it) outside code, plus frontmatter `old` items, must find nothing. `obs tag name=old` also counts kept nested tags (`#old/sub`), so do not expect 0 from it. A tag that does not exist yet returns `Error: Tag … not found` (exit 3), not an empty result.

## Multi-file property change
- List the files: `obs search query='"key:"' path=<folder> format=json` is approximate. Better is `obs properties name=<key> total` for the count, then `grep -rl --include='*.md' '^<key>:' <folder>` for the paths (frontmatter only; check each hit is inside the leading `---` block).
- Edit the frontmatter line in each file. Keep the type shown in the profile `property_types`. Never `property:set type=`.
- Read back a sample with `obs properties path=<p> format=json`.

## Rename or move many notes
One `obs --rename`/`--move` per note, after the protocol's dry-run and confirmation. Stop at the first exit `7` and report it. Do not continue with the remaining files.
