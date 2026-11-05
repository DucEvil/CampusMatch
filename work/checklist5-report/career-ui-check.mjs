import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { analyzeCareerPlan } from '../../lib/career-analysis.ts';

const require = createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const dir = 'E:/CampusMatch/work/checklist5-report/career-ui';
await fs.mkdir(dir, { recursive: true });
const input = {
  cv_text: 'Tôi đã xây dựng website bằng React. Tôi chưa biết Docker. Dự án có trang tìm kiếm sản phẩm.',
  job_title: 'Frontend Intern', jd_text: 'Yêu cầu React, TypeScript, Git và Docker. Có dự án web để minh chứng.', jd_source: 'JD giả lập kiểm thử giao diện',
};
const output = {
  summary: 'CV có dự án React; cần kiểm chứng ba khoảng trống theo JD.',
  requirements: [
    { skill: 'React', jd_evidence: 'Yêu cầu React', cv_evidence: 'đã xây dựng website bằng React', status: 'evidenced', priority: 'high', reason: 'Có bằng chứng dự án.', action: 'Nêu sản phẩm đã thực hiện thật.' },
    { skill: 'TypeScript', jd_evidence: 'TypeScript', cv_evidence: '', status: 'not_evidenced', priority: 'high', reason: 'CV chưa mô tả TypeScript.', action: 'Nếu đã dùng, bổ sung minh chứng thật; nếu chưa, thực hành trước.' },
    { skill: 'Git', jd_evidence: 'Git', cv_evidence: '', status: 'not_evidenced', priority: 'medium', reason: 'CV chưa thể hiện Git.', action: 'Đối chiếu dự án và bổ sung bằng chứng có thật.' },
    { skill: 'Docker', jd_evidence: 'Docker', cv_evidence: 'Tôi chưa biết Docker.', status: 'needs_development', priority: 'medium', reason: 'CV nêu rõ chưa biết.', action: 'Thực hành Dockerfile chạy được dự án trước khi ghi vào CV.' },
  ],
  outline: [
    { title: 'Thông tin liên hệ', rationale: 'Giúp liên hệ.', content_suggestions: ['Kiểm tra email.'], requirement_numbers: [] },
    { title: 'Kỹ năng liên quan', rationale: 'Ưu tiên yêu cầu JD.', content_suggestions: ['Chỉ ghi kỹ năng đã có bằng chứng.'], requirement_numbers: [2, 3, 4] },
    { title: 'Dự án thực tế', rationale: 'Làm rõ bằng chứng React.', content_suggestions: ['Nêu vai trò thật trong dự án.'], requirement_numbers: [1] },
  ],
};
const result = await analyzeCareerPlan(input, { GEMINI_API_KEY: 'synthetic-only' }, async () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(output) }] } }] }));
const fewOutput = structuredClone(output);
fewOutput.requirements = [fewOutput.requirements[3]];
fewOutput.outline.forEach(s => { s.requirement_numbers = [1]; });
const fewResult = await analyzeCareerPlan(input, { GEMINI_API_KEY: 'synthetic-only' }, async () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(fewOutput) }] } }] }));
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
await context.route('https://fonts.googleapis.com/**', route => route.abort());
await context.route('**/api/cv/config', route => route.fulfill({ json: { gemini: { configured: true, model: 'mock-ui-model' } } }));
let calls = 0, mode = 'success';
await context.route('**/api/cv/consult', async route => {
  calls++;
  const body = route.request().postDataJSON();
  assert.equal(body.cv_text, input.cv_text);
  assert.equal(body.job_title, input.job_title);
  if (mode === 'error') return route.fulfill({ status: 429, json: { error: 'Gemini đã giới hạn lượt gọi.' } });
  if (mode === 'few') return route.fulfill({ json: fewResult });
  return route.fulfill({ json: result });
});
const page = await context.newPage();
const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
const checks = [];
const passed = name => { checks.push({ name, status: 'pass' }); console.log('PASS ' + name); };
try {
  await page.goto('http://127.0.0.1:8787/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Tư vấn CV theo JD', exact: true }).click();
  await page.getByRole('heading', { name: '1. CV cần tư vấn' }).waitFor();
  const analyze = page.getByRole('button', { name: 'Phân tích gaps & outline CV', exact: true });
  assert(await analyze.isDisabled());
  assert.equal(await page.getByLabel('Nội dung CV', { exact: true }).inputValue(), '');
  passed('Form ban đầu rỗng, phân tích bị chặn khi thiếu CV/JD');
  await page.screenshot({ path: `${dir}/desktop-input.png` });

  await page.getByLabel('Người trình bày', { exact: true }).fill('Người kiểm thử (dữ liệu giả lập)');
  await page.getByLabel('Nội dung CV', { exact: true }).fill(input.cv_text);
  await page.getByLabel('Vị trí muốn ứng tuyển', { exact: true }).fill(input.job_title);
  await page.getByLabel('Nội dung JD', { exact: true }).fill(input.jd_text);
  await page.getByLabel('Nguồn JD / đường dẫn tin', { exact: true }).fill(input.jd_source);
  await analyze.click();
  await page.getByRole('heading', { name: '3. Kết quả đối chiếu CV–JD', exact: true }).waitFor();
  assert.equal(calls, 1);
  assert(await page.getByRole('heading', { name: 'R2. TypeScript', exact: true }).isVisible());
  assert.equal(await page.getByRole('heading', { name: 'R1. React', exact: true }).count(), 0);
  assert(await page.getByText('25% có bằng chứng', { exact: true }).isVisible());
  assert.equal(await page.locator('.career-check-state').filter({ hasText: 'Cần hoàn tất' }).count(), 6);
  assert(await page.getByLabel('Tôi đã tự nộp video', { exact: false }).isDisabled());
  passed('Đối chiếu đúng cặp CV–JD; hiển thị ba gap và tỷ lệ bằng chứng 25%');
  const exportButton = page.getByRole('button', { name: 'Tải bản phân tích & khung thuyết minh (.md)', exact: true });
  assert(await exportButton.isDisabled());
  await page.getByRole('heading', { name: '3. Kết quả đối chiếu CV–JD', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${dir}/desktop-gaps.png` });
  await page.getByLabel('Chỉ xem các khoảng trống', { exact: true }).uncheck();
  assert(await page.getByRole('heading', { name: 'R1. React', exact: true }).isVisible());
  passed('Bộ lọc phân biệt yêu cầu có bằng chứng với các khoảng trống');
  await page.getByLabel('Tôi đã đối chiếu trích dẫn và phân loại', { exact: false }).check();
  assert(await exportButton.isDisabled());
  await page.getByLabel('Tôi đã kiểm tra outline', { exact: false }).check();
  assert(await exportButton.isEnabled());
  await page.getByRole('heading', { name: '4. Outline CV đề xuất', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${dir}/desktop-outline.png` });
  const downloading = page.waitForEvent('download'); await exportButton.click();
  const download = await downloading; await download.saveAs(`${dir}/exported-analysis.md`);
  const markdown = await fs.readFile(`${dir}/exported-analysis.md`, 'utf8');
  assert(markdown.includes('TypeScript') && markdown.includes('Khung thuyết minh') && markdown.includes('R4'));
  passed('Xuất Markdown cần cả hai xác nhận; tệp có đối chiếu, outline và khung video');

  await page.getByRole('button', { name: 'Tổng quan', exact: true }).click();
  await page.getByRole('heading', { name: 'Góc nhìn tuyển dụng', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Tư vấn CV theo JD', exact: true }).click();
  await page.getByRole('heading', { name: 'Từ CV đến kế hoạch cải thiện.', exact: true }).waitFor();
  assert(await page.getByRole('heading', { name: '3. Kết quả đối chiếu CV–JD', exact: true }).isVisible());
  assert.equal(await page.getByLabel('Nội dung CV', { exact: true }).inputValue(), input.cv_text);
  passed('Chuyển tab giữ nội dung và kết quả tư vấn');
  await page.getByLabel('Nội dung JD', { exact: true }).fill(input.jd_text + ' Thêm yêu cầu để kiểm tra.');
  assert.equal(await page.getByRole('heading', { name: '3. Kết quả đối chiếu CV–JD', exact: true }).count(), 0);
  passed('Sửa JD xóa kết quả và xác nhận cũ');
  mode = 'error'; await analyze.click();
  await page.getByRole('alert').filter({ hasText: 'Gemini đã giới hạn lượt gọi.' }).waitFor();
  assert.equal(await page.getByLabel('Nội dung CV', { exact: true }).inputValue(), input.cv_text);
  assert.equal(await page.getByRole('heading', { name: '3. Kết quả đối chiếu CV–JD', exact: true }).count(), 0);
  passed('Lỗi quota giữ dữ liệu nhập và không hiện kết quả giả');

  mode = 'few'; await analyze.click();
  await page.getByText('Hiện chỉ có 1 khoảng trống', { exact: false }).waitFor();
  assert.equal(await page.locator('.career-check-state').filter({ hasText: 'Cần hoàn tất' }).count(), 6);
  passed('Ít hơn ba gap hiển thị cảnh báo, không tự đánh dấu đủ checklist');
  mode = 'success'; await analyze.click();
  await page.getByRole('heading', { name: '3. Kết quả đối chiếu CV–JD', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().right <= .5);
  await page.getByRole('heading', { name: '1. CV cần tư vấn' }).scrollIntoViewIfNeeded();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: `${dir}/mobile-input.png` });
  await page.getByRole('heading', { name: '3. Kết quả đối chiếu CV–JD', exact: true }).scrollIntoViewIfNeeded();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: `${dir}/mobile-gaps.png` });
  passed('Viewport 390px không tràn ngang ở form và kết quả');
  assert.equal(pageErrors.length, 0, JSON.stringify(pageErrors));
  passed('Không có lỗi JavaScript trong các luồng đã thử');
  await fs.writeFile(`${dir}/results.json`, JSON.stringify({ date: new Date().toISOString(), environment: 'Headless Microsoft Edge (Chromium), local production build; Google replies mocked; synthetic CV/JD', checks, pageErrors }, null, 2));
} catch (e) {
  await fs.writeFile(`${dir}/failure.html`, await page.content());
  await page.screenshot({ path: `${dir}/failure.png` });
  throw e;
} finally { await browser.close(); }
