import { z } from 'zod';
import { adminAuth, AUTH_COOKIE, SESSION_SECONDS, serializeCookie, verifyCsrf } from '@/lib/auth/server';
import { upsertAccount } from '@/lib/auth/account-store';
import { errorResponse, getRepository, ipSubject, json, quota, readJson } from '@/lib/server';
import { AppError } from '@/lib/repositories';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    verifyCsrf(request);
    await getRepository().reserve([quota(ipSubject(request), 'auth_attempt', 30)]);
    const parsed = z.object({ idToken: z.string().min(1).max(12000) }).strict().safeParse(await readJson(request, 16384));
    if (!parsed.success) throw new AppError(400, 'INVALID_REQUEST', 'Informe uma credencial de acesso válida.');
    const { idToken } = parsed.data;
    let decoded;
    const auth = adminAuth();
    try { decoded = await auth.verifyIdToken(idToken, true); } catch { throw new AppError(401, 'INVALID_TOKEN', 'Não foi possível validar seu acesso. Entre novamente.'); }
    if (!decoded.email || !decoded.email_verified) throw new AppError(403, 'EMAIL_UNVERIFIED', 'Confirme seu email antes de acessar.');
    if (Math.abs(Date.now() / 1000 - decoded.auth_time) > 300) throw new AppError(401, 'RECENT_LOGIN_REQUIRED', 'Entre novamente para iniciar uma sessão segura.');
    const cookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_SECONDS * 1000 });
    const account = await upsertAccount(process.env.FIREBASE_PROJECT_ID!, decoded.uid, decoded.name ?? '', decoded.email);
    return json({ profileComplete: Boolean(account.profile) }, 200, { 'Set-Cookie': serializeCookie(AUTH_COOKIE, cookie, SESSION_SECONDS, request) });
  } catch (error) { return errorResponse(error); }
}
