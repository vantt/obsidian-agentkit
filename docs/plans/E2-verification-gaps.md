# E2. Lấp các lỗ hổng kiểm chứng của v1

**Trạng thái:** Doing, 2/6 (E2.2, E2.3 xong 2026-10-28; E2.5, E2.6 bỏ vì E8 đã đo; E2.1 và E2.4 tách a/b ngày 2026-10-28) · **Board:** [BACKLOG.md](../BACKLOG.md) · **Nguồn:** [GATES.md](../GATES.md) cổng 3, [tests/RESULTS.md](../../tests/RESULTS.md)

## Mục tiêu
Kiểm chứng những gì v1 mới giả định hoặc mới test một phần, để có thể dùng skill trên vault thật mà không lo rủi ro ẩn.

## Việc

| ID | Việc | Cần gì | Xong khi |
|---|---|---|---|
| E2.1 | **Case 9 đầy đủ:** chạy case 1 và case 4 bằng agent chạy thẳng trên Windows (Claude Code trong PowerShell) | User mở Claude Code trên Windows, cài skill vào thư mục skills của Windows | Có dòng kết quả trong RESULTS.md với env = Windows native; câu trả lời giống WSL |
| E2.1a ✅ | **Chuẩn bị E2.1:** checklist cài skill trên Windows và hai prompt case 1, 4 | Không cần user | Checklist có trong `tests/`; prompt chạy thử đúng một lần ở WSL trên vault test |
| E2.1b | **Chạy E2.1** trong Claude Code ở PowerShell (user, ~20 phút) | Máy Windows có Claude Code | Như "Xong khi" của E2.1 |
| E2.4a ✅ | **Chuẩn bị E2.4:** lệnh chính xác và test bridge phát hiện lỗi im lặng (exit 2) bằng `fake-obsidian` | Không cần user | Unit test pass; hướng dẫn ngắn |
| E2.4b | **Chạy E2.4** trong PowerShell admin (user, ~5 phút) | PowerShell admin | Như "Xong khi" của E2.4 |
| E2.2 | **Case 10:** sửa hàng loạt trong thư mục Google Drive | User tạo một thư mục test trong Drive và mở thành vault riêng | Sau khi sửa 6 file và đổi tên 1 note: không có bản xung đột mới; ghi kết quả vào RESULTS |
| E2.3 | **Thùng rác trên Google Drive:** `delete` của CLI và `obs --trash` khi vault nằm trên `G:` | Thư mục test của E2.2 | Ghi vào FINDINGS F5: file đi đâu, có khôi phục được không |
| E2.4 | **Terminal quyền admin:** CLI có lỗi im lặng không | User mở PowerShell bằng quyền admin | Ghi vào FINDINGS F1; nếu có lỗi thì bridge phát hiện được (exit 2) |
| E2.5 | **Độ dao động giữa các lần chạy:** chạy lại case 1, 2, 6 và 8b mỗi case 3 lần | Không cần gì thêm (bản sao vault có sẵn) | 3 dòng cho mỗi case trong RESULTS; ghi khoảng dao động của số lượt và token |
| E2.6 | **Đo token chính xác hơn:** tính cả output của grep/cat mà agent tự chạy (lấy từ transcript hoặc usage của subagent) | Script đọc transcript JSONL của subagent | RESULTS có cột token đo từ transcript; mô tả phương pháp đo được cập nhật |

Dòng E2.1 và E2.4 gốc giữ làm mô tả; tiến độ tính theo các dòng a/b.

## Thứ tự đề xuất
E2.5 và E2.6 làm được ngay. E2.1 cần máy Windows có Claude Code. E2.2 và E2.3 làm cùng nhau. E2.4 cuối cùng.

## Rủi ro
E2.2 và E2.3 chạy trên Google Drive thật. Chỉ dùng thư mục test riêng, tuyệt đối không dùng vault thật, và kiểm tra `vault info=path` trước mỗi thao tác ghi.
