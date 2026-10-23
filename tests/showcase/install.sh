#!/bin/bash
# Put the logging wrapper on PATH as `obsidian` and point the skill's bridge at it,
# so both sides of every showcase run go through the same measured CLI.
# Usage: tests/showcase/install.sh [--uninstall]
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
STATE="$HOME/.local/state/obs-showcase"
cache="$(node -e 'console.log(require("os").tmpdir())')/obsidian-connect-cli.json"
if [ "${1:-}" = --uninstall ]; then
  rm -f "$HOME/.local/bin/obsidian" "$cache"; rm -rf "$STATE"; echo "uninstalled"; exit 0
fi
mkdir -p "$STATE" "$HOME/.local/bin"
win=$(cd /mnt/c && cmd.exe /c 'echo %LOCALAPPDATA%' 2>/dev/null | tr -d '\r')
real=$(wslpath -u "$win\\Programs\\Obsidian\\Obsidian.com")
[ -x "$real" ] || { echo "Obsidian.com not found at $real" >&2; exit 1; }
echo "$real" > "$STATE/real-cli"
cp "$here/obsidian" "$HOME/.local/bin/obsidian"
printf '{"env":"wsl","cli":"%s"}' "$HOME/.local/bin/obsidian" > "$cache"
echo "installed: $(command -v obsidian); bridge cache -> wrapper"
