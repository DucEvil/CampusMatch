import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCV, analyzeCVImage, geminiConfig } from '../lib/cv-analysis.ts';
import { readCVImageUpload, MAX_CV_UPLOAD_BYTES } from '../lib/cv-image-upload.ts';
import { MAX_CV_IMAGE_BYTES } from '../lib/cv-upload-limits.ts';
import { GET, POST } from '../app/api/[...path]/route.ts';
import { env } from './cloudflare-stub.mjs';

const text = 'Tôi đã dùng React và TypeScript để xây dựng website. Tôi chưa biết Python.';
const config = { GEMINI_API_KEY: 'test-key-do-not-expose' };
const analysis = {
  summary: 'Ứng viên có dự án web.', experience_summary: 'Xây dựng website bằng React.',
  education_summary: 'Chưa có thông tin.',
  skills: [{ skill: 'React', evidence: 'đã dùng React và TypeScript', level: 'unspecified' }],
  other_skills: [{ skill: 'TypeScript', evidence: 'React và TypeScript' }],
  strengths: ['Có mô tả dự án web.'], improvements: ['Bổ sung kết quả cụ thể của dự án.'],
};
function success(data = analysis, finishReason = 'STOP') {
  return Response.json({ candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(data) }] } }] });
}
function request(body) {
  return new Request('http://localhost/api/cv/parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

test('Chưa có key: báo cấu hình, không gửi CV ra ngoài', async () => {
  let calls = 0;
  await assert.rejects(analyzeCV(text, {}, async () => { calls++; }), e => e.status === 503);
  assert.equal(calls, 0);
});
test('CV không hợp lệ bị từ chối trước khi gọi Gemini', async () => {
  await assert.rejects(analyzeCV('', config, () => { throw new Error('must not call'); }), /20 ký tự/);
});
test('Gọi Gemini từ backend với header key và schema; giữ bước xác nhận', async () => {
  const result = await analyzeCV(text, config, async (url, options) => {
    assert.equal(new URL(url).hostname, 'generativelanguage.googleapis.com');
    assert(!url.includes(config.GEMINI_API_KEY));
    assert.equal(options.headers['x-goog-api-key'], config.GEMINI_API_KEY);
    const body = JSON.parse(options.body);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert(body.generationConfig.responseJsonSchema.properties.skills);
    assert.equal(JSON.parse(body.contents[0].parts[0].text).cv_text, text);
    return success();
  });
  assert.equal(result.provider, 'gemini');
  assert.equal(result.requires_confirmation, true);
  assert.equal(result.skills[0].skill, 'React');
  assert.equal(result.analysis.other_skills[0].skill, 'TypeScript');
  assert(!JSON.stringify(result).includes(config.GEMINI_API_KEY));
});
test('Loại kỹ năng có bằng chứng bịa, loại trùng và không đưa kỹ năng mới vào điểm ghép việc', async () => {
  const result = await analyzeCV(text, config, async () => success({ ...analysis, skills: [
    ...analysis.skills, ...analysis.skills,
    { skill: 'Python', evidence: 'Tôi thành thạo Python.', level: 'advanced' },
  ], other_skills: [...analysis.other_skills, { skill: 'Docker', evidence: 'Tôi sử dụng Docker.' }] }));
  assert.deepEqual(result.skills.map(s => s.skill), ['React']);
  assert.deepEqual(result.analysis.other_skills.map(s => s.skill), ['TypeScript']);
  assert.match(result.warning, /bị loại/);
});
test('Không chấp nhận cấu trúc sai, kỹ năng ngoài danh mục hoặc kết quả bị cắt', async () => {
  for (const response of [
    success({ ...analysis, skills: [{ skill: 'InventedSkill', evidence: text, level: 'advanced' }] }),
    success({ summary: 'Thiếu dữ liệu' }),
    success(analysis, 'MAX_TOKENS'),
    Response.json({ candidates: [] }),
    Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not JSON' }] } }] }),
  ]) await assert.rejects(analyzeCV(text, config, async () => response), e => e.status === 502);
});
test('Lỗi quota, quyền, model và dịch vụ có thông báo riêng; không lộ lỗi gốc', async () => {
  for (const [status, expected] of [[429, 429], [400, 502], [403, 502], [404, 502], [500, 502]]) {
    await assert.rejects(analyzeCV(text, config, async () => Response.json({ error: config.GEMINI_API_KEY }, { status })), e => {
      assert.equal(e.status, expected);
      assert(!e.message.includes(config.GEMINI_API_KEY));
      return true;
    });
  }
});
test('Lỗi mạng và hết thời gian không lộ thông tin request', async () => {
  await assert.rejects(analyzeCV(text, config, async () => { throw new Error(config.GEMINI_API_KEY); }), e => e.status === 502 && !e.message.includes(config.GEMINI_API_KEY));
  await assert.rejects(analyzeCV(text, config, async () => { throw new DOMException('timeout', 'AbortError'); }), e => e.status === 504);
});
test('Model tùy chọn bị giới hạn ở tên model, không cho thay host hoặc đường dẫn', async () => {
  await assert.rejects(analyzeCV(text, { ...config, GEMINI_MODEL: '../other-host' }), e => e.status === 503);
});
test('API config chỉ trả trạng thái, API chọn Gemini và từ điển tách biệt', async t => {
  env.GEMINI_API_KEY = config.GEMINI_API_KEY;
  t.after(() => { delete env.GEMINI_API_KEY; });
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => success());
  const status = await (await GET(new Request('http://localhost/api/cv/config'))).json();
  assert.equal(status.gemini.configured, true);
  assert(!JSON.stringify(status).includes(config.GEMINI_API_KEY));
  assert.equal(geminiConfig({}).configured, false);
  const dictionary = await POST(request({ text }));
  assert.equal((await dictionary.json()).provider, 'dictionary');
  assert.equal(fetchMock.mock.callCount(), 0);
  const gemini = await POST(request({ text, provider: 'gemini' }));
  assert.equal(gemini.status, 200);
  assert.equal((await gemini.json()).analysis.summary, analysis.summary);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal((await POST(request({ text, provider: 'unknown' }))).status, 400);
});
test('API Gemini thiếu key trả 503 và không tự chuyển sang từ điển', async () => {
  const response = await POST(request({ text, provider: 'gemini' }));
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.match(body.error, /GEMINI_API_KEY/);
  assert.equal(body.skills, undefined);
});

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTf8AAAAASUVORK5CYII=', 'base64');
const imageAnalysis = { ...analysis, extracted_text: text, is_readable_cv: true };
function uploadRequest(bytes = png, type = 'image/png', extra = {}) {
  const form = new FormData();
  form.append('image', new Blob([bytes], { type }), 'cv.png');
  return new Request('http://localhost/api/cv/image', { method: 'POST', body: form, ...extra });
}

test('Ảnh gửi bằng inlineData; trả văn bản OCR và kỹ năng để xác nhận', async () => {
  const result = await analyzeCVImage({ bytes: png, mimeType: 'image/png' }, config, async (url, options) => {
    const body = JSON.parse(options.body);
    const inline = body.contents[0].parts[0].inlineData;
    assert.equal(inline.mimeType, 'image/png');
    assert.deepEqual(Buffer.from(inline.data, 'base64'), png);
    assert(body.generationConfig.responseJsonSchema.required.includes('extracted_text'));
    assert(body.generationConfig.responseJsonSchema.required.includes('is_readable_cv'));
    return success(imageAnalysis);
  });
  assert.equal(result.source, 'image');
  assert.equal(result.extracted_text, text);
  assert.equal(result.characters, text.length);
  assert.equal(result.requires_confirmation, true);
  assert.equal(result.skills[0].skill, 'React');
  assert.match(result.warning, /đối chiếu với ảnh gốc/);
  assert(!JSON.stringify(result).includes(png.toString('base64')));
});
test('Ảnh rỗng, quá lớn, sai loại và giả MIME bị chặn trước khi gọi Gemini', async () => {
  for (const [image, status] of [
    [{ bytes: new Uint8Array(), mimeType: 'image/png' }, 400],
    [{ bytes: new Uint8Array(MAX_CV_IMAGE_BYTES + 1), mimeType: 'image/png' }, 413],
    [{ bytes: png, mimeType: 'image/svg+xml' }, 415],
    [{ bytes: png, mimeType: 'image/jpeg' }, 415],
    [{ bytes: Buffer.from('<html>not an image</html>'), mimeType: 'image/png' }, 415],
  ]) await assert.rejects(analyzeCVImage(image, config, () => { assert.fail('must not call Gemini'); }), e => e.status === status);
});
test('Nhận JPEG và WEBP có chữ ký khớp MIME', async () => {
  for (const image of [
    { bytes: Uint8Array.from([255,216,255,224,0,0,0,0]), mimeType: 'image/jpeg' },
    { bytes: Buffer.from('RIFF0000WEBPVP8 '), mimeType: 'image/webp' },
  ]) assert.equal((await analyzeCVImage(image, config, async () => success(imageAnalysis))).source, 'image');
});
test('Ảnh mờ, không phải CV hoặc quá ít chữ trả 422; OCR không đúng cấu trúc trả 502', async () => {
  for (const [data, status] of [
    [{ ...imageAnalysis, is_readable_cv: false }, 422],
    [{ ...imageAnalysis, extracted_text: '' }, 422],
    [{ ...imageAnalysis, extracted_text: 'Too short' }, 422],
    [{ ...imageAnalysis, extracted_text: 'x'.repeat(30001) }, 502],
    [analysis, 502],
  ]) await assert.rejects(analyzeCVImage({ bytes: png, mimeType: 'image/png' }, config, async () => success(data)), e => e.status === status);
});
test('Bằng chứng kỹ năng từ ảnh phải xuất hiện trong văn bản OCR', async () => {
  const result = await analyzeCVImage({ bytes: png, mimeType: 'image/png' }, config, async () => success({ ...imageAnalysis,
    skills: [...analysis.skills, { skill: 'Python', evidence: 'I use Python for data science', level: 'unspecified' }],
  }));
  assert.deepEqual(result.skills.map(s => s.skill), ['React']);
});
test('Đọc multipart đúng một ảnh; từ chối thiếu file, nhiều file, thêm trường và boundary lỗi', async () => {
  assert.deepEqual((await readCVImageUpload(uploadRequest())).bytes, new Uint8Array(png));
  for (const variant of ['empty', 'duplicate', 'extra']) {
    const form = new FormData();
    if (variant !== 'empty') form.append('image', new Blob([png], { type: 'image/png' }), 'cv.png');
    if (variant === 'duplicate') form.append('image', new Blob([png], { type: 'image/png' }), 'cv2.png');
    if (variant === 'extra') form.append('text', 'ignore this');
    await assert.rejects(readCVImageUpload(new Request('http://localhost/api/cv/image', {method:'POST',body:form})), e => e.status === 400);
  }
  await assert.rejects(readCVImageUpload(new Request('http://localhost/api/cv/image', {method:'POST',headers:{'Content-Type':'multipart/form-data; boundary=broken'},body:'broken'})), e => e.status === 400);
});
test('Giới hạn dung lượng ảnh và request thực tế, kể cả khi không có Content-Length', async () => {
  await assert.rejects(readCVImageUpload(uploadRequest(new Uint8Array(MAX_CV_IMAGE_BYTES + 1))), e => e.status === 413);
  let cancelled = false;
  const stream = new ReadableStream({start(controller){controller.enqueue(new Uint8Array(MAX_CV_UPLOAD_BYTES + 1));},cancel(){cancelled=true;}});
  const request = new Request('http://localhost/api/cv/image', {method:'POST',headers:{'Content-Type':'multipart/form-data; boundary=test'},body:stream,duplex:'half'});
  await assert.rejects(readCVImageUpload(request), e => e.status === 413);
  assert.equal(cancelled, true);
  await assert.rejects(readCVImageUpload(uploadRequest(png,'image/png',{headers:{'Content-Type':'multipart/form-data; boundary=test','Content-Length':String(MAX_CV_UPLOAD_BYTES + 1)}})), e => e.status === 413);
});
test('API ảnh kiểm tra Origin và Content-Type, lỗi không ghi đè nội dung CV', async () => {
  assert.equal((await POST(uploadRequest(png, 'image/png', { headers:{Origin:'https://evil.invalid'} }))).status, 403);
  assert.equal((await POST(new Request('http://localhost/api/cv/image',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}))).status, 415);
  const invalid = await POST(uploadRequest(Buffer.from('not an image')));
  assert.equal(invalid.status, 415);
  assert.equal((await invalid.json()).extracted_text, undefined);
});
test('API ảnh hoạt động qua multipart và không trả API key hoặc dữ liệu ảnh', async t => {
  env.GEMINI_API_KEY=config.GEMINI_API_KEY;
  t.after(()=>{delete env.GEMINI_API_KEY;});
  t.mock.method(globalThis,'fetch',async()=>success(imageAnalysis));
  const response=await POST(uploadRequest());
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.extracted_text,text);
  assert.equal(body.requires_confirmation,true);
  assert(!JSON.stringify(body).includes(config.GEMINI_API_KEY));
  assert(!JSON.stringify(body).includes(png.toString('base64')));
});
