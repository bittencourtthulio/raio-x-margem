import 'server-only';
import { cookies } from 'next/headers';
import { adminAuth, AUTH_COOKIE, cookieValue, verifyCsrf } from '../auth/server';
import { IntegrationError } from './errors';
import { assertTransport } from './http';

// Membership is bound to the provider's verified subject, never email or editable claims.
async function verifiedActor(token: string) {
  if (!token) throw new IntegrationError(401, 'authentication_required', 'Entre na sua conta para continuar.');
  try {
    const decoded = await adminAuth().verifySessionCookie(token, true);
    if (!decoded.email_verified) throw new IntegrationError(403, 'email_unverified', 'Confirme seu email para continuar.');
    return { id: `${process.env.FIREBASE_PROJECT_ID}:${decoded.uid}` };
  } catch (error) {
    if (error instanceof IntegrationError) throw error;
    if (error && typeof error === 'object' && 'status' in error && error.status === 503) throw new IntegrationError(503, 'authentication_unavailable', 'Autenticação temporariamente indisponível.');
    throw new IntegrationError(401, 'authentication_required', 'Entre novamente na sua conta.');
  }
}

export async function integrationActor(request: Request, mutation = false) {
  assertTransport(request);
  if (mutation) {
    try { verifyCsrf(request); }
    catch { throw new IntegrationError(403, 'csrf_failed', 'Recarregue a página e tente novamente.'); }
  }
  return verifiedActor(cookieValue(request, AUTH_COOKIE));
}

export async function currentIntegrationActor() {
  try { return await verifiedActor((await cookies()).get(AUTH_COOKIE)?.value ?? ''); }
  catch (error) { if (error instanceof IntegrationError && error.status < 500) return null; throw error; }
}
