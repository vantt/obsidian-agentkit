#!/bin/bash
# Obsidian screenshots for docs/showcase/assets/obsidian/, fixture notes only, each clipped to one element.
# Usage: tests/showcase/ui-shots.sh      (resets the vault copy before and after)
set -u
here="$(cd "$(dirname "$0")" && pwd)"; repo="$(cd "$here/../.." && pwd)"
OUT="$repo/docs/showcase/assets/obsidian"; mkdir -p "$OUT"
real() { (cd /mnt/c && "$(cat "$HOME/.local/state/obs-showcase/real-cli")" vault=vault-copy "$@"); }
shot() { node "$here/shot.mjs" "$OUT/$1" "$2" "${3:-8}"; }
wait_s() { node -e "setTimeout(()=>{}, $1*1000)"; }
leaf='#showcase-shot'
# Tag the content element of the leaf that shows <path>, so shot.mjs can clip to it.
mark() { real eval "code=(()=>{document.getElementById('showcase-shot')?.removeAttribute('id');const l=app.workspace.getLeavesOfType('markdown').find(l=>l.view.file?.path==='$1');if(!l)return 0;l.view.contentEl.id='showcase-shot';return 1})()" >/dev/null; }
reveal() { real eval "code=(()=>{const f=app.vault.getAbstractFileByPath('$1');const v=app.workspace.getLeavesOfType('file-explorer')[0].view;v.revealInFolder(f);return 1})()" >/dev/null; }
folder() { echo ".tree-item.nav-folder:has(> .tree-item-self[data-path=\"$1\"])"; }

# The editor area is squeezed by a wide right sidebar in this copy: collapse it while shooting, restore at the end.
was=$(real eval "code=app.workspace.rightSplit.collapsed" | sed 's/^=> //')
real eval "code=app.workspace.rightSplit.collapse()" >/dev/null; wait_s 3

# 1. Broken links after a rename with "Do not update" (S2 without the skill).
"$here/demo-reset.sh"
real open "path=_agentkit-lab/refs/ref-wikilink.md" >/dev/null; wait_s 3; mark _agentkit-lab/refs/ref-wikilink.md
shot links-before.png "$leaf"
"$here/demo-reset.sh" links-off
(timeout 6 bash -c "cd /mnt/c && '$(cat "$HOME/.local/state/obs-showcase/real-cli")' vault=vault-copy rename 'path=_agentkit-lab/Target Note.md' 'name=Target Renamed'" >/dev/null 2>&1)
shot rename-modal.png '.modal' 24
"$here/demo-reset.sh" dismiss; wait_s 3
real open "path=_agentkit-lab/refs/ref-wikilink.md" >/dev/null; wait_s 3; mark _agentkit-lab/refs/ref-wikilink.md
shot links-broken.png "$leaf"

# 2. "name 1.md": raw create on an existing path makes a second file (FINDINGS F9c).
"$here/demo-reset.sh"
real create "path=_agentkit-lab/refs/ref-wikilink.md" "content=x" > "$OUT/create-duplicate.txt"
wait_s 2; reveal "_agentkit-lab/refs/ref-wikilink 1.md"; wait_s 1
shot duplicate-file-explorer.png "$(folder _agentkit-lab/refs)" 4

# 3. Property panel before and after property:set type=list (types.json changes vault-wide).
"$here/demo-reset.sh"
real open "path=_agentkit-lab/props/Property Note.md" >/dev/null; wait_s 2; mark "_agentkit-lab/props/Property Note.md"
shot properties-before.png '#showcase-shot .metadata-container' 12
real property:set name=tags type=list "value=proj,fixture,next" "path=_agentkit-lab/props/Property Note.md" >/dev/null; wait_s 2
mark "_agentkit-lab/props/Property Note.md"
shot properties-after.png '#showcase-shot .metadata-container' 12
git -C /mnt/c/obsidian-agentkit-test/vault-copy diff -- .obsidian/types.json "_agentkit-lab/props/Property Note.md" > "$OUT/properties-after.diff"

"$here/demo-reset.sh"
[ "$was" = false ] && real eval "code=app.workspace.rightSplit.expand()" >/dev/null
ls -la "$OUT"
