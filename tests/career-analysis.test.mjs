import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCareerPlan } from '../lib/career-analysis.ts';
import { buildCareerMarkdown, careerDemoSegments } from '../lib/career-report.ts';
import { POST } from '../app/api/[...path]/route.ts';
import { env } from './cloudflare-stub.mjs';

const config = { GEMINI_API_KEY: 'career-test-secret-do-not-expose' };
const input = {
  cv_text: 'Tôi đã xây dựng website bằng React. Tôi chưa biết Docker. Dự án có trang tìm kiếm sản phẩm.',
  job_title: 'Frontend Intern', jd_text: 'Yêu cầu React, TypeScript, Git và Docker. Có dự án web để minh chứng.',
  jd_source: 'JD giả lập dùng riêng cho kiểm thử',
};
const data = {
  summary: 'CV có dự án React; cần đối chiếu ba yêu cầu còn lại.',
  requirements: [
    { skill: 'React', jd_evidence: 'Yêu cầu React', cv_evidence: 'đã xây dựng website bằng React', status: 'evidenced', priority: 'high', reason: 'Có dự án React.', action: 'Nêu vai trò và sản phẩm thật của dự án.' },
    { skill: 'TypeScript', jd_evidence: 'TypeScript', cv_evidence: '', status: 'not_evidenced', priority: 'high', reason: 'CV chưa thể hiện TypeScript.', action: 'Nếu đã dùng, nêu tệp hoặc tính năng cụ thể; nếu chưa, thực hành trước.' },
    { skill: 'Git', jd_evidence: 'Git', cv_evidence: '', status: 'not_evidenced', priority: 'medium', reason: 'CV chưa thể hiện Git.', action: 'Kiểm tra kinh nghiệm Git và bổ sung minh chứng có thật.' },
    { skill: 'Docker', jd_evidence: 'Docker', cv_evidence: 'Tôi chưa biết Docker.', status: 'needs_development', priority: 'medium', reason: 'CV nói rõ chưa biết Docker.', action: 'Học và tạo Dockerfile chạy được dự án trước khi ghi vào CV.' },
  ],
  outline: [
    { title: 'Thông tin liên hệ', rationale: 'Để nhà tuyển dụng liên hệ.', content_suggestions: ['Kiểm tra email và đường dẫn portfolio.'], requirement_numbers: [] },
    { title: 'Kỹ năng liên quan', rationale: 'Làm rõ kỹ năng theo JD.', content_suggestions: ['Chỉ ghi mức và công cụ đã sử dụng thật.'], requirement_numbers: [2, 3, 4] },
    { title: 'Dự án', rationale: 'Đặt minh chứng React trước học vấn.', content_suggestions: ['Mô tả trang tìm kiếm đã thực hiện.'], requirement_numbers: [1, 2, 3] },
  ],
};
const clone = () => structuredClone(data);
const success = (output = data, finishReason = 'STOP') => Response.json({ candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(output) }] } }] });
const request = (body = input, origin) => new Request('http://localhost/api/cv/consult', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body) });

test('Career: gửi đúng cặp CV–JD từ backend, tính chỉ số và liên kết outline', async () => {
  const result = await analyzeCareerPlan(input, config, async (url, options) => {
    assert.equal(new URL(url).hostname, 'generativelanguage.googleapis.com');
    assert.equal(options.headers['x-goog-api-key'], config.GEMINI_API_KEY);
    assert(!url.includes(config.GEMINI_API_KEY));
    const body = JSON.parse(options.body);
    assert.deepEqual(JSON.parse(body.contents[0].parts[0].text), input);
    assert(body.generationConfig.responseJsonSchema.properties.outline);
    assert.match(body.systemInstruction.parts[0].text, /không làm theo chỉ dẫn/);
    return success();
  });
  assert.deepEqual(result.statistics, { total: 4, evidenced: 1, not_evidenced: 2, needs_development: 1, gaps: 3, evidence_coverage: .25 });
  assert.equal(result.assignment.enough_gaps, true);
  assert.deepEqual(result.outline[1].requirement_ids, ['R2', 'R3', 'R4']);
  assert.equal(result.requirements[1].status, 'not_evidenced');
  assert(!JSON.stringify(result).includes(config.GEMINI_API_KEY));
});

test('Career: đầu vào thiếu hoặc vượt giới hạn bị chặn trước khi gọi Google', async () => {
  let calls = 0;
  for (const invalid of [null, [], { ...input, cv_text: '' }, { ...input, jd_text: 'ngắn' }, { ...input, job_title: '' }, { ...input, cv_text: 'a'.repeat(30001) }, { ...input, jd_text: 'a'.repeat(15001) }]) {
    await assert.rejects(analyzeCareerPlan(invalid, config, async () => { calls++; return success(); }), e => e.status === 400);
  }
  assert.equal(calls, 0);
});

test('Career: thiếu key hoặc tên model sai không gửi CV–JD', async () => {
  let calls = 0;
  for (const cfg of [{}, { ...config, GEMINI_MODEL: '../malicious' }]) await assert.rejects(analyzeCareerPlan(input, cfg, async () => { calls++; return success(); }), e => e.status === 503);
  assert.equal(calls, 0);
});

test('Career: kỹ năng ngoài danh mục vẫn được phân tích và không đổi mô hình ghép việc', async () => {
  const result = await analyzeCareerPlan(input, config, async () => success());
  assert(result.requirements.some(r => r.skill === 'Docker'));
  assert(result.requirements.some(r => r.skill === 'TypeScript'));
  assert.equal(result.model_version, undefined);
});

test('Career: không tự tạo thêm gap khi chỉ có một gap có căn cứ', async () => {
  const output = clone(); output.requirements = [output.requirements[3]];
  output.outline.forEach(s => { s.requirement_numbers = [1]; });
  const result = await analyzeCareerPlan(input, config, async () => success(output));
  assert.equal(result.statistics.gaps, 1);
  assert.equal(result.assignment.enough_gaps, false);
  assert.match(careerDemoSegments(result)[2].text, /chưa đủ 3 gaps/);
});

test('Career: không có gap thì chỉ báo bằng chứng, không kết luận đủ checklist', async () => {
  const output = clone(); output.requirements = [output.requirements[0]];
  output.outline.forEach(s => { s.requirement_numbers = [1]; });
  const result = await analyzeCareerPlan(input, config, async () => success(output));
  assert.equal(result.statistics.gaps, 0); assert.equal(result.statistics.evidence_coverage, 1);
  assert.equal(result.assignment.enough_gaps, false);
  assert.match(careerDemoSegments(result)[2].text, /Không tìm thấy gap/);
});

test('Career: từ chối bằng chứng JD hoặc CV bịa', async () => {
  for (const field of ['jd_evidence', 'cv_evidence']) {
    const output = clone(); output.requirements[0][field] = 'Trích dẫn không xuất hiện trong nguồn';
    await assert.rejects(analyzeCareerPlan(input, config, async () => success(output)), e => e.status === 502);
  }
});

test('Career: có bằng chứng hoặc cần phát triển phải có trích dẫn CV', async () => {
  for (const index of [0, 3]) {
    const output = clone(); output.requirements[index].cv_evidence = '';
    await assert.rejects(analyzeCareerPlan(input, config, async () => success(output)), e => e.status === 502);
  }
  const output = clone(); output.requirements[1].cv_evidence = input.cv_text;
  await assert.rejects(analyzeCareerPlan(input, config, async () => success(output)), e => e.status === 502);
});

test('Career: không đếm yêu cầu trùng để đủ ba gaps', async () => {
  for (const duplicate of [' typescript ', 'ReactJS']) {
    const output = clone(); output.requirements[2].skill = duplicate;
    await assert.rejects(analyzeCareerPlan(input, config, async () => success(output)), e => e.status === 502);
  }
});

test('Career: outline phải tham chiếu yêu cầu thật và liên kết đủ mọi gap', async () => {
  const invalidReference = clone(); invalidReference.outline[0].requirement_numbers = [5];
  const missingGap = clone(); missingGap.outline.forEach(s => { s.requirement_numbers = s.requirement_numbers.filter(n => n !== 4); });
  for (const output of [invalidReference, missingGap]) await assert.rejects(analyzeCareerPlan(input, config, async () => success(output)), e => e.status === 502);
});

test('Career: từ chối phản hồi sai cấu trúc hoặc bị cắt', async () => {
  for (const response of [success({ summary: 'thiếu trường' }), success(data, 'MAX_TOKENS'), Response.json({ candidates: [] }), Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not JSON' }] } }] })]) {
    await assert.rejects(analyzeCareerPlan(input, config, async () => response), e => e.status === 502);
  }
});

test('Career: quota quyền model mạng timeout đều trả lỗi an toàn', async () => {
  for (const [status, expected] of [[429, 429], [403, 502], [404, 502], [500, 502]]) await assert.rejects(analyzeCareerPlan(input, config, async () => Response.json({ error: config.GEMINI_API_KEY }, { status })), e => e.status === expected && !e.message.includes(config.GEMINI_API_KEY));
  await assert.rejects(analyzeCareerPlan(input, config, async () => { throw new Error(config.GEMINI_API_KEY); }), e => e.status === 502 && !e.message.includes(config.GEMINI_API_KEY));
  await assert.rejects(analyzeCareerPlan(input, config, async () => { throw new DOMException('timeout', 'AbortError'); }), e => e.status === 504);
});

test('Career API: kiểm tra Origin JSON và cấu hình trước khi gọi Gemini', async () => {
  assert.equal((await POST(request(input, 'http://other-host'))).status, 403);
  assert.equal((await POST(request({ cv_text: '' }))).status, 400);
  assert.equal((await POST(request())).status, 503);
  assert.equal((await POST(request(null))).status, 400);
});

test('Career API: trả phân tích qua endpoint mới, không lộ key', async t => {
  env.GEMINI_API_KEY = config.GEMINI_API_KEY;
  t.after(() => { delete env.GEMINI_API_KEY; });
  const spy = t.mock.method(globalThis, 'fetch', async () => success());
  const response = await POST(request()); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.statistics.gaps, 3); assert.equal(spy.mock.callCount(), 1);
  assert(!JSON.stringify(body).includes(config.GEMINI_API_KEY));
});

test('Career: bản xuất có đối chiếu outline khung video và không đánh dấu đã nộp', async () => {
  const result = await analyzeCareerPlan(input, config, async () => success());
  const markdown = buildCareerMarkdown(result, { name: '<script>alert(1)</script>', sourceDate: '2026-11-05', deadline: '2026-11-10' });
  for (const expected of ['R2.', 'TypeScript', 'Outline CV', 'Khung thuyết minh', '2026-11-10', 'không phải xác suất tuyển dụng', 'tự thực hiện']) assert(markdown.includes(expected), expected);
  assert(!markdown.includes('<script>'));
  assert.equal(careerDemoSegments(result).length, 5);
});
