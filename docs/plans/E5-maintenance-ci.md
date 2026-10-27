# E5. Bảo trì và CI

**Trạng thái:** Todo · **Board:** [BACKLOG.md](../BACKLOG.md)

## Mục tiêu
Phát hiện sớm khi skill hỏng: có test tự động mỗi lần push, và có quy trình kiểm tra lại mỗi khi Obsidian ra bản mới.

## Việc

| ID | Việc | Xong khi |
|---|---|---|
| E5.1 | GitHub Actions chạy `node --test tests/*.test.mjs` và `tests/size-check.mjs` mỗi lần push. Trước đó phải `cd tests && npm ci`: `profile.test.mjs`, `check.mjs`, `probes.mjs` dùng `otf` từ package `obsidian-test-fixture` (GitHub, ghim tag) | Badge xanh trên README; một PR cố tình làm SKILL vượt ngân sách thì bị fail |
| E5.2 | Lệnh `npm test` (sau `npm ci`) gom mọi test không cần Obsidian (unit, size, fixture có tính tái lập) | `cd tests && npm test` chạy đủ |
| E5.3 | Quy trình kiểm tra khi Obsidian cập nhật: chạy probe, so sánh, cập nhật `TESTED_CLI` | Một checklist trong [tests/compat/README.md](../../tests/compat/README.md); lần cập nhật đầu tiên làm theo checklist này |
| E5.4 | Nhắc kiểm tra định kỳ: hằng tháng chạy `probes.mjs --no-write` | Có lịch (cron/routine), hoặc ghi chú trong README |
| E5.5 | Dọn file test bị đưa vào Thùng rác Windows (mỗi lần chạy, probe P18 bỏ vào một file) | P18 tự khôi phục hoặc xoá file của nó khỏi Thùng rác sau khi đo |
| E5.6 | Repo housekeeping: commit việc dời `docs/research/distillery` sang `docs/distillery`, quyết định có commit `docs/handoff/` không | `git status` sạch. **Xong 2026-10-24:** cả hai đã commit; chỉ `/upstreams/` không track |
