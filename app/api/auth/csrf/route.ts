import { csrfToken, CSRF_COOKIE, serializeCookie } from '@/lib/auth/server';
import { json } from '@/lib/server';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const token = csrfToken();
  return json({ token }, 200, { 'Set-Cookie': serializeCookie(CSRF_COOKIE, token, 3600, request) });
}
