import { eventSchema } from '../../../lib/validation';
import { errorResponse, getRepository, ipSubject, json, quota, readJson, requireSession, sameOrigin } from '../../../lib/server';
export const runtime='nodejs';
export async function POST(request:Request) {
  try {
    sameOrigin(request);const session=requireSession(request);
    const parsed=eventSchema.safeParse(await readJson(request,1024));
    if(!parsed.success) return json({error:'Evento inválido.',code:'VALIDATION'},400);
    // Acquisition generation events are server-owned; a browser cannot claim them.
    if(['lead_submitted','insights_generated'].includes(parsed.data.event)) return json({error:'Evento reservado ao servidor.',code:'VALIDATION'},400);
    await getRepository().event(session,parsed.data.event,parsed.data.demo,[quota(session,'events',120),quota(ipSubject(request),'events_ip',500),quota('global','events_day',10000,86400000)]);
    return json({ok:true});
  }catch(error){return errorResponse(error);}
}
