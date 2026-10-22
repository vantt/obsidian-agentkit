# Troubleshooting log for probes and measurements

Problems met while measuring the Obsidian CLI, with the fix that worked. Read this before re-running `tests/compat/` on a new CLI version. Add an entry whenever something costs you more than one retry.

Format: **Symptom** / Cause / Fix / First seen (CLI version, date).

## Environment

- **`obsidian: command not found` in WSL.** Cause: the Windows install dir is not on the WSL PATH. Fix: call `Obsidian.com` by full path under `/mnt/c/Users/<user>/AppData/Local/Programs/Obsidian/` (find it with `cmd.exe /c where obsidian`). Run from a Windows-mounted cwd (`cd /mnt/c`), otherwise interop warns about the UNC cwd. First seen 1.14.4, 2026-10-22.
- **Git Bash: colon commands exit 127, plain commands print a leading blank line.** Cause: `obsidian` resolves to `Obsidian.exe` (GUI subsystem), not `Obsidian.com`. Fix: call `obsidian.com` explicitly. PowerShell and cmd resolve `.com` first and are fine. First seen 1.14.4.
- **A test hit the wrong vault.** Cause: without `vault=` the CLI targets the most recently focused vault. Fix: `vault=<copy>` is always the first argument; check with `vault info=path` before any write.

## Vault state

- **`Error: Command "vault" not found. Did you mean: daily?` (exit 0) right after `reload`.** Cause: the vault window is still loading; commands are not registered yet. Fix: after `reload`, poll `vault info=name` (max 10 tries, 1 s apart) until it prints the vault name. First seen 1.14.4.
- **Editing `.obsidian/app.json` on disk has no effect.** Cause: the app keeps config in memory. Fix: edit the file, then `reload`, then confirm with `eval code="app.vault.getConfig('<key>')"`. Only on the test copy.
- **`eval` (or another command) "not found" a few seconds after `vault info=name` already works.** Cause: commands register in stages after reload. Fix: poll the exact command you need, not just `vault`. Seen 1.14.4.
- **A rename "test" passed because someone clicked the Update-links modal.** Cause: with `alwaysUpdateLinks` off, rename/move opens a modal and the CLI blocks; a person at the screen may answer it. Fix: answer it from the probe with `eval` (`[...document.querySelectorAll('.modal button')].find(b=>b.textContent==='Do not update').click()`), and ask the user not to touch the test vault window during probes. Check `dev:dom selector=".modal" text` when a call times out.
- **`.obsidian/plugins/*/data.json` shows up in `git status` after a test.** Cause: plugins (for example colored-tags) save state when tags change. Fix: ignore those paths when judging a diff; commit them as baseline noise between runs.
- **CLI `delete` does not create `.trash/` even with `trashOption: local`.** It goes to the Windows Recycle Bin. Check with PowerShell: `(New-Object -ComObject Shell.Application).NameSpace(10).Items() | ? Name -like '<file>*'`.

## Output size

- **A search probe printed 410 KB.** Cause: unquoted multi-word query (`query=Section A`) matches each word, and `search:context` repeats a line per matching term. Fix: quote phrases (`query='"Section A"'`), always pass `path=` and `limit=`, and pipe probe output through `head -c` while exploring.
- **`total` returned a full list.** `search:context` and `bases` ignore `total`. Count with `search … total` instead.

## Shell quoting

- **Paths with spaces broke when looping over command strings.** Fix: keep each probe as a separate argv array (bash function with `"$@"`), never build commands by string splitting.
- **WSL `grep -r` over `/mnt/c` takes 5-8 s for 1,800 notes.** Not a bug; use the CLI for vault-wide search from WSL and keep grep for small folders.

## State

- **Reset between runs.** `git checkout -q . && git clean -fdq` in the copy, then wait about 2 s so the metadata cache re-indexes before the next query.
