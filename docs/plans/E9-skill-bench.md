# E9. Bench dùng lại được: skill chạy tốt với Obsidian, agent CLI và model nào

**Trạng thái:** Todo, 0/6 việc · **Board:** [BACKLOG.md](../BACKLOG.md) · **Prompt bàn giao:** [E9-SKILLBENCH-PROMPT.md](../handoff/E9-SKILLBENCH-PROMPT.md) · **Nguồn:** harness của E8 (`tests/models/`), bộ probe `tests/compat/`

## Mục tiêu
Biến harness đo của E8 thành một công cụ dùng lại được (`bench/`). Công cụ này test lại skill theo 4 trục và giữ lịch sử điểm so sánh được:

| Trục | Ví dụ |
|---|---|
| Phiên bản Obsidian | app và CLI 1.14.4, 1.14.5, các bản sau |
| Agent CLI | Claude Code, Codex CLI, Antigravity, pi / omp |
| Model | Claude (gói), DeepSeek, GLM, Gemini, OpenAI qua OpenRouter |
| Phiên bản skill | git revision của `skills/obsidian-connect/` |

Chi tiết yêu cầu, ràng buộc và 10 bài học từ E8 nằm trong prompt bàn giao. Agent nhận việc đọc prompt đó trước.

## Việc

| ID | Việc | Xong khi | Trạng thái | Bằng chứng |
|---|---|---|---|---|
| E9.1 | Câu hỏi cho user, hỏi một lần: pi / omp là gì, vault tổng hợp thứ hai, agent CLI nào đã cài, ngân sách, có cài bản Obsidian cũ không | User trả lời; ghi ở GATES | ⬜ | — |
| E9.2 | Chuyển harness sang `bench/`: adapter Claude Code, kịch bản S1–S9 thành dữ liệu, judge chung | Chấm lại vòng 0 của E8 ra cùng kết quả (hoặc có giải thích); unit test chạy offline | ⬜ | — |
| E9.3 | Adapter Codex, pi / omp, Antigravity (hoặc phương án thay, có lý do) | Mỗi adapter qua smoke test và test tác vụ nền | ⬜ | — |
| E9.4 | Lịch sử, `HISTORY.md`, `compare`, báo cáo, `import-e8` | `HISTORY.md` có E8 làm mốc đầu | ⬜ | — |
| E9.5 | Một đợt chạy thật trên vault tổng hợp riêng: ít nhất 2 agent × 3 model, S1 S2 S4 S5, có và không skill, 1 lượt | Lịch sử và báo cáo đã commit; `compare` với E8 chạy được | ⬜ | — |
| E9.6 | Tài liệu: `bench/README.md`, `TROUBLESHOOTING.md`, mục ngắn trong HOW-IT-WORKS | Người đọc tự thêm được agent, model, kịch bản, phiên bản Obsidian | ⬜ | — |

## Phụ thuộc và lưu ý
- **Ma trận E8 đã dừng (2026-10-27, 434/540 ô).** Nay được phép sửa `tests/models/`, `tests/showcase/`, `tests/scenarios/`, và chạy trên `vault-synth`. Mốc so sánh là [ROUND-0.md](../models/ROUND-0.md) và [round-0.csv](../models/data/round-0.csv).
- **Không bao giờ gửi nội dung vault thật** (`vault-copy`) tới model; chỉ dùng vault tổng hợp có file đánh dấu.
- Trục phiên bản Obsidian: Obsidian tự cập nhật. Tối thiểu là ghi phiên bản của mỗi lượt và chạy kèm `tests/compat/probes.mjs`. Có cài bản cũ hay không thì quyết định ở E9.1.
