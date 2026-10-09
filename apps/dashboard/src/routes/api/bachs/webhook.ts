import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/bachs/webhook')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { handleBachsEvent, verifyBachsSignature } = await import(
          '@/features/billing/server/bachs.server'
        );

        if (
          !process.env.BACHS_WEBHOOK_SECRET?.trim() &&
          !process.env.BACHS_SECRET_KEY?.trim() &&
          !process.env.BACHS_API_KEY?.trim()
        ) {
          return new Response('Bachs secrets missing', { status: 500 });
        }

        const rawBody = await request.text();
        const ok = verifyBachsSignature({
          rawBody,
          signatureHeader: request.headers.get('x-bachs-signature'),
          signatureV2Header: request.headers.get('x-bachs-signature-v2'),
          timestampHeader: request.headers.get('x-bachs-timestamp')
        });

        if (!ok) {
          console.error('[bachs] webhook signature mismatch');
          return new Response('Invalid signature', { status: 400 });
        }

        let event: { id?: string; type: string; data?: Record<string, unknown> };
        try {
          event = JSON.parse(rawBody) as typeof event;
        } catch {
          return new Response('Invalid JSON', { status: 400 });
        }

        try {
          await handleBachsEvent(event);
        } catch (err) {
          console.error('[bachs] webhook handler failed', err);
          return new Response('Webhook handler failed', { status: 500 });
        }

        return Response.json({ received: true });
      }
    }
  }
});
