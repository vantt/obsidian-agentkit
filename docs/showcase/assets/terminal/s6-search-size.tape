Output s6-search-size.gif
Output s6-search-size.mp4
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
Type "# KHÔNG skill: tìm cụm 2 từ, quên ngoặc kép" Enter
Type "obsidian vault=vault-copy search:context query='Section A' path=_agentkit-lab | wc -c" Enter
Sleep 3s
Type "# CÓ skill: cụm từ trong ngoặc kép, có limit" Enter
Type `obs search:context query='"Section A"' path=_agentkit-lab limit=10 format=json | wc -c` Enter
Sleep 4s
