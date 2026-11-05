# CampusMatch TH3

Bản mẫu hệ thống tìm việc thông minh tích hợp AI và BI, tiếp nối thiết kế CampusMatch ở nhiệm vụ trước.

## Chức năng đã chạy

- CV dạng văn bản dán, tệp `.txt` hoặc ảnh JPG/PNG/WEBP; trích xuất kỹ năng theo từ điển hoặc phân tích bằng Gemini có bằng chứng và bước xác nhận.
- TF-IDF học từ vựng/IDF từ 12 JD train. Cosine kết hợp tỷ lệ khớp kỹ năng, địa điểm và hình thức. Lịch làm là điều kiện lọc cứng.
- Tin tuyển dụng, hồ sơ, đơn và lịch sử trạng thái lưu trong Cloudflare D1 (SQLite).
- Dashboard kỹ năng, lương công bố, funnel theo cohort và xuất CSV.
- Gửi đơn, ngăn gửi trùng, lưu snapshot hồ sơ và kiểm tra chuyển trạng thái.
- Đăng tin mới; tin mới dùng mô hình đã fit, không tự thay đổi mô hình.
- Tư vấn CV theo một JD tự nhập: đối chiếu từng yêu cầu với trích dẫn, tổng hợp bằng chứng/skill gaps, đề xuất outline CV liên kết với các gap, xuất bản phân tích và khung thuyết minh; theo dõi 6 checklist của bài cá nhân.

## Giới hạn

Dữ liệu gồm 16 tin, 12 CV, 4 doanh nghiệp và 40 đơn ban đầu, tất cả giả lập. Nhãn đánh giá là kỳ vọng do người thiết kế đặt, chưa có chuyên gia độc lập xác nhận. Không coi điểm là xác suất tuyển dụng. Đọc CV mặc định dùng từ điển; Gemini là lựa chọn bổ sung cần cấu hình API key, hỗ trợ đọc văn bản từ ảnh. Kết quả Gemini và chữ đọc từ ảnh cần người dùng kiểm tra, chưa có bộ đánh giá chất lượng độc lập. Chưa đọc PDF/DOCX. Site riêng tư cho một chủ sở hữu; chưa triển khai RBAC đa doanh nghiệp và chưa dùng cho tuyển dụng thật.

## Kiến trúc

React + TypeScript (Vinext) / REST API / Cloudflare D1. Mô hình và BI chạy tại backend. Mã nguồn chính: `app/page.tsx`, `app/api/[...path]/route.ts`, `lib/matching.mjs`, `lib/repository.ts`, `db/schema.ts`. SQL: `drizzle/0000_puzzling_vulcan.sql`. Tập mẫu, mô hình và kết quả: `data/`.

## Tái lập kiểm thử

Cần Node.js >=22.13 (Node 24 được dùng để kiểm thử), pnpm theo `packageManager`.

```bash
corepack enable
pnpm install --frozen-lockfile
node --test tests/core.test.mjs
node --loader ./tests/ts-loader.mjs --test tests/api.test.mjs
node --loader ./tests/ts-loader.mjs --test tests/cv-analysis.test.mjs
node --loader ./tests/ts-loader.mjs --test tests/career-analysis.test.mjs
node tests/evaluate.mjs
pnpm exec tsc --noEmit
```

`api.test.mjs` chạy trực tiếp các handler API với adapter D1 dùng SQLite trong bộ nhớ, kiểm tra cả SQL và giao dịch, không đi qua HTTP production. Dữ liệu kiểm thử này tách khỏi database live. Dùng UI để kiểm tra transport và lưu trữ trong môi trường chạy.

## Chạy bản mẫu ở máy phát triển

Trên Windows, nếu dự án đã cài dependencies và build, mở PowerShell trong thư mục dự án rồi chạy `./start.cmd`, hoặc nhấp đúp tệp `start.cmd`. Tệp này dùng Node.js ở `E:\nodejs` nếu có, nên không cần PowerShell nhận lệnh pnpm. Dừng server bằng `Ctrl+C` trong cửa sổ đang chạy.

```bash
pnpm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_puzzling_vulcan.sql
pnpm run start
```

Chỉ áp dụng migration một lần trên database mới. Lệnh start in URL local. Mở URL rồi chờ ứng dụng gọi POST `/api/init` để seed dữ liệu mẫu. Seed dùng INSERT OR IGNORE và chỉ đánh dấu hoàn tất sau khi các lô dữ liệu đã lưu. Local và production dùng database riêng.

Tệp hosting của bản tải xuống đã bỏ định danh Site gốc. Không nhập project_id tùy ý. Việc xuất bản bằng Sites cần tạo dự án mới và áp dụng migration theo workflow của Sites.

## Phân tích CV bằng Gemini (tùy chọn)

1. Tạo API key tại https://aistudio.google.com/apikey.
2. Sao chép `.env.example` thành `.env` ở thư mục gốc và điền `GEMINI_API_KEY` bằng key của bạn. Có thể đổi `GEMINI_MODEL` theo model tài khoản được phép dùng; mặc định `gemini-3.5-flash-lite`.
3. Chạy lại `pnpm run start` (hoặc `pnpm run dev`). Không cần build lại chỉ để thay key. Lệnh start nạp `.env` bằng đường dẫn tuyệt đối, kể cả khi cấu hình Wrangler được build trong `dist/server`.
4. Mở **CV & gợi ý việc làm**, nhập CV rồi bấm **Phân tích bằng Gemini**. Nội dung CV được gửi từ backend đến Google khi bấm nút này. **Đọc kỹ năng** vẫn chỉ dùng từ điển tại backend, không gọi Gemini.

Để dùng ảnh, trong phần **Phân tích ảnh CV** chọn một ảnh JPG, PNG hoặc WEBP, tối đa 5 MB, rồi bấm **Đọc & phân tích ảnh**. Chỉ khi bấm nút, ảnh mới được gửi qua backend tới Gemini bằng `inlineData`; không tải lên dịch vụ lưu file riêng hoặc lưu ảnh vào D1/R2. Xem trước ảnh diễn ra ngay trong trình duyệt. Khi thành công, nội dung đọc được sẽ thay ô **Nội dung CV**, kỹ năng được cập nhật và dấu xác nhận được bỏ. Kiểm tra tên ứng viên, sửa chữ đọc sai nếu cần, rồi xác nhận và lưu hồ sơ. Sửa văn bản sẽ xóa phần phân tích cũ; có thể phân tích lại từ văn bản đã sửa. Khi lỗi, hồ sơ đang nhập được giữ nguyên.

Backend giới hạn dung lượng cả lúc đọc stream không có `Content-Length`, kiểm tra MIME và chữ ký PNG/JPEG/WEBP, từ chối nhiều ảnh hoặc ảnh không đọc được. Kiểm tra bằng chứng với ảnh dựa trên bản chép chữ do chính Gemini trả về, không phải một công cụ OCR độc lập; chữ vẫn có thể bị đọc sai hoặc thiếu. Chụp thẳng, đủ trang và rõ chữ. Hiện chỉ hỗ trợ một ảnh mỗi lượt; PDF/DOCX và gộp nhiều trang chưa tích hợp.

Gemini trả tóm tắt, kinh nghiệm/học vấn, điểm mạnh, gợi ý cải thiện và kỹ năng kèm trích dẫn nguyên văn. Backend kiểm tra JSON, danh mục kỹ năng và việc bằng chứng có trong CV; người dùng vẫn phải xác nhận. Kỹ năng ngoài danh mục được hiển thị để tham khảo, chưa tham gia điểm ghép việc. Phần tóm tắt được hiển thị trong phiên giao diện, không tự lưu vào database; hồ sơ lưu kỹ năng do người dùng xác nhận. Kết quả phân tích được xóa khỏi giao diện khi sửa nội dung CV hoặc chuyển hồ sơ.

API key chỉ đọc ở backend qua `cloudflare:workers`, không trả về trình duyệt. `.env` được Git bỏ qua; không đặt key trong biến `NEXT_PUBLIC_*`, mã nguồn hoặc `.openai/hosting.json`. Khi triển khai, cấu hình secret `GEMINI_API_KEY` và giá trị `GEMINI_MODEL` trong môi trường hosting. Không dùng tệp `.env` cục bộ làm cấu hình production.

API: `GET /api/cv/config` trả trạng thái cấu hình, `POST /api/cv/parse` nhận `{ "text": "...", "provider": "gemini" }`; bỏ `provider` để dùng từ điển. Thiếu key trả 503, quota trả 429, timeout trả 504; không tự đổi sang từ điển khi Gemini lỗi. Các kiểm thử Gemini dùng phản hồi giả lập, không tiêu tốn quota và không xác minh key thật.

API ảnh: `POST /api/cv/image` nhận `multipart/form-data` chỉ có một file trong trường `image`; trả `extracted_text`, `source: "image"`, `skills`, `analysis` và `requires_confirmation: true`. Ảnh vượt 5 MB trả 413, sai định dạng trả 415, ảnh mờ/không phải CV trả 422. Giới hạn JSON 100 KB của các API văn bản giữ nguyên.

Tài liệu: https://ai.google.dev/api/generate-content, https://ai.google.dev/gemini-api/docs/structured-output và https://ai.google.dev/gemini-api/docs/image-understanding.

## Bài cá nhân: Phân tích CV và Skill Gaps

Mở **Tư vấn CV theo JD**. Nhập CV thực tế (văn bản/.txt hoặc đọc ảnh qua Gemini), tên vị trí, JD cụ thể và nguồn tin. Có thể lấy CV đang chọn ở mục gợi ý hoặc lấy tin trong hệ thống; bộ seed là dữ liệu giả lập nên không tự được đánh dấu là CV/JD thật. Không cần đăng tin vào database để tư vấn một JD bên ngoài.

Bấm **Phân tích gaps & outline CV** để gửi cặp CV–JD tới Gemini. Kết quả gồm:

- Yêu cầu JD với trích dẫn nguyên văn; bằng chứng CV nếu có; phân loại có bằng chứng / CV chưa thể hiện đủ / cần phát triển theo thông tin CV; mức ưu tiên và hành động.
- Tổng hợp BI theo cặp CV–JD: số yêu cầu được trích, số có bằng chứng và các nhóm gap. Tỷ lệ có bằng chứng chỉ tính trên các yêu cầu AI đã trích, không phải xác suất tuyển dụng, Matching Score hay dữ liệu thị trường.
- Outline CV theo thứ tự phù hợp JD, có lý do và liên kết tới các yêu cầu. Mọi gap phải được tham chiếu trong outline. Bố cục không thay thế việc học kỹ năng thực sự còn thiếu.
- Khung thuyết minh khoảng 2 phút 50 giây, xuất Markdown sau khi người dùng xác nhận kiểm tra đối chiếu và outline.

Backend kiểm tra cấu trúc, trích dẫn có trong CV/JD gốc, yêu cầu trùng tên và liên kết outline. Kỹ năng ngoài danh mục Matching Score vẫn được tư vấn, không thay đổi thuật toán ghép việc. Các kiểm tra này không chứng minh tính đúng đắn ngữ nghĩa của AI; người dùng phải xác nhận. Nếu ít hơn 3 gaps, giao diện báo chưa đủ, không tạo gap cho đủ số lượng.

Nội dung tư vấn chỉ giữ trong bộ nhớ trang, không tự ghi vào database hoặc localStorage; chuyển tab trong ứng dụng giữ bản nháp, tải lại trang sẽ mất. CV và JD được gửi tới Google khi bấm phân tích; đọc ảnh cũng gọi Google. Không tự lưu ảnh. Tệp Markdown tải về có trích dẫn CV, cần tự quản lý thông tin cá nhân.

Checklist về CV thật/JD cụ thể do người dùng xác nhận. Checklist phân tích cần ít nhất 3 gaps đã kiểm chứng, outline cần được xem lại. Video 2–3 phút và nộp đúng hạn do người học tự thực hiện và xác nhận; phần mềm không tự quay hoặc tự nộp. Xem [hướng dẫn demo bài cá nhân](docs/individual-assignment.md).

Kiểm thử mới nằm trong `tests/career-analysis.test.mjs`, dùng phản hồi Gemini mô phỏng, không gọi key thật. Báo cáo kiểm thử 69 ca trong `output/pdf` phản ánh phiên bản trước khi thêm tính năng tư vấn này; không dùng số 69 làm tổng kiểm thử của phiên bản mới.

## Công thức Matching Score

Score = 100 × (0.50 × skill coverage + 0.30 × cosine TF-IDF + 0.10 × location match + 0.10 × work-mode match).

Chỉ trả đủ điểm khi hồ sơ xác nhận, đủ thông tin và tin còn mở, chưa hết hạn, không trùng lịch. Trọng số cố định, không tối ưu bằng nhãn test. 4 CV validation, 8 CV test; ranking trên toàn bộ 16 tin, không phải kiểm thử chỉ trên tin mới. Baseline là TF-IDF thuần và thứ tự mã tin. Precision/Recall@3 dùng nhãn >=2 là phù hợp, NDCG@3 dùng gain tuyến tính 0–3.

## Nguồn kỹ thuật

- https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.text.TfidfVectorizer.html
- https://scikit-learn.org/stable/modules/generated/sklearn.metrics.ndcg_score.html
- https://www.sqlite.org/foreignkeys.html
- https://developers.cloudflare.com/d1/reference/migrations/

Không cần khóa API hoặc kết nối dữ liệu tuyển dụng bên ngoài để chạy bộ mẫu với cách đọc từ điển. Tính năng Gemini cần API key hợp lệ và tuân theo hạn mức/chi phí của tài khoản Google.
