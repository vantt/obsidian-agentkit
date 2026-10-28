# E6. Mở rộng cho các plugin: Tasks, Dataview, Templater

**Trạng thái:** Todo, P3 (để sau, user 2026-10-28) · **Board:** [BACKLOG.md](../BACKLOG.md) · **Nguồn:** `docs/distillery/distill.yaml` (in_scope: "Bases queries, JSON Canvas creation, Dataview, Tasks plugin and Templater behaviour as used by agents")

## Vấn đề
v1 mới có Bases, Canvas và clip web (trong `formats.md`). Vault thật có bật Tasks, Dataview và Templater (FINDINGS F11), nhưng skill chưa hướng dẫn cách làm việc với chúng. Ví dụ: agent có thể ghi task thiếu cú pháp ngày của Tasks (`📅 2026-03-15`), viết query Dataview sai, hoặc tạo note từ template Templater mà không chạy được `<% %>`.

## Việc

| ID | Việc | Xong khi |
|---|---|---|
| E6.1 ✅ | Đo: `tasks` của CLI có hiểu emoji ngày, priority và trạng thái tuỳ chỉnh (`[/]`, `[-]`) của plugin Tasks không | Ghi vào FINDINGS (F12); thêm probe |
| E6.2 | Đo: tạo note từ template Templater qua `obs --create template=` có chạy `<% %>` không, hay chỉ chạy được core Templates | Ghi vào FINDINGS; thêm probe |
| E6.3 | Đo: có cách nào lấy kết quả query Dataview không (CLI không có lệnh; `eval` thì bị chặn) | Ghi kết luận vào FINDINGS; nếu không lấy được thì skill hướng dẫn chỉ viết query, không đọc kết quả |
| E6.4 | Viết `references/plugins.md` (≤ 2k token): cú pháp task của Tasks, quy tắc viết query Dataview, giới hạn của Templater qua CLI | `size-check` đạt; SKILL.md có dòng trỏ tới file |
| E6.5 | Thêm fixture và kịch bản test: thêm task có ngày hạn, tạo note từ template Templater | Kịch bản mới có trong `tests/scenarios/README.md` và có kết quả trong RESULTS |
| E6.6 | (Tuỳ chọn) So sánh với một MCP server trên test 6, đã bỏ qua ở v1 | Có số liệu token và số lượt để so sánh với CLI |
