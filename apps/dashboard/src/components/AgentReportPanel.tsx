import { useMemo, useState } from "react";
import { Check, ClipboardCopy } from "lucide-react";
import { HoverIconLabel } from "@/components/HoverIconLabel";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  buildAgentPastePayload,
  buildAgentReportMarkdown,
} from "@/lib/agent-report";
import type {
  OverviewResponse,
  RequestRecord,
  StressReport,
} from "@/lib/observability.functions";

type Props = {
  overview: OverviewResponse;
  requests: RequestRecord[];
  stressReports: StressReport[];
  includeToolTraffic: boolean;
};

/** Compact control — no preview wall of text. */
export function AgentReportCopyButton({
  overview,
  requests,
  stressReports,
  includeToolTraffic,
}: Props) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const payload = useMemo(() => {
    const report = buildAgentReportMarkdown({
      overview,
      requests,
      stressReports,
      includeToolTraffic,
    });
    return buildAgentPastePayload(report);
  }, [overview, requests, stressReports, includeToolTraffic]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      toast.success("Paste into your agent.", "Copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy.");
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="group h-8 px-2"
      aria-label="Copy for agent"
      onClick={() => void copy()}
    >
      {copied ? (
        <Check className="size-3.5 shrink-0" />
      ) : (
        <ClipboardCopy className="size-3.5 shrink-0" />
      )}
      <HoverIconLabel>{copied ? "Copied" : "Copy for agent"}</HoverIconLabel>
    </Button>
  );
}
