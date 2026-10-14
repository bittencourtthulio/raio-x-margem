import 'server-only';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { cookies } from 'next/headers';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { AppError } from '../repositories';
import { sameOrigin } from '../server';
import { findAccount, type Account } from './account-store';

export const AUTH_COOKIE = process.env.VERCEL ? '__Host-rxm_auth' : 'rxm_auth';
export const CSRF_COOKIE = 'rxm_csrf';
export const SESSION_SECONDS = 5 * 24 * 60 * 60;
export function adminAuth() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new AppError(503, 'AUTH_CONFIGURATION', 'O acesso por conta ainda está sendo configurado. Tente novamente em instantes.');
  let app = getApps().find(app => app.name === 'raiox-auth');
  if (!app) {
    const credential = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) : applicationDefault();
    app = initializeApp({ projectId, credential }, 'raiox-auth');
  }
  return getAuth(app);
}
export function cookieValue(request: Request, name: string) { return request.headers.get('cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(name + '='))?.slice(name.length + 1) ?? ''; }
export function csrfToken() { return randomBytes(32).toString('hex'); }
export function verifyCsrf(request: Request) {
  sameOrigin(request);
  const cookie = cookieValue(request, CSRF_COOKIE), header = request.headers.get('x-csrf-token') ?? '';
  if (!/^[a-f0-9]{64}$/.test(cookie) || !/^[a-f0-9]{64}$/.test(header) || !timingSafeEqual(Buffer.from(cookie), Buffer.from(header))) throw new AppError(403, 'CSRF', 'Recarregue a página e tente novamente.');
}
export function serializeCookie(name: string, value: string, maxAge: number, request: Request) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
async function verifyAccount(token: string): Promise<Account | null> {
  if (!token) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(token, true);
    if (!decoded.email_verified) return null;
    const account = await findAccount(process.env.FIREBASE_PROJECT_ID!, decoded.uid);
    return account?.status === 'active' ? account : null;
  } catch { return null; }
}
export async function currentAccount() { return verifyAccount((await cookies()).get(AUTH_COOKIE)?.value ?? ''); }
export async function requireAccount(request: Request, complete = true) {
  const account = await verifyAccount(cookieValue(request, AUTH_COOKIE));
  if (!account) throw new AppError(401, 'AUTH_REQUIRED', 'Entre na sua conta para continuar.');
  if (complete && !account.profile) throw new AppError(403, 'PROFILE_REQUIRED', 'Complete o cadastro do seu negócio para continuar.');
  return account;
}
export function safeDestination(value: unknown) { return value === 'demo' ? '/app?modo=demo' : '/app'; }
