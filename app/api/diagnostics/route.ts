import { diagnosticSchema } from '../../../lib/validation';
import { requireAccount } from '@/lib/auth/server';
import { generateDiagnostic } from '../../../lib/ai';
import { errorResponse, getRepository, ipSubject, json, quota, readJson, requireSession, sameOrigin, configuredLimit } from '../../../lib/server';
export const runtime='nodejs';
export async function POST(request:Request) {
  try {
    sameOrigin(request); const account=await requireAccount(request); const session=requireSession(request), repository=getRepository();
    await repository.reserve([quota(session,'diagnostic_attempt',30),quota(ipSubject(request),'diagnostic_attempt_ip',100)]);
    const parsed=diagnosticSchema.safeParse(await readJson(request));
    if(!parsed.success) return json({error:'Confira o contato, as autorizações e os indicadores enviados.',code:'VALIDATION'},400);
    const input=parsed.data;
    // Validate operational mode before claiming a lead or reserving generation quota.
    if(process.env.AI_MODE==='real'&&!process.env.AI_GATEWAY_API_KEY) return json({error:'Configure AI_GATEWAY_API_KEY para operar em modo real.',code:'CONFIGURATION'},503);
    if(process.env.AI_MODE&&!['mock','real'].includes(process.env.AI_MODE)) return json({error:'AI_MODE deve ser real ou mock.',code:'CONFIGURATION'},503);
    const claim=await repository.claim(session,input,[quota(`account:${account.id}`,'generation_account',configuredLimit('QUOTA_SESSION_HOUR',5)),quota(session,'generation_session',configuredLimit('QUOTA_SESSION_HOUR',5)),quota(ipSubject(request),'generation_ip',configuredLimit('QUOTA_IP_HOUR',10)),quota('global','generation_day',configuredLimit('QUOTA_GLOBAL_DAY',100),86400000)]);
    if(claim.replay) return json(claim.replay);
    const result=await generateDiagnostic(input,claim.id);
    await repository.finish(session,input.idempotencyKey,result,input.lead.saveSummaryConsent,input.demo);
    return json(result);
  }catch(error){return errorResponse(error);}
}
