"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Bot, Check, Loader2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/portal/ui/badge";
import { Button } from "@/components/portal/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/portal/ui/card";
import { EmptyState } from "@/components/portal/feedback/empty-state";
import { LoadingPage } from "@/components/portal/feedback/loading-page";
import { AIReportPanel, type AiReportData } from "@/components/portal/features/ai/ai-report-panel";
import { apiFetch } from "@/lib/portal-api";
import {
  applyReviewHighlights,
  mergeHighlightQuotes,
  pickFallbackHighlightQuotes,
  REVIEW_HIGHLIGHT_COLORS,
  type ReviewTextHighlights,
} from "@/lib/portal/apply-highlights";

const AUTO_SAVE_MS = 1200;

type ReviewPayload = {
  chapter: {
    _id: string;
    number: number;
    title: string;
    status: string;
    locked?: boolean;
    rejectionReason?: string;
    reviewDraftRemark?: string;
    reviewAnnotatedHtml?: string;
    aiReviewerReport?: AiReportData | null;
    aiReviewerAt?: string | null;
    approvedAt?: string;
  };
  version: {
    _id: string;
    versionNumber: number;
    wordCount?: number;
    submittedAt?: string;
  } | null;
  html: string;
  annotatedHtml?: string;
  review: {
    _id: string;
    status: string;
    model?: string;
    report?: AiReportData | null;
    completedAt?: string;
    error?: string;
  } | null;
  aiReviewer?: {
    report: AiReportData;
    savedAt?: string | null;
  } | null;
  project: {
    _id: string;
    title: string;
    topic?: string;
    studentId: string;
  };
  student: { id: string; name: string; email: string } | null;
};

type AiReviewerResult = AiReportData & {
  model?: string;
  researchGaps?: string[];
  revisionPriorities?: string[];
  projectTopic?: string | null;
  chapterTitle?: string;
  highlightQuotes?: ReviewTextHighlights;
  topicAlignment?: {
    topic?: string | null;
    score?: number | null;
    notes?: string[];
  };
};

function statusBadge(status: string) {
  if (status === "approved" || status === "locked") return "success" as const;
  if (status === "needs_revision" || status === "rejected")
    return "warning" as const;
  if (status === "under_review" || status === "submitted")
    return "warning" as const;
  return "neutral" as const;
}

function canDecide(status: string) {
  return status === "submitted" || status === "under_review";
}

function formatAiReviewerIntoRemark(result: AiReviewerResult) {
  const lines: string[] = [];
  if (result.remarksSummary) {
    lines.push(result.remarksSummary);
    return lines.join("\n");
  }
  if (result.projectTopic) {
    lines.push(`Topic analysed: ${result.projectTopic}`);
  }
  if (result.topicAlignment?.score != null) {
    lines.push(`Topic alignment: ${result.topicAlignment.score}/100`);
  }
  if (result.areaScores) {
    lines.push(
      `Scores — Weaknesses ${result.areaScores.weaknesses}/100 · Overall ${result.areaScores.overall}/100`,
    );
  }
  if (result.executiveSummary) {
    lines.push(`Summary: ${result.executiveSummary}`);
  }
  if (result.revisionPriorities?.length) {
    lines.push(
      `Priority revisions: ${result.revisionPriorities.join("; ")}`,
    );
  }
  if (result.weaknesses?.length) {
    lines.push(`Weaknesses: ${result.weaknesses.join("; ")}`);
  }
  if (result.researchGaps?.length) {
    lines.push(`Research gaps: ${result.researchGaps.join("; ")}`);
  }
  const citationCount = result.highlightQuotes?.citations?.length || 0;
  if (citationCount > 0) {
    lines.push(`Needs in-text citation: ${citationCount} passage(s) marked`);
  }
  if (result.supervisorRecommendation) {
    lines.push(`Recommendation: ${result.supervisorRecommendation}`);
  }
  return lines.join("\n");
}

function countMarks(html: string) {
  return (
    (html.match(/<mark\b[^>]*class="[^"]*review-flag/gi) || []).length ||
    (html.match(/<mark\b/gi) || []).length
  );
}

export default function ReviewWorkspacePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ReviewPayload | null>(null);
  const [reason, setReason] = useState("");
  const [displayHtml, setDisplayHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiReviewer, setAiReviewer] = useState<AiReviewerResult | null>(null);
  const [markCount, setMarkCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reasonRef = useRef(reason);
  const displayHtmlRef = useRef(displayHtml);
  const aiReviewerRef = useRef(aiReviewer);
  const skipAutoSaveRef = useRef(true);
  const saveChainRef = useRef(Promise.resolve(true));
  reasonRef.current = reason;
  displayHtmlRef.current = displayHtml;
  aiReviewerRef.current = aiReviewer;

  const persistReview = useCallback(
    async (opts?: {
      remark?: string;
      annotatedHtml?: string;
      aiReviewerReport?: Record<string, unknown> | null;
      silent?: boolean;
    }) => {
      const run = async () => {
        if (!opts?.silent) setSaveStatus("saving");
        try {
          await apiFetch(`/api/v1/chapters/${params.id}/save-review`, {
            method: "POST",
            body: JSON.stringify({
              remark: opts?.remark ?? reasonRef.current,
              annotatedHtml: opts?.annotatedHtml ?? displayHtmlRef.current,
              aiReviewerReport:
                opts?.aiReviewerReport !== undefined
                  ? opts.aiReviewerReport
                  : aiReviewerRef.current
                    ? (aiReviewerRef.current as unknown as Record<
                        string,
                        unknown
                      >)
                    : undefined,
            }),
          });
          setSaveStatus("saved");
          return true;
        } catch (err) {
          setSaveStatus("error");
          if (!opts?.silent) {
            setError(
              err instanceof Error
                ? err.message
                : "Could not auto-save review draft",
            );
          }
          return false;
        }
      };

      // Queue saves so AI persist is never dropped by an in-flight auto-save
      const queued = saveChainRef.current.then(run, run);
      saveChainRef.current = queued.then(
        () => true,
        () => true,
      );
      return queued;
    },
    [params.id],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setAiReviewer(null);
      setMarkCount(0);
      skipAutoSaveRef.current = true;
      try {
        const payload = (await apiFetch(
          `/api/v1/chapters/${params.id}`,
        )) as ReviewPayload;
        if (cancelled) return;
        setData(payload);

        const savedRemark =
          payload.chapter.reviewDraftRemark ||
          payload.chapter.rejectionReason ||
          "";
        setReason(savedRemark);

        const savedAi =
          (payload.aiReviewer?.report as AiReviewerResult | undefined) ||
          (payload.chapter.aiReviewerReport as AiReviewerResult | null) ||
          null;
        if (savedAi) setAiReviewer(savedAi);

        let sourceHtml =
          (payload.annotatedHtml || payload.chapter.reviewAnnotatedHtml || "").trim() ||
          payload.html ||
          "";

        // Recover highlights if annotated HTML was lost but quotes were saved
        const hasMarks = countMarks(sourceHtml) > 0;
        if (!hasMarks && savedAi?.highlightQuotes && payload.html) {
          const plain = payload.html
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          const local = pickFallbackHighlightQuotes(plain);
          const quotes = mergeHighlightQuotes(
            savedAi.highlightQuotes,
            local,
          );
          const rebuilt = applyReviewHighlights(payload.html, quotes);
          if (countMarks(rebuilt) > 0) {
            sourceHtml = rebuilt;
            // Re-persist recovered marks so the next refresh finds them
            void apiFetch(`/api/v1/chapters/${params.id}/save-review`, {
              method: "POST",
              body: JSON.stringify({
                remark: savedRemark,
                annotatedHtml: rebuilt,
                aiReviewerReport: savedAi as unknown as Record<string, unknown>,
              }),
            }).catch(() => undefined);
          }
        }

        setDisplayHtml(sourceHtml);
        setMarkCount(countMarks(sourceHtml));

        window.setTimeout(() => {
          if (!cancelled) skipAutoSaveRef.current = false;
        }, 800);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load submission",
          );
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  // Debounced auto-save for remark + current highlights
  useEffect(() => {
    if (loading || skipAutoSaveRef.current || !data) return;
    setSaveStatus((s) => (s === "saved" ? "idle" : s));
    const timer = window.setTimeout(() => {
      if (skipAutoSaveRef.current) return;
      void persistReview({ silent: true });
    }, AUTO_SAVE_MS);
    return () => window.clearTimeout(timer);
  }, [reason, displayHtml, loading, data, persistReview]);

  async function runAiReviewer() {
    if (!data?.version) {
      setError("This chapter has no submitted version to analyse yet.");
      return;
    }
    setAiBusy(true);
    setError(null);
    setMessage(null);
    skipAutoSaveRef.current = true;
    try {
      const result = (await apiFetch(
        `/api/v1/chapters/${params.id}/ai-reviewer`,
        { method: "POST" },
      )) as AiReviewerResult;

      const sourceHtml = data.html || "";
      const plain = sourceHtml
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const local = pickFallbackHighlightQuotes(plain);
      const quotes = mergeHighlightQuotes(result.highlightQuotes, local);
      const highlighted = applyReviewHighlights(sourceHtml, quotes);
      const marks = countMarks(highlighted);
      const reportWithQuotes: AiReviewerResult = {
        ...result,
        highlightQuotes: quotes,
      };
      const drafted = formatAiReviewerIntoRemark(reportWithQuotes);
      const nextRemark = (() => {
        const prev = reasonRef.current;
        if (!prev.trim()) return drafted;
        if (prev.includes("Topic analysed:") || prev.includes("Weaknesses:")) {
          return drafted;
        }
        return `${prev.trim()}\n\n${drafted}`;
      })();

      // Update refs immediately so queued saves see the latest content
      reasonRef.current = nextRemark;
      displayHtmlRef.current = highlighted;
      aiReviewerRef.current = reportWithQuotes;

      setAiReviewer(reportWithQuotes);
      setDisplayHtml(highlighted);
      setMarkCount(marks);
      setReason(nextRemark);

      const saved = await persistReview({
        remark: nextRemark,
        annotatedHtml: highlighted,
        aiReviewerReport: reportWithQuotes as unknown as Record<
          string,
          unknown
        >,
      });

      if (!saved) {
        setError(
          "AI finished but the review could not be saved. Try Re-run AI Reviewer.",
        );
        return;
      }

      setData((prev) =>
        prev
          ? {
              ...prev,
              annotatedHtml: highlighted,
              chapter: {
                ...prev.chapter,
                reviewDraftRemark: nextRemark,
                reviewAnnotatedHtml: highlighted,
                aiReviewerReport: reportWithQuotes,
                aiReviewerAt: new Date().toISOString(),
              },
              aiReviewer: {
                report: reportWithQuotes,
                savedAt: new Date().toISOString(),
              },
            }
          : prev,
      );

      if (marks === 0) {
        setMessage(
          "AI Reviewer finished and saved. Refresh anytime — results stay. Use Request revision to send feedback to the student.",
        );
      } else {
        setMessage(
          `Saved ${marks} highlighted passage(s). Refresh keeps them — no need to run AI again. Request revision to share with the student.`,
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "AI Reviewer could not complete",
      );
    } finally {
      setAiBusy(false);
      window.setTimeout(() => {
        skipAutoSaveRef.current = false;
      }, 800);
    }
  }

  async function approve() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await persistReview({ silent: true });
      await apiFetch(`/api/v1/chapters/${params.id}/approve`, {
        method: "POST",
      });
      setMessage("Chapter approved and locked. Next chapter is unlocked.");
      const payload = (await apiFetch(
        `/api/v1/chapters/${params.id}`,
      )) as ReviewPayload;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  }

  async function requestRevision() {
    if (reason.trim().length < 3) {
      setError("Add a remark (at least 3 characters) explaining what to revise.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      // Persist current AI highlights + remark before publishing to the student
      await persistReview({
        remark: reason.trim(),
        annotatedHtml: displayHtml,
        aiReviewerReport: aiReviewerRef.current
          ? (aiReviewerRef.current as unknown as Record<string, unknown>)
          : undefined,
      });
      await apiFetch(`/api/v1/chapters/${params.id}/reject`, {
        method: "POST",
        body: JSON.stringify({
          reason: reason.trim(),
          needsRevision: true,
          annotatedHtml: displayHtml,
        }),
      });
      setMessage(
        "Revision requested. The student can now see your remark and highlighted passages.",
      );
      const payload = (await apiFetch(
        `/api/v1/chapters/${params.id}`,
      )) as ReviewPayload;
      setData(payload);
      const savedAnnotated =
        payload.annotatedHtml ||
        payload.chapter.reviewAnnotatedHtml ||
        displayHtml;
      setDisplayHtml(savedAnnotated);
      setMarkCount(countMarks(savedAnnotated));
      if (payload.aiReviewer?.report || payload.chapter.aiReviewerReport) {
        setAiReviewer(
          (payload.aiReviewer?.report ||
            payload.chapter.aiReviewerReport) as AiReviewerResult,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingPage label="Opening chapter review…" />;

  if (!data) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="Submission not found"
          description={error || "Open a pending review from your queue."}
          action="View review queue"
          href="/reviews"
        />
      </div>
    );
  }

  const { chapter, version, html, review, project, student } = data;
  const decidable = canDecide(chapter.status);
  const hasContent = Boolean(html.replace(/<[^>]+>/g, " ").trim());
  const hasSavedAiReview = Boolean(
    aiReviewer ||
      data.aiReviewer?.report ||
      chapter.aiReviewerReport ||
      markCount > 0,
  );
  const savedAiAt =
    data.aiReviewer?.savedAt || chapter.aiReviewerAt || null;
  const activeReport = aiReviewer || review?.report;
  const activeStatus = hasSavedAiReview
    ? "completed"
    : review?.status;
  const activeMeta = aiReviewer
    ? `AI Reviewer saved${aiReviewer.model ? ` · ${aiReviewer.model}` : ""} · ${markCount} highlighted passage(s)${
        aiReviewer.projectTopic
          ? ` · topic: ${aiReviewer.projectTopic}`
          : project.topic
            ? ` · topic: ${project.topic}`
            : ""
      }${savedAiAt ? ` · ${new Date(savedAiAt).toLocaleString()}` : ""}`
    : review?.model
      ? `Model: ${review.model}${
          review.completedAt
            ? ` · ${new Date(review.completedAt).toLocaleString()}`
            : ""
        }`
      : "AI pre-read for this submission";

  return (
    <div className="space-y-6">
      <Link
        href="/reviews"
        className="inline-flex items-center gap-2 text-sm font-semibold text-foreground/60 hover:text-accent"
      >
        <ArrowLeft className="size-4" />
        Back to reviews
      </Link>

      <section className="rounded-3xl border border-border bg-card p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
              Chapter review
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
              {chapter.title}
            </h1>
            <p className="mt-2 text-foreground/65">
              {student?.name || "Student"} · {project.title}
              {version
                ? ` · v${version.versionNumber}${
                    typeof version.wordCount === "number"
                      ? ` · ${version.wordCount} words`
                      : ""
                  }`
                : ""}
            </p>
            {project.topic && (
              <p className="mt-1 text-sm text-foreground/50">
                Topic: {project.topic}
              </p>
            )}
            <p className="mt-2 text-xs font-medium text-foreground/45" aria-live="polite">
              {saveStatus === "saving" && "Saving review draft…"}
              {saveStatus === "saved" && "Review draft saved"}
              {saveStatus === "error" && "Auto-save failed — edit again to retry"}
              {saveStatus === "idle" &&
                (hasSavedAiReview
                  ? "AI review is saved — no need to run it again unless the chapter changed"
                  : "Highlights, remark, and AI review auto-save")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={statusBadge(chapter.status)}>
              {chapter.status.replace(/_/g, " ")}
            </Badge>
            {hasSavedAiReview && (
              <Badge variant="success">
                AI review saved
                {markCount > 0 ? ` · ${markCount} marks` : ""}
              </Badge>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={aiBusy || busy || !version || !hasContent}
              title={
                hasSavedAiReview
                  ? "Re-analyse only if the student resubmitted new content"
                  : "Highlight weaknesses and missing in-text citations — results are saved"
              }
              onClick={() => void runAiReviewer()}
            >
              {aiBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Bot className="size-4" />
              )}
              {aiBusy
                ? "Analysing…"
                : hasSavedAiReview
                  ? "Re-run AI Reviewer"
                  : "AI Reviewer"}
            </Button>
            {student && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  router.push(`/students/${student.id}`)
                }
              >
                Student profile
              </Button>
            )}
          </div>
        </div>
      </section>

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {message}
        </p>
      )}

      <AIReportPanel
        report={activeReport}
        status={activeStatus}
        meta={activeMeta}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submission content</CardTitle>
            <CardDescription>
              {hasSavedAiReview
                ? "Saved highlights are shown below. Re-run AI only if the student submitted a new version."
                : "Run AI Reviewer once — highlights and the report are saved automatically."}
            </CardDescription>
            <div className="flex flex-wrap gap-3 pt-2 text-[11px] text-foreground/55">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ background: REVIEW_HIGHLIGHT_COLORS.weakness }}
                />
                Weakness
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ background: REVIEW_HIGHLIGHT_COLORS.citation }}
                />
                Claim needs in-text citation
              </span>
              {markCount > 0 && (
                <span className="ml-auto font-semibold tabular-nums text-foreground/70">
                  {markCount} marked
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {(displayHtml || html).trim() ? (
              <div
                className="review-highlight-content prose prose-sm max-w-none rounded-2xl border border-border bg-muted/20 px-5 py-4 text-foreground [&_h1]:text-xl [&_h2]:text-lg [&_img]:max-w-full"
                dangerouslySetInnerHTML={{ __html: displayHtml || html }}
              />
            ) : (
              <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-foreground/55">
                No content in this submission.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decision</CardTitle>
            <CardDescription>
              Remark and highlights auto-save. Click{" "}
              <strong>Request revision</strong> to send the marked passages to
              the student so they can see where to work.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-semibold">Remark</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={8}
                disabled={!decidable && !!chapter.rejectionReason}
                placeholder="Required for rewrite — tell the student what to improve…"
                className="w-full resize-y rounded-2xl border border-border bg-background px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2 disabled:opacity-60"
              />
              <span className="text-xs text-foreground/50">
                Changes auto-save with highlights and AI review.
              </span>
            </label>

            <div className="flex flex-col gap-2">
              <Button
                disabled={busy || !decidable}
                onClick={() => void approve()}
              >
                <Check className="size-4" />
                Approve chapter
              </Button>
              <Button
                variant="outline"
                disabled={busy || !decidable}
                onClick={() => void requestRevision()}
              >
                <RotateCcw className="size-4" />
                Request revision
              </Button>
            </div>

            {!decidable && (
              <p className="text-xs text-foreground/50">
                This chapter is no longer awaiting a decision (
                {chapter.status.replace(/_/g, " ")}).
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
