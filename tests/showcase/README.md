# Showcase runs: with and without the skill (E7)

Each scenario is run twice on the vault copy, with the same request. One fresh agent has no skill: it knows only the vault name and that the CLI is `obsidian`. The other fresh agent has the `obsidian-connect` skill. Plan: `docs/plans/E7-showcase.md`. Published material: `docs/showcase/`.

## Files
| File | Role |
|---|---|
| `obsidian` | The raw CLI exactly as installed, plus a call log (args, exit, bytes, ms). `install.sh` puts it on PATH and points the bridge at it, so both sides are measured the same way |
| `install.sh [--uninstall]` | Install or remove the wrapper and the bridge cache entry |
| `prompt.mjs <S> <without\|with>` | Prints the exact prompt for one run |
| `setup.sh <S> <side> [--keep]` | Resets the copy, sets the scenario pre-state (S2: `alwaysUpdateLinks` off; S7: CLI behaves as "Obsidian not running"), records `baseline.json` |
| `check.mjs <S> <side>` | Judges the vault after the run from files and git: changes, broken links, `name 1.md`, `types.json`, Recycle Bin, `.trash/`, empty notes, scenario ground truth. Then restores the pre-state |
| `transcript.mjs` | Reads the subagent transcript: tool calls, tool output bytes, API token usage, wall time, the final answer |
| `names.mjs`, `redact.mjs` | Build the list of real note names and mask them, plus user name, home path and email, before anything goes to `docs/` |
| `shot.mjs <png> <selector>` | Screenshot one element of the Obsidian window (never the whole window: the file tree shows real names) |
| `finish.sh <S> <side> <agentId>` | `check` + `transcript`; raw copy to `tests/out/showcase/` (gitignored), redacted copy to `docs/showcase/scenarios/<S>/<side>/` |
| `verdicts.json` | Hand-written judgement per run (result, incidents, notes), from the evidence above |
| `report.mjs` | Rebuilds metrics from raw transcripts, re-redacts, writes `docs/showcase/data/`, SVG charts and `scenarios/*/README.md` |
| `png.sh <w> <h> <in> <out.png>` | Renders SVG/HTML to PNG with headless Chrome on Windows |
| `diff-html.mjs` | Unified diff to an HTML page (then `png.sh`) |
| `ui-shots.sh` | Obsidian screenshots of fixture notes (broken links, rename modal, `name 1.md`, properties) |
| `demo-env.sh`, `demo-reset.sh` | Hidden setup for the vhs tapes in `docs/showcase/assets/terminal/` |
| `privacy-scan.mjs` | E7.8: fails on any real note name, user name, home path, email or foreign Windows path |

## Re-run one scenario
```
tests/showcase/install.sh
node tests/showcase/names.mjs > tests/out/showcase/real-names.json
tests/showcase/setup.sh S4 without
node tests/showcase/prompt.mjs S4 without    # give this to a fresh general-purpose subagent
tests/showcase/finish.sh S4 without <agentId>
```
For S8 there are two sessions per side.
1. Run session 1 as above and finish it as side `without`.
2. Run `setup.sh S8 without2 --keep`, which does not reset the copy, then session 2 with the same prompt (`prompt.mjs S8 without`), then `finish.sh S8 without2 <agentId>`.

## After the runs
`tests/showcase/install.sh --uninstall` removes the `obsidian` wrapper from PATH and the bridge cache entry (the bridge finds the real CLI again on its next call).

## Measures
- **Tool calls, wall time:** from the transcript.
- **Context tokens:** API usage in the transcript.
  - `contextLast − contextFirst` is what the task added to the agent's context: tool output, skill load and the agent's own text.
  - `inputTokensTotal` sums the input of every model call, a proxy for cost.
- **Task output:** tool-result bytes minus the skill's own files (SKILL.md, references).
- **CLI bytes:** what the CLI printed, before any `head`/`grep` the agent piped it through.
