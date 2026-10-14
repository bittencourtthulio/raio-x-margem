import { AUTH_COOKIE, serializeCookie, verifyCsrf } from '@/lib/auth/server';
import { errorResponse, json } from '@/lib/server';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try { verifyCsrf(request); return json({ ok: true }, 200, { 'Set-Cookie': serializeCookie(AUTH_COOKIE, '', 0, request) }); }
  catch (error) { return errorResponse(error); }
}
