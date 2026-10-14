import { isIP } from 'node:net';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { AppError, getRepository, type Limit } from './repositories';
export const SESSION_COOKIE = 'margin_session';
let localSecrets: {session:string;rate:string}|undefined;
function secret(type:'session'|'rate') {
  const configured=process.env[type==='session'?'SESSION_SECRET':'RATE_LIMIT_SECRET'];
  if(configured && configured.length>=32) return configured;
  if(configured || process.env.VERCEL) throw new AppError(503,'CONFIGURATION','Configure segredos server com pelo menos 32 caracteres antes de operar em produção.');
  if(!localSecrets) {
    mkdirSync('.data',{recursive:true,mode:0o700});
    try {localSecrets=JSON.parse(readFileSync('.data/local-secrets.json','utf8'));}
    catch(error) {
      if((error as NodeJS.ErrnoException).code!=='ENOENT') throw error;
      const generated={session:randomBytes(32).toString('hex'),rate:randomBytes(32).toString('hex')};
      try {writeFileSync('.data/local-secrets.json',JSON.stringify(generated),{mode:0o600,flag:'wx'});localSecrets=generated;}
      catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST') throw error;localSecrets=JSON.parse(readFileSync('.data/local-secrets.json','utf8'));}
    }
  }
  return localSecrets![type];
}
export const hashSubject=(value:string)=>createHmac('sha256',secret('rate')).update(value).digest('hex');
export function sameOrigin(request:Request) {
  const origin=request.headers.get('origin');
  const reconstructed=new URL(request.url);
  let expectedOrigin=reconstructed.origin;
  // Next's local server can reconstruct localhost when reached as 127.0.0.1.
  // Trust Host only for equivalent loopback names on the same protocol and port.
  const host=request.headers.get('host');
  const loopback=(hostname:string)=>['localhost','127.0.0.1','[::1]'].includes(hostname);
  if(host && !process.env.VERCEL && loopback(reconstructed.hostname)) {
    try {
      const actual=new URL(`${reconstructed.protocol}//${host}`);
      if(loopback(actual.hostname) && actual.port===reconstructed.port && actual.username==='' && actual.password==='' && actual.pathname==='/' && !actual.search && !actual.hash) expectedOrigin=actual.origin;
    }catch { /* Invalid Host never expands accepted origins. */ }
  }
  if(!origin || origin!==expectedOrigin) throw new AppError(403,'ORIGIN','Origem da solicitação não permitida.');
  const site=request.headers.get('sec-fetch-site');
  if(site && site!=='same-origin' && site!=='none') throw new AppError(403,'ORIGIN','Origem da solicitação não permitida.');
}
export function makeSession(now=Date.now()) {
  const payload=`${randomBytes(32).toString('hex')}.${now+86400000}`;
  return `${payload}.${createHmac('sha256',secret('session')).update(payload).digest('hex')}`;
}
export function sessionFrom(request:Request,now=Date.now()):string|null {
  const value=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);
  if(!value) return null;
  const parts=value.split('.');
  if(parts.length!==3 || !/^[a-f0-9]{64}$/.test(parts[0]) || !/^\d{13}$/.test(parts[1]) || !/^[a-f0-9]{64}$/.test(parts[2])) return null;
  const expiry=Number(parts[1]);
  if(expiry<=now || expiry>now+86400000) return null;
  const expected=createHmac('sha256',secret('session')).update(`${parts[0]}.${parts[1]}`).digest('hex');
  if(!timingSafeEqual(Buffer.from(parts[2],'hex'),Buffer.from(expected,'hex'))) return null;
  return hashSubject(`session:${parts[0]}`);
}
export function requireSession(request:Request) {const s=sessionFrom(request);if(!s) throw new AppError(401,'SESSION','Sua sessão expirou. Reabra o diagnóstico para continuar.');return s;}
// Vercel overwrites this platform header; never trust client proxy headers locally.
export function ipSubject(request?: Request) {
  const ip = process.env.VERCEL ? request?.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() : undefined;
  return hashSubject(ip && isIP(ip) ? `ip:${ip}` : 'ip:local-pilot');
}
export function quota(subject:string,kind:string,max:number,windowMs=3600000):Limit{return {subject,kind,max,windowMs};}
export function configuredLimit(name:string,fallback:number){ const v=Number(process.env[name]??fallback);if(!Number.isInteger(v)||v<1||v>100000) throw new AppError(503,'CONFIGURATION','Quota configurada incorretamente.');return v; }
export async function readJson(request:Request,limit=32768):Promise<unknown> {
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new AppError(415,'CONTENT_TYPE','Envie uma solicitação JSON.');
  const length=request.headers.get('content-length');
  if(length && Number(length)>limit) throw new AppError(413,'BODY_LIMIT','Pedido excede o limite permitido.');
  if(!request.body) throw new AppError(400,'BODY','Pedido vazio.');
  const reader=request.body.getReader(), chunks:Uint8Array[]=[]; let total=0;
  try {
    for(;;){const {done,value}=await reader.read();if(done) break;total+=value.byteLength;if(total>limit){await reader.cancel();throw new AppError(413,'BODY_LIMIT','Pedido excede o limite permitido.');}chunks.push(value);}
    const bytes=Buffer.concat(chunks);
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  }catch(error){if(error instanceof AppError) throw error;throw new AppError(400,'BODY','JSON inválido.');}
}
export function json(body:unknown,status=200,headers:Record<string,string>={}) {return Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});}
export function errorResponse(error:unknown) { if(error instanceof AppError) return json({error:error.message,code:error.code},error.status,error.status===429?{'Retry-After':'3600'}:{});return json({error:'Não foi possível concluir. Sua análise continua disponível; tente novamente.',code:'UNAVAILABLE'},503); }
export {getRepository};
