#!/bin/bash
# Render SVG/HTML files to PNG with headless Chrome on Windows (no image tools in WSL).
# Usage: tests/showcase/png.sh <width> <height> <in.svg|in.html> <out.png>
set -eu
W="$1"; H="$2"; IN="$3"; OUT="$4"
CHROME="/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
tmp=/mnt/c/obsidian-agentkit-test/shots/render; mkdir -p "$tmp"
name=$(basename "$IN"); cp "$IN" "$tmp/$name"
(cd /mnt/c && "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --window-size="$W,$H" --screenshot="C:\\obsidian-agentkit-test\\shots\\render\\out.png" \
  "file:///C:/obsidian-agentkit-test/shots/render/$name" >/dev/null 2>&1)
mv "$tmp/out.png" "$OUT"; rm -f "$tmp/$name"
echo "$OUT"
