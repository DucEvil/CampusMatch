import type { CareerResult } from './career-analysis';

export const careerStatusLabels = {
  evidenced: 'Có bằng chứng trong CV',
  not_evidenced: 'CV chưa thể hiện đủ',
  needs_development: 'Cần phát triển theo thông tin CV',
};
export const careerPriorityLabels = { high: 'Cao', medium: 'Vừa', low: 'Thấp' };

export function careerDemoSegments(result: CareerResult) {
  const ranks = { high: 0, medium: 1, low: 2 };
  const gaps = result.requirements.filter(r => r.status !== 'evidenced').sort((a, b) => ranks[a.priority] - ranks[b.priority]).slice(0, 3);
  return [
    { time: '0:00–0:20', title: 'Giới thiệu', text: 'Giới thiệu tên, mục tiêu nghề nghiệp và CV thực tế được phép sử dụng. Đóng vai người tư vấn nghề nghiệp.' },
    { time: '0:20–0:40', title: 'Vị trí mục tiêu', text: `Giới thiệu JD ${result.target.job_title}, nguồn tuyển dụng và lý do lựa chọn. Nêu phương pháp đối chiếu yêu cầu JD với bằng chứng trong CV.` },
    { time: '0:40–1:40', title: 'Phân tích skill gaps', text: gaps.length ? `Trình bày ${gaps.map(r => `${r.id}: ${r.skill}`).join('; ')}. Với mỗi mục, chỉ vào trích dẫn JD, bằng chứng hoặc phần chưa được thể hiện trong CV và hành động bổ sung. ${gaps.length < 3 ? 'Hiện chưa đủ 3 gaps: cần kiểm tra thêm yêu cầu thực tế, không tự tạo gap.' : ''}` : 'Không tìm thấy gap trong các yêu cầu đã phân tích. Kiểm tra lại toàn bộ JD; không tạo thêm gap để đủ số lượng.' },
    { time: '1:40–2:30', title: 'Tái cấu trúc CV', text: `Giới thiệu thứ tự ${result.outline.map(s => s.title).join(' → ')}. Giải thích liên hệ với các gap, tách việc bổ sung minh chứng thật khỏi kế hoạch học cần thực hiện.` },
    { time: '2:30–2:50', title: 'Kết thúc', text: 'Chốt ưu tiên cải thiện, nhắc giới hạn của AI và dữ liệu. Xem lại video để bảo đảm thời lượng thực tế 2–3 phút trước khi nộp.' },
  ];
}

export function buildCareerMarkdown(result: CareerResult, meta: { name: string; sourceDate: string; deadline: string }) {
  // Quote untrusted source text as text, never emit user HTML or active links.
  const text = (value: string) => value.replace(/[\\`*_{}\[\]<>#|]/g, '\\$&').replace(/\r?\n/g, ' ');
  const lines = [
    '# Phân tích CV và Skill Gaps theo JD', '',
    `Người trình bày: ${text(meta.name) || 'Chưa điền'}`,
    `Vị trí: ${text(result.target.job_title)}`,
    `Nguồn JD: ${text(result.target.jd_source) || 'Chưa cung cấp'}`,
    `Ngày ghi nhận JD: ${text(meta.sourceDate) || 'Chưa cung cấp'}`,
    `Ngày phân tích: ${result.generated_at}`,
    `Model: ${result.model}`, '', '## Nhận xét', '', text(result.summary), '',
    '## Tổng hợp bằng chứng CV–JD', '',
    `- Yêu cầu được phân tích: ${result.statistics.total}`,
    `- Có bằng chứng: ${result.statistics.evidenced}`,
    `- CV chưa thể hiện đủ: ${result.statistics.not_evidenced}`,
    `- Cần phát triển theo thông tin CV: ${result.statistics.needs_development}`,
    `- Tỷ lệ có bằng chứng: ${(result.statistics.evidence_coverage * 100).toFixed(1)}% (trên các yêu cầu AI đã trích; không phải xác suất tuyển dụng).`,
    `- ${result.assignment.enough_gaps ? 'Có ít nhất 3 gap để người dùng kiểm chứng.' : 'Chưa đủ 3 gap có căn cứ; cần kiểm tra thêm, không tạo gap giả.'}`,
    '', '## Bảng đối chiếu và hành động', '',
  ];
  for (const r of result.requirements) lines.push(
    `### ${r.id}. ${text(r.skill)}`, '',
    `- Phân loại: ${careerStatusLabels[r.status]}. Ưu tiên: ${careerPriorityLabels[r.priority]}.`,
    `- Yêu cầu JD: “${text(r.jd_evidence)}”`,
    `- Bằng chứng CV: ${r.cv_evidence ? `“${text(r.cv_evidence)}”` : 'Chưa tìm thấy bằng chứng đủ trong CV đã cung cấp.'}`,
    `- Đối chiếu: ${text(r.reason)}`,
    `- Hành động: ${text(r.action)}`, '',
  );
  lines.push('## Outline CV đề xuất', '');
  result.outline.forEach((s, i) => lines.push(
    `### ${i + 1}. ${text(s.title)}`, '', text(s.rationale),
    ...s.content_suggestions.map(c => `- ${text(c)}`),
    `Liên quan yêu cầu: ${s.requirement_ids.join(', ') || 'Thông tin chung'}.`, '',
  ));
  lines.push('## Khung thuyết minh 2–3 phút', '');
  careerDemoSegments(result).forEach(s => lines.push(`### ${s.time} | ${s.title}`, '', text(s.text), ''));
  lines.push('## Việc người thực hiện cần hoàn tất', '',
    '- Xác nhận CV thực tế và quyền sử dụng.', '- Xác nhận JD cụ thể phù hợp mục tiêu nghề nghiệp.',
    '- Kiểm chứng ít nhất 3 gaps và outline với CV–JD gốc.', '- Tự quay và xem lại video dài 2–3 phút.',
    `- Nộp qua kênh yêu cầu đúng hạn${meta.deadline ? ` (${text(meta.deadline)})` : '; cần điền hạn nộp'}.`,
    '', '## Giới hạn', '', result.warning,
    'Tổng hợp BI ở đây chỉ mô tả các yêu cầu được AI trích từ cặp CV–JD này, không phải thống kê thị trường hoặc đánh giá độc lập về năng lực.',
    'Nội dung đã được người dùng xác nhận đối chiếu trước khi xuất; việc quay video và nộp bài cần tự thực hiện.');
  return lines.join('\n');
}
