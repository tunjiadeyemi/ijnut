/**
 * Build a paste payload for the user's coding agent from an IJNUT AI reply.
 * Prefers an "## Agent brief" section when present; otherwise the full reply.
 */
export function buildAgentBriefPaste(reply: string): string {
  const trimmed = reply.trim();
  const match = trimmed.match(
    /##\s*Agent brief\s*\n([\s\S]*?)(?=\n##\s+\S|$)/i
  );
  const brief = match?.[1]?.trim() || trimmed;

  return [
    'You are a senior backend engineer. Implement the following from IJNUT observability analysis.',
    'Prefer evidence over guesses. Do not invent metrics or SQL that are not stated.',
    '',
    brief,
    ''
  ].join('\n');
}
