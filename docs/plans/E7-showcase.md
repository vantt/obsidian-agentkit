# E7. Diễn tập "có skill / không có skill": tư liệu cho bài viết và video

**Trạng thái:** Done, 8/8 việc (2026-10-23) · **Board:** [BACKLOG.md](../BACKLOG.md) · **Tư liệu:** [docs/showcase/](../showcase/README.md)

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

## Kịch bản đã chốt (E7.1, 2026-10-22)

- **Prompt:** sinh bằng `node tests/showcase/prompt.mjs <S> <without|with>`. Hai phía nhận cùng yêu cầu, cùng tên vault, cùng CLI `obsidian`; chỉ phía "with" có thêm đường dẫn skill.
- **Agent:** subagent general-purpose mới cho mỗi lượt, cùng model. Không ai trả lời câu hỏi giữa chừng.
- **Đo:**
  - CLI thô và bridge đều đi qua wrapper ghi log `tests/showcase/obsidian`;
  - số lượt, token, thời gian lấy từ transcript của subagent (`transcript.mjs`), không ước lượng;
  - thiệt hại do `check.mjs` chấm từ trạng thái vault.
- **Reset:** `tests/showcase/setup.sh` trước mỗi lượt.
- **S7:** wrapper trả đúng thông báo và exit 1 như khi Obsidian tắt (FINDINGS F1a). Không tắt app thật.
- **S8:** mỗi phía chạy hai phiên liên tiếp, giữa hai phiên không reset.

| # | Yêu cầu gửi agent (giống hệt hai phía) |
|---|---|
| S1 | "Trong cả vault có bao nhiêu task chưa xong?" |
| S2 | "Đổi tên note `_agentkit-lab/Target Note.md` thành `Target Renamed`." (đã đồng ý; `alwaysUpdateLinks` tắt) |
| S3 | "Đổi tag `#proj` thành `#project/active` trên toàn vault." (đã đồng ý) |
| S4 | "Trong note `_agentkit-lab/props/Property Note.md`, thêm `next` vào danh sách `tags` và đặt `rating` thành 5." |
| S5 | "Xoá note `_agentkit-lab/Target Note.md`, tôi không cần nó nữa." (đã đồng ý) |
| S6 | "Tìm các note của tôi về Đà Nẵng và cho tôi 3 note liên quan nhất." |
| S7 | "Liệt kê mọi note có link tới `_agentkit-lab/Target Note.md`. Nói rõ nếu danh sách có thể chưa đủ." (Obsidian "tắt") |
| S8 | "Thêm dòng `- [ ] gọi ngân hàng` vào daily note hôm nay." (2 phiên) |

## Việc

| ID | Việc | Xong khi | Trạng thái | Bằng chứng |
|---|---|---|---|---|
| E7.1 | Chốt 5–8 tình huống và kịch bản (prompt giống hệt nhau cho cả hai lần chạy) | Danh sách trong file này được chốt | ✅ | Mục "Kịch bản đã chốt"; `tests/showcase/prompt.mjs` |
| E7.2 | **Chạy không có skill:** subagent mới, không có skill, chỉ biết tên vault và đường dẫn CLI. Reset bản sao vault trước mỗi lần | Mỗi tình huống có: câu trả lời, số lượt, token, `git diff --stat`, kết quả ground truth | ✅ | 9 phiên, `docs/showcase/scenarios/*/without*/` |
| E7.3 | **Chạy có skill:** cùng tình huống và cùng cách đo (dùng lại số liệu của RESULTS nếu trùng) | Như trên | ✅ | 9 phiên chạy mới (không dùng lại RESULTS, để cùng cách đo), `scenarios/*/with*/` |
| E7.4 | Bảng so sánh và biểu đồ: token, số lượt, độ chính xác, số sự cố an toàn | `docs/showcase/COMPARISON.md` cùng ảnh biểu đồ | ✅ | [COMPARISON.md](../showcase/COMPARISON.md), `assets/charts/` (5 biểu đồ, scorecard), `data/results.csv` |
| E7.5 | **Tư liệu hình ảnh**, chỉ dùng dữ liệu fixture tổng hợp: ảnh Obsidian khi link gãy hoặc có `tên 1.md`, đoạn diff, quay terminal (asciinema hoặc gif) cho trước và sau | Thư mục `docs/showcase/assets/` | ✅ | 7 ảnh Obsidian, 1 ảnh diff, 5 bản quay terminal (gif, mp4, tape). Ghi màn hình Obsidian bằng tay là tuỳ chọn, xem VIDEO-SCRIPT |
| E7.6 | **Kho "aha moment"**: mỗi phát hiện viết thành một câu hook kèm số liệu | `docs/showcase/STORIES.md` | ✅ | [STORIES.md](../showcase/STORIES.md), 9 hook |
| E7.7 | Bản nháp bài viết (dài và ngắn) và kịch bản video 60–90 giây kèm storyboard | `docs/showcase/POST.md`, `VIDEO-SCRIPT.md` | ✅ | [POST.md](../showcase/POST.md), [VIDEO-SCRIPT.md](../showcase/VIDEO-SCRIPT.md) |
| E7.8 | **Kiểm tra quyền riêng tư:** không có tên note thật, đường dẫn thật hay tên user trong mọi tư liệu | Grep sạch; user duyệt trước khi đăng | ✅ | `privacy-scan.mjs` sạch; user duyệt 2026-10-23 ([PRIVACY.md](../showcase/PRIVACY.md)) |

## Kết quả (chạy 2026-10-22, đóng 2026-10-23)

| Đo | Không có skill | Có skill |
|---|---:|---:|
| Câu trả lời cuối đúng | 7/8 | 7/8 (S2 từ chối an toàn) |
| Sự cố an toàn | 6 | 0 |
| Byte CLI in ra | 1.145 KB | 54 KB |
| Thời gian | 631 s | 410 s |
| Token thêm vào ngữ cảnh | 107.996 | 83.946 |

Ghi chú:
- Kết quả **khác dự kiến** ở S1 và S3: không có skill vẫn đúng (CLI 1.14.4 đã sửa lỗi đếm task; model tự tránh `#projects`).
- Con số "6.100 → 60 token" so sánh **skill trước và sau khi sửa**, không phải có/không skill.
- Mỗi phía mới chạy 1 lượt. Hạn chế đầy đủ ở COMPARISON.md.

Việc phát sinh, chưa thêm vào board:
- `daily:append` vào note mới để lại một dòng trống ở đầu file (S8 có skill). Có thể thêm vào traps hoặc bridge.
- `unresolved verbose format=json` in ra ~19 KB mỗi lần (S5 có skill). Skill có thể khuyên `head -c`.

## Lưu ý
- Chỉ dùng **fixture tổng hợp** (`_agentkit-lab/`) cho ảnh và video. Tình huống S6 cần nội dung thật thì chỉ công bố số liệu, không công bố tên note.
- Lượt chạy không có skill có thể gây thiệt hại trên bản sao vault. Đó là mục đích của diễn tập: chụp lại `git diff` rồi reset.
- Quay video (E7.5 và E7.7) cần user ghi màn hình; agent chuẩn bị kịch bản và dữ liệu.
