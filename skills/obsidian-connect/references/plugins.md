# Plugins: Tasks, Dataview, Templater

Measured on CLI 1.15.0 (`docs/FINDINGS.md` F12, F13, F14). Syntax lines marked "documented" come from the plugins' own docs, not from our probes.

## Tasks plugin

What the CLI does (F12):
- `tasks format=json` returns only `status`, `text`, `file`, `line`. `text` is the whole line, emoji untouched. No due, start, scheduled or priority field, and no filter for them. For "what is due this week", read `text` and parse the dates yourself.
- `status` is the raw character: ` ` open, `x` done, `/` in progress, `-` cancelled, `>` deferred. `status="/"` filters on it.
- **Every non-space status counts as done** in `todo` and `done` (2 `[ ]` plus `[/]`, `[-]`, `[x]` gave `todo total` 2, `done total` 3). So `todo`, and `obs --tasks-count`, leave in-progress and cancelled tasks out of the open count. For open work pass `status= ` (one space; the literal `status=" "` returns 0), or count the `[ ]` lines yourself.
- `line` is a string and 1-based.

Writing a new task (documented Tasks syntax), one line:

```
- [ ] Pay rent 🔁 every month ⏫ 🛫 2026-11-01 ⏳ 2026-11-02 📅 2026-11-05
```

- Emoji: `📅` due, `⏳` scheduled, `🛫` start, `➕` created, `✅` done date, `🔁` recurrence. Dates are `YYYY-MM-DD`.
- Priority: `🔺` highest, `⏫` high, `🔼` medium, `🔽` low, `⏬` lowest.
- Mark done with `[x]` and add `✅ <date>`. A recurring task needs the Tasks plugin to roll over; do not copy the line yourself.
- Keep the fields after the description and put them on the same line as the checkbox. Write with `--append` or `--section-edit`, then read the line back.

## Dataview

You can write queries into notes. You cannot read their results (F14).
- `read` returns the fenced source, never the rendered rows. `search` cannot find computed text. `eval`, `dev:dom` and `command` are refused or only refresh views, on purpose. Do not try to get around it.
- So never say "the query returns N rows" or "the table shows X". Say that you wrote the query and that Obsidian renders it.
- To answer the same question now, use `search`, `tags`, `properties`, `tasks`, or `base:query` for a Base.

Query basics (documented):
- A block is fenced with `dataview`: first line `LIST`, `TABLE a, b`, `TASK` or `CALENDAR date`, then `FROM`, `WHERE`, `SORT`, `LIMIT`.
- `FROM "folder"`, `FROM #tag`, `FROM [[Note]]` (notes that link to it); combine with `AND`, `OR`, `-`.
- Fields are front matter keys (`status`, `due`) plus built-ins (`file.name`, `file.mtime`, `file.tags`, `file.link`). Names with spaces or dashes: `row["my key"]`.
- Example:

````
```dataview
TABLE status, due
FROM "Projects" AND #active
WHERE due AND due <= date(today) + dur(7 days)
SORT due ASC
LIMIT 20
```
````

- `dataviewjs` blocks run JavaScript in the app; write them only when asked.
- Query text containing a block fence needs a longer outer fence (four backticks).

## Templater

`create template=` runs only the core Templates plugin (F13). The CLI has no Templater command.
- `<% %>` tags stay literal in the new note unless Templater's "Trigger Templater on new file creation" is on. Render them yourself, or ask the user to turn it on.
- With the trigger on, Templater runs on **every** new note, including plain `content=`: `create content="Z=<% 2+2 %>"` gave `Z=4`. Never write untrusted text (clipped pages, user pasted content) that contains `<% %>`.
- Do not offer `template=` for a Templater template. Wording for the user: "this template uses Templater tags; the CLI will not fill them".
- Flipping the setting file is not enough; the plugin must re-register its handler (the settings toggle does it). Check the result by reading the new note.
