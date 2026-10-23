Output s8-daily-read.gif
Output s8-daily-read.mp4
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
Type "$SHOWCASE_REPO/tests/showcase/demo-reset.sh; D=$(obs daily:path); clear" Enter
Wait
Show
Type "# Daily note hôm nay chưa có:" Enter
Type 'ls -la "$D"' Enter
Sleep 2s
Type "# KHÔNG skill: 'đọc thử' daily note" Enter
Type `obsidian vault=vault-copy daily:read; echo "exit=$?"` Enter
Sleep 2s
Type 'ls -la "$D"' Enter
Sleep 3s
Type "# Lệnh ĐỌC vừa tạo một note rỗng 0 byte." Enter
Sleep 2s
Hide
Type "$SHOWCASE_REPO/tests/showcase/demo-reset.sh; clear" Enter
Wait
Show
Type "# CÓ skill: hỏi đường dẫn, kiểm tra bằng file, không tạo gì" Enter
Type 'obs daily:path; ls -la "$(obs --abs "$D")" 2>&1 | tail -1' Enter
Sleep 4s
