# E10. Tách bộ tạo vault test thành repo riêng `vantt/obsidian-test-fixture`

**Trạng thái:** Chờ user, 2/3 việc · **Board:** [BACKLOG.md](../BACKLOG.md) · **Prompt bàn giao:** [E10-TEST-FIXTURE-PROMPT.md](../handoff/E10-TEST-FIXTURE-PROMPT.md)

## Mục tiêu
Ba script đang nằm trong repo này dùng được cho cả các project khác, ví dụ test knowledge graph hoặc RAG trên note:
- `tests/fixtures/gen-fixture.mjs`: bộ fixture "ca khó";
- `tests/models/gen-synth-vault.mjs`: vault tổng hợp khoảng 1.800 note;
- `tests/ground-truth/gt.mjs`: đáp án tính thẳng từ file.

Tách chúng thành repo `vantt/obsidian-test-fixture`, có CLI `otf`, sinh vault tất định (cùng seed thì ra cùng nội dung, cùng mã băm), và thêm lệnh xuất đồ thị link (`graph.json`). Sau đó repo này chuyển sang dùng package đó thay cho bản sao trong `tests/`.

## Việc

| ID | Việc | Xong khi | Trạng thái | Bằng chứng |
|---|---|---|---|---|
| E10.1 | Tạo repo `vantt/obsidian-test-fixture` theo prompt bàn giao (agent khác làm). Không sửa repo này | Tag `v0.1.0`; output giống hệt (cùng mã băm) với script hiện tại; CI xanh trên ubuntu và windows | ✅ | Repo public, MIT; tag `v0.1.0`, `v0.1.1`, `v0.2.0` (thêm preset `kg-solo`, `otf kg`) |
| E10.2 | Chuyển repo này sang dùng package: `tests/package.json` thêm `"obsidian-test-fixture": "github:vantt/obsidian-test-fixture#v0.2.0"`. Thay các lời gọi `gen-fixture.mjs`, `gen-synth-vault.mjs`, `gt.mjs` (trong `profile.test.mjs`, `tests/compat`, `tests/showcase/check.mjs`, `tests/models/`, `reset.sh`) bằng `otf generate` / `otf truth`, rồi xoá ba script cũ. Cập nhật README của `tests/compat` và prompt E9 | Toàn bộ test offline pass; `otf verify` khớp với `vault-synth`; cùng seed thì ra cùng mã băm như trước; probe compat chạy được | ✅ | Ghim `v0.2.0`. 4 bộ vault (hard-cases thường, `--standalone`, `--bulk 200`, personal-vault seed 7) giống hệt script cũ; 34 phép so `gt.mjs` và `otf truth` không lệch; commit gốc của `vault-synth` trùng output mới; 26/26 test offline, size-check pass ([GATES.md](../GATES.md) mục E10.2). Probe compat chưa chạy thật (Obsidian đang tắt) |
| E10.3 | **Kiểm tra với Obsidian thật sau khi chuyển sang `otf`.** Lúc làm E10.2 Obsidian đang tắt, nên chỉ test offline. Chạy: `run.mjs preflight`, `run.mjs calibrate`, `run.mjs one haiku S1 with 1 --round 99`, `probes.mjs --no-write` trên `vault-synth` | Cả bốn lệnh chạy được; calibrate ra backlinks 9; lượt S1 pass (Haiku chạy bằng gói, không tốn OpenRouter) | ⬜ | Cần user mở `vault-synth` trong Obsidian |

## Cách tích hợp: npm git dependency, không dùng git submodule

| Cách | Ưu | Nhược |
|---|---|---|
| **npm git dependency ghim theo tag** (`github:vantt/obsidian-test-fixture#v0.1.0`) | Một lệnh `npm ci` là xong; phiên bản ghim rõ trong `package-lock.json`; CI không cần bước riêng; gọi CLI qua `npx otf` | Muốn sửa cả hai repo cùng lúc thì phải `npm link` |
| git submodule | Sửa hai repo cùng lúc dễ | Phải `git submodule update --init` (CI, máy mới, agent đều hay quên); HEAD tách rời dễ gây nhầm; hai cơ chế khoá phiên bản chồng lên nhau |
| Publish lên npm registry | Cài nhanh, có semver | Thêm bước publish; chưa cần khi chỉ có vài project dùng |

**Chọn npm git dependency, ghim theo tag.**
- Repo này đã có `tests/package.json`, nên thêm một dòng là đủ.
- Tag cố định thì vault tạo ra cũng cố định. Đây là điều kiện để các đáp án ở E7, E8, E9 vẫn đúng.
- Khi cần phát triển cả hai repo cùng lúc, dùng `npm link` tạm thời.
- Nếu sau này có nhiều project dùng thì publish lên npm.

## Phụ thuộc và lưu ý
- **E10.2 chỉ còn chờ E10.1.** Ma trận E8 (E8.4) đã dừng ngày 2026-10-27, nên đổi script không còn ảnh hưởng tới lượt đang chạy.
- Nếu E9 đã bắt đầu thì E9 nên dùng package này luôn, thay vì chép lại script.
- Đổi output của generator là thay đổi phá vỡ: cần lên phiên bản mới và cập nhật tag ghim ở đây.
