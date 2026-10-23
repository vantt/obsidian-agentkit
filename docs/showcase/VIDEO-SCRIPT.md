# Kịch bản video 60–90 giây (E7.7)

**Trạng thái:** nháp, chờ user duyệt và ghi hình.

- **Định dạng:** dọc 9:16 (Reels, Shorts, TikTok) hoặc ngang 16:9 (LinkedIn). Cảnh terminal có sẵn dạng MP4 ngang 1560×620, khi dựng bản dọc thì cắt hoặc thu nhỏ.
- **Tư liệu đã có (fixture tổng hợp, không có dữ liệu thật):**
  - terminal: [`assets/terminal/*.mp4`](assets/terminal/), quay lại được bằng `vhs <tape>`;
  - ảnh Obsidian: [`assets/obsidian/`](assets/obsidian/);
  - biểu đồ: [`assets/charts/`](assets/charts/);
  - diff: [`assets/diffs/`](assets/diffs/).
- **User cần làm:**
  - ghi màn hình cảnh 3 (Obsidian thật, hộp thoại hiện lên), nếu muốn thay ảnh tĩnh;
  - thu giọng đọc;
  - duyệt [PRIVACY.md](PRIVACY.md).

## Storyboard

| # | Giây | Hình | Lời (voice-over) | Chữ trên màn hình |
|---|---|---|---|---|
| 1 | 0–5 | Scorecard ([scorecard.png](assets/charts/scorecard.png)), zoom vào ô "6 → 0" | "Tôi cho cùng một AI làm 8 việc trên vault Obsidian, có và không có skill." | **6 sự cố → 0** |
| 2 | 5–17 | [s4-types-json.mp4](assets/terminal/s4-types-json.mp4) phần đầu: `property:set`, rồi `git diff --stat` hiện `types.json` | "Thêm một tag vào MỘT note. Nhìn diff: file cấu hình của CẢ vault cũng bị sửa." | `types.json`: tags → multitext |
| 3 | 17–22 | [properties-before.png](assets/obsidian/properties-before.png) đặt cạnh [properties-after.png](assets/obsidian/properties-after.png) | "Trong Obsidian, nhìn không thấy gì sai. Agent báo: các thuộc tính khác giữ nguyên." | "Không có gì thay đổi" ❌ |
| 4 | 22–36 | [s2-rename.mp4](assets/terminal/s2-rename.mp4): lệnh treo, rồi `exit=124`, `git status` đã đổi tên. Chèn [obsidian-modal-live.png](scenarios/S2/without/obsidian-modal-live.png) | "Đổi tên một note. Lệnh treo, chờ hộp thoại này. File đã đổi tên, còn chín link thì gãy." | Treo **159 giây** · 9 link gãy |
| 5 | 36–42 | [links-before.png](assets/obsidian/links-before.png) chuyển sang [links-broken.png](assets/obsidian/links-broken.png) | "Link chuyển màu xám: trỏ vào một note không còn tồn tại." | 87 → 89 unresolved |
| 6 | 42–50 | [s8-daily-read.mp4](assets/terminal/s8-daily-read.mp4): `ls` báo không có file, `daily:read`, `ls` thấy 0 byte | "Lệnh *đọc* daily note lại *tạo* ra một note rỗng." | read → **tạo file** |
| 7 | 50–58 | [s6-search-size.mp4](assets/terminal/s6-search-size.mp4) | "Quên một cặp ngoặc kép khi tìm: 565 nghìn byte. Có ngoặc kép: 245 byte." | **565 KB vs 245 B** |
| 8 | 58–70 | Phần "CÓ skill" của s2 và s4: `exit=7` kèm lời giải thích | "Có skill, cùng một AI dừng đúng chỗ, giải thích, và không đụng vào file nào." | exit 7 · 0 file đổi |
| 9 | 70–80 | [incidents.png](assets/charts/incidents.png), rồi [cli-output.png](assets/charts/cli-output.png) | "Câu trả lời cuối đúng như nhau ở 7 trên 8 việc. Khác biệt nằm ở đường đi: 6 sự cố so với 0, 1,1 MB output so với 54 KB." | 7/8 đúng · 6 → 0 |
| 10 | 80–90 | Logo hoặc tên repo, link | "Đừng chỉ hỏi AI có trả lời đúng không. Hãy hỏi nó đã làm gì để có câu trả lời đó." | Repo: [link] |

## Ghi chú dựng
- **Nhịp:** mỗi cảnh terminal cắt còn khoảng 5–8 giây quanh khoảnh khắc chính. Có thể tua nhanh x2 đoạn gõ lệnh. Cảnh 4 giữ đủ lâu để thấy con trỏ đứng yên.
- **Nhãn hai phía:** dùng màu cam (#eb6834) cho "không có skill" và xanh (#2a78d6) cho "có skill", trùng màu biểu đồ.
- **Không dùng** ảnh chụp cả cửa sổ Obsidian: cây thư mục bên trái hiện tên note thật. Mọi ảnh trong `assets/obsidian/` đã cắt sát vào một phần tử.
- **Nếu ghi màn hình lại cảnh 4:**
  1. Chạy `tests/showcase/demo-reset.sh links-off`.
  2. Gõ lệnh `rename` trong terminal, để hộp thoại hiện trong Obsidian.
  3. Thu gọn sidebar trái trước khi quay.
  4. Xong thì chạy `tests/showcase/demo-reset.sh`.
- **Câu kết thay thế:** "Skill tốt không làm AI thông minh hơn. Nó biết trước công cụ im lặng làm hỏng dữ liệu ở đâu."
