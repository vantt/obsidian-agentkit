# E2. Lấp các lỗ hổng kiểm chứng của v1

**Trạng thái:** Todo · **Board:** [BACKLOG.md](../BACKLOG.md) · **Nguồn:** [GATES.md](../GATES.md) cổng 3, [tests/RESULTS.md](../../tests/RESULTS.md)

## Mục tiêu
Kiểm chứng những gì v1 mới giả định hoặc mới test một phần, để có thể dùng skill trên vault thật mà không lo rủi ro ẩn.

## Việc

| ID | Việc | Cần gì | Xong khi |
|---|---|---|---|
| E2.1 | **Case 9 đầy đủ:** chạy case 1 và case 4 bằng agent chạy thẳng trên Windows (Claude Code trong PowerShell) | User mở Claude Code trên Windows, cài skill vào thư mục skills của Windows | Có dòng kết quả trong RESULTS.md với env = Windows native; câu trả lời giống WSL |
| E2.2 | **Case 10:** sửa hàng loạt trong thư mục Google Drive | User tạo một thư mục test trong Drive và mở thành vault riêng | Sau khi sửa 6 file và đổi tên 1 note: không có bản xung đột mới; ghi kết quả vào RESULTS |
| E2.3 | **Thùng rác trên Google Drive:** `delete` của CLI và `obs --trash` khi vault nằm trên `G:` | Thư mục test của E2.2 | Ghi vào FINDINGS F5: file đi đâu, có khôi phục được không |
| E2.4 | **Terminal quyền admin:** CLI có lỗi im lặng không | User mở PowerShell bằng quyền admin | Ghi vào FINDINGS F1; nếu có lỗi thì bridge phát hiện được (exit 2) |
| E2.5 | **Độ dao động giữa các lần chạy:** chạy lại case 1, 2, 6 và 8b mỗi case 3 lần | Không cần gì thêm (bản sao vault có sẵn) | 3 dòng cho mỗi case trong RESULTS; ghi khoảng dao động của số lượt và token |
| E2.6 | **Đo token chính xác hơn:** tính cả output của grep/cat mà agent tự chạy (lấy từ transcript hoặc usage của subagent) | Script đọc transcript JSONL của subagent | RESULTS có cột token đo từ transcript; mô tả phương pháp đo được cập nhật |

## Thứ tự đề xuất
E2.5 và E2.6 làm được ngay. E2.1 cần máy Windows có Claude Code. E2.2 và E2.3 làm cùng nhau. E2.4 cuối cùng.

## Rủi ro
E2.2 và E2.3 chạy trên Google Drive thật. Chỉ dùng thư mục test riêng, tuyệt đối không dùng vault thật, và kiểm tra `vault info=path` trước mỗi thao tác ghi.
