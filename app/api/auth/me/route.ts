import { requireAccount } from '@/lib/auth/server';
import { errorResponse, json } from '@/lib/server';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try { const account = await requireAccount(request, false); return json({ name: account.name, email: account.email, profileComplete: Boolean(account.profile) }); }
  catch (error) { return errorResponse(error); }
}
