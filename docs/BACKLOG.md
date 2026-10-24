# Program board: obsidian-agentkit

Bảng quản lý công việc, trạng thái và tiến độ của toàn project. Mỗi epic có một plan chi tiết trong [`docs/plans/`](plans/); mỗi việc có ID (`E2.3`) trỏ tới dòng tương ứng trong plan đó.

**Cập nhật lần cuối:** 2026-10-23 · **Phiên bản đã phát hành:** v1 (Obsidian CLI 1.14.4)

## Tổng quan tiến độ

**Toàn project: 18 / 61 việc xong (29%)**

| Epic | Plan | Trạng thái | Ưu tiên | Tiến độ | Phụ thuộc | Bước tiếp theo |
|---|---|---|---|---|---|---|
| E1. Xây dựng v1 | [E1-v1-build.md](plans/E1-v1-build.md) | ✅ Done | — | 7/7 ██████████ 100% | — | — |
| E2. Lấp lỗ hổng kiểm chứng | [E2-verification-gaps.md](plans/E2-verification-gaps.md) | ⬜ Todo | P1 | 0/6 ░░░░░░░░░░ 0% | — | E2.5, E2.6 (agent làm được ngay) |
| E3. Dùng trên vault thật | [E3-real-vault-rollout.md](plans/E3-real-vault-rollout.md) | ⏸ Chờ | P1 | 0/6 ░░░░░░░░░░ 0% | E2.2, E2.3 | Chờ thư mục test trên Drive |
| E4. Đóng gói, phân phối | [E4-packaging.md](plans/E4-packaging.md) | ⬜ Todo | P3 | 0/5 ░░░░░░░░░░ 0% | E3.1 | Để sau (quyết định ở cổng 0) |
| E5. Bảo trì và CI | [E5-maintenance-ci.md](plans/E5-maintenance-ci.md) | ⬜ Todo | P2 | 0/6 ░░░░░░░░░░ 0% | — | E5.1, E5.2 |
| E6. Plugin Tasks, Dataview, Templater | [E6-plugin-coverage.md](plans/E6-plugin-coverage.md) | ⬜ Todo | P2 | 0/6 ░░░░░░░░░░ 0% | — | E6.1–E6.3 (đo trên bản sao vault) |
| E7. Diễn tập có/không skill, tư liệu bài viết và video | [E7-showcase.md](plans/E7-showcase.md) | ✅ Done | — | 8/8 ██████████ 100% | — | — (đăng bài và quay video khi user sẵn sàng) |
| E8. Tối ưu skill cho model nhỏ (DeepSeek, GLM, Gemini, OpenAI qua OpenRouter; Haiku) | [E8-small-models.md](plans/E8-small-models.md) | 🔄 Doing | P2 | 3/11 ██░░░░░░░░ 27% | — | E8.4: vòng 0 (360 phiên) |
| E9. Bench dùng lại được: Obsidian × agent CLI × model × skill | [E9-skill-bench.md](plans/E9-skill-bench.md) | ⬜ Todo | P2 | 0/6 ░░░░░░░░░░ 0% | E8.4 xong (chạy thật) | Giao [prompt](handoff/E9-SKILLBENCH-PROMPT.md) cho agent khác; E9.1 hỏi user |

Ký hiệu trạng thái:
- ✅ Done: xong, có bằng chứng.
- 🔄 Doing: đang làm.
- ⬜ Todo: chưa bắt đầu.
- ⏸ Chờ: bị chặn bởi việc khác hoặc cần user.
- ❌ Dropped: bỏ, kèm lý do.

Ưu tiên:
- P1: cần trước khi dùng trên vault thật.
- P2: nên làm.
- P3: để sau.

## Đang làm

| ID | Việc | Ghi chú |
|---|---|---|
| E8.4 | Vòng 0: đo skill v1 | Sẵn sàng chạy. Key OpenRouter hết hạn 2026-10-30 |

## Cần user

Các việc này agent không tự làm được:

| ID | Việc | User cần làm |
|---|---|---|
| E2.1 | Case 9 với agent chạy thẳng trên Windows | Mở Claude Code trong PowerShell, cài skill |
| E2.2, E2.3 | Test trên Google Drive | Tạo thư mục test trong Drive, mở thành vault riêng |
| E2.4 | Terminal quyền admin | Mở PowerShell bằng quyền admin |
| E3.4 | Chọn cách snapshot cho vault thật | Quyết định: git trong vault, hay copy vào `.trash/` |
| E5.6 | Dọn repo | Đồng ý commit việc dời thư mục distillery (`docs/handoff/` đã commit, user chốt 2026-10-24) |
| E7.8 | Kiểm tra quyền riêng tư trước khi đăng | E7 | P1 | ✅ | Agent + user | Quét sạch, user duyệt 2026-10-23 ([PRIVACY.md](showcase/PRIVACY.md)) |

## Backlog chi tiết

| ID | Việc | Epic | Ưu tiên | Trạng thái | Ai làm | Bằng chứng / ghi chú |
|---|---|---|---|---|---|---|
| E1.0 | Đầu vào, bản sao vault có git | E1 | — | ✅ | Agent + user | [GATES.md](GATES.md) cổng 0 |
| E1.1 | Đo CLI 1.14.4 | E1 | — | ✅ | Agent | [FINDINGS.md](FINDINGS.md) |
| E1.2 | Spec | E1 | — | ✅ | Agent | [SPEC.md](SPEC.md) |
| E1.3 | Skill, bridge, profile, unit test | E1 | — | ✅ | Agent | `skills/obsidian-connect/`, 26/26 test |
| E1.4 | Bộ probe, lịch sử điểm, nhật ký sự cố | E1 | — | ✅ | Agent | [HISTORY.md](../tests/compat/HISTORY.md) 29/29 |
| E1.5 | 11 kịch bản test | E1 | — | ✅ | Agent | [RESULTS.md](../tests/RESULTS.md) |
| E1.6 | Tài liệu HOW-IT-WORKS | E1 | — | ✅ | Agent | [HOW-IT-WORKS.md](HOW-IT-WORKS.md) |
| E2.1 | Case 9 với agent trên Windows | E2 | P1 | ⏸ | User + agent | Cần máy Windows có Claude Code |
| E2.2 | Case 10: sửa hàng loạt trên Drive | E2 | P1 | ⏸ | User + agent | Cần thư mục test trên Drive |
| E2.3 | Xoá file trên Drive đi đâu | E2 | P1 | ⏸ | Agent | Cùng thư mục với E2.2 |
| E2.4 | Terminal quyền admin | E2 | P2 | ⏸ | User + agent | — |
| E2.5 | Chạy lại 4 case, mỗi case 3 lần, để đo độ dao động | E2 | P2 | ⬜ | Agent | — |
| E2.6 | Đo token từ transcript | E2 | P2 | ⬜ | Agent | — |
| E3.1 | Cài skill cho vault thật | E3 | P1 | ⏸ | User + agent | Chờ E2.3 |
| E3.2 | Profile vault thật | E3 | P1 | ⏸ | Agent | Chỉ đọc |
| E3.3 | Một tuần chỉ đọc | E3 | P1 | ⏸ | User | — |
| E3.4 | Chọn cách snapshot | E3 | P1 | ⏸ | User | — |
| E3.5 | Mở quyền ghi một note | E3 | P1 | ⏸ | User + agent | — |
| E3.6 | Mở thao tác lớn | E3 | P2 | ⏸ | User + agent | — |
| E4.1 | Plugin và marketplace của Claude Code | E4 | P3 | ⬜ | Agent | — |
| E4.2 | Đường dẫn script không phụ thuộc chỗ cài | E4 | P3 | ⬜ | Agent | — |
| E4.3 | Script cài đặt kiểm tra điều kiện | E4 | P3 | ⬜ | Agent | — |
| E4.4 | Hướng dẫn cài trên Windows | E4 | P3 | ⬜ | Agent | — |
| E4.5 | HOW-IT-WORKS tiếng Anh | E4 | P3 | ⬜ | Agent | — |
| E5.1 | GitHub Actions | E5 | P2 | ⬜ | Agent | — |
| E5.2 | `npm test` | E5 | P2 | ⬜ | Agent | — |
| E5.3 | Checklist khi Obsidian cập nhật | E5 | P2 | ⬜ | Agent | — |
| E5.4 | Nhắc chạy probe định kỳ | E5 | P3 | ⬜ | Agent | — |
| E5.5 | P18 tự dọn Thùng rác | E5 | P3 | ⬜ | Agent | — |
| E5.6 | Dọn repo (distillery, handoff) | E5 | P2 | ⏸ | User | `docs/handoff/` đã commit 2026-10-24; còn chờ quyết định về distillery |
| E6.1 | Đo task của plugin Tasks qua CLI | E6 | P2 | ⬜ | Agent | — |
| E6.2 | Đo Templater qua `--create` | E6 | P2 | ⬜ | Agent | — |
| E6.3 | Đo khả năng đọc kết quả Dataview | E6 | P2 | ⬜ | Agent | — |
| E6.4 | Viết `references/plugins.md` | E6 | P2 | ⬜ | Agent | Sau E6.1–E6.3 |
| E6.5 | Fixture và kịch bản test cho plugin | E6 | P2 | ⬜ | Agent | Sau E6.4 |
| E6.6 | (Tuỳ chọn) So sánh với MCP | E6 | P3 | ⬜ | Agent | — |
| E7.1 | Chốt tình huống diễn tập | E7 | P2 | ✅ | Agent | Plan E7, mục "Kịch bản đã chốt"; `tests/showcase/prompt.mjs` |
| E7.2 | Chạy không có skill | E7 | P2 | ✅ | Agent | 9 phiên, `docs/showcase/scenarios/*/without*/` |
| E7.3 | Chạy có skill | E7 | P2 | ✅ | Agent | 9 phiên chạy mới, `docs/showcase/scenarios/*/with*/` |
| E7.4 | Bảng so sánh và biểu đồ | E7 | P2 | ✅ | Agent | [COMPARISON.md](showcase/COMPARISON.md): 6 sự cố → 0, CLI 1,1 MB → 54 KB |
| E7.5 | Ảnh, diff, quay terminal | E7 | P2 | ✅ | Agent | `docs/showcase/assets/`: 7 ảnh Obsidian, 1 diff, 5 bản quay terminal |
| E7.6 | Kho "aha moment" | E7 | P2 | ✅ | Agent | [STORIES.md](showcase/STORIES.md), 9 hook |
| E7.7 | Bản nháp bài viết và kịch bản video | E7 | P2 | ✅ | Agent | [POST.md](showcase/POST.md), [VIDEO-SCRIPT.md](showcase/VIDEO-SCRIPT.md) |
| E7.8 | Kiểm tra quyền riêng tư trước khi đăng | E7 | P1 | ✅ | Agent + user | Quét sạch, user duyệt 2026-10-23 ([PRIVACY.md](showcase/PRIVACY.md)) |
| E8.1 | Chốt ma trận: model, giá, tình huống, ngân sách | E8 | P2 | ✅ | User + agent | 4 model OpenRouter, trần $40, Claude qua gói ([GATES.md](GATES.md) mục E8.1/E8.2) |
| E8.2 | Harness: Claude Code headless; Claude qua gói, DeepSeek/GLM qua endpoint Anthropic của OpenRouter; dự phòng vòng lặp tối giản | E8 | P2 | ✅ | Agent | `cc-run.sh`, `run.mjs`, `judge.mjs`; chạy thử đầu cuối pass trên 6 model ([GATES.md](GATES.md) mục E8.2/E8.3) |
| E8.3 | Vault tổng hợp, ground truth, guard chặn vault thật | E8 | P2 | ✅ | Agent + user | `gen-synth-vault.mjs`; `vault-synth` mở trong Obsidian, calibrate khớp ground truth |
| E8.4 | Vòng 0: đo skill v1 trên 2 DeepSeek, 2 GLM, Haiku, model mạnh; có/không skill, 3 lượt | E8 | P2 | ⬜ | Agent | Sau E8.1–E8.3 |
| E8.5 | Phân loại lỗi, xếp hạng việc cần sửa | E8 | P2 | ⬜ | Agent | — |
| E8.6 | Chuyển việc cơ học vào bridge (lệnh gộp) | E8 | P2 | ⬜ | Agent | — |
| E8.7 | Viết lại SKILL.md và output bridge cho model rẻ | E8 | P2 | ⬜ | Agent | — |
| E8.8 | Vòng 1+: đo lại, lặp tới khi đạt H1 (tối đa 3 vòng) | E8 | P2 | ⬜ | Agent | — |
| E8.9 | Báo cáo chứng minh H1–H4 và biểu đồ | E8 | P2 | ⬜ | Agent | — |
| E8.10 | Bộ test model chạy lại được, khuyến nghị model | E8 | P2 | ⬜ | Agent | — |
| E8.11 | Kiểm sau: Codex CLI (Gemini, OpenAI đã vào vòng 0) | E8 | P3 | ⬜ | Agent | Sau E8.10 |
| E9.1 | Câu hỏi cho user (pi/omp, vault thứ hai, agent CLI, ngân sách, bản Obsidian cũ) | E9 | P2 | ⬜ | Agent + user | — |
| E9.2 | Chuyển harness sang `bench/`, kịch bản thành dữ liệu, judge chung | E9 | P2 | ⬜ | Agent | Phải chấm lại E8 vòng 0 ra cùng kết quả |
| E9.3 | Adapter Codex, pi/omp, Antigravity | E9 | P2 | ⬜ | Agent | — |
| E9.4 | Lịch sử, `compare`, báo cáo, nhập dữ liệu E8 | E9 | P2 | ⬜ | Agent | — |
| E9.5 | Một đợt chạy thật: 2 agent × 3 model | E9 | P2 | ⬜ | Agent + user | Sau khi ma trận E8 xong |
| E9.6 | Tài liệu bench | E9 | P2 | ⬜ | Agent | — |

## Cách cập nhật board

1. **Bắt đầu một việc:** đổi trạng thái thành 🔄, thêm dòng vào mục "Đang làm".
2. **Xong một việc:**
   - đổi trạng thái thành ✅ và điền bằng chứng (file, commit, kết quả test);
   - đánh dấu trong plan của epic;
   - cập nhật cột "Tiến độ" của epic và dòng "Toàn project".
3. **Việc mới:**
   - thêm vào plan của epic (hoặc tạo epic mới `docs/plans/E<n>-<tên>.md`);
   - thêm dòng vào bảng chi tiết;
   - cập nhật tổng số việc.
4. **Quyết định quan trọng** ghi vào [GATES.md](GATES.md), rồi trỏ tới từ cột bằng chứng.
5. Cập nhật dòng "Cập nhật lần cuối" ở đầu file.

Thanh tiến độ: mỗi █ = 10%. Làm tròn xuống.
