import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Check,
  Copy,
  Gauge,
  Loader2,
  MessageSquarePlus,
  Send,
  Sparkles,
  Wrench
} from 'lucide-react';

import type { AiConversation, RequestRecord, StressReport } from '@/shared/api/types';
import {
  askObservabilityAi,
  createAiConversation,
  getAiHistory,
  getAiStatus,
  listAiConversations,
  type AiChatTurn
} from '@/features/ai/functions';
import { buildAgentBriefPaste } from '@/features/ai/lib/agent-brief';

import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Select } from '@/shared/components/ui/select';
import { useToast } from '@/shared/components/ui/toast';
import { UpgradeGate } from '@/features/ai/components/UpgradeGate';
import { HoverIconLabel } from '@/shared/components/HoverIconLabel';
import { EmptyState } from '@/shared/components/EmptyState';
import { Markdown } from '@/shared/components/Markdown';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

type Props = {
  latestRequest?: RequestRecord | null;
  latestStress?: StressReport | null;
};

type AiStatus = Awaited<ReturnType<typeof getAiStatus>>;

function conversationLabel(c: AiConversation): string {
  if (c.title?.trim()) return c.title.trim();
  try {
    const d = new Date(c.updatedAt);
    if (!Number.isNaN(d.getTime())) {
      return `Chat · ${d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    }
  } catch {
    // ignore
  }
  return 'New chat';
}

export function AiChatPanel({ latestRequest, latestStress }: Props) {
  const toast = useToast();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<AiChatTurn[]>([]);
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadConversation(apiScope: string, id: string) {
    const hist = await getAiHistory({
      data: { apiScope, conversationId: id }
    });
    if (hist.ok) {
      setConversationId(hist.conversationId ?? id);
      setMessages(hist.messages);
    }
  }

  async function bootstrapConversations(apiScope: string) {
    let listed = await listAiConversations({ data: { apiScope } });
    if (!listed.ok) return;

    let list = listed.conversations;
    if (list.length === 0) {
      const created = await createAiConversation({ data: { apiScope } });
      if (!created.ok || !('conversation' in created)) return;
      list = [created.conversation];
    }

    setConversations(list);
    const active = list[0];
    setConversationId(active.id);
    await loadConversation(apiScope, active.id);
  }

  useEffect(() => {
    void getAiStatus()
      .then(async (s) => {
        setStatus(s);
        if (s.statusError) {
          setGateMessage(null);
          return;
        }
        if (s.needsAuth) {
          setGateMessage(s.cta.signIn);
          return;
        }
        if (s.gated && s.remaining === 0) {
          setGateMessage(
            `Free AI limit reached (${s.limit} messages). Subscribe or self-host with your own API key.`
          );
        }
        if (s.authenticated && s.mode === 'cloud') {
          await bootstrapConversations(s.apiScope);
        }
      })
      .catch((err) =>
        setStatus({
          configured: null,
          mode: 'cloud',
          authenticated: false,
          needsAuth: true,
          plan: 'free',
          gated: true,
          limit: null,
          remaining: null,
          aiUsed: 0,
          billingConfigured: false,
          apiScope: 'legacy',
          cta: {
            upgrade: 'Subscribe for unlimited Cloud AI + chat memory via Bachs.',
            selfHost:
              'Or self-host AI: GEMINI_API_KEY / COHERE_API_KEY on your local API (IJNUT_MODE=selfhost).',
            signIn: 'Sign in to use Cloud AI (chat memory; 3 free messages).'
          },
          statusError: err instanceof Error ? err.message : 'Could not load AI status'
        })
      );
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  const locked =
    Boolean(status?.needsAuth) ||
    Boolean(status?.gated && status.remaining === 0);

  const showConversationControls =
    Boolean(status?.authenticated) && status?.mode === 'cloud' && !status.statusError;

  async function onSelectConversation(id: string) {
    if (!status?.apiScope || id === conversationId || pending) return;
    setConversationId(id);
    setPending(true);
    try {
      await loadConversation(status.apiScope, id);
    } finally {
      setPending(false);
    }
  }

  async function onNewChat() {
    if (!status?.apiScope || pending) return;
    setPending(true);
    try {
      const created = await createAiConversation({ data: { apiScope: status.apiScope } });
      if (!created.ok || !('conversation' in created)) {
        toast.error(created.message ?? 'Could not start chat', 'AI');
        return;
      }
      setConversations((prev) => [created.conversation, ...prev]);
      setConversationId(created.conversation.id);
      setMessages([]);
    } finally {
      setPending(false);
    }
  }

  async function copyForAgent(content: string, index: number) {
    try {
      await navigator.clipboard.writeText(buildAgentBriefPaste(content));
      setCopiedIdx(index);
      toast.success('Copied for your coding agent');
      window.setTimeout(() => setCopiedIdx((i) => (i === index ? null : i)), 2000);
    } catch {
      toast.error('Could not copy');
    }
  }

  async function send(
    message: string,
    intent: 'chat' | 'explain_request' | 'summarize_stress' | 'suggest_fixes' = 'chat'
  ) {
    const trimmed = message.trim();
    if (!trimmed || pending || locked) return;

    if (status?.statusError) {
      toast.error(status.statusError, 'AI status');
      return;
    }
    if (status?.configured === false) {
      toast.error('Set GEMINI_API_KEY or COHERE_API_KEY on the API', 'AI off');
      return;
    }

    let activeId = conversationId;
    if (status?.mode === 'cloud' && status.authenticated && !activeId && status.apiScope) {
      const created = await createAiConversation({ data: { apiScope: status.apiScope } });
      if (!created.ok || !('conversation' in created)) {
        toast.error(created.message ?? 'Could not start chat', 'AI');
        return;
      }
      activeId = created.conversation.id;
      setConversationId(activeId);
      setConversations((prev) => [created.conversation, ...prev]);
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
          stressId: latestStress?.id,
          conversationId: activeId ?? undefined,
          apiScope: status?.apiScope
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
            `Free AI limit reached (${status.limit} messages). Subscribe or self-host with your own API key.`
          );
        }
      }

      if (activeId) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeId
              ? {
                  ...c,
                  title: c.title ?? trimmed.slice(0, 60),
                  updatedAt: new Date().toISOString()
                }
              : c
          )
        );
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
          {showConversationControls && conversations.length > 0 ? (
            <>
              <Select
                aria-label="Conversation"
                mono={false}
                size="sm"
                disabled={pending || locked}
                className="mr-1 w-[10rem] sm:w-[14rem]"
                value={conversationId ?? conversations[0]?.id ?? ''}
                options={conversations.map((c) => ({
                  value: c.id,
                  label: conversationLabel(c)
                }))}
                onChange={(id) => void onSelectConversation(id)}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="group h-8 px-2"
                disabled={pending || locked}
                aria-label="New chat"
                onClick={() => void onNewChat()}
              >
                <MessageSquarePlus className="size-3.5 shrink-0" />
                <HoverIconLabel>New</HoverIconLabel>
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="group h-8 px-2"
            disabled={pending || locked || !latestRequest}
            aria-label="Explain"
            onClick={() =>
              void send(
                'Explain this request: was it slow, and why? Use db/SQL spans if present and call out the bottleneck.',
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
              void send(
                'Based on current metrics and slow SQL spans, what should I fix first? Include index/cache/N+1 advice when evidence supports it.',
                'suggest_fixes'
              )
            }
          >
            <Wrench className="size-3.5 shrink-0" />
            <HoverIconLabel>Fixes</HoverIconLabel>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="relative flex min-h-0 flex-1 flex-col gap-3 px-0 pb-0">
        {status?.statusError ? (
          <p className="text-destructive text-xs">AI status: {status.statusError}</p>
        ) : null}
        {configured === false ? (
          <p className="text-muted-foreground text-xs">
            Set GEMINI_API_KEY or COHERE_API_KEY on the API (AI_PROVIDER=gemini|cohere)
          </p>
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
              <EmptyState
                icon={Bot}
                title="Ask about your API"
                description="Explain a slow request, summarize a load test, or get fix ideas from live metrics and SQL spans."
                className="flex-1 py-6"
              />
            ) : null}
            {messages.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={
                  m.role === 'user'
                    ? 'ml-6 rounded-2xl bg-primary/10 px-3 py-2 text-sm'
                    : 'text-foreground/90 mr-4 space-y-2 text-sm leading-relaxed'
                }
              >
                {m.role === 'assistant' ? (
                  <>
                    <Markdown>{m.content}</Markdown>
                    <div className="flex justify-start">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground h-7 gap-1.5 px-2 text-[11px]"
                        onClick={() => void copyForAgent(m.content, i)}
                      >
                        {copiedIdx === i ? (
                          <Check className="size-3" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        {copiedIdx === i ? 'Copied' : 'Copy for agent'}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="break-words whitespace-pre-wrap">{m.content}</div>
                )}
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
              billingConfigured={status.billingConfigured}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
