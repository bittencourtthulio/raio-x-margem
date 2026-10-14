import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { LocalRepository, AppError, getRepository } from '../lib/repositories';
import { diagnosticSchema } from '../lib/validation';
import { generateDiagnostic } from '../lib/ai';
import { makeSession, sessionFrom, readJson, sameOrigin } from '../lib/server';
import type { DiagnosticRequest, DiagnosticResult } from '../lib/contracts';
const input=(save=false):DiagnosticRequest=>({idempotencyKey:randomUUID(),demo:false,honeypot:'',lead:{name:'Pessoa',businessName:'Loja',contact:'person@example.com',sector:'retail',role:'owner',currentControl:'spreadsheet',systemDifficulty:false,commercialConsent:false,saveSummaryConsent:save,privacyAcknowledged:true},scenario:{discountBps:0,targetBps:2000,feeBps:0,feeEnabled:false},summary:{validCount:2,invalidCount:0,warningCount:0,negativeCount:1,belowTargetCount:1,excludedCount:0,bands:[1,0,0,1]}});
const result=(id:string):DiagnosticResult=>({id,source:'mock',findings:['Resumo'],actions:['Confira custos'],limitations:['Não equivale a lucro líquido']});
test('no-summary consent stores contact and authorization, no aggregates/output; repeat cannot create lead',()=>{
 const db=new LocalRepository(':memory:'),body=input();const claimed=db.claim('session',body,[]);db.finish('session',body.idempotencyKey,result(claimed.id),false,false);
 const d=db.db.prepare('SELECT * FROM diagnostics').get() as Record<string,unknown>;
 assert.equal(d.summary_json,null);assert.equal(d.response_json,null);
 const r=db.db.prepare('SELECT * FROM diagnostic_requests').get() as Record<string,unknown>;assert.equal(r.response_json,null);
 const l=db.db.prepare('SELECT * FROM leads').get() as Record<string,unknown>;assert.equal(l.commercial_consent,0);assert.equal(l.qualified,1);assert.equal(l.commercial_eligible,0);assert.match(String(l.consent_text),/software/);assert.ok(l.consent_at);
 assert.throws(()=>db.claim('session',body,[]),(e:unknown)=>e instanceof AppError&&e.code==='COMPLETED_NO_REPLAY');assert.equal((db.db.prepare('SELECT count(*) n FROM leads').get() as {n:number}).n,1);
 assert.equal((db.db.prepare('SELECT count(*) n FROM events WHERE demo=0').get() as {n:number}).n,0);db.db.close();
});
test('claim is atomic, duplicates pending and changed bodies conflict; consent allows replay after reopen',()=>{
 const dir=mkdtempSync(join(tmpdir(),'margin-'));try {const path=join(dir,'pilot.db');let db=new LocalRepository(path);const body=input(true),c=db.claim('s',body,[]);
 assert.throws(()=>db.claim('s',body,[]),(e:unknown)=>e instanceof AppError&&e.code==='PROCESSING');assert.throws(()=>db.claim('s',{...body,demo:true},[]),(e:unknown)=>e instanceof AppError&&e.code==='IDEMPOTENCY_CONFLICT');db.finish('s',body.idempotencyKey,result(c.id),true,false);db.db.close();db=new LocalRepository(path);assert.deepEqual(db.claim('s',body,[]).replay,result(c.id));assert.ok((db.db.prepare('SELECT summary_json FROM diagnostics').get() as {summary_json:string}).summary_json);db.db.close();}finally{rmSync(dir,{recursive:true,force:true});}
});
test('multiple quota reservations rollback together, rejected claim adds no lead',()=>{
 const db=new LocalRepository(':memory:');const limits=[{subject:'session',kind:'hour',max:5,windowMs:1000},{subject:'global',kind:'day',max:1,windowMs:10000}];db.reserve(limits,100);
 assert.throws(()=>db.claim('s',input(),limits,101),(e:unknown)=>e instanceof AppError&&e.status===429);
 assert.equal((db.db.prepare("SELECT count FROM request_limits WHERE subject='session'").get() as {count:number}).count,1);assert.equal((db.db.prepare('SELECT count(*) n FROM leads').get() as {n:number}).n,0);db.db.close();
});
test('quota persists across connections and windows expire',()=>{
 const dir=mkdtempSync(join(tmpdir(),'margin-quota-'));try{const path=join(dir,'db');const a=new LocalRepository(path),b=new LocalRepository(path),limits=[{subject:'a',kind:'h',max:1,windowMs:1000}];a.reserve(limits,100);assert.throws(()=>b.reserve(limits,100),AppError);b.reserve(limits,1100);a.db.close();b.db.close();}finally{rmSync(dir,{recursive:true,force:true});}
});
test('strict validation rejects catalog extra fields, mixed counts and missing acknowledgement',()=>{
 assert.equal(diagnosticSchema.safeParse(input()).success,true);assert.equal(diagnosticSchema.safeParse({...input(),products:[]}).success,false);
 const body=input();body.summary.bands=[0,0,0,0];assert.equal(diagnosticSchema.safeParse(body).success,false);
 assert.equal(diagnosticSchema.safeParse({...input(),lead:{...input().lead,privacyAcknowledged:false}}).success,false);
});
test('signed sessions expire, tampering and cross-origin requests fail',()=>{
 process.env.SESSION_SECRET='a'.repeat(64);process.env.RATE_LIMIT_SECRET='b'.repeat(64);
 const now=Date.now(),token=makeSession(now),req=(cookie:string)=>new Request('http://localhost/api/events',{headers:{cookie:`margin_session=${cookie}`}});
 assert.ok(sessionFrom(req(token),now));assert.equal(sessionFrom(req(token),now+86400000),null);assert.equal(sessionFrom(req(token.replace(/^./,token[0]==='a'?'b':'a')),now),null);
 assert.throws(()=>sameOrigin(new Request('http://localhost/api/events',{headers:{origin:'https://evil.example'}})),AppError);
});
test('bounded streamed body rejects even without content-length',async()=>{
 const req=new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({large:'a'.repeat(32769)})});await assert.rejects(readJson(req),(e:unknown)=>e instanceof AppError&&e.status===413);
});
test('mock is explicit; gateway gets only aggregates; failure is fallback',async()=>{
 const oldFetch=globalThis.fetch,oldMode=process.env.AI_MODE,oldKey=process.env.AI_GATEWAY_API_KEY;
 try{process.env.AI_MODE='mock';assert.equal((await generateDiagnostic(input(),'id')).source,'mock');process.env.AI_MODE='real';process.env.AI_GATEWAY_API_KEY='test';
 globalThis.fetch=async(_url,init)=>{const data=String(init?.body);assert.ok(!data.includes('person@example.com'));assert.ok(!data.includes('Pessoa'));assert.ok(!data.includes('Loja'));return new Response('{}',{status:500});};assert.equal((await generateDiagnostic(input(),'id')).source,'fallback');
 }finally{globalThis.fetch=oldFetch;if(oldMode===undefined)delete process.env.AI_MODE;else process.env.AI_MODE=oldMode;if(oldKey===undefined)delete process.env.AI_GATEWAY_API_KEY;else process.env.AI_GATEWAY_API_KEY=oldKey;}
});
test('cleanup retention and cascading lead deletion; unsupported deploy fails clearly',()=>{
 const db=new LocalRepository(':memory:'),body=input(true),claimed=db.claim('s',body,[],1);db.finish('s',body.idempotencyKey,result(claimed.id),true,false);const removed=db.cleanup(91*86400000);assert.equal(removed.leads,1);assert.equal((db.db.prepare('SELECT count(*) n FROM diagnostics').get() as {n:number}).n,0);db.db.close();const old=process.env.VERCEL;try{process.env.VERCEL='1';assert.throws(()=>getRepository(),(e:unknown)=>e instanceof AppError&&e.code==='CONFIGURATION');}finally{if(old===undefined)delete process.env.VERCEL;else process.env.VERCEL=old;}
});

test('local Next reconstructed localhost accepts genuine loopback Host with same port and rejects external origin aliases',()=>{
 const req=(origin:string,host:string)=>new Request('http://localhost:3100/api/events',{headers:{origin,host}});
 assert.doesNotThrow(()=>sameOrigin(req('http://127.0.0.1:3100','127.0.0.1:3100')));
 assert.doesNotThrow(()=>sameOrigin(req('http://localhost:3100','localhost:3100')));
 assert.throws(()=>sameOrigin(req('https://127.0.0.1:3100','127.0.0.1:3100')),AppError);
 assert.throws(()=>sameOrigin(req('http://127.0.0.1:3000','127.0.0.1:3000')),AppError);
 assert.throws(()=>sameOrigin(req('http://evil.example:3100','evil.example:3100')),AppError);
 assert.throws(()=>sameOrigin(req('http://127.0.0.1:3100','localhost:3100')),AppError);
 assert.throws(()=>sameOrigin(new Request('http://localhost:3100/api/events',{headers:{origin:'http://evil.example:3100',host:'localhost:3100','x-forwarded-host':'evil.example:3100'}})),AppError);
 assert.throws(()=>sameOrigin(new Request('http://public.example:3100/api/events',{headers:{origin:'http://127.0.0.1:3100',host:'127.0.0.1:3100'}})),AppError);
});
