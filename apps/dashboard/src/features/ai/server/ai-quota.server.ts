/**
 * AI quota is authorized on demo-api. Dashboard helpers re-export session access.
 */
export {
  getSession,
  resolveAiAccess,
  type AiAccess
} from '@/features/auth/server/session.server';
