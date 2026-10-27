#!/bin/bash
# Run one headless Claude Code session on a model under test (E8).
# Usage: cc-run.sh <model> <workdir> <prompt-file> <out.jsonl> [extra claude flags]
#   <model>  an OpenRouter id (deepseek/..., z-ai/...) or a Claude alias (haiku, sonnet, opus)
# Every model gets the same environment:
#   - a fresh, empty CLAUDE_CONFIG_DIR per session: no user plugins, hooks, MCP servers, ~/.claude/CLAUDE.md,
#     and no memory carried over from an earlier session;
#   - the same four tools (Bash, Read, Edit, Write);
#   - a workdir outside ~/projects, so no project CLAUDE.md is picked up;
#   - a bubblewrap sandbox (E8.12, off with E8_SANDBOX=0): $HOME is an empty tmpfs and /mnt/c shows only the
#     vault and the Obsidian install, so the agent cannot read this repo, the answer key, other runs or secrets.
#     Env from run.mjs: E8_VAULT_DIR (the vault, read-write), E8_SKILL_DIR (skill copy, read-only; with-skill only),
#     E8_OBSIDIAN_JSON (the agent's obsidian.json, only the vault under test) bound read-only at E8_OBSIDIAN_JSON_AT
#     (the WSL path of the real Windows %APPDATA%\obsidian\obsidian.json).
# Secrets come from ~/.config/obsidian-agentkit/{openrouter,claude}.env and are never printed.
set -euo pipefail
M="$1"; WORK="$2"; PROMPT="$3"; OUT="$4"; shift 4
CFG="$HOME/.config/obsidian-agentkit"
STATE="${E8_STATE:-$HOME/.local/state/obs-e8}"
# A fresh config dir per session: Claude Code keeps auto-memory there, and one agent's memory
# must never reach the next run (GATES, E8.4).
export CLAUDE_CONFIG_DIR="$STATE/claude-config"
rm -rf "$CLAUDE_CONFIG_DIR"; mkdir -p "$CLAUDE_CONFIG_DIR"
export DISABLE_TELEMETRY=1 DISABLE_ERROR_REPORTING=1 CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
# Tool search adds a `defer_loading` placeholder tool; OpenRouter then routes only to the few providers that
# support it, and those were rate-limited (GATES, E8.2). With four fixed tools there is nothing to defer.
export ENABLE_TOOL_SEARCH=false
# Background Bash tasks keep `claude -p` alive until they finish (one S5 run waited ~2 h): no background tasks.
export CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1
unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN ANTHROPIC_BASE_URL

case "$M" in
  */*) # OpenRouter, through its Anthropic-style endpoint; pin every model slot to the model under test
    set -a; . "$CFG/openrouter.env"; set +a
    export ANTHROPIC_BASE_URL="$OPENROUTER_BASE_URL" ANTHROPIC_API_KEY="$OPENROUTER_API_KEY"
    unset OPENROUTER_API_KEY
    export ANTHROPIC_MODEL="$M" ANTHROPIC_DEFAULT_HAIKU_MODEL="$M" ANTHROPIC_DEFAULT_SONNET_MODEL="$M" \
      ANTHROPIC_DEFAULT_OPUS_MODEL="$M" ANTHROPIC_SMALL_FAST_MODEL="$M" CLAUDE_CODE_SUBAGENT_MODEL="$M" ;;
  *) # Claude subscription: long-lived token from `claude setup-token`
    [ -f "$CFG/claude.env" ] && { set -a; . "$CFG/claude.env"; set +a; }
    [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] || { echo "cc-run: CLAUDE_CODE_OAUTH_TOKEN missing in $CFG/claude.env" >&2; exit 5; } ;;
esac

export DISABLE_AUTOUPDATER=1

# Sandbox: read-only /, then hide everything the agent must not read and bind back only what it needs.
SANDBOX=()
if [ "${E8_SANDBOX:-1}" != 0 ]; then
  command -v bwrap >/dev/null || { echo "cc-run: bwrap missing (sudo apt install bubblewrap), or set E8_SANDBOX=0" >&2; exit 6; }
  VAULT_DIR="${E8_VAULT_DIR:?cc-run: E8_VAULT_DIR not set (run.mjs sets it)}"
  SHOW="$HOME/.local/state/obs-showcase"            # logging wrapper state: real CLI path, current log file
  REAL_CLI="$(cat "$SHOW/real-cli")"; CLI_LOG="$( (. "$SHOW/current.env" 2>/dev/null; echo "${CLI_LOG:-}") )"
  CLAUDE_BIN="$(readlink -f "$(command -v claude)")"; NODE_DIR="$(dirname "$(dirname "$(readlink -f "$(command -v node)")")")"
  CACHE="${TMPDIR:-/tmp}/obsidian-connect-cli.json"  # the bridge's CLI cache, pointed at the wrapper by run.mjs
  ro() { [ -e "$1" ] && SANDBOX+=(--ro-bind "$1" "$1"); return 0; }
  SANDBOX=(bwrap --die-with-parent --unshare-pid --unshare-ipc --unshare-uts --ro-bind / / --proc /proc --dev /dev
    --tmpfs /tmp --tmpfs /home --tmpfs /run/user --tmpfs /mnt)
  [ -n "${TMPDIR:-}" ] && [ "$TMPDIR" != /tmp ] && SANDBOX+=(--tmpfs "$TMPDIR")
  ro /mnt/wsl/resolv.conf
  # Windows drive: a Windows program started from WSL needs a cwd on the drive itself (the bridge uses /mnt/c),
  # so the drive stays mounted with every top-level entry hidden except the ones holding the vault and the CLI;
  # those are emptied and the two folders bound back. cmd.exe and powershell.exe are hidden with the rest.
  for keep in "$VAULT_DIR" "$REAL_CLI"; do case "$keep" in /mnt/?/*) DRIVE="${keep:0:6}" ;; esac; done
  if [ -n "${DRIVE:-}" ]; then
    SANDBOX+=(--ro-bind "$DRIVE" "$DRIVE")
    tops=(); for keep in "$VAULT_DIR" "$REAL_CLI"; do [ "${keep:0:6}" = "$DRIVE" ] && tops+=("$DRIVE/$(echo "${keep:7}" | cut -d/ -f1)"); done
    for e in "$DRIVE"/* "$DRIVE"/.[!.]*; do
      [[ " ${tops[*]} " == *" $e "* ]] && continue
      if [ -d "$e" ] && [ ! -L "$e" ]; then SANDBOX+=(--tmpfs "$e")
      elif [ -f "$e" ] && [ -r "$e" ]; then SANDBOX+=(--ro-bind /dev/null "$e"); fi
    done
    while IFS= read -r t; do SANDBOX+=(--tmpfs "$t"); done < <(printf '%s\n' "${tops[@]}" | sort -u)
  fi
  ro "$(dirname "$REAL_CLI")"
  # Obsidian's vault list: the real %APPDATA%\obsidian\obsidian.json names every vault of the user. The agent gets
  # its own copy, listing only the vault under test, at the same path (tests/models/obsidian-json.mjs builds it).
  OJ="${E8_OBSIDIAN_JSON:?cc-run: E8_OBSIDIAN_JSON not set (run.mjs sets it)}"; OJ_AT="${E8_OBSIDIAN_JSON_AT:?cc-run: E8_OBSIDIAN_JSON_AT not set}"
  case "$OJ_AT" in /mnt/?/*) ;; *) echo "cc-run: E8_OBSIDIAN_JSON_AT must be on a Windows drive" >&2; exit 6 ;; esac
  SANDBOX+=(--ro-bind "$OJ" "$OJ_AT")
  SANDBOX+=(--bind "$VAULT_DIR" "$VAULT_DIR")
  # $HOME: empty, plus the tools and this session's own folders.
  ro "$CLAUDE_BIN"; ro "$HOME/.local/bin/claude"; ro "$NODE_DIR"
  ro "$HOME/.local/bin/obsidian"; ro "$SHOW/real-cli"; ro "$SHOW/current.env"; ro "$CACHE"
  if [ -n "$CLI_LOG" ]; then touch "$CLI_LOG"; SANDBOX+=(--bind "$CLI_LOG" "$CLI_LOG"); fi
  [ -n "${E8_SKILL_DIR:-}" ] && ro "$E8_SKILL_DIR"
  SANDBOX+=(--bind "$CLAUDE_CONFIG_DIR" "$CLAUDE_CONFIG_DIR" --bind "$WORK" "$WORK" --chdir "$WORK" --)
fi

cd "$WORK"
# Own session for the agent: commands it pushes to the background outlive `claude -p` and would keep
# running (and hold pipes) after the session ends. Kill the whole session on exit or after E8_TIMEOUT_S.
setsid "${SANDBOX[@]}" claude -p "$(cat "$PROMPT")" --model "$M" --output-format stream-json --verbose \
  --permission-mode bypassPermissions --tools Bash Read Edit Write "$@" < /dev/null > "$OUT" 2> "$OUT.stderr" &
pid=$!
( sleep "${E8_TIMEOUT_S:-900}"; echo "cc-run: timeout after ${E8_TIMEOUT_S:-900}s" >> "$OUT.stderr"; pkill -TERM -s "$pid"; sleep 10; pkill -KILL -s "$pid" ) &
watchdog=$!
# `claude -p` also waits for its background tasks before it exits: once the result line is out, the
# session is over, so stop it there.
rc=0
while kill -0 "$pid" 2>/dev/null; do
  if grep -q '"type":"result"' "$OUT" 2>/dev/null; then sleep 3; break; fi
  sleep 2
done
wait "$pid" 2>/dev/null || rc=$?
grep -q '"type":"result"' "$OUT" 2>/dev/null && rc=0
pkill -P "$watchdog" 2>/dev/null; kill "$watchdog" 2>/dev/null
pkill -KILL -s "$pid" 2>/dev/null || true
exit "$rc"
