# So sánh các project semantic search cho Obsidian

Ngày: 2026-10-22. Nguồn: distill 16 repo, mỗi repo pin ở một commit (xem `docs/distillery/distill.yaml`, 92 lesson trong `docs/distillery/lessons/`). Profile chi tiết từng repo nằm trong thư mục scratchpad của phiên làm việc.

## Kết luận ngắn

1. **Chọn `obsidian-hybrid-search` (OHS) làm lựa chọn đầu.** Hybrid BM25 + vector + fuzzy title, model mặc định đa ngôn ngữ chạy CPU, cài bằng `npm`, có MCP và CLI, chạy không cần Obsidian.
2. **Ứng cử viên thứ hai: `qmd`.** Retrieval mạnh nhất (có mở rộng query và rerank mặc định), cộng đồng lớn nhất, nhưng nặng ~2GB, không có remote model và mặc định tối ưu tiếng Anh. Phù hợp khi máy mạnh hoặc có GPU.
3. **Dự phòng: `qkb`** (cùng hướng hybrid, có hook remote OpenAI-compatible, nhưng bắt buộc mỗi note có frontmatter `id`).
4. **Muốn giao diện trong Obsidian:** Smart Connections cho người dùng, thêm OHS cho agent. Hai thứ chạy độc lập, mỗi thứ tự index.
5. **Chưa repo nào được đo trên tiếng Việt.** "Hỗ trợ tiếng Việt" ở đây chỉ nghĩa là model mặc định hoặc model chọn được là đa ngôn ngữ. Phải tự test (xem mục cuối).

## Tiêu chí so sánh

Năm tiêu chí do bạn đặt ra, dùng chung cho bảng chấm điểm và bảng so sánh OHS với qmd. Điểm 1-5 là tôi tự chấm từ bằng chứng trong code, không có benchmark độc lập.

| # | Tiêu chí | Câu hỏi đặt ra | Điểm cao khi | Điểm thấp khi |
|---|---|---|---|---|
| 1 | Cách tiếp cận | Cách truy hồi nào hứa hẹn kết quả tốt nhất? | Hybrid BM25 + vector, có rerank, chunk theo heading, index tăng dần | Chỉ vector, chunk thô, phải index lại toàn bộ |
| 2 | Tiếng Việt | Note tiếng Việt có tìm được không? | Model mặc định đa ngôn ngữ, đổi được sang model đa ngôn ngữ khác | Model tiếng Anh cố định |
| 3 | Model nhẹ hoặc remote | Có chạy được mà không cần model local xịn không? | Có model nhỏ chạy CPU kèm sẵn, hoặc nối được remote OpenAI-compatible | Chỉ model lớn local, hoặc cần GPU |
| 4 | Dễ cài, portable | Người thường cài và dùng được không? | Một lệnh cài hoặc plugin store, ít phụ thuộc native, chạy nhiều OS | Phải build từ source, Docker, Postgres, hoặc sửa note cho vừa công cụ |
| 5 | Agent nối vào | Agent search được không? | MCP hoặc CLI, chạy không cần Obsidian, tool đủ dùng | Không có giao diện cho agent, hoặc cần Obsidian đang mở |

Ngoài 5 tiêu chí này, tôi ghi thêm hai điểm không chấm điểm nhưng ảnh hưởng quyết định: index có đồng bộ nhiều máy được không, và repo còn được bảo trì không.

## Hai ứng cử viên: OHS và qmd

So sánh trên giấy từ profile đã distill. Chưa cài hay chạy thử cái nào.

| Tiêu chí | [OHS](https://github.com/flowing-abyss/obsidian-hybrid-search) | [qmd](https://github.com/tobi/qmd) |
|---|---|---|
| Truy hồi | BM25 + vector + fuzzy title, gộp weighted RRF; rerank tuỳ chọn | BM25 + vector + mở rộng query (HyDE) + rerank, rerank mặc định bật |
| Model mặc định | `multilingual-e5-small` (~117MB, CPU) | embeddinggemma-300M + Qwen3-Reranker + model mở rộng query, tổng ~2GB |
| Tiếng Việt | Model đa ngôn ngữ từ mặc định, tự thêm prefix `query:`/`passage:` | README gọi model mặc định là tối ưu cho tiếng Anh; phải đổi sang Qwen3-Embedding-0.6B qua `QMD_EMBED_MODEL` |
| Remote model | Có: `OPENAI_BASE_URL` (OpenRouter, Ollama, LM Studio) | Không: toàn bộ chạy local qua node-llama-cpp |
| Cài đặt | `npm -g`, Node 20+, không cần GPU hay Ollama | `npm -g`, Node 22+; macOS cần Homebrew SQLite; có GPU thì tự dùng, CPU thì chậm |
| Agent | MCP stdio/HTTP + CLI `--json`; tool `search`, `read`, `reindex`, `status` | MCP stdio/HTTP + CLI `--json`; tool `query`, `get`, `multi_get`, `status`, `metadata` |
| Auth HTTP | Không (chỉ chặn Host header) | Không (chỉ chặn Origin/Host) |
| Index nhiều máy | DB trong vault, WAL, từ chối ghi khi model đổi | `~/.cache/qmd/index.sqlite`, đường dẫn tuyệt đối theo máy, lưu cả văn bản gốc nên lớn |
| Cộng đồng | 112 sao | 30,5k sao |

**Số đo chất lượng** (từ `eval/COMPARISON.md` trong repo OHS; tôi đã đọc phương pháp, chưa chạy lại):

| | OHS | qmd |
|---|---|---|
| nDCG@5 | 0,733 | 0,659 |
| MRR | 0,788 | 0,665 |
| Hit@1 | 0,724 | 0,500 |
| Thời gian truy vấn | 571 ms (CPU) | 754 ms (GPU Metal) |

Cần đọc con số này thận trọng:
- Tác giả OHS tự đo, trên vault Obsidian Help tiếng Anh (171 note, 58 query). Không có tiếng Việt.
- Hai bên chạy khác phần cứng: OHS trên CPU, qmd trên GPU Metal. OHS tắt rerank, qmd bật rerank và mở rộng query.
- Chỉ nên tin xu hướng: OHS không thua qmd trên bộ này dù nhẹ hơn nhiều. Chưa thể nói OHS giỏi hơn trên vault của bạn.

**Chọn theo tình huống:**
- Vault tiếng Việt, máy yếu, cần nối remote model: **OHS**. Qua `OPENAI_BASE_URL` dùng được `bge-m3` từ nhà cung cấp, qmd không làm được.
- Máy mạnh hoặc có GPU, ưu tiên độ chính xác tiếng Anh, muốn hệ sinh thái lớn: **qmd**.
- Hai công cụ cùng làm một việc, chọn một, không cần chạy cả hai.

**Rủi ro chung:** tiếng Việt chưa đo; cả hai ghi index vào file SQLite WAL nên không được để công cụ sync đồng bộ file đó giữa các máy.

## Bảng chấm điểm (1-5, tự chấm từ bằng chứng trong code, không phải benchmark)

| Hạng | Project | Stars | Cách tiếp cận | Tiếng Việt | Model nhẹ / remote | Dễ cài | Agent nối vào |
|---|---|---|---|---|---|---|---|
| 1 | [obsidian-hybrid-search](https://github.com/flowing-abyss/obsidian-hybrid-search) | 112 | 5 | 4 | 5 | 4 | 5 |
| 2 | [qkb](https://github.com/miguelarios/qkb) | 0 | 5 | 3 | 4 | 3 | 5 |
| 3 | [qmd](https://github.com/tobi/qmd) | 30.5k | 5 | 2 | 2 | 3 | 5 |
| 4 | [open-connections](https://github.com/GoBeromsu/open-smart-connections) | 21 | 2 | 3 | 5 | 4 | 3 |
| 5 | [obsidian-mcp (thoreinstein)](https://github.com/thoreinstein/obsidian-mcp) | 0 | 4 | 2 | 2 | 2 | 4 |
| 6 | [obsidian-semantic-search (ravila4)](https://github.com/ravila4/obsidian-semantic-search) | 19 | 2 | 3 | 4 | 3 | 3 |
| 7 | [Smart Connections](https://github.com/brianpetro/obsidian-smart-connections) + [smart-connections-mcp](https://github.com/msdanyg/smart-connections-mcp) | 5.5k / 59 | 2 | 2 | 2 | 5 | 2 |
| 8 | [obsidian-chromadb-sync](https://github.com/MeatPopcicle/obsidian-chromadb-sync) | 2 | 3 | 2 | 1 | 1 | 3 |
| 9 | còn lại: bbawj, vector-search (ashwin), claude-code (Roasbeef), qmd plugin x2, vasallo94, glnds | | thấp | | | | thấp |

Điểm nhóm 9 thấp vì: không có giao diện cho agent, hoặc model cố định tiếng Anh, hoặc repo chỉ có spec, hoặc không tự làm semantic search.

## Chi tiết các ứng viên chính

### 1. obsidian-hybrid-search (OHS)

- **Tiếp cận:** SQLite một file, FTS5 BM25 (trọng số title 10, alias 5, nội dung 1), vector `sqlite-vec`, fuzzy title bằng trigram. Gộp bằng weighted RRF (vector 1,5, BM25 1,5, alias chính xác 2,0). Có rerank tuỳ chọn và truy vấn nhiều câu cùng lúc.
- **Chunking:** nguyên note nếu vừa model, không thì cắt theo heading, rồi theo cửa sổ 512 token, chồng 64.
- **Model:** mặc định `Xenova/multilingual-e5-small` (q8 ONNX, CPU, ~117MB). Tự thêm prefix `query:`/`passage:` cho e5. Remote qua `OPENAI_BASE_URL` (OpenRouter, Ollama, LM Studio) hoặc endpoint Ollama. Rerank `gte-multilingual-reranker-base` (~341MB, tuỳ chọn).
- **Cài:** `npm install -g obsidian-hybrid-search`, đặt `OBSIDIAN_VAULT_PATH`, chạy `ohs reindex`. Cần Node 20+. Không cần Docker, GPU hay Ollama. CI chạy ubuntu, macOS, Windows.
- **Agent:** MCP stdio và HTTP (`ohs serve`, 127.0.0.1:3939), CLI có `--json`. Tool: `search`, `read`, `reindex`, `status`. Chạy không cần Obsidian.
- **Điểm yếu:** tiếng Việt chưa đo. BM25 dùng tokenizer `unicode61` (không tách từ tiếng Việt, tách theo âm tiết). HTTP không có auth ngoài chặn Host header. Không có hướng dẫn đồng bộ nhiều máy.
- **Lưu ý quan trọng khi nhiều máy:** DB nằm trong vault tại `<vault>/.obsidian-hybrid-search.db`, chế độ WAL. Phải đưa file này (và `-wal`, `-shm`) vào ignore của công cụ sync. Máy nào cũng phải dùng cùng cấu hình model, vì repo từ chối ghi khi model khác model đã lưu (cần `reindex --force`).

### 2. qkb

- Hybrid BM25 + vector + RRF, rerank Qwen3-Reranker local. Model mặc định embeddinggemma-300M (GGUF, chạy trong tiến trình qua node-llama-cpp). Có provider `ollama` và `openai-compatible` với base URL + key.
- MCP stdio hoặc HTTP, tool `qkb`, `qkb_get`, `qkb_status`. Có Docker image và Homebrew formula (theo README).
- **Rào cản:** mọi note phải có frontmatter `id` duy nhất. Với vault có sẵn đây là việc lớn.
- Tiếng Việt: embeddinggemma được Google mô tả là đa ngôn ngữ (repo không xác nhận). FTS dùng `porter unicode61`, stemmer tiếng Anh.
- Repo mới, 0 sao.

### 3. qmd

- Retrieval mạnh nhất trong nhóm: BM25 + vector + mở rộng query (HyDE) + rerank. 30,5k sao, cập nhật gần đây.
- **Không có remote embedding.** Toàn bộ chạy local qua node-llama-cpp, ~2GB model, chậm trên CPU. Model mặc định embeddinggemma được README gọi là tối ưu cho tiếng Anh. Muốn tiếng Việt phải đổi sang Qwen3-Embedding-0.6B qua `QMD_EMBED_MODEL`.
- MCP stdio hoặc HTTP (localhost:8181), CLI `--json`. Không phải plugin Obsidian.
- Hai plugin qmd cho Obsidian (achekulaev, thirteen37) chỉ là lớp mỏng bọc qmd, hoặc dùng MiniLM tiếng Anh cố định. Không đáng dùng.

### 4. open-connections (fork của Smart Connections)

- Plugin có trong store (theo README). Chọn được bge-m3, multilingual-e5, paraphrase-multilingual-MiniLM, hoặc API OpenAI/Gemini/Ollama/LM Studio/OpenRouter.
- Chỉ dense cosine, không BM25, không rerank. Model mặc định `bge-micro-v2` tiếng Anh.
- MCP stdio/HTTP có token bắt buộc. **Nhưng MCP độc lập không dùng được model local Transformers**: truy vấn headless phải qua API provider.
- `manifest.json` ghi desktop-only, README nói chạy mobile: mâu thuẫn.
- Repo `Xia-Ataraxia/obsidian-open-connections` có cùng commit HEAD, nên là cùng mã nguồn.

### 5-6. thoreinstein/obsidian-mcp và ravila4

- thoreinstein: hybrid (vector + FTS, RRF) qua LanceDB, MCP stdio, có hook reindex cho Claude Code và công cụ đánh giá recall@5/MRR. Model MiniLM tiếng Anh, chỉ local, cài từ source với native deps.
- ravila4: CLI + skill cho agent, LanceDB, embed qua Ollama/LM Studio/Gemini. Vector-only. `mcp` có trong dependency nhưng không có code MCP.

### 7. Smart Connections + smart-connections-mcp

- Dễ cài nhất, có sẵn giao diện. Core miễn phí chỉ có model local, không có endpoint remote (API tích hợp chuyển sang bản Pro).
- Plugin không có MCP. Bridge `smart-connections-mcp` đọc `.smart-env/`, nhúng query bằng model plugin đang chọn, **nhưng chỉ khi transformers.js load được model đó**. Không có prefix e5. Model là OpenAI/Ollama thì bridge rơi về tìm theo từ khoá.
- Kết luận cho câu hỏi trước: dùng e5 với bridge này có nguy cơ lệch không gian vector. Dùng OHS thay vì ghép hai thứ.
- Giấy phép Smart Plugins License (tuỳ chỉnh, MIT-like, cấm dùng làm thành phần chính của sản phẩm cạnh tranh).

## Bài học xuyên repo (convergence)

- **Hybrid RRF** xuất hiện độc lập ở OHS, qkb, qmd, thoreinstein. Đây là hướng cho kết quả tốt hơn dense-only (nhận định từ thiết kế, chưa có benchmark chéo giữa các repo).
- **Chunk theo heading, có breadcrumb** (đường dẫn heading đưa vào text embed): OHS, qkb, thoreinstein, ravila4, open-connections.
- **Index tăng dần bằng hash nội dung và debounce file watcher**: OHS, thoreinstein, qkb, chromadb-sync.
- **Chặn lệch model:** OHS từ chối ghi khi model đổi, thoreinstein tách thư mục index theo model. Cần thiết cho nhiều máy.
- **Index là file nhị phân, không sync được an toàn:** không repo nào có thiết kế sync. Quy tắc chung vẫn là mỗi máy tự build, hoặc một máy chạy server cho các máy khác truy cập (qkb và chromadb-sync nhắm tới mô hình này).

## Những gì chưa biết

- Chất lượng tiếng Việt của mọi repo: chưa đo.
- Kích thước index và thời gian build trên vault thật.
- Nhiều chi tiết lấy từ README (đánh dấu "README claims" trong profile) và chưa chạy thử.
- 10 repo chưa distill, nằm trong `intake` của `distill.yaml`: obsidian-semantic-search (nigel), Obsidian-Seek, vault-mcp (robbiemu, willfanguy), vault-rag-mcp (fjacquet), obsidian-notes-rag (proofgeist), obsidian-mcp (maxkuminov), obsidian-search-plus-engine, Semlink, obsidian-semantic-mcp (Joynik). Chưa cần làm tiếp vì đã chọn được ứng viên; mở lại nếu OHS không đạt.
- Chưa khảo sát: Copilot for Obsidian, Khoj, Infio Copilot, Omnisearch (từ khoá, không semantic), VaultSearch, Semantic Backlinks, ZVec Hybrid Search.

## Bước tiếp theo đề xuất

1. Cài OHS trên một máy, trỏ vào vault, chạy `ohs reindex`. Ghi lại thời gian build và kích thước `.obsidian-hybrid-search.db`.
2. Làm bộ test 15-20 query tiếng Việt (có dấu, không dấu, lẫn Anh-Việt) với note đáp án biết trước. Đếm số lần đáp án vào top 5.
3. Nếu chưa đủ: bật `--rerank`, hoặc đổi sang model lớn hơn qua `LOCAL_EMBEDDING_MODEL` (multilingual-e5-base/large), hoặc remote `bge-m3` qua `OPENAI_BASE_URL`.
4. Thêm `.obsidian-hybrid-search.db*` vào ignore của công cụ sync. Mỗi máy tự `reindex`.
5. Nối MCP vào Claude Code. Nếu cần dùng từ máy khác, dùng SSH stdio hoặc bind HTTP vào mạng riêng (Tailscale), không mở ra internet vì HTTP không có auth.
