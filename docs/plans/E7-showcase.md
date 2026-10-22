# E7. Diễn tập "có skill / không có skill": tư liệu cho bài viết và video

**Trạng thái:** Todo · **Board:** [BACKLOG.md](../BACKLOG.md)

## Mục tiêu
Chạy lại các tình huống tiêu biểu **hai lần**: một lần agent không có skill, một lần có skill, trên cùng bản sao vault và cùng yêu cầu. So sánh 5 mặt:

| Mặt | Đo bằng |
|---|---|
| **Vấn đề giải quyết được** | Kết quả đúng hay sai, theo ground truth (`tests/ground-truth/gt.mjs`) |
| **Tiết kiệm token** | Output công cụ (`OBS_LOG` + transcript) và token của subagent |
| **Độ chính xác** | Sai lệch so với ground truth: thiếu backlink, đếm sai task |
| **Độ an toàn** | Thiệt hại trong `git diff`: link gãy, `tên 1.md`, `types.json` bị đổi, file vào Thùng rác, note rỗng |
| **Độ tiện dụng** | Số lượt, thời gian, số lần agent phải hỏi hoặc thử lại, user phải can thiệp không |

Sản phẩm cuối là **kho tư liệu** để viết bài chia sẻ (LinkedIn, Facebook) và làm video ngắn: bảng số liệu, ảnh trước và sau, đoạn diff, đoạn quay terminal, và các câu "hook".

## Tình huống đề xuất (chọn những tình huống có độ tương phản rõ)

| # | Tình huống | Không có skill, dự kiến | Có skill, đã đo |
|---|---|---|---|
| S1 | "Có bao nhiêu task chưa xong?" | Grep toàn vault hoặc liệt kê hết, tốn hàng nghìn token, có thể đếm cả task trong code | 3 lượt, ~60 token, đúng 114 |
| S2 | Đổi tên note có 9 link trỏ tới, khi tắt auto-update | Lệnh trả về "Renamed", nhưng link gãy âm thầm hoặc CLI treo | Bridge từ chối, giải thích lý do (exit 7) |
| S3 | Đổi tên tag `#proj` | Đổi luôn cả `#projects`, phần code, tag con | Có dry-run, giữ nguyên các chỗ không được đụng |
| S4 | Thêm giá trị vào `tags`, đặt `rating` | `property:set` biến list thành chuỗi và sửa `types.json` của cả vault | Sửa theo dòng, kiểu dữ liệu giữ nguyên |
| S5 | Xoá một note | Note vào Thùng rác Windows, có thể mất nếu vault trên Drive | Note vào `.trash/` của vault, báo số link sẽ gãy |
| S6 | Tìm "Đà Nẵng" trong 1.845 note | Query không có ngoặc kép, output hàng trăm KB | ~960 token, tìm cả bản không dấu |
| S7 | Obsidian đang tắt | Thử lại nhiều lần, hoặc trả lời "không có kết quả" | Phát hiện trong 1 lần gọi, chuyển sang file mode, ghi "gần đúng" |
| S8 | Ghi vào daily note hai lần | Dòng bị lặp; `daily:read` tạo note rỗng | Dòng xuất hiện đúng một lần |

## Việc

| ID | Việc | Xong khi |
|---|---|---|
| E7.1 | Chốt 5–8 tình huống và kịch bản (prompt giống hệt nhau cho cả hai lần chạy) | Danh sách trong file này được chốt |
| E7.2 | **Chạy không có skill:** subagent mới, không có skill, chỉ biết tên vault và đường dẫn CLI. Reset bản sao vault trước mỗi lần | Mỗi tình huống có: câu trả lời, số lượt, token, `git diff --stat`, kết quả ground truth |
| E7.3 | **Chạy có skill:** cùng tình huống và cùng cách đo (dùng lại số liệu của RESULTS nếu trùng) | Như trên |
| E7.4 | Bảng so sánh và biểu đồ: token, số lượt, độ chính xác, số sự cố an toàn | `docs/showcase/COMPARISON.md` cùng ảnh biểu đồ |
| E7.5 | **Tư liệu hình ảnh**, chỉ dùng dữ liệu fixture tổng hợp: ảnh Obsidian khi link gãy hoặc có `tên 1.md`, đoạn diff, quay terminal (asciinema hoặc gif) cho trước và sau | Thư mục `docs/showcase/assets/` |
| E7.6 | **Kho "aha moment"**: mỗi phát hiện viết thành một câu hook kèm số liệu, ví dụ "CLI báo Renamed, exit 0, nhưng 9 link đã gãy", "một query tìm kiếm trả về 410 KB", "đếm task: 6.100 token còn 60" | `docs/showcase/STORIES.md` |
| E7.7 | Bản nháp bài viết (dài và ngắn) và kịch bản video 60–90 giây kèm storyboard | `docs/showcase/POST.md`, `VIDEO-SCRIPT.md` |
| E7.8 | **Kiểm tra quyền riêng tư:** không có tên note thật, đường dẫn thật hay tên user trong mọi tư liệu | Grep sạch; user duyệt trước khi đăng |

## Lưu ý
- Chỉ dùng **fixture tổng hợp** (`_agentkit-lab/`) cho ảnh và video. Tình huống S6 cần nội dung thật thì chỉ công bố số liệu, không công bố tên note.
- Lượt chạy không có skill có thể gây thiệt hại trên bản sao vault. Đó là mục đích của diễn tập: chụp lại `git diff` rồi reset.
- Quay video (E7.5 và E7.7) cần user ghi màn hình; agent chuẩn bị kịch bản và dữ liệu.
