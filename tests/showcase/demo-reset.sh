#!/bin/bash
# Hidden helper for the terminal recordings (docs/showcase/assets/terminal/*.tape).
# Usage: demo-reset.sh [links-off|dismiss]
#   (none)     reset the vault copy to the fixture baseline, alwaysUpdateLinks on
#   links-off  same, then switch alwaysUpdateLinks off (S2)
#   dismiss    click "Do not update" on an open link modal, as a user would
here="$(cd "$(dirname "$0")" && pwd)"; repo="$(cd "$here/../.." && pwd)"
real() { (cd /mnt/c && "$(cat "$HOME/.local/state/obs-showcase/real-cli")" vault=vault-copy "$@"); }
echo "CLOSED=0" > "$HOME/.local/state/obs-showcase/current.env"
case "${1:-}" in
  dismiss) real eval "code=[...document.querySelectorAll('.modal button')].find(b=>b.textContent==='Do not update')?.click(); 1" >/dev/null; exit 0 ;;
esac
real eval "code=[...document.querySelectorAll('.modal button')].find(b=>b.textContent==='Do not update')?.click(); 1" >/dev/null
real eval "code=app.vault.setConfig('alwaysUpdateLinks', true)" >/dev/null
"$repo/tests/scenarios/reset.sh" /mnt/c/obsidian-agentkit-test/vault-copy vault-copy >/dev/null
[ "${1:-}" = links-off ] && real eval "code=app.vault.setConfig('alwaysUpdateLinks', false)" >/dev/null
exit 0
