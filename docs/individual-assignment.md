# Hướng dẫn thực hiện bài cá nhân: CV và Skill Gaps

Mục tiêu: tư vấn một CV thực tế so với một JD cụ thể, chỉ ra ít nhất ba khoảng trống có căn cứ, đề xuất outline CV và quay video 2–3 phút. CV thật và video do người thực hiện cung cấp khi demo.

## Chuẩn bị

1. Chọn CV của bản thân hoặc người đã đồng ý cho sử dụng. Có thể che số điện thoại, địa chỉ và thông tin không cần thiết trước khi đưa vào hệ thống hoặc quay màn hình.
2. Chọn JD phù hợp mục tiêu nghề nghiệp. Lưu tên vị trí, doanh nghiệp, nội dung yêu cầu, nguồn và ngày ghi nhận. Dùng tin giả lập chỉ để tập thao tác, không giới thiệu thành tin tuyển dụng thật.
3. Kiểm tra cấu hình Gemini ở backend. Key không điền vào form và không xuất hiện trong video. Chạy ứng dụng theo README; chức năng mới cần build lại nếu đang dùng bản production local.

## Thao tác demo

1. Mở **Tư vấn CV theo JD**. Nhập tên người trình bày, dán hoặc tải CV .txt. Nếu CV là ảnh, mở phần đọc ảnh, gửi một ảnh rõ chữ rồi kiểm tra lại văn bản OCR. PDF/DOCX chưa hỗ trợ trực tiếp.
2. Nhập tên vị trí, JD, nguồn và ngày ghi nhận. Có thể chọn tin có sẵn để tập; không bắt buộc đăng JD bên ngoài vào database.
3. Sau khi kiểm tra, tự xác nhận CV thực tế được phép sử dụng và JD cụ thể phù hợp mục tiêu.
4. Bấm **Phân tích gaps & outline CV**. Hệ thống gửi cặp CV–JD hiện tại tới Gemini, không dùng CV khác. Chờ kết quả hoặc xử lý thông báo cấu hình/quota/lỗi dịch vụ.
5. Kiểm tra tổng hợp BI theo cặp CV–JD. Đối chiếu từng yêu cầu và trích dẫn với bản gốc. Bộ lọc cho phép xem riêng gaps hoặc toàn bộ yêu cầu.
6. Chọn ít nhất ba gap khác nhau có căn cứ. Với mỗi gap, nêu yêu cầu JD, bằng chứng hoặc phần chưa thể hiện trong CV, mức ưu tiên và hành động. Không kết luận thiếu kỹ năng chỉ từ việc CV không ghi. Nếu ít hơn ba gap, kiểm tra các yêu cầu AI có thể bỏ sót hoặc chọn JD khác phù hợp mục tiêu thực tế; không xóa kỹ năng có thật hoặc tạo gap để đủ số.
7. Xem outline theo thứ tự. Giải thích mục nào được đưa lên trước và liên hệ từng mục với R1…Rn. Kiểm tra mọi nội dung bổ sung có thật; kế hoạch học chưa hoàn thành không được ghi thành kinh nghiệm đã có.
8. Xác nhận phần đối chiếu và outline để tải Markdown chứa kết quả cùng khung thuyết minh. Sửa CV/JD sẽ xóa kết quả cũ và các xác nhận liên quan; cần phân tích lại.

## Minh chứng cần xuất hiện trong video

| Khoảng thời gian gợi ý | Nội dung |
|---|---|
| 0:00–0:20 | Giới thiệu bản thân, mục tiêu và CV được phép sử dụng; đóng vai chuyên gia tư vấn. |
| 0:20–0:40 | JD cụ thể, nguồn tin, lý do chọn và cách dùng AI/BI để đối chiếu. |
| 0:40–1:40 | Ba gaps có căn cứ. Với mỗi mục: trích dẫn JD → tình trạng bằng chứng CV → hành động. |
| 1:40–2:30 | Outline CV mới, lý do sắp xếp và liên hệ với ba gaps. |
| 2:30–2:50 | Chốt ưu tiên cải thiện và giới hạn của AI. |

Đây là khung thời gian, không phải bảo đảm tự động về độ dài. Người thực hiện cần tập nói và xem lại video để đạt 2–3 phút.

## Điều kiện xác nhận sáu checklist

| Mục | Điều kiện/minh chứng |
|---|---|
| 1 | CV thực tế và quyền sử dụng do người thực hiện xác nhận. |
| 2 | JD cụ thể phù hợp mục tiêu nghề nghiệp; có nội dung để đối chiếu. |
| 3 | Ít nhất ba gaps từ kết quả phân tích, đã đối chiếu với CV/JD gốc. |
| 4 | Outline CV theo JD, giải thích được liên hệ với gaps; đã kiểm tra tính trung thực. |
| 5 | Tự quay, xem lại video đủ nội dung và dài 2–3 phút. |
| 6 | Tự kiểm tra hạn, kênh nộp và hoàn tất nộp đúng quy định. |

Giao diện chỉ theo dõi các xác nhận, không xác minh giấy tờ, xem video, tự quay hoặc tự nộp. Điền hạn nộp và xác nhận video/nộp bài sau khi thực hiện thật.

## Phạm vi kỹ thuật và giới hạn

- Có thể tư vấn kỹ năng ngoài danh mục ghép việc như TypeScript hoặc Docker. Điểm Matching Score hiện có không bị thay đổi bởi luồng tư vấn.
- Trích dẫn được kiểm tra có trong nguồn, yêu cầu trùng tên bị chặn và outline phải liên kết mọi gap. Các kiểm tra không bảo đảm suy luận ngữ nghĩa của AI đúng; người thực hiện cần kiểm chứng.
- Tổng hợp BI là số lượng/phân bố bằng chứng trong các yêu cầu được AI trích từ một JD, không phải thống kê thị trường lao động. Không dùng dashboard dữ liệu giả lập làm bằng chứng về nhu cầu thị trường thật.
- Không lưu bản nháp tư vấn vào database/localStorage; chuyển tab giữ nội dung nhưng tải lại trang sẽ mất. Tải bản Markdown nếu cần giữ kết quả đã kiểm tra.
- Không tuyên bố đủ 6 checklist trước khi có CV thật, JD được chọn, phân tích đã xác nhận, video và xác nhận nộp bài thực tế.

## Kiểm thử chức năng bổ sung

`node --loader ./tests/ts-loader.mjs --test tests/career-analysis.test.mjs`

15 ca kiểm tra: đầu vào và cấu hình, truyền đúng CV–JD, kỹ năng ngoài danh mục, không ép đủ ba gaps, không có gaps, từ chối trích dẫn bịa và yêu cầu trùng, quy tắc trạng thái, liên kết outline, đầu ra lỗi, quota/mạng/timeout, bảo vệ Origin, hợp đồng API và bản xuất thuyết minh. Các phản hồi Gemini được mô phỏng; chưa phải đánh giá chất lượng tư vấn trên CV thực tế hoặc đo độ chính xác OCR.

Lượt xác minh ngày 06/11/2026: 84/84 ca toàn dự án đạt (32 lõi + 18 API + 19 CV/ảnh + 15 tư vấn); TypeScript và production build đạt. Kiểm tra trình duyệt Microsoft Edge headless trên bản local đạt 10 tình huống, gồm giữ bản nháp khi chuyển tab, xóa kết quả khi sửa JD, xác nhận trước xuất, lỗi quota, cảnh báo dưới ba gaps và bố cục 390 px. CV/JD và phản hồi Gemini trong lượt thử giao diện đều giả lập. Nhật ký và mã SHA256 nguồn được lưu tại [individual-assignment-evidence/validation.json](individual-assignment-evidence/validation.json).
