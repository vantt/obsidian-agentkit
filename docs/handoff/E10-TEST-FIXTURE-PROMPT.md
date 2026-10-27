# Handoff: split the vault fixture generators into `vantt/obsidian-test-fixture`

You are a coding agent. Your job is to create a **new, standalone repo**, `vantt/obsidian-test-fixture`, from three scripts that today live inside `obsidian-agentkit` (`~/projects/obsidian-agentkit`, public GitHub repo `vantt/obsidian-agentkit`). Other projects, for example knowledge-graph tools and RAG over notes, should be able to generate realistic, deterministic Obsidian vaults with a machine-readable answer key. Write every file in English. **Reply to the user in Vietnamese.**

## 1. Mission

The new repo is done when:
- `npx github:vantt/obsidian-test-fixture#v0.1.0 generate --preset personal-vault --seed 7 --out <dir>` writes a vault **byte-identical** to what `obsidian-agentkit` produces today with the same seed;
- `truth <command> <vault>` answers the same questions as today's `gt.mjs`, with the same output;
- a new `graph` command exports the vault's link graph as JSON (§4.3), for knowledge-graph tests;
- it has tests, CI, a README, and the tag `v0.1.0`.

Do **not** change `obsidian-agentkit` in this task. Switching that repo to the new package is a separate item on its board (E10.2), done after its running experiment finishes.

## 2. Source to read first

All paths below are in `obsidian-agentkit`.

| File | What it is | Lines |
|---|---|---:|
| `tests/fixtures/gen-fixture.mjs` | Hard-case fixture, about 30 notes: nine link forms to one target, an alias, heading and block refs, an embed, a `%20` markdown link, a link in frontmatter, links inside code (must not count), an unresolved link, typed properties, `#proj` vs `#projects` vs code `#proj`, nested tasks and tasks in code, Vietnamese file names, a 3,000-line CRLF note. Flags: `--bulk N`, `--seed S`, `--standalone` (adds `.obsidian/` config). | 140 |
| `tests/models/gen-synth-vault.mjs` | Full synthetic vault, about 1,800 notes: daily notes at the root, people, projects, meetings, articles, recipes, travel, inbox. It includes S6 "Đà Nẵng" relevant, passing and decoy notes, `.obsidian/` config, the fixture under `_agentkit-lab/`, a git repo, and a `.e8-synthetic` marker holding the S6 answer key. Seeded PRNG (mulberry32). | 149 |
| `tests/ground-truth/gt.mjs` | File-only ground truth, no Obsidian: `tasks`, `backlinks`, `unresolved`, `tags`, `yaml`, `crlf`. Its link resolution and code-blanking rules are the reference. | 181 |
| `tests/profile.test.mjs` | Uses `gen-fixture.mjs --standalone` | — |
| `docs/FINDINGS.md` | How Obsidian really treats each link form, measured on CLI 1.14.4. It explains why the fixture has each case | — |

All three scripts use Node built-ins only. Keep it that way (zero runtime dependencies) unless you write a reason in `DECISIONS.md`.

## 3. Hard constraints

1. **Determinism is the product.**
   - Same preset, same seed, same version: byte-identical output, including line endings (the long note is CRLF) and file names (NFC).
   - Prove it in tests with a content hash over the generated tree.
   - Any change to generated output is a **breaking change**. It needs a new minor version and a CHANGELOG entry, because downstream answer keys depend on it.
2. **Parity with today.**
   - Before you refactor, record SHA-256 tree hashes of today's outputs:
     - `gen-fixture.mjs <dir>`;
     - `gen-fixture.mjs <dir> --standalone`;
     - `gen-fixture.mjs <dir> --bulk 200`;
     - `gen-synth-vault.mjs <dir> --seed 7`, excluding `.git/`.
   - The new presets must reproduce those hashes. Commit the hashes as test fixtures.
   - Also record today's `gt.mjs` output for each command on those vaults, and match it.
3. **No private data.** Every word stays generated. Do not copy anything from `obsidian-agentkit`'s `tests/out/`, `docs/showcase/` or real-vault notes. Run a scan for e-mail addresses, home paths and Windows user paths before each push.
4. **Neutral names.**
   - The `_agentkit-lab/` folder name and the `.e8-synthetic` marker are agentkit-specific. Make them options with today's values as defaults for the presets that need parity, for example `--lab-dir` and `--marker`.
   - The marker's JSON keeps today's shape, so agentkit's guard keeps working.
5. **Repo creation.**
   - Create the repo with `gh repo create vantt/obsidian-test-fixture`.
   - Visibility: **ask the user once, up front** (public like `obsidian-agentkit`, or private).
   - Ask once, too, which license to use. `obsidian-agentkit` has none yet.
   - Commit and push after each phase. End commit messages with the `Co-Authored-By` line your environment gives you.
6. **Work style** (user preference):
   - Ask all questions once, up front, then work to completion.
   - Record each decision in `DECISIONS.md`: problem, decision, reason.
   - Keep a `TROUBLESHOOTING.md` of what went wrong and how it was fixed.

## 4. What to build

### 4.1 Layout

```
obsidian-test-fixture/
  package.json            name "obsidian-test-fixture", type module, bin { otf }, exports for the library, engines node >= 20
  bin/otf.mjs             CLI: generate | truth | graph | presets | verify
  lib/prng.mjs            seeded PRNG (mulberry32, unchanged)
  lib/writer.mjs          write files, optional git init + commit (autocrlf false), marker
  lib/truth.mjs           today's gt.mjs as a library + CLI (same output)
  lib/graph.mjs           link graph export (4.3)
  presets/hard-cases.mjs     = gen-fixture.mjs (options: bulk, standalone, lab-dir)
  presets/personal-vault.mjs = gen-synth-vault.mjs (options: seed, lab-dir, marker, git)
  test/                   node --test: parity hashes, truth parity, graph on hard-cases, CLI smoke
  README.md  CHANGELOG.md  DECISIONS.md  TROUBLESHOOTING.md  LICENSE
  .github/workflows/ci.yml   node 20 and 22 on ubuntu and windows (CRLF and Vietnamese names must survive on both)
```

### 4.2 CLI

```
otf generate --preset hard-cases|personal-vault --out <dir> [--seed S] [--bulk N] [--standalone] [--git] [--lab-dir _agentkit-lab] [--marker .e8-synthetic]
otf truth <tasks|backlinks|unresolved|tags|yaml|crlf> <vault> [args]     # same as gt.mjs today
otf graph <vault> [--out graph.json]
otf verify <vault>                                                        # re-hash a generated vault against its manifest
otf presets                                                               # list presets and options
```

`generate` refuses a non-empty `--out`, as today. It writes a `fixture-manifest.json` (preset, options, version, tree hash) in a dot-file the vault does not index. `verify` uses that manifest.

### 4.3 Graph export (new; built on `truth`'s parser, never a second parser)

```json
{ "version": 1, "generator": {"preset": "...", "seed": 7, "otfVersion": "0.1.0"},
  "nodes": [{ "id": "path/Note.md", "title": "Note", "aliases": [], "tags": ["proj"], "folder": "path" }],
  "edges": [{ "from": "a.md", "to": "b.md", "kind": "wikilink|embed|heading|block|markdown|frontmatter",
              "target": "b#Section A", "line": 3, "resolved": true }],
  "excluded": [{ "from": "refs/ref-code-block.md", "raw": "[[Target Note]]", "reason": "code-block|inline-code" }],
  "unresolved": [{ "from": "...", "target": "Missing Note Zeta" }] }
```

Resolution rules are exactly today's `gt.mjs` rules. Where Obsidian differs, `docs/FINDINGS.md` in `obsidian-agentkit` is the reference; for example, `[[TN Alias]]` does not resolve through the alias. Document every rule in the README.

The test asserts the hard-cases graph by hand:
- 9 incoming edges to `Target Note.md`, one per link form;
- the code-block and inline-code links listed in `excluded`;
- 2 unresolved targets.

### 4.4 Later (v0.2, only after v0.1.0 is tagged; write it up as issues, do not build it now)

These knowledge-graph presets and options were requested but are out of scope for v0.1:
- `kg-scale` (10k–100k notes);
- degree distribution (hubs vs leaves), communities, orphans, cycles, long chains;
- name collisions across folders, an alias equal to another note's title, near-duplicate concepts (accented vs unaccented, as in "Đà Nẵng" vs "Da Nang");
- multi-hop question sets with answers derived from `graph.json`.

## 5. Phases

0. **Questions to the user, all at once:** visibility, license, and the npm package name (keep `obsidian-test-fixture`, or use a scope). Also ask whether to publish to the npm registry, or install from GitHub tags only. The default is GitHub tags only.
1. **Baseline:** in `obsidian-agentkit`, generate today's outputs into a temp dir and record the hashes and `gt.mjs` outputs. Read only; change nothing there.
2. **Port** into the new repo with parity tests. CI must be green on ubuntu and windows. Tag `v0.1.0-rc`.
3. **Graph export** plus its tests. Tag `v0.1.0`. Open the v0.2 issues from §4.4.
4. **README:** install (`npm i -D github:vantt/obsidian-test-fixture#v0.1.0`), CLI, library API, presets with a table of the hard cases, the determinism and versioning policy, and how to add a preset.

## 6. Done when

- [ ] Repo `vantt/obsidian-test-fixture` exists with the visibility and license the user chose. Tag `v0.1.0` is pushed.
- [ ] Parity: the tree hashes and `truth` outputs equal today's `obsidian-agentkit` outputs, checked in CI.
- [ ] `otf graph` on hard-cases passes the hand-checked assertions.
- [ ] CI is green on ubuntu and windows, node 20 and 22.
- [ ] README, CHANGELOG, DECISIONS, TROUBLESHOOTING written. The privacy scan is clean.
- [ ] `obsidian-agentkit` is unchanged.
