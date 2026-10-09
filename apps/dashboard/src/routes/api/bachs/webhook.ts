import { createFileRoute } from '@tanstack/react-router';

import { getApiUrl } from '@/shared/api/client.server';

/**
 * Optional BFF proxy — prefer pointing Bachs at the API:
 *   https://<demo-api>/api/bachs/webhook
 * This forwards so an old dashboard webhook URL still works.
 */
export const Route = createFileRoute('/api/bachs/webhook')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const rawBody = await request.arrayBuffer();
        const headers = new Headers();
        for (const name of [
          'content-type',
          'x-bachs-signature',
          'x-bachs-signature-v2',
          'x-bachs-timestamp'
        ]) {
          const v = request.headers.get(name);
          if (v) headers.set(name, v);
        }

        const upstream = await fetch(`${getApiUrl()}/api/bachs/webhook`, {
          method: 'POST',
          headers,
          body: rawBody
        });

        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            'content-type':
              upstream.headers.get('content-type') ?? 'application/json'
          }
        });
      }
    }
  }
});
