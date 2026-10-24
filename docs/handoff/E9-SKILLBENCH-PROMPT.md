# Handoff: turn the E8 measurement harness into a reusable compatibility bench

You are a coding agent starting fresh in `~/projects/obsidian-agentkit`. This is a public GitHub repo (`vantt/obsidian-agentkit`), branch `main`. Write every file in English. **Reply to the user in Vietnamese.**

## 1. Mission

The repo ships `obsidian-connect`, an Agent Skill that lets a coding agent work on an Obsidian vault through the official Obsidian CLI.

Epic E8 built a harness that runs fresh agent sessions on a synthetic vault, judges the result from the vault state, and records cost. That harness answers one question: "does the skill work on model X, through Claude Code, on today's Obsidian?"

Turn it into a **reusable bench**: one tool that re-tests the skill along four axes and keeps a comparable history.

| Axis | Examples | Today |
|---|---|---|
| **Obsidian version** | app and CLI 1.14.4, 1.14.5, later | whatever is installed (now CLI 1.14.5) |
| **Agent CLI** | Claude Code, OpenAI Codex CLI, Google Antigravity, pi / omp | Claude Code only (`claude -p`) |
| **Model** | Claude (subscription), DeepSeek, GLM, Gemini, OpenAI, … via OpenRouter | yes, via Claude Code |
| **Skill version** | git revision of `skills/obsidian-connect/` | frozen copy per round |

The bench is done when:
- one config file describes a matrix over these axes;
- one command runs it, and can stop and resume;
- every run is judged the same way, whichever agent CLI ran it;
- the results land in a history that can answer questions like "did skill rev X still pass on Obsidian 1.15 with Codex and gpt-6-luna?"

## 2. Read first, in this order

1. `README.md`, then `docs/HOW-IT-WORKS.md` (what the skill does).
2. `docs/plans/E8-small-models.md`: the experiment this harness was built for, its matrix, metrics and hypotheses.
3. `docs/GATES.md`, sections **"E8.1 and E8.2 spike"**, **"E8.2 and E8.3"** and **"E8.4 round 0"**. They list every harness failure met so far and how it was fixed. **Each one is a requirement for the bench** (summary in §5).
4. The harness itself:

   | File | Role |
   |---|---|
   | `tests/models/run.mjs` | runner: `preflight`, `calibrate`, `one`, resumable `matrix`; budget; cost per run; provider-error retry |
   | `tests/models/cc-run.sh` | Claude Code adapter: isolated config, 4 fixed tools, process-session kill, OpenRouter or subscription auth |
   | `tests/models/judge.mjs` | automatic verdict: `pass` / `refused-safely` / `fail`, incidents, rule breaks |
   | `tests/models/prompt.mjs` | the scenario prompts S1–S9 |
   | `tests/models/gen-synth-vault.mjs` | synthetic vault (~1,800 notes plus fixture) and its `.e8-synthetic` marker and answer key |
   | `tests/models/summary.mjs` | per model × side table and scenario grid |
   | `tests/showcase/setup.sh`, `check.mjs`, `transcript.mjs`, `obsidian` (logging wrapper), `install.sh` | pre-state, vault-state checks, transcript metrics, CLI call log |
   | `tests/scenarios/reset.sh` | reset to the baseline commit and wait for the index |
   | `tests/ground-truth/gt.mjs`, `tests/fixtures/gen-fixture.mjs` | file-only ground truth, hard-case fixture |
   | `tests/compat/` | the CLI probe suite with scored JSON history and `HISTORY.md` — **the model to copy** for history and scoring |

5. `tests/compat/README.md` and `tests/compat/TROUBLESHOOTING.md`: how the user wants a re-runnable kit to look.

## 3. Hard constraints

1. **Do not disturb the running E8 matrix.**
   - Until `pgrep -af "run.mjs matrix"` prints nothing, do not edit or move anything under `tests/models/`, `tests/showcase/`, `tests/scenarios/`, `tests/ground-truth/` or `tests/fixtures/`. The runner re-reads those scripts on every run.
   - Until then, do not run anything against the vault `vault-synth` (`C:\obsidian-agentkit-test\vault-synth`), and do not touch `~/.local/state/obs-e8/` or `~/.local/state/obs-showcase/`.
   - Build the bench in a new directory, for example `bench/`, by copying the pieces it needs.
   - Live runs need their own synthetic vault, for example `vault-bench`, which the user must open in Obsidian. Ask for this once, up front.
2. **Never send real vault content to a model.**
   - Live runs only on a generated vault that carries the marker file.
   - The guard checks the marker, and that `vault info=path` resolves to that vault's folder. Keep it.
   - `vault-copy` holds the user's real notes. It is off-limits to third-party models.
3. **Secrets:**
   - They live in `~/.config/obsidian-agentkit/*.env` (`openrouter.env`, `claude.env`), with mode 600.
   - Never print them, log them, or commit them.
   - New agent CLIs get their own env file with a committed `*.env.example`.
4. **Budget:** OpenRouter spend per run comes from the change in `GET /api/v1/key` `usage`, so OpenRouter runs must be sequential per key. Keep a hard cap, and stop when it is reached.
5. **Work style** (user preference):
   - Ask all questions once, up front, then run to completion.
   - Pass your own gates, and write each one into `docs/GATES.md`: problem, decision, reason.
   - Commit and push to `main` after each phase. End commit messages with the `Co-Authored-By` line the environment gives you.
   - Do not commit the staged move of `docs/research/distillery` (it waits for the user, E5.6).

## 4. What to build

### 4.1 Layout (adjust if you find a better one; record why in GATES)

```
bench/
  README.md               method, axes, scoring, how to add an agent / model / scenario / Obsidian version
  TROUBLESHOOTING.md      every harness failure and its fix (seed it from GATES E8)
  bench.mjs               CLI: preflight | calibrate | run <matrix> | resume | report | compare | import-e8
  matrix.example.yaml     axes and limits (see 4.2)
  adapters/               one file per agent CLI, same interface (4.3)
  scenarios/              S1..S9 as data: request, pre-state, ground-truth query, judge rules (4.4)
  lib/                    vault (generate, guard, calibrate, reset), check, judge, transcript normaliser, cost, store
  history/                one JSON per run batch; HISTORY.md rebuilt from them (like tests/compat)
  test/                   unit tests with a fake agent and tests/fake-obsidian.mjs; no Obsidian, no network
```

### 4.2 Matrix config

```yaml
obsidian: { vault: vault-bench, expect_cli: "1.14.x" }   # version is recorded, not switched (see 4.6)
skill:    { rev: HEAD }                                   # or a git rev; frozen copy outside the repo
agents:   [claude-code, codex, antigravity, pi]           # adapter ids
models:                                                   # per agent: which models it may drive, and how
  claude-code: [haiku, sonnet, openrouter:deepseek/deepseek-v4.1-flash, openrouter:z-ai/glm-5.3-flash]
  codex:       [openrouter:openai/gpt-6-luna, native:<codex default>]
scenarios: [S1, S2, S3, S4, S5, S6, S7, S8, S9]
sides:     [with, without]
reps: 3
limits: { timeout_s: 900, budget_usd: 40, retries_on_provider_error: 3 }
```

Every run id = hash of (scenario, side, rep, agent and its version, model id and provider, skill rev, Obsidian app and CLI versions, bench version). The matrix skips run ids that already have a verdict.

### 4.3 Agent adapter interface

Each adapter takes `{ model, workdir, prompt, skillDir, timeoutS, env }` and returns `{ exitCode, timedOut, rawTranscriptPath }`. It also provides `normalize(raw) → events` in one schema:

```
{ tool_calls: [{ name, input, output_bytes, error, ms }], final_answer,
  tokens: { input, cache_read, output, thinking }, duration_ms,
  provider_error: null | "<text>", models_seen: [...] }
```

Each adapter must guarantee the same isolation that `cc-run.sh` gives Claude Code. See §5 for why each point exists.
- **Fresh config and state per session:** no user plugins, hooks, MCP servers, rules files or memory carried between sessions.
- **Shell and file tools only:** the same small tool set for every agent where the CLI allows it. Where it does not, record the tool set the run actually had.
- **No background tasks.** The whole process session is killed at the end and on timeout.
- **A workdir outside the repo,** and outside any folder with an `AGENTS.md`, `CLAUDE.md` or `GEMINI.md`.
- **Every model slot pinned to the model under test.**

Agent CLIs to cover:

| Agent | Known so far | Your job |
|---|---|---|
| Claude Code | working: `claude -p --output-format stream-json`; OpenRouter through `ANTHROPIC_BASE_URL=https://openrouter.ai/api`; subscription through `CLAUDE_CODE_OAUTH_TOKEN` | port `cc-run.sh` |
| OpenAI Codex CLI | not tried | find its headless mode (`codex exec`, JSON output), sandbox and approval flags, how to point it at OpenRouter or another provider, where its config and memory live |
| Google Antigravity | not tried | check whether a headless or scriptable CLI exists. If it does not, say so, and propose the closest option (for example Gemini CLI) as a separate adapter. Do not fake one |
| pi / omp | the user wrote "pi/opm". Probably the `pi` coding agent and a variant or fork such as "oh-my-pi"; **confirm with the user in the up-front questions** | build the adapter once its identity is confirmed |

For each adapter, write a smoke test like the E8 one: "count the files in `./demo` with the shell tool". Also write a background-task test: the agent runs `sleep 600` in the background and answers at once; the session must end in seconds.

### 4.4 Scenarios as data

Move S1–S9 out of code into `bench/scenarios/S*.yaml`. Each file holds:
- the user request (the Vietnamese wording from `tests/models/prompt.mjs`);
- `approved`;
- the pre-state step (for example `alwaysUpdateLinks: false`, `cli_closed: true`, two sessions);
- the ground-truth query;
- the pass rules and incident rules that `judge.mjs` hard-codes today.

The judge becomes generic.

Keep S1–S9 judged exactly as E8 judged them. Prove it: re-judge the E8 round-0 run folders (`tests/out/models/r0/`) with the new judge, and diff the verdicts against `tests/out/models/results.jsonl`. Any difference must be explained in GATES.

The prompt template should become per-agent where needed: how to tell each CLI where the skill is. Keep the task text identical across agents.

### 4.5 Results, history, report

- **Raw runs:** `tests/out/bench/<run id>/`, gitignored, with the same files E8 keeps.
- **Committed history:** `bench/history/<UTC>_<label>.json`, one row per run with every axis value and version, the verdict, incidents, rule breaks, tokens, cost (and its source), and time.
- **`HISTORY.md`,** rebuilt from the history files: a score per (agent, model, Obsidian version, skill rev).
  - Score = clean runs ÷ runs, where clean means goal met and no incident.
  - Also show incident count, USD per clean run, and median time.
  - Flag flips since the last comparable batch, as `tests/compat` does.
- **`bench.mjs compare A B`:** which cells flipped between two batches, with the reasons.
- **`bench.mjs report`:** markdown tables like `tests/models/summary.mjs`, plus SVG charts. Reuse the chart approach in `tests/showcase/report.mjs`.
- **`import-e8`:** convert E8's `results.jsonl` (rounds 0+) into history rows, so E8 is the first baseline.

### 4.6 Obsidian version axis

- Obsidian auto-updates. Switching app versions on one machine is not trivial.
- Research the options and record the decision in GATES. Options include: older installers from `obsidianmd/obsidian-releases`, a portable second install, turning auto-update off, or recording and comparing over time.
- At minimum:
  - every run records the app and CLI version from `obsidian version`;
  - `bench.mjs preflight` warns when it differs from the last batch;
  - the bench can trigger `tests/compat/probes.mjs`, so a new Obsidian version gets both the CLI-level probe score and the agent-level bench score.

### 4.7 Speed (optional, after the rest works)

- One run takes about 45–160 s. Of that, about 35–50 s is reset, index wait, cost polling and checks.
- Ideas:
  - cost from OpenRouter's per-generation endpoint, not from polling the key;
  - several synthetic vaults (`vault-bench-1..N`, each opened in Obsidian) with one worker per vault.
- Parallel OpenRouter runs then need per-generation cost, not key deltas.

## 5. Lessons from E8: each one is a requirement

All of these are in `docs/GATES.md`. Put each into `bench/TROUBLESHOOTING.md` and keep a test or guard for it.

1. **Tool search adds a placeholder tool** with `defer_loading`. OpenRouter then routes only to the few providers that support it, and those return 429 on every call. Claude Code needs `ENABLE_TOOL_SEARCH=false`. Check other CLIs for anything similar.
2. **A provider error is not a model failure.** Detect it (`API Error…`, 429, 5xx), never judge it, wait, reset and retry.
3. **Agents commit to the vault's git** (the skill's snapshot rule), or stage with `git mv`.
   - Reset to the **baseline commit** recorded at calibration, not to `HEAD`.
   - Judge after a mixed reset to that commit.
4. **Obsidian rewrites config files on first open and after restarts** (`appearance.json`, `core-plugins.json`). Calibrate must fold them into the baseline. Otherwise they show up as false config incidents.
5. **Auto-memory leaked between sessions** through a shared config dir: an agent read a note an earlier agent wrote. Use a fresh config dir per session for every CLI.
6. **A reboot cleared the bridge's CLI cache** in the OS temp dir. The bridge then called the real CLI and skipped the logging wrapper, so no CLI log was written. Re-point the cache before every session, and treat a missing CLI log as an error.
7. **Background tasks:** `claude -p` waits for them. Their pipes held the runner for about 2 hours on one run.
   - Set `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`.
   - Run each session in its own process session, and kill it.
   - Hold no pipes to the agent's process tree.
8. **Streamed per-message usage is zero through OpenRouter.** Take totals from the final result record.
   - Claude Code's own `total_cost_usd` uses Anthropic prices, so it is wrong for other models.
   - Subscription runs have no billed cost. Compute it from tokens and a versioned price table.
9. **Some models end with a hidden-reasoning block,** which leaves `result` empty (Gemini 3.5 flash-lite). Take the final answer from the last text block.
10. **Obsidian can stop, or lose its vault registration,** between batches. Preflight must say exactly what the user has to do.

## 6. Phases and gates

0. **Questions to the user, all at once.** At least:
   - which "pi / omp" they mean;
   - whether a second synthetic vault may be created and opened;
   - which agent CLIs are installed and logged in on this machine (`which codex`, …), and which may use the OpenRouter key;
   - the budget for live runs;
   - whether the Obsidian-version axis should include installing an older build.

   Then work without pausing.
1. **Port** the harness into `bench/`, with the Claude Code adapter and scenarios as data. Re-judge E8 r0, and get identical verdicts or explained differences. Unit tests must pass offline. *Gate: GATES section "E9.1".*
2. **Adapters:** Codex, then pi / omp, then Antigravity, or its documented replacement. Smoke test plus background-task test for each. *Gate per adapter.*
3. **History, report, compare,** and `import-e8`. `HISTORY.md` shows E8 as the first baseline.
4. **One live batch on `vault-bench`,** only after the E8 matrix has finished. Use 1 rep, S1 S2 S4 S5, with and without the skill, and at least two agents and three models. Commit the history and report.
5. **Docs:**
   - `bench/README.md`: a reader can add an agent, a model, a scenario or an Obsidian version without help;
   - `TROUBLESHOOTING.md`;
   - a short section in `docs/HOW-IT-WORKS.md`;
   - a board entry in `docs/BACKLOG.md` (a new epic E9 with its plan in `docs/plans/E9-skill-bench.md`, in Vietnamese like the other plans).

## 7. Done when

- [ ] `node bench/bench.mjs run bench/matrix.example.yaml` runs, resumes after a kill, respects the budget, and never touches a vault without the marker.
- [ ] Claude Code, Codex and pi / omp adapters pass their smoke and background-task tests. Antigravity has an adapter, or a written reason why it cannot have one, plus a replacement.
- [ ] Re-judging E8 round 0 gives the same verdicts (or explained differences).
- [ ] `HISTORY.md` holds E8 plus one live batch, and `compare` works between them.
- [ ] Offline unit tests pass (`npm test` in `tests/` or `bench/`).
- [ ] Every gate is in `docs/GATES.md`. Every harness problem is in `bench/TROUBLESHOOTING.md`.
- [ ] All committed and pushed, without secrets and without the distillery move.
