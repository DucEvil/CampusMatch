# Hợp đồng API CampusMatch

Tất cả phản hồi là JSON, Cache-Control: no-store. Các POST yêu cầu Content-Type: application/json và một đối tượng JSON. Origin khác bị từ chối. Bản private dựa vào cổng truy cập của Sites. Đây là không gian demo một chủ sở hữu, chưa phải xác thực và phân quyền đa tenant.

| Method | Path | Đầu vào | Đầu ra |
|---|---|---|---|
| GET | /api/health | Không | ok, model |
| POST | /api/init | {} | Seed lặp lại an toàn, ok, synthetic |
| GET | /api/data | Không | employers, skills, candidates, jobs, applications, events, salary_snapshots, model |
| POST | /api/cv/parse | text 20–30000 ký tự | skills[{skill,evidence,method,requires_confirmation}], warning |
| POST | /api/cv/consult | cv_text 20–30000, job_title 2–150, jd_text 30–15000, jd_source tùy chọn tối đa 500 ký tự | target, requirements, outline, statistics, assignment, model, warning |
| POST | /api/profiles | name, text, skills[], city, mode, days[], confirmed=true | id=MY_PROFILE, message |
| POST | /api/match | candidate_id | id lượt chạy, results, profile_version, model_version |
| POST | /api/jobs | employer_id,title,description,role,city,mode,days[],skills[],salary_min,salary_max,deadline | id tin mới |
| POST | /api/applications | candidate_id,job_id | id đơn, message |
| GET | /api/applications | Không | Danh sách đơn |
| POST | /api/applications/status | id, status | ok |
| GET | /api/bi | city,role,from,to (query) | applications,candidates,open_jobs,hire_rate,skills,funnel,trend,missing_salary,rejected |

Các giá trị mode: Any (chỉ hồ sơ), Remote, Hybrid, Onsite. days: số nguyên duy nhất 2–8, 8 là Chủ nhật. role: frontend, data, backend, content. Địa điểm: Hà Nội, TP Hồ Chí Minh, Đà Nẵng. Bản mẫu dùng VND/tháng. salary_min và salary_max là số nguyên, 0 <= min <= max <= 1.000.000.000.

Mã lỗi: 400 dữ liệu sai hoặc chưa xác nhận; 403 Origin không hợp lệ; 404 hồ sơ/tin/đơn không tồn tại; 409 đơn trùng hoặc trạng thái thay đổi; 413 nội dung quá lớn; 500 lỗi xử lý nội bộ. Không đưa stack trace hoặc nội dung CV vào lỗi trả cho client.

Trạng thái: submitted → screened → interview → offered → hired. Từ submitted, screened, interview, offered có thể chuyển sang rejected. hired và rejected là trạng thái kết thúc. Ghi sự kiện và cập nhật trạng thái dùng cùng một D1 batch transaction, có điều kiện status cũ để phát hiện dữ liệu vừa thay đổi.

Ứng tuyển dùng UNIQUE(candidate_id,job_id). Đơn và sự kiện submitted được ghi trong một giao dịch. snapshot_json là bản hồ sơ tại lúc gửi. Sửa CV không thay snapshot. match_runs giữ phiên bản mô hình và hồ sơ để truy vết kết quả.

## Tư vấn CV theo JD

`POST /api/cv/consult` yêu cầu Gemini đã cấu hình ở backend; không đọc hoặc ghi database. CV và JD chỉ được gửi khi người dùng bấm phân tích. Không dùng dữ liệu thị trường hoặc yêu cầu từ các tin khác để suy diễn gap.

- `requirements`: tối đa 15 yêu cầu, ID do backend cấp R1…Rn; gồm skill, jd_evidence, cv_evidence, status, priority, reason, action. Bằng chứng phải xuất hiện trong nguồn tương ứng sau chuẩn hóa Unicode/khoảng trắng.
- `status=evidenced`: CV có trích dẫn đáp ứng yêu cầu. `not_evidenced`: chưa đủ bằng chứng trong CV, cv_evidence rỗng, không khẳng định thiếu năng lực. `needs_development`: CV nêu rõ mức hiện tại hoặc chưa biết, phải có trích dẫn CV; cách hiểu ngữ nghĩa cần người dùng kiểm chứng.
- `outline`: 3–7 mục theo thứ tự, có rationale, content_suggestions và requirement_ids. Mọi gap phải được ít nhất một mục tham chiếu.
- `statistics`: total, evidenced, not_evidenced, needs_development, gaps và evidence_coverage (0–1). Đây là tổng hợp trên các yêu cầu được trích; không phải xác suất được tuyển hoặc Matching Score.
- `assignment.enough_gaps` chỉ cho biết có ít nhất 3 mục khác evidenced trong kết quả AI; không tự xác nhận hoàn thành bài.

Lỗi: 400 đầu vào sai, 403 Origin khác, 413 payload quá lớn, 503 chưa cấu hình, 429 quota, 504 timeout, 502 dịch vụ/đầu ra/trích dẫn/tham chiếu không hợp lệ. Không trả lỗi thô của Google, API key hay nội dung request. Không tự thay bằng kết quả giả khi Gemini lỗi.
