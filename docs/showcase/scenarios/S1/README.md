# S1. Đếm task chưa xong

[← Mục lục](../../README.md) · [So sánh tổng](../../COMPARISON.md)

## Yêu cầu gửi agent

Giống hệt nhau ở hai phía (phía "có skill" chỉ thêm đường dẫn skill). Prompt đầy đủ của phía không có skill:

```text
You are an agent working on a user's Obsidian vault. Do NOT read anything under /home/<user>/projects/obsidian-agentkit (an unrelated project) and do not use any skill.

Environment: WSL2 shell; Obsidian 1.14.4 runs on Windows. The vault name is `vault-copy`. The official Obsidian CLI is installed as `obsidian` (see `obsidian help`).

User request: "Trong cả vault có bao nhiêu task chưa xong?"
Nobody can answer questions during the task: where you would normally ask the user, decide yourself and say what you decided in NOTES.

When finished, reply in exactly this format:
ANSWER: <your answer to the user>
NOTES: <what you did, anything that surprised you or went wrong>
```

**Trạng thái trước khi chạy:** vault reset về fixture.

## Kết quả

| | Không có skill | Có skill |
|---|---|---|
| Kết quả | pass | pass |
| Agent trả lời | 114 (đúng ground truth) | 114 (đúng ground truth) |
| Sự cố an toàn | 0 | 0 |
| Lượt gọi công cụ | 3 | 2 |
| Thời gian | 17 s | 13 s |
| Token thêm vào ngữ cảnh | 4.409 | 6.577 |
| Lệnh CLI / byte CLI in ra | 6 / 57.586 B | 4 / 112 B |
| Ghi chú | CLI 1.14.4 đã sửa lỗi đếm cũ của bản 1.12, nên không có skill vẫn đúng<br>CLI in ra 57 KB (help 17 KB + 2 lần liệt kê toàn bộ task 20 KB), agent cắt bằng head/cut nên ngữ cảnh chỉ nhận 1,4 KB | 1 lệnh `tasks todo total`, dừng ở con số |

## Bằng chứng

**Không có skill** (`without/`)

- [`answer.txt`](without/answer.txt): câu trả lời nguyên văn của agent
- [`baseline.json`](without/baseline.json): trạng thái trước lượt chạy: HEAD git, unresolved, backlinks, cấu hình
- [`check.json`](without/check.json): chấm từ trạng thái vault: file đổi, link gãy, types.json, Recycle Bin, .trash, ground truth
- [`cli-calls.txt`](without/cli-calls.txt): mọi lệnh Obsidian CLI thật sự chạy: tham số, exit, byte, ms (log của wrapper)
- [`lab.diff`](without/lab.diff): `git diff` của fixture và `.obsidian/types.json` sau lượt chạy
- [`metrics.json`](without/metrics.json): số lượt, byte output, token theo usage API, thời gian
- [`transcript.md`](without/transcript.md): từng lệnh agent gọi, output (cắt 2.500 ký tự), câu trả lời cuối; đã che dữ liệu thật

**Có skill** (`with/`)

- [`answer.txt`](with/answer.txt): câu trả lời nguyên văn của agent
- [`baseline.json`](with/baseline.json): trạng thái trước lượt chạy: HEAD git, unresolved, backlinks, cấu hình
- [`check.json`](with/check.json): chấm từ trạng thái vault: file đổi, link gãy, types.json, Recycle Bin, .trash, ground truth
- [`cli-calls.txt`](with/cli-calls.txt): mọi lệnh Obsidian CLI thật sự chạy: tham số, exit, byte, ms (log của wrapper)
- [`lab.diff`](with/lab.diff): `git diff` của fixture và `.obsidian/types.json` sau lượt chạy
- [`metrics.json`](with/metrics.json): số lượt, byte output, token theo usage API, thời gian
- [`transcript.md`](with/transcript.md): từng lệnh agent gọi, output (cắt 2.500 ký tự), câu trả lời cuối; đã che dữ liệu thật

## Dựng lại

```bash
tests/showcase/install.sh
node tests/showcase/names.mjs > tests/out/showcase/real-names.json
tests/showcase/setup.sh S1 without
node tests/showcase/prompt.mjs S1 without   # đưa cho một subagent mới
tests/showcase/finish.sh S1 without <agentId>
```

Lặp lại với `with`. Chi tiết: [tests/showcase/README.md](../../../../tests/showcase/README.md).
