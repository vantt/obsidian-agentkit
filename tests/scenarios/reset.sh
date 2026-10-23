#!/bin/bash
# Reset the vault copy between scenario runs and wait until the Obsidian index agrees.
# Usage: tests/scenarios/reset.sh <copy dir> <vault name>
# Env: RESET_UNRESOLVED = the vault's baseline `unresolved total` (87 for vault-copy).
set -u
dir="$1"; vault="$2"
here="$(cd "$(dirname "$0")/../.." && pwd)"
obs() { OBS_VAULT="$vault" node "$here/skills/obsidian-connect/scripts/obs.mjs" "$@"; }
git -C "$dir" checkout -q -- .
git -C "$dir" clean -fdq -- _agentkit-lab
rm -rf "$dir/.trash"
for f in "$dir"/[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].md; do
  [ -e "$f" ] && ! git -C "$dir" ls-files --error-unmatch "$(basename "$f")" >/dev/null 2>&1 && rm -f "$f"
done
for i in $(seq 60); do
  b=$(obs backlinks path="_agentkit-lab/Target Note.md" total 2>/dev/null)
  u=$(obs unresolved total 2>/dev/null)
  [ "$b" = 9 ] && [ "$u" = "${RESET_UNRESOLVED:-87}" ] && { echo "reset ok after ${i}s (backlinks=$b unresolved=$u)"; exit 0; }
  sleep 1
done
echo "reset: index not at baseline (backlinks=$b unresolved=$u); run: obs reload, then retry" >&2
exit 1
