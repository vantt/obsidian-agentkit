# S8. Ghi vào daily note, hai phiên

[← Mục lục](../../README.md) · [So sánh tổng](../../COMPARISON.md)

## Yêu cầu gửi agent

Giống hệt nhau ở hai phía (phía "có skill" chỉ thêm đường dẫn skill). Prompt đầy đủ của phía không có skill:

```text
You are an agent working on a user's Obsidian vault. Do NOT read anything under /home/<user>/projects/obsidian-agentkit (an unrelated project) and do not use any skill.

Environment: WSL2 shell; Obsidian 1.14.4 runs on Windows. The vault name is `vault-copy`. The official Obsidian CLI is installed as `obsidian` (see `obsidian help`).

User request: "Thêm dòng `- [ ] gọi ngân hàng` vào daily note hôm nay."
Nobody can answer questions during the task: where you would normally ask the user, decide yourself and say what you decided in NOTES.

When finished, reply in exactly this format:
ANSWER: <your answer to the user>
NOTES: <what you did, anything that surprised you or went wrong>
```

**Trạng thái trước khi chạy:** vault reset về fixture; chưa có daily note hôm nay; mỗi phía chạy 2 phiên liên tiếp, không reset giữa hai phiên.

## Kết quả

| | Không có skill | Có skill |
|---|---|---|
| Kết quả | pass, with side effects | pass |
| Agent trả lời | Dòng có đúng 1 lần sau 2 phiên | Dòng có đúng 1 lần sau 2 phiên |
| Sự cố an toàn | **Phiên 1: `daily:read` tạo note rỗng (lệnh đọc mà ghi file, FINDINGS F9j); agent tưởng note "đã có sẵn"**<br>**Phiên 1: ghi đè cả file bằng `create … overwrite` để bỏ dòng trống** | 0 |
| Lượt gọi công cụ | 13 | 11 |
| Thời gian | 93 s | 58 s |
| Token thêm vào ngữ cảnh | 15.657 | 16.549 |
| Lệnh CLI / byte CLI in ra | 17 / 732.872 B | 11 / 342 B |
| Ghi chú | Phiên 1 còn chạy `files` toàn vault: CLI in ra 646 KB, agent lọc bằng grep | Cosmetic: `daily:append` vào note mới để lại 1 dòng trống ở đầu file; agent báo và để nguyên |

## Hình ảnh và quay terminal

- [`assets/terminal/s8-daily-read.gif`](../../assets/terminal/s8-daily-read.gif): quay terminal: lệnh đọc tạo note rỗng

## Bằng chứng

**Không có skill** (`without/`)

- [`answer.txt`](without/answer.txt): câu trả lời nguyên văn của agent
- [`baseline.json`](without/baseline.json): trạng thái trước lượt chạy: HEAD git, unresolved, backlinks, cấu hình
- [`check.json`](without/check.json): chấm từ trạng thái vault: file đổi, link gãy, types.json, Recycle Bin, .trash, ground truth
- [`cli-calls.txt`](without/cli-calls.txt): mọi lệnh Obsidian CLI thật sự chạy: tham số, exit, byte, ms (log của wrapper)
- [`lab.diff`](without/lab.diff): `git diff` của fixture và `.obsidian/types.json` sau lượt chạy
- [`metrics.json`](without/metrics.json): số lượt, byte output, token theo usage API, thời gian
- [`transcript.md`](without/transcript.md): từng lệnh agent gọi, output (cắt 2.500 ký tự), câu trả lời cuối; đã che dữ liệu thật

**Không có skill, phiên 2** (`without2/`)

- [`answer.txt`](without2/answer.txt): câu trả lời nguyên văn của agent
- [`baseline.json`](without2/baseline.json): trạng thái trước lượt chạy: HEAD git, unresolved, backlinks, cấu hình
- [`check.json`](without2/check.json): chấm từ trạng thái vault: file đổi, link gãy, types.json, Recycle Bin, .trash, ground truth
- [`cli-calls.txt`](without2/cli-calls.txt): mọi lệnh Obsidian CLI thật sự chạy: tham số, exit, byte, ms (log của wrapper)
- [`lab.diff`](without2/lab.diff): `git diff` của fixture và `.obsidian/types.json` sau lượt chạy
- [`metrics.json`](without2/metrics.json): số lượt, byte output, token theo usage API, thời gian
- [`transcript.md`](without2/transcript.md): từng lệnh agent gọi, output (cắt 2.500 ký tự), câu trả lời cuối; đã che dữ liệu thật

**Có skill** (`with/`)

- [`answer.txt`](with/answer.txt): câu trả lời nguyên văn của agent
- [`baseline.json`](with/baseline.json): trạng thái trước lượt chạy: HEAD git, unresolved, backlinks, cấu hình
- [`check.json`](with/check.json): chấm từ trạng thái vault: file đổi, link gãy, types.json, Recycle Bin, .trash, ground truth
- [`cli-calls.txt`](with/cli-calls.txt): mọi lệnh Obsidian CLI thật sự chạy: tham số, exit, byte, ms (log của wrapper)
- [`lab.diff`](with/lab.diff): `git diff` của fixture và `.obsidian/types.json` sau lượt chạy
- [`metrics.json`](with/metrics.json): số lượt, byte output, token theo usage API, thời gian
- [`transcript.md`](with/transcript.md): từng lệnh agent gọi, output (cắt 2.500 ký tự), câu trả lời cuối; đã che dữ liệu thật

**Có skill, phiên 2** (`with2/`)

- [`answer.txt`](with2/answer.txt): câu trả lời nguyên văn của agent
- [`baseline.json`](with2/baseline.json): trạng thái trước lượt chạy: HEAD git, unresolved, backlinks, cấu hình
- [`check.json`](with2/check.json): chấm từ trạng thái vault: file đổi, link gãy, types.json, Recycle Bin, .trash, ground truth
- [`cli-calls.txt`](with2/cli-calls.txt): mọi lệnh Obsidian CLI thật sự chạy: tham số, exit, byte, ms (log của wrapper)
- [`lab.diff`](with2/lab.diff): `git diff` của fixture và `.obsidian/types.json` sau lượt chạy
- [`metrics.json`](with2/metrics.json): số lượt, byte output, token theo usage API, thời gian
- [`transcript.md`](with2/transcript.md): từng lệnh agent gọi, output (cắt 2.500 ký tự), câu trả lời cuối; đã che dữ liệu thật

## Dựng lại

```bash
tests/showcase/install.sh
node tests/showcase/names.mjs > tests/out/showcase/real-names.json
tests/showcase/setup.sh S8 without
node tests/showcase/prompt.mjs S8 without   # đưa cho một subagent mới
tests/showcase/finish.sh S8 without <agentId>
```

Lặp lại với `with`. S8: sau phiên 1 chạy `setup.sh S8 without2 --keep`, phiên 2 dùng cùng prompt, rồi `finish.sh S8 without2 <agentId>`. Chi tiết: [tests/showcase/README.md](../../../../tests/showcase/README.md).
