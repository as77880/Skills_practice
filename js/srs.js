export const DAY=864e5;
const INT={1:1,2:2,3:4,4:10,5:21};
export const TYPES=['conceptual','technical','coding','scenario','interview','mathematical','project-based'];
export function nextReview(r,now=Date.now()){if(!(r>=1&&r<=5))throw new Error('rating required');return now+INT[r]*DAY}
export const validPhone=p=>/^[6-9]\d{9}$/.test(p||'');
export const validPass=p=>/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(p||'');
export const validDob=d=>{const t=Date.parse(d);return t<Date.now()&&t>Date.parse('1900-01-01')};
export function validQuestion(q){return !!q&&['id','category','topic','q','a'].every(k=>typeof q[k]==='string'&&q[k])&&[1,2,3].includes(q.level)&&TYPES.includes(q.type)}
export const today=()=>new Date().toISOString().slice(0,10);
export function stats(qs,prog){
  const cat={};let sum=0,n=0;
  for(const q of qs){const c=cat[q.topic]??={total:0,done:0,sum:0};c.total++;const p=prog[q.id];if(p){c.done++;c.sum+=p.r;sum+=p.r;n++}}
  const t=Object.entries(cat).filter(([,c])=>c.done).map(([k,c])=>({topic:k,avg:c.sum/c.done}));
  return{total:qs.length,attempted:n,remaining:qs.length-n,avg:n?sum/n:0,cat,weak:t.filter(x=>x.avg<3).map(x=>x.topic),strong:t.filter(x=>x.avg>=4).map(x=>x.topic)}
}
export function streak(days,now=today()){let s=0,d=new Date(now);if(!days[now])d.setDate(d.getDate()-1);while(days[d.toISOString().slice(0,10)]){s++;d.setDate(d.getDate()-1)}return s}
export function backup(st){const{progress,bm,notes,settings}=st;return{version:1,progress,bm,notes,settings}}
export function validBackup(o){return!!o&&o.version===1&&typeof o.progress==='object'&&Array.isArray(o.bm)&&typeof o.notes==='object'&&typeof o.settings==='object'}
