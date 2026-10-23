# Bản nháp bài viết (E7.7)

**Trạng thái:** nháp, chờ user duyệt. Không đăng trước khi qua [PRIVACY.md](PRIVACY.md).

- Ảnh đính kèm gợi ý theo thứ tự: [scorecard](assets/charts/scorecard.png), [diff types.json](assets/diffs/s4-types-json-diff.png), [hộp thoại treo](scenarios/S2/without/obsidian-modal-live.png), [biểu đồ sự cố](assets/charts/incidents.png).
- GIF: [s2-rename.gif](assets/terminal/s2-rename.gif) hoặc [s4-types-json.gif](assets/terminal/s4-types-json.gif).

---

## Bản dài (LinkedIn, ~450 chữ)

**Tôi nhờ AI thêm một tag vào một note Obsidian. Nó sửa luôn cấu hình của cả vault, rồi báo "các thuộc tính khác giữ nguyên".**

Obsidian vừa có CLI chính thức, nên agent AI giờ có thể đọc và sửa vault trực tiếp. Tôi muốn biết: chỉ cần đưa cho agent cái CLI là đủ chưa?

Tôi cho cùng một agent làm 8 việc thường ngày trên một bản sao vault (1.845 note): đếm task, đổi tên note, đổi tag, sửa property, xoá note, tìm kiếm, làm việc khi Obsidian tắt, ghi daily note. Mỗi việc chạy hai lần với cùng một câu lệnh:
- một lần agent chỉ biết có CLI;
- một lần agent có thêm skill `obsidian-connect`, gồm hướng dẫn và một lớp bridge nhỏ.

Tôi chấm kết quả bằng `git diff` trên vault, không dựa vào lời agent kể.

Điều bất ngờ đầu tiên: **câu trả lời cuối của cả hai đều đúng ở 7/8 việc.** Model bây giờ rất giỏi.

Điều bất ngờ thứ hai: **đường đi tới câu trả lời đúng mới là chỗ nguy hiểm.** Không có skill, tôi đếm được 6 sự cố:
- `property:set` âm thầm đổi `types.json`, file định nghĩa kiểu property cho cả vault. Nhìn trong Obsidian không thấy gì khác.
- Lệnh đổi tên treo 159 giây chờ một hộp thoại. File đã đổi tên, link thì chưa. Agent tự "giải cứu" bằng cách chạy JavaScript trong app để bấm nút.
- "Xoá vào thùng rác" thực ra là Recycle Bin của Windows, nằm ngoài vault.
- Một lệnh *đọc* daily note lại *tạo* ra note rỗng, và agent tưởng note đó có sẵn.

Có skill: **0 sự cố.** CLI in ra 54 KB thay vì 1,1 MB, tổng thời gian 410 giây thay vì 631 giây.

Nói cho công bằng: skill không làm mọi thứ rẻ hơn. Với câu hỏi đơn giản như "có bao nhiêu task chưa xong?", không có skill còn tốn ít token hơn, vì skill phải đọc hướng dẫn trước. Mỗi phía tôi mới chạy một lượt, và chỉ với một model mạnh.

Bài học của tôi: **khi cho AI quyền ghi vào dữ liệu của mình, đừng chỉ hỏi "nó có trả lời đúng không". Hãy hỏi "nó đã làm gì để có câu trả lời đó".** Phần lớn giá trị của một skill tốt nằm ở việc biết trước công cụ im lặng làm hỏng dữ liệu ở đâu, rồi chặn đúng chỗ đó.

Số liệu, transcript đã che dữ liệu thật, diff và cách chạy lại có trong repo: [link repo]

#Obsidian #AIagents #ClaudeCode #PKM

---

## Bản ngắn (Facebook hoặc X, ~120 chữ)

Nhờ AI thêm 1 tag vào 1 note Obsidian, nó sửa luôn cấu hình của CẢ vault rồi báo "không có gì khác thay đổi". 😬

Tôi cho cùng một agent làm 8 việc trên vault, một lần chỉ có Obsidian CLI, một lần có thêm skill `obsidian-connect`:
- câu trả lời đúng: 7/8 ở cả hai phía;
- sự cố an toàn: **6 → 0**;
- output CLI: **1,1 MB → 54 KB**;
- thời gian: **631 s → 410 s**.

Rủi ro không nằm ở câu trả lời sai. Nó nằm ở cách agent đi tới câu trả lời đúng: treo lệnh, tự bấm hộp thoại bằng JavaScript, xoá ra ngoài vault.

Chi tiết và cách tự chạy lại: [link]

---

## Câu mở đầu thay thế (A/B)
- "Lệnh đọc mà lại tạo file: điều tôi học được khi để AI chạm vào vault Obsidian."
- "AI trả lời đúng 7/8 việc. Vẫn gây 6 sự cố. Đây là lý do."
- "Quên một cặp ngoặc kép: 565 KB thay vì 245 byte."
