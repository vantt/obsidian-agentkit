# obsidian-agentkit

[![CI](https://github.com/vantt/obsidian-agentkit/actions/workflows/ci.yml/badge.svg)](https://github.com/vantt/obsidian-agentkit/actions/workflows/ci.yml)

Toolkit that lets LLM coding agents work with an Obsidian vault fast, accurately and cheaply (few tokens).

**Status: built and tested on Obsidian CLI 1.14.4 (2026-10-22); all 32 compatibility probes pass on 1.15.0 (2026-10-28).** Scenario results: [tests/RESULTS.md](tests/RESULTS.md). Probe score history: [tests/compat/HISTORY.md](tests/compat/HISTORY.md). Re-check monthly: [tests/compat/README.md#monthly-check](tests/compat/README.md#monthly-check).

## What is in it
- [`skills/obsidian-connect/`](skills/obsidian-connect/SKILL.md): an Agent Skill. It holds a routing table (CLI or file tools), safety thresholds, and the CLI traps measured on 1.14.4, with four references that load on demand.
- `scripts/obs.mjs`: a Node bridge that works the same from WSL, PowerShell, cmd and Git Bash.
  - The vault is always targeted first.
  - Error and empty results get real exit codes.
  - `--preflight` runs in one call.
  - Guarded `--rename`/`--move` check links before and after; `--trash` and `--create` are guarded too.
- `scripts/profile.mjs`: a vault profile of about 25 lines, built from `.obsidian/*.json` (link style, folders, daily notes, templates, property types).
- `tests/`: bridge and profile unit tests (`node --test tests/*.test.mjs`), a size budget check, the synthetic fixture and file-only ground truth (from [`obsidian-test-fixture`](https://github.com/vantt/obsidian-test-fixture); `cd tests && npm ci`), scenario cases, and a scored [compatibility probe suite](tests/compat/README.md) for re-testing new CLI versions.

## Install
Quickest: `node install.mjs` checks Node, the Obsidian CLI and the skill link (dry run; add `--link` to create the link) and prints your first command. The manual steps follow.

Needs Node 18 or later, and Obsidian 1.12 or later with the CLI enabled (Settings > General > Command line interface; this menu path is from the earlier README, not re-checked). Obsidian runs on Windows and must be open. The skill is `skills/obsidian-connect/`; `<repo>` below is your clone of this repo. Prefer the plugin? See [Install as a plugin](#install-as-a-plugin).

### WSL, Linux or macOS-style shell
```sh
mkdir -p ~/.claude/skills
ln -s <repo>/skills/obsidian-connect ~/.claude/skills/obsidian-connect
export OBS_VAULT="<vault name>"
node ~/.claude/skills/obsidian-connect/scripts/obs.mjs --preflight --vault "<vault name>"
```
Tested path: WSL2 calling the Windows Obsidian through interop. The bridge finds `Obsidian.com` itself.

### Windows (PowerShell)
```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills" | Out-Null
New-Item -ItemType Junction -Path "$env:USERPROFILE\.claude\skills\obsidian-connect" -Target "<repo>\skills\obsidian-connect"
$env:OBS_VAULT = "<vault name>"
node "$env:USERPROFILE\.claude\skills\obsidian-connect\scripts\obs.mjs" --preflight --vault "<vault name>"
```
- A junction needs no admin rights. A symlink (`-ItemType SymbolicLink`) needs an admin shell or Windows Developer Mode. To copy instead: `Copy-Item -Recurse <repo>\skills\obsidian-connect "$env:USERPROFILE\.claude\skills\"` (copy again after each update).
- To keep `OBS_VAULT` across sessions: `setx OBS_VAULT "<vault name>"`, then open a new terminal. Or skip it: `--preflight --vault` makes the bridge remember the vault for 12 hours.
- Git Bash runs the same Windows `node`, so these steps apply there too (use `$USERPROFILE` and `/` paths).
- **Windows native path: tested once (2026-10-29, CLI 1.15.0).** A Claude Code agent run from PowerShell (headless `claude -p`) with the skill answered cases 1 and 4 the same as WSL: 9 backlinks, 114 open tasks, vault unchanged ([tests/RESULTS.md](tests/RESULTS.md) case 9, native rows). Not yet seen: an interactive session, and any admin terminal ([docs/FINDINGS.md](docs/FINDINGS.md) F1).

### What OK looks like
```
OK: vault "<vault name>" at C:\Users\<you>\...\<vault folder>
env=windows cli=<version> tested=<version> match=yes
alwaysUpdateLinks=true trashOption=... (obs --trash uses .trash/ anyway)
remembered: the next obs commands use this vault for 12 h; OBS_VAULT is optional now
```
`env=` is `wsl` or `windows`. `match=no` means the CLI is another minor version than the tested one; see [tests/compat/README.md](tests/compat/README.md). `APPROXIMATE: Obsidian is not running` means start Obsidian and run it again; meanwhile the skill falls back to file tools and labels its answers as approximate. Background: [docs/HOW-IT-WORKS.en.md](docs/HOW-IT-WORKS.en.md).

## Install as a plugin
This repo is also a Claude Code plugin marketplace (`.claude-plugin/marketplace.json`) with one plugin, `obsidian-agentkit`, which exposes the `obsidian-connect` skill:

```
/plugin marketplace add vantt/obsidian-agentkit
/plugin install obsidian-agentkit@obsidian-agentkit
```

Shell form: `claude plugin marketplace add vantt/obsidian-agentkit` then `claude plugin install obsidian-agentkit@obsidian-agentkit`.

Status: both manifests pass `claude plugin validate`, and install from a local clone was verified. Install from the GitHub repo is verified only after the manifests are pushed. Script paths in `SKILL.md` use `${CLAUDE_SKILL_DIR}`, which Claude Code fills in for symlink, project and plugin installs alike (E4.2).

## Which model
The skill makes cheap models safe: with it, Haiku ran 27/27 scenarios clean at about $0.002 per task, the same result as Sonnet at a tenth of the cost. Without it, every model tested caused incidents, Sonnet included. **Default: Haiku.** Outside Claude: `glm-5.3-flash` or `gpt-6-luna`. Models below a minimum tier (for example `gpt-oss-20b`, `gemini-2.5-flash-lite`) fail even with the skill. Report and per-family table: [docs/models/REPORT.md](docs/models/REPORT.md); test kit: [tests/models/README.md](tests/models/README.md).

## Docs
- [docs/BACKLOG.md](docs/BACKLOG.md): program board (work items, status, progress), linking to the plans in `docs/plans/`
- [docs/FINDINGS.md](docs/FINDINGS.md): measured CLI behaviour
- [docs/SPEC.md](docs/SPEC.md): design
- [docs/GATES.md](docs/GATES.md): decisions taken at each gate
- [docs/research/](docs/research/): the original research (why build, yardstick, comparison of four repos)
