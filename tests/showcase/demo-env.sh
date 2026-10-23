# Sourced (hidden) at the start of every terminal recording: neutral prompt, `obs` = the skill's bridge.
export PS1='$ ' HISTFILE=/dev/null
obs() { OBS_VAULT=vault-copy node "$SHOWCASE_REPO/skills/obsidian-connect/scripts/obs.mjs" "$@"; }
cd /mnt/c/obsidian-agentkit-test/vault-copy || return
clear
