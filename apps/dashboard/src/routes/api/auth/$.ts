import { createFileRoute } from '@tanstack/react-router';

import { proxyAuthRequest } from '@/features/auth/server/proxy-auth.server';

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => proxyAuthRequest(request),
      POST: async ({ request }: { request: Request }) => proxyAuthRequest(request),
      PUT: async ({ request }: { request: Request }) => proxyAuthRequest(request),
      PATCH: async ({ request }: { request: Request }) => proxyAuthRequest(request),
      DELETE: async ({ request }: { request: Request }) => proxyAuthRequest(request)
    }
  }
});
