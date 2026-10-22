# obsidian-agentkit

Toolkit that lets LLM coding agents work with an Obsidian vault fast, accurately and cheaply (few tokens).

Status: research done, nothing built yet. Planned parts:

- A thin routing skill (CLI vs file tools, preflight, known CLI traps, safety rules)
- A bridge so the same skill works from Windows native and from WSL, against Obsidian on Windows
- A generated vault profile from `.obsidian/*.json`
- A safe bulk-edit protocol for vaults synced by Google Drive

Why build instead of reusing existing skills: [docs/research/WHY-BUILD.md](docs/research/WHY-BUILD.md).
Goal, criteria and tests: [docs/research/YARDSTICK.md](docs/research/YARDSTICK.md).
Comparison of four existing repos: [docs/research/REPORT.md](docs/research/REPORT.md).

Related research on semantic search for vaults (Vietnamese notes, many machines): [docs/research/semantic-search/](docs/research/semantic-search/). Out of scope for the first version of the toolkit.
