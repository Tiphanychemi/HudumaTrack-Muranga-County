require('dotenv').config();
const bcrypt=require('bcryptjs');const pool=require('./db');
(async()=>{
 const email=process.env.ADMIN_EMAIL?.trim().toLowerCase(),password=process.env.ADMIN_PASSWORD;
 if(!email||!password||password.length<12)throw Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) in .env');
 const hash=await bcrypt.hash(password,12);
 await pool.query(`INSERT INTO users(full_name,email,password_hash,role) VALUES($1,$2,$3,'admin')
 ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,role='admin'`,['System Administrator',email,hash]);
 console.log('Admin account created:',email);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>pool.end());
