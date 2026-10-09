/**
 * Reverse-proxy /api/auth/* → demo-api.
 * Browser talks only to the dashboard; auth + DB live on the API.
 */
import { getApiUrl } from '@/shared/api/client.server';

export async function proxyAuthRequest(request: Request): Promise<Response> {
  const incoming = new URL(request.url);
  const target = `${getApiUrl()}${incoming.pathname}${incoming.search}`;

  const headers = new Headers();
  const cookie = request.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const authorization = request.headers.get('authorization');
  if (authorization) headers.set('authorization', authorization);
  // better-auth CSRF / origin checks — keep the dashboard origin the browser used.
  const origin = request.headers.get('origin');
  if (origin) headers.set('origin', origin);
  const referer = request.headers.get('referer');
  if (referer) headers.set('referer', referer);
  headers.set('accept', request.headers.get('accept') ?? 'application/json');
  headers.set('user-agent', request.headers.get('user-agent') ?? 'ijnut-dashboard-bff');

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual'
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(target, init);

  // Pass through status, body, and Set-Cookie / Location for OAuth.
  const outHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === 'transfer-encoding') return;
    // Multiple Set-Cookie headers must not be collapsed incorrectly.
    if (lower === 'set-cookie') return;
    outHeaders.set(key, value);
  });

  const getSetCookie = (
    upstream.headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie?.();
  if (getSetCookie?.length) {
    for (const c of getSetCookie) {
      outHeaders.append('set-cookie', c);
    }
  } else {
    const single = upstream.headers.get('set-cookie');
    if (single) outHeaders.append('set-cookie', single);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders
  });
}
