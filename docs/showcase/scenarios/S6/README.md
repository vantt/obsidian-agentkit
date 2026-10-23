# S6. Tìm note về Đà Nẵng (nội dung thật, chỉ công bố số liệu)

[← Mục lục](../../README.md) · [So sánh tổng](../../COMPARISON.md)

## Yêu cầu gửi agent

Giống hệt nhau ở hai phía (phía "có skill" chỉ thêm đường dẫn skill). Prompt đầy đủ của phía không có skill:

```text
You are an agent working on a user's Obsidian vault. Do NOT read anything under /home/<user>/projects/obsidian-agentkit (an unrelated project) and do not use any skill.

Environment: WSL2 shell; Obsidian 1.14.4 runs on Windows. The vault name is `vault-copy`. The official Obsidian CLI is installed as `obsidian` (see `obsidian help`).

User request: "Tìm các note của tôi về Đà Nẵng và cho tôi 3 note liên quan nhất."
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
| Agent trả lời | Cùng 3 note với phía có skill | Cùng 3 note |
| Sự cố an toàn | 0 | 0 |
| Lượt gọi công cụ | 8 | 3 |
| Thời gian | 65 s | 26 s |
| Token thêm vào ngữ cảnh | 27.911 | 8.746 |
| Lệnh CLI / byte CLI in ra | 41 / 152.044 B | 13 / 3.854 B |
| Ghi chú | 13 lần `search` và 13 lần `search:context`, 8 lần `read`<br>CLI in ra tổng ~150 KB, một lệnh `search:context` 64 KB<br>Agent tự phát hiện query không có ngoặc kép khớp nhầm "Cẩm Nang", "Kỹ Năng" | Tìm cả "Đà Nẵng", "Da Nang", "Danang" theo hướng dẫn skill, 2 lệnh Bash |

## Hình ảnh và quay terminal

- [`assets/terminal/s6-search-size.gif`](../../assets/terminal/s6-search-size.gif): quay terminal: 565 KB so với 245 B (trên fixture)

## Bằng chứng

**Không có skill** (`without/`)

- [`baseline.json`](without/baseline.json): trạng thái trước lượt chạy: HEAD git, unresolved, backlinks, cấu hình
- [`check.json`](without/check.json): chấm từ trạng thái vault: file đổi, link gãy, types.json, Recycle Bin, .trash, ground truth
- [`cli-by-command.json`](without/cli-by-command.json): S6: số lệnh CLI và byte theo loại lệnh (không công bố tham số vì là nội dung thật)
- [`metrics.json`](without/metrics.json): số lượt, byte output, token theo usage API, thời gian

**Có skill** (`with/`)

- [`baseline.json`](with/baseline.json): trạng thái trước lượt chạy: HEAD git, unresolved, backlinks, cấu hình
- [`check.json`](with/check.json): chấm từ trạng thái vault: file đổi, link gãy, types.json, Recycle Bin, .trash, ground truth
- [`cli-by-command.json`](with/cli-by-command.json): S6: số lệnh CLI và byte theo loại lệnh (không công bố tham số vì là nội dung thật)
- [`metrics.json`](with/metrics.json): số lượt, byte output, token theo usage API, thời gian

## Dựng lại

```bash
tests/showcase/install.sh
node tests/showcase/names.mjs > tests/out/showcase/real-names.json
tests/showcase/setup.sh S6 without
node tests/showcase/prompt.mjs S6 without   # đưa cho một subagent mới
tests/showcase/finish.sh S6 without <agentId>
```

Lặp lại với `with`. Chi tiết: [tests/showcase/README.md](../../../../tests/showcase/README.md).
