#!/bin/bash
# Check the cc-run.sh sandbox (E8.12) with one real agent session, without Obsidian and without OpenRouter.
# Usage: tests/models/sandbox-check.sh [model]     (default haiku; Claude token from ~/.config/obsidian-agentkit/claude.env)
# The agent runs probe.sh once. It must not see this repo, the E8 state, the secrets or an answer key; it must
# still run node, read the skill copy, write the vault, and reach the API (the session itself proves that).
# Obsidian's vault list (Windows %APPDATA%\obsidian\obsidian.json) must show only this check's dummy vault, and
# no id or path of a real vault may reach the transcript. The real obsidian.json is read here, outside the
# sandbox, only to build that leak list; it is never printed.
# Uses its own state folder, so it never touches a real run's config, work dir or answer key.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; repo="$(cd "$here/../.." && pwd)"
M="${1:-haiku}"
export E8_STATE="$HOME/.local/state/obs-e8-sandbox-check"
rm -rf "$E8_STATE"; mkdir -p "$E8_STATE/work" "$E8_STATE/vault" "$E8_STATE/skill-r0"
cp -r "$repo/skills/obsidian-connect" "$E8_STATE/skill-r0/"
echo "SANDBOX-CHECK-SECRET-$RANDOM$RANDOM" > "$E8_STATE/answer-key.json"   # stands in for the real key
echo '# Probe note' > "$E8_STATE/vault/Probe.md"
export E8_VAULT_DIR="$E8_STATE/vault" E8_SKILL_DIR="$E8_STATE/skill-r0/obsidian-connect" E8_TIMEOUT_S=300
# The dummy vault is not on the Windows drive and not known to Obsidian: list it under a made-up Windows path.
DUMMY_WIN='C:\obsidian-agentkit-test\sandbox-check-vault'
export E8_OBSIDIAN_JSON="$E8_STATE/obsidian.json"
E8_OBSIDIAN_JSON_AT="$(node "$here/obsidian-json.mjs" "$E8_VAULT_DIR" "$E8_OBSIDIAN_JSON" --win-path "$DUMMY_WIN")" || exit 1
export E8_OBSIDIAN_JSON_AT
WORK="$E8_STATE/work"; OUT="$E8_STATE/out"; mkdir -p "$OUT"
REAL_CLI="$(cat "$HOME/.local/state/obs-showcase/real-cli" 2>/dev/null)"

# Each probe: name, expectation (deny|allow), command. Paths are expanded here, outside the sandbox.
cat > "$WORK/probe.sh" <<EOF
# Expectation info: shown, never judged (the leak check below still covers its output).
p() { echo "### \$1 \$2"; out=\$(bash -c "\$3" 2>&1); rc=\$?; printf '%s\n' "\$out" | head -5; echo "rc=\$rc lines=\$(printf '%s' "\$out" | grep -c .)"; }
p repo deny 'ls $HOME/projects'
p repo-file deny 'cat $repo/tests/models/judge.mjs'
p e8-state deny 'ls $HOME/.local/state/obs-e8'
p real-answer-key deny 'cat $HOME/.local/state/obs-e8/answer-key.json'
p check-answer-key deny 'cat $E8_STATE/answer-key.json'
p secrets deny 'ls $HOME/.config/obsidian-agentkit'
p ssh deny 'ls $HOME/.ssh'
p other-vaults deny 'ls /mnt/c/obsidian-agentkit-test'
p windows-home deny 'ls /mnt/c/Users/*/Documents'
p cmd-exe deny 'ls /mnt/c/Windows/System32/cmd.exe'
p node allow 'node --version'
p skill allow 'head -3 $E8_SKILL_DIR/SKILL.md'
p vault-write allow 'echo probe >> $E8_VAULT_DIR/Probe.md && cat $E8_VAULT_DIR/Probe.md'
p obsidian-wrapper allow 'test -x $HOME/.local/bin/obsidian && ls "$REAL_CLI"'
p network allow 'curl -sS -o /dev/null -w "%{http_code}" https://api.anthropic.com/'
p obsidian-json allow 'cat /mnt/c/Users/*/AppData/Roaming/obsidian/obsidian.json'
p obsidian-json-one allow 'n=\$(cat /mnt/c/Users/*/AppData/Roaming/obsidian/obsidian.json | grep -o "\\"path\\":" | wc -l); grep -qF sandbox-check-vault /mnt/c/Users/*/AppData/Roaming/obsidian/obsidian.json && [ "\$n" = 1 ] && echo "vaults=\$n"'
p obsidian-json-ro deny 'echo x >> /mnt/c/Users/*/AppData/Roaming/obsidian/obsidian.json && echo written'
p appdata-only-json allow '[ "\$(ls -A /mnt/c/Users/*/AppData/Roaming/obsidian)" = obsidian.json ] && echo "only obsidian.json"'
p appdata-other deny 'ls -A /mnt/c/Users/*/AppData/Roaming | grep -vx obsidian'
p bridge-preflight info 'OBS_CLI=/nonexistent OBS_VAULT=vault-synth node $E8_SKILL_DIR/scripts/obs.mjs --preflight'
EOF
echo 'Run `bash probe.sh` once with the Bash tool, then reply DONE. Do not run anything else.' > "$OUT/prompt.txt"

"$here/cc-run.sh" "$M" "$WORK" "$OUT/prompt.txt" "$OUT/transcript.jsonl"; rc=$?
echo "cc-run exit $rc; session result: $(grep -c '"type":"result"' "$OUT/transcript.jsonl" 2>/dev/null) line(s)"
# The probe output, as the agent saw it (tool_result of its Bash call).
node -e '
const fs = require("fs");
const lines = fs.readFileSync(process.argv[1], "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return {}; } });
const res = lines.flatMap((d) => d.message?.content || []).filter((b) => b?.type === "tool_result")
  .map((b) => (Array.isArray(b.content) ? b.content.map((c) => c.text || "").join("") : String(b.content || ""))).find((t) => t.includes("### repo"));
if (!res) { console.log("FAIL: the agent did not run probe.sh"); process.exit(1); }
let bad = 0;
for (const block of res.split("### ").slice(1)) {
  const [head, ...body] = block.trim().split("\n");
  const [name, want] = head.split(" ");
  const [, rc, n] = body.at(-1).match(/rc=(\d+) lines=(\d+)/) || [];
  const allowed = rc === "0" && Number(n) > 0;
  const ok = want === "info" || (want === "allow") === allowed;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name.padEnd(18)} ${allowed ? "allowed" : "denied "} (want ${want}): ${body.slice(0, -1).join(" | ").slice(0, 110)}`);
}
console.log(bad ? `${bad} probe(s) failed` : "sandbox ok");
process.exit(bad ? 1 : 0);
' "$OUT/transcript.jsonl"; bad=$?
# The stand-in key must not appear anywhere in what the agent saw.
if grep -qF "$(cat "$E8_STATE/answer-key.json")" "$OUT/transcript.jsonl"; then echo "FAIL: the answer key reached the transcript"; bad=1; fi
# No id or path of a real vault from the real obsidian.json may appear in what the agent saw. Only a count is printed.
leaks=$(node -e '
const fs = require("fs"), { execFileSync } = require("child_process");
let real; try { real = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); } catch { console.log("none"); process.exit(0); }
const t = fs.readFileSync(process.argv[2], "utf8").toLowerCase();
let n = 0;
for (const [id, v] of Object.entries(real.vaults || {})) {
  const w = String(v.path || ""); let u = ""; try { u = execFileSync("wslpath", ["-u", w], { encoding: "utf8" }).trim(); } catch {}
  const forms = [id, w, JSON.stringify(w).slice(1, -1), u].filter((f) => f.length > 3).map((f) => f.toLowerCase());
  if (forms.some((f) => t.includes(f))) n++;
}
console.log(`${n}/${Object.keys(real.vaults || {}).length}`);
' "$E8_OBSIDIAN_JSON_AT" "$OUT/transcript.jsonl")
case "$leaks" in none) echo "real obsidian.json: none found, leak check skipped" ;;
  0/*) echo "real vault entries in the transcript: $leaks" ;;
  *) echo "FAIL: real vault entries in the transcript: $leaks"; bad=1 ;; esac
exit $bad
