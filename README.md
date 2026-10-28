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
1. Copy or symlink `skills/obsidian-connect/` into your agent's skills folder (for Claude Code: `~/.claude/skills/obsidian-connect/`).
2. Requirements: Node 18 or later, and Obsidian 1.12 or later with the CLI enabled (Settings > General > Command line interface), running on Windows.
3. Per session, set `OBS_VAULT=<vault name>`. The skill's first step is `node <skill>/scripts/obs.mjs --preflight`.

Without Obsidian running, the skill falls back to file tools and labels its answers as approximate.

## Install as a plugin
This repo is also a Claude Code plugin marketplace (`.claude-plugin/marketplace.json`) with one plugin, `obsidian-agentkit`, which exposes the `obsidian-connect` skill:

```
/plugin marketplace add vantt/obsidian-agentkit
/plugin install obsidian-agentkit@obsidian-agentkit
```

Shell form: `claude plugin marketplace add vantt/obsidian-agentkit` then `claude plugin install obsidian-agentkit@obsidian-agentkit`.

Status: both manifests pass `claude plugin validate`, and install from a local clone was verified. Install from the GitHub repo is verified only after the manifests are pushed. Script paths inside `SKILL.md` still assume the manual install above (tracked as E4.2).

## Which model
The skill makes cheap models safe: with it, Haiku ran 27/27 scenarios clean at about $0.002 per task, the same result as Sonnet at a tenth of the cost. Without it, every model tested caused incidents, Sonnet included. **Default: Haiku.** Outside Claude: `glm-5.3-flash` or `gpt-6-luna`. Models below a minimum tier (for example `gpt-oss-20b`, `gemini-2.5-flash-lite`) fail even with the skill. Report and per-family table: [docs/models/REPORT.md](docs/models/REPORT.md); test kit: [tests/models/README.md](tests/models/README.md).

## Docs
- [docs/BACKLOG.md](docs/BACKLOG.md): program board (work items, status, progress), linking to the plans in `docs/plans/`
- [docs/FINDINGS.md](docs/FINDINGS.md): measured CLI behaviour
- [docs/SPEC.md](docs/SPEC.md): design
- [docs/GATES.md](docs/GATES.md): decisions taken at each gate
- [docs/research/](docs/research/): the original research (why build, yardstick, comparison of four repos)
