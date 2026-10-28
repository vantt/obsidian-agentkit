# Case 9: native Windows run (E2.1b checklist, about 20 minutes)

Goal: run cases 1 and 4 with Claude Code in **PowerShell on Windows** (no WSL) and show the answers equal the WSL ones. Both cases are **read-only**: nothing in the vault is written, so no reset is needed afterwards.

## Safety (read first)
- Use **only the test vault** (a copy with the `_agentkit-lab/` fixture, see `tests/compat/README.md` Setup). Never the real vault, not even to "just look".
- Every command and prompt below names the test vault. The bridge remembers the last `--preflight` vault for 12 h, so step 3 sets it before anything else.
- Do not click or answer any dialog in your Obsidian windows. If one appears, stop and note it.
- Do not paste any key or token anywhere. Nothing here needs one.

Placeholders: `<repo>` = your clone of this repo; `<test vault name>` = the name Obsidian shows for the test vault (the standard one is `vault-copy`); `<test vault folder>` = its folder on disk.

## 1. Check the test vault
1. Obsidian is running with the test vault open (as its own vault).
2. In PowerShell, in `<test vault folder>`: `git status --short` must print nothing (if it does, stop and ask).
3. Note `git rev-parse HEAD`; you compare it at the end.

## 2. Install the skill (junction, no admin needed)
```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills" | Out-Null
New-Item -ItemType Junction -Path "$env:USERPROFILE\.claude\skills\obsidian-connect" -Target "<repo>\skills\obsidian-connect"
```
If the junction already exists, skip it. Or run `node <repo>\install.mjs` (dry run, checks Node, the CLI and the link), then `node <repo>\install.mjs --link` to create the link. Background: README "Install", "Windows (PowerShell)".

## 3. Preflight on the test vault
```powershell
$env:OBS_VAULT = "<test vault name>"
node "$env:USERPROFILE\.claude\skills\obsidian-connect\scripts\obs.mjs" --preflight --vault "<test vault name>"
```
Expect `OK: vault "<test vault name>" at C:\...`, then `env=windows cli=<version> tested=<version> match=yes|no`. Check that the path is the **test** vault folder. Write down the CLI version. If `match=no`, carry on; just record the version.

## 4. Run the two prompts in Claude Code
In the same PowerShell window (so `OBS_VAULT` is set), start `claude` in any folder that is **not** the repo and not the vault, for example `cd $env:TEMP; claude`. Use a **new session for each case**. Paste exactly (replace `<test vault name>`):

**Case 1**
```
Use the obsidian-connect skill. The Obsidian vault is "<test vault name>"; use only that vault and do not change anything in it. List every note that links to `_agentkit-lab/Target Note.md`. Say if the list might be incomplete.
```
**Case 4**
```
Use the obsidian-connect skill. The Obsidian vault is "<test vault name>"; use only that vault and do not change anything in it. How many open tasks are there in the whole vault?
```
Allow the agent's `node ...obs.mjs` calls; refuse anything that writes to a vault. Write down: number of tool calls, and anything odd (errors, `APPROXIMATE`, a path starting `/mnt`).

## 5. What a correct answer looks like
Valid for the standard fixture copy (`vault-copy`). These are the answers the WSL runs gave and the file-based truth gives (`otf truth`, checked on 2026-10-28).

**Case 1: 9 notes**, all under `_agentkit-lab/`:
`other folder/ref-other-folder.md`, `props/Property Note.md`, `refs/deeper/ref-markdown.md`, `refs/ref-alias-display.md`, `refs/ref-block.md`, `refs/ref-embed.md`, `refs/ref-heading.md`, `refs/ref-wikilink.md`, `tiếng việt/Ghi chú tiếng Việt.md`.
- Must **not** list `refs/ref-code-block.md` (the link is inside a code block) or `refs/ref-unresolved.md`.
- `refs/ref-alias-name.md` may be absent or flagged as unresolved.
- The answer must say the list might be incomplete (alias-name links, canvas files).
- Order and wording may differ. The set must be equal.

**Case 4: 114 open tasks** (`[ ]` only; not `[x]`, not `[-]`, not inside code blocks; 19 notes). An answer from only the active note, or a different number, fails.

If your test vault is not the standard fixture copy, case 1 does not apply as written, and case 4 must be compared with a count from the files. Both can be checked from files in PowerShell. Replace `<test vault folder>`:
```powershell
$vault = "<test vault folder>"
$open = 0
Get-ChildItem -LiteralPath $vault -Recurse -Filter *.md -File |
  Where-Object { $_.FullName -notmatch '\\(\.obsidian|\.trash|\.git)\\' } |
  ForEach-Object {
    $fence = $null
    foreach ($line in [System.IO.File]::ReadAllLines($_.FullName)) {
      if ($line -match '^\s{0,3}(`{3,}|~{3,})') {
        if (-not $fence) { $fence = $Matches[1][0] } elseif ($Matches[1][0] -eq $fence) { $fence = $null }
        continue
      }
      if (-not $fence -and $line -match '^\s*([-*+]|\d+\.)\s+\[ \]') { $open++ }
    }
  }
"open tasks = $open"
```
This printed 114 on the standard copy (a plain `Select-String` gives 115, because it also counts one task inside a code block). For case 1, the exact rules are in `tests/scenarios/README.md`; with Node and `npm ci` in `tests/`, `node tests\node_modules\.bin\otf truth backlinks "<test vault folder>" "_agentkit-lab/Target Note.md"` prints the file list.

## 6. After the runs
```powershell
git -C "<test vault folder>" status --short      # must print nothing
git -C "<test vault folder>" rev-parse HEAD      # must equal the value from step 1
```

## 7. Record the result
Add rows at the end of the table in `tests/RESULTS.md` (rows are never edited). Fill the `<...>`; use `pass` only if the answer equals section 5.

```
| <date> | Windows native (PowerShell, Claude Code) | <cli version> | 1 backlinks | 1 | **<pass/fail>**: <9 files = ground truth; code-block file excluded; incompleteness stated> | <tool calls> | — | `otf truth backlinks` total 9; vault `git status` empty, HEAD unchanged; WSL row 2026-10-22 gave the same set |
| <date> | Windows native (PowerShell, Claude Code) | <cli version> | 4 open tasks | 1 | **<pass/fail>**: answer <N> = ground truth 114 | <tool calls> | — | file count 114; vault `git status` empty, HEAD unchanged; WSL rows 2026-10-22 gave 114 |
```
Done when both rows say `pass`. Also change the case 9 line of the README's Windows note and `docs/BACKLOG.md` (E2.1b) as the builder tells you; do not edit old rows.

## 8. If something fails
- **A path starting `/mnt/...` or `/home/...` appears, or the agent says "WSL"**: it ran the wrong shell or invented a WSL path. The bridge must print `env=windows` in step 3; if it prints `env=wsl` you are not in Windows PowerShell. Vault paths on Windows look like `C:\...`; the CLI itself prints vault-relative paths with `/` (`docs/FINDINGS.md` F3), which is normal.
- **`APPROXIMATE: Obsidian is not running`, or `cli=none`**: start Obsidian (the test vault open) and repeat step 3. Check `Get-Command obsidian -All`: the first entry should be `Obsidian.com`. `Obsidian.exe` instead of `.com` gives exit 127 on colon commands (`docs/FINDINGS.md` F1, Git Bash row). Workaround: `$env:OBS_CLI = "$env:LOCALAPPDATA\Programs\Obsidian\Obsidian.com"` (bridge env var; the bridge also looks there itself).
- **`Command "vault" not found` or `Vault not found.`** right after opening or reloading the vault: wait 10 to 30 s and retry once (F1b, F1c). `Vault not found.` means the name is wrong.
- **Agent ignores the skill**: check `dir "$env:USERPROFILE\.claude\skills\obsidian-connect\SKILL.md"` exists; restart `claude`.
- **Wrong answer, but the bridge was right**: record `fail` with both outputs; that is a finding, do not retry until it passes.
- **A dialog appears in Obsidian**: do not click it; stop and report.
- In any failure, paste into the report: the `--preflight` output, the agent's final answer, and the `<test vault folder>` git status.

## Rehearsal (E2.1a)
The same two prompts were run once in WSL on `vault-copy` with `node tests/scenarios/case9-rehearsal.mjs <1|4>` (fresh headless agent, read-only, judged from files). That is a check of the prompts and expected answers, not the Windows row.
