# E3. Đưa skill vào dùng trên vault thật

**Trạng thái:** Doing, 3/9 (E3.1, E3.2, E3.4 xong 2026-10-28; E3.3, E3.5, E3.6 tách a/b; tiếp: E3.3b một tuần chỉ đọc) · **Board:** [BACKLOG.md](../BACKLOG.md)

## Mục tiêu
Dùng skill hằng ngày trên vault thật đang đồng bộ Google Drive, bắt đầu từ việc chỉ đọc, rồi mới mở dần quyền ghi.

## Việc

| ID | Việc | Xong khi |
|---|---|---|
| E3.1 | Cài skill vào `~/.claude/skills/obsidian-connect/` (symlink tới repo) trên WSL, và trên Windows nếu dùng | `obs --preflight` chạy được trên vault thật, `match=yes` |
| E3.2 | Chạy `profile.mjs` trên vault thật, đối chiếu với cài đặt trong Obsidian | Profile khớp: kiểu link, daily note, thư mục template |
| E3.3 | **Giai đoạn chỉ đọc (1 tuần):** tìm, backlink, đếm task | Không có lần trả lời sai nào; ghi các trường hợp skill thiếu vào E5 hoặc E6 |
| E3.3a | **Chuẩn bị E3.3:** bảng ghi lỗi và 10 câu hỏi chỉ đọc mẫu, chạy thử trên `vault-copy` | 10 câu đúng, vault sạch |
| E3.3b | **Một tuần chỉ đọc** trên vault thật (user) | Như "Xong khi" của E3.3 |
| E3.4 | Quyết định chiến lược snapshot cho vault thật: git trong vault, hay copy vào `.trash/obsidian-connect-snapshots/` | Quyết định được ghi vào GATES.md |
| E3.5 | **Mở quyền ghi một note:** append daily note, sửa property | 10 lần ghi đều đọc lại đúng, không tạo bản xung đột Drive |
| E3.5a | **Chuẩn bị E3.5:** script 10 lần ghi và đọc lại, chạy trên vault Drive test | 10/10 đúng, không bản xung đột sau 3 phút |
| E3.5b | **Ghi trên vault thật** cùng user (~15 phút), sau E3.3b | Như "Xong khi" của E3.5 |
| E3.6a | **Chuẩn bị E3.6:** diễn tập dry-run, rename, move, đổi tên tag trên `vault-copy` | `unresolved total` không đổi, vault sạch |
| E3.6b | **Thao tác lớn trên vault thật** có người theo dõi (~20 phút), sau E3.5b | Như "Xong khi" của E3.6 |
| E3.6 | **Mở thao tác lớn:** rename, move, đổi tên tag (luôn có dry-run và xác nhận) | Lần đầu làm có người theo dõi; `unresolved total` không đổi |

## Điều kiện bắt đầu
Phải xong E2.3 (biết file bị xoá trên Drive đi đâu). Cần xác nhận `alwaysUpdateLinks` đang bật trong vault thật.
