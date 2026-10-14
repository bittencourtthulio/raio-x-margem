import { cronAuthorized } from '@/lib/cron';
import { getRepository } from '@/lib/repositories';
import { runRetentionCleanup } from '@/lib/integration/worker';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return Response.json({error:'Unauthorized'}, {status:401});
  return Response.json({accounts:await getRepository().cleanup(), integration:await runRetentionCleanup()});
}
