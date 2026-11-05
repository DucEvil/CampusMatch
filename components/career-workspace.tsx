'use client';

import { useState } from 'react';
import { ClipboardCheck, Download, FileText, Sparkles } from 'lucide-react';
import type { CareerInput, CareerResult } from '../lib/career-analysis';
import { buildCareerMarkdown, careerDemoSegments, careerStatusLabels, careerPriorityLabels } from '../lib/career-report';
import { CVImageUpload } from './cv-image-upload';

type Job = { id: string; title: string; description: string; company: string; skills: string[] };
export function CareerWorkspace({ currentCV, jobs, configured }: { currentCV: string; jobs: Job[]; configured: boolean }) {
  const [input, setInput] = useState<CareerInput>({ cv_text: '', job_title: '', jd_text: '', jd_source: '' });
  const [result, setResult] = useState<CareerResult | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [jobId, setJobId] = useState(''), [name, setName] = useState(''), [sourceDate, setSourceDate] = useState(''), [deadline, setDeadline] = useState('');
  const [realCV, setRealCV] = useState(false), [realJD, setRealJD] = useState(false);
  const [reviewed, setReviewed] = useState(false), [outlineReviewed, setOutlineReviewed] = useState(false);
  const [recorded, setRecorded] = useState(false), [submitted, setSubmitted] = useState(false);
  const [onlyGaps, setOnlyGaps] = useState(false);

  function update(patch: Partial<CareerInput>) {
    setInput(previous => ({ ...previous, ...patch })); setResult(null);
    setReviewed(false); setOutlineReviewed(false); setRecorded(false); setSubmitted(false); setError(''); setNotice('');
    if ('cv_text' in patch) setRealCV(false);
    if ('jd_text' in patch || 'job_title' in patch || 'jd_source' in patch) setRealJD(false);
  }
  async function loadText(file?: File) {
    if (!file) return;
    setError('');
    if (!file.name.toLowerCase().endsWith('.txt') || file.size > 100000) { setError('Chọn tệp .txt tối đa 100 KB.'); return; }
    setBusy(true);
    try {
      const value = await file.text();
      if (value.length > 30000) throw new Error('CV tối đa 30.000 ký tự.');
      update({ cv_text: value }); setNotice('Đã đọc tệp. Hãy kiểm tra lại nội dung CV.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Không đọc được tệp.'); }
    finally { setBusy(false); }
  }
  async function loadImage(file: File) {
    setBusy(true); setError(''); setNotice('');
    try {
      const form = new FormData(); form.append('image', file);
      const response = await fetch('/api/cv/image', { method: 'POST', body: form });
      const data = await response.json() as { extracted_text: string; error?: string };
      if (!response.ok) throw new Error(data.error || 'Không đọc được ảnh.');
      update({ cv_text: data.extracted_text }); setNotice('Đã đọc ảnh. Đối chiếu chữ với ảnh gốc trước khi phân tích theo JD.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Không đọc được ảnh.'); }
    finally { setBusy(false); }
  }
  async function analyze() {
    setBusy(true); setError(''); setNotice(''); setResult(null);
    setReviewed(false); setOutlineReviewed(false); setRecorded(false); setSubmitted(false);
    try {
      const response = await fetch('/api/cv/consult', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      const data = await response.json() as CareerResult & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Không thể phân tích CV theo JD.');
      setResult(data); setOnlyGaps(true);
      setNotice('Đã phân tích. Kiểm tra trích dẫn, khoảng trống và outline trước khi dùng trong bài.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thể kết nối dịch vụ.'); }
    finally { setBusy(false); }
  }
  function download() {
    if (!result || !reviewed || !outlineReviewed) return;
    const content = buildCareerMarkdown(result, { name, sourceDate, deadline });
    const url = URL.createObjectURL(new Blob(['\uFEFF' + content], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'CampusMatch_CV_JD_Skill_Gaps.md'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const checks = [
    { title: 'CV thực tế', ok: realCV && input.cv_text.trim().length >= 20, detail: 'Bạn xác nhận quyền sử dụng và đã kiểm tra nội dung.' },
    { title: 'JD mục tiêu cụ thể', ok: realJD && input.jd_text.trim().length >= 30 && input.job_title.trim().length >= 2, detail: 'Bạn xác nhận JD phù hợp mục tiêu; ghi nguồn khi có.' },
    { title: 'Ít nhất 3 skill gaps', ok: Boolean(result?.assignment.enough_gaps && reviewed), detail: 'AI đề xuất; bạn đối chiếu CV–JD và kiểm chứng từng gap.' },
    { title: 'Outline CV theo JD', ok: Boolean(result && outlineReviewed), detail: 'Đã kiểm tra thứ tự mục và liên hệ với các gap.' },
    { title: 'Video 2–3 phút', ok: recorded, detail: 'Bạn tự quay và xác nhận đã xem lại thời lượng.' },
    { title: 'Nộp đúng hạn', ok: submitted, detail: 'Bạn tự nộp qua kênh yêu cầu và xác nhận.' },
  ];
  return <div className="career-workspace">
    <div className="info-strip"><ClipboardCheck size={20}/><span>Chuẩn bị bài cá nhân: CV thực tế → JD mục tiêu → bằng chứng và skill gaps → outline CV → thuyết minh. Nội dung nhập chỉ giữ trong phiên trang này; tải lại trang sẽ mất bản nháp. Khi bấm phân tích, CV và JD được gửi tới Google qua backend.</span></div>
    {error && <p role="alert" className="error">{error}</p>}
    {notice && <p role="status" className="toast">{notice}</p>}
    <fieldset disabled={busy} className="career-fieldset">
      <div className="career-input-grid">
        <section className="panel">
          <div className="panel-title"><div><h2>1. CV cần tư vấn</h2><p>Dán CV, tải .txt hoặc đọc ảnh rõ chữ</p></div><FileText size={20}/></div>
          <label htmlFor="career-name">Người trình bày<input id="career-name" maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="Điền khi chuẩn bị demo"/></label>
          <div className="career-text-field"><label htmlFor="career-cv">Nội dung CV</label><textarea id="career-cv" rows={12} maxLength={30000} value={input.cv_text} onChange={e => update({ cv_text: e.target.value })} placeholder="Dán nội dung CV thực tế của bạn tại đây…"/></div>
          <div className="career-actions"><label className="upload">Tải CV .txt<input type="file" accept=".txt,text/plain" onChange={e => { void loadText(e.target.files?.[0]); e.target.value = ''; }}/></label><button type="button" className="secondary small" disabled={!currentCV} onClick={() => update({ cv_text: currentCV })}>Dùng CV đang chọn ở mục gợi ý</button></div>
          <details><summary>Đọc CV từ ảnh qua Gemini</summary><CVImageUpload configured={configured} busy={busy} onAnalyze={loadImage}/></details>
          <label className="checkbox"><input type="checkbox" checked={realCV} onChange={e => setRealCV(e.target.checked)}/><span>Đây là CV thực tế tôi được phép sử dụng và tôi đã kiểm tra nội dung.</span></label>
        </section>
        <section className="panel">
          <div className="panel-title"><div><h2>2. JD và mục tiêu nghề nghiệp</h2><p>Nhập JD cụ thể, giữ nguyên các yêu cầu gốc</p></div></div>
          <label htmlFor="career-existing-job">Lấy tin từ hệ thống (tùy chọn)<select id="career-existing-job" value={jobId} onChange={e => {
            const id = e.target.value; setJobId(id); const job = jobs.find(j => j.id === id);
            if (job) update({ job_title: job.title, jd_text: `${job.description}\n\nKỹ năng yêu cầu: ${job.skills.join(', ')}`, jd_source: `${job.company} · ${job.id}${/^J\d{2}$/.test(job.id) ? ' · Tin giả lập' : ' · Tin trong hệ thống'}` });
          }}><option value="">Tự nhập JD bên dưới</option>{jobs.map(j => <option key={j.id} value={j.id}>{j.title} · {j.company}</option>)}</select></label>
          <label htmlFor="career-job-title">Vị trí muốn ứng tuyển<input id="career-job-title" maxLength={150} value={input.job_title} onChange={e => { setJobId(''); update({ job_title: e.target.value }); }} placeholder="Ví dụ: Frontend Intern"/></label>
          <div className="career-text-field"><label htmlFor="career-jd">Nội dung JD</label><textarea id="career-jd" rows={8} maxLength={15000} value={input.jd_text} onChange={e => { setJobId(''); update({ jd_text: e.target.value }); }} placeholder="Dán mô tả và yêu cầu công việc…"/></div>
          <label htmlFor="career-source">Nguồn JD / đường dẫn tin<input id="career-source" maxLength={500} value={input.jd_source} onChange={e => update({ jd_source: e.target.value })} placeholder="Tên doanh nghiệp, trang tuyển dụng hoặc URL"/></label>
          <label htmlFor="career-source-date">Ngày ghi nhận JD<input id="career-source-date" type="date" value={sourceDate} onChange={e => setSourceDate(e.target.value)}/></label>
          <label className="checkbox"><input type="checkbox" checked={realJD} onChange={e => setRealJD(e.target.checked)}/><span>Tôi đã chọn JD cụ thể phù hợp mục tiêu nghề nghiệp và kiểm tra các yêu cầu.</span></label>
        </section>
      </div>
      <div className="career-submit"><div><strong>Phân tích cặp CV–JD này</strong><p>Đối chiếu cả kỹ năng ngoài danh mục ghép việc. Không tự lưu CV hoặc JD vào database.</p></div><button type="button" className="primary" disabled={!configured || input.cv_text.trim().length < 20 || input.jd_text.trim().length < 30 || input.job_title.trim().length < 2} onClick={analyze}><Sparkles size={17}/>{busy ? 'Đang đối chiếu…' : 'Phân tích gaps & outline CV'}</button></div>
      {!configured && <p className="career-note">Gemini chưa được cấu hình. Thêm API key ở backend và khởi động lại server để dùng chức năng này.</p>}
    </fieldset>
    {result && <div className="career-results" aria-live="polite">
      <section className="panel">
        <div className="panel-title"><div><h2>3. Kết quả đối chiếu CV–JD</h2><p>{result.target.job_title} · {result.model}</p></div></div>
        <p>{result.summary}</p>
        <div className="career-stat-grid">
          <div><strong>{result.statistics.total}</strong><span>Yêu cầu được phân tích</span></div>
          <div><strong>{result.statistics.evidenced}</strong><span>Có bằng chứng trong CV</span></div>
          <div><strong>{result.statistics.not_evidenced}</strong><span>CV chưa thể hiện đủ</span></div>
          <div><strong>{result.statistics.needs_development}</strong><span>Cần phát triển theo CV</span></div>
        </div>
        <div className="career-coverage"><div><strong>{Math.round(result.statistics.evidence_coverage * 100)}% có bằng chứng</strong><span>Trong {result.statistics.total} yêu cầu AI đã trích từ JD</span></div><progress max={result.statistics.total} value={result.statistics.evidenced} aria-label="Tỷ lệ yêu cầu có bằng chứng trong CV"/></div>
        <p className="career-note">Tổng hợp BI theo cặp CV–JD; chưa phải toàn bộ yêu cầu của JD hay thống kê thị trường. Tỷ lệ này không phải điểm Matching Score hoặc xác suất được tuyển.</p>
        <p className={result.assignment.enough_gaps ? 'career-readiness' : 'career-readiness pending'}>{result.assignment.enough_gaps ? `Có ${result.statistics.gaps} khoảng trống được đề xuất. Hãy kiểm chứng ít nhất 3 mục để trình bày.` : `Hiện chỉ có ${result.statistics.gaps} khoảng trống trong các yêu cầu đã phân tích. Chưa đủ yêu cầu ít nhất 3 gaps; kiểm tra lại JD và CV, không tạo gap giả.`}</p>
        <label className="checkbox"><input type="checkbox" checked={onlyGaps} onChange={e => setOnlyGaps(e.target.checked)}/>Chỉ xem các khoảng trống</label>
        <div className="career-gap-list">{result.requirements.filter(r => !onlyGaps || r.status !== 'evidenced').map(r => <article className={'career-gap ' + r.status} key={r.id}>
          <div className="career-gap-heading"><h3>{r.id}. {r.skill}</h3><span>Ưu tiên {careerPriorityLabels[r.priority].toLowerCase()}</span></div>
          <p className="career-status-label">{careerStatusLabels[r.status]}</p>
          <div className="career-evidence-grid"><div><h4>Yêu cầu JD</h4><blockquote>{r.jd_evidence}</blockquote></div><div><h4>Bằng chứng CV</h4>{r.cv_evidence ? <blockquote>{r.cv_evidence}</blockquote> : <p>Chưa tìm thấy bằng chứng đủ trong CV đã cung cấp.</p>}</div></div>
          <p><strong>Đối chiếu:</strong> {r.reason}</p><p><strong>Hành động:</strong> {r.action}</p>
        </article>)}</div>
        {onlyGaps && !result.statistics.gaps && <p className="career-note">Không có gap trong kết quả hiện tại. Bỏ bộ lọc để xem các yêu cầu đã có bằng chứng.</p>}
        <label className="checkbox"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)}/>Tôi đã đối chiếu trích dẫn và phân loại với CV–JD gốc; không coi thiếu bằng chứng là chắc chắn thiếu kỹ năng.</label>
      </section>
      <section className="panel">
        <div className="panel-title"><div><h2>4. Outline CV đề xuất</h2><p>Thứ tự ưu tiên theo JD và liên kết với từng yêu cầu</p></div></div>
        <ol className="career-outline">{result.outline.map((s, i) => <li key={i}><h3>{s.title}</h3><p>{s.rationale}</p><ul>{s.content_suggestions.map((c, j) => <li key={j}>{c}</li>)}</ul><span className="career-links">Liên quan: {s.requirement_ids.map(id => `${id} · ${result.requirements.find(r => r.id === id)?.skill}`).join(' / ') || 'Thông tin chung'}</span></li>)}</ol>
        <p className="career-note">Đổi bố cục giúp thể hiện năng lực đã có. Kỹ năng thực sự còn thiếu cần học và thực hành trước khi ghi vào CV; không thêm kinh nghiệm hoặc số liệu chưa có.</p>
        <label className="checkbox"><input type="checkbox" checked={outlineReviewed} onChange={e => setOutlineReviewed(e.target.checked)}/>Tôi đã kiểm tra outline, liên hệ với các gap và tính trung thực của nội dung đề xuất.</label>
      </section>
      <section className="panel">
        <div className="panel-title"><div><h2>5. Khung thuyết minh khi quay video</h2><p>Mục tiêu khoảng 2 phút 50 giây; thời lượng thực tế do bạn kiểm tra</p></div></div>
        <ol className="career-script">{careerDemoSegments(result).map(s => <li key={s.time}><span>{s.time}</span><div><h3>{s.title}</h3><p>{s.text}</p></div></li>)}</ol>
        <div className="career-actions"><button type="button" className="secondary" disabled={!reviewed || !outlineReviewed} onClick={download}><Download size={16}/>Tải bản phân tích & khung thuyết minh (.md)</button></div>
        <p className="career-note">Xác nhận phần đối chiếu và outline để xuất. Tệp tải về chứa trích dẫn từ CV; tự quản lý và che thông tin cá nhân khi chia sẻ.</p>
        <p className="career-note">{result.warning}</p>
      </section>
    </div>}
    <section className="panel career-checklist">
      <div className="panel-title"><div><h2>Theo dõi 6 checklist của bài cá nhân</h2><p>Tiến độ tự xác nhận, không tự động quay video hoặc nộp bài</p></div><ClipboardCheck size={21}/></div>
      <ol>{checks.map((c, i) => <li key={c.title} className={c.ok ? 'complete' : ''}><span className="career-check-number">{i + 1}</span><div><strong>{c.title}</strong><p>{c.detail}</p></div><span className="career-check-state">{c.ok ? 'Đã xác nhận' : 'Cần hoàn tất'}</span></li>)}</ol>
      <div className="career-final-checks"><label htmlFor="career-deadline">Hạn nộp theo lớp<input id="career-deadline" type="date" value={deadline} onChange={e => { setDeadline(e.target.value); setSubmitted(false); }}/></label><div><label className="checkbox"><input type="checkbox" checked={recorded} onChange={e => { setRecorded(e.target.checked); if (!e.target.checked) setSubmitted(false); }}/>Tôi đã quay video và xem lại: đủ nội dung, dài 2–3 phút.</label><label className="checkbox"><input type="checkbox" checked={submitted} disabled={!recorded} onChange={e => setSubmitted(e.target.checked)}/>Tôi đã tự nộp video qua đúng kênh và đúng hạn quy định.</label></div></div>
    </section>
  </div>;
}
