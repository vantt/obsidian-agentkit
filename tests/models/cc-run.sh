#!/bin/bash
# Run one headless Claude Code session on a model under test (E8).
# Usage: cc-run.sh <model> <workdir> <prompt-file> <out.jsonl> [extra claude flags]
#   <model>  an OpenRouter id (deepseek/..., z-ai/...) or a Claude alias (haiku, sonnet, opus)
# Every model gets the same environment:
#   - a fresh, empty CLAUDE_CONFIG_DIR per session: no user plugins, hooks, MCP servers, ~/.claude/CLAUDE.md,
#     and no memory carried over from an earlier session;
#   - the same four tools (Bash, Read, Edit, Write);
#   - a workdir outside ~/projects, so no project CLAUDE.md is picked up.
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

cd "$WORK"
# Own session for the agent: commands it pushes to the background outlive `claude -p` and would keep
# running (and hold pipes) after the session ends. Kill the whole session on exit or after E8_TIMEOUT_S.
setsid claude -p "$(cat "$PROMPT")" --model "$M" --output-format stream-json --verbose \
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
