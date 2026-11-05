import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const root = 'E:/CampusMatch', out = path.join(root, 'docs/checklist5-evidence');
fs.mkdirSync(out, { recursive: true });
const suites = [
  { id:'core',name:'Lõi xử lý CV ghép việc BI và dữ liệu',file:'tests/core.test.mjs',args:['--test','--test-reporter=tap','tests/core.test.mjs'] },
  { id:'api',name:'API nghiệp vụ với SQLite trong bộ nhớ',file:'tests/api.test.mjs',args:['--loader','./tests/ts-loader.mjs','--test','--test-reporter=tap','tests/api.test.mjs'] },
  { id:'gemini',name:'Gemini và ảnh CV với phản hồi mô phỏng',file:'tests/cv-analysis.test.mjs',args:['--loader','./tests/ts-loader.mjs','--test','--test-reporter=tap','tests/cv-analysis.test.mjs'] },
];
for (const suite of suites) {
  const r=spawnSync(process.execPath,suite.args,{cwd:root,encoding:'utf8',maxBuffer:5e6});
  fs.writeFileSync(path.join(out,`${suite.id}.tap.log`),r.stdout+'\n'+r.stderr);
  suite.exit_code=r.status;
  suite.cases=[...r.stdout.matchAll(/^ok (\d+) - (.+)$/gm)].map(m=>({number:Number(m[1]),name:m[2],status:'pass'}));
  suite.total=Number(r.stdout.match(/^# tests (\d+)/m)?.[1]||0);
  suite.pass=Number(r.stdout.match(/^# pass (\d+)/m)?.[1]||0);
  suite.fail=Number(r.stdout.match(/^# fail (\d+)/m)?.[1]||0);
  if(r.status!==0||suite.total!==suite.cases.length)throw new Error(`Invalid test results for ${suite.id}`);
}
const tsc=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--noEmit'],{cwd:root,encoding:'utf8'});
fs.writeFileSync(path.join(out,'typecheck.log'),`Exit code: ${tsc.status}\n${tsc.stdout}${tsc.stderr}`);
if(tsc.status!==0)throw new Error('TypeScript did not pass');
let evaluator=fs.readFileSync(path.join(root,'tests/evaluate.mjs'),'utf8');
evaluator=evaluator.replace("'../lib/matching.mjs'",JSON.stringify(pathToFileURL(path.join(root,'lib/matching.mjs')).href));
for(const [source,target] of [['fixtures.json',path.join(root,'data/fixtures.json')],['evaluation.json',path.join(out,'evaluation.json')],['model.json',path.join(out,'model.json')]]) {
  evaluator=evaluator.replace(`new URL('../data/${source}',import.meta.url)`,JSON.stringify(target));
}
const ev=spawnSync(process.execPath,['--input-type=module','--eval',evaluator],{cwd:root,encoding:'utf8'});
fs.writeFileSync(path.join(out,'evaluation.log'),ev.stdout+'\n'+ev.stderr);
if(ev.status!==0)throw new Error(ev.stderr);
const f=JSON.parse(fs.readFileSync(path.join(root,'data/fixtures.json'),'utf8'));
const evaluation=JSON.parse(fs.readFileSync(path.join(out,'evaluation.json'),'utf8'));
const stored=JSON.parse(fs.readFileSync(path.join(root,'data/evaluation.json'),'utf8'));
const hashes=Object.fromEntries(['data/fixtures.json','lib/matching.mjs','lib/cv-analysis.ts','lib/cv-image-upload.ts','tests/evaluate.mjs','tests/core.test.mjs','tests/api.test.mjs','tests/cv-analysis.test.mjs','drizzle/0000_puzzling_vulcan.sql'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
const summary={report_date:'2026-11-05',run_at_bangkok:new Date().toLocaleString('sv-SE',{timeZone:'Asia/Bangkok'}),node:process.version,platform:os.platform(),release:os.release(),architecture:os.arch(),cpu:os.cpus()[0]?.model,model:evaluation.model_version,total:suites.reduce((s,x)=>s+x.total,0),pass:suites.reduce((s,x)=>s+x.pass,0),fail:suites.reduce((s,x)=>s+x.fail,0),suites,typecheck_exit_code:tsc.status,stored_ranking_metrics_reproduced:JSON.stringify(evaluation.metrics)===JSON.stringify(stored.metrics),dataset:{jobs:f.jobs.length,candidates:f.candidates.length,employers:f.employers.length,applications:f.applications.length,events:f.events.length,salary_snapshots:f.salary_snapshots.length,reference_date:f.reference_date},profiles:f.candidates.map(c=>({id:c.id,role:c.role,split:c.split})),hashes};
fs.writeFileSync(path.join(out,'validation-summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({total:summary.total,pass:summary.pass,fail:summary.fail,typecheck:tsc.status,metrics:evaluation.metrics,latency:evaluation.latency_ms,reproduced:summary.stored_ranking_metrics_reproduced},null,2));
