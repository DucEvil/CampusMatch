import { env } from 'cloudflare:workers';
import fixtures from '../data/fixtures.json';
import {fitModel,MODEL_VERSION} from './matching.mjs';
const db=()=>env.DB as D1Database;
const now=()=>new Date().toISOString();
export async function seed(){
 const marker=await db().prepare('SELECT id FROM model_versions WHERE id=?').bind(MODEL_VERSION).first();if(marker)return;
 const statements:D1PreparedStatement[]=[];const add=(sql:string,...values:any[])=>statements.push(db().prepare(sql).bind(...values));
 fixtures.employers.forEach(e=>add('INSERT OR IGNORE INTO employers(id,name) VALUES(?,?)',e.id,e.name));
 fixtures.skills.forEach(s=>add('INSERT OR IGNORE INTO skills(id,name) VALUES(?,?)',s,s));
 fixtures.candidates.forEach(c=>{add('INSERT OR IGNORE INTO candidates(id,name,cv_text,city,mode,days_json,confirmed,version,updated_at) VALUES(?,?,?,?,?,?,1,1,?)',c.id,c.name,c.text,c.city,c.mode,JSON.stringify(c.days),now());c.skills.forEach(s=>add('INSERT OR IGNORE INTO candidate_skills(candidate_id,skill_id) VALUES(?,?)',c.id,s));});
 fixtures.jobs.forEach(j=>{add('INSERT OR IGNORE INTO jobs(id,employer_id,title,description,role,city,mode,days_json,salary_min,salary_max,currency,salary_period,published_at,deadline,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',j.id,j.employer_id,j.title,j.description,j.role,j.city,j.mode,JSON.stringify(j.days),j.salary_min,j.salary_max,j.currency,j.salary_period,j.published_at,j.deadline,j.status);j.skills.forEach(s=>add('INSERT OR IGNORE INTO job_skills(job_id,skill_id,essential) VALUES(?,?,?)',j.id,s,j.essential.includes(s)?1:0));});
 fixtures.applications.forEach(a=>add('INSERT OR IGNORE INTO applications(id,candidate_id,job_id,status,created_at,snapshot_json) VALUES(?,?,?,?,?,?)',a.id,a.candidate_id,a.job_id,a.status,a.created_at,a.profile_snapshot));
 fixtures.events.forEach(e=>add('INSERT OR IGNORE INTO application_events(id,application_id,status,occurred_at) VALUES(?,?,?,?)',e.id,e.application_id,e.status,e.occurred_at));
 fixtures.salary_snapshots.forEach(s=>add('INSERT OR IGNORE INTO salary_snapshots(id,job_id,month,salary_min,salary_max,currency,period) VALUES(?,?,?,?,?,?,?)',s.id,s.job_id,s.month,s.salary_min,s.salary_max,s.currency,s.period));
 for(let i=0;i<statements.length;i+=50)await db().batch(statements.slice(i,i+50));
 const model=fitModel(fixtures.jobs.filter(j=>j.split==='train').map(j=>j.description+' '+j.title+' '+j.skills.join(' ')));
 await db().prepare('INSERT OR IGNORE INTO model_versions(id,artifact_json,created_at) VALUES(?,?,?)').bind(MODEL_VERSION,JSON.stringify(model),now()).run();
}
export async function readData(){
 const names=['employers','skills','candidates','candidate_skills','jobs','job_skills','applications','application_events','salary_snapshots','model_versions'];
 const rows=await db().batch(names.map(n=>db().prepare('SELECT * FROM '+n)));
 const [employers,skills,cs,css,js,jss,applications,events,ss,models]=rows.map(r=>r.results as any[]);
 const candidates=cs.map(c=>({...c,text:c.cv_text,days:JSON.parse(c.days_json),confirmed:!!c.confirmed,skills:css.filter(s=>s.candidate_id===c.id).map(s=>s.skill_id)}));
 const jobs=js.map(j=>({...j,company:employers.find(e=>e.id===j.employer_id)?.name,days:JSON.parse(j.days_json),skills:jss.filter(s=>s.job_id===j.id).map(s=>s.skill_id),essential:jss.filter(s=>s.job_id===j.id&&s.essential).map(s=>s.skill_id)}));
 return {employers,skills:skills.map(s=>s.name),candidates,jobs,applications,events,salary_snapshots:ss.map(s=>({...s,role:jobs.find(j=>j.id===s.job_id)?.role,city:jobs.find(j=>j.id===s.job_id)?.city})),model:JSON.parse(models.find(m=>m.id===MODEL_VERSION)?.artifact_json||'null'),synthetic:true,reference_date:fixtures.reference_date};
}
export {db,now};
