/**
 * Reverse-proxy /api/auth/* → Cloud AI host (or local API when unset).
 * Browser talks only to the dashboard; auth + DB live on that API.
 */
import { getCloudAiUrl } from '@/shared/api/client.server';

function dashboardPublicOrigin(): string {
  return (
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.IJNUT_PUBLIC_DASHBOARD_URL?.trim() ||
    'http://127.0.0.1:3001'
  ).replace(/\/$/, '');
}

export async function proxyAuthRequest(request: Request): Promise<Response> {
  const incoming = new URL(request.url);
  const target = `${getCloudAiUrl()}${incoming.pathname}${incoming.search}`;
  const publicOrigin = dashboardPublicOrigin();
  const publicUrl = new URL(publicOrigin);

  const headers = new Headers();
  const cookie = request.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const authorization = request.headers.get('authorization');
  if (authorization) headers.set('authorization', authorization);

  // better-auth builds request URL from Host / X-Forwarded-* — must look like the dashboard.
  headers.set('host', publicUrl.host);
  headers.set('x-forwarded-host', publicUrl.host);
  headers.set('x-forwarded-proto', publicUrl.protocol.replace(':', ''));
  headers.set('origin', request.headers.get('origin') ?? publicOrigin);
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

  const outHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === 'transfer-encoding') return;
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
