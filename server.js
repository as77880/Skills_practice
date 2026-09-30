import dotenv from 'dotenv';import express from 'express';import mysql from 'mysql2/promise';import bcrypt from 'bcryptjs';import jwt from 'jsonwebtoken';
import helmet from 'helmet';import rateLimit from 'express-rate-limit';import path from 'path';import {fileURLToPath,pathToFileURL} from 'url';
import {validPhone,validPass,validDob} from './js/srs.js';

export const loadRuntimeConfig=()=>({
  JWT_SECRET: process.env.JWT_SECRET,
  MYSQL_URL: process.env.MYSQL_URL || process.env.DATABASE_URL,
  PORT: Number(process.env.PORT || 3000)
});

dotenv.config();
const root=path.dirname(fileURLToPath(import.meta.url));

export async function startServer(){
  const {JWT_SECRET,PORT=3000}=loadRuntimeConfig(),DB_URL=process.env.MYSQL_URL||process.env.DATABASE_URL;
  if(!JWT_SECRET||!DB_URL){console.error('Set JWT_SECRET and MYSQL_URL');process.exit(1)}
  const db=mysql.createPool({uri:DB_URL,connectionLimit:5});
  for(const q of [
`CREATE TABLE IF NOT EXISTS users(id INT AUTO_INCREMENT PRIMARY KEY,phone VARCHAR(10) NOT NULL UNIQUE,dob_hash VARCHAR(100) NOT NULL,password_hash VARCHAR(100) NOT NULL,daily_goal INT NOT NULL DEFAULT 10,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS question_progress(user_id INT NOT NULL,question_id VARCHAR(64) NOT NULL,rating TINYINT NOT NULL,attempt_count INT NOT NULL,last_attempt_at BIGINT NOT NULL,next_review_at BIGINT NOT NULL,PRIMARY KEY(user_id,question_id),FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`,
`CREATE TABLE IF NOT EXISTS bookmarks(user_id INT NOT NULL,question_id VARCHAR(64) NOT NULL,PRIMARY KEY(user_id,question_id),FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`,
`CREATE TABLE IF NOT EXISTS notes(user_id INT NOT NULL,question_id VARCHAR(64) NOT NULL,note VARCHAR(500) NOT NULL,PRIMARY KEY(user_id,question_id),FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`
  ])await db.query(q); // NOTE: no column anywhere stores the user's answer text
  const app=express();app.set('trust proxy',1);
  app.use(helmet({contentSecurityPolicy:{useDefaults:true,directives:{'style-src':["'self'","'unsafe-inline'"],'img-src':["'self'","data:"],'upgrade-insecure-requests':null}}}));
  app.use(express.json({limit:'256kb'}));
  const lim=(m,n)=>rateLimit({windowMs:m*6e4,limit:n,standardHeaders:true,legacyHeaders:false,message:{error:'Too many attempts. Try again later.'}});
  app.use('/api',lim(1,120));
  const tok=id=>jwt.sign({uid:id},JWT_SECRET,{expiresIn:'7d'}),EXP=7*864e2;
  const ok=(res,id)=>res.json({uid:id,token:tok(id),expires_in:EXP});
  const need=(req,res,next)=>{try{req.uid=jwt.verify((req.headers.authorization||'').slice(7),JWT_SECRET).uid;next()}catch{res.status(401).json({error:'Session expired. Log in again.'})}};
  const A=lim(15,10);
  app.post('/api/register',A,async(req,res)=>{const{phone,dob,password}=req.body||{};
   if(!validPhone(phone)||!validDob(dob)||!validPass(password))return res.status(400).json({error:'Check your phone number, date of birth and password.'});
   try{const[r]=await db.query('INSERT INTO users(phone,dob_hash,password_hash) VALUES(?,?,?)',[phone,await bcrypt.hash(dob,10),await bcrypt.hash(password,12)]);ok(res,r.insertId)}
   catch(e){res.status(e.code==='ER_DUP_ENTRY'?409:500).json({error:e.code==='ER_DUP_ENTRY'?'This phone number is already registered.':'Server error. Try again.'})}});
  app.post('/api/login',A,async(req,res)=>{const{phone,password}=req.body||{};
   try{const[[u]]=await db.query('SELECT id,password_hash FROM users WHERE phone=?',[String(phone)]);
    if(!u||!await bcrypt.compare(String(password),u.password_hash))return res.status(401).json({error:'Wrong phone number or password.'});ok(res,u.id)}
   catch{res.status(500).json({error:'Server error. Try again.'})}});
  app.post('/api/forgot',A,async(req,res)=>{const{phone,dob,password}=req.body||{},bad=()=>res.status(400).json({error:'Details did not match.'});
   if(!validPhone(phone)||!validDob(dob)||!validPass(password))return res.status(400).json({error:'Check your details. Password needs 8+ characters with letters and numbers.'});
   try{const[[u]]=await db.query('SELECT id,dob_hash FROM users WHERE phone=?',[phone]);if(!u||!await bcrypt.compare(dob,u.dob_hash))return bad();
    await db.query('UPDATE users SET password_hash=? WHERE id=?',[await bcrypt.hash(password,12),u.id]);res.json({ok:true})}
   catch{res.status(500).json({error:'Server error. Try again.'})}});
  // Only whitelisted fields are read here, so answer text can never be stored even if a client sends it.
  app.post('/api/sync',need,async(req,res)=>{const u=req.uid,b=req.body||{},id=s=>typeof s==='string'&&s.length>0&&s.length<=64,arr=x=>Array.isArray(x)?x.slice(0,5000):[];
   const c=await db.getConnection();
   try{await c.beginTransaction();
    for(const p of arr(b.progress)){if(!id(p.id)||!(p.r>=1&&p.r<=5))continue;
     await c.query(`INSERT INTO question_progress(user_id,question_id,rating,attempt_count,next_review_at,last_attempt_at) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE rating=IF(VALUES(last_attempt_at)>last_attempt_at,VALUES(rating),rating),attempt_count=GREATEST(attempt_count,VALUES(attempt_count)),next_review_at=IF(VALUES(last_attempt_at)>last_attempt_at,VALUES(next_review_at),next_review_at),last_attempt_at=GREATEST(last_attempt_at,VALUES(last_attempt_at))`,[u,p.id,p.r|0,Math.max(1,p.n|0),Math.floor(+p.next)||0,Math.floor(+p.last)||0])}
    const d=b.del||{},db_=arr(d.bm).filter(id),dn=arr(d.notes).filter(id);
    if(db_.length)await c.query('DELETE FROM bookmarks WHERE user_id=? AND question_id IN (?)',[u,db_]);
    if(dn.length)await c.query('DELETE FROM notes WHERE user_id=? AND question_id IN (?)',[u,dn]);
    for(const q of arr(b.bm).filter(id))await c.query('INSERT IGNORE INTO bookmarks(user_id,question_id) VALUES(?,?)',[u,q]);
    for(const[q,n]of Object.entries(b.notes&&typeof b.notes==='object'?b.notes:{}).slice(0,5000))if(id(q)&&typeof n==='string'&&n.trim())await c.query('INSERT INTO notes(user_id,question_id,note) VALUES(?,?,?) ON DUPLICATE KEY UPDATE note=VALUES(note)',[u,q,n.slice(0,500)]);
    if([5,10,20,30,50].includes(b.goal))await c.query('UPDATE users SET daily_goal=? WHERE id=?',[b.goal,u]);
    await c.commit();
    const[pr]=await c.query('SELECT question_id id,rating r,attempt_count n,last_attempt_at last,next_review_at next FROM question_progress WHERE user_id=?',[u]);
    const[bm]=await c.query('SELECT question_id FROM bookmarks WHERE user_id=?',[u]),[nt]=await c.query('SELECT question_id,note FROM notes WHERE user_id=?',[u]),[[g]]=await c.query('SELECT daily_goal FROM users WHERE id=?',[u]);
    res.json({progress:pr.map(x=>({id:x.id,r:x.r,n:x.n,last:+x.last,next:+x.next})),bm:bm.map(x=>x.question_id),notes:Object.fromEntries(nt.map(x=>[x.question_id,x.note])),goal:g.daily_goal})}
   catch{await c.rollback();res.status(500).json({error:'Sync failed.'})}finally{c.release()}});
  // Static files: whitelist only (never expose server.js / .env)
  for(const d of['css','js','assets','questions'])app.use('/'+d,express.static(path.join(root,d)));
  for(const f of['manifest.json','service-worker.js'])app.get('/'+f,(_,r)=>r.sendFile(path.join(root,f)));
  app.get('/health',(_,r)=>r.send('ok'));app.get('/',(_,r)=>r.sendFile(path.join(root,'index.html')));
  return app.listen(PORT,()=>console.log('Listening on '+PORT));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){startServer().catch(err=>{console.error(err);process.exit(1);});}
