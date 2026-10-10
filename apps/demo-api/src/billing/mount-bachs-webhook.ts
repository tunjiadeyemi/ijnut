import type { Express, Request, Response } from "express";
import express from "express";
import {
  handleBachsEvent,
  isBachsConfigured,
  verifyBachsSignature,
} from "./bachs.client";

/**
 * Public Bachs webhook (no observability service key). Mounted with raw body for signatures.
 * Prefer pointing Bachs at the API:
 *   https://<demo-api>/api/bachs/webhook
 */
export function mountBachsWebhook(server: Express): void {
  server.post(
    "/api/bachs/webhook",
    express.raw({ type: "*/*" }),
    async (req: Request, res: Response) => {
      try {
        if (!isBachsConfigured() && !process.env.BACHS_WEBHOOK_SECRET?.trim()) {
          res.status(500).send("Bachs secrets missing on API");
          return;
        }

        const rawBody = Buffer.isBuffer(req.body)
          ? req.body.toString("utf8")
          : typeof req.body === "string"
            ? req.body
            : "";

        const ok = verifyBachsSignature({
          rawBody,
          signatureHeader: req.header("x-bachs-signature"),
          signatureV2Header: req.header("x-bachs-signature-v2"),
          timestampHeader: req.header("x-bachs-timestamp"),
        });

        if (!ok) {
          console.error("[bachs] webhook signature mismatch");
          res.status(400).send("Invalid signature");
          return;
        }

        let event: { id?: string; type: string; data?: Record<string, unknown> };
        try {
          event = JSON.parse(rawBody) as typeof event;
        } catch {
          res.status(400).send("Invalid JSON");
          return;
        }

        await handleBachsEvent(event);
        res.status(200).json({ received: true });
      } catch (err) {
        console.error("[bachs] webhook handler failed", err);
        res.status(500).send("Webhook handler failed");
      }
    },
  );
}
