# S7. Obsidian tắt: liệt kê backlink

[← Mục lục](../../README.md) · [So sánh tổng](../../COMPARISON.md)

## Yêu cầu gửi agent

Giống hệt nhau ở hai phía (phía "có skill" chỉ thêm đường dẫn skill). Prompt đầy đủ của phía không có skill:

```text
You are an agent working on a user's Obsidian vault. Do NOT read anything under /home/<user>/projects/obsidian-agentkit (an unrelated project) and do not use any skill.

Environment: WSL2 shell; Obsidian 1.14.4 runs on Windows. The vault name is `vault-copy`. The official Obsidian CLI is installed as `obsidian` (see `obsidian help`).

User request: "Liệt kê mọi note có link tới `_agentkit-lab/Target Note.md`. Nói rõ nếu danh sách có thể chưa đủ."
Nobody can answer questions during the task: where you would normally ask the user, decide yourself and say what you decided in NOTES.

When finished, reply in exactly this format:
ANSWER: <your answer to the user>
NOTES: <what you did, anything that surprised you or went wrong>
```

**Trạng thái trước khi chạy:** vault reset về fixture; CLI trả về đúng thông báo và exit 1 như khi Obsidian không chạy (FINDINGS F1a); app thật vẫn chạy.

## Kết quả

| | Không có skill | Có skill |
|---|---|---|
| Kết quả | pass | pass |
| Agent trả lời | 9 note (8 + 1 trong frontmatter), có ghi chú danh sách có thể chưa đủ | 9 note, ghi rõ "approximate" |
| Sự cố an toàn | 0 | 0 |
| Lượt gọi công cụ | 8 | 7 |
| Thời gian | 91 s | 85 s |
| Token thêm vào ngữ cảnh | 15.085 | 10.689 |
| Lệnh CLI / byte CLI in ra | 1 / 87 B | 2 / 174 B |
| Ghi chú | Agent đọc wrapper `~/.local/bin/obsidian` và nhận ra đây là mô phỏng; xem phần Hạn chế | Preflight exit 2 ngay lần gọi đầu, chuyển sang file mode theo `references/file-mode.md` |

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
tests/showcase/setup.sh S7 without
node tests/showcase/prompt.mjs S7 without   # đưa cho một subagent mới
tests/showcase/finish.sh S7 without <agentId>
```

Lặp lại với `with`. Chi tiết: [tests/showcase/README.md](../../../../tests/showcase/README.md).
