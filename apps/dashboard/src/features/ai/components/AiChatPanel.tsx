import { useEffect, useRef, useState } from 'react';
import { Bot, Gauge, Loader2, Send, Sparkles, Wrench } from 'lucide-react';

import type { RequestRecord, StressReport } from '@/shared/api/types';
import { askObservabilityAi, getAiStatus, type AiChatTurn } from '@/features/ai/functions';

import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/components/ui/toast';
import { UpgradeGate } from '@/features/ai/components/UpgradeGate';
import { HoverIconLabel } from '@/shared/components/HoverIconLabel';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

type Props = {
  latestRequest?: RequestRecord | null;
  latestStress?: StressReport | null;
};

type AiStatus = Awaited<ReturnType<typeof getAiStatus>>;

export function AiChatPanel({ latestRequest, latestStress }: Props) {
  const toast = useToast();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<AiChatTurn[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void getAiStatus()
      .then((s) => {
        setStatus(s);
        if (s.needsAuth) {
          setGateMessage(s.cta.signIn);
        } else if (s.gated && s.remaining === 0) {
          setGateMessage(
            `Free AI limit reached (${s.limit} messages). Subscribe or self-host with your own Gemini key.`
          );
        }
      })
      .catch(() =>
        setStatus({
          configured: false,
          mode: 'selfhost',
          authenticated: false,
          needsAuth: false,
          plan: 'free',
          gated: false,
          limit: null,
          remaining: null,
          aiUsed: 0,
          cta: {
            upgrade: 'Subscribe on IJNUT Cloud for unlimited AI.',
            selfHost:
              'Or self-host: docker compose up --build, set your own GEMINI_API_KEY — no IJNUT fees.',
            signIn: 'Sign in to unlock 3 free AI messages on Cloud.'
          }
        })
      );
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  const locked =
    Boolean(status?.needsAuth) ||
    Boolean(status?.gated && status.remaining === 0);

  async function send(
    message: string,
    intent: 'chat' | 'explain_request' | 'summarize_stress' | 'suggest_fixes' = 'chat'
  ) {
    const trimmed = message.trim();
    if (!trimmed || pending || locked) return;

    if (status?.configured === false) {
      toast.error('Add GEMINI_API_KEY to .env', 'AI off');
      return;
    }

    const history = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setPending(true);

    try {
      const result = await askObservabilityAi({
        data: {
          message: trimmed,
          history: history.slice(-8),
          intent,
          requestId: latestRequest?.requestId,
          stressId: latestStress?.id
        }
      });

      if (!result.ok) {
        if ('gated' in result && result.gated) {
          setGateMessage(result.message);
          setStatus((prev) =>
            prev
              ? {
                  ...prev,
                  remaining: 0,
                  needsAuth: 'needsAuth' in result ? Boolean(result.needsAuth) : prev.needsAuth,
                  cta: result.cta ?? prev.cta
                }
              : prev
          );
          toast.error(
            'needsAuth' in result && result.needsAuth ? 'Sign in required' : 'AI limit reached',
            'needsAuth' in result && result.needsAuth ? 'Cloud AI' : 'Upgrade or self-host'
          );
          setMessages((prev) => [...prev, { role: 'assistant', content: result.message }]);
          return;
        }
        toast.error(result.message, 'AI error');
        setMessages((prev) => [...prev, { role: 'assistant', content: result.message }]);
        return;
      }

      if (result.remaining != null) {
        setStatus((prev) => (prev ? { ...prev, remaining: result.remaining } : prev));
        if (result.remaining === 0 && status?.gated) {
          setGateMessage(
            `Free AI limit reached (${status.limit} messages). Subscribe or self-host with your own Gemini key.`
          );
        }
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: result.reply }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI failed');
    } finally {
      setPending(false);
    }
  }

  const configured = status?.configured;
  const remainingLabel =
    status?.gated && status.remaining != null
      ? `${status.remaining} free left`
      : null;

  return (
    <Card className="relative flex h-full min-h-[18rem] flex-col border-0 bg-transparent shadow-none lg:min-h-0">
      <CardHeader className="flex flex-col gap-2 space-y-0 border-b border-border px-0 pb-3 pt-0 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Bot className="text-primary size-4" />
          Ask
          {remainingLabel ? (
            <span className="text-muted-foreground font-normal">· {remainingLabel}</span>
          ) : null}
        </CardTitle>
        <div className="-mx-1 flex items-center gap-0.5 overflow-x-auto px-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="group h-8 px-2"
            disabled={pending || locked || !latestRequest}
            aria-label="Explain"
            onClick={() =>
              void send(
                'Explain this request: was it slow, and why? Use spans if present.',
                'explain_request'
              )
            }
          >
            <Sparkles className="size-3.5 shrink-0" />
            <HoverIconLabel>Explain</HoverIconLabel>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="group h-8 px-2"
            disabled={pending || locked || !latestStress}
            aria-label="Summarize load"
            onClick={() =>
              void send('Summarize the latest load test in plain language.', 'summarize_stress')
            }
          >
            <Gauge className="size-3.5 shrink-0" />
            <HoverIconLabel>Load</HoverIconLabel>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="group h-8 px-2"
            disabled={pending || locked}
            aria-label="Suggest fixes"
            onClick={() =>
              void send('Based on current metrics, what should I fix first?', 'suggest_fixes')
            }
          >
            <Wrench className="size-3.5 shrink-0" />
            <HoverIconLabel>Fixes</HoverIconLabel>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative flex min-h-0 flex-1 flex-col gap-3 px-0 pb-0">
        {configured === false ? (
          <p className="text-muted-foreground text-xs">Set GEMINI_API_KEY</p>
        ) : null}

        <div
          className={
            locked
              ? 'pointer-events-none flex min-h-0 flex-1 flex-col gap-3 opacity-50'
              : 'flex min-h-0 flex-1 flex-col gap-3'
          }
        >
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            {messages.length === 0 && !pending ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Ask about a slow route…
              </p>
            ) : null}
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={
                  m.role === 'user'
                    ? 'ml-6 rounded-2xl bg-primary/10 px-3 py-2 text-sm'
                    : 'text-foreground/90 mr-4 text-sm leading-relaxed'
                }
              >
                <div className="break-words whitespace-pre-wrap">{m.content}</div>
              </div>
            ))}
            {pending ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-3.5 animate-spin" />
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <form
            className="flex shrink-0 gap-2 border-t pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input, 'chat');
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message"
              disabled={pending || locked}
              className="min-w-0 border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              className="shrink-0"
              disabled={pending || locked || !input.trim()}
              aria-label="Send"
            >
              <Send className="size-4" />
            </Button>
          </form>
        </div>

        {locked && gateMessage && status?.cta ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-3">
            <UpgradeGate
              className="max-w-sm w-full"
              title={status.needsAuth ? 'Sign in for AI' : 'Free AI used up'}
              message={gateMessage}
              cta={status.cta}
              needsAuth={status.needsAuth}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
