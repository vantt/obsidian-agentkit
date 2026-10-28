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

## When Obsidian updates: checklist
Precedent: the CLI went 1.14.4 → 1.15.0 on 2026-10-27/28. What was done then is in `docs/GATES.md` (section "E8.6 close" and the E8 round-1 notes). Follow the steps in order and tick each one.

1. **Detect.** Run `obs --preflight --vault "<copy name>"` (the bridge is `skills/obsidian-connect/scripts/obs.mjs`). It prints `cli=<new> tested=<old> match=yes|no`. `match` compares major.minor only, so a patch update (for example 1.15.0 → 1.15.3) still says `yes`: whenever `cli=` differs from `tested=`, run the checklist anyway. A probe run also prints `CLI x differs from tested y` at the end.
2. **Prepare.** Use the vault copy from "Setup" above (never the real vault), clean in git, Obsidian open on it, "Automatically update internal links" on. Run `cd tests && npm ci` once.
3. **Run all probes**, read-only and write: `node tests/compat/probes.mjs --vault <copy name> --dir <copy local path> --env-label wsl`. About 6-7 min; do not click in the vault window. A partial run (`--no-write`, about 1 min) is only a quick first look and does not close the update.
4. **Compare.** `node tests/compat/probes.mjs --compare` prints the flips between the last two runs with the observed output. Also read the new row in `HISTORY.md` (columns "Changed" and "Failed probes"). Expected: "Changed: none", score 100%.
5. **If a probe flipped:** re-run it alone (`--only P##`) to rule out index lag, then follow "When a probe flips" above. Check by hand whether it is a CLI change or a difference in the vault: P29 failed on 1.15.0 only because that vault had a Daily notes template.
6. **Update the version** (when the verdict is "nothing the skill relies on changed", or after step 5 is done):
   - `TESTED_CLI` in `skills/obsidian-connect/scripts/obs.mjs`;
   - `metadata.tested-cli` and `tested-on` in `skills/obsidian-connect/SKILL.md`, and the traps line there;
   - the version in the header of `skills/obsidian-connect/references/traps.md`;
   - docs that state the CLI version or the probe count: the status line in the root `README.md`, `docs/SPEC.md` (line 3 and the "Version pin" bullet), the `docs/BACKLOG.md` header, `docs/HOW-IT-WORKS.md` (the `metadata.tested-cli` note and the `probes.mjs` row), and the probe count at the top of this file. Find them with `grep -rn "<old version>" README.md docs skills` and `grep -rn "probes" README.md docs`. Leave dated history entries (GATES.md, FINDINGS.md) as they are.
7. **Offline gates** (no Obsidian needed): `node --test tests/*.test.mjs`, `node tests/size-check.mjs`, and the privacy scan the maintainer runs before a push.
8. **Re-run `obs --preflight`.** It must print `match=yes` and the new version.
9. **Model smoke check (optional; Claude subscription only, no paid API).** On the synthetic vault set up as in `tests/models/README.md`: `node tests/models/run.mjs calibrate` (expect the same backlinks and unresolved counts as the recorded baseline), then `node tests/models/run.mjs one haiku S1 with 1 --round 99` (expect a pass). Skip it when only the patch number changed and every probe passed.
10. **Record.**
    - `docs/GATES.md`: a new dated section "CLI <old> → <new> (<date>)" with the probes run and score, any flip and its by-hand check, the verdict, the files changed in step 6, and the optional smoke result.
    - `tests/compat/HISTORY.md`: written by the probe run itself; commit the new `history/*.json` and the rebuilt file.
    - Root `README.md` status line: the new version and date.
    - If behaviour changed: a dated entry in `docs/FINDINGS.md` under the same `F#`.

## Monthly check
Obsidian updates itself, so once a month run the read-only probes on the vault copy from "Setup" (Obsidian open on it, nothing clicked in its window):
```
node tests/compat/probes.mjs --vault <copy name> --dir <copy local path> --env-label wsl --no-write
```
- Takes about 1 min and changes nothing in the vault. It writes a partial row to `HISTORY.md` and a `history/*.json` file (labelled `--no-write`); commit them only if you want the record.
- **Look at:** the final score line (expect all read-only probes passed), any `CLI x differs from tested y` line, and `node tests/compat/probes.mjs --compare` for flips against the previous run.
- **Escalate to the full checklist** ("When Obsidian updates: checklist") when a probe fails or flips, or when the CLI version differs from `metadata.tested-cli`, even by a patch number. A clean monthly run needs no other action.
- This is a reminder note, not an installed schedule. Nothing in this repo runs it for you.

Examples only. Adapt the placeholders and install them yourself if you want the reminder automated; none of this is set up by the repo:
- **crontab (Linux/WSL, 09:00 on the 1st):** `0 9 1 * * cd <repo path> && node tests/compat/probes.mjs --vault "<copy name>" --dir <copy local path> --env-label wsl --no-write >> <log path> 2>&1`. It needs the desktop Obsidian running and the vault open, so a headless cron job often fails; a calendar reminder is the safer choice.
- **Windows Task Scheduler:** create a monthly task whose action runs `node` with the same arguments, "Start in" set to the repo folder, and "Run only when user is logged on" (the Obsidian CLI needs the app).
- **Claude Code `/schedule`:** can create a recurring routine that runs the command above. A cloud routine cannot reach your local Obsidian, so use it only as a reminder to run the command yourself.

## Not covered by probes (manual)
- Obsidian closed (bridge exit 2): close the app, then run `obs --preflight`.
- Git Bash `.exe` exit 127.
- Admin terminal.
- Google Drive Recycle Bin.

Record these in `docs/FINDINGS.md` when you check them.
