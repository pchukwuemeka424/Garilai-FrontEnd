"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Brain,
  CircleCheck,
  Highlighter,
  Loader2,
  MessageSquarePlus,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  UserRound,
  WandSparkles,
  X,
} from "lucide-react";
import { Badge } from "@/components/portal/ui/badge";
import { Button } from "@/components/portal/ui/button";
import { ConfirmModal } from "@/components/portal/ui/confirm-modal";
import { EmptyState } from "@/components/portal/feedback/empty-state";
import { LoadingPage } from "@/components/portal/feedback/loading-page";
import {
  DocumentEditor,
  countWordsFromHtml,
  toEditorHtml,
} from "@/components/portal/editor/document-editor";
import { ReviewAnnotator } from "@/components/portal/editor/review-annotator";
import type { ReviewAnnotationSavePayload } from "@/components/portal/editor/review-annotator";
import { stripRemarkHtml } from "@/lib/portal/remark-html";
import {
  AIReportPanel,
  type AiReportData,
} from "@/components/portal/features/ai/ai-report-panel";
import { apiFetch } from "@/lib/portal-api";
import {
  computeAreaScores,
  mergeHighlightQuotes,
  pickFallbackHighlightQuotes,
  quotesFromFactCheckClaims,
  REVIEW_HIGHLIGHT_LABELS,
  type AreaScores,
  type ReviewTextHighlights,
} from "@/lib/portal/apply-highlights";
import {
  analyzeDocumentClaimsAndCitations,
  type FactCheckAuditReport,
} from "@/lib/portal/fact-check-citations";
import { cn } from "@/lib/portal/cn";
import { ReviewTrailPanel } from "@/components/portal/features/review/review-trail-panel";
import {
  isAwaitingNewReview,
  type ReviewTrailEvent,
} from "@/lib/portal/review-trail";

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
    updatedAt?: string;
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
  reviewTrail?: ReviewTrailEvent[];
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

type PendingConfirm = "approve" | "needs_revision" | null;

function countMarks(html: string) {
  return (
    (html.match(/<mark\b[^>]*class="[^"]*review-flag/gi) || []).length ||
    (html.match(/<mark\b/gi) || []).length
  );
}

function countWords(html: string) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.split(/\s+/).length : 0;
}

function formatAiReviewerIntoRemarkHtml(result: AiReviewerResult): string {
  const parts: string[] = [];
  if (result.remarksSummary) {
    parts.push(`<p>${result.remarksSummary.replace(/\n+/g, "</p><p>")}</p>`);
    return parts.join("");
  }
  if (result.executiveSummary) {
    parts.push(`<h3>Executive Summary</h3><p>${result.executiveSummary}</p>`);
  }
  if (result.strengths?.length) {
    parts.push(
      `<h3>Strengths</h3><ul>${result.strengths.map((s) => `<li>${s}</li>`).join("")}</ul>`,
    );
  }
  if (result.weaknesses?.length) {
    parts.push(
      `<h3>Weaknesses & Action Items</h3><ul>${result.weaknesses.map((w) => `<li>${w}</li>`).join("")}</ul>`,
    );
  }
  if (result.researchGaps?.length) {
    parts.push(
      `<h3>Research Gaps</h3><ul>${result.researchGaps.map((g) => `<li>${g}</li>`).join("")}</ul>`,
    );
  }
  if (result.revisionPriorities?.length) {
    parts.push(
      `<h3>Revision Priorities</h3><ul>${result.revisionPriorities.map((p) => `<li>${p}</li>`).join("")}</ul>`,
    );
  }
  if (result.supervisorRecommendation) {
    parts.push(
      `<h3>Supervisor Recommendation</h3><p>${result.supervisorRecommendation}</p>`,
    );
  }
  return parts.join("");
}

function ReviewModal({
  open,
  title,
  subtitle,
  kicker,
  icon,
  onClose,
  children,
  footer,
  footerMeta,
  size = "md",
  labelledBy,
  escapeDisabled = false,
  flushBody = false,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  kicker?: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  footerMeta?: ReactNode;
  size?: "md" | "wide" | "narrow" | "editor";
  labelledBy: string;
  escapeDisabled?: boolean;
  flushBody?: boolean;
}) {
  useEffect(() => {
    if (!open || escapeDisabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, escapeDisabled]);

  if (!open) return null;

  return (
    <div
      className="portal-review-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        className="portal-review-modal-scrim"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "portal-review-modal-panel",
          size === "wide" && "is-wide",
          size === "narrow" && "is-narrow",
          size === "editor" && "is-editor",
        )}
      >
        <div className="portal-review-modal-head">
          <div className="portal-review-modal-head-main">
            {icon ? (
              <span className="portal-review-modal-icon">{icon}</span>
            ) : null}
            <div>
              {kicker ? (
                <p className="portal-review-modal-kicker">{kicker}</p>
              ) : null}
              <h2 id={labelledBy}>{title}</h2>
              {subtitle ? (
                <p className="portal-review-modal-sub">{subtitle}</p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className="portal-review-modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
        <div
          className={cn(
            "portal-review-modal-body",
            flushBody && "is-flush",
          )}
        >
          {children}
        </div>
        {footer || footerMeta ? (
          <div className="portal-review-modal-foot">
            <div className="portal-review-modal-foot-meta">
              {footerMeta}
            </div>
            {footer ? (
              <div className="portal-review-modal-foot-actions">{footer}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ChapterReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ReviewPayload | null>(null);
  const [remark, setRemark] = useState("");
  const [annotatedHtml, setAnnotatedHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [remarkModalOpen, setRemarkModalOpen] = useState(false);
  const [factCheckModalOpen, setFactCheckModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<PendingConfirm>(null);
  const [aiReviewer, setAiReviewer] = useState<AiReviewerResult | null>(null);
  const [highlightToken, setHighlightToken] = useState(0);
  const [highlightQuotes, setHighlightQuotes] =
    useState<ReviewTextHighlights | null>(null);
  const [areaScores, setAreaScores] = useState<AreaScores | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const remarkRef = useRef(remark);
  const annotatedHtmlRef = useRef(annotatedHtml);
  const aiReviewerRef = useRef(aiReviewer);
  const skipAutoSaveRef = useRef(true);
  const saveChainRef = useRef(Promise.resolve(true));

  remarkRef.current = remark;
  annotatedHtmlRef.current = annotatedHtml;
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
              remark: opts?.remark ?? remarkRef.current,
              annotatedHtml: opts?.annotatedHtml ?? annotatedHtmlRef.current,
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
      setHighlightQuotes(null);
      setHighlightToken(0);
      setAreaScores(null);
      skipAutoSaveRef.current = true;
      try {
        const payload = (await apiFetch(
          `/api/v1/chapters/${params.id}`,
        )) as ReviewPayload;
        if (cancelled) return;
        setData(payload);

        const awaitingReview = isAwaitingNewReview(payload.reviewTrail);
        const savedRemark =
          payload.chapter.reviewDraftRemark ||
          payload.chapter.rejectionReason ||
          "";
        if (awaitingReview) {
          setRemark("");
        } else if (savedRemark.trim()) {
          setRemark(toEditorHtml(savedRemark));
        } else {
          setRemark("");
        }

        const savedAi =
          (payload.aiReviewer?.report as AiReviewerResult | undefined) ||
          (payload.chapter.aiReviewerReport as AiReviewerResult | null) ||
          null;

        if (savedAi) {
          setAiReviewer(savedAi);
          if (savedAi.areaScores) {
            setAreaScores(savedAi.areaScores);
          }
          if (savedAi.highlightQuotes) {
            setHighlightQuotes(savedAi.highlightQuotes);
            setHighlightToken((t) => t + 1);
          }
        }

        const sourceHtml = awaitingReview
          ? payload.html || ""
          : payload.annotatedHtml ||
            payload.chapter.reviewAnnotatedHtml ||
            payload.html ||
            "";
        setAnnotatedHtml(sourceHtml);

        window.setTimeout(() => {
          if (!cancelled) skipAutoSaveRef.current = false;
        }, 800);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load chapter submission",
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

  // Debounced auto-save for remark + current annotated HTML
  useEffect(() => {
    if (loading || skipAutoSaveRef.current || !data) return;
    setSaveStatus((s) => (s === "saved" ? "idle" : s));
    const timer = window.setTimeout(() => {
      if (skipAutoSaveRef.current) return;
      void persistReview({ silent: true });
    }, AUTO_SAVE_MS);
    return () => window.clearTimeout(timer);
  }, [remark, annotatedHtml, loading, data, persistReview]);

  const factCheckAudit: FactCheckAuditReport = useMemo(() => {
    const source = annotatedHtml || data?.html || "";
    return analyzeDocumentClaimsAndCitations(
      source,
      data?.project.topic || data?.project.title,
    );
  }, [annotatedHtml, data?.html, data?.project.topic, data?.project.title]);

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

      const plain = (data.html || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const baseArea = computeAreaScores(plain);
      const mergedArea: AreaScores = {
        strengths: result.areaScores?.strengths ?? baseArea.strengths,
        weaknesses: result.areaScores?.weaknesses ?? baseArea.weaknesses,
        overall: result.areaScores?.overall ?? baseArea.overall,
      };

      const quotes = mergeHighlightQuotes(
        result.highlightQuotes,
        mergeHighlightQuotes(
          quotesFromFactCheckClaims(factCheckAudit?.claims),
          pickFallbackHighlightQuotes(plain),
        ),
      );

      const reportWithQuotes: AiReviewerResult = {
        ...result,
        areaScores: mergedArea,
        highlightQuotes: quotes,
      };

      setAiReviewer(reportWithQuotes);
      setAreaScores(mergedArea);
      setHighlightQuotes(quotes);
      setHighlightToken((t) => t + 1);

      const draftedHtml = formatAiReviewerIntoRemarkHtml(reportWithQuotes);
      const currentRemark = remarkRef.current;
      const nextRemark = !currentRemark.trim()
        ? draftedHtml
        : `${currentRemark}<br/><br/>${draftedHtml}`;

      setRemark(nextRemark);
      remarkRef.current = nextRemark;
      aiReviewerRef.current = reportWithQuotes;

      await persistReview({
        remark: nextRemark,
        annotatedHtml: annotatedHtmlRef.current,
        aiReviewerReport: reportWithQuotes as unknown as Record<string, unknown>,
      });

      setMessage(
        "AI Reviewer finished and saved. Highlights and report are persistent.",
      );
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
      setMessage("Chapter approved successfully.");
      const payload = (await apiFetch(
        `/api/v1/chapters/${params.id}`,
      )) as ReviewPayload;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  }

  async function requestRevision() {
    const plain = stripRemarkHtml(remark);
    if (plain.length < 3) {
      setError("Add a remark (at least 3 characters) explaining what to revise.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await persistReview({
        remark: remark.trim(),
        annotatedHtml,
        aiReviewerReport: aiReviewerRef.current
          ? (aiReviewerRef.current as unknown as Record<string, unknown>)
          : undefined,
      });
      await apiFetch(`/api/v1/chapters/${params.id}/reject`, {
        method: "POST",
        body: JSON.stringify({
          reason: plain,
          needsRevision: true,
          annotatedHtml,
        }),
      });
      setMessage(
        "Revision requested. The student can now see your remarks and highlighted passages.",
      );
      const payload = (await apiFetch(
        `/api/v1/chapters/${params.id}`,
      )) as ReviewPayload;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  }

  function autoAnnotateFactCheckClaims() {
    const quotes = quotesFromFactCheckClaims(factCheckAudit.claims);
    const merged = mergeHighlightQuotes(highlightQuotes, quotes);
    setHighlightQuotes(merged);
    setHighlightToken((t) => t + 1);
    setMessage(
      `Applied highlights for ${factCheckAudit.claims.length} fact-checked claim(s).`,
    );
    setFactCheckModalOpen(false);
  }

  function insertFactCheckClaimsIntoRemark() {
    const flagged = factCheckAudit.claims.filter(
      (c) => c.status !== "verified",
    );
    if (flagged.length === 0) {
      setMessage("All detected claims have in-text citations or are verified.");
      return;
    }
    const htmlNotes = `<h3>Scholarly Integrity & Fact-Check Notes</h3><ul>${flagged
      .map(
        (c) =>
          `<li><strong>${c.badgeLabel}:</strong> "${c.sentence}" — <em>${c.explanation}</em>${
            c.suggestedAction ? ` (Recommended: ${c.suggestedAction})` : ""
          }</li>`,
      )
      .join("")}</ul>`;
    setRemark((prev) => (prev ? `${prev}<br/><br/>${htmlNotes}` : htmlNotes));
    setMessage("Inserted fact-check issues into remarks.");
    setFactCheckModalOpen(false);
    setRemarkModalOpen(true);
  }

  function insertAiIntoRemark() {
    if (!aiReviewer) return;
    const drafted = formatAiReviewerIntoRemarkHtml(aiReviewer);
    setRemark((prev) => (prev ? `${prev}<br/><br/>${drafted}` : drafted));
    setMessage("Inserted AI Reviewer findings into remarks.");
    setAiModalOpen(false);
    setRemarkModalOpen(true);
  }

  async function handleSaveAnnotation(payload: ReviewAnnotationSavePayload) {
    setAnnotatedHtml(payload.html);

    if (payload.removed) {
      const ok = await persistReview({
        remark,
        annotatedHtml: payload.html,
      });
      if (!ok) {
        throw new Error("Could not remove comment");
      }
      setMessage("Comment removed.");
      return;
    }

    const label = REVIEW_HIGHLIGHT_LABELS[payload.kind];
    const quote = payload.quote.trim();
    const note = payload.comment.trim();

    let nextRemark = remark;
    if (note || quote) {
      const escape = (s: string) =>
        s
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      const quoteHtml = quote
        ? `<em>“${escape(quote)}”</em>`
        : "<em>(selected passage)</em>";
      const commentHtml = note ? ` — ${escape(note)}` : "";
      const block = `<p><strong>[${escape(label)}]</strong> ${quoteHtml}${commentHtml}</p>`;
      nextRemark = stripRemarkHtml(remark)
        ? `${toEditorHtml(remark)}${block}`
        : block;
      setRemark(nextRemark);
    }

    const ok = await persistReview({
      remark: nextRemark,
      annotatedHtml: payload.html,
    });
    if (!ok) {
      throw new Error("Could not save annotation");
    }
    setMessage(note ? "Annotation and comment saved." : "Annotation saved.");
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
  const decidable = chapter.status === "submitted" || chapter.status === "under_review";
  const hasContent = Boolean(html.replace(/<[^>]+>/g, " ").trim());
  const words = countWords(annotatedHtml || html || "");
  const latestTrail = data.reviewTrail?.[data.reviewTrail.length - 1];
  const latestTrailKey = `${latestTrail?.type || "none"}-${latestTrail?.at || ""}`;
  const remarkPreview = stripRemarkHtml(remark);
  const remarkWords = countWordsFromHtml(remark);
  const activeReport = aiReviewer || review?.report;
  const marks = countMarks(annotatedHtml || html || "");

  const statusTone =
    chapter.status === "approved" || chapter.status === "locked"
      ? "ok"
      : chapter.status === "needs_revision" || chapter.status === "rejected"
        ? "risk"
        : "pending";

  const statusLabel =
    chapter.status === "needs_revision"
      ? "Needs revision"
      : chapter.status === "under_review"
        ? "Under review"
        : chapter.status.replace(/_/g, " ");

  const aiPercent =
    typeof aiReviewer?.aiContent?.percent === "number"
      ? aiReviewer.aiContent.percent
      : typeof review?.report?.aiContent?.percent === "number"
        ? review.report.aiContent.percent
        : null;

  return (
    <div className="portal-review">
      <Link href="/reviews" className="portal-students-back">
        <ArrowLeft className="size-4" />
        Back to reviews
      </Link>

      <header className="portal-students-hero">
        <div className="portal-review-hero-top">
          <div className="min-w-0">
            <p className="portal-students-kicker">Chapter review</p>
            <h1 className="portal-students-title">{chapter.title}</h1>
            <p className="portal-students-lead">
              {student?.name || "Student"}
              {student?.email ? ` · ${student.email}` : ""}
              {" · "}
              {project.title}
              {version
                ? ` · v${version.versionNumber}${
                    typeof version.wordCount === "number"
                      ? ` · ${version.wordCount.toLocaleString()} words`
                      : ""
                  }`
                : ""}
            </p>
            <div className="portal-review-meta">
              <span className={cn("portal-students-status", `is-${statusTone}`)}>
                {statusLabel}
              </span>
              <span
                className={cn(
                  "portal-students-status",
                  factCheckAudit.integrityScore >= 80
                    ? "is-ok"
                    : factCheckAudit.integrityScore >= 50
                      ? "is-topic"
                      : "is-risk",
                )}
              >
                Fact-Check {factCheckAudit.integrityScore}%
              </span>
              {aiPercent != null ? (
                <span className="portal-students-status is-topic">
                  AI {aiPercent}%
                </span>
              ) : null}
            </div>
          </div>
          <div className="portal-students-hero-actions">
            <Button
              type="button"
              variant="ai"
              disabled={!activeReport}
              onClick={() => setAiModalOpen(true)}
            >
              <Brain className="size-4" />
              AI report
            </Button>
            <Button
              variant="ai"
              disabled={aiBusy || !hasContent}
              onClick={() => void runAiReviewer()}
            >
              {aiBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <WandSparkles className="size-4" />
              )}
              {aiBusy ? "Analysing…" : aiReviewer ? "Re-run AI Reviewer" : "AI Reviewer"}
            </Button>
            {student && (
              <Button
                variant="info"
                onClick={() => router.push(`/students/${student.id}`)}
              >
                <UserRound className="size-4" />
                Student
              </Button>
            )}
          </div>
        </div>
      </header>

      {error && (
        <div className="portal-review-toast rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm font-medium text-rose-800">
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="portal-review-toast rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm font-medium text-emerald-800">
          <span>{message}</span>
        </div>
      )}

      <div className="portal-review-body">
        {/* Main Document Workspace */}
        <section className="portal-review-doc">
          <div className="portal-review-doc-head">
            <div>
              <h2>{chapter.title}</h2>
              <p>
                {words.toLocaleString()} words ·{" "}
                <span className="text-slate-400">
                  {saveStatus === "saving" && "Saving draft…"}
                  {saveStatus === "saved" && "Review draft saved"}
                  {saveStatus === "error" && "Auto-save failed"}
                  {saveStatus === "idle" && (marks > 0 ? `${marks} highlights saved` : "Select text to annotate.")}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFactCheckModalOpen(true)}
              className={cn(
                "portal-review-audit-btn",
                factCheckAudit.flaggedClaimsCount > 0
                  ? "is-warn"
                  : factCheckAudit.integrityScore >= 80
                    ? "is-ok"
                    : "is-risk",
              )}
              title="View detailed claims and citation audit"
            >
              <ShieldCheck className="size-3.5" />
              <span>
                {factCheckAudit.flaggedClaimsCount > 0
                  ? `${factCheckAudit.flaggedClaimsCount} claim flags`
                  : `Fact-check ${factCheckAudit.integrityScore}%`}
              </span>
              <ScanSearch className="size-3.5 opacity-70" />
            </button>
          </div>

          {hasContent || annotatedHtml.trim() ? (
            <ReviewAnnotator
              key={`${chapter._id}-${latestTrailKey}`}
              contentKey={`${chapter._id}-${latestTrailKey}`}
              value={annotatedHtml || html || ""}
              onChange={setAnnotatedHtml}
              highlightToken={highlightToken}
              highlightQuotes={highlightQuotes}
              areaScores={areaScores}
              onSaveAnnotation={handleSaveAnnotation}
              footerMeta={{
                wordCount: words,
                lastSaved: chapter.updatedAt || version?.submittedAt || null,
                version: version ? `v${version.versionNumber}` : "v1",
                authorName: student?.name || "Student",
              }}
            />
          ) : (
            <div className="portal-students-empty">
              <h2>No writing yet</h2>
              <p>This chapter submission has no text content to review.</p>
            </div>
          )}
        </section>

        {/* Sidebar Controls */}
        <aside className="portal-review-aside">
          <ReviewTrailPanel
            trail={data.reviewTrail}
            currentWordCount={words}
          />

          {/* Decision Card */}
          <section className="portal-review-card">
            <div className="portal-review-card-head">
              <h2>Decision</h2>
              <p>Approve chapter or request rewrite</p>
            </div>
            <div className="portal-review-actions">
              <Button
                variant="success"
                disabled={busy || !decidable}
                onClick={() => setConfirmAction("approve")}
              >
                <CircleCheck className="size-4" />
                Approve chapter
              </Button>
              <Button
                variant="warning"
                disabled={busy || !decidable}
                onClick={() => setConfirmAction("needs_revision")}
              >
                <RotateCcw className="size-4" />
                Request revision
              </Button>
            </div>
            {!decidable && (
              <p className="portal-review-hint">
                This chapter is already marked as{" "}
                <span className="font-semibold">{statusLabel}</span>.
              </p>
            )}
          </section>

          {/* Remarks Card */}
          <section className="portal-review-card">
            <button
              type="button"
              className="portal-review-card-head is-button"
              onClick={() => setRemarkModalOpen(true)}
            >
              <div>
                <h2>Remarks</h2>
                <p>
                  {remarkWords > 0
                    ? `${remarkWords} words written`
                    : "No remarks drafted yet"}
                </p>
              </div>
              <span className="portal-review-mark is-citation h-7 px-2.5 text-[11px]">
                Open Word editor
              </span>
            </button>
            <div className="portal-review-field">
              <span>Remarks for the student</span>
              <button
                type="button"
                className="portal-review-remark-trigger"
                onClick={() => setRemarkModalOpen(true)}
              >
                {remarkPreview ? (
                  <span className="portal-review-remark-preview">
                    {remarkPreview}
                  </span>
                ) : (
                  <span className="portal-review-remark-placeholder">
                    Click to open the Word editor — write feedback the student
                    will see…
                  </span>
                )}
              </button>
            </div>
          </section>
        </aside>
      </div>

      {/* Fact Check Audit Modal */}
      <ReviewModal
        open={factCheckModalOpen}
        labelledBy="factcheck-modal-title"
        title="Scholarly Integrity & Fact-Check Audit"
        subtitle="Automated analysis of claims, in-text citations, and bibliography integrity"
        kicker="Scholarly Integrity"
        icon={<ShieldCheck className="size-5 text-emerald-600" />}
        size="wide"
        onClose={() => setFactCheckModalOpen(false)}
        footer={
          <>
            <Button
              type="button"
              variant="slate"
              onClick={() => setFactCheckModalOpen(false)}
            >
              <X className="size-3.5" />
              Close
            </Button>
            <Button
              type="button"
              variant="warning"
              onClick={autoAnnotateFactCheckClaims}
              title="Apply citation and claim highlights across the document editor"
            >
              <Highlighter className="size-3.5" />
              Highlight in editor
            </Button>
            <Button
              type="button"
              variant="ai"
              onClick={insertFactCheckClaimsIntoRemark}
              title="Append uncited and flagged claims to supervisor remarks"
            >
              <MessageSquarePlus className="size-3.5" />
              Insert into remarks
            </Button>
            <Button
              type="button"
              variant="success"
              onClick={() => setFactCheckModalOpen(false)}
            >
              <CircleCheck className="size-3.5" />
              Done
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
              <p className="text-xs font-semibold text-slate-500 uppercase">Integrity Score</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {factCheckAudit.integrityScore}%
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
              <p className="text-xs font-semibold text-slate-500 uppercase">Claims Checked</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {factCheckAudit.totalClaims}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
              <p className="text-xs font-semibold text-slate-500 uppercase">Missing Cites</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {factCheckAudit.missingCitationsCount}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
              <p className="text-xs font-semibold text-slate-500 uppercase">Uncited Refs</p>
              <p className="text-2xl font-bold text-rose-600 mt-1">
                {factCheckAudit.unlinkedReferencesCount}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Claims & In-Text Citation Analysis
            </h3>
            {factCheckAudit.claims.length === 0 ? (
              <p className="text-sm text-slate-500">No claim sentences found in the submission.</p>
            ) : (
              <div className="space-y-2">
                {factCheckAudit.claims.map((claim) => (
                  <div
                    key={claim.id}
                    className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs space-y-1.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-medium text-slate-900 text-sm">“{claim.sentence}”</p>
                      <Badge
                        variant={
                          claim.badgeTone === "danger"
                            ? "danger"
                            : claim.badgeTone === "warning" || claim.badgeTone === "caution"
                              ? "warning"
                              : claim.badgeTone === "success"
                                ? "success"
                                : "neutral"
                        }
                      >
                        {claim.badgeLabel}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600">{claim.explanation}</p>
                    {claim.suggestedAction && (
                      <p className="text-xs font-medium text-amber-700 bg-amber-50 rounded px-2 py-1 inline-block">
                        Recommended: {claim.suggestedAction}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              References & Bibliography Reconciliation
            </h3>
            {factCheckAudit.references.length === 0 ? (
              <p className="text-sm text-slate-500">No reference entries detected in the References section.</p>
            ) : (
              <div className="space-y-2">
                {factCheckAudit.references.map((ref) => (
                  <div
                    key={ref.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-slate-800 leading-snug">
                        {ref.rawEntry}
                      </p>
                      {ref.note && (
                        <p className="text-xs text-slate-500 mt-1">{ref.note}</p>
                      )}
                    </div>
                    <Badge
                      variant={
                        ref.badgeTone === "danger"
                          ? "danger"
                          : ref.badgeTone === "warning"
                            ? "warning"
                            : "success"
                      }
                      className="shrink-0"
                    >
                      {ref.badgeLabel}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ReviewModal>

      {/* AI Report Modal */}
      <ReviewModal
        open={aiModalOpen}
        labelledBy="ai-modal-title"
        title="Chapter AI Review Report"
        subtitle={
          aiReviewer?.model
            ? `Generated by ${aiReviewer.model}`
            : "Detailed chapter review report"
        }
        kicker="Academic Intelligence"
        icon={<Brain className="size-5 text-violet-600" />}
        size="wide"
        onClose={() => setAiModalOpen(false)}
        footer={
          <>
            <Button
              type="button"
              variant="slate"
              onClick={() => setAiModalOpen(false)}
            >
              <X className="size-3.5" />
              Close
            </Button>
            <Button
              type="button"
              variant="ai"
              onClick={() => {
                insertAiIntoRemark();
                setAiModalOpen(false);
              }}
            >
              <MessageSquarePlus className="size-3.5" />
              Copy to remarks
            </Button>
          </>
        }
      >
        <AIReportPanel
          report={activeReport}
          status={statusLabel}
          meta={`${chapter.title} · ${words.toLocaleString()} words`}
        />
      </ReviewModal>

      {/* Remark Editor Modal */}
      <ReviewModal
        open={remarkModalOpen}
        labelledBy="remark-modal-title"
        title="Supervisor remarks"
        subtitle="Write and format feedback in the full Word editor. Drafts auto-save."
        kicker="Word editor"
        icon={<Sparkles className="size-5 text-violet-600" />}
        size="editor"
        flushBody
        onClose={() => setRemarkModalOpen(false)}
        footerMeta={
          <span className="text-xs text-slate-500">
            {remarkWords} words · Auto-saves draft automatically
          </span>
        }
        footer={
          <>
            <Button
              type="button"
              variant="ai"
              disabled={!aiReviewer}
              onClick={insertAiIntoRemark}
            >
              <Sparkles className="size-4" />
              Insert AI summary
            </Button>
            <Button
              type="button"
              variant="success"
              onClick={() => {
                void persistReview();
                setRemarkModalOpen(false);
              }}
            >
              <CircleCheck className="size-4" />
              Done
            </Button>
          </>
        }
      >
        <div className="portal-review-remark-editor">
          <DocumentEditor
            value={remark}
            onChange={setRemark}
            fillHeight
            fullWidth
            className="h-full min-h-0"
            placeholder="Write detailed chapter feedback, recommendations, and corrections…"
          />
        </div>
      </ReviewModal>

      {/* Decision Confirmation Modal */}
      <ConfirmModal
        open={confirmAction !== null}
        title={
          confirmAction === "approve"
            ? "Approve this chapter?"
            : "Request a chapter rewrite?"
        }
        description={
          confirmAction === "approve"
            ? "This confirms the chapter meets supervisor standards and unlocks the next stage. Your remarks will be sent to the student."
            : "Your remarks and highlighted passages will be sent to the student. They will need to revise and resubmit before this chapter can be approved."
        }
        confirmLabel={
          confirmAction === "approve"
            ? "Approve chapter"
            : "Request rewrite"
        }
        loadingLabel={confirmAction === "approve" ? "Approving…" : "Sending…"}
        variant={confirmAction === "approve" ? "primary" : "danger"}
        loading={busy}
        onConfirm={() => {
          if (confirmAction === "approve") void approve();
          else if (confirmAction === "needs_revision") void requestRevision();
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
