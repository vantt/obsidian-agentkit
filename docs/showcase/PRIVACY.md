# Kiểm tra quyền riêng tư trước khi đăng (E7.8)

**Phần của agent:** xong, quét sạch ngày 2026-10-22.
**Phần của user:** đã duyệt ngày 2026-10-23. Chưa đăng bất cứ thứ gì.

## Lệnh quét

```bash
node tests/showcase/privacy-scan.mjs
```

Kết quả lần cuối: `clean: no real names, user name, home path or email` (exit 0).

## Script quét gì
Phạm vi: `docs/showcase/` và `tests/showcase/`.
- **Tên note và thư mục thật:**
  - tên nhiều từ, hoặc dài từ 10 ký tự, khớp nguyên từ;
  - bất kỳ `<tên>.md` nào trùng một note thật, dù ngắn (ví dụ tên note theo ngày);
  - danh sách lấy từ bản sao vault bởi `names.mjs` và nằm ở `tests/out/`, đã gitignore.
- **Tên user:**
  - tên user Windows;
  - tên đăng nhập Linux, kể cả trong đường dẫn scratchpad và output `ls -l`;
  - thư mục home;
  - email.
- **Đường dẫn Windows ngoài thư mục test**, ví dụ danh sách vault khác trong `obsidian.json` hay thư mục Google Drive.
- **Dòng task** không thuộc fixture.

## Đã che bằng `redact.mjs` khi xuất bản
- Dòng nhắc tới note thật được thay bằng `[ẩn: dòng nhắc tới note thật]`.
- Task trong note thật được thay bằng `[ẩn: task trong note thật]`.
- Đường dẫn ngoài thư mục test được thay bằng `[ẩn: đường dẫn ngoài thư mục test]`. Trường hợp này xuất hiện 3 lần: cả hai agent ở S7 đã đọc `obsidian.json` để tìm đường dẫn vault.
- Tên user và đường dẫn home được thay bằng `<user>`, `/home/<user>`.

## Quyết định về nội dung
- **S6** (tìm "Đà Nẵng") chạy trên note thật.
  - Chỉ công bố `metrics.json`, `check.json`, `baseline.json` và `cli-by-command.json`: số lệnh và byte theo loại lệnh.
  - Không có transcript, câu trả lời hay tham số lệnh. Bản đầy đủ chỉ nằm trong `tests/out/showcase/` (gitignored).
- **Ảnh Obsidian:**
  - Chỉ chụp một phần tử (hộp thoại, vùng soạn thảo, panel properties, một thư mục con của fixture) bằng `shot.mjs`.
  - Không chụp cả cửa sổ, vì cây thư mục bên trái hiện tên note thật.
- **Quay terminal:** chỉ thao tác trên `_agentkit-lab/`. Prompt là `$ `, các bước reset chạy ẩn.
- **Giữ lại** vì không định danh: tên thư mục chung (`Evernote`, `Clippings`, `Excalidraw`), chủ đề tìm kiếm "Đà Nẵng", đường dẫn bản sao `C:\obsidian-agentkit-test\vault-copy`.

## User duyệt (2026-10-23)
- [x] Xem lướt `scenarios/*/without/transcript.md`. Đây là chỗ agent không có skill chạy lệnh rộng nhất (`ls` gốc vault, `files`, `search`).
- [x] Xem các ảnh trong `assets/obsidian/` và GIF trong `assets/terminal/`.
- [x] Chấp nhận việc giữ tên thư mục chung (`Evernote`, `Clippings`, `Excalidraw`) trong transcript.
- [x] Chấp nhận nêu chủ đề "Đà Nẵng" và các số liệu của S6 trong bài viết.
- [ ] Điền link repo vào `POST.md` và `VIDEO-SCRIPT.md`, hoặc bỏ đi nếu repo không công khai. Làm lúc đăng, không chặn E7.8.
