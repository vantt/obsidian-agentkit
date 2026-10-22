# E1. Xây dựng v1 của obsidian-connect

**Trạng thái:** Done (2026-10-22) · **Board:** [BACKLOG.md](../BACKLOG.md)

## Mục tiêu
Xây skill mỏng, có bridge và vault profile, để agent đọc, tìm và sửa vault Obsidian đúng, ít lượt, ít token. Skill phải chạy được từ WSL, từ Windows, và khi không có CLI. Đề bài gốc: `docs/handoff/BUILD-PROMPT.md` (file local, chưa commit).

## Các bước và kết quả

| ID | Việc | Trạng thái | Kết quả / bằng chứng |
|---|---|---|---|
| E1.0 | Phase 0: thu thập đầu vào, tạo bản sao vault có git | Done | [GATES.md](../GATES.md), Gate 0 |
| E1.1 | Phase 1: đo hành vi CLI 1.14.4 | Done | [FINDINGS.md](../FINDINGS.md), commit `2a3534a` |
| E1.2 | Phase 2: spec | Done | [SPEC.md](../SPEC.md), commit `b123600` |
| E1.3 | Phase 3: bridge, profile, SKILL, references, unit test | Done | `skills/obsidian-connect/`, commit `98638aa` |
| E1.4 | Phase 3b: bộ probe tương thích, lịch sử điểm, nhật ký sự cố | Done | [tests/compat/README.md](../../tests/compat/README.md), 29/29 |
| E1.5 | Phase 4: chạy 11 kịch bản test | Done | [tests/RESULTS.md](../../tests/RESULTS.md), commit `d8c4f3f` |
| E1.6 | Tài liệu giải thích cách skill hoạt động | Done | [HOW-IT-WORKS.md](../HOW-IT-WORKS.md) |

## Việc còn lại được chuyển sang epic khác
Các lỗ hổng đã chấp nhận ở cổng 3 nằm trong [E2](E2-verification-gaps.md). Các việc mở rộng nằm trong E3–E6.
