import { createHash } from 'node:crypto';
export function artifactResponse(request: Request, text: string, contentType: string) {
  const etag = `"${createHash('sha256').update(text).digest('hex')}"`;
  const headers = { 'Content-Type': `${contentType}; charset=utf-8`, ETag: etag, 'Cache-Control': 'public, max-age=0, must-revalidate', 'Access-Control-Allow-Origin': '*', 'X-Content-Type-Options': 'nosniff' };
  return new Response(request.headers.get('if-none-match') === etag ? null : text, { status: request.headers.get('if-none-match') === etag ? 304 : 200, headers });
}
