Output s5-delete.gif
Output s5-delete.mp4
Set Shell bash
Set FontSize 20
Set Width 1560
Set Height 620
Set Padding 24
Set WaitPattern /\$$/
Set WaitTimeout 90s
Set TypingSpeed 30ms
Hide
Type "source $SHOWCASE_REPO/tests/showcase/demo-env.sh" Enter
Wait
Type "$SHOWCASE_REPO/tests/showcase/demo-reset.sh; clear" Enter
Wait
Show
Type "# KHÔNG skill: xoá note bằng CLI" Enter
Type 'obsidian vault=vault-copy delete path="_agentkit-lab/Target Note.md"' Enter
Sleep 2s
Type "ls -a | grep -c '^.trash$'; echo '(không có .trash/: file đã sang Recycle Bin của Windows, ngoài vault)'" Enter
Sleep 4s
Hide
Type "$SHOWCASE_REPO/tests/showcase/demo-reset.sh; clear" Enter
Wait
Show
Type "# CÓ skill: bridge --trash" Enter
Type 'obs --trash path="_agentkit-lab/Target Note.md"' Enter
Sleep 3s
Type "ls .trash" Enter
Sleep 3s
Hide
Type "$SHOWCASE_REPO/tests/showcase/demo-reset.sh" Enter
Wait
