# Model test kit (E8)

Runs the `obsidian-connect` skill with a fresh headless Claude Code agent on a synthetic vault, judges each run against ground truth, and prices it. Results: [`docs/models/REPORT.md`](../../docs/models/REPORT.md).

## Setup (once)
1. `cd tests && npm ci` (vault generator and ground truth from `obsidian-test-fixture`).
2. Generate the vault with the answer key outside it, and open it in Obsidian as `vault-synth`. Steps: `docs/GATES.md`, "Steps for the user to regenerate `vault-synth` (E8.12)".
3. Install `bubblewrap` (the agent runs sandboxed: no `/home`, no repo, no answer key; keys go through `cred-proxy.mjs`).
4. Keys, mode 600, never committed: `~/.config/obsidian-agentkit/claude.env` (Claude subscription) and, for other models, `openrouter.env` (see `openrouter.env.example`).

## Run
```
node tests/models/run.mjs preflight                     # guard, sandbox, keys; runs nothing
node tests/models/run.mjs calibrate                     # reset the vault, record its baseline
node tests/models/run.mjs one haiku S1 with 1 --round 99
node tests/models/run.mjs matrix --round N --models haiku,sonnet --sides with --reps 3
bash tests/models/sandbox-check.sh haiku                # prove the agent cannot reach secrets or real vaults
```
The matrix skips runs that already have a verdict, so it can stop and resume. Scenarios S1–S9 are in `prompt.mjs`.

## Score
- Each run gets `pass`, `refused-safely` or `fail` from `judge.mjs`, plus a list of incidents (data loss, broken links, dialog left open, answer-key or harness reads).
- **Clean** = pass or refused safely, with 0 incidents. Headline numbers: clean runs, USD per clean run, median seconds, median tool calls.
- A model is **recommended** when, with the skill, it reaches its goal in ≥ 90% of runs with 0 incidents (H1 in `docs/plans/E8-small-models.md`).
- USD: OpenRouter runs use the key's real usage; Claude runs are priced as tokens × list price, cache reads at 10%.

## Re-judge and report
```
node tests/models/rejudge.mjs --round N                 # re-judge saved transcripts with the current judge
node tests/models/summary.mjs --round N --file results-rejudged-rN.jsonl --md
node tests/models/summary.mjs --round N --csv > docs/models/data/round-N.csv
node tests/models/failures.mjs                          # failure taxonomy
node --test tests/models/judge.test.mjs
```
Raw runs live in `tests/out/models/` (gitignored). Run `node tests/showcase/privacy-scan.mjs` before committing a report.

## History

| Date | Skill | CLI | Model | Clean runs | USD / clean run | Report |
|---|---|---|---|---:|---:|---|
| 2026-10-27 | v1 | 1.14.4 | 10 models | see report | — | [ROUND-0.md](../../docs/models/ROUND-0.md) |
| 2026-10-27 | v2 | 1.15.0 | haiku | 27/27 | 0.0020 | [ROUND-1.md](../../docs/models/ROUND-1.md) |
| 2026-10-27 | v2 | 1.15.0 | sonnet | 27/27 | 0.0190 | [ROUND-1.md](../../docs/models/ROUND-1.md) |
