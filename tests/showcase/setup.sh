#!/bin/bash
# Prepare one showcase run: reset the vault copy, set the scenario's pre-state,
# point the logging wrapper at this run's folder, record the baseline.
# Usage: tests/showcase/setup.sh <S1..S8> <without|with> [--keep]   (--keep: no reset, for S8 session 2)
set -u
S="$1"; SIDE="$2"; KEEP="${3:-}"
here="$(cd "$(dirname "$0")" && pwd)"; repo="$(cd "$here/../.." && pwd)"
VAULT=vault-copy; DIR=/mnt/c/obsidian-agentkit-test/vault-copy
OUT="$repo/tests/out/showcase/$S-$SIDE"; STATE="$HOME/.local/state/obs-showcase"
real() { (cd /mnt/c && "$(cat "$STATE/real-cli")" "vault=$VAULT" "$@"); }
mkdir -p "$OUT"
echo "CLOSED=0" > "$STATE/current.env"   # reset must reach the app
if [ "$KEEP" != --keep ]; then
  real eval "code=app.vault.setConfig('alwaysUpdateLinks', true)" >/dev/null
  "$repo/tests/scenarios/reset.sh" "$DIR" "$VAULT" || exit 1
  rm -f "$OUT"/cli.jsonl
fi
case "$S" in
  S2) real eval "code=app.vault.setConfig('alwaysUpdateLinks', false)" >/dev/null ;;
esac
CLOSED=0; [ "$S" = S7 ] && CLOSED=1
rb=$(cd /mnt/c && powershell.exe -NoProfile -Command '$s=New-Object -ComObject Shell.Application; $b=$s.Namespace(10); @($b.Items() | Where-Object { $b.GetDetailsOf($_,1) -like "*vault-copy*" }).Count' 2>/dev/null | tr -d '\r')
cat > "$OUT/baseline.json" <<J
{"scenario":"$S","side":"$SIDE","time":"$(date -u +%FT%TZ)","head":"$(git -C "$DIR" rev-parse HEAD)","recycleBin":${rb:-null},
 "cliUnresolved":$(real unresolved total),"cliBacklinks":$(real backlinks "path=_agentkit-lab/Target Note.md" total),
 "alwaysUpdateLinks":"$(real eval "code=app.vault.getConfig('alwaysUpdateLinks')" | sed 's/^=> //')","closed":$CLOSED}
J
printf 'CLI_LOG=%s\nCLOSED=%s\n' "$OUT/cli.jsonl" "$CLOSED" > "$STATE/current.env"
cat "$OUT/baseline.json"
