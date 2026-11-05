export const MODEL_VERSION='tfidf-hybrid-2.0';
export const ALIASES={HTML:['html','html5'],CSS:['css','css3'],JavaScript:['javascript','js','ecmascript'],React:['react','reactjs','react.js'],Python:['python'],SQL:['sql','postgresql','mysql'],Excel:['excel'],'Power BI':['power bi','powerbi'],Java:['java'],'Spring Boot':['spring boot','springboot'],Git:['git','github'],SEO:['seo'],'Content Writing':['content writing','viet noi dung','copywriting'],Canva:['canva'],'Google Analytics':['google analytics','ga4']};
export const fold=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function parseCV(text){
 if(typeof text!=='string'||text.trim().length<20)throw new Error('CV cần ít nhất 20 ký tự.');
 if(text.length>30000)throw new Error('CV tối đa 30.000 ký tự.');
 const normalized=fold(text);const found=[];
 for(const [skill,aliases] of Object.entries(ALIASES)){
  let evidence=null;
  for(const alias of aliases){
   const re=new RegExp('(^|[^a-z0-9])('+esc(alias)+')(?=$|[^a-z0-9])','g');let match;
   while((match=re.exec(normalized))!==null){
    const at=match.index+match[1].length;const before=normalized.slice(Math.max(0,at-24),at);
    if(/(?:chua biet|khong biet|khong co|chua hoc|no experience in|without)\s*$/.test(before))continue;
    evidence=text.slice(Math.max(0,at-35),Math.min(text.length,at+alias.length+65)).replace(/\n/g,' ');break;
   }
   if(evidence)break;
  }
  if(evidence)found.push({skill,evidence,method:'dictionary-v1',requires_confirmation:true});
 }
 return {skills:found,characters:text.length,requires_confirmation:true,warning:'Trích xuất theo từ điển, chưa đánh giá mức thành thạo. Hãy xác nhận trước khi ghép việc.'};
}
const STOP=new Set('va la cua cho voi trong cac mot nhung duoc tu den khi tai co sinh vien nam yeu cau cong viec thuc tap hoc hoi nhom chuyen mon'.split(' '));
export function tokens(text){
 let s=fold(text);
 for(const [canonical,aliases]of Object.entries(ALIASES))for(const a of [...aliases].sort((a,b)=>b.length-a.length))s=s.replace(new RegExp('(^|[^a-z0-9])'+esc(a)+'(?=$|[^a-z0-9])','g'),(_,p)=>p+' '+canonical.toLowerCase().replace(/ /g,'_')+' ');
 const words=(s.match(/[a-z0-9_]+/g)||[]).filter(w=>w.length>1&&!STOP.has(w));
 return [...words,...words.slice(0,-1).map((w,i)=>w+'~'+words[i+1])];
}
export function fitModel(documents){
 const df={};for(const doc of documents)for(const t of new Set(tokens(doc)))df[t]=(df[t]||0)+1;
 const idf=Object.fromEntries(Object.entries(df).map(([t,n])=>[t,Math.log((1+documents.length)/(1+n))+1]));
 return {version:MODEL_VERSION,trained_documents:documents.length,idf,vocabulary_size:Object.keys(idf).length};
}
export function vector(text,model){
 const counts={};for(const t of tokens(text))if(model.idf[t])counts[t]=(counts[t]||0)+1;
 let norm=0;for(const t in counts){counts[t]=(1+Math.log(counts[t]))*model.idf[t];norm+=counts[t]**2;}norm=Math.sqrt(norm);
 if(norm)for(const t in counts)counts[t]/=norm;return counts;
}
export function cosine(a,b){let sum=0;for(const t in a)sum+=a[t]*(b[t]||0);return Math.min(1,Math.max(0,sum));}
export function matchJob(profile,job,model,asOf='2026-10-29'){
 const matched=job.skills.filter(s=>profile.skills?.includes(s));const missing=job.skills.filter(s=>!profile.skills?.includes(s));
 const coverage=job.skills.length?matched.length/job.skills.length:null;
 const similarity=cosine(vector(profile.text||'',model),vector(job.description+' '+job.title+' '+job.skills.join(' '),model));
 const knownDays=Array.isArray(profile.days)&&profile.days.length>0&&Array.isArray(job.days)&&job.days.length>0;
 const schedule=knownDays?job.days.every(d=>profile.days.includes(d)):null;
 const cityKnown=!!profile.city&&!!job.city;const modeKnown=!!profile.mode&&!!job.mode;
 const location=cityKnown?(job.mode==='Remote'||profile.city===job.city?1:0):null;
 const mode=modeKnown?(profile.mode==='Any'||profile.mode===job.mode?1:0):null;
 const blockers=[];if(job.status!=='open'||job.deadline<asOf)blockers.push('Tin đã đóng hoặc hết hạn');if(schedule===false)blockers.push('Trùng lịch học hoặc lịch bận');
 const complete=!!profile.confirmed&&schedule!==null&&coverage!==null&&location!==null&&mode!==null;
 const eligible=blockers.length===0;
 const score=complete&&eligible?Math.round(100*(.5*coverage+.3*similarity+.1*location+.1*mode)*10)/10:null;
 return {job,score,eligible,complete,matched,missing,coverage,similarity,schedule,location,mode,blockers,model_version:model.version,components:{skills:coverage===null?null:50*coverage,text:30*similarity,location:location===null?null:10*location,mode:mode===null?null:10*mode},explanation:!profile.confirmed?'Hãy xác nhận hồ sơ trước khi tính tổng điểm.':!eligible?blockers.join('. '):!complete?'Thiếu thông tin để tính đủ điểm.':`Khớp ${matched.length}/${job.skills.length} kỹ năng. Điểm là mức khớp tiêu chí, không phải xác suất trúng tuyển.`};
}
export function recommend(profile,jobs,model,asOf){return jobs.map(j=>matchJob(profile,j,model,asOf)).sort((a,b)=>Number(b.eligible)-Number(a.eligible)||(b.score??-1)-(a.score??-1)||a.job.id.localeCompare(b.job.id));}
const median=a=>{if(!a.length)return null;const s=[...a].sort((a,b)=>a-b);return s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2;};
export function dashboard({jobs,candidates,applications,events,salary_snapshots},filters={}){
 const jobIds=new Set(jobs.filter(j=>(!filters.city||j.city===filters.city)&&(!filters.role||j.role===filters.role)).map(j=>j.id));
 const cohort=applications.filter(a=>jobIds.has(a.job_id)&&(!filters.from||a.created_at.slice(0,10)>=filters.from)&&(!filters.to||a.created_at.slice(0,10)<=filters.to));
 const appIds=new Set(cohort.map(a=>a.id));const relevantEvents=events.filter(e=>appIds.has(e.application_id));
 const uniqueCandidates=new Set(cohort.map(a=>a.candidate_id));
 const cs=candidates.filter(c=>uniqueCandidates.has(c.id));
 const skills=Object.keys(ALIASES).map(skill=>({skill,count:cs.filter(c=>c.skills.includes(skill)).length})).filter(x=>x.count).sort((a,b)=>b.count-a.count||a.skill.localeCompare(b.skill));
 const funnel=['submitted','screened','interview','offered','hired'].map(status=>({status,count:new Set(relevantEvents.filter(e=>e.status===status).map(e=>e.application_id)).size}));
 const salary=salary_snapshots.filter(s=>jobIds.has(s.job_id)&&s.currency==='VND'&&s.period==='month'&&s.salary_min>=0&&s.salary_max>=s.salary_min&&(!filters.from||s.month>=filters.from.slice(0,7))&&(!filters.to||s.month<=filters.to.slice(0,7)));
 const months=[...new Set(salary.map(s=>s.month))].sort();
 const trend=months.map(month=>{const rows=salary.filter(s=>s.month===month);return {month,median:median(rows.map(s=>(s.salary_min+s.salary_max)/2)),sample_size:rows.length};});
 const n=cohort.length;const hired=funnel.find(f=>f.status==='hired').count;
 const missingSalary=jobs.filter(j=>jobIds.has(j.id)&&!(j.currency==='VND'&&j.salary_period==='month'&&Number.isFinite(j.salary_min)&&Number.isFinite(j.salary_max))).length;
 return {applications:n,candidates:uniqueCandidates.size,open_jobs:jobs.filter(j=>jobIds.has(j.id)&&j.status==='open'&&j.deadline>=(filters.as_of||new Date().toISOString().slice(0,10))).length,hire_rate:n?hired/n:null,skills,funnel,trend,missing_salary:missingSalary,rejected:cohort.filter(a=>a.status==='rejected').length,cohort:'Lọc theo ngày gửi đơn. Funnel đếm đơn từng đi qua mỗi giai đoạn, không cộng các trạng thái hiện tại.',salary_note:'Trung vị của trung điểm khoảng lương công bố. VND/tháng. Dữ liệu giả lập, không phải thống kê thị trường.'};
}
export const TRANSITIONS={submitted:['screened','rejected'],screened:['interview','rejected'],interview:['offered','rejected'],offered:['hired','rejected'],hired:[],rejected:[]};
