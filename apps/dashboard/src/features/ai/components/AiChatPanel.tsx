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
        if (s.gated && s.remaining === 0) {
          setGateMessage(
            `Free Cloud AI limit reached (${s.limit}/day). Upgrade or self-host with your own Gemini key.`
          );
        }
      })
      .catch(() =>
        setStatus({
          configured: false,
          mode: 'selfhost',
          plan: 'free',
          gated: false,
          limit: null,
          remaining: null,
          cta: {
            upgrade: 'Unlock higher AI and stress limits on IJNUT Cloud (set IJNUT_PLAN=pro).',
            selfHost:
              'Or self-host: docker compose up --build, set your own GEMINI_API_KEY — no IJNUT fees.'
          }
        })
      );
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  async function send(
    message: string,
    intent: 'chat' | 'explain_request' | 'summarize_stress' | 'suggest_fixes' = 'chat'
  ) {
    const trimmed = message.trim();
    if (!trimmed || pending) return;

    if (status?.configured === false) {
      toast.error('Add GEMINI_API_KEY to .env', 'AI off');
      return;
    }

    if (gateMessage && status?.gated && status.remaining === 0) {
      toast.error('AI daily limit reached', 'Upgrade or self-host');
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
            prev ? { ...prev, remaining: 0, cta: result.cta ?? prev.cta } : prev
          );
          toast.error('AI limit reached', 'Upgrade or self-host');
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
            `Free Cloud AI limit reached (${status.limit}/day). Upgrade or self-host with your own Gemini key.`
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
    status?.gated && status.remaining != null ? `${status.remaining} left today` : null;

  return (
    <Card className="flex h-full min-h-[18rem] flex-col border-0 bg-transparent shadow-none lg:min-h-0">
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
            disabled={pending || !latestRequest}
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
            disabled={pending || !latestStress}
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
            disabled={pending}
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
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-0 pb-0">
        {configured === false ? (
          <p className="text-muted-foreground text-xs">Set GEMINI_API_KEY</p>
        ) : null}

        {gateMessage && status?.cta ? <UpgradeGate message={gateMessage} cta={status.cta} /> : null}

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
            disabled={pending}
            className="min-w-0 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            className="shrink-0"
            disabled={pending || !input.trim()}
            aria-label="Send"
          >
            <Send className="size-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
