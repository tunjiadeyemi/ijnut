import { useEffect, useRef, useState } from "react";
import { Bot, Gauge, Loader2, Send, Sparkles, Wrench } from "lucide-react";
import { HoverIconLabel } from "@/components/HoverIconLabel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  askObservabilityAi,
  getAiStatus,
  type AiChatTurn,
  type RequestRecord,
  type StressReport,
} from "@/lib/observability.functions";

type Props = {
  latestRequest?: RequestRecord | null;
  latestStress?: StressReport | null;
};

export function AiChatPanel({ latestRequest, latestStress }: Props) {
  const toast = useToast();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<AiChatTurn[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void getAiStatus()
      .then((s) => setConfigured(s.configured))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  async function send(
    message: string,
    intent:
      | "chat"
      | "explain_request"
      | "summarize_stress"
      | "suggest_fixes" = "chat",
  ) {
    const trimmed = message.trim();
    if (!trimmed || pending) return;

    if (configured === false) {
      toast.error("Add GEMINI_API_KEY to .env", "AI off");
      return;
    }

    const history = messages.filter(
      (m) => m.role === "user" || m.role === "assistant",
    );
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setPending(true);

    try {
      const result = await askObservabilityAi({
        data: {
          message: trimmed,
          history: history.slice(-8),
          intent,
          requestId: latestRequest?.requestId,
          stressId: latestStress?.id,
        },
      });

      if (!result.ok) {
        toast.error(result.message, "AI error");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: result.message },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.reply },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="flex h-full min-h-0 flex-col border-0 bg-transparent shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 border-b border-border px-0 pb-3 pt-0">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Bot className="text-primary size-4" />
          Ask
        </CardTitle>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="group h-8 px-2"
            disabled={pending || !latestRequest}
            aria-label="Explain"
            onClick={() =>
              void send(
                "Explain this request: was it slow, and why? Use spans if present.",
                "explain_request",
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
              void send(
                "Summarize the latest load test in plain language.",
                "summarize_stress",
              )
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
              void send(
                "Based on current metrics, what should I fix first?",
                "suggest_fixes",
              )
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
                m.role === "user"
                  ? "ml-6 rounded-2xl bg-primary/10 px-3 py-2 text-sm"
                  : "text-foreground/90 mr-4 text-sm leading-relaxed"
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
            void send(input, "chat");
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
