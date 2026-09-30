import {CFG} from './config.js';
import {nextReview,validPhone,validPass,validDob,validQuestion,stats,streak,today,backup,validBackup} from './srs.js';
const $=s=>document.querySelector(s),app=$('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=m=>{const t=$('#toast');t.textContent=m;t.style.display='block';setTimeout(()=>t.style.display='none',3000)};
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
let S=load('aj_state',{progress:{},bm:[],notes:{},settings:{goal:10},days:{},dirty:[]}),sess=load('aj_session',null),Q=[],prac=null;
const save=()=>localStorage.setItem('aj_state',JSON.stringify(S));S.del??={bm:[],notes:[]};
// ---- cloud (only rating/progress/bookmarks/notes/goal; NEVER answer text) ----
const API=CFG.API,cloud=!!API;
const call=async(p,b,t)=>{const r=await fetch(API+p,{method:'POST',headers:{'Content-Type':'application/json',...(t?{Authorization:'Bearer '+t}:{})},body:JSON.stringify(b)});const d=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(d.error||'Something went wrong. Try again.');e.status=r.status;throw e}return d};
async function sync(){if(!cloud||!sess||!navigator.onLine)return;
 try{const d=await call('/sync',{progress:Object.entries(S.progress).map(([id,p])=>({id,r:p.r,n:p.n,last:p.last,next:p.next})),bm:S.bm,notes:S.notes,goal:S.settings.goal,del:S.del},sess.token);
  for(const p of d.progress){const l=S.progress[p.id];if(!l||p.last>=l.last)S.progress[p.id]={r:p.r,n:p.n,last:p.last,next:p.next}}
  S.bm=d.bm;S.notes=d.notes;S.settings.goal=d.goal;S.del={bm:[],notes:[]};save()}
 catch(e){if(e.status===401){localStorage.removeItem('aj_session');sess=null;location.hash='#login';return}toast('Sync failed. Will retry when online.')}}
addEventListener('online',sync);
async function auth(kind,phone,pw,dob){if(kind==='forgot'){await call('/forgot',{phone,dob,password:pw});return}
 const d=await call(kind==='reg'?'/register':'/login',{phone,dob,password:pw});sess={uid:d.uid,phone,token:d.token,exp:Date.now()+d.expires_in*1e3};localStorage.setItem('aj_session',JSON.stringify(sess))}
// ---- questions ----
async function loadQ(){try{const idx=await (await fetch('questions/index.json')).json();
 const all=await Promise.all(idx.map(f=>fetch(`questions/${f}.json`).then(r=>r.json()).catch(()=>[])));
 Q=all.flat().filter(q=>validQuestion(q)||(console.warn('Invalid question skipped',q?.id),false))}catch{toast('Could not load questions.');Q=[]}}
// ---- views ----
const nav=r=>`<nav class="nav" aria-label="Main">${[['home','Home'],['practice','Practice'],['progress','Progress'],['saved','Saved'],['settings','Settings']].map(([k,l])=>`<a href="#${k}" class="${r===k?'on':''}">${l}</a>`).join('')}</nav>`;
const shell=(r,h)=>{app.innerHTML=`<main>${h}</main>`+nav(r)};
function authView(mode){const T={reg:'Create account',login:'Log in',forgot:'Reset password'}[mode],R=mode!=='login';app.innerHTML=`<form class="auth card" id="f" novalidate><img src="assets/logo.png" alt="AJ logo"><h1 style="text-align:center">${T}</h1>
<label for="ph">Phone number</label><input id="ph" inputmode="numeric" maxlength="10" autocomplete="username" required>
${R?'<label for="dob">Date of birth</label><input id="dob" type="date" required>':''}
<label for="pw">Password</label><input id="pw" type="password" autocomplete="${mode==='reg'?'new-password':'current-password'}" required>
${R?'<label for="pw2">Confirm password</label><input id="pw2" type="password" required>':''}
<p class="mut" id="err" role="alert"></p><button class="p" style="width:100%">${T}</button>
<p class="row"><a href="#${R?'login':'register'}">${R?'Back to login':'Create account'}</a></p>${mode==='login'?'<p><a href="#forgot">Forgot password?</a></p>':''}</form>`;
 $('#f').onsubmit=async e=>{e.preventDefault();const ph=$('#ph').value.trim(),pw=$('#pw').value,er=m=>$('#err').textContent=m;
  if(!validPhone(ph))return er('Enter a valid 10-digit Indian mobile number.');
  if(R){if(!validDob($('#dob').value))return er('Enter a valid date of birth.');if(!validPass(pw))return er('Password needs 8+ characters with letters and numbers.');if(pw!==$('#pw2').value)return er('Passwords do not match.')}
  try{if(cloud)await auth(mode,ph,pw,$('#dob')?.value);else{sess={uid:'local',phone:ph,exp:Date.now()+864e5*30};localStorage.setItem('aj_session',JSON.stringify(sess))}
   if(mode==='forgot'){toast('Password updated. Please log in.');location.hash='#login';return}await sync();location.hash='#home'}catch(x){er(x.message||'Something went wrong. Try again.')}}}
const due=()=>Q.filter(q=>S.progress[q.id]&&S.progress[q.id].next<=Date.now());
function home(){const s=stats(Q,S.progress),t=S.days[today()]||0,g=S.settings.goal,pct=s.total?Math.round(s.attempted/s.total*100):0;
 shell('home',`<div class="row"><img src="assets/logo.png" width="40" alt=""><h1>Welcome back</h1></div>
 <div class="card"><b class="sans">Today: ${t}/${g}</b><div class="bar" role="progressbar" aria-valuenow="${t}" aria-valuemax="${g}"><i style="width:${Math.min(100,t/g*100)}%"></i></div><p><a href="#practice"><button class="p">Continue practice</button></a></p></div>
 <div class="grid">${[['Total',s.total],['Attempted',s.attempted],['Remaining',s.remaining],['Avg rating',s.avg.toFixed(1)+'/5'],['Streak',streak(S.days)+' days'],['Due now',due().length]].map(([a,b])=>`<div class="card"><div class="big">${b}</div><div class="mut">${a}</div></div>`).join('')}</div>
 <div class="card"><b>Overall progress ${pct}%</b><div class="bar"><i style="width:${pct}%"></i></div></div>
 <div class="card"><b>Weak topics</b><p>${esc(s.weak.join(', ')||'None yet')}</p><b>Strong topics</b><p>${esc(s.strong.join(', ')||'None yet')}</p></div>`)}
function pool(m,c,l){let a=Q.filter(q=>(!c||q.category===c)&&(!l||q.level==l));const p=S.progress;
 const f={new:q=>!p[q.id],revision:q=>p[q.id]&&p[q.id].next<=Date.now(),weak:q=>p[q.id]&&p[q.id].r<=2,bookmarked:q=>S.bm.includes(q.id),interview:q=>['interview','scenario','project-based'].includes(q.type),coding:q=>q.type==='coding'}[m];
 if(f)a=a.filter(f);if(m==='random')a=[...a].sort(()=>Math.random()-.5);return a}
function practice(){if(prac?.list?.length&&prac.i<prac.list.length)return question();
 const cats=[...new Set(Q.map(q=>q.category))];
 shell('practice',`<h1>Practice</h1><div class="card"><label>Mode<br><select id="m">${[['all','All questions'],['new','New questions'],['revision','Revision'],['weak','Weak questions'],['random','Random'],['bookmarked','Bookmarked'],['interview','Interview practice'],['coding','Coding practice']].map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label>
 <p><label>Category<br><select id="c"><option value="">All</option>${cats.map(c=>`<option>${esc(c)}</option>`).join('')}</select></label> <label>Difficulty<br><select id="l"><option value="">All</option><option value="1">1 Easy</option><option value="2">2 Medium</option><option value="3">3 Hard</option></select></label></p>
 <input id="sq" placeholder="Search question, topic or tag" aria-label="Search" style="width:100%;margin-bottom:10px"><button class="p" id="go">Start</button></div>`);
 $('#go').onclick=()=>{let l=pool($('#m').value,$('#c').value,$('#l').value);const s=$('#sq').value.toLowerCase();if(s)l=l.filter(q=>(q.q+q.topic+(q.tags||[]).join(' ')).toLowerCase().includes(s));
  if(!l.length)return toast('No questions match. Try another mode or filter.');prac={list:l,i:0};question()}}
function question(){const q=prac.list[prac.i],nt=S.notes[q.id]||'',bm=S.bm.includes(q.id),code=q.type==='coding';let rated=0,shown=0;
 shell('practice',`<div class="row sans"><span>${esc(q.category)} › ${esc(q.topic)}</span><span class="mut">Level ${q.level} · ${esc(q.type)}</span><span class="mut">${prac.i+1}/${prac.list.length}</span><button id="bm" aria-pressed="${bm}">${bm?'★ Saved':'☆ Save'}</button></div>
 <div class="bar"><i style="width:${(prac.i)/prac.list.length*100}%"></i></div>
 <div class="card"><h2>${esc(q.q)}</h2><label for="ua" class="mut">Your answer</label><textarea id="ua" class="${code?'code':''}" spellcheck="${!code}"></textarea>
 <p><button class="p" id="sub">Submit answer</button></p></div><div id="res"></div>
 <div class="card"><label for="nt" class="mut">Personal note</label><textarea id="nt" style="min-height:70px" maxlength="500">${esc(nt)}</textarea><button id="sn">Save note</button> <button id="dn">Delete note</button></div>
 <p><button class="p" id="nx" disabled>Next question</button></p>`);
 $('#bm').onclick=()=>{if(bm)S.del.bm.push(q.id);S.bm=bm?S.bm.filter(x=>x!==q.id):[...S.bm,q.id];save();question();sync()};
 $('#sn').onclick=()=>{S.notes[q.id]=$('#nt').value.slice(0,500);save();toast('Note saved');sync()};
 $('#dn').onclick=()=>{if(confirm('Delete this note?')){delete S.notes[q.id];S.del.notes.push(q.id);save();question()}};
 $('#sub').onclick=()=>{const mine=$('#ua').value.trim();if(!mine)return toast('Write your answer first.');shown=1;$('#sub').disabled=true;$('#ua').readOnly=true;
  const kp=(q.key||q.tags||[]).map(k=>`<li>${esc(k)}</li>`).join('');
  $('#res').innerHTML=`<div class="card"><h3>Your answer</h3><div class="ans" id="mine"></div></div><div class="card"><h3>Correct answer</h3><div class="ans ok">${esc(q.a)}</div><h3>Key points</h3><ul>${kp}</ul></div>
  <div class="card"><h3>How well did you answer?</h3><div class="row stars" role="group" aria-label="Rating">${[1,2,3,4,5].map(n=>`<button data-r="${n}" aria-label="${n} stars">${n} ⭐</button>`).join('')}</div></div>`;
  $('#mine').textContent=mine; // user answer stays in this page's memory only
  document.querySelectorAll('.stars button').forEach(b=>b.onclick=()=>{rated=+b.dataset.r;document.querySelectorAll('.stars button').forEach(x=>x.classList.toggle('on',x===b));
   const p=S.progress[q.id],now=Date.now();S.progress[q.id]={r:rated,n:(p?.n||0)+1,last:now,next:nextReview(rated,now)};
   if(!p)S.days[today()]=(S.days[today()]||0)+1;save();$('#nx').disabled=false;sync()})};
 $('#nx').onclick=()=>{if(!shown||!rated)return;prac.i++;if(prac.i>=prac.list.length){prac=null;toast('Session complete');location.hash='#progress';return}question()}}
function progress(){const s=stats(Q,S.progress),wk=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);const k=d.toISOString().slice(0,10);return[k.slice(5),S.days[k]||0]}),mx=Math.max(1,...wk.map(x=>x[1]));
 shell('progress',`<h1>Progress</h1><div class="card"><b>Last 7 days</b><div class="row" style="align-items:end;height:110px">${wk.map(([d,n])=>`<div style="flex:1;text-align:center" class="mut"><div style="background:var(--pri);height:${n/mx*80}px;border-radius:4px 4px 0 0"></div>${n}<br>${d}</div>`).join('')}</div></div>
 <div class="card"><b>By topic</b>${Object.entries(s.cat).map(([t,c])=>`<p class="sans">${esc(t)} ${c.done}/${c.total}<span class="mut"> avg ${c.done?(c.sum/c.done).toFixed(1):'-'}</span></p><div class="bar"><i style="width:${c.done/c.total*100}%"></i></div>`).join('')}</div>
 <div class="card"><b>Achievements</b><p>${[[1,'First question'],[10,'10 questions'],[50,'50 questions'],[100,'100 questions'],[500,'500 questions']].filter(([n])=>s.attempted>=n).map(x=>'🏅 '+x[1]).join(' · ')||'Answer a question to earn your first badge.'}${streak(S.days)>=7?' · 🔥 7-day streak':''}</p></div>`)}
function saved(){const b=Q.filter(q=>S.bm.includes(q.id));shell('saved',`<h1>Saved</h1>${b.length?b.map(q=>`<div class="card"><b>${esc(q.q)}</b><p class="mut">${esc(S.notes[q.id]||'No note')}</p></div>`).join(''):'<div class="card">Nothing saved yet. Tap “Save” on any question.</div>'}`)}
function settings(){shell('settings',`<h1>Settings</h1><div class="card"><p>Signed in as ${esc(sess.phone)}</p><label>Daily goal<br><select id="g">${[5,10,20,30,50].map(n=>`<option ${S.settings.goal===n?'selected':''}>${n}</option>`).join('')}</select></label></p>
 <p class="row"><button id="ex">Export my data</button><label class="sans">Import backup <input type="file" id="im" accept="application/json"></label><button id="lo">Log out</button></p></div>`);
 $('#g').onchange=e=>{S.settings.goal=+e.target.value;save();sync()};
 $('#ex').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(backup(S),null,1)],{type:'application/json'}));a.download='ml-practice-backup.json';a.click()};
 $('#im').onchange=async e=>{try{const o=JSON.parse(await e.target.files[0].text());if(!validBackup(o))throw 0;S={...S,progress:o.progress,bm:o.bm,notes:o.notes,settings:o.settings};save();toast('Backup restored');sync()}catch{toast('That file is not a valid backup.')}};
 $('#lo').onclick=()=>{localStorage.removeItem('aj_session');sess=null;location.hash='#login'}}
async function route(){const r=(location.hash||'#home').slice(1);if(sess&&sess.exp<Date.now()){sess=null;localStorage.removeItem('aj_session')}
 if(!sess)return authView(r==='register'?'reg':r==='forgot'?'forgot':'login');if(!Q.length)await loadQ();
 ({home,practice,progress,saved,settings}[r]||home)()}
addEventListener('hashchange',route);route();
if('serviceWorker'in navigator)navigator.serviceWorker.register('service-worker.js');
