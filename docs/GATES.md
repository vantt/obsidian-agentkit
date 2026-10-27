# Gate log

The user let the agent pass the review gates of `docs/handoff/BUILD-PROMPT.md` on its own, provided each gate records what came up, what was decided and why. Read this before approving v1.

## Gate 0: inputs (2026-10-22)

- The copy was made by the agent with `robocopy` (read-only on the source), from the Google Drive vault to `C:\obsidian-agentkit-test\vault-copy`: 5,893 files and 3,074,425,871 bytes, matching the source exactly. The user opened it in Obsidian as `vault-copy`.
- The git repo in the copy tracks only `.md`, `.canvas`, `.base` and `.obsidian` config, with `core.autocrlf=false`. Binary attachments are left out to keep `.git` small (4.7 MB). Tests never edit attachments.
- User answers: skill name `obsidian-connect`; test 10 skipped; no MCP comparison; short adapted references instead of installing kepano skills; plugin packaging later; settings changes allowed in the copy only; 1 run per scenario test (3 if it fails); commit and push after each phase.
- Added later by the user:
  - the skill records the CLI version it was tested on;
  - a re-runnable probe suite with method, measurements and scoring, plus a score history so versions can be compared;
  - a troubleshooting log inside the test kit.

## Gate 1: FINDINGS review (2026-10-22)

**Issues met**

1. **The research spec is out of date for CLI 1.14.4.**
   - `tasks all` and `tags all` no longer exist; plain `tasks` and `tags` are vault-wide, and `active` is the opt-in.
   - `properties format=json` now returns JSON.
   - `create` makes parent folders, honours `path=` with `template=`, and opens no UI.
   - BUILD-PROMPT section 6 says "always pass `tasks all`, `tags all`" and "use `silent`".
2. **Rename and move do NOT always update links** (F4c). With `alwaysUpdateLinks` off, a modal blocks the CLI; on timeout the file is already renamed and its links are broken. YARDSTICK lists this as an unverified assumption, so it is a measurement, not a contradiction.
3. **CLI `delete` ignores `trashOption: local`** (F5) and always uses the Windows Recycle Bin. The user decision says "delete always goes to `.trash`".
4. **`property:set` rewrites `types.json` vault-wide** (F9b) and mangles lists of links and numbers (F9a).
5. **`create` on an existing path silently makes `name 1.md`** (F9c), and `daily:append` repeats on rerun (F9g).

**Decisions and reasons**

1. **Follow the measured 1.14.4 behaviour, and keep the old safety intent.**
   - The bridge passes no `all` flag; it would be ignored, and the default is already vault-wide.
   - The skill teaches "never use `active`" and "always pass `path=`".
   - The version check makes the skill warn when the CLI is not the tested 1.14.x, because the old `all` behaviour may return on another version.
   - Why: the BUILD-PROMPT rule is "if a measurement contradicts the docs, ask". The user pre-authorised the agent to decide at gates, and the safest reading of the intent (explicit scope, no active-file reliance) is kept.
2. **Rename and move go through a bridge command that refuses unless the live `alwaysUpdateLinks` is `true`.**
   - The bridge counts `unresolved total` and the target's backlinks before and after, and fails loudly on any change.
   - Why: a hung modal after the rename is the worst case, because it is half-applied and silent.
3. **`delete` goes through the bridge, which moves the file into `<vault>/.trash/` itself**, a plain file move that mirrors Obsidian's `local` option.
   - It never calls CLI `delete`. Links to a deleted note become unresolved either way.
   - Why: the user decision "delete always goes to `.trash`" is not achievable through the CLI (F5), and the Recycle Bin on a Google Drive virtual drive is unverified.
4. **Typed properties (list, number, date, checkbox, links) are edited in the file**, with line-anchored edits, then validated with a YAML read-back (`properties path=… format=json`).
   - `property:set` is used only for plain text values on keys not registered in `types.json`.
   - Why: F9a and F9b; data safety beats convenience.
5. **Creates check for an existing file first (`file path=`), and daily appends check for the line first.**
   - Why: F9c and F9g.

**Not verified at this gate:** admin terminal, Drive Recycle Bin, MCP.

## Gate 2: SPEC approval (2026-10-22)

**Issues met**

1. **Bridge shape.** BUILD-PROMPT suggests a POSIX shell script plus a PowerShell script, or one Node script. Node runs on both sides (Windows v22, WSL v24).
2. **Where the profile goes.** Writing into the vault would sync through Drive and mix generated files with notes.
3. **Reading `alwaysUpdateLinks` live needs `eval`,** which is on the "never without request" list. The file value can differ from the live one (F11).
4. **New user requests:** a version pin, a re-runnable probe suite with scoring and history, and a troubleshooting log.

**Decisions and reasons**

1. **One Node bridge.** It means a single implementation of exit-code parsing and guards, and it sidesteps the Git Bash `.exe` trap. The cost: Node must be installed. Preflight reports `no-node` implicitly, because the script cannot start, so the skill says "if `node` is missing, use file mode".
2. **The profile goes to stdout, or `--out` to a gitignored file in the agent's working dir, never into the vault.** Why: Drive sync and no vault pollution.
3. **The bridge may use `eval` read-only, for one `getConfig` call inside `--rename`/`--move`/`--preflight`.** The agent itself is still denied `eval`. Why: a stale file value could let a rename through while the modal blocks and links break (F4c), which is worse than one controlled read-only eval.
4. **Probe suite, `HISTORY.md` with weighted scores, `RESULTS.md` rows per version, and `tested-cli` in the SKILL metadata** (SPEC §5).

## Phase 3 build notes (no gate)

- **`backlinks … total` lagged** after a move into a new folder (9 → 1 for 8+ s). Decision: the guarded move polls for up to 30 s instead of sleeping once. Why: a fixed sleep either wastes time or reports a false failure.
- **With Obsidian closed, the "unable to find Obsidian" message comes on stderr from WSL.** The first bridge version read only stdout and mapped it to exit 3. Fixed: the bridge checks both streams, and a test was added.
- **Probe harness flakiness.** Write probes left ghost index entries that broke a later read probe, and a reset right after an app start left the index stale. Decision: read-only probes run first; the start does a reset, then `reload`, then waits until backlinks equal the file-only ground truth. Every lesson went into `tests/compat/TROUBLESHOOTING.md`.

## Gate 3: accepting the gaps (2026-10-22)

**Issues met in Phase 4**

1. **Case 4 answered correctly but cost about 6,100 tokens**, because SKILL.md said "`total`, then `format=json`".
2. **Case 5 found that `daily:read` creates an empty daily note** (a new finding, F9j).
3. **Case 6 found that diacritics change search results** ("Đà Nẵng" ≠ "Da Nang").
4. **Agents in cases 2, 3, 7 and 8b reported gaps in the skill text:**
   - empty snapshot commits;
   - date-like values on unregistered keys;
   - alias-name links;
   - verifying a tag rename when nested tags are kept;
   - conflict-copy patterns that match ordinary notes;
   - `rg` broken by a shell hook.
5. **One agent in case 2 wrongly stated that `[[TN Alias]]` resolves.** It does not (F4e). This did not affect the result, and the skill's backlink row now states the rule.

**Decisions and reasons**

1. **Every gap was fixed in the skill text, not in the bridge,** with one new probe (P29). Only case 4 was re-run to confirm the token fix (about 60 tokens).
   - The other cases had already passed. The fixes either add guidance for situations those runs handled correctly anyway, or clarify wording.
   - Why: the user asked for 1 run per case and 3 only on failure. No case failed its pass criteria.
2. **Gaps accepted for v1, recorded in `tests/RESULTS.md`:**
   - *Case 9:* bridge-level only. Answers are identical from PowerShell and WSL, but no Windows-native agent session was run.
   - *Case 10, Google Drive Recycle Bin, sync conflicts:* not tested (user decision).
   - *Admin terminal:* not tested.
   - *Token estimates:* they count bridge output and Read lines, not output from the agent's own `grep`/`cat`. This undercounts cases 1, 2, 7 and 8b.
   - *Sample size:* single runs, so variance between sessions is unknown.
3. **The pre-authorised gate decision (user, 2026-10-22) is applied:** the agent accepts these gaps and reports them for review rather than blocking. They are what the user should look at first.

## E8.1 and E8.2 spike: small-model matrix and harness (2026-10-23)

**Decisions by the user**

1. **Models under test, through OpenRouter:** `deepseek/deepseek-v4.1-flash`, `deepseek/deepseek-v4-flash`, `z-ai/glm-5.3-flash`, `z-ai/glm-4.7-flash`. Budget cap $40; the OpenRouter key also has a $50 limit on its side and **expires 2026-10-30**.
2. **Claude models (Haiku, the strong reference) run on the Claude Code subscription**, not OpenRouter.
3. **thehive was tried and dropped.** The key had only two models and no cheaper variants. It has no Anthropic-style endpoint, so it needs a proxy. It returned 429 after about 70 quick requests.
4. **Gemini Flash and Codex are checked later (E8.11),** assuming they behave like the models above.

**Spike findings (measured)**

1. **OpenRouter `POST /api/v1/messages` (Anthropic style) works for all four models,** with either `x-api-key` or `Authorization: Bearer`. Every model made a correct `tool_use` call and answered correctly after the `tool_result`. Each response carries `usage.cost` in USD.
2. **`claude -p` reaches all four models** with `ANTHROPIC_BASE_URL=https://openrouter.ai/api`, `ANTHROPIC_API_KEY=<key>` and every model slot pinned to the model under test. All four answered a one-tool task correctly in 2 turns.
   - Claude Code logs `claude-code:unrecognized_model` on stderr and assumes a 200k context. This is harmless.
   - Claude Code's own `total_cost_usd` uses Anthropic prices, so it is wrong for these models (it reported $0.099 for a run that cost under $0.001). Cost comes from OpenRouter instead.
3. **`--bare` leaves only 3 tools (Bash, Edit, Read);** without it there are 20. The subscription run showed 28 tools, because some tools depend on the account type. A plain run's system prompt is about 47k input tokens.
4. **`--tools Bash Read Edit Write` gives every model the same four tools** and cuts a one-tool task to about 7k input tokens.
5. **A fresh `CLAUDE_CONFIG_DIR` loads none of the user's plugins, hooks, MCP servers or memory;** only the built-in plugins remain. A workdir outside `~/projects` avoids the parent `CLAUDE.md`.
6. **The subscription cannot be used from a fresh config dir with the user's existing login.**
   - The CLI's stored OAuth session was expired ("OAuth session expired and could not be refreshed").
   - Copying `~/.claude/.credentials.json` is not acceptable, because a token refresh could log out the user's own sessions.
7. **`claude -p` stream-json output carries timestamps and per-message usage,** and no session file is written in the fresh config dir. The runner keeps the stream-json output as the transcript.

**Decisions and reasons**

1. **One harness for all models: `tests/models/cc-run.sh`.**
   - It uses a fresh config dir, the same four tools via `--tools`, `bypassPermissions`, and a workdir outside `~/projects`.
   - Only the model and the auth differ between runs.
   - Why: E8 compares models, so everything else must be equal. Fixing the tools also removes about 40k tokens of irrelevant tool descriptions, which matters most for small models.
   - Trade-off: this is not the stock Claude Code tool set that E7 used, so E8 numbers are not directly comparable with E7. The strong model is re-run under E8's harness as the reference.
2. **Claude auth: a long-lived token from `claude setup-token`,** stored as `CLAUDE_CODE_OAUTH_TOKEN` in `~/.config/obsidian-agentkit/claude.env`. The user must run this once, interactively.
3. **Cost per run is the change in OpenRouter `GET /api/v1/key` `usage` before and after the run.** Runs are sequential, so the change belongs to that run alone. Claude runs record their tokens; USD for them is computed from Anthropic list prices.
4. **No proxy and no fallback agent loop are needed** for the four OpenRouter models. The fallback stays in the plan in case a model breaks on real scenarios.

**Follow-up, same day: the subscription path works.**

- The user ran `claude setup-token` and stored the token in `~/.config/obsidian-agentkit/claude.env`; the file has mode 600 and is outside the repo.
- `cc-run.sh haiku` and `cc-run.sh sonnet` both answered the one-tool test correctly in 2 turns.
- Both runs had the same environment as the OpenRouter runs: the same four tools, the same two built-in plugins, no MCP, and `apiKeySource: none`, which means the token was used and no API key.
- Only the requested Claude model appears in `modelUsage`, so no background calls went to another model.
- Input was about 11–13k tokens, against about 7k for the OpenRouter models on the same task. Claude Code sends a somewhat longer prompt to Claude models. E8.9 reports this as a known difference; it does not favour the small models.

## E8.2 and E8.3: runner, judge, synthetic vault (2026-10-23)

**Built**

- `tests/models/gen-synth-vault.mjs` writes the synthetic vault `vault-synth` at `C:\obsidian-agentkit-test\vault-synth`.
  - 1,790 generated notes plus the `_agentkit-lab/` fixture, with a git repo.
  - A `.e8-synthetic` marker file holds the S6 answer key.
  - The user opened the vault in Obsidian. Calibration found backlinks 9 and unresolved 35, which matches the file-only ground truth.
- `tests/models/run.mjs` runs the tests: `preflight`, `calibrate`, `one`, and a resumable `matrix`.
- `tests/models/judge.mjs` gives the automatic verdict. Re-run on the 16 E7 runs, it reproduces all six incidents counted by hand.
- `setup.sh`, `check.mjs` and `reset.sh` take the vault from env, defaulting to `vault-copy`. S9 was added.

**Problems met in the first end-to-end runs, and decisions**

1. **Every OpenRouter run through Claude Code got 429 "rate-limited upstream"; direct API calls did not.**
   - Found with a logging proxy and request replay: Claude Code's tool search adds a `DeferredToolPlaceholder` tool with `defer_loading: true`.
   - With that tool in the request, OpenRouter routes only to providers that support it, and those were rate-limited. Removing just that tool gave 200.
   - Decision: `cc-run.sh` sets `ENABLE_TOOL_SEARCH=false` for every model. With four fixed tools there is nothing to defer, and every model keeps the same setup.
2. **Provider errors must not count as model failures.**
   - The judge had read the "429" in "API Error: Request rejected (429)" as the agent's answer to S1.
   - Decision: the judge refuses to judge an answer that is an API error. The runner logs the attempt to `errors.jsonl`, waits, resets and retries, up to 3 attempts. After that it writes `error.json` and no verdict, so a later matrix pass retries the run.
3. **Obsidian wrote `.obsidian/appearance.json` when the vault was first opened, and the judge counted it as a config incident.**
   - Decision: `calibrate` commits the files Obsidian writes on first open into the vault's baseline.
4. **Streamed per-message token usage is all zeros through OpenRouter.** The `result` line has the real totals.
   - Decision: every model's tokens come from `result.usage`, so Claude and OpenRouter runs are counted the same way.
   - Per-call context size (E7's `contextGrowth`) is not available for E8.
5. **The skill-read measure missed E8's frozen skill copies,** because the regex expected `skills/obsidian-connect/`. The regex now matches any `obsidian-connect/` path.
6. **Obsidian updated itself to CLI 1.14.5 during E8.**
   - The skill was tested on 1.14.4. The bridge's version check accepts any 1.14.x, and the first agent noticed the new version without trouble.
   - E8 runs record the version actually used. A probe re-run on 1.14.5 belongs to E5.3.

**Trial runs after the fixes (round 99, kept out of the results)**

| Model | Run | Result | Tool calls | Input / output tokens | Time | Cost |
|---|---|---|---:|---:|---:|---:|
| `z-ai/glm-5.3-flash` | S1 with | pass | 3 | 24k / 1.9k | 33 s | $0.0004 |
| `deepseek/deepseek-v4.1-flash` | S1 with | pass | 6 | 46k / 2.3k | 30 s | $0.0017 |
| `deepseek/deepseek-v4-flash` | S1 with | pass | 3 | 23k / 0.6k | 41 s | $0.0025 |
| `z-ai/glm-4.7-flash` | S1 with | pass | 3 | 23k / 0.7k | 23 s | $0.0003 |
| Haiku 5.5 (subscription) | S1 with | pass | 3 | 26k / 1.0k | 12 s | — |
| Sonnet 5.5 (subscription) | S1 with | pass | 2 | 24k / 0.5k | 13 s | — |
| `z-ai/glm-5.3-flash` | S4 without | goal met, 1 incident | 8 | 58k / 1.1k | 178 s | $0.0044 |
| `deepseek/deepseek-v4-flash` | S8 with, 2 sessions | pass | 9 | 79k / 2.2k | 39 s | $0.0045 |

- The S4 incident is the same `types.json` damage the strong model caused in E7: `tags` became `multitext`, and `rating: number` was added.
- OpenRouter spend so far, including the spike, is $0.036.
- Decision: E8.2 and E8.3 are done. Round 0 can start.

## E8.4 round 0, rep 1: first attempt invalid (2026-10-23)

**What happened**

- From the third S2 run on, every setup failed with `reset: index not at baseline`. 95 of 108 cells did not run, so they cost nothing.
- **Cause:** following the skill's snapshot rule, GLM 5.3 flash committed "snapshot before rename" into the vault's own git repo. The harness reset to `HEAD`, which was now the agent's commit, so the vault never returned to its baseline.
- **Second, unnoticed risk:** `check.mjs` compared against `HEAD` and used `git diff`. A change the agent had committed, or staged with `git mv`, would have been invisible to the judge.
- Obsidian was no longer running after the matrix ended. The CLI logs and transcripts show no agent stopping it.
- Seen in the runs that did happen: DeepSeek v4 flash, with the skill, used `eval` to set `alwaysUpdateLinks` true and back to false in order to rename. The judge counted both calls as incidents. They break the skill rule that the agent never uses `eval`. This goes to E8.5.

**Decisions**

1. **Calibration records the baseline commit.**
   - `reset.sh` does `git reset --hard <base>` and, for the synthetic vault only, removes every untracked file.
   - `check.mjs` starts with `git reset --mixed <base>`. The agent's commits and staged changes then show as plain working-tree changes, while the files stay as the agent left them.
   - `agentCommits` is recorded per run, for information only. A snapshot commit is what the skill asks for, so it is not an incident.
2. **The S1 rows stay.** They ran before any agent commit, on a clean baseline. Everything from S2 on is set aside in `tests/out/models/results-invalid-r0.jsonl` and `invalid-r0/`, and will be re-run.
3. **OpenRouter spend so far:** $0.119 in total, including the spike and the trials.

## E8.4 round 0: stopped at 434/540, model recommendation (2026-10-27)

**State**

- Round 0 covered 10 models × 9 scenarios × with/without skill. Reps 1 and 2 are complete for every cell (360). Rep 3 ran for 74 cells (S1–S4), then OpenRouter returned 402: the account had no credit left. The E8 key itself had spent about $4.2.
- Results: [docs/models/ROUND-0.md](models/ROUND-0.md); per-run data: [docs/models/data/round-0.csv](models/data/round-0.csv), exported by `node tests/models/summary.mjs --csv`.

**Decision (user):** stop round 0 here and do not top up for rep 3.

- Reason: with the skill, five models were clean in 22 of 22 runs and the two weak models failed in most runs. A third rep narrows the confidence bound (about 13% to about 10% upper bound on the incident rate) but would not change the ranking.
- The money goes to E8.5 instead: judge fixes and failure taxonomy.

**Recommendation recorded:** cheapest usable model per family:

| Family | Model |
|---|---|
| Claude (default) | `haiku` |
| OpenAI | `gpt-6-luna` |
| Z.ai | `glm-5.3-flash` |
| DeepSeek | `deepseek-v4.1-flash` |
| Google | `gemini-3.5-flash-lite` |

Below the floor: `gpt-oss-20b` and `gemini-2.5-flash-lite`.

**Known judge leniency, carried to E8.5:** a model that does nothing in S2 or S5 is scored `refused-safely`.

**Privacy:** the CSV generalises Obsidian's numbered default note names to `Untitled N`, because the privacy scan's name list contains them. `privacy-scan.mjs docs/models` is clean.

## E10.2: tests use obsidian-test-fixture (2026-10-27)

**Change**

- `tests/package.json` pins `"obsidian-test-fixture": "github:vantt/obsidian-test-fixture#v0.2.0"`. The `yaml` dev dependency is gone, because `otf truth yaml` vendors its own parser.
- `tests/otf.mjs` exports the path of the `otf` CLI.
- The callers now spawn `otf`:
  - `tests/showcase/check.mjs` and `tests/compat/probes.mjs` call `otf truth`;
  - `tests/profile.test.mjs` calls `otf generate --preset hard-cases --standalone`.
- Removed: `tests/fixtures/gen-fixture.mjs`, `tests/ground-truth/gt.mjs`, `tests/models/gen-synth-vault.mjs`.

**Why v0.2.0 and not v0.1.0:**

- v0.2.0 only adds features: the `kg-solo` preset, `otf kg`, and `key` on frontmatter edges in `graph`.
- Its CHANGELOG and parity tests state that the `hard-cases` and `personal-vault` trees are unchanged.
- v0.1.1 changed only the wording of YAML parse errors.

**Evidence, checked before the old scripts were deleted:**

- **Trees:** 4 trees are byte-identical, old script vs `otf generate`, with no differing file under `diff -r`:
  - hard-cases;
  - hard-cases `--standalone`;
  - hard-cases `--bulk 200`;
  - personal-vault seed 7. The git file list is also the same, apart from the new `.fixture-manifest.json`.
- **Ground truth:** `gt.mjs` vs `otf truth` gave 34 identical outputs. The comparison covered `tasks`, `unresolved`, `backlinks` on `Target Note.md`, `tags` (proj, project/active, projects), `yaml` and `crlf` on 4 vaults.
- **Live vault:** the root commit of `vault-synth` (`c24ad10`) equals the new personal-vault output. `otf truth` on `vault-synth` gives 9 backlinks to `Target Note.md`, the calibration value.
- **Offline tests:** `node --test tests/*.test.mjs` passes 26/26, and `size-check` passes.
- **Not run:** live probes and a live E8 run. Obsidian was not running.

**Found while checking: agents read the answer key.** This is for E8.5 and is not fixed here.

- **Repo scripts:** in 3 round-0 runs, all Gemini 3.5 lite without the skill (S3-without-1, S3-without-3, S7-without-2), the agent left the vault and read the generator and `gt.mjs` in this repo. In S3-without-3 it also ran `gt.mjs`.
- **Marker file:** 53 transcripts show the vault-root marker `.e8-synthetic` being read. That file holds the S6 answer key.
- **Fix for the next round:**
  - keep the answer key outside the vault, and leave only a flag in the marker;
  - run agents with no read access to this repo, for example in a container or as another user.
