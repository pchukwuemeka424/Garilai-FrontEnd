"use client";

import { useEffect, useState } from "react";
import { Bot, Send } from "lucide-react";
import { Button } from "@/components/portal/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/portal/ui/card";
import { AIReportPanel, type AiReportData } from "@/components/portal/features/ai/ai-report-panel";
import { apiFetch } from "@/lib/portal-api";

type FeedbackRow = {
  _id: string;
  status: string;
  model?: string;
  report?: AiReportData | null;
  completedAt?: string;
  chapterId?: string;
  versionId?: string;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

type Props = {
  projectId: string;
  /** Bump after chapter submit to reload AI reviews. */
  refreshKey?: number;
};

export function ProjectAiAssistant({ projectId, refreshKey = 0 }: Props) {
  const [reviews, setReviews] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const rows = (await apiFetch(
          `/api/v1/feedback?projectId=${projectId}`,
        )) as FeedbackRow[];
        if (!cancelled) setReviews(rows);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load AI feedback",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey]);

  const latest = reviews[0] ?? null;

  async function sendChat(e: React.FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    setChat((prev) => [...prev, { role: "user", content: text }]);
    setMessage("");
    try {
      const res = (await apiFetch(`/api/v1/projects/${projectId}/ai/chat`, {
        method: "POST",
        body: JSON.stringify({ message: text }),
      })) as { reply: string };
      setChat((prev) => [
        ...prev,
        { role: "assistant", content: res.reply || "No reply." },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
      setChat((prev) => prev.slice(0, -1));
      setMessage(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <p className="text-sm text-foreground/55">Loading AI feedback…</p>
      ) : (
        <AIReportPanel
          report={latest?.report}
          status={latest?.status}
          meta={
            latest
              ? `Latest chapter AI review${
                  latest.model ? ` · ${latest.model}` : ""
                }${
                  latest.completedAt
                    ? ` · ${new Date(latest.completedAt).toLocaleString()}`
                    : ""
                }`
              : "Submit a chapter to generate an AI feedback report"
          }
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="size-5 text-primary" />
            AI research assistant
          </CardTitle>
          <CardDescription>
            Ask grounded questions about your project pages and chapters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="max-h-64 space-y-3 overflow-y-auto rounded-2xl border border-border bg-muted/20 p-3">
            {chat.length === 0 ? (
              <p className="text-sm text-foreground/55">
                Try: “What is my progress?” or “Summarise feedback on my latest
                chapter.”
              </p>
            ) : (
              chat.map((m, i) => (
                <div
                  key={`${m.role}-${i}`}
                  className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "ml-8 bg-primary/10 text-foreground"
                      : "mr-8 bg-card border border-border"
                  }`}
                >
                  {m.content}
                </div>
              ))
            )}
          </div>

          <form onSubmit={(e) => void sendChat(e)} className="flex gap-2">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask about your research…"
              maxLength={4000}
              className="h-11 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none ring-accent focus:ring-2"
            />
            <Button type="submit" disabled={busy || !message.trim()}>
              <Send className="size-4" />
              {busy ? "…" : "Ask"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
