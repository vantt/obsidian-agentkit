# obsidian-agentkit

Toolkit that lets LLM coding agents work with an Obsidian vault fast, accurately and cheaply (few tokens).

**Status: v1 built and tested on Obsidian CLI 1.14.4** (2026-10-22). Scenario results: [tests/RESULTS.md](tests/RESULTS.md). Probe score history: [tests/compat/HISTORY.md](tests/compat/HISTORY.md).

## What is in it
- [`skills/obsidian-connect/`](skills/obsidian-connect/SKILL.md): an Agent Skill. It holds a routing table (CLI or file tools), safety thresholds, and the CLI traps measured on 1.14.4, with four references that load on demand.
- `scripts/obs.mjs`: a Node bridge that works the same from WSL, PowerShell, cmd and Git Bash.
  - The vault is always targeted first.
  - Error and empty results get real exit codes.
  - `--preflight` runs in one call.
  - Guarded `--rename`/`--move` check links before and after; `--trash` and `--create` are guarded too.
- `scripts/profile.mjs`: a vault profile of about 25 lines, built from `.obsidian/*.json` (link style, folders, daily notes, templates, property types).
- `tests/`: bridge and profile unit tests (`node --test tests/*.test.mjs`), a size budget check, the synthetic fixture, file-only ground truth, scenario cases, and a scored [compatibility probe suite](tests/compat/README.md) for re-testing new CLI versions.

## Install
1. Copy or symlink `skills/obsidian-connect/` into your agent's skills folder (for Claude Code: `~/.claude/skills/obsidian-connect/`).
2. Requirements: Node 18 or later, and Obsidian 1.12 or later with the CLI enabled (Settings > General > Command line interface), running on Windows.
3. Per session, set `OBS_VAULT=<vault name>`. The skill's first step is `node <skill>/scripts/obs.mjs --preflight`.

Without Obsidian running, the skill falls back to file tools and labels its answers as approximate.

## Docs
- [docs/FINDINGS.md](docs/FINDINGS.md): measured CLI behaviour
- [docs/SPEC.md](docs/SPEC.md): design
- [docs/GATES.md](docs/GATES.md): decisions taken at each gate
- [docs/research/](docs/research/): the original research (why build, yardstick, comparison of four repos)
