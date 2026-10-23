# E8. Tối ưu skill cho model nhỏ: đo, sửa, chứng minh

**Trạng thái:** Doing, 1/11 việc · **Board:** [BACKLOG.md](../BACKLOG.md) · **Nguồn:** [COMPARISON.md](../showcase/COMPARISON.md) mục "Hạn chế" ý 2 ("Model yếu hơn ... chưa được đo")

## Mục tiêu
Giao tiếp với Obsidian là việc cơ học: chọn đúng lệnh, đọc exit code, dừng khi bị từ chối. Việc cơ học không cần model mạnh. Epic này:

1. **Đo** skill hiện tại (v1) trên các model rẻ: trước hết DeepSeek và GLM (qua OpenRouter, mỗi family 2 bản rẻ) và Haiku (qua gói Claude Code). Gemini Flash và Codex kiểm sau (E8.11), với giả định kết quả tương tự để tiết kiệm.
2. **Sửa** skill và bridge để model rẻ làm đúng và an toàn: chuyển phán đoán từ prompt sang code.
3. **Chứng minh** bằng số liệu: có skill, model rẻ làm đúng ngang model mạnh, rẻ hơn và nhanh hơn nhiều.

"Nhỏ" ở đây đo bằng **giá niêm yết mỗi triệu token** (giá chính hãng, để Claude và model khác so được với nhau), vì phần lớn nhà cung cấp không công bố kích thước model.

## Giả thuyết cần chứng minh (có thể bác bỏ)

| # | Giả thuyết | Đo bằng | Đạt khi |
|---|---|---|---|
| H1 | Có skill, model rẻ làm đúng ngang model mạnh | Tỉ lệ pass theo ground truth, số sự cố an toàn | Mỗi model rẻ: 0 sự cố ở mọi lượt; pass ≥ 90% số lượt; model mạnh cũng ≥ 90% |
| H2 | Model càng rẻ, chi phí cho mỗi việc làm đúng càng thấp | `$ / lượt pass` = tổng chi phí ÷ số lượt pass | Mỗi model rẻ đạt H1 có `$ / pass` ≤ 25% của model mạnh |
| H3 | Skill giúp model rẻ nhiều hơn model mạnh | Khoảng cách pass và sự cố giữa có skill và không skill, theo từng model | Khoảng cách của model rẻ ≥ khoảng cách của model mạnh |
| H4 | Model rẻ nhanh hơn | Thời gian mỗi lượt (trung vị) | Trung vị của model rẻ ≤ của model mạnh |

Nếu sau 3 vòng tối ưu vẫn có model không đạt H1, báo cáo ghi rõ **ngưỡng tối thiểu** ("từ hạng X trở lên"), không giấu. "Càng nhỏ càng tốt" có thể chỉ đúng tới một ngưỡng; E8 tìm ra ngưỡng đó.

## Ma trận đo

- **Model** (giá OpenRouter đọc từ `https://openrouter.ai/api/v1/models` ngày 2026-10-23, USD mỗi triệu token vào / ra):

  | Vai trò | Model | Giá vào / ra | Chạy qua | Đợt |
  |---|---|---:|---|---|
  | Rẻ | `deepseek/deepseek-v4.1-flash` | 0,165 / 0,66 | OpenRouter | Đợt chính |
  | Rẻ hơn | `deepseek/deepseek-v4-flash` (bản trước) | 0,091 / 0,182 | OpenRouter | Đợt chính |
  | Rẻ | `z-ai/glm-5.3-flash` | 0,005 / 0,199 | OpenRouter | Đợt chính |
  | Nhỏ hơn | `z-ai/glm-4.7-flash` (bản trước, context 200k) | 0,061 / 0,40 | OpenRouter | Đợt chính |
  | Rẻ | Claude Haiku 5.5 | 0,10 / 0,50 (giá OpenRouter, chỉ để tính USD) | Gói Claude Code hiện tại | Đợt chính |
  | Mốc so sánh | Model mạnh đã dùng ở E7 | giá niêm yết | Gói Claude Code hiện tại | Đợt chính |
  | Rẻ | Gemini Flash-Lite / Flash | 0,10–0,75 / 0,40–3,75 | OpenRouter | Kiểm sau (E8.11) |
  | Rẻ | Codex / model OpenAI rẻ | — | OpenRouter hoặc Codex CLI | Kiểm sau (E8.11), giả định tương đương Haiku |

  Quy tắc chọn: mỗi family một bản mới và một bản rẻ hoặc nhỏ hơn, để thấy được đường "nhỏ dần". Không dùng alias trôi (`~…-latest`) và bản `:batch` (không dùng được khi chạy tương tác). Bỏ ngoài: `glm-4.5-air` (đắt hơn `glm-4.7-flash`), DeepSeek V3.x (đắt hơn V4 flash).

  Quyết định của user (2026-10-23): model Claude chạy bằng gói Claude Code hiện tại; DeepSeek và GLM chạy qua **OpenRouter** (đã thử thehive rồi bỏ, xem cuối mục này). Mọi model đều chạy trong Claude Code headless, để chỉ có model là khác nhau:
  - Một harness cho mọi model: [`tests/models/cc-run.sh`](../../tests/models/cc-run.sh). `CLAUDE_CONFIG_DIR` riêng (không plugin, hook, MCP, memory của user), cùng 4 tool (`--tools Bash Read Edit Write`), thư mục làm việc ngoài `~/projects`. Chi tiết và số đo ở [GATES.md](../GATES.md) mục "E8.1 and E8.2 spike".
  - Claude: token dài hạn từ `claude setup-token` (`CLAUDE_CODE_OAUTH_TOKEN` trong `~/.config/obsidian-agentkit/claude.env`).
  - DeepSeek, GLM: `ANTHROPIC_BASE_URL=https://openrouter.ai/api`, mọi slot model trỏ về model đang đo. Đã chạy thử: cả 4 model gọi tool đúng và trả lời đúng.
  - Cấu hình: mẫu ở `tests/models/openrouter.env.example`; bản thật ở `~/.config/obsidian-agentkit/openrouter.env` (quyền 600, ngoài repo).
  - USD: DeepSeek, GLM lấy từ hiệu `usage` của `GET /api/v1/key` trước và sau mỗi lượt (chạy tuần tự). Không dùng `total_cost_usd` của Claude Code vì nó tính theo giá Anthropic. Claude tính bằng token × giá niêm yết.
  - Đã thử thehive (2026-10-23) rồi bỏ: key chỉ có `deepseek-v4.1-flash-1017` và `glm-5.3-flash`, không có bản rẻ hơn; không có endpoint kiểu Anthropic nên phải thêm proxy; gặp 429 sau ~70 request liên tiếp.

- **Tình huống:** S1–S8 của E7, cộng S9 là case 8a (sửa dòng thứ 3 dưới một heading trong note dài CRLF; model rẻ dễ đọc cả file). S6 viết lại trên fixture tổng hợp (xem E8.3). S8 vẫn chạy 2 phiên. Tổng cộng 10 phiên mỗi phía.
- **Phía:** có skill và không skill, cùng prompt (`tests/showcase/prompt.mjs`).
- **Số lượt:** 3 lượt mỗi ô, để thấy độ dao động (thay cho E2.5 trên các model này).
- **Kích thước:** vòng 0 có 6 model × 10 phiên × 2 phía × 3 lượt = 360 phiên. Các vòng tối ưu sau chỉ chạy phía có skill: 180 phiên mỗi vòng. Có thể bỏ bớt một bản trong family nếu vòng 0 cho thấy hai bản giống nhau.

## Chỉ số mỗi lượt
Dùng lại cách đo E7 (`check.mjs`, `transcript.mjs`, wrapper `obsidian`), thêm:

| Chỉ số | Nguồn |
|---|---|
| Pass / fail, sự cố an toàn | `check.mjs` + ground truth, không tin lời agent |
| Số lần gọi tool, thời gian | Transcript |
| Token vào, token ra | Usage của API trong transcript |
| **Chi phí USD** | DeepSeek, GLM: số OpenRouter tính (theo generation hoặc tổng chi của key); Claude: token × giá. Ghi giá đã dùng vào mỗi dòng |
| Byte CLI, byte output tool | Log của wrapper |
| **Loại lỗi** (mới) | Phân loại ở E8.5: chọn sai lệnh, bỏ qua exit code, ghi bằng CLI thô, đọc cả file, bịa kết quả, thử lại vòng lặp, sai định dạng câu trả lời |

## Việc

| ID | Việc | Xong khi | Trạng thái | Bằng chứng |
|---|---|---|---|---|
| E8.1 | **Chốt ma trận:** danh sách model đề xuất ở mục "Ma trận đo" (user có thể bớt); key OpenRouter; trần ngân sách; 2 tình huống giữ lại cho vòng cuối | Bảng model kèm giá trong file này; quyết định ghi ở [GATES.md](../GATES.md) | ✅ | User duyệt 4 model, trần $40 (2026-10-23); GATES mục "E8.1 and E8.2 spike". 2 tình huống giữ lại chốt ở E8.3 |
| E8.2 | **Harness: Claude Code headless cho cả 4 model.** Spike theo thứ tự: (1) Claude bằng gói: tìm tổ hợp cờ cho môi trường sạch (không hook caveman/skillstation, không plugin, không MCP, không CLAUDE.md) mà vẫn dùng đăng nhập gói; (2) DeepSeek/GLM: `claude -p` trỏ thẳng vào OpenRouter; thử xem `--bare` (chỉ nhận `ANTHROPIC_API_KEY` hoặc `apiKeyHelper`) có xác thực được với OpenRouter không, nếu không thì dùng cùng cấu hình sạch như Claude với `ANTHROPIC_AUTH_TOKEN`; kiểm tra tool call, reasoning và usage; trỏ luôn model nền (`ANTHROPIC_DEFAULT_HAIKU_MODEL`, …) về model đang đo; (3) kiểm tra gọi tool có ổn không (đọc file, Bash, Edit). Transcript JSONL giống E7 nên dùng lại `transcript.mjs`. Dự phòng nếu DeepSeek/GLM gọi tool hỏng qua Claude Code: `tests/models/agent.mjs`, vòng lặp tối giản gọi thẳng `/api/v1/chat/completions` của OpenRouter, 3 tool Bash/Read/Edit, cùng định dạng JSONL; khi đó báo cáo tách số theo harness. Runner `tests/models/run.mjs <model> <S> <side> <rep>` gói `setup.sh`, chạy, `finish.sh` | Chạy thử S1 có skill trên 6 model; transcript và chi phí đọc được; harness và cờ được chọn ghi ở GATES | 🔄 | `cc-run.sh` chạy được cả 6 model. `run.mjs` (preflight, calibrate, one, matrix; guard, ngân sách, chi phí từng lượt, tiếp tục được khi dừng) và `judge.mjs` (tự chấm pass và sự cố; chạy lại trên 16 lượt E7 bắt đủ 6 sự cố đã chấm tay) đã viết. `setup.sh`, `check.mjs`, `reset.sh` nhận vault qua biến môi trường; thêm S9. Còn: chạy thử đầu cuối khi Obsidian mở được `vault-synth` |
| E8.3 | **Vault tổng hợp cho model bên thứ ba.** Không gửi nội dung vault thật tới DeepSeek, GLM (và sau này Gemini, OpenAI). Dựng vault tổng hợp từ `tests/fixtures/gen-fixture.mjs`, đủ lớn (~1.800 note) và có note tiếng Việt cho S6; tính lại ground truth (`gt.mjs`); `run.mjs` từ chối chạy nếu `vault info=path` không phải vault tổng hợp | User mở vault tổng hợp trong Obsidian; S1–S9 có ground truth; guard đã test | 🔄 | `tests/models/gen-synth-vault.mjs`: 1.790 note + fixture, git, file đánh dấu `.e8-synthetic` kèm đáp án S6; đã tạo ở `C:\obsidian-agentkit-test\vault-synth`. Guard từ chối khi thiếu file đánh dấu hoặc Obsidian không trả lời (đã thử). Chờ user mở vault trong Obsidian |
| E8.4 | **Vòng 0, đo skill v1:** chạy toàn ma trận đợt chính (360 phiên) | `docs/models/data/round-0.csv`; mỗi lượt có kết quả, sự cố, token, USD, thời gian | ⬜ | — |
| E8.5 | **Phân tích lỗi:** gán loại lỗi cho mỗi lượt fail hoặc có sự cố; xếp hạng theo số lượt bị ảnh hưởng × mức nghiêm trọng | `docs/models/FAILURES.md`: bảng loại lỗi × model, danh sách sửa theo thứ tự ưu tiên | ⬜ | — |
| E8.6 | **Chuyển việc cơ học vào bridge.** Mỗi việc thường gặp thành một lệnh, model không phải ghép nhiều bước. Ứng viên (chốt theo E8.5): `--daily-append-once`, `--tasks-count`, `--find` (tự thêm ngoặc kép, bản không dấu, `limit`), `--prop-set` (sửa frontmatter giữ kiểu, tự đọc lại), `--section-edit` (outline + sửa theo dòng). Bridge nhớ vault sau `--preflight`, bỏ yêu cầu đặt `OBS_VAULT` trước mỗi lệnh | Unit test cho mỗi lệnh mới; 26/26 test cũ vẫn pass; probe 29/29 | ⬜ | — |
| E8.7 | **Viết lại SKILL.md và output của bridge cho model rẻ.** SKILL.md: câu mệnh lệnh ngắn, lệnh copy được nguyên văn, một bảng routing, ít nhánh. Output bridge: dòng đầu là kết luận, dòng cuối `NEXT: <việc nên làm>` khi lỗi, để model không phải nhớ bảng exit code. Giới hạn kích thước SKILL.md (`tests/size-check.mjs`) | SKILL.md nhỏ hơn hoặc bằng bản v1; mọi exit khác 0 có dòng `NEXT:`; test cho định dạng output | ⬜ | — |
| E8.8 | **Vòng 1 trở đi, đo lại** (phía có skill, 180 phiên mỗi vòng); lặp E8.5 → E8.7 tới khi đạt H1 hoặc hết 3 vòng. Mỗi vòng chạy lại model mạnh để chắc không bị tụt | `round-<n>.csv`; model mạnh không tụt pass; GATES ghi quyết định mỗi vòng | ⬜ | — |
| E8.9 | **Báo cáo chứng minh:** H1–H4 đạt hay không, kèm số liệu và khoảng dao động. Biểu đồ: `$ / pass` theo giá model, pass có/không skill theo model, sự cố theo model, thời gian. Ghi rõ hạn chế | `docs/models/REPORT.md` cùng biểu đồ trong `docs/models/assets/`; `privacy-scan.mjs` sạch | ⬜ | — |
| E8.10 | **Bộ test chạy lại được và khuyến nghị model.** `tests/models/` có README, cách tính điểm, `HISTORY.md` theo phiên bản skill × model (giống `tests/compat/`). SKILL.md metadata thêm `tested-models`. Cập nhật HOW-IT-WORKS | Chạy lại một lệnh ra cùng bảng điểm; khuyến nghị model mặc định trong README | ⬜ | — |
| E8.11 | **Kiểm sau: Gemini Flash và Codex.** Chạy skill bản cuối, chỉ phía có skill, 1 lượt mỗi tình huống, để xác nhận giả định "tương tự". Codex: thử model OpenAI rẻ qua cùng harness; nếu cần, thêm một lượt bằng Codex CLI với cùng skill. Nếu một ô lệch so với DeepSeek/GLM/Haiku, chạy đủ 3 lượt cho ô đó và đưa vào báo cáo | Thêm dòng vào `HISTORY.md` và REPORT; giả định đúng hay sai ghi ở GATES | ⬜ | — |

## Thứ tự
E8.1 → E8.2 và E8.3 (song song) → E8.4 → E8.5 → E8.6 và E8.7 → E8.8 (lặp) → E8.9 → E8.10 → E8.11 (khi cần, rẻ).

Cần user ở E8.1 (trần ngân sách, đặt API key) và E8.3 (mở vault tổng hợp trong Obsidian). Các việc còn lại agent tự làm và tự qua cổng, có ghi log ở GATES.

## Ngân sách (ước tính thô, chốt ở E8.1)
Ở E7, mỗi phiên có skill dùng khoảng 280.000 token vào (tính cả system prompt của Claude Code).
- Haiku và model mạnh: chạy bằng gói Claude Code, không tốn tiền riêng, nhưng tốn hạn mức của gói (60 phiên mỗi model ở vòng 0). Runner chạy tuần tự, có thể dừng giữa chừng và chạy tiếp.
- 4 model OpenRouter: khoảng 17 triệu token vào mỗi model ở vòng 0. Giá vào $0,005–0,165, cộng token ra (có reasoning): vòng 0 khoảng **$5–15**. Cộng 2–3 vòng tối ưu: **khoảng $15–40**. Prompt caching có thể giảm thêm.
- Runner đọc tổng chi của key và dừng khi chạm trần (đề xuất $40).

## Rủi ro và cách xử lý
- **Riêng tư.** Output tool của agent gửi tới OpenRouter và nhà cung cấp phía sau nó. Chỉ chạy trên vault tổng hợp (E8.3). Key để ở `~/.config/obsidian-agentkit/openrouter.env` (mẫu: `tests/models/openrouter.env.example`), không vào repo, không in ra log.
- **Key OpenRouter hết hạn 2026-10-30.** Vòng 0 và ít nhất một vòng tối ưu phải xong trước ngày đó, hoặc user cấp key mới.
- **OpenRouter định tuyến tới nhiều nhà cung cấp.** Cùng một ID model có thể chạy ở nhà cung cấp khác nhau giữa các lượt, chất lượng và tốc độ có thể khác. Ghim nhà cung cấp (`provider.order`, `allow_fallbacks: false`) nếu harness cho phép; nếu không, ghi nhà cung cấp thực tế của mỗi lượt.
- **Giá khuyến mãi.** `glm-5.3-flash` giá vào $0,005 có thể là giá tạm. Báo cáo ghi giá theo ngày chạy.
- **Harness làm lệch kết quả.** System prompt của Claude Code dài (~41.000 token) và viết cho model Claude; model khác có thể gọi tool kém vì harness chứ không vì skill. Nếu dùng hai harness, báo cáo tách riêng, không trộn số.
- **Model rẻ phá vault ở phía không skill.** Đó là dữ liệu cần đo. Vault tổng hợp có git; `setup.sh` reset trước mỗi lượt.
- **Dao động.** 3 lượt mỗi ô có thể chưa đủ. Nếu một ô có kết quả lệch nhau (1/3 hoặc 2/3), chạy thêm 2 lượt cho ô đó.
- **Tối ưu quá khớp với S1–S9.** Giữ 2 tình huống chưa từng dùng khi tối ưu (chốt ở E8.1, ví dụ tạo note từ template rồi thêm link; đổi tên một note không có backlink), chỉ chạy ở vòng cuối.
- **ID model và giá thay đổi theo thời gian.** Ghi ID và giá vào mỗi dòng kết quả; `HISTORY.md` so theo ID.

## Liên quan
- E2.5 (dao động) và E2.6 (token từ transcript): E8 chạy 3 lượt và đo từ transcript, nhưng chỉ trên vault tổng hợp. Hai việc E2 vẫn giữ cho model mạnh trên bản sao vault thật.
- Việc phát sinh của E7 (dòng trống đầu file sau `daily:append`, `unresolved verbose` ~19 KB) đưa vào danh sách ứng viên của E8.6 và E8.7.
