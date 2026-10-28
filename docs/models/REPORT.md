# E8 báo cáo: model rẻ có đủ dùng với skill không

**Ngày:** 2026-10-28 · **Dữ liệu:** [vòng 0](ROUND-0.md) (skill v1, 10 model, 434 lượt) và [vòng 1](ROUND-1.md) (skill v2, Haiku và Sonnet, 54 lượt) · **Chấm:** bộ chấm sau E8.5 cho cả hai vòng · **Mốc model mạnh:** Sonnet

## Kết luận

**Có, nếu model nằm trên một ngưỡng tối thiểu.** Khi có skill, các model rẻ trên ngưỡng làm sạch ngang Sonnet, với chi phí bằng 8–17%. Dưới ngưỡng, skill không cứu được. Model rẻ **không** nhanh hơn.

**Khuyến nghị:** dùng `haiku` làm mặc định. Không dùng Claude thì chọn `glm-5.3-flash` hoặc `gpt-6-luna` (bảng cuối trang).

## Bốn giả thuyết

| # | Giả thuyết | Kết quả | Bằng chứng |
|---|---|---|---|
| H1 | Có skill, model rẻ làm đúng ngang model mạnh (0 sự cố, pass ≥ 90%) | **Đạt, trên ngưỡng** | Haiku 22/22 (v1) và 27/27 (v2); `glm-5.3-flash` 22/22; `gemini-3.5-flash-lite` 22/22; `gpt-6-luna` 21/22. Sonnet 22/22 và 27/27. Không đạt: `gpt-oss-20b` (2/22), `gemini-2.5-flash-lite` (1/22), `glm-4.7-flash` (18/22), `deepseek-v4-flash` (6 sự cố) |
| H2 | `$ / lượt sạch` của model rẻ ≤ 25% của model mạnh | **Đạt, trừ Gemini** | So với Sonnet 0,0386: Haiku 8%, `gpt-6-luna` 9%, `glm-5.3-flash` 13%, `deepseek-v4.1-flash` 17%. `gemini-3.5-flash-lite` 58% (nhiều token ra). Vòng 1: Haiku 0,0020 so với Sonnet 0,0190 (11%) |
| H3 | Skill giúp model rẻ nhiều hơn model mạnh | **Đạt, trên ngưỡng** | Mức tăng tỉ lệ lượt sạch khi thêm skill: Sonnet +52 điểm; Haiku +52, `gpt-6-luna` +57, `gemini-3.5-flash-lite` +57, `glm-5.3-flash` +59, `deepseek-v4.1-flash` +68. Dưới ngưỡng skill gần như không giúp (`gemini-2.5-flash-lite` −5, `gpt-oss-20b` +9) |
| H4 | Model rẻ nhanh hơn | **Bác bỏ** | Thời gian trung vị: Sonnet 14 s (v1) và 11 s (v2); Haiku 16 s và 14 s; model qua OpenRouter 34–44 s. Model rẻ dùng nhiều lệnh hơn (Haiku 5–6, Sonnet 3–4) |

Sự cố không skill: mọi model đều gây sự cố, kể cả Sonnet (15 sự cố, 10/21 lượt sạch). Đây là lý do chính để dùng skill, bất kể model.

## Khuyến nghị theo family

Model rẻ nhất đạt H1 của mỗi family. Số vòng 0 chấm lại; Haiku có thêm số vòng 1.

| Family | Model | Lượt sạch | USD / lượt sạch | Ghi chú |
|---|---|---:|---:|---|
| Claude | **`haiku`** (mặc định) | 27/27 (v2) | 0,0020 | Rẻ và nhanh nhất; đã đo với skill v2 |
| OpenAI | `gpt-6-luna` | 21/22 | 0,0035 | Trượt S7 một lần |
| Z.ai | `glm-5.3-flash` | 22/22 | 0,0050 | Giá có thể là khuyến mãi |
| DeepSeek | `deepseek-v4.1-flash` | 20/22 | 0,0067 | 2 sự cố đều là đọc file đáp án cũ trong vault, lỗi của harness đã sửa ở E8.12; không làm hỏng dữ liệu. Chưa chạy lại |
| Google | `gemini-3.5-flash-lite` | 22/22 | 0,0222 | Sạch nhưng đắt gấp ~7 lần Haiku |

Model không phải Claude mới đo với skill v1. Skill v2 rẻ hơn 37–51% trên Claude; với các model này chưa đo (E8.13, P3).

## Giới hạn

- 2 lượt cho S5–S9 ở vòng 0: 0 sự cố trên 22 lượt vẫn cho phép tỉ lệ sự cố thật tới khoảng 13% (cận trên 95%).
- Một harness (Claude Code), một vault tổng hợp ~1.800 note, Obsidian CLI 1.14.4 (vòng 0) và 1.15.0 (vòng 1).
- USD của Claude tính bằng token × giá niêm yết (chạy bằng gói); USD của OpenRouter là số thật.

## Chạy lại

Cách chạy, chấm và đọc kết quả: [`tests/models/README.md`](../../tests/models/README.md).
