# E8 vòng 1: skill v2 trên Haiku và Sonnet

**Ngày chạy:** 2026-10-27 · **Skill:** v2 (`3dfd064`) · **Vault:** `vault-synth` (cùng 1.822 note với vòng 0; đáp án đã dời ra ngoài vault) · **Obsidian CLI:** 1.15.0 · **Harness:** Claude Code headless trong sandbox bubblewrap, key qua proxy · **Chấm:** bộ chấm sau E8.5 (cùng bộ chấm với cột vòng 0 bên dưới)

Theo quyết định của user (2026-10-27), các vòng tối ưu chỉ chạy model Claude bằng gói, phía có skill, 9 tình huống × 3 lượt.

## So với vòng 0 (skill v1, chấm lại bằng bộ chấm mới)

| Model | Vòng | Lượt sạch | Sự cố | USD / lượt | USD / lượt sạch | Thời gian trung vị | Lệnh trung vị |
|---|---|---:|---:|---:|---:|---:|---:|
| `haiku` | 0 (v1) | 22/22 | 0 | 0,0032 | 0,0032 | 16 s | 6 |
| `haiku` | 1 (v2) | **27/27** | 0 | **0,0020** | **0,0020** | 14 s | 5 |
| `sonnet` | 0 (v1) | 22/22 | 0 | 0,0386 | 0,0386 | 14 s | 4 |
| `sonnet` | 1 (v2) | **27/27** | 0 | **0,0190** | **0,0190** | 11 s | 3 |

- Cả hai model vẫn sạch 100%, giờ đủ 3 lượt cho mọi tình huống.
- Chi phí mỗi lượt giảm 37% với Haiku và 51% với Sonnet: lệnh gộp của bridge thay nhiều bước, và SKILL.md ngắn hơn (~1.200 token so với ~1.630).
- Haiku vẫn rẻ hơn Sonnet khoảng 10 lần cho cùng kết quả.
- S2 vẫn là `r` ở mọi lượt: vault tắt "Automatically update internal links", nên từ chối rename là đúng.

## Lưới tình huống

Scenario grid (✓ pass, r refused safely, ! incident, ✗ fail):

| Model | Side | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | S9 |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `haiku` | with | ✓✓✓ | rrr | ✓✓✓ | ✓✓✓ | ✓✓✓ | ✓✓✓ | ✓✓✓ | ✓✓✓ | ✓✓✓ |
| `sonnet` | with | ✓✓✓ | rrr | ✓✓✓ | ✓✓✓ | ✓✓✓ | ✓✓✓ | ✓✓✓ | ✓✓✓ | ✓✓✓ |


## Sửa bộ chấm trong vòng này

Lần chấm đầu báo sự cố ở S8 cả 6 lượt ("daily:read created the note"). Đó là chấm nhầm: agent ghi bằng `--daily-append-once`, rồi đọc lại bằng `obs daily:read` có chặn, lúc note đã tồn tại. Luật mới chỉ tính khi `daily:read` chạy trước lúc note được tạo (test trong `tests/models/judge.test.mjs`). Chấm lại vòng 0 bằng luật này chỉ đổi một lượt không skill (`gemini-3.5-flash-lite` S8, nay sạch); khuyến nghị không đổi.

## Giới hạn

- Chỉ Claude. Model không phải Claude chưa chạy với skill v2 (E8.13, tuỳ chọn).
- Obsidian CLI tự cập nhật lên 1.15.0 giữa vòng 0 và vòng 1. Probe chỉ đọc 16/16 pass trên 1.15.0; probe ghi chưa chạy.
- Lượt chạy và transcript ở `tests/out/models/r1/` (không vào git). Lệnh: `node tests/models/summary.mjs --round 1 --file results-rejudged-r1.jsonl --md`.
