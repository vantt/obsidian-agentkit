Output s4-types-json.gif
Output s4-types-json.mp4
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
Type "# KHÔNG skill: thêm 'next' vào tags của MỘT note bằng property:set" Enter
Type 'obsidian vault=vault-copy property:set name=tags type=list value="proj,fixture,next" path="_agentkit-lab/props/Property Note.md"' Enter
Sleep 2s
Type "git diff --stat" Enter
Sleep 2s
Type "# types.json là cấu hình kiểu property của CẢ vault:" Enter
Type "git diff -U0 .obsidian/types.json | grep '^[-+] '" Enter
Sleep 4s
Hide
Type "$SHOWCASE_REPO/tests/showcase/demo-reset.sh; clear" Enter
Wait
Show
Type "# CÓ skill: bridge chặn lệnh này, agent sửa đúng dòng frontmatter thay vào đó" Enter
Type 'obs property:set name=tags type=list value="proj,fixture,next" path="_agentkit-lab/props/Property Note.md"; echo "exit=$?"' Enter
Sleep 3s
Type "git diff --stat; echo '(types.json không đổi)'" Enter
Sleep 4s
