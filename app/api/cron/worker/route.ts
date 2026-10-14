import { cronAuthorized } from '@/lib/cron';
import { runWorkerOnce } from '@/lib/integration/worker';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return Response.json({error:'Unauthorized'}, {status:401});
  const start = Date.now();
  let processed = 0;
  while (Date.now() - start < 40_000 && processed < 25 && await runWorkerOnce()) processed++;
  return Response.json({processed});
}
