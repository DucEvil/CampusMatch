import { CvAnalysisError, type CVImageInput } from './cv-analysis';
import { MAX_CV_IMAGE_BYTES } from './cv-upload-limits';

// Bound the stream even when Content-Length is absent or inaccurate. Allow only
// a small amount of multipart overhead beyond the actual image limit.
export const MAX_CV_UPLOAD_BYTES = MAX_CV_IMAGE_BYTES + 64 * 1024;
export async function readCVImageUpload(request: Request): Promise<CVImageInput> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data;')) throw new CvAnalysisError(415, 'Tải ảnh CV bằng multipart/form-data.');
  if (Number(request.headers.get('content-length')) > MAX_CV_UPLOAD_BYTES) throw new CvAnalysisError(413, 'Ảnh CV tối đa 5 MB.');
  if (!request.body) throw new CvAnalysisError(400, 'Chưa có ảnh CV.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_CV_UPLOAD_BYTES) {
        await reader.cancel().catch(() => {});
        throw new CvAnalysisError(413, 'Ảnh CV tối đa 5 MB.');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  let form: FormData;
  try { form = await new Response(body, { headers: { 'Content-Type': contentType } }).formData(); }
  catch { throw new CvAnalysisError(400, 'Dữ liệu tải ảnh CV không hợp lệ.'); }
  const files = form.getAll('image');
  if (files.length !== 1 || !(files[0] instanceof File) || [...form.keys()].some(k => k !== 'image')) {
    throw new CvAnalysisError(400, 'Hãy tải đúng một ảnh CV trong trường image.');
  }
  const file = files[0];
  if (file.size > MAX_CV_IMAGE_BYTES) throw new CvAnalysisError(413, 'Ảnh CV tối đa 5 MB.');
  return { bytes: new Uint8Array(await file.arrayBuffer()), mimeType: file.type.toLowerCase() };
}
