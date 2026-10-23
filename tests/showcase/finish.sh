#!/bin/bash
# After a showcase run: judge the vault, turn the transcript into metrics, publish a redacted copy.
# Usage: tests/showcase/finish.sh <S1..S8> <without|with> <agentId> [--no-teardown]
#   raw (gitignored):  tests/out/showcase/<S>-<side>/
#   published:         docs/showcase/scenarios/<S>/<side>/
set -eu
S="$1"; SIDE="$2"; ID="$3"; shift 3
here="$(cd "$(dirname "$0")" && pwd)"; repo="$(cd "$here/../.." && pwd)"
RAW="$repo/tests/out/showcase/$S-$SIDE"
PUB="$repo/docs/showcase/scenarios/$S/$SIDE"
src=$(find "$HOME/.claude/projects" -name "agent-$ID.jsonl" | head -1)
[ -n "$src" ] || { echo "no transcript for $ID" >&2; exit 1; }
cp "$src" "$RAW/transcript.jsonl"
node "$here/check.mjs" "$S" "$SIDE" "$@" > /dev/null
node "$here/transcript.mjs" "$RAW/transcript.jsonl" "$RAW" > /dev/null
mkdir -p "$PUB"
node "$here/transcript.mjs" "$RAW/transcript.jsonl" "$PUB" --redact
node "$here/redact.mjs" < "$RAW/check.json" > "$PUB/check.json"
node "$here/redact.mjs" < "$RAW/lab.diff" > "$PUB/lab.diff"
node -e '
  const l = require("fs").readFileSync(process.argv[1], "utf8").split("\n").filter(Boolean).map(JSON.parse);
  for (const x of l.filter(x => x.ev === "end")) console.log([x.args.join(" "), "exit " + x.exit, x.out + " B out", x.err + " B err", x.ms + " ms"].join(" | "));
  for (const x of l.filter(x => x.ev === "start")) if (!l.some(e => e.ev === "end" && e.t >= x.t && JSON.stringify(e.args) === JSON.stringify(x.args))) console.log(x.args.join(" ") + " | NEVER RETURNED (killed or blocked)");
' "$RAW/cli.jsonl" 2>/dev/null | node "$here/redact.mjs" > "$PUB/cli-calls.txt" || true
cp "$RAW/baseline.json" "$PUB/baseline.json"
[ -f "$RAW/obsidian-modal.png" ] && cp "$RAW/obsidian-modal.png" "$PUB/" || true
if [ "$S" = S6 ]; then
  # S6 runs on real notes: publish numbers only (plan E7, Lưu ý). Raw stays in tests/out.
  rm -f "$PUB/transcript.md" "$PUB/answer.txt" "$PUB/lab.diff"
  node -e '
    const l = require("fs").readFileSync(process.argv[1], "utf8").split("\n").filter(Boolean).map(JSON.parse).filter(x => x.ev === "end");
    const by = {}; for (const x of l) { const c = x.args.find(a => !a.startsWith("vault=")) || "?"; (by[c] ||= { calls: 0, outBytes: 0, maxOut: 0 }); by[c].calls++; by[c].outBytes += x.out; by[c].maxOut = Math.max(by[c].maxOut, x.out); }
    console.log(JSON.stringify(by, null, 1));' "$RAW/cli.jsonl" > "$PUB/cli-by-command.json"
  rm -f "$PUB/cli-calls.txt"
fi
echo "published $PUB"
