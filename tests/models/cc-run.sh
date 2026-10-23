#!/bin/bash
# Run one headless Claude Code session on a model under test (E8).
# Usage: cc-run.sh <model> <workdir> <prompt-file> <out.jsonl> [extra claude flags]
#   <model>  an OpenRouter id (deepseek/..., z-ai/...) or a Claude alias (haiku, sonnet, opus)
# Every model gets the same environment:
#   - a fresh CLAUDE_CONFIG_DIR: no user plugins, hooks, MCP servers, memory or ~/.claude/CLAUDE.md;
#   - the same four tools (Bash, Read, Edit, Write);
#   - a workdir outside ~/projects, so no project CLAUDE.md is picked up.
# Secrets come from ~/.config/obsidian-agentkit/{openrouter,claude}.env and are never printed.
set -euo pipefail
M="$1"; WORK="$2"; PROMPT="$3"; OUT="$4"; shift 4
CFG="$HOME/.config/obsidian-agentkit"
STATE="${E8_STATE:-$HOME/.local/state/obs-e8}"
export CLAUDE_CONFIG_DIR="$STATE/claude-config"
mkdir -p "$CLAUDE_CONFIG_DIR"
export DISABLE_TELEMETRY=1 DISABLE_ERROR_REPORTING=1 CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
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
exec claude -p "$(cat "$PROMPT")" --model "$M" --output-format stream-json --verbose \
  --permission-mode bypassPermissions --tools Bash Read Edit Write "$@" < /dev/null > "$OUT"
