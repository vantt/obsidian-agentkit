# Compatibility probes: re-test the skill on a new Obsidian CLI

The skill's trap list and guards are true for the CLI version in `SKILL.md` `metadata.tested-cli`. When `obs --preflight` prints `match=no`, or before a release, run this suite and compare.

## What it measures
`probes.mjs` holds 32 probes. Each one re-checks a single behaviour the skill relies on, and is tied to a finding in `docs/FINDINGS.md`. A probe **passes** when the CLI still behaves as recorded. A failure means the CLI changed, so the related skill text or guard may now be wrong or unnecessary. A failure is not always bad news: a fixed trap also shows up as a failure.

| Kind | Probes |
|---|---|
| Error and empty detection | P02 P04 P05 P27 |
| Scope and targeting | P03 P06 P07 |
| Output shape and size | P08–P12 P25 |
| Link integrity | P13–P17 |
| Data safety | P18 P19 |
| Metadata and conventions | P22–P24 |
| Plugin data and syntax (Tasks, Templater, Dataview) | P30 P31 P32 |
| Other writes, UI and the bridge | P20 P21 P26 P28 P29 |

## Scoring
- Weight = damage tier from `docs/research/YARDSTICK.md`: data loss 5, link graph 4, silent wrong answer 3, metadata 3, tokens 2, environment or UI 1.
- **Score = passed weight ÷ weight of the probes that ran**, as a %. The run also records passed/ran counts.
- Each run writes `history/<UTC time>_<cli>_<env>.json` (every probe: id, finding, weight, pass, observed) and rebuilds `HISTORY.md` from all JSON files. Each row lists **which probes flipped since the last run that ran them**; partial (`--only`, `--no-write`) runs are labelled.
- `node tests/compat/probes.mjs --compare` prints the flips between the last two runs, with the observed output.

## Setup (once)
1. Make a **copy** of a vault (never the real one), open it in Obsidian as its own vault, then `git init` and commit. Git in the copy should track only text: `*.md`, `*.canvas`, `*.base`, `.obsidian/*.json`.
2. Generate the fixture inside it and commit: `node tests/node_modules/.bin/otf generate --preset hard-cases --out <copy>/_agentkit-lab && git -C <copy> add -A && git -C <copy> commit -m fixture`.
3. In the copy, keep Settings > Files and links > "Automatically update internal links" **on**. The probes switch it off and back on themselves.

## Run
```
cd tests && npm ci                 # obsidian-test-fixture: fixture generator and ground truth
node tests/compat/probes.mjs --vault <copy name> --dir <copy local path> --env-label wsl
```
- `--no-write`: run only the read-only probes (safe and fast, about 1 min).
- `--only P14,P15`: run selected probes.
- A full run takes about 6–7 min, mostly waiting for the index after each reset.

Safety built in:
- It refuses unless the CLI's vault path equals `--dir`, and `--dir` is a git repo.
- It resets with `git checkout` and `git clean` on `_agentkit-lab/` after every write probe.
- P18 sends one fixture file (`ref-block.md`) to the OS Recycle Bin, then deletes its own new entry (exact name and original folder match, new since before the delete; Windows and WSL via PowerShell). Other Recycle Bin entries are never touched. The `observed` text shows `bin before/added/after` counts; without PowerShell it shows `bin=n/a` and the entry stays.
- **Do not click inside the test vault window while probes run**: P15 opens a modal and answers it itself.

## When a probe flips
1. Re-run that probe alone (`--only`) to rule out index lag. Read `TROUBLESHOOTING.md` first.
2. Confirm by hand with the raw CLI and note the new behaviour in `docs/FINDINGS.md`, as a new dated entry under the same `F#`.
3. Update `skills/obsidian-connect/references/traps.md`, the SKILL.md trap lines, and the bridge guard if one depends on it (for example P15 → `--rename` guard, P18 → `--trash`, P19 → `--create`).
4. Update the expected result in `probes.mjs` so the new behaviour passes. Bump `metadata.tested-cli` / `tested-on` in SKILL.md and `TESTED_CLI` in `scripts/obs.mjs`.
5. Run the full suite again; the row in `HISTORY.md` is the record.
6. Re-run the scenario tests (`tests/scenarios/README.md`) and append their rows to `tests/RESULTS.md`.

## Not covered by probes (manual)
- Obsidian closed (bridge exit 2): close the app, then run `obs --preflight`.
- Git Bash `.exe` exit 127.
- Admin terminal.
- Google Drive Recycle Bin.

Record these in `docs/FINDINGS.md` when you check them.
