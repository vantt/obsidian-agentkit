# Vì sao phải tự build skill Obsidian

Dựa trên [REPORT.md](REPORT.md) và 37 lesson trong `docs/distillery/lessons/`. Điểm cao nhất của repo có sẵn là 55/100. Mỗi use case dưới đây là một việc bạn cần mà **cả bốn repo đều không làm được hoặc làm sai**.

## 1. Hai chỗ chạy agent: Windows native và WSL, cùng một Obsidian trên Windows

Skill phải chạy được ở **cả hai** cách, không chỉ WSL. Agent chạy trực tiếp trên Windows (PowerShell, Git Bash) là trường hợp chính đáng, vì đó là đường ngắn nhất tới Obsidian.

- **Tình huống A, agent trên Windows:** agent và Obsidian cùng máy. Đường tốt nhất, nhưng có bẫy riêng: `Obsidian.com` phải nằm cạnh `Obsidian.exe`, terminal phải chạy quyền thường (admin thì lỗi im lặng), Git Bash gọi nhầm `.exe` nên lệnh có tham số thoát mã 127.
- **Tình huống B, agent trong WSL2:** `obsidian` không có trong PATH, phải cầu nối sang binary Windows, và đường dẫn vault khác nhau giữa hai phía (`/mnt/c/...` so với `C:\...`).
- **Repo có sẵn:** pablo xử lý một phần tình huống A (Windows `.com` và wrapper Git Bash). Không repo nào nhắc WSL. Kepano chỉ nói "cần mở Obsidian". Không repo nào nói cùng một skill phải thích ứng với cả hai môi trường.
- **Hậu quả nếu dùng nguyên:** ở A, lỗi quyền admin hoặc Git Bash trông như CLI "không có kết quả". Ở B, lệnh đầu tiên fail, agent thử lại hoặc im lặng chuyển sang grep và báo "không có kết quả".
- **Cần tự build:** một preflight nhận ra mình đang ở đâu (Windows native, WSL, hay không có CLI) và chọn đúng cách gọi; wrapper cho WSL; bảng quy đổi đường dẫn; nhãn "kết quả gần đúng" khi phải dùng file. Hành vi sau preflight phải giống nhau ở A và B, để phần còn lại của skill không phải biết mình đang ở đâu.
- Lesson: `windows-com-redirector-and-wrapper`, `preflight-and-fallback-table`.

## 2. Vault đồng bộ qua Google Drive

- **Tình huống:** mọi thay đổi file đều bị Drive đồng bộ. Ghi cả file, xóa, hay sửa hàng loạt có thể tạo bản xung đột hoặc lan lỗi sang máy khác.
- **Repo có sẵn:** không repo nào nhắc Google Drive hay sync bên thứ ba. Pablo ghi rõ đó là non-goal.
- **Hậu quả:** `create overwrite` ghi đè một note mà Drive đã đồng bộ đi. Lệnh `delete` được gọi là "an toàn, vào thùng rác" nhưng chưa ai kiểm thùng rác nằm đâu khi vault trên Drive.
- **Cần tự build:** quy trình snapshot trước thao tác hàng loạt, ngưỡng xác nhận (rename, move, delete, hoặc hơn 5 file), ưu tiên sửa theo dòng thay vì ghi lại cả file.
- Lesson: `append-over-overwrite-guard`, `delete-to-trash-unverified`, `never-without-request-and-confirm`.

## 3. Đổi tên note mà không làm hỏng link

- **Tình huống:** rename hoặc move một note đang được 10 note khác trỏ tới.
- **Repo có sẵn:** kepano nói Obsidian tự cập nhật link khi đổi tên, nhưng chỉ đúng khi đổi tên bên trong Obsidian. Pablo và jackal liệt kê `rename`/`move` mà không nói có cập nhật link không. Không nguồn nào cảnh báo `mv` làm hỏng link.
- **Hậu quả:** link hỏng âm thầm và lan dần. Đây là rủi ro hại nặng nhất trong yardstick.
- **Cần tự build:** quy tắc "rename và move chỉ đi qua CLI", cộng một bài test chứng minh link được cập nhật, rồi mới tin.
- Lesson: `rename-link-update-unstated`.

## 4. Câu hỏi mà CLI trả lời sai nhưng không báo lỗi

- **Tình huống:** hỏi "còn task nào chưa xong?", "tag nào hay dùng nhất?", "ai trỏ tới note này?".
- **Repo có sẵn:** jackal đo thấy 13/57 kịch bản trả kết quả rỗng hoặc sai với mã thoát 0 (ví dụ `tasks todo` chỉ quét file đang mở). Nhưng điều này nằm trong báo cáo, không nằm trong SKILL.md. Kepano và pablo bất đồng về `tasks` trơn. Jackal và pablo bất đồng về `search ... matches`.
- **Hậu quả:** agent kết luận "không có" khi thực tế có, và không ai thấy.
- **Cần tự build:** wrapper luôn truyền scope tường minh (`tasks all`, `tags all`), phân tích stdout tìm `Error:` và kết quả rỗng, vì mã thoát không đáng tin. Danh sách này phải test lại trên bản CLI của bạn, vì số đo cũ là CLI 1.12.1.
- Lesson: `scoped-task-and-tag-queries`, `error-text-exit-zero`, `search-bounded-structured-output`.

## 5. Ghi nhầm note, ghi sai định dạng

- **Tình huống:** "ghi vào daily note", "thêm property `tags`", "tạo note từ template".
- **Repo có sẵn:** nếu không truyền `path=`, CLI ghi vào file đang mở trong Obsidian (kepano nêu nhưng không cảnh báo). `property:set` ghi list thành chuỗi (pablo). `create template=` có thể bỏ qua `path=` (jackal). Không repo nào đọc `app.json`, `daily-notes.json`, `types.json`.
- **Hậu quả:** note nằm sai thư mục, sai định dạng ngày, property đổi kiểu, link sai kiểu `[[ ]]` hay `[]()`.
- **Cần tự build:** vault profile khoảng 30 dòng sinh từ `.obsidian/*.json` (kiểu link, định dạng daily note, tên và kiểu property, thư mục cần loại). Đây là thứ giá trị nhất và repo chung không thể cung cấp.
- Lesson: `file-path-active-target`, `property-set-list-trap`, `create-path-gotchas`, `conventions-ignored-or-hardcoded`.

## 6. Note dài và token

- **Tình huống:** note 3000 dòng, vault 1000+ note, cần sửa một mục hoặc tìm một chủ đề tiếng Việt có dấu.
- **Repo có sẵn:** jackal và pablo có lệnh `outline` nhưng không dạy "outline, rồi đọc đúng khoảng". Không nguồn nào dạy sửa theo section hay đổi tag hàng loạt (có dry-run). Ví dụ của pablo còn lặp `read` qua mọi kết quả không giới hạn. Kích thước skill chênh nhau 4 lần: pablo nặng ~9k token tính cả tham chiếu, kepano nhẹ ~800 cho phần CLI.
- **Hậu quả:** đọc cả note dài, đổ hàng nghìn dòng grep vào context, tốn token đúng thứ bạn muốn tiết kiệm.
- **Cần tự build:** quy tắc "đếm trước (`total`), rồi liệt kê có `limit`", mẫu đọc theo khoảng, và ví dụ nào cũng có giới hạn.
- Lesson: `count-first-total-flag`, `outline-without-ranged-read`, `examples-teach-unbounded-output`, `skill-load-cost-profile`.

## Những gì không cần tự làm

Cú pháp wikilink, callout, embed, Bases, JSON Canvas, và việc lấy nội dung web sạch đã có ở kepano (`obsidian-markdown`, `obsidian-bases`, `json-canvas`, `defuddle`). Nạp theo nhu cầu, không chép vào skill của mình.

## Tóm tắt

| Use case | Có sẵn ở đâu | Phải tự build |
|---|---|---|
| Agent Windows hoặc WSL gọi Obsidian Windows | một phần (pablo, chỉ Windows/Git Bash) | preflight nhận môi trường, wrapper WSL, quy đổi đường dẫn |
| Vault trên Google Drive | không | snapshot, ngưỡng xác nhận |
| Rename giữ link | không (chưa ai kiểm) | quy tắc và bài test |
| Câu trả lời sai im lặng | một phần (jackal, ngoài SKILL.md) | wrapper bắt lỗi và scope |
| Quy ước vault | không | vault profile |
| Đọc/sửa theo khoảng, token | một phần | mẫu đọc, quy tắc giới hạn |
| Cú pháp định dạng, clip web | có (kepano) | mượn |

## Chưa kiểm chứng

Mọi điều trên về hành vi CLI là đọc từ tài liệu, chưa chạy trên máy của bạn. Bước đo sắp tới sẽ xác nhận hoặc bác bỏ: CLI gọi được từ WSL và từ Windows native (PowerShell, Git Bash), `rename` có cập nhật link, `delete` đi đâu trên Drive, hai chỗ mâu thuẫn jackal và pablo.
