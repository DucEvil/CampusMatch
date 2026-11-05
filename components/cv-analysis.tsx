'use client';

export type CVAnalysisResult = {
  model: string;
  warning: string;
  source?: 'image' | 'text';
  analysis: {
    summary: string;
    experience_summary: string;
    education_summary: string;
    other_skills: { skill: string; evidence: string }[];
    strengths: string[];
    improvements: string[];
  };
};

export function CVAnalysis({ result }: { result: CVAnalysisResult }) {
  const a = result.analysis;
  return <section className="ai-analysis" aria-label="Kết quả phân tích Gemini" aria-live="polite">
    <div className="ai-analysis-title"><h3>Phân tích CV bằng Gemini</h3><span>{result.model}</span></div>
    {result.source === 'image' && <p className="input-note">Đã đọc từ ảnh. Kiểm tra phần Nội dung CV và đối chiếu với ảnh trước khi lưu hồ sơ.</p>}
    <p>{a.summary}</p>
    <h4>Kinh nghiệm & dự án</h4><p>{a.experience_summary}</p>
    <h4>Học vấn</h4><p>{a.education_summary}</p>
    {a.strengths.length > 0 && <><h4>Điểm mạnh thể hiện trong CV</h4><ul>{a.strengths.map((s,i) => <li key={i}>{s}</li>)}</ul></>}
    {a.improvements.length > 0 && <><h4>Gợi ý cải thiện CV</h4><ul>{a.improvements.map((s,i) => <li key={i}>{s}</li>)}</ul></>}
    {a.other_skills.length > 0 && <><h4>Kỹ năng ngoài danh mục ghép việc</h4>{a.other_skills.map((s,i) => <p className="evidence" key={i}><strong>{s.skill}:</strong> {s.evidence}</p>)}<p className="input-note">Các kỹ năng này chỉ để tham khảo, chưa tham gia tính điểm ghép việc.</p></>}
    <p className="input-note">{result.warning}</p>
  </section>;
}
