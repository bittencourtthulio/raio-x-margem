import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';
import { IntegrationError } from './errors';

export function integrationJson(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
}

export function problem(error: unknown, request: Request, requestId: string) {
  const validation = error instanceof ZodError;
  const known = error instanceof IntegrationError;
  const status = validation ? 422 : known ? error.status : 503;
  const code = validation ? 'validation_error' : known ? error.code : 'service_unavailable';
  const detail = validation ? 'Revise os campos indicados e envie uma nova operação.' : known ? error.message : 'Serviço temporariamente indisponível.';
  const errors = validation ? error.issues.map(issue => ({
    ...(typeof issue.path[1] === 'number' ? { index: issue.path[1] } : {}),
    field: issue.path.map(String).join('.'), reason: issue.code,
  })) : known ? error.errors : undefined;
  return integrationJson({
    type: `/docs/api/errors#${code}`, title: code, status, detail,
    instance: new URL(request.url).pathname, code, requestId, ...(errors ? { errors } : {}),
  }, status, {
    'Content-Type': 'application/problem+json', 'X-Request-Id': requestId,
    ...(status === 401 ? { 'WWW-Authenticate': 'Bearer' } : {}),
    ...(known && error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : status === 503 ? { 'Retry-After': '5' } : {}),
  });
}

export async function withIntegrationErrors(request: Request, operation: (requestId: string) => Promise<Response>) {
  const requestId = randomUUID();
  try {
    const response = await operation(requestId);
    response.headers.set('X-Request-Id', requestId);
    return response;
  } catch (error) { return problem(error, request, requestId); }
}

export function assertTransport(request: Request) {
  const url = new URL(request.url);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && !process.env.VERCEL && process.env.INTEGRATION_ENVIRONMENT !== 'production')) {
    throw new IntegrationError(403, 'https_required', 'Use HTTPS para acessar a API.');
  }
  if (url.searchParams.has('api_key') || url.searchParams.has('token') || url.searchParams.has('key')) {
    throw new IntegrationError(400, 'invalid_authentication', 'Envie a credencial somente no cabeçalho Authorization.');
  }
}

export function bearerToken(request: Request) {
  assertTransport(request);
  const match = /^Bearer ([A-Za-z0-9_.-]{20,256})$/i.exec(request.headers.get('authorization') ?? '');
  if (!match) throw new IntegrationError(401, 'invalid_api_key', 'Credencial ausente ou inválida.');
  return match[1];
}

export function idempotencyKey(request: Request) {
  const key = request.headers.get('idempotency-key');
  if (!key || !/^[\x21-\x7E]{1,200}$/.test(key)) throw new IntegrationError(400, 'invalid_idempotency_key', 'Envie Idempotency-Key com 1 a 200 caracteres ASCII sem espaços.');
  return key;
}

export function pagination(request: Request) {
  const params = new URL(request.url).searchParams;
  for (const key of params.keys()) {
    if (!['cursor', 'limit'].includes(key) || params.getAll(key).length !== 1) throw new IntegrationError(400, 'invalid_query', 'Parâmetro de consulta inválido.');
  }
  const raw = params.get('limit');
  const limit = raw === null ? 100 : /^\d{1,3}$/.test(raw) ? Number(raw) : 0;
  if (limit < 1 || limit > 500) throw new IntegrationError(400, 'invalid_query', 'limit deve estar entre 1 e 500.');
  const cursor = params.get('cursor');
  if (cursor !== null && (!cursor || cursor.length > 4096)) throw new IntegrationError(400, 'invalid_cursor', 'Cursor inválido.');
  return { limit, ...(cursor ? { cursor } : {}) };
}

export async function integrationBody(request: Request, maxBytes = 1_048_576): Promise<unknown> {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?\s*$/i.test(request.headers.get('content-type') ?? '')) {
    throw new IntegrationError(415, 'unsupported_media_type', 'Envie JSON UTF-8 com Content-Type application/json.');
  }
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw new IntegrationError(413, 'payload_too_large', 'O corpo ultrapassa o limite permitido.');
  if (!request.body) throw new IntegrationError(400, 'invalid_json', 'Envie um corpo JSON.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new IntegrationError(413, 'payload_too_large', 'O corpo ultrapassa o limite permitido.'); }
      chunks.push(value);
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } catch (error) {
    if (error instanceof IntegrationError) throw error;
    throw new IntegrationError(400, 'invalid_json', 'O corpo deve ser JSON UTF-8 válido.');
  } finally { reader.releaseLock(); }
}
