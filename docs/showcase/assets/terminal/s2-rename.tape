Output s2-rename.gif
Output s2-rename.mp4
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
Type "$SHOWCASE_REPO/tests/showcase/demo-reset.sh links-off; clear" Enter
Wait
Show
Type "# Vault đang TẮT 'Automatically update internal links'. 9 note link tới Target Note." Enter
Type "# KHÔNG skill: gọi thẳng CLI để đổi tên" Enter
Type 'timeout 12 obsidian vault=vault-copy rename path="_agentkit-lab/Target Note.md" name="Target Renamed"; echo "exit=$?"' Enter
Sleep 14s
Type "# CLI treo chờ một hộp thoại trong Obsidian. Nhưng file đã bị đổi tên:" Enter
Type "git status --short _agentkit-lab" Enter
Sleep 2s
Hide
Type "$SHOWCASE_REPO/tests/showcase/demo-reset.sh dismiss; sleep 3; clear" Enter
Wait
Show
Type "# User bấm 'Do not update' trên hộp thoại. Đếm link gãy (trước đó: 87):" Enter
Type "obsidian vault=vault-copy unresolved total" Enter
Sleep 2s
Hide
Type "$SHOWCASE_REPO/tests/showcase/demo-reset.sh links-off; clear" Enter
Wait
Show
Type "# CÓ skill: cùng yêu cầu, qua bridge" Enter
Type 'obs --rename path="_agentkit-lab/Target Note.md" name="Target Renamed"; echo "exit=$?"' Enter
Sleep 3s
Type "git status --short _agentkit-lab; echo '(không file nào bị đổi)'" Enter
Sleep 4s
Hide
Type "$SHOWCASE_REPO/tests/showcase/demo-reset.sh" Enter
Wait
