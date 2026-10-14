import { errorResponse, getRepository, ipSubject, json, makeSession, quota, readJson, sameOrigin, SESSION_COOKIE, sessionFrom } from '../../../lib/server';
export const runtime='nodejs';
export async function POST(request:Request) {
  try {
    sameOrigin(request); await readJson(request,1024);
    const repository=getRepository();
    await repository.reserve([quota(ipSubject(request),'session_attempt',60),quota('global','session_day',1000,86400000)]);
    if(sessionFrom(request)) return json({ok:true});
    const token=makeSession();
    return json({ok:true},200,{'Set-Cookie':`${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${new URL(request.url).protocol==='https:'?'; Secure':''}`});
  }catch(error){return errorResponse(error);}
}
