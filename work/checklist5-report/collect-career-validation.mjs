import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const dir = 'docs/individual-assignment-evidence';
await fs.mkdir(dir, { recursive: true });
const tap = await fs.readFile('work/checklist5-report/career-tests.tap.log', 'utf8');
const total = Number(tap.match(/# tests (\d+)/)?.[1]);
const pass = Number(tap.match(/# pass (\d+)/)?.[1]);
const fail = Number(tap.match(/# fail (\d+)/)?.[1]);
assert.equal(total, 84); assert.equal(pass, 84); assert.equal(fail, 0);
const ui = JSON.parse(await fs.readFile('work/checklist5-report/career-ui/results.json', 'utf8'));
assert.equal(ui.checks.length, 10); assert(ui.checks.every(c => c.status === 'pass'));
const base = 'http://127.0.0.1:8787';
const [health, invalid, origin, root] = await Promise.all([
  fetch(base + '/api/health'),
  fetch(base + '/api/cv/consult', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cv_text: '' }) }),
  fetch(base + '/api/cv/consult', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://other-host' }, body: '{}' }),
  fetch(base),
]);
assert.equal(health.status, 200); assert.equal(invalid.status, 400); assert.equal(origin.status, 403); assert.equal(root.status, 200);
assert((await root.text()).includes('Tư vấn CV theo JD'));
const hashes = {};
for (const path of ['lib/career-analysis.ts', 'lib/career-report.ts', 'components/career-workspace.tsx', 'app/page.tsx', 'app/api/[...path]/route.ts', 'app/globals.css', 'tests/career-analysis.test.mjs']) {
  hashes[path] = createHash('sha256').update(await fs.readFile(path)).digest('hex');
}
const report = {
  recorded_at: new Date().toISOString(), local_date: '2026-11-06',
  unit_and_api_tests: { total, pass, fail, suites: { core: 32, api: 18, cv_and_image: 19, career: 15 }, gemini: 'mock responses; no real Google call' },
  typecheck: { command: 'node node_modules/typescript/bin/tsc --noEmit', exit_code: 0 },
  production_build: { command: 'node scripts/run-framework.mjs build', exit_code: 0 },
  production_http_smoke: { health: health.status, empty_consult_input: invalid.status, cross_origin_consult: origin.status, homepage: root.status, new_navigation_present: true },
  browser: ui,
  visual_review: { desktop: '1440x1000', mobile: '390x844', result: 'Reviewed input, gaps, outline and mobile pages; no clipping or horizontal overflow observed.' },
  limitations: ['Synthetic CV/JD and mocked Gemini replies used for automated tests.', 'Real CV/JD quality review, live Gemini response, video recording and submission remain user-provided demo steps.'],
  source_sha256: hashes,
};
await fs.copyFile('work/checklist5-report/career-tests.tap.log', dir + '/tests.tap.log');
await fs.writeFile(dir + '/validation.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ unit_pass: pass, ui_pass: ui.checks.length, http_smoke: report.production_http_smoke, evidence: dir }, null, 2));
