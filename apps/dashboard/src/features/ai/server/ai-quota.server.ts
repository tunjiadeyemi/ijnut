/**
 * AI quota is authorized only via session.server (DB-backed).
 * This module re-exports the access helpers used by AI server fns.
 */
export {
  consumeAiMessage,
  getSession,
  resolveAiAccess,
  type AiAccess
} from '@/features/auth/server/session.server';
