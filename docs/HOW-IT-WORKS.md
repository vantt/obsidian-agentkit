# Skill obsidian-connect hoạt động thế nào

Tài liệu này giải thích cách skill `obsidian-connect` chạy và vai trò của từng file trong skill. Nội dung đã cập nhật cho **skill v2** (E8.6, E8.7): việc cơ học chuyển vào bridge, output của bridge có dòng kết luận và dòng `NEXT:`, SKILL.md viết lại cho model rẻ. Lý do ở [models/FAILURES.md](models/FAILURES.md). Số liệu dựa trên Obsidian CLI 1.14.4 đã đo trong [FINDINGS.md](FINDINGS.md); thiết kế đầy đủ nằm ở [SPEC.md](SPEC.md).

## 1. Ý tưởng chính

Agent (Claude Code, v.v.) cần đọc, tìm và sửa vault Obsidian mà **không làm hỏng note, link, metadata**, và tốn ít lượt và ít token. Skill chia việc thành ba lớp:

| Lớp | File | Vai trò |
|---|---|---|
| Hướng dẫn | `SKILL.md` + `references/*.md` | Dạy agent việc nào dùng lệnh nào, quy tắc an toàn và các bẫy của CLI |
| Thực thi an toàn | `scripts/obs.mjs` (bridge) | Gọi Obsidian CLI đúng cách trên mọi môi trường, biến các lỗi im lặng thành mã thoát rõ ràng, chặn thao tác nguy hiểm |
| Quy ước vault | `scripts/profile.mjs` | Đọc cấu hình `.obsidian/` để agent viết đúng kiểu của vault này |

Nguyên tắc: **dùng chỉ mục của Obsidian (qua CLI) cho những gì cần hiểu link, tag, task; dùng công cụ file cho sửa nội dung theo dòng.** Khi Obsidian không chạy, skill vẫn làm được bằng file nhưng phải ghi rõ là kết quả gần đúng.

## 2. Luồng một phiên làm việc

```mermaid
flowchart TD
    A[Agent nhận yêu cầu về vault] --> B[Đọc SKILL.md]
    B --> D["obs --preflight --vault &lt;tên&gt; (1 lần)<br/>bridge nhớ vault"]
    D -->|"APPROXIMATE: Obsidian tắt"| F["File mode: --find, --backlinks, --tasks-count<br/>vẫn chạy, đọc file, in APPROXIMATE:"]
    D -->|"OK:"| E{Việc cần làm: bảng routing}
    E -->|Đọc / tìm / đếm| G["obs --tasks-count / --find / --backlinks<br/>hoặc lệnh đọc của CLI"]
    E -->|Sửa một note| I["obs --section-edit / --prop-set / --append<br/>/ --daily-append-once / --create"]
    E -->|Rename, move, xoá, đổi tag, hơn 5 file| J["Hỏi user trước (dry-run)<br/>--rename / --move / --trash / --tag-rename … apply"]
    G --> L
    I --> L
    J --> L["Bridge tự đọc lại kết quả<br/>dòng đầu: OK: / NOT DONE: / APPROXIMATE:"]
    L -->|OK:| N[Chép kết quả vào câu trả lời]
    L -->|"lỗi: dòng NEXT:"| Q[Làm đúng như NEXT nói; STOP: thì dừng, báo user]
```

Các bước cụ thể:

1. **Preflight, chỉ một lần.** Agent hỏi user tên vault rồi chạy `obs --preflight --vault "<tên>"`. Lệnh in tối đa 5 dòng: đường dẫn vault, môi trường, phiên bản CLI và việc nó có khớp bản đã test không, cài đặt `alwaysUpdateLinks`. Bridge **nhớ vault** 12 giờ (file state trong thư mục tạm), nên các lệnh sau không cần `OBS_VAULT`; `OBS_VAULT` hay `--vault` vẫn được ưu tiên nếu có. Bridge luôn gửi `vault=<tên>` làm tham số **đầu tiên**; thiếu tham số này CLI sẽ ghi vào vault đang được focus.
2. **Obsidian tắt.** Preflight trả exit 2 ngay, dòng đầu `APPROXIMATE:`, và vẫn in đường dẫn vault lấy từ `obsidian.json` của Obsidian. Bridge chỉ in **đúng vault được hỏi**, không bao giờ in danh sách vault. SKILL.md không còn bảo agent tự đọc `obsidian.json` (file đó chứa tên mọi vault thật của user).
3. **Profile.** Trước khi viết note mới hoặc link, agent chạy `profile.mjs` để biết quy ước của vault.
4. **Chọn lệnh theo bảng routing** trong SKILL.md: mỗi việc một lệnh copy được nguyên văn, ví dụ đếm task là `obs --tasks-count`, sửa dòng thứ 3 dưới một heading là `obs --section-edit … line=3 text="…"`.
5. **Đọc dòng kết luận.** Bridge tự đọc lại sau khi ghi. Agent chép dòng `OK:`/`NOT DONE:`/`APPROXIMATE:` vào câu trả lời, và khi lỗi thì làm theo dòng `NEXT:`. Agent không cần nhớ bảng mã thoát.

## 3. Vai trò từng file

```
skills/obsidian-connect/
├── SKILL.md               luôn được nạp khi skill kích hoạt
├── references/
│   ├── traps.md           danh sách bẫy CLI đầy đủ, kèm bằng chứng
│   ├── bulk-edit.md       quy trình sửa nhiều file và đổi tên tag
│   ├── file-mode.md       cách làm khi không có CLI
│   └── formats.md         Bases, JSON Canvas, clip web
└── scripts/
    ├── obs.mjs            bridge gọi Obsidian CLI
    ├── files.mjs          phần đọc và sửa file của bridge (dùng cả khi Obsidian tắt)
    └── profile.mjs        sinh vault profile
```

### `SKILL.md`: bản hướng dẫn chính (~1,2k token ở v2, v1 là ~1,6k)

Agent luôn đọc file này đầu tiên. Nó gồm:
- **Frontmatter:** `name`, `description` (quyết định khi nào skill được kích hoạt: chỉ khi làm việc với vault Obsidian, không phải Markdown thông thường), và `metadata.tested-cli: "1.15.0"` để biết skill đã được kiểm chứng trên bản CLI nào.
- **Start:** hỏi tên vault, chạy preflight một lần, chạy profile trước khi viết note mới.
- **Read the output:** chép dòng `OK:`/`NOT DONE:`/`APPROXIMATE:` vào câu trả lời; lỗi thì làm theo `NEXT:`. Bảng mã thoát của v1 đã bỏ.
- **Bảng routing:** 18 việc, mỗi việc một lệnh copy được nguyên văn.
- **Ngưỡng an toàn** (giữ nguyên như v1):
  - Được tự làm: tạo hoặc sửa một note.
  - Phải hỏi user trước (dry-run): rename, move, xoá, đổi tên tag, hoặc sửa hơn 5 file. Snapshot do bridge tự làm cho `--rename`, `--move`, `--tag-rename … apply`.
  - Không bao giờ: `delete permanent`, `mv`/`rm` trên note, `eval`, ghi đè cả note.
- Các bẫy của CLI để ở `traps.md`; phần lớn giờ bridge tự chặn.

SKILL.md được giữ ngắn vì nó tốn token mỗi lần nạp. Chi tiết nằm ở `references/` và chỉ được đọc khi cần.

### `references/`: đọc khi cần

| File | Khi nào agent đọc | Nội dung |
|---|---|---|
| `traps.md` | Khi gặp output lạ, hoặc cần chi tiết | Các chuỗi lỗi và kết quả rỗng mà vẫn exit 0; bẫy phạm vi (`vault=` phải đứng đầu, `active`); bẫy kích thước output (`search:context` có thể ra hàng trăm KB); bẫy khi ghi (`create` tạo `tên 1.md`, `property:set` sửa `types.json`, `daily:read` tạo note rỗng); bẫy môi trường (Git Bash gọi nhầm `.exe`) |
| `bulk-edit.md` | Rename, move, xoá, sửa hơn 5 file, đổi tên tag | Quy trình 6 bước: dry-run, xác nhận, snapshot (git commit hoặc copy vào `.trash/obsidian-connect-snapshots/`), áp dụng sửa theo dòng, kiểm tra lại, báo cáo. Cách đổi tên tag mà không đụng `#projects`, code block hay tag con |
| `file-mode.md` | Khi preflight trả exit 2 | Các lệnh grep/rg có giới hạn output cho từng việc, chỉ rõ chỗ nào có thể thiếu (grep không hiểu link như Obsidian). Không cho rename/move vì link sẽ gãy |
| `formats.md` | Làm việc với `.base`, `.canvas`, clip web | Cấu trúc Bases (YAML) và JSON Canvas, cách kiểm tra file hợp lệ, quy trình clip trang web. Viết lại theo ý từ skill của kepano (MIT) |

### `scripts/obs.mjs`: bridge

Một script Node duy nhất, chạy được trên WSL, PowerShell, cmd và Git Bash. Nó tồn tại vì CLI thô có nhiều chỗ nguy hiểm:

| Vấn đề của CLI thô | Bridge xử lý |
|---|---|
| WSL không có `obsidian` trên PATH; Git Bash gọi nhầm `Obsidian.exe` nên lệnh trả exit 127 | Tự tìm `Obsidian.com` (lưu cache), chạy từ thư mục ổ C: |
| Thiếu `vault=` hoặc đặt sai vị trí thì lệnh rơi vào vault đang focus | Luôn chèn `vault=<OBS_VAULT>` làm tham số đầu tiên; thiếu (và chưa preflight) thì từ chối (exit 5) |
| `Error: …`, `Vault not found.`, `No … found.` đều trả exit 0 | Đọc stdout và trả mã thoát thật: 3 = lỗi, 4 = rỗng, 6 = Obsidian đang tải |
| Obsidian tắt | Exit 2 trong khoảng 150 ms, kèm lời nhắc chuyển sang file mode |
| Lệnh treo | Timeout 10 giây, exit 124, không thử lại |
| `rename`/`move` khi tắt "auto update links" thì hiện hộp thoại và CLI treo, link gãy | `--rename` / `--move`: kiểm tra cài đặt trước; đếm backlink và unresolved trước và sau (chờ tối đa 30 giây cho index cập nhật); lệch thì exit 7 |
| `move` vào thư mục chưa có thì lỗi ENOENT | `--move` tạo thư mục trước |
| `delete` vào Thùng rác Windows, bỏ qua cài đặt `.trash` | `--trash`: chuyển file vào `<vault>/.trash/` và báo số backlink sẽ gãy |
| `create` trên file đã có thì lặng lẽ tạo `tên 1.md` | `--create`: từ chối nếu file đã tồn tại |
| Lệnh ghi thô (`create`, `append`, `prepend`, `property:set`, `property:remove`, `daily:append`, `delete`, `rename`, `move`) | Từ chối (exit 5), dòng `NEXT:` chỉ đúng lệnh bridge thay thế. `--allow-unsafe` (chỉ sau khi user xác nhận) mở được các lệnh này, **trừ `rename`/`move`** |
| Lệnh nguy hiểm | Chặn (exit 7) cài plugin/theme, `history:restore`, `command`, `overwrite`, `property:set type=`; mở bằng `--allow-unsafe` sau khi user xác nhận. `eval`, `dev:*` thì **không bao giờ** mở được |
| `daily:read` tạo note rỗng nếu chưa có | Bridge kiểm tra bằng `daily:path` trước; chưa có note thì trả exit 4, không tạo gì |
| Lệnh không tồn tại (`exec`, `grep`, gõ sai) | Exit 5 kèm `NEXT:`, không còn bị hiểu nhầm là "Obsidian đang tải" (exit 6). `vaults` bị chặn để không lộ danh sách vault |
| Model quên `path=` | `obs read "a b.md"`, kể cả `obs read a b.md` không có ngoặc kép, được hiểu là `path=a b.md` |
| Model gọi lại cùng một lệnh lỗi mãi | Lần thứ 3 liên tiếp cùng lệnh, cùng lỗi: `NEXT: STOP: same error 3 times…` |

Các lệnh riêng của bridge (bắt đầu bằng `--`):

| Lệnh | Tác dụng |
|---|---|
| `--preflight` | Kiểm tra môi trường, CLI, vault, cài đặt (≤ 5 dòng); nhớ vault. Obsidian tắt vẫn in đường dẫn vault |
| `--find "<chữ>"` | Tìm note: tự đặt cụm từ trong ngoặc kép, tự tìm thêm bản không dấu (`Đà Nẵng` và `Da Nang`), giới hạn 20, xếp note có tên khớp lên đầu |
| `--backlinks path=` | Note nào link tới note này. Obsidian tắt thì tự đọc file (bỏ code block, tách riêng link theo alias) |
| `--tasks-count` | Đếm task chưa xong trong cả vault (`done`: task đã xong) |
| `--section-edit path= heading=` | Không có `line=`: in các dòng dưới heading, có đánh số. `line=<n> text=`: thay dòng n; `after=<n> text=`: chèn. Giữ CRLF |
| `--prop-set path= name=` | Sửa frontmatter trong file, giữ kiểu theo `types.json` (số, ngày, checkbox, list), `add=`/`remove=` cho list, `unset` xoá key. Không đụng `types.json` |
| `--append path= content=` | Thêm dòng cuối note theo kiểu xuống dòng của note; `once`: bỏ qua nếu dòng đã có |
| `--daily-append-once content=` | Thêm dòng vào daily note hôm nay đúng một lần; tạo note qua `daily:append` (có template) nếu chưa có, không bao giờ gọi `daily:read` |
| `--tag-rename from= to=` | Không có `apply`: chỉ in kế hoạch (dry run). Có `apply`: snapshot, sửa thân note và `tags:` trong frontmatter, bỏ qua code, không đụng `#projects` hay tag con (trừ khi `nested=yes`), kiểm tra lại |
| `--abs <đường dẫn>` | Đổi đường dẫn trong vault thành đường dẫn tuyệt đối theo môi trường (`/mnt/c/...` trên WSL, `C:\...` trên Windows) |
| `--rename`, `--move` | Đổi tên hoặc di chuyển có kiểm tra link; tự snapshot note và các note link tới nó. Link updating tắt thì từ chối, không có cách mở |
| `--trash` | Xoá an toàn vào `.trash/` |
| `--create` | Tạo note mà không ghi đè hoặc nhân bản |
| `--help` | In danh sách lệnh trên |

**Định dạng output (v2).** Mọi lệnh bridge in dòng đầu là kết luận: `OK:` (đã làm và đã đọc lại), `NOT DONE:` (chưa làm, kèm lý do; dry run cũng là `NOT DONE`), hoặc `APPROXIMATE:` (Obsidian tắt, đọc từ file, có thể thiếu). Mọi lần thoát khác 0 đều kết thúc bằng dòng `NEXT: <việc nên làm>` trên stderr. Lệnh đọc chuyển thẳng cho CLI (`obs read`, `obs outline`, …) vẫn in nguyên stdout của CLI.

Biến môi trường: `OBS_VAULT` (không còn bắt buộc sau preflight), `OBS_VAULT_DIR` (thư mục vault khi không tìm được), `OBS_TIMEOUT` (giây, mặc định 10), `OBS_CLI` (chỉ định đường dẫn CLI), `OBS_VERIFY_MS` (thời gian chờ kiểm tra link), `OBS_LOG` (ghi log từng lần gọi, dùng khi đo test), `OBS_STATE` (file nhớ vault), `OBS_OBSIDIAN_JSON` (chỉ định `obsidian.json`, dùng trong sandbox và test).

Bảng mã thoát (agent không cần nhớ: dòng `NEXT:` nói việc cần làm):

| Mã | Ý nghĩa | Agent nên làm gì |
|---|---|---|
| 0 | OK | Dùng kết quả |
| 2 | Không gọi được CLI | Chuyển sang file mode |
| 3 | CLI báo lỗi | Đọc thông báo, sửa lệnh |
| 4 | Kết quả rỗng | Kiểm tra lại `path=` và chính tả trước khi kết luận "không có" |
| 5 | Sai cách dùng, thiếu vault, lệnh không tồn tại, hoặc lệnh ghi thô | Làm theo `NEXT:` (thường là lệnh bridge đúng) |
| 6 | Obsidian đang tải | Chờ 2 giây, thử lại **một** lần |
| 7 | Bị chặn vì an toàn, hoặc kiểm tra sau khi ghi thất bại | Dừng, báo user |
| 124 | Timeout | Không thử lại, báo user |

### `scripts/profile.mjs`: vault profile

Đọc `.obsidian/*.json` và in khoảng 25 dòng YAML. Mỗi giá trị có ghi nguồn (`# from app.json` hoặc `# default`). Agent dùng profile để:
- viết link đúng kiểu (`[[wikilink]]` hay `[text](path.md)`);
- đặt note mới và daily note đúng thư mục và định dạng ngày, dùng đúng template;
- biết property nào có kiểu cố định (`tags`, `aliases`, kiểu số, ngày) để sửa trong file, không dùng `property:set`;
- biết thư mục nào bị loại trừ, và vault có bản xung đột Drive hay không.

Script không đọc nội dung note, không cần Obsidian chạy, và không ghi gì vào vault.

## 4. Ví dụ ba tình huống

**Hỏi "Có bao nhiêu task chưa xong?"**
```
obs --preflight --vault vault-copy   → OK: vault "vault-copy" at /mnt/c/... (4 dòng)
obs --tasks-count                    → OK: 114 open tasks in the whole vault (Obsidian index)
```
Hai lần gọi, khoảng 60 token output. Agent không liệt kê task vì user chỉ hỏi số lượng.

**Đổi tên một note có 9 note khác trỏ tới**
1. Hỏi user (dry-run): note nào đổi tên, 9 note nào có link sẽ được Obsidian sửa.
2. `obs --rename path="Target Note.md" name="Target Renamed"` → `OK: renamed Target Note.md -> Target Renamed.md; backlinks 9->9; unresolved 87->87; snapshot in .trash/obsidian-connect-snapshots/<thời điểm>/`. Bridge tự snapshot note và 9 note kia trước khi đổi.
3. Nếu "Automatically update internal links" đang tắt: `NOT DONE: alwaysUpdateLinks is false …` và `NEXT: tell the user: turn on …`. Không có cách nào lách, kể cả `--allow-unsafe`.

**Obsidian đang tắt**
```
obs --preflight --vault vault-copy             → APPROXIMATE: Obsidian is not running … (exit 2), kèm đường dẫn vault
obs --backlinks path="Target Note.md"          → APPROXIMATE: 9 note(s) link to Target Note.md …
```
Agent chép chữ "gần đúng" vào câu trả lời và từ chối rename.

## 5. Vì sao ít tốn token

Token của một tác vụ đến từ hai nguồn:
- **Chữ của skill** mà agent phải đọc.
- **Output của các công cụ** đổ vào context: kết quả lệnh, nội dung file. Đây thường là phần lớn hơn nhiều.

Mỗi lượt gọi công cụ còn kéo theo một vòng suy luận nữa, nên chi phí thực tế là **số lượt × lượng output mỗi lượt** (YARDSTICK). Skill cắt giảm cả hai nguồn.

### 5.1 Chữ của skill: chỉ nạp phần cần dùng

| Phần | Nạp khi nào | Kích thước (ước tính, ký tự ÷ 4) |
|---|---|---|
| `description` | Luôn có trong danh sách skill | 51 từ |
| `SKILL.md` | Khi skill được kích hoạt | ~1,2k token (v1: ~1,6k) |
| Mỗi file `references/` | Chỉ khi việc cần đến | 550–1.100 token |
| **Tác vụ điển hình** (SKILL + một reference lớn nhất) | | **≤ ~2,4k token** |

So sánh với các repo đã khảo sát (REPORT.md): pablo nạp khoảng 9k token (SKILL cộng reference 651 dòng), jackal khoảng 1,8k. Skill này không chép tài liệu lệnh CLI vào; khi cần cú pháp, agent gọi `obsidian help <lệnh>`. `tests/size-check.mjs` kiểm tra ngân sách này mỗi lần chạy test, để skill không phình dần.

### 5.2 Output công cụ: các quy tắc làm output nhỏ

| Quy tắc trong skill | Vì sao tiết kiệm | Số đo thực tế |
|---|---|---|
| **Hỏi số lượng thì dừng ở `total`** | Chỉ trả về một con số, thay vì cả danh sách | Case 4: 24.499 byte (~6.100 token) giảm còn 248 byte (~60 token) sau khi sửa skill |
| **Dùng chỉ mục của Obsidian thay vì đọc file** | `backlinks`, `tasks`, `tags` trả lời từ chỉ mục có sẵn, không phải mở hàng nghìn note | Đếm 114 task trên 1.845 note: 1 lệnh, output chỉ là con số `114`. Grep toàn vault từ WSL mất 5–8 giây và trả về từng dòng khớp |
| **Đặt cụm từ trong ngoặc kép** | `query=Section A` khớp từng từ riêng, còn `search:context` lặp mỗi dòng theo số từ khớp | Cùng câu hỏi: 410 KB khi không có ngoặc kép, 254 byte khi có (F8c) |
| **Luôn có `path=` và `limit=`** | Thu hẹp phạm vi tìm và chặn số kết quả | Case 6: tìm "Đà Nẵng" trên 1.845 note, tổng output ~960 token (ngân sách 4k) |
| **Outline rồi đọc đúng khoảng dòng** | Note dài không bao giờ bị đọc hết | Case 8a: note 2.974 dòng, agent chỉ đọc 8 dòng, ~680 token cả tác vụ |
| **Sửa theo dòng (Edit)** | Không phải đọc lại hay ghi lại cả file | Case 3: diff 3 dòng, ~200 token |
| **`head -c 4000` cho output dài** | Chặn trên cho mọi danh sách dài | — |
| **Biết lệnh nào bỏ qua `total`** | `search:context` và `bases` in toàn bộ dù có `total`; skill dặn luôn kèm `limit` | Tránh được một dạng bùng output mà CLI không báo (F9f) |

### 5.3 Ít lượt gọi hơn

| Cơ chế | Tiết kiệm |
|---|---|
| **Preflight một lần, trả lời trong ≤ 5 dòng** | Môi trường, phiên bản, vault và cài đặt có trong một lần gọi. Agent không phải thử từng lệnh để tìm hiểu |
| **Mã thoát rõ ràng** | CLI thô báo lỗi bằng chữ kèm exit 0, nên agent hay phải gọi thêm để kiểm tra, hoặc thử lại nhiều lần. Bridge trả 3/4/6/7 ngay, kèm hướng xử lý |
| **Không bao giờ thử lại khi timeout hoặc mất kết nối** | Obsidian tắt: phát hiện trong 1 lần gọi, khoảng 150 ms (case 7) |
| **Lệnh gộp của bridge** | `--rename` tự chạy khoảng 6 lệnh CLI bên trong (kiểm tra file, cài đặt, đếm link trước và sau, chờ chỉ mục) nhưng chỉ in **một dòng** kết quả: `backlinks 9->9; unresolved 87->87; verified` |
| **Profile ~25 dòng** | Thay cho việc agent tự mở và đọc 5–6 file JSON trong `.obsidian/`. Chỉ chạy khi sắp ghi; tác vụ chỉ đọc thì bỏ qua |

### 5.4 Kết quả đo trên 11 kịch bản

Ước tính output công cụ của mỗi tác vụ (chi tiết: [tests/RESULTS.md](../tests/RESULTS.md)):

| Tác vụ | Số lượt | Output (ước tính) |
|---|---|---|
| Đếm task toàn vault | 3 | ~60 token |
| Sửa 3 property | 4 | ~200 token |
| Liệt kê backlink | 5 | ~300 token |
| Đổi tên note có 9 link trỏ tới, có kiểm tra | 9 | ~380 token |
| Sửa một dòng trong note 2.974 dòng | 5 | ~680 token |
| Tìm chủ đề trong 1.845 note | 4 | ~960 token |
| Đổi tên tag trên toàn vault (có dry-run) | 10 | ~2.100 token |

Cách đo: số byte output của bridge (ghi bằng `OBS_LOG`) cộng số dòng file agent đọc, chia 4. Các con số này **thấp hơn thực tế một chút**, vì chưa tính output từ các lệnh grep/cat mà agent tự chạy (xem lỗ hổng ở GATES.md, cổng 3).

## 6. Kiểm thử và bảo trì (ngoài skill, trong repo)

Các file này không phải một phần của skill khi cài đặt, nhưng giữ cho skill đúng khi Obsidian ra bản mới:

| File | Vai trò |
|---|---|
| `tests/bridge.test.mjs`, `tests/fake-obsidian.mjs` | Kiểm tra mọi mã thoát, định dạng output (`OK:`/`NOT DONE:`/`APPROXIMATE:`, `NEXT:`) và từng lệnh bridge bằng CLI giả (chế độ `vault` giả lập CLI trên một vault fixture thật), không cần Obsidian |
| `tests/profile.test.mjs` | Kiểm tra profile đọc đúng giá trị và không lộ nội dung note |
| `tests/size-check.mjs` | Kiểm tra ngân sách kích thước (mô tả ≤ 60 từ, SKILL ≤ 70 dòng và không lớn hơn v1, tải điển hình ≤ 3k token) |
| `otf` (package [`obsidian-test-fixture`](https://github.com/vantt/obsidian-test-fixture), ghim tag trong `tests/package.json`; đường dẫn ở `tests/otf.mjs`) | `otf generate --preset hard-cases` sinh vault giả với các trường hợp khó (đủ kiểu link, note CRLF 3.000 dòng, tên tiếng Việt, tag dễ nhầm); `--preset personal-vault` sinh vault tổng hợp ~1.800 note cho E8. `otf truth` tính đáp án đúng chỉ từ file (backlink, task, tag, YAML, CRLF) để chấm kết quả |
| `tests/compat/probes.mjs` | 31 probe kiểm tra lại từng hành vi CLI mà skill dựa vào, chấm điểm theo mức độ thiệt hại, lưu lịch sử vào `HISTORY.md` |
| `tests/compat/TROUBLESHOOTING.md` | Kinh nghiệm xử lý sự cố khi đo (index chậm, reload, hộp thoại...) |
| `tests/scenarios/README.md`, `tests/RESULTS.md` | 11 kịch bản test với agent thật, cùng kết quả từng lần chạy |

**Khi Obsidian ra bản mới:** `obs --preflight` sẽ báo `match=no`. Khi đó chạy `tests/compat/probes.mjs`, xem probe nào đổi kết quả trong `HISTORY.md`, rồi cập nhật `traps.md`, SKILL.md và `TESTED_CLI`. Chi tiết ở [tests/compat/README.md](../tests/compat/README.md).
