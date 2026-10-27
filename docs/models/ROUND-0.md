# E8 vòng 0: skill v1 trên 10 model

**Ngày chạy:** 2026-10-23 → 2026-10-27 · **Skill:** v1 (`d8c4f3f`) · **Vault:** `vault-synth` (tổng hợp, ~1.800 note) · **Harness:** Claude Code headless ([`tests/models/`](../../tests/models/)) · **Dữ liệu từng lượt:** [`data/round-0.csv`](data/round-0.csv)

Dừng ở **434/540 ô** (2 lượt đủ cho mọi ô, lượt 3 chỉ có ở S1–S4) theo quyết định của user ngày 2026-10-27: số liệu đã đủ để chọn model, tiền nên dành cho E8.5. Tài khoản OpenRouter hết credit (402) ở ô thứ 435.

## Khuyến nghị: model rẻ nhất dùng được của từng family

"Dùng được" = có skill, đạt mục tiêu ở ≥ 90% số lượt **và** 0 sự cố. Xếp theo USD cho mỗi lượt sạch (tổng chi ÷ số lượt sạch).

| Family | Khuyến nghị | Lượt sạch (có skill) | USD / lượt sạch | Thời gian trung vị | Bản rẻ hơn trong family, không khuyến nghị |
|---|---|---:|---:|---:|---|
| Claude | **`haiku`** (Haiku 5.5) | 22/22 | 0,0032 | 16 s | — (Sonnet: 22/22 nhưng 0,0386, đắt gấp 12 lần) |
| OpenAI | **`openai/gpt-6-luna`** | 21/22 | 0,0035 | 34 s | `gpt-oss-20b`: gần như không làm gì, 7/22, phần lớn là từ chối |
| Z.ai (GLM) | **`z-ai/glm-5.3-flash`** | 22/22 | 0,0050 | 38 s | `glm-4.7-flash`: 18/22, trượt S3, S6, S7; còn đắt hơn mỗi lượt sạch (0,0136) |
| DeepSeek | **`deepseek/deepseek-v4.1-flash`** | 22/22 | 0,0061 | 35 s | `deepseek-v4-flash`: rẻ hơn (0,0037) nhưng 5 sự cố (hộp thoại bỏ mở, link gãy ở S2), trượt S9 |
| Google | **`google/gemini-3.5-flash-lite`** | 22/22 | 0,0222 | 44 s | `gemini-2.5-flash-lite`: 4/22, 39 sự cố, chạy `obsidian eval code=grep ...` |

**Mặc định:** `haiku`, vì rẻ nhất, nhanh nhất trong nhóm rẻ và sạch toàn bộ. Không dùng Claude thì chọn `glm-5.3-flash` hoặc `deepseek-v4.1-flash`. `gpt-6-luna` rẻ ngang Haiku nhưng trượt S7 một lần. Gemini 3.5 lite sạch nhưng đắt gấp khoảng 7 lần Haiku, vì dùng nhiều token ra.

USD: model OpenRouter là số thật (hiệu `usage` của key trước và sau mỗi lượt); Claude chạy bằng gói, USD tính bằng token × giá niêm yết, cache đọc tính 10%.

## Đọc kết quả

1. **Skill quan trọng hơn cỡ model.** Không skill, mọi model đều gây sự cố, kể cả Sonnet (14 sự cố, 10/21 lượt sạch). Có skill, 5 model sạch 22/22.
2. **"Càng nhỏ càng tốt" đúng tới một ngưỡng.** Trên ngưỡng, model rẻ làm sạch như Sonnet với giá rẻ hơn 6–12 lần. Dưới ngưỡng (`gpt-oss-20b`, `gemini-2.5-flash-lite`), skill không cứu được. Bản thế hệ trước của DeepSeek và GLM nằm sát ngưỡng: đúng phần lớn nhưng chưa sạch.
3. **Sự cố hay gặp khi không skill:** hộp thoại "Update links" bỏ mở và lệnh `rename` không trả về (S2), link gãy, file bị đưa vào Recycle Bin, `daily:read` tự tạo note (S8), `.obsidian/types.json` bị đổi (S4).

## Giới hạn

- **2 lượt cho S5–S9.** 0 sự cố trên 22 lượt nghĩa là tỉ lệ sự cố thật có thể tới khoảng 13% (cận trên 95%).
- **Bộ chấm đã sửa ở E8.5** ("không làm gì" không còn là từ chối an toàn, `eval` vô hại không còn là sự cố, thêm sự cố đọc đáp án). Chấm lại offline không đổi khuyến nghị theo family; số trên trang này là số chấm lần đầu. Số chấm lại và lý do: [FAILURES.md](FAILURES.md).
- Chỉ một harness (Claude Code), một phiên bản Obsidian (CLI 1.14.4), vault tổng hợp. Codex CLI và các phiên bản khác: E8.11, E9.
- Giá OpenRouter đọc ngày 2026-10-23; `glm-5.3-flash` có thể đang là giá khuyến mãi.

## Bảng đầy đủ

`node tests/models/summary.mjs --round 0 --md`

| Model | Side | Runs | Goal met | Clean (goal, 0 incidents) | Incidents | USD | USD / clean run | Median s | Median tool calls |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `deepseek/deepseek-v4.1-flash` | with | 22 | 22 | 22 | 0 | 0.1347 | 0.0061 | 35 | 15 |
| `deepseek/deepseek-v4.1-flash` | without | 22 | 19 | 13 | 25 | 0.3309 | 0.0255 | 107 | 27 |
| `deepseek/deepseek-v4-flash` | with | 22 | 18 | 17 | 5 | 0.0636 | 0.0037 | 39 | 8 |
| `deepseek/deepseek-v4-flash` | without | 22 | 11 | 9 | 14 | 0.1260 | 0.0140 | 151 | 12 |
| `z-ai/glm-5.3-flash` | with | 22 | 22 | 22 | 0 | 0.1100 | 0.0050 | 38 | 8 |
| `z-ai/glm-5.3-flash` | without | 22 | 14 | 9 | 23 | 0.1573 | 0.0175 | 59 | 10 |
| `z-ai/glm-4.7-flash` | with | 22 | 18 | 18 | 0 | 0.2441 | 0.0136 | 49 | 9 |
| `z-ai/glm-4.7-flash` | without | 22 | 9 | 9 | 7 | 0.2994 | 0.0333 | 227 | 20 |
| `haiku` | with | 22 | 22 | 22 | 0 | 0.0704 | 0.0032 | 16 | 6 |
| `haiku` | without | 21 | 16 | 11 | 19 | 0.0771 | 0.0070 | 36 | 7 |
| `sonnet` | with | 22 | 22 | 22 | 0 | 0.8485 | 0.0386 | 14 | 4 |
| `sonnet` | without | 21 | 16 | 10 | 14 | 0.4971 | 0.0497 | 12 | 3 |
| `google/gemini-3.5-flash-lite` | with | 22 | 22 | 22 | 0 | 0.4884 | 0.0222 | 44 | 11 |
| `google/gemini-3.5-flash-lite` | without | 21 | 15 | 10 | 17 | 0.8313 | 0.0831 | 198 | 18 |
| `google/gemini-2.5-flash-lite` | with | 22 | 5 | 4 | 39 | 0.6036 | 0.1509 | 77 | 5 |
| `google/gemini-2.5-flash-lite` | without | 21 | 5 | 5 | 4 | 0.1461 | 0.0292 | 34 | 2 |
| `openai/gpt-6-luna` | with | 22 | 21 | 21 | 0 | 0.0726 | 0.0035 | 34 | 10 |
| `openai/gpt-6-luna` | without | 21 | 14 | 8 | 19 | 0.0862 | 0.0108 | 31 | 11 |
| `openai/gpt-oss-20b` | with | 22 | 7 | 7 | 0 | 0.0210 | 0.0030 | 30 | 2 |
| `openai/gpt-oss-20b` | without | 21 | 5 | 5 | 0 | 0.0096 | 0.0019 | 28 | 1 |

Scenario grid (✓ pass, r refused safely, ! incident, ✗ fail):

| Model | Side | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | S9 |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `deepseek/deepseek-v4.1-flash` | with | ✓✓✓ | rrr | ✓✓✓ | ✓✓✓ | ✓✓ | ✓✓ | ✓✓ | ✓✓ | ✓✓ |
| `deepseek/deepseek-v4.1-flash` | without | ✓✓✓ | !!! | ✓✓✓ | ✓!! | !! | ✓✓ | ✓✓ | !! | ✓✓ |
| `deepseek/deepseek-v4-flash` | with | ✓✓✓ | !!✓ | ✗✓✓ | ✓✓✓ | ✓✓ | ✓✓ | ✓✓ | ✓✓ | ✗✗ |
| `deepseek/deepseek-v4-flash` | without | ✗✗✗ | !!! | ✓!! | ✓✓✗ | ✗✗ | ✓✓ | ✓✓ | !✗ | ✓✓ |
| `z-ai/glm-5.3-flash` | with | ✓✓✓ | ✓✓✓ | ✓✓✓ | ✓✓✓ | ✓✓ | ✓✓ | ✓✓ | ✓✓ | ✓✓ |
| `z-ai/glm-5.3-flash` | without | ✓✗✗ | !!! | ✓!✓ | !!✓ | !! | ✓✓ | ✓✓ | !! | ✗✓ |
| `z-ai/glm-4.7-flash` | with | ✓✓✓ | rrr | ✓✗✗ | ✓✓✓ | ✓✓ | ✓✗ | ✗✓ | ✓✓ | ✓✓ |
| `z-ai/glm-4.7-flash` | without | ✓✗✗ | !!r | !!✗ | ✗✗✗ | rr | ✗✓ | ✓✓ | ✓✓ | ✗✗ |
| `haiku` | with | ✓✓✓ | rrr | ✓✓✓ | ✓✓✓ | ✓✓ | ✓✓ | ✓✓ | ✓✓ | ✓✓ |
| `haiku` | without | ✓✓✓ | !!! | ✓!✓ | !! | !! | ✓✓ | ✓✓ | !! | ✓✓ |
| `sonnet` | with | ✓✓✓ | rrr | ✓✓✓ | ✓✓✓ | ✓✓ | ✓✓ | ✓✓ | ✓✓ | ✓✓ |
| `sonnet` | without | ✓✓! | !!! | ✓✓✓ | !! | !! | ✓✓ | ✗✓ | !! | ✓✓ |
| `google/gemini-3.5-flash-lite` | with | ✓✓✓ | ✓✓✓ | ✓✓✓ | ✓✓✓ | ✓✓ | ✓✓ | ✓✓ | ✓✓ | ✓✓ |
| `google/gemini-3.5-flash-lite` | without | ✓✓✓ | !!! | ✓!! | !! | ✗! | ✓✓ | ✓✓ | !! | ✓✓ |
| `google/gemini-2.5-flash-lite` | with | !✗✗ | rrr | ✗✗✗ | ✗✗✗ | !✗ | ✓✗ | ✗✗ | ✗✗ | ✗✗ |
| `google/gemini-2.5-flash-lite` | without | ✗✗✗ | r!r | ✗✗✗ | ✗✗ | r! | ✗✓ | ✗✗ | ✗✓ | ✗✗ |
| `openai/gpt-6-luna` | with | ✓✓✓ | rrr | ✓✓✓ | ✓✓✓ | ✓✓ | ✓✓ | ✗✓ | ✓✓ | ✓✓ |
| `openai/gpt-6-luna` | without | ✗✓✓ | !!! | ✓✓! | !! | !! | ✗✓ | ✓✓ | !! | ✓! |
| `openai/gpt-oss-20b` | with | ✓✗✓ | rrr | ✗✗✗ | ✗✗✗ | rr | ✗✗ | ✗✗ | ✗✗ | ✗✗ |
| `openai/gpt-oss-20b` | without | ✗✗✗ | rrr | ✗✗✗ | ✗✗ | rr | ✗✗ | ✗✗ | ✗✗ | ✗✗ |

provider errors (retried, not counted): 1
