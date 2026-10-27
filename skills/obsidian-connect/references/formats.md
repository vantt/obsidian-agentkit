# Bases, JSON Canvas, web clipping

Adapted in our own words from kepano/obsidian-skills (MIT, commit 3ccff5338ea7: `obsidian-bases`, `json-canvas`, `defuddle`). Install those skills for full syntax tables.

## Bases (`.base`, YAML)
- **Query** through the index: `obs base:query path=<file.base> view="<view>" format=json | head -c 4000`. Other formats: `csv`, `tsv`, `md`, `paths`. `obs bases` lists every base, and it ignores `total`.
- **Author** by writing the YAML file directly. The top-level keys are:
  - `filters`: a string, or an object with exactly one of `and`/`or`/`not`, holding a list
  - `formulas`: `name: 'expression'`
  - `properties`: per-property `displayName`
  - `summaries`
  - `views`: a list of `{type: table|cards|list|map, name, limit, groupBy: {property, direction}, filters, order: [file.name, prop, formula.x]}`
- Filter expressions are quoted strings, for example `'status == "active"'` or `'file.hasTag("proj")'`. Quote any YAML value that contains `:`, `#`, `[` or quotes.
- Validate: the YAML parses, every `formula.X` used in `order` is defined, and the property names exist in the profile or the notes. Then run `obs base:query` once. An `Error:` means the base is invalid.
- `base:create` adds a note through a base view. Prefer `obs --create` with explicit properties unless the user asks for the base's defaults.

## JSON Canvas (`.canvas`, spec 1.0)
- The file is `{"nodes": [], "edges": []}`. Array order is z-order: the first node is drawn at the back.
- A node needs `id` (unique, a 16-char hex string is customary), `type` (`text`|`file`|`link`|`group`), and integer `x`, `y`, `width`, `height`.
  - Type-specific fields: `text` for text nodes, `file` for file nodes (a vault path, plus an optional `subpath` such as `#Heading`), `url` for link nodes, and optional `label` for groups.
  - Optional on any node: `color` (`"1"`–`"6"` or `#rrggbb`).
- An edge needs `id`, `fromNode` and `toNode`. Optional: `fromSide`/`toSide` (`top|right|bottom|left`), `label`, `color`.
- Write it with the file tools. Afterwards, parse the JSON back and check that the IDs are unique and every edge endpoint exists. Leave 50–100 px between nodes.

## Web clipping
1. Fetch clean Markdown. If the `defuddle` CLI is installed (`defuddle parse <url> --md`), use it: it strips navigation and ads and costs fewer tokens. Otherwise use your web fetch tool and keep only the article body. Do not install it globally without asking.
2. Create the note with `obs --create path=<clip folder>/<Title>.md content='…'`. Frontmatter: `source: <url>`, `clipped: <YYYY-MM-DD>`, `author`/`title` when known, and `tags` following the profile. Plain text values only. Add list values afterwards with `obs --prop-set path=<p> name=tags add=<tag>`.
3. Keep quotes attributed, and link back to the source. Read the note back once.
