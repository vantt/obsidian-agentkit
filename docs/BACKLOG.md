# Program board: obsidian-agentkit

Bảng quản lý công việc, trạng thái và tiến độ của toàn project. Mỗi epic có một plan chi tiết trong [`docs/plans/`](plans/); mỗi việc có ID (`E2.3`) trỏ tới dòng tương ứng trong plan đó.

**Cập nhật lần cuối:** 2026-10-28 · **Phiên bản đã phát hành:** v1 (Obsidian CLI 1.14.4); skill v2 kiểm trên CLI 1.15.0

## Tổng quan tiến độ

**Toàn project: 37 / 68 việc xong (54%)** (đã tách 5 việc hỗn hợp thành a/b, 2026-10-28)

**Đường chính (user chốt 2026-10-28):** E8.9 (xong) → E2 → E3, tức đưa skill lên vault thật. E4, E6, E8.11, E8.13 và E9 để P3.

| Epic | Plan | Trạng thái | Ưu tiên | Tiến độ | Phụ thuộc | Bước tiếp theo |
|---|---|---|---|---|---|---|
| E1. Xây dựng v1 | [E1-v1-build.md](plans/E1-v1-build.md) | ✅ Done | — | 7/7 ██████████ 100% | — | — |
| E2. Lấp lỗ hổng kiểm chứng | [E2-verification-gaps.md](plans/E2-verification-gaps.md) | 🔄 Doing | P1 | 2/6 ███░░░░░░░ 33% | — | E2.1a, E2.4a agent chuẩn bị; E2.1b, E2.4b cần user |
| E3. Dùng trên vault thật | [E3-real-vault-rollout.md](plans/E3-real-vault-rollout.md) | 🔄 Doing | P1 | 3/9 ███░░░░░░░ 33% | ✅ E2.2, E2.3 | E3.3a/E3.5a/E3.6a agent chuẩn bị; E3.3b: một tuần chỉ đọc (user); sau đó E3.5b |
| E4. Đóng gói, phân phối | [E4-packaging.md](plans/E4-packaging.md) | ⬜ Todo | P3 | 0/5 ░░░░░░░░░░ 0% | E3.1 | Để sau (quyết định ở cổng 0) |
| E5. Bảo trì và CI | [E5-maintenance-ci.md](plans/E5-maintenance-ci.md) | 🔄 Doing | P2 | 4/6 ██████░░░░ 66% | — | E5.1, E5.2 (CI phải `cd tests && npm ci` trước) |
| E6. Plugin Tasks, Dataview, Templater | [E6-plugin-coverage.md](plans/E6-plugin-coverage.md) | ⬜ Todo | P3 | 0/6 ░░░░░░░░░░ 0% | — | Để sau (user 2026-10-28) |
| E7. Diễn tập có/không skill, tư liệu bài viết và video | [E7-showcase.md](plans/E7-showcase.md) | ✅ Done | — | 8/8 ██████████ 100% | — | — (đăng bài và quay video khi user sẵn sàng) |
| E8. Tối ưu skill cho model nhỏ (DeepSeek, GLM, Gemini, OpenAI qua OpenRouter; Haiku) | [E8-small-models.md](plans/E8-small-models.md) | ✅ Done | — | 10/12 ████████░░ 83% | — | Báo cáo: [REPORT.md](models/REPORT.md). Mặc định `haiku`. Còn E8.11, E8.13 (P3, tuỳ chọn) |
| E9. Bench dùng lại được: Obsidian × agent CLI × model × skill | [E9-skill-bench.md](plans/E9-skill-bench.md) | ⬜ Todo | P3 | 0/6 ░░░░░░░░░░ 0% | ✅ E8.4 xong | Giao [prompt](handoff/E9-SKILLBENCH-PROMPT.md) cho agent khác; E9.1 hỏi user |
| E10. Tách bộ tạo vault test thành repo `vantt/obsidian-test-fixture` | [E10-test-fixture-repo.md](plans/E10-test-fixture-repo.md) | ✅ Done | — | 3/3 ██████████ 100% | — | — (test dùng `otf` từ `obsidian-test-fixture#v0.3.0`) |

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
| E3.3b | Một tuần chỉ đọc trên vault thật | User dùng hằng ngày, agent ghi lại lỗi |

## Cần user

Các việc này agent không tự làm được:

| ID | Việc | User cần làm |
|---|---|---|
| E2.1b | Case 9 với agent chạy thẳng trên Windows | Mở Claude Code trong PowerShell, cài skill, chạy case 1 và 4 theo checklist của E2.1a (~20 phút) |
| E3.3b | Một tuần chỉ đọc trên vault thật | Dùng agent hỏi vault (tìm, backlink, đếm task); báo lại câu trả lời sai hoặc thiếu (dùng bảng ghi của E3.3a) |
| E2.4b | Terminal quyền admin | Mở PowerShell bằng quyền admin, chạy lệnh của E2.4a (~5 phút) |
| E3.5b | Mở quyền ghi một note trên vault thật | Cho agent ghi 10 lần (append daily note, sửa property), xem kết quả (~15 phút), sau E3.3b |
| E3.6b | Thao tác lớn trên vault thật | Theo dõi lần đầu rename, move, đổi tên tag (~20 phút), sau E3.5b |
| — | Thu hồi key OpenRouter đã lộ | OpenRouter → Keys → revoke key E8 ([GATES.md](GATES.md) mục sự cố bảo mật) |

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
| E2.1 | Case 9 với agent trên Windows | E2 | P1 | ⏸ | User + agent | Tách thành a/b |
| E2.1a | Checklist cài skill và chạy case 1, 4 trên Windows, đi thử trên vault test | E2 | P1 | ⬜ | Agent | Xong khi: checklist trong `tests/`, các prompt đã chạy thử đúng một lần ở WSL |
| E2.1b | Chạy case 1, 4 với Claude Code trong PowerShell | E2 | P1 | ⏸ | User | Cần máy Windows có Claude Code, ~20 phút |
| E2.2 | Case 10: sửa hàng loạt trên Drive | E2 | P1 | ✅ | User + agent | 6 note sửa + 1 rename, sau 3 phút sync không có bản xung đột; link 9→9 ([RESULTS.md](../tests/RESULTS.md)) |
| E2.3 | Xoá file trên Drive đi đâu | E2 | P1 | ✅ | Agent | CLI `delete` trên `G:` vào Recycle Bin của Windows, khôi phục được; `obs --trash` vào `.trash/` của vault ([FINDINGS.md](FINDINGS.md) F5) |
| E2.4 | Terminal quyền admin | E2 | P2 | ⏸ | User + agent | Tách thành a/b |
| E2.4a | Lệnh chính xác và test bridge phát hiện lỗi im lặng (exit 2) bằng `fake-obsidian` | E2 | P2 | ⬜ | Agent | Xong khi: unit test pass, hướng dẫn ngắn viết xong |
| E2.4b | Chạy lệnh của E2.4a trong PowerShell admin, ghi FINDINGS F1 | E2 | P2 | ⏸ | User | ~5 phút |
| E2.5 | Chạy lại 4 case, mỗi case 3 lần, để đo độ dao động | E2 | P2 | ❌ | Agent | Bỏ: E8 đã chạy mỗi tình huống 3 lượt ([REPORT.md](models/REPORT.md)) |
| E2.6 | Đo token từ transcript | E2 | P2 | ❌ | Agent | Bỏ: E8 đo token từ transcript cho mọi lượt (`tests/models/summary.mjs`) |
| E3.1 | Cài skill cho vault thật | E3 | P1 | ✅ | User + agent | Symlink `~/.claude/skills/obsidian-connect`; `--preflight` OK, `match=yes` (lần đầu timeout vì Obsidian đang mở vault; `NEXT:` đã sửa, test mới) |
| E3.2 | Profile vault thật | E3 | P1 | ✅ | Agent | `profile.mjs` khớp giá trị live (`alwaysUpdateLinks` true, daily note ở gốc, không template). Vault có Tasks, Dataview, Templater, Breadcrumbs; `.obsidian/` đã có 2 bản xung đột Drive từ 2025 |
| E3.3 | Một tuần chỉ đọc | E3 | P1 | ⏸ | User | Tách thành a/b |
| E3.3a | Bảng ghi lỗi và 10 câu hỏi chỉ đọc mẫu, chạy thử trên `vault-copy` | E3 | P1 | ⬜ | Agent | Xong khi: 10 câu trả lời đúng, vault sạch |
| E3.3b | Một tuần dùng chỉ đọc trên vault thật | E3 | P1 | ⏸ | User | 1 tuần dùng bình thường |
| E3.4 | Chọn cách snapshot | E3 | P1 | ✅ | User | Git, repo ngoài Drive (`--separate-git-dir`), chỉ file text; bridge tự commit trước rename, move, đổi tên tag ([GATES.md](GATES.md) mục E3.4) |
| E3.5 | Mở quyền ghi một note | E3 | P1 | ⏸ | User + agent | Tách thành a/b |
| E3.5a | Script 10 lần ghi (append daily, sửa property) + đọc lại, chạy trên vault Drive test | E3 | P1 | ⬜ | Agent | Xong khi: 10/10 đúng, không có bản xung đột sau 3 phút |
| E3.5b | Làm lại trên vault thật cùng user | E3 | P1 | ⏸ | User + agent | Sau E3.3b; ~15 phút. Agent không tự ghi vào vault thật |
| E3.6 | Mở thao tác lớn | E3 | P2 | ⏸ | User + agent | Tách thành a/b |
| E3.6a | Diễn tập dry-run, rename, move, đổi tên tag trên `vault-copy` | E3 | P2 | ⬜ | Agent | Xong khi: `unresolved total` không đổi, vault sạch sau reset |
| E3.6b | Làm lần đầu trên vault thật có người theo dõi | E3 | P2 | ⏸ | User + agent | Sau E3.5b; ~20 phút |
| E4.1 | Plugin và marketplace của Claude Code | E4 | P3 | ⬜ | Agent | — |
| E4.2 | Đường dẫn script không phụ thuộc chỗ cài | E4 | P3 | ⬜ | Agent | — |
| E4.3 | Script cài đặt kiểm tra điều kiện | E4 | P3 | ⬜ | Agent | — |
| E4.4 | Hướng dẫn cài trên Windows | E4 | P3 | ⬜ | Agent | — |
| E4.5 | HOW-IT-WORKS tiếng Anh | E4 | P3 | ⬜ | Agent | — |
| E5.1 | GitHub Actions | E5 | P2 | ✅ | Agent | `.github/workflows/ci.yml` (`npm ci` + `npm test`), badge trong README; SKILL.md quá ngân sách làm `npm test` fail (exit 1). Badge xanh chờ lần chạy đầu trên GitHub |
| E5.2 | `npm test` | E5 | P2 | ✅ | Agent | `cd tests && npm ci && npm test`: 67/67 pass + size-check ok. privacy-scan không vào `npm test` (cần file cục bộ `real-names.json`) |
| E5.3 | Checklist khi Obsidian cập nhật | E5 | P2 | ⬜ | Agent | — |
| E5.4 | Nhắc chạy probe định kỳ | E5 | P3 | ⬜ | Agent | — |
| E5.5 | P18 tự dọn Thùng rác | E5 | P3 | ✅ | Agent | P18 xoá đúng entry mới của nó (tên và thư mục gốc khớp); 2 lần chạy trên `vault-copy`: `bin before=7 added=1 after=7`. 7 entry cũ còn lại do các lần chạy trước, user dọn tay nếu muốn |
| E5.6 | Dọn repo (distillery, handoff) | E5 | P2 | ✅ | User + agent | User chốt 2026-10-24: commit `docs/handoff/` và việc dời `docs/research/distillery` sang `docs/distillery`; chỉ `/upstreams/` không track |
| E6.1 | Đo task của plugin Tasks qua CLI | E6 | P3 | ⬜ | Agent | — |
| E6.2 | Đo Templater qua `--create` | E6 | P3 | ⬜ | Agent | — |
| E6.3 | Đo khả năng đọc kết quả Dataview | E6 | P3 | ⬜ | Agent | — |
| E6.4 | Viết `references/plugins.md` | E6 | P3 | ⬜ | Agent | Sau E6.1–E6.3 |
| E6.5 | Fixture và kịch bản test cho plugin | E6 | P3 | ⬜ | Agent | Sau E6.4 |
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
| E8.3 | Vault tổng hợp, ground truth, guard chặn vault thật | E8 | P2 | ✅ | Agent + user | `gen-synth-vault.mjs` (nay là `otf generate --preset personal-vault`); `vault-synth` mở trong Obsidian, calibrate khớp ground truth |
| E8.4 | Vòng 0: đo skill v1 trên 10 model (5 family); có/không skill | E8 | P2 | ✅ | Agent | 434/540 ô, dừng theo quyết định user; khuyến nghị model rẻ nhất từng family ở [ROUND-0.md](models/ROUND-0.md) |
| E8.5 | Phân loại lỗi, xếp hạng việc cần sửa; sửa bộ chấm ("không làm gì" = từ chối, `eval` vô hại vs có hại, nghi chấm nhầm `sed -i` ở S3) rồi chấm lại vòng 0 | E8 | P2 | ✅ | Agent | [FAILURES.md](models/FAILURES.md); 53/434 lượt đổi kết quả; khuyến nghị giữ nguyên ([GATES.md](GATES.md) mục E8.5) |
| E8.6 | Chuyển việc cơ học vào bridge (lệnh gộp) | E8 | P2 | ✅ | Agent | Chạy đúng trong vòng 1; 29/29 probe trên CLI 1.15.0, `TESTED_CLI` = 1.15.0 ([GATES.md](GATES.md) mục E8.6 close) |
| E8.7 | Viết lại SKILL.md và output bridge cho model rẻ | E8 | P2 | ✅ | Agent | Vòng 1: 27/27 sạch mỗi model, rẻ hơn 37–51% ([ROUND-1.md](models/ROUND-1.md)) |
| E8.8 | Vòng 1+: đo lại, lặp tới khi đạt H1 (tối đa 3 vòng) | E8 | P2 | ✅ | Agent | Vòng 1 xong, H1 đạt với Claude; vòng sau chỉ khi skill đổi |
| E8.9 | Báo cáo H1–H4, bản ngắn (gộp E8.10: bộ test chạy lại được, khuyến nghị model) | E8 | P2 | ✅ | Agent | [REPORT.md](models/REPORT.md): H1–H3 đạt trên ngưỡng, H4 bác bỏ; [tests/models/README.md](../tests/models/README.md); `tested-models` trong SKILL.md; mục "Which model" trong README |
| E8.10 | Bộ test model chạy lại được, khuyến nghị model | E8 | — | ❌ | Agent | Gộp vào E8.9 (user 2026-10-28) |
| E8.11 | Kiểm sau: Codex CLI (Gemini, OpenAI đã vào vòng 0) | E8 | P3 | ⬜ | Agent | Loại khỏi autopilot: tốn phí API / cần key hãng; tuỳ chọn |
| E8.12 | Cô lập đáp án: đáp án ra ngoài vault (option mới trong `obsidian-test-fixture`), agent không đọc được repo và state, judge bắt việc đọc ngoài vault | E8 | P1 | ✅ | Agent + user | Vòng 0: 53 lượt đọc file đánh dấu chứa đáp án S6, 3 lượt đọc script trong repo ([GATES.md](GATES.md) mục E10.2). Đáp án ra ngoài vault, sandbox và proxy key chạy thật ở vòng 1 |
| E8.13 | Kiểm cuối các model không phải Claude (4 model khuyến nghị, phía có skill, 3 lượt) | E8 | P3 | ⬜ | Agent + user | Loại khỏi autopilot: tốn tiền (~$1–3), cần key OpenRouter hoặc API của từng hãng |
| E9.1 | Câu hỏi cho user (pi/omp, vault thứ hai, agent CLI, ngân sách, bản Obsidian cũ) | E9 | P3 | ⬜ | Agent + user | Loại khỏi autopilot: giao agent khác ([prompt](handoff/E9-SKILLBENCH-PROMPT.md)) |
| E9.2 | Chuyển harness sang `bench/`, kịch bản thành dữ liệu, judge chung | E9 | P3 | ⬜ | Agent | Phải chấm lại E8 vòng 0 ra cùng kết quả · Loại khỏi autopilot: giao agent khác ([prompt](handoff/E9-SKILLBENCH-PROMPT.md)) |
| E9.3 | Adapter Codex, pi/omp, Antigravity | E9 | P3 | ⬜ | Agent | Loại khỏi autopilot: giao agent khác ([prompt](handoff/E9-SKILLBENCH-PROMPT.md)) |
| E9.4 | Lịch sử, `compare`, báo cáo, nhập dữ liệu E8 | E9 | P3 | ⬜ | Agent | Loại khỏi autopilot: giao agent khác ([prompt](handoff/E9-SKILLBENCH-PROMPT.md)) |
| E9.5 | Một đợt chạy thật: 2 agent × 3 model | E9 | P3 | ⬜ | Agent + user | Không chạy cùng lúc với lượt E8; cô lập đáp án như E8.12 · Loại khỏi autopilot: giao agent khác ([prompt](handoff/E9-SKILLBENCH-PROMPT.md)) |
| E9.6 | Tài liệu bench | E9 | P3 | ⬜ | Agent | Loại khỏi autopilot: giao agent khác ([prompt](handoff/E9-SKILLBENCH-PROMPT.md)) |
| E10.1 | Tạo repo `vantt/obsidian-test-fixture` (CLI `otf`, output giống hệt script cũ, `graph.json`) | E10 | P2 | ✅ | Agent + user | Repo public, MIT; tag `v0.1.0` → `v0.2.0` |
| E10.2 | Chuyển repo này sang dùng package (npm git dependency ghim tag), xoá 3 script cũ | E10 | P2 | ✅ | Agent | Ghim `v0.2.0`; output và `truth` giống hệt script cũ; 3 script cũ đã xoá |
| E10.3 | Kiểm tra với Obsidian thật: `preflight`, `calibrate`, một lượt Haiku S1, `probes.mjs --no-write` | E10 | P2 | ✅ | User + agent | Calibrate khớp; Haiku S1 pass; probe chỉ đọc 16/16 trên CLI 1.15.0 |

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
