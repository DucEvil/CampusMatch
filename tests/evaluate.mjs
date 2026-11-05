import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {fitModel,recommend,parseCV,cosine,vector} from '../lib/matching.mjs';
const f=JSON.parse(fs.readFileSync(new URL('../data/fixtures.json',import.meta.url)));
const train=f.jobs.filter(j=>j.split==='train');const model=fitModel(train.map(j=>j.description+' '+j.title+' '+j.skills.join(' ')));
const dcg=grades=>grades.reduce((s,g,i)=>s+g/Math.log2(i+2),0);
const measure=(list,labels,k=3)=>{const ids=list.slice(0,k);const grades=ids.map(id=>labels[id]||0);const relevant=Object.values(labels).filter(v=>v>=2).length;const ideal=Object.values(labels).sort((a,b)=>b-a).slice(0,k);return {precision:grades.filter(g=>g>=2).length/k,recall:grades.filter(g=>g>=2).length/relevant,ndcg:dcg(grades)/dcg(ideal)}};
const rows=[];const latency=[];
for(const c of f.candidates){
 const start=performance.now();const ranked=recommend(c,f.jobs,model,f.reference_date).filter(r=>r.eligible&&r.score!==null);latency.push(performance.now()-start);
 const lexical=f.jobs.map(j=>({id:j.id,score:cosine(vector(c.text,model),vector(j.description+' '+j.title+' '+j.skills.join(' '),model))})).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
 const alphabetical=[...f.jobs].sort((a,b)=>a.id.localeCompare(b.id));
 rows.push({candidate_id:c.id,split:c.split,recommendations:ranked.slice(0,3).map(r=>({job_id:r.job.id,score:r.score})),hybrid:measure(ranked.map(r=>r.job.id),f.labels[c.id]),tfidf:measure(lexical.map(r=>r.id),f.labels[c.id]),alphabetical:measure(alphabetical.map(r=>r.id),f.labels[c.id])});
}
const aggregate=(split,method)=>{const r=rows.filter(r=>r.split===split);return Object.fromEntries(['precision','recall','ndcg'].map(k=>[k,Number((r.reduce((s,x)=>s+x[method][k],0)/r.length).toFixed(4))]));};
const result={dataset:'Dữ liệu và nhãn kỳ vọng giả lập do người thiết kế tạo, chưa được chuyên gia tuyển dụng xác nhận.',model_version:model.version,train_job_documents:train.length,held_out_job_documents:f.jobs.length-train.length,vocabulary_size:model.vocabulary_size,validation_candidates:4,test_candidates:8,k:3,positive_grade_threshold:2,grade_scale:'0 không liên quan, 1 liên quan thấp, 2 phù hợp, 3 rất phù hợp',metrics:{test:{hybrid:aggregate('test','hybrid'),tfidf:aggregate('test','tfidf'),alphabetical:aggregate('test','alphabetical')},validation:{hybrid:aggregate('validation','hybrid')}},latency_ms:{median:[...latency].sort((a,b)=>a-b)[Math.floor(latency.length/2)],max:Math.max(...latency)},limitations:['Nhãn được đặt theo kịch bản, chưa có đánh giá chuyên gia độc lập.','Tập nhỏ gồm 16 tin và 12 CV giả lập, không đại diện thị trường.','Không dùng nhãn test để fit IDF hoặc điều chỉnh trọng số. Fit 12 mô tả train, không fit trên CV.','Xếp hạng trên toàn bộ 16 tin. Đây là holdout hồ sơ, không phải kiểm thử thuần cold-start tin.','Thời gian đo là tính toán trong Node trên máy phát triển, không phải độ trễ API production.'],rows};
fs.writeFileSync(new URL('../data/evaluation.json',import.meta.url),JSON.stringify(result,null,2));
fs.writeFileSync(new URL('../data/model.json',import.meta.url),JSON.stringify(model,null,2));
console.log(JSON.stringify({metrics:result.metrics,latency_ms:result.latency_ms,vocabulary:model.vocabulary_size},null,2));
