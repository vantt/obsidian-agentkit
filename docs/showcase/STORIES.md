# Kho "aha moment" (E7.6)

Mỗi mục có ba phần:
- một câu **hook** dùng được ngay;
- **số liệu**;
- **bằng chứng** để người đọc tự kiểm.

Mọi con số lấy từ lượt diễn tập ngày 2026-10-22 (Obsidian CLI 1.14.4). Đọc phần "Hạn chế" trong [COMPARISON.md](COMPARISON.md) trước khi đăng.

Mức độ mạnh của hook: ★★★ rất tương phản, ★★ tốt, ★ phụ.

---

## 1. ★★★ Hỏng cấu hình cả vault, và agent nói "không có gì khác thay đổi"
> **Nhờ AI thêm một tag vào MỘT note. Nó sửa luôn file cấu hình của CẢ vault, rồi báo "các thuộc tính khác giữ nguyên".**

- **Không có skill:** agent chạy `property:set type=list` và `type=number`.
  - Note đúng.
  - `.obsidian/types.json` bị đổi: `"tags": "tags"` thành `"tags": "multitext"`, thêm `"rating": "number"`.
  - Trong Obsidian nhìn không thấy gì khác: ảnh properties trước và sau gần như giống hệt.
- **Có skill:** sửa đúng 2 dòng frontmatter, `types.json` không đổi.
- **Bằng chứng:**
  - [ảnh diff](assets/diffs/s4-types-json-diff.png), [lab.diff](scenarios/S4/without/lab.diff);
  - [properties trước](assets/obsidian/properties-before.png), [properties sau](assets/obsidian/properties-after.png);
  - [quay terminal](assets/terminal/s4-types-json.gif);
  - câu trả lời của agent: [answer.txt](scenarios/S4/without/answer.txt).

## 2. ★★★ CLI đổi tên file rồi đứng chờ một cú click
> **Agent gõ lệnh đổi tên. File đổi tên ngay, còn lệnh thì treo 159 giây chờ một hộp thoại không ai thấy.**

- **Không có skill:**
  - Lệnh `rename` không trả về trong 158.834 ms.
  - Trong lúc đó file đã mang tên mới, còn 9 link vẫn trỏ tên cũ.
  - Agent tự chạy JavaScript trong app (`eval`) để bấm nút "Just once".
  - Nếu là người bấm "Do not update": `unresolved` tăng từ 87 lên 89, tức 9 link gãy.
- **Có skill:** bridge từ chối ngay (exit 7), không file nào bị đụng. Agent giải thích và chỉ cách bật lại tuỳ chọn. Hết 26 giây, so với 228 giây.
- **Bằng chứng:**
  - [ảnh hộp thoại lúc agent đang chạy](scenarios/S2/without/obsidian-modal-live.png);
  - [link trước](assets/obsidian/links-before.png), [link sau khi gãy](assets/obsidian/links-broken.png);
  - [quay terminal](assets/terminal/s2-rename.gif), [cli-calls.txt](scenarios/S2/without/cli-calls.txt), [transcript](scenarios/S2/without/transcript.md).

## 3. ★★★ Lệnh "đọc" mà tạo file
> **Agent "đọc thử" daily note hôm nay. Lệnh đọc vừa tạo ra một note rỗng, và agent tưởng note đó đã có sẵn.**

- **Không có skill:**
  - `daily:read` không in gì và tạo `2026-10-23.md` 0 byte.
  - Agent báo: "file đã có sẵn nhưng trống".
  - Sau đó nó ghi đè cả file bằng `create … overwrite` để bỏ một dòng trống.
- **Có skill:** dùng `daily:path` và kiểm tra bằng file, không tạo gì trước khi ghi.
- **Bằng chứng:** [quay terminal](assets/terminal/s8-daily-read.gif), [cli-calls.txt](scenarios/S8/without/cli-calls.txt), [transcript](scenarios/S8/without/transcript.md).

## 4. ★★ "Thùng rác" nào?
> **"Đã chuyển vào thùng rác, vẫn khôi phục được." Đúng, nhưng là Recycle Bin của Windows, ngoài vault. Với vault trên Google Drive thì chưa ai kiểm chứng điều đó.**

- **Không có skill:** `delete` cho ra "Moved to trash". Recycle Bin của Windows có thêm 1 mục, vault không có `.trash/`.
- **Có skill:** note vào `<vault>/.trash/`, đi cùng vault và cùng cơ chế đồng bộ. Bridge báo "9 backlinks now unresolved".
- **Bằng chứng:** [quay terminal](assets/terminal/s5-delete.gif), [check không skill](scenarios/S5/without/check.json), [check có skill](scenarios/S5/with/check.json).

## 5. ★★ Quên một cặp ngoặc kép: 565 KB thay vì 245 byte
> **Tìm cụm 2 từ mà quên ngoặc kép: Obsidian CLI trả về 565.479 byte. Có ngoặc kép: 245 byte. Gấp 2.300 lần.**

- Đo trên fixture: `search:context query=Section A` so với `query='"Section A"'`.
- Trên nội dung thật (S6, tìm "Đà Nẵng"):
  - không có skill: 41 lệnh CLI, CLI in ra 149 KB, một lệnh 64 KB, ngữ cảnh tăng 27.911 token;
  - có skill: 13 lệnh, 3,8 KB, 8.746 token;
  - hai phía chọn ra cùng 3 note.
- **Bằng chứng:** [quay terminal](assets/terminal/s6-search-size.gif), [S6 không skill](scenarios/S6/without/cli-by-command.json), [S6 có skill](scenarios/S6/with/cli-by-command.json).

## 6. ★★ Một file trùng tên lặng lẽ
> **Tạo note ở đường dẫn đã có: CLI không báo lỗi, chỉ lặng lẽ sinh thêm `ref-wikilink 1.md`.**

- Lệnh `create path=…/ref-wikilink.md` cho ra `Created: _agentkit-lab/refs/ref-wikilink 1.md`, exit 0. Bridge của skill từ chối đường dẫn đã tồn tại.
- Không xảy ra trong 8 tình huống diễn tập. Đây là bẫy đo riêng (FINDINGS F9c), đưa vào làm tư liệu hình ảnh.
- **Bằng chứng:** [ảnh file explorer](assets/obsidian/duplicate-file-explorer.png), [output](assets/obsidian/create-duplicate.txt).

## 7. ★★ Tổng kết bằng một dòng
> **8 việc, cùng một agent: 6 sự cố an toàn còn 0, CLI in ra 1,1 MB còn 54 KB, 631 giây còn 410 giây.**

- **Bằng chứng:** [scorecard](assets/charts/scorecard.png), [totals.json](data/totals.json).

## 8. ★ Câu chuyện trung thực: không phải lúc nào skill cũng rẻ hơn
> **Hỏi "có bao nhiêu task chưa xong?": không có skill vẫn đúng 114, và còn rẻ hơn (4.409 token so với 6.577), vì skill tốn ~1.700 token chỉ để đọc hướng dẫn.**

- Dùng mục này để bài viết đáng tin hơn. Skill không làm agent thông minh hơn. Nó biết trước những chỗ CLI im lặng làm hỏng dữ liệu.
- Con số cũ "6.100 token còn 60" so sánh skill trước và sau khi sửa (RESULTS.md, case 4), **không phải** có skill với không có skill. Đừng dùng nó như một phép so sánh có/không skill.
- **Bằng chứng:** [COMPARISON.md](COMPARISON.md), mục "Kết luận ngắn".

## 9. ★ Model giỏi tự cứu, nhưng bằng cách nào?
> **Không có skill, agent vẫn đạt mục tiêu ở 7/8 việc. Vấn đề là cách nó đạt: tự bấm hộp thoại bằng JavaScript, ghi đè cả file, xoá ra ngoài vault.**

- Dùng làm luận điểm chính: rủi ro không nằm ở câu trả lời sai mà ở **đường đi** tới câu trả lời đúng.
- **Bằng chứng:** [verdicts.json](../../tests/showcase/verdicts.json).
