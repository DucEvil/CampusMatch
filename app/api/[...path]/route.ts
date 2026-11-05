import { db, now, seed, readData } from '../../../lib/repository';
import { env } from 'cloudflare:workers';
import { analyzeCV, analyzeCVImage, CvAnalysisError, geminiConfig } from '../../../lib/cv-analysis';
import { readCVImageUpload } from '../../../lib/cv-image-upload';
import { analyzeCareerPlan } from '../../../lib/career-analysis';
import {parseCV,recommend,dashboard,MODEL_VERSION,TRANSITIONS,ALIASES} from '../../../lib/matching.mjs';
export const dynamic='force-dynamic';
const reply=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
class HttpError extends Error{constructor(public status:number,message:string){super(message)}}
function requireValue(ok:any,message:string){if(!ok)throw new HttpError(400,message)}
function validDays(d:any){return Array.isArray(d)&&d.length>0&&d.every((x:any)=>Number.isInteger(x)&&x>=2&&x<=8)&&new Set(d).size===d.length}
async function handle(request:Request){
 try{
  const url=new URL(request.url),path=url.pathname.replace('/api/','');
  if(request.method==='GET'){
   if(path==='health')return reply({ok:true,model:MODEL_VERSION});
   if(path==='cv/config')return reply({gemini:geminiConfig(env)});
   const data=await readData();
   if(path==='data')return reply(data);
   if(path==='bi')return reply(dashboard(data,Object.fromEntries(url.searchParams)));
   if(path==='applications')return reply(data.applications);
   return reply({error:'Không tìm thấy API.'},404);
  }
  const origin=request.headers.get('origin');if(origin&&origin!==url.origin)throw new HttpError(403,'Nguồn yêu cầu không hợp lệ.');
  if(path==='cv/image')return reply(await analyzeCVImage(await readCVImageUpload(request),env));
  requireValue(request.headers.get('content-type')?.includes('application/json'),'API yêu cầu JSON.');
  const length=Number(request.headers.get('content-length')||0);if(length>100000)throw new HttpError(413,'Nội dung quá lớn.');
  const raw=await request.text();if(raw.length>100000)throw new HttpError(413,'Nội dung quá lớn.');
  let body:any;try{body=JSON.parse(raw)}catch{throw new HttpError(400,'JSON không hợp lệ.');}
  requireValue(body&&typeof body==='object'&&!Array.isArray(body),'Nội dung JSON phải là một đối tượng.');
  if(path==='cv/consult')return reply(await analyzeCareerPlan(body,env));
  if(path==='init'){await seed();return reply({ok:true,synthetic:true});}
  if(path==='cv/parse'){
   requireValue(body.provider===undefined||['dictionary','gemini'].includes(body.provider),'Phương thức phân tích không hợp lệ.');
   if(body.provider==='gemini')return reply(await analyzeCV(body.text,env));
   return reply({...parseCV(body.text),provider:'dictionary'});
  }
  const data=await readData();
  if(path==='profiles'){
   requireValue(typeof body.name==='string'&&body.name.trim().length>=2&&body.name.length<=100,'Tên cần từ 2 đến 100 ký tự.');
   parseCV(body.text);requireValue(body.confirmed===true,'Hãy xác nhận kỹ năng trước khi lưu.');
   requireValue(Array.isArray(body.skills)&&body.skills.length>0&&body.skills.every((s:any)=>Object.hasOwn(ALIASES,s)),'Kỹ năng phải thuộc danh mục.');
   requireValue(['Hà Nội','TP Hồ Chí Minh','Đà Nẵng'].includes(body.city),'Địa điểm không hợp lệ.');
   requireValue(['Any','Remote','Hybrid','Onsite'].includes(body.mode),'Hình thức không hợp lệ.');requireValue(validDays(body.days),'Lịch rảnh không hợp lệ.');
   const id='MY_PROFILE',time=now();
   const stmts=[db().prepare('INSERT INTO candidates(id,name,cv_text,city,mode,days_json,confirmed,version,updated_at) VALUES(?,?,?,?,?,?,1,1,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,cv_text=excluded.cv_text,city=excluded.city,mode=excluded.mode,days_json=excluded.days_json,confirmed=1,version=candidates.version+1,updated_at=excluded.updated_at').bind(id,body.name.trim(),body.text,body.city,body.mode,JSON.stringify(body.days),time),db().prepare('DELETE FROM candidate_skills WHERE candidate_id=?').bind(id),...Array.from(new Set(body.skills)).map(s=>db().prepare('INSERT INTO candidate_skills(candidate_id,skill_id) VALUES(?,?)').bind(id,s))];
   await db().batch(stmts);return reply({id,message:'Đã lưu hồ sơ và phiên bản mới.'},201);
  }
  if(path==='match'){
   const profile=data.candidates.find(c=>c.id===body.candidate_id);if(!profile)throw new HttpError(404,'Không tìm thấy hồ sơ.');
   requireValue(profile.confirmed,'Hồ sơ chưa xác nhận.');
   const results=recommend(profile,data.jobs,data.model,new Date().toISOString().slice(0,10));
   const id=crypto.randomUUID();await db().prepare('INSERT INTO match_runs(id,candidate_id,model_id,profile_version,results_json,created_at) VALUES(?,?,?,?,?,?)').bind(id,profile.id,MODEL_VERSION,profile.version,JSON.stringify(results.map((r:any)=>({job_id:r.job.id,score:r.score,components:r.components,eligible:r.eligible}))),now()).run();
   return reply({id,results,profile_version:profile.version,model_version:MODEL_VERSION});
  }
  if(path==='applications'){
   const p=data.candidates.find(c=>c.id===body.candidate_id),j=data.jobs.find(j=>j.id===body.job_id);
   if(!p||!j)throw new HttpError(404,'Không tìm thấy hồ sơ hoặc công việc.');
   requireValue(p.confirmed,'Hồ sơ chưa xác nhận.');requireValue(j.status==='open'&&j.deadline>=new Date().toISOString().slice(0,10),'Tin đã đóng hoặc hết hạn.');
   if(data.applications.some(a=>a.candidate_id===p.id&&a.job_id===j.id))throw new HttpError(409,'Bạn đã ứng tuyển công việc này.');
   const id=crypto.randomUUID(),time=now();
   try{await db().batch([db().prepare('INSERT INTO applications(id,candidate_id,job_id,status,created_at,snapshot_json) VALUES(?,?,?,\'submitted\',?,?)').bind(id,p.id,j.id,time,JSON.stringify(p)),db().prepare('INSERT INTO application_events(id,application_id,status,occurred_at) VALUES(?,?,\'submitted\',?)').bind(crypto.randomUUID(),id,time)]);}catch(e:any){if(/UNIQUE/.test(String(e)))throw new HttpError(409,'Bạn đã ứng tuyển công việc này.');throw e;}
   return reply({id,message:'Đã gửi đơn. Hồ sơ lúc gửi đã được lưu.'},201);
  }
  if(path==='applications/status'){
   const a=data.applications.find(a=>a.id===body.id);if(!a)throw new HttpError(404,'Không tìm thấy đơn.');
   requireValue((TRANSITIONS as any)[a.status]?.includes(body.status),'Bước chuyển trạng thái không hợp lệ.');
   // The conditional event insert and update share the same transaction. Stale updates write neither event nor status.
   const eventId=crypto.randomUUID();const result=await db().batch([db().prepare('INSERT INTO application_events(id,application_id,status,occurred_at) SELECT ?,id,?,? FROM applications WHERE id=? AND status=?').bind(eventId,body.status,now(),a.id,a.status),db().prepare('UPDATE applications SET status=? WHERE id=? AND status=?').bind(body.status,a.id,a.status)]);
   if(result[1].meta.changes!==1)throw new HttpError(409,'Đơn vừa thay đổi. Hãy tải lại.');return reply({ok:true});
  }
  if(path==='jobs'){
   requireValue(typeof body.title==='string'&&body.title.trim().length>=5&&body.title.length<=150,'Tên vị trí cần từ 5 đến 150 ký tự.');
   requireValue(typeof body.description==='string'&&body.description.length>=30&&body.description.length<=10000,'Mô tả cần từ 30 đến 10.000 ký tự.');
   requireValue(data.employers.some(e=>e.id===body.employer_id),'Doanh nghiệp không hợp lệ.');requireValue(['frontend','data','backend','content'].includes(body.role),'Nhóm việc không hợp lệ.');
   requireValue(['Hà Nội','TP Hồ Chí Minh','Đà Nẵng'].includes(body.city),'Địa điểm không hợp lệ.');requireValue(['Remote','Hybrid','Onsite'].includes(body.mode),'Hình thức không hợp lệ.');
   requireValue(validDays(body.days),'Lịch làm không hợp lệ.');requireValue(Array.isArray(body.skills)&&body.skills.length>0&&body.skills.every((s:any)=>Object.hasOwn(ALIASES,s)),'Hãy chọn kỹ năng hợp lệ.');
   requireValue(Number.isInteger(body.salary_min)&&Number.isInteger(body.salary_max)&&body.salary_min>=0&&body.salary_max>=body.salary_min&&body.salary_max<=1000000000,'Khoảng lương không hợp lệ.');
   requireValue(/^\d{4}-\d{2}-\d{2}$/.test(body.deadline)&&!isNaN(Date.parse(body.deadline))&&new Date(body.deadline).toISOString().slice(0,10)===body.deadline&&body.deadline>=new Date().toISOString().slice(0,10),'Hạn nộp không hợp lệ.');
   const id=crypto.randomUUID(),time=now();await db().batch([db().prepare('INSERT INTO jobs(id,employer_id,title,description,role,city,mode,days_json,salary_min,salary_max,currency,salary_period,published_at,deadline,status) VALUES(?,?,?,?,?,?,?,?,?,?,\'VND\',\'month\',?,?,\'open\')').bind(id,body.employer_id,body.title.trim(),body.description,body.role,body.city,body.mode,JSON.stringify(body.days),body.salary_min,body.salary_max,time.slice(0,10),body.deadline),...Array.from(new Set(body.skills)).map(s=>db().prepare('INSERT INTO job_skills(job_id,skill_id,essential) VALUES(?,?,0)').bind(id,s)),db().prepare('INSERT INTO salary_snapshots(id,job_id,month,salary_min,salary_max,currency,period) VALUES(?,?,?,?,?,\'VND\',\'month\')').bind(crypto.randomUUID(),id,time.slice(0,7),body.salary_min,body.salary_max)]);
   return reply({id,message:'Đã đăng tin. Mô hình giữ nguyên phiên bản, tin mới dùng phép biến đổi hiện có.'},201);
  }
  return reply({error:'Không tìm thấy API.'},404);
 }catch(e:any){return reply({error:e instanceof HttpError||e instanceof CvAnalysisError?e.message:e?.message?.includes('CV')?e.message:'Không thể xử lý yêu cầu. Hãy thử lại.'},e instanceof HttpError||e instanceof CvAnalysisError?e.status:e?.message?.includes('CV')?400:500);}
}
export const GET=handle;export const POST=handle;
