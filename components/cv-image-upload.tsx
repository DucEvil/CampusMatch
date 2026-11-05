'use client';

import { useEffect, useState } from 'react';
import { ImagePlus, Sparkles, X } from 'lucide-react';
import { CV_IMAGE_MIME_TYPES, MAX_CV_IMAGE_BYTES } from '../lib/cv-upload-limits';

export function CVImageUpload({ configured, busy, onAnalyze }: {
  configured: boolean; busy: boolean; onAnalyze: (file: File) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function choose(next?: File) {
    setError('');
    if (!next) return;
    setFile(null);
    if (!(CV_IMAGE_MIME_TYPES as readonly string[]).includes(next.type)) { setError('Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.'); return; }
    if (!next.size || next.size > MAX_CV_IMAGE_BYTES) { setError('Chọn ảnh có dung lượng lớn hơn 0 và tối đa 5 MB.'); return; }
    setFile(next);
  }
  return <section className="cv-image-upload" aria-label="Tải và phân tích ảnh CV">
    <div className="ai-analysis-title"><h3><ImagePlus size={16}/> Phân tích ảnh CV</h3><span>JPG · PNG · WEBP</span></div>
    <p className="input-note">Chọn một ảnh rõ chữ, tối đa 5 MB. Ảnh chỉ gửi tới Google khi bạn bấm Đọc & phân tích ảnh.</p>
    <label className="cv-image-picker">Chọn ảnh CV
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { choose(e.target.files?.[0]); e.target.value=''; }}/>
    </label>
    {error && <p role="alert" className="cv-upload-error">{error}</p>}
    {file && <>
      <div className="cv-image-caption"><span>{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</span><button type="button" className="text-button" disabled={busy} aria-label="Bỏ ảnh CV" onClick={() => { setFile(null); setError(''); }}><X size={15}/></button></div>
      {preview && <img className="cv-image-preview" src={preview} alt="Ảnh CV đã chọn để phân tích"/>}
      <button type="button" className="primary full" disabled={busy || !configured} onClick={() => onAnalyze(file)}><Sparkles size={16}/>{busy ? 'Đang xử lý…' : 'Đọc & phân tích ảnh'}</button>
      <p className="input-note">Khi thành công, văn bản và kỹ năng đọc từ ảnh sẽ thay nội dung hồ sơ đang chỉnh sửa. Hãy kiểm tra chữ trước khi xác nhận và lưu. Ảnh không được lưu trong database.</p>
    </>}
    {!configured && <p className="input-note">Cần cấu hình Gemini ở backend để phân tích ảnh.</p>}
  </section>;
}
