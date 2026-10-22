# Smart Connections cho vault Obsidian lớn + tiếng Việt

Ngày nghiên cứu: 2026-10-22. Nguồn: README/docs chính thức, release notes, vài bài bên thứ ba. Chỗ nào chưa kiểm chứng được ghi rõ.

## 1. Plugin là gì

- Plugin semantic search của Brian Petro. Embedding chạy **local**, không cần API key.
- Hai view chính:
  - **Connections**: note liên quan tới note đang mở, cập nhật khi sửa.
  - **Lookup**: tìm theo ngữ nghĩa toàn vault. Lưu ý: match đúng chữ không đảm bảo xuất hiện, vì tìm theo nghĩa chứ không theo chuỗi.
- Kiến trúc v4: **Smart Environment** là lõi chung. Nó giữ index embedding, nghe sự kiện Obsidian để đồng bộ, quản lý model, nguồn, exclusion.
- Dữ liệu lưu ở `.smart-env/` trong vault.
- Smart Chat đã tách thành plugin riêng. Tích hợp API (cloud/Ollama...) nằm ở Smart Chat Pro.
- License: source-available, core miễn phí. Pro trả phí qua supporter plan (giá không công bố trong trang đã đọc).

## 2. Cơ chế search, và giới hạn khi vault lớn

Theo bài [starlog.is](https://starlog.is/articles/ai-dev-tools/brianpetro-obsidian-smart-connections) (bên thứ ba, chưa đối chiếu code):

- Embedding theo **block** (đoạn, list item, heading + nội dung). Model mặc định: all-MiniLM-L6-v2 quantized, ~25MB, vector 384 chiều.
- Search **brute force**: cosine với mọi vector, không có ANN (HNSW/FAISS).
- Độ trễ báo cáo: dưới ~5.000 note dưới 100ms; ~8.000-10.000 note khoảng 0,5-1s; 20.000+ note chậm rõ.
- Bài cũng nói "sửa note thì embed lại cả file". Có thể đã lỗi thời so với v4.5+, chưa xác minh.

Trang chính thức không đưa benchmark. Trang plugin cộng đồng xếp "large vault performance" vào tính năng Pro. Con số lag trên chỉ là báo cáo người dùng, **tự đo trên vault của bạn**.

## 3. Núm chỉnh để nhanh hơn (docs chính thức)

| Việc | Free/Pro | Tác dụng |
|---|---|---|
| Exclude folder (archive, backup, export, clipping) | Core | Giảm số vector, ít tốn nhất, hiệu quả nhất |
| Exclude file lẻ | Pro | Như trên, mịn hơn |
| Tắt Embed blocks | Pro | Nhanh, nhẹ hơn, nhưng match thô theo cả note |
| Bật Embed blocks + result type "Blocks" | Pro | Chính xác hơn với note dài, tốn thêm lưu trữ/CPU |
| Min length to embed (sources/blocks) | Pro | Bỏ note/template quá ngắn, giảm nhiễu |
| Re-import wait time cao hơn | Pro | Ít re-embed khi đang gõ, đỡ CPU |
| Rerank stage, scoring tuỳ chỉnh | Connections Pro | Tăng độ chính xác xếp hạng |

Lưu ý vận hành:
- Đổi model: chọn model, rồi **Re-index embeddings**, chờ "Ready". Không dùng "Reset data" cho việc này (Reset nặng trên vault lớn).
- Đổi exclusion lớn: restart Obsidian hoặc reset data.
- Sync bằng Syncthing/Git/Dropbox: **ignore `.smart-env/`**. Obsidian Sync thì ổn.
- Nút "Embed now" trên status bar chạy embed thủ công.

## 4. Tiếng Việt

Model mặc định (MiniLM) thiên tiếng Anh, tiếng Việt sẽ kém.

Tuỳ chọn:

1. **multilingual-e5-small** (built-in): thêm ở v4.1.6 (22/12), sửa nguồn model ở v4.1.7 (03/01). Release v4.7.x ghi thêm "model local nhẹ hơn và đa ngôn ngữ". Dùng trong free Core, ít cấu hình nhất.
2. **bge-m3**: không thấy trong bản chính thức. Có trong fork bên thứ ba [open-connections](https://github.com/goberomsu/open-smart-connections) (7 provider, gồm Xenova/bge-m3 và Ollama). Context dài (8192 token), chất lượng cao, nhưng nặng hơn rõ.
3. **Ollama / API embedding**: bản chính thức đã chuyển phần API sang Smart Chat Pro, nên đường này có thể cần Pro. Chưa xác minh chính xác plugin nào cho trỏ embedding sang `localhost:11434`. Bài [localaimaster](https://localaimaster.com/blog/local-ai-obsidian-integration) ví dụ nomic-embed-text, mà model này thiên tiếng Anh, không hợp tiếng Việt.

Benchmark:
- [SEA-BED](https://arxiv.org/pdf/2508.12243): trung bình Đông Nam Á, multilingual-e5-large ~75.9, bge-m3 ~74.7, e5-large-instruct ~78.2. Đây là trung bình vùng, không riêng tiếng Việt.
- [VN-MTEB](https://arxiv.org/html/2507.21500v1): 41 dataset tiếng Việt, đây là nguồn chuẩn để so model. Chưa lấy được số từng model.
- Có fine-tune bge-m3 cho tiếng Việt: [nrl-ai/vietnamese-embedding-bge-m3](https://huggingface.co/nrl-ai/vietnamese-embedding-bge-m3) (~300k triplet, 2048 token). Chưa có điểm.
- **Không có so sánh trực tiếp** e5-small vs bge-m3 cho tiếng Việt. Kết luận "cái nào tốt hơn" chưa có bằng chứng.

Rủi ro cần kiểm tra:
- e5 cần prefix `query: ` / `passage: ` để đạt chất lượng tốt. **Chưa xác minh** plugin có tự thêm không.
- e5-small giới hạn 512 token, block dài bị cắt.
- Tiếng Việt có dấu/không dấu: model đa ngôn ngữ xử lý không dấu kém hơn. Nếu note viết lẫn, test riêng.
- Đổi sang model lớn hơn làm index và thời gian re-embed tăng, đúng vào lúc vault đã lớn.

## 5. Khuyến nghị theo bước

1. Cài Smart Connections, chạy model mặc định, ghi lại: số note, thời gian index, độ trễ Lookup.
2. Exclude mọi folder không cần search (archive, attachments text, web clipping). Thường giảm tải nhiều nhất.
3. Đổi sang **multilingual-e5-small**, Re-index, rồi làm bộ test nhỏ: 15-20 query tiếng Việt (có dấu, không dấu, lẫn Anh-Việt) với note đáp án biết trước. Đếm hit trong top 5.
4. Nếu vault >10k note hoặc e5-small chưa đủ chính xác: cân nhắc Connections Pro (block, rerank, filter), hoặc thử fork open-connections với bge-m3.
5. Cần tìm đúng chữ/tên riêng/mã: Smart Connections không thay được search từ khoá. Dùng search mặc định của Obsidian song song, hoặc plugin hybrid (BM25 + vector). Chưa khảo sát plugin hybrid trong lần này.

## 6. Còn chưa biết

- Số liệu hiệu năng chính thức theo kích thước vault.
- Cơ chế index hiện tại (v4.7) còn brute force không, có incremental không.
- Plugin có áp prefix e5 không.
- Điểm VN-MTEB retrieval của e5-small vs bge-m3.
- Giá Pro, và Pro có cho cắm embedding provider ngoài không.

## Nguồn

- [Smart Connections (GitHub)](https://github.com/brianpetro/obsidian-smart-connections)
- [Releases](https://github.com/brianpetro/obsidian-smart-connections/releases)
- [Smart Environment settings](https://smartconnections.app/smart-environment/settings/)
- [Plugin page](https://community.obsidian.md/plugins/smart-connections)
- [starlog.is review](https://starlog.is/articles/ai-dev-tools/brianpetro-obsidian-smart-connections)
- [open-connections fork](https://github.com/goberomsu/open-smart-connections)
- [SEA-BED](https://arxiv.org/pdf/2508.12243), [VN-MTEB](https://arxiv.org/html/2507.21500v1)
