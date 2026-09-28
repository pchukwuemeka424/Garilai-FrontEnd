"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Brain,
  CircleCheck,
  ClipboardList,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  MessageSquarePlus,
  Paperclip,
  PenLine,
  RotateCcw,
  Save,
  Sparkles,
  UserRound,
  WandSparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/portal/ui/button";
import { Input } from "@/components/portal/ui/input";
import { ConfirmModal } from "@/components/portal/ui/confirm-modal";
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
  hasReviewHighlightQuotes,
  mergeHighlightQuotes,
  pickFallbackHighlightQuotes,
  quotesFromFactCheckClaims,
  REVIEW_HIGHLIGHT_LABELS,
  type AreaScores,
  type ReviewTextHighlights,
} from "@/lib/portal/apply-highlights";
import { type FactCheckAuditReport } from "@/lib/portal/fact-check-citations";
import {
  buildSectionReviewNotes,
  formatSectionReviewRemarks,
} from "@/lib/portal/section-review-remarks";
import { isSinglePageProjectType } from "@/lib/portal/project-types";
import { AssignmentBriefPanel } from "@/components/portal/features/assignment/assignment-brief-panel";
import type { AssignmentBriefView } from "@/components/portal/features/assignment/assignment-brief-panel";
import { ReviewTrailPanel } from "@/components/portal/features/review/review-trail-panel";
import {
  isAwaitingNewReview,
  type ReviewTrailEvent,
} from "@/lib/portal/review-trail";
import { Select } from "@/components/portal/ui/select";
import { cn } from "@/lib/portal/cn";

type StudentInfo = {
  id: string;
  name: string;
  email: string;
};

type PageDetail = {
  _id: string;
  title: string;
  content?: string;
  order?: number;
  reviewStatus?: string;
  reviewRemark?: string;
  reviewAnnotatedHtml?: string;
  reviewedAt?: string;
  reviewTrail?: ReviewTrailEvent[];
  aiCorrectionFindings?: AiReportData["correctionFindings"];
  aiCorrectionSummary?: string;
  aiCorrectionChecks?: AiReportData["correctionChecks"];
  aiReviewedAt?: string | null;
  aiReviewModel?: string;
};

type PageNavItem = {
  _id: string;
  title: string;
  order?: number;
  reviewStatus?: string;
};

type CriterionScore = {
  name: string;
  score: number;
  maxMarks: number;
};

type PageAiSummary = AiReportData & {
  model?: string;
  highlightQuotes?: ReviewTextHighlights;
  areaScores?: AreaScores;
  factCheckAudit?: FactCheckAuditReport;
  aiReviewedAt?: string | null;
};

type PagePayload = {
  project: {
    _id: string;
    title: string;
    projectType: string;
    topic?: string;
    studentId: string;
    student: StudentInfo | null;
    score?: number | null;
    scoreNote?: string;
    scoredAt?: string | null;
    scoreSource?: string;
    maxScore?: number;
    assignmentBriefId?: string | null;
    assignmentBrief?: AssignmentBriefView | null;
    criterionScores?: CriterionScore[];
    aiSuggestedScore?: number | null;
    aiGeneratedPercent?: number | null;
    aiReviewSnapshot?: PageAiSummary | null;
    aiReviewedAt?: string | null;
  };
  page: PageDetail;
  pages: PageNavItem[];
};

type BriefOption = {
  _id: string;
  title: string;
  status: string;
  maxScore?: number;
};

type PendingConfirm = "approve" | "needs_revision" | "accept_ai" | null;

function reviewStatus(status?: string) {
  if (status === "approved") return { label: "Approved", tone: "ok" as const };
  if (status === "needs_revision") {
    return { label: "Needs rewrite", tone: "review" as const };
  }
  return { label: "Not reviewed", tone: "mid" as const };
}

function formatAiIntoRemark(
  summary: PageAiSummary,
  sourceHtml?: string,
): string {
  let overall =
    summary.remarksSummary?.trim() ||
    (summary.markingSkipped
      ? summary.assignmentGate?.reason?.trim()
      : "") ||
    summary.reviewerReport?.trim() ||
    summary.correctionSummary?.trim() ||
    [summary.executiveSummary, summary.supervisorRecommendation]
      .filter(Boolean)
      .join("\n\n");
  const sectionIdx = overall.indexOf("Section-by-section review");
  if (sectionIdx >= 0) {
    overall = overall.slice(0, sectionIdx).trim();
  }
  const section = buildClientSectionRemarks(summary, sourceHtml);
  return [overall, section].filter(Boolean).join("\n\n");
}

function buildClientSectionRemarks(
  summary: PageAiSummary,
  sourceHtml?: string,
): string {
  const html = sourceHtml || "";
  if (!html.trim() && !summary.highlightQuotes) return "";
  const quotes = mergeHighlightQuotes(
    summary.highlightQuotes,
    mergeHighlightQuotes(
      quotesFromFactCheckClaims(summary.factCheckAudit?.claims),
      pickFallbackHighlightQuotes(
        html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      ),
    ),
  );
  const missing = (summary.requirementChecks || [])
    .filter((c) => !c.met)
    .map((c) => c.item);
  return formatSectionReviewRemarks(
    buildSectionReviewNotes({
      htmlOrText: html,
      quotes,
      factCheck: summary.factCheckAudit,
      missingRequirements: missing,
      strengths: summary.strengths,
      weaknesses: summary.weaknesses,
    }),
  );
}

function countWords(html: string) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.split(/\s+/).length : 0;
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

export default function SupervisorPageReviewPage() {
  const params = useParams<{ projectId: string; pageId: string }>();
  const [data, setData] = useState<PagePayload | null>(null);
  const [remark, setRemark] = useState("");
  const [annotatedHtml, setAnnotatedHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [scoreBusy, setScoreBusy] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [scoreInput, setScoreInput] = useState("");
  const [criterionInputs, setCriterionInputs] = useState<
    Record<string, string>
  >({});
  const [myBriefs, setMyBriefs] = useState<BriefOption[]>([]);
  const [attachBriefId, setAttachBriefId] = useState("");
  const [attachBusy, setAttachBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [briefModalOpen, setBriefModalOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [remarkModalOpen, setRemarkModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<PendingConfirm>(null);
  const [aiSummary, setAiSummary] = useState<PageAiSummary | null>(null);
  const [highlightToken, setHighlightToken] = useState(0);
  const [highlightQuotes, setHighlightQuotes] =
    useState<ReviewTextHighlights | null>(null);
  const [areaScores, setAreaScores] = useState<AreaScores | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setAiSummary(null);
      setHighlightQuotes(null);
      setHighlightToken(0);
      setAreaScores(null);
      try {
        const payload = (await apiFetch(
          `/api/v1/projects/${params.projectId}/pages/${params.pageId}`,
        )) as PagePayload;
        if (cancelled) return;
        setData(payload);
        setScoreInput(
          typeof payload.project.score === "number"
            ? String(payload.project.score)
            : "",
        );
        const criteria = payload.project.assignmentBrief?.rubric || [];
        const existing = payload.project.criterionScores || [];
        const snapshot = payload.project.aiReviewSnapshot as
          | (PageAiSummary & { pageId?: string })
          | null
          | undefined;
        const snapshotForPage =
          snapshot &&
          typeof snapshot === "object" &&
          String(snapshot.pageId || "") === String(payload.page._id)
            ? snapshot
            : snapshot && typeof snapshot === "object"
              ? snapshot
              : null;
        const snapshotCriteria = snapshotForPage?.criterionScores || [];

        const inputs: Record<string, string> = {};
        for (const row of criteria) {
          const found =
            existing.find((c) => c.name === row.name) ||
            snapshotCriteria.find((c) => c.name === row.name);
          inputs[row.name] =
            found && typeof found.score === "number" ? String(Math.round(found.score)) : "";
        }
        setCriterionInputs(inputs);
        const isAssignmentProject = isSinglePageProjectType(
          payload.project.projectType,
        );

        const pageFindings = payload.page.aiCorrectionFindings;
        const pageSummary = payload.page.aiCorrectionSummary;
        const pageChecks = payload.page.aiCorrectionChecks;

        const activeSnapshot =
          snapshotForPage ||
          (isAssignmentProject && snapshot && typeof snapshot === "object"
            ? snapshot
            : null);

        if (activeSnapshot) {
          setAiSummary(activeSnapshot);
          if (activeSnapshot.areaScores) {
            setAreaScores(activeSnapshot.areaScores);
          }
          if (activeSnapshot.highlightQuotes) {
            setHighlightQuotes(activeSnapshot.highlightQuotes);
            setHighlightToken((t) => t + 1);
          }
        } else if (pageSummary || (pageFindings && pageFindings.length > 0)) {
          setAiSummary({
            correctionFindings: pageFindings,
            correctionSummary: pageSummary,
            correctionChecks: pageChecks,
            aiReviewedAt: payload.page.aiReviewedAt,
            model: payload.page.aiReviewModel,
            highlightQuotes: undefined,
          });
        }

        const awaitingReview = isAwaitingNewReview(payload.page.reviewTrail);
        const initialHtml = awaitingReview
          ? payload.page.content || ""
          : payload.page.reviewAnnotatedHtml || payload.page.content || "";
        setAnnotatedHtml(initialHtml);

        // Only show a score the lecturer already saved — never prefill from AI suggestion.
        setScoreInput(
          typeof payload.project.score === "number"
            ? String(payload.project.score)
            : "",
        );

        const snapshotRemarks =
          (snapshotForPage?.remarksSummary ||
            (isAssignmentProject && snapshot?.remarksSummary) ||
            "") as string;
        if (awaitingReview && !isAssignmentProject) {
          setRemark("");
        } else if (payload.page.reviewRemark?.trim()) {
          setRemark(payload.page.reviewRemark);
        } else if (snapshotRemarks.trim()) {
          setRemark(toEditorHtml(snapshotRemarks));
        } else {
          setRemark("");
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load page");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [params.projectId, params.pageId]);

  useEffect(() => {
    let cancelled = false;
    async function loadBriefs() {
      try {
        const rows = (await apiFetch(
          "/api/v1/assignment-briefs",
        )) as BriefOption[];
        if (cancelled) return;
        setMyBriefs(Array.isArray(rows) ? rows : []);
      } catch {
        if (cancelled) return;
        setMyBriefs([]);
      }
    }
    void loadBriefs();
    return () => {
      cancelled = true;
    };
  }, []);

  const anyModalOpen =
    briefModalOpen ||
    aiModalOpen ||
    attachModalOpen ||
    remarkModalOpen ||
    Boolean(confirmAction);

  useEffect(() => {
    if (!anyModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [anyModalOpen]);

  async function runAiSummary() {
    const isAssignmentRun = data
      ? isSinglePageProjectType(data.project.projectType)
      : false;
    if (isAssignmentRun && !data?.project.assignmentBrief) {
      setError(
        "Attach a lecturer assignment brief before running AI review. AI grades against the brief.",
      );
      setAttachModalOpen(true);
      return;
    }

    setAiBusy(true);
    setError(null);
    try {
      const summary = (await apiFetch(
        `/api/v1/projects/${params.projectId}/pages/${params.pageId}/ai-summary`,
        { method: "POST" },
      )) as PageAiSummary;
      setAiSummary(summary);

      const sourceHtml =
        annotatedHtml ||
        data?.page.reviewAnnotatedHtml ||
        data?.page.content ||
        "";
      const plain = sourceHtml
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const hasValidAiQuotes = hasReviewHighlightQuotes(summary.highlightQuotes);

      const quotes = mergeHighlightQuotes(
        hasValidAiQuotes ? summary.highlightQuotes : null,
        mergeHighlightQuotes(
          quotesFromFactCheckClaims(summary.factCheckAudit?.claims),
          pickFallbackHighlightQuotes(plain),
        ),
      );

      setHighlightQuotes(quotes);
      setHighlightToken((t) => t + 1);
      setAreaScores(summary.areaScores || computeAreaScores(plain));
      setData((prev) =>
        prev
          ? {
              ...prev,
              project: {
                ...prev.project,
                aiSuggestedScore:
                  typeof summary.aiSuggestedScore === "number"
                    ? summary.aiSuggestedScore
                    : prev.project.aiSuggestedScore,
                aiGeneratedPercent:
                  typeof summary.aiContent?.percent === "number"
                    ? summary.aiContent.percent
                    : prev.project.aiGeneratedPercent,
                aiReviewSnapshot: summary,
                aiReviewedAt: new Date().toISOString(),
              },
            }
          : prev,
      );

      // Prefill rubric criterion drafts from AI for lecturer editing — never auto-insert the mark.
      const nextCriterionInputs: Record<string, string> = {};
      if (Array.isArray(summary.criterionScores) && summary.criterionScores.length > 0) {
        for (const c of summary.criterionScores) {
          nextCriterionInputs[c.name] = String(Math.round(c.score));
        }
        setCriterionInputs(nextCriterionInputs);
      }

      // Prefill lecturer remark with overall AI remarks plus section annotations.
      const remarksBlock = formatAiIntoRemark(
        { ...summary, highlightQuotes: quotes },
        sourceHtml,
      );
      const editorRemarks = remarksBlock.trim() ? toEditorHtml(remarksBlock) : "";
      if (editorRemarks) {
        setRemark(editorRemarks);
      }

      const isAssignmentRun = data
        ? isSinglePageProjectType(data.project.projectType)
        : false;

      // Auto-save remarks and annotations only. Lecturers enter and save the score manually.
      try {
        if (editorRemarks || sourceHtml) {
          await apiFetch(
            `/api/v1/projects/${params.projectId}/pages/${params.pageId}/review`,
            {
              method: "POST",
              body: JSON.stringify({
                action: "remark_only",
                remark: stripRemarkHtml(editorRemarks) ? editorRemarks : "",
                annotatedHtml: sourceHtml,
              }),
            },
          ).catch(() => {});
        }
      } catch (saveErr) {
        console.warn("Auto-save after AI review:", saveErr);
      }

      if (isAssignmentRun) {
        const suggested =
          typeof summary.aiSuggestedScore === "number"
            ? summary.aiSuggestedScore
            : null;
        setMessage(
          summary.markingSkipped
            ? `Assignment out of scope. Feedback and annotations saved. Enter a mark manually if needed${
                suggested != null ? ` (AI suggested ${suggested}/${summary.maxScore ?? 100})` : ""
              }.`
            : `AI review completed. Feedback and annotations saved. Enter and save the mark yourself${
                suggested != null ? ` (AI suggested ${suggested}/${summary.maxScore ?? 100})` : ""
              }.`,
        );
      } else {
        setMessage(
          "AI chapter review completed and auto-saved to remarks and annotations.",
        );
      }
      setAiModalOpen(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not generate AI summary",
      );
    } finally {
      setAiBusy(false);
    }
  }

  function insertAiIntoRemark() {
    if (!aiSummary) return;
    const source =
      annotatedHtml || data?.page.reviewAnnotatedHtml || data?.page.content || "";
    const block = toEditorHtml(formatAiIntoRemark(aiSummary, source));
    setRemark((prev) => {
      if (!stripRemarkHtml(prev)) return block;
      if (stripRemarkHtml(prev).includes("Section-by-section review")) {
        return block;
      }
      return `${toEditorHtml(prev)}${block}`;
    });
    setMessage("AI feedback added to the Word editor.");
    setRemarkModalOpen(true);
  }

  async function persistRemarkAndAnnotations(opts: {
    remarkHtml: string;
    annotated: string;
  }) {
    await apiFetch(
      `/api/v1/projects/${params.projectId}/pages/${params.pageId}/review`,
      {
        method: "POST",
        body: JSON.stringify({
          action: "remark_only",
          remark: stripRemarkHtml(opts.remarkHtml) ? opts.remarkHtml : "",
          annotatedHtml: opts.annotated,
        }),
      },
    );
  }

  async function handleSaveAnnotation(payload: ReviewAnnotationSavePayload) {
    setAnnotatedHtml(payload.html);

    if (payload.removed) {
      try {
        await persistRemarkAndAnnotations({
          remarkHtml: remark,
          annotated: payload.html,
        });
        setMessage("Comment removed.");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not remove comment",
        );
        throw err;
      }
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

    try {
      await persistRemarkAndAnnotations({
        remarkHtml: nextRemark,
        annotated: payload.html,
      });
      setMessage(note ? "Annotation and comment saved." : "Annotation saved.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save annotation",
      );
      throw err;
    }
  }

  async function saveReviewDraft() {
    setDraftBusy(true);
    setError(null);
    setMessage(null);
    try {
      await persistRemarkAndAnnotations({
        remarkHtml: remark,
        annotated: annotatedHtml,
      });
      setMessage("Annotations and feedback saved.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save annotations and feedback",
      );
    } finally {
      setDraftBusy(false);
    }
  }

  async function submitReview(action: "approve" | "needs_revision") {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (action === "needs_revision" && stripRemarkHtml(remark).length < 3) {
        setError(
          "Add a remark (at least 3 characters) explaining what to rewrite.",
        );
        return;
      }
      const payload = (await apiFetch(
        `/api/v1/projects/${params.projectId}/pages/${params.pageId}/review`,
        {
          method: "POST",
          body: JSON.stringify({
            action,
            remark: stripRemarkHtml(remark) ? remark : "",
            annotatedHtml,
          }),
        },
      )) as PagePayload;
      setData(payload);
      setRemark(payload.page.reviewRemark || remark);
      setAnnotatedHtml(
        payload.page.reviewAnnotatedHtml || annotatedHtml,
      );
      setMessage(
        action === "approve"
          ? "Feedback added. Assignment approved — student has been notified."
          : "Feedback added. Rewrite requested — student has been notified.",
      );
      setConfirmAction(null);
      setRemarkModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save review");
    } finally {
      setBusy(false);
    }
  }

  async function saveScore(opts?: { acceptAi?: boolean }) {
    const maxScore =
      typeof data?.project.maxScore === "number"
        ? data.project.maxScore
        : typeof data?.project.assignmentBrief?.maxScore === "number"
          ? data.project.assignmentBrief.maxScore
          : 100;

    const acceptAi = Boolean(opts?.acceptAi);
    let parsed: number | undefined;

    if (acceptAi) {
      const suggested =
        typeof data?.project.aiSuggestedScore === "number"
          ? data.project.aiSuggestedScore
          : typeof aiSummary?.aiSuggestedScore === "number"
            ? aiSummary.aiSuggestedScore
            : null;
      if (suggested == null) {
        setError("Run AI review first to generate a suggested mark.");
        return;
      }
      parsed = suggested;
    } else {
      parsed = Number(scoreInput);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > maxScore) {
        setError(`Enter a score between 0 and ${maxScore}.`);
        return;
      }
    }

    const rubric = data?.project.assignmentBrief?.rubric || [];
    let criterionScores:
      | Array<{ name: string; score: number; maxMarks: number }>
      | undefined;
    if (acceptAi) {
      if (
        Array.isArray(aiSummary?.criterionScores) &&
        aiSummary.criterionScores.length > 0
      ) {
        criterionScores = aiSummary.criterionScores.map((c) => ({
          name: c.name,
          score: Math.round(c.score),
          maxMarks: c.maxMarks,
        }));
        const nextInputs: Record<string, string> = {};
        for (const c of aiSummary.criterionScores) {
          nextInputs[c.name] = String(Math.round(c.score));
        }
        setCriterionInputs(nextInputs);
      }
    } else if (rubric.length > 0) {
      criterionScores = [];
      for (const row of rubric) {
        const raw = criterionInputs[row.name] ?? "";
        if (raw.trim() === "") continue;
        const cScore = Number(raw);
        if (!Number.isFinite(cScore) || cScore < 0 || cScore > row.maxMarks) {
          setError(
            `Enter a valid score for “${row.name}” (0–${row.maxMarks}).`,
          );
          return;
        }
        criterionScores.push({
          name: row.name,
          score: cScore,
          maxMarks: row.maxMarks,
        });
      }
      if (criterionScores.length === 0) {
        criterionScores = undefined;
      }
    }

    setScoreBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = (await apiFetch(
        `/api/v1/projects/${params.projectId}/score`,
        {
          method: "POST",
          body: JSON.stringify({
            ...(acceptAi
              ? { acceptAiScore: true }
              : { score: parsed }),
            remark: stripRemarkHtml(remark) ? remark : undefined,
            annotatedHtml: annotatedHtml || undefined,
            ...(criterionScores ? { criterionScores } : {}),
          }),
        },
      )) as {
        score?: number | null;
        scoreNote?: string;
        scoredAt?: string | null;
        scoreSource?: string;
        criterionScores?: CriterionScore[];
        assignmentBrief?: AssignmentBriefView | null;
      };
      const savedScore =
        typeof updated.score === "number" ? updated.score : parsed!;
      setData((prev) =>
        prev
          ? {
              ...prev,
              project: {
                ...prev.project,
                score: savedScore,
                scoredAt: updated.scoredAt ?? new Date().toISOString(),
                scoreSource:
                  updated.scoreSource ??
                  (acceptAi ? "ai_approved" : "manual"),
                criterionScores:
                  updated.criterionScores ??
                  criterionScores ??
                  prev.project.criterionScores,
                assignmentBrief:
                  updated.assignmentBrief ?? prev.project.assignmentBrief,
              },
            }
          : prev,
      );
      setScoreInput(String(savedScore));
      setMessage(
        acceptAi
          ? `AI mark approved: ${savedScore}/${maxScore}. Student notified.`
          : `Manual score saved: ${savedScore}/${maxScore}. Student notified.`,
      );
      setConfirmAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save score");
    } finally {
      setScoreBusy(false);
    }
  }

  async function attachBrief() {
    if (!attachBriefId) {
      setError("Select an assignment brief to attach.");
      return;
    }
    setAttachBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = (await apiFetch(
        `/api/v1/projects/${params.projectId}/attach-brief`,
        {
          method: "POST",
          body: JSON.stringify({ assignmentBriefId: attachBriefId }),
        },
      )) as {
        assignmentBriefId?: string;
        assignmentBrief?: AssignmentBriefView | null;
      };
      setData((prev) =>
        prev
          ? {
              ...prev,
              project: {
                ...prev.project,
                assignmentBriefId: updated.assignmentBriefId ?? attachBriefId,
                assignmentBrief: updated.assignmentBrief ?? null,
                maxScore:
                  typeof updated.assignmentBrief?.maxScore === "number"
                    ? updated.assignmentBrief.maxScore
                    : prev.project.maxScore,
              },
            }
          : prev,
      );
      const criteria = updated.assignmentBrief?.rubric || [];
      const inputs: Record<string, string> = {};
      for (const row of criteria) {
        inputs[row.name] = "";
      }
      setCriterionInputs(inputs);
      setMessage("Assignment brief attached. Scoring now uses its max marks and rubric.");
      setAttachModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not attach brief");
    } finally {
      setAttachBusy(false);
    }
  }

  function requestRewrite() {
    if (stripRemarkHtml(remark).length < 3) {
      setError(
        "Add a remark (at least 3 characters) explaining what to rewrite.",
      );
      setRemarkModalOpen(true);
      return;
    }
    setConfirmAction("needs_revision");
  }

  if (loading) return <LoadingPage label="Opening page…" />;

  if (!data) {
    return (
      <div className="portal-review">
        <Link href="/students" className="portal-students-back">
          <ArrowLeft className="size-4" />
          Students
        </Link>
        <section className="portal-students-panel">
          <div className="portal-students-empty">
            <h2>Page not found</h2>
            <p>{error || "This page is not available for review."}</p>
            <Button asChild className="mt-2">
              <Link href="/students">Back to students</Link>
            </Button>
          </div>
        </section>
      </div>
    );
  }

  const { project, page } = data;
  const studentId = project.student?.id || project.studentId;
  const hasContent = Boolean(String(page.content || "").trim());
  const isAssignment = isSinglePageProjectType(project.projectType);
  const aiReviewLabel = isAssignment
    ? "Run AI Review"
    : "AI Chapter Review";
  const aiReportLabel = isAssignment
    ? "AI report"
    : "AI feedback report";
  const backHref = project.assignmentBriefId
    ? `/assignments/${project.assignmentBriefId}`
    : `/students/${studentId}`;
  const backLabel = project.assignmentBriefId
    ? "Assignment"
    : project.student?.name || "Student";
  const maxScore =
    typeof project.maxScore === "number"
      ? project.maxScore
      : typeof project.assignmentBrief?.maxScore === "number"
        ? project.assignmentBrief.maxScore
        : 100;
  const status = reviewStatus(page.reviewStatus);
  const words = countWords(annotatedHtml || page.content || "");
  const latestTrail = page.reviewTrail?.[page.reviewTrail.length - 1];
  const latestTrailKey = `${latestTrail?.type || "none"}-${latestTrail?.at || ""}`;
  const remarkPreview = stripRemarkHtml(remark);
  const remarkWords = countWordsFromHtml(remark);

  const suggestedScore =
    typeof project.aiSuggestedScore === "number"
      ? project.aiSuggestedScore
      : typeof aiSummary?.aiSuggestedScore === "number"
        ? aiSummary.aiSuggestedScore
        : null;
  const confirmBusy =
    confirmAction === "accept_ai" ? scoreBusy : busy;
  const confirmCopy =
    confirmAction === "approve"
      ? {
          title: "Approve this assignment?",
          description:
            "This confirms the student's work meets requirements. You can still leave feedback.",
          confirmLabel: "Approve submission",
          loadingLabel: "Approving…",
          variant: "primary" as const,
        }
      : confirmAction === "needs_revision"
        ? {
            title: "Request a rewrite?",
            description:
              "Your feedback and highlights will be sent to the student. They will need to revise before this can be approved.",
            confirmLabel: "Request rewrite",
            loadingLabel: "Sending…",
            variant: "danger" as const,
          }
        : {
            title: "Approve the AI mark?",
            description: `Apply the suggested mark of ${suggestedScore ?? "—"}/${maxScore}. The student will be notified. You can still change this later.`,
            confirmLabel: "Approve AI mark",
            loadingLabel: "Saving…",
            variant: "primary" as const,
          };

  return (
    <div className="portal-review">
      <header
        className={cn(
          "portal-students-hero portal-review-hero",
          isAssignment && "is-scoring",
        )}
      >
        <div className="portal-review-hero-top">
          <div className="portal-review-hero-copy min-w-0">
            <Link href={backHref} className="portal-students-back">
              <ArrowLeft className="size-4" />
              {backLabel}
            </Link>
            <div className="portal-review-hero-heading">
              <p className="portal-students-kicker">
                {isAssignment ? "Assignment review" : "Chapter review"}
              </p>
              {!isAssignment ? (
                <span
                  className={cn(
                    "portal-students-status",
                    `is-${status.tone}`,
                  )}
                >
                  {status.label}
                </span>
              ) : null}
            </div>
            <h1 className="portal-students-title">{page.title}</h1>
            <div className="portal-review-identity" aria-label="Submission details">
              <span className="portal-review-identity-item">
                <UserRound className="size-3.5" aria-hidden />
                <strong>{project.student?.name || "Student"}</strong>
              </span>
              {project.student?.email ? (
                <>
                  <span className="portal-review-identity-sep" aria-hidden>
                    ·
                  </span>
                  <span className="portal-review-identity-item">
                    <Mail className="size-3.5" aria-hidden />
                    {project.student.email}
                  </span>
                </>
              ) : null}
              <span className="portal-review-identity-sep" aria-hidden>
                ·
              </span>
              <span className="portal-review-identity-item is-project">
                <FileText className="size-3.5" aria-hidden />
                {project.title}
              </span>
              {!isAssignment ? (
                <>
                  <span className="portal-review-identity-sep" aria-hidden>
                    ·
                  </span>
                  <span className="portal-review-identity-item is-meta">
                    {words.toLocaleString()} words
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className="portal-review-command"
          role="toolbar"
          aria-label="Review actions"
        >
          <div className="portal-review-command-tools">
            {isAssignment && project.assignmentBrief ? (
              <button
                type="button"
                className="portal-review-action-tab"
                onClick={() => setBriefModalOpen(true)}
              >
                <ClipboardList className="size-3.5" />
                Brief
              </button>
            ) : null}
            {isAssignment && !project.assignmentBrief ? (
              <button
                type="button"
                className="portal-review-action-tab"
                onClick={() => setAttachModalOpen(true)}
              >
                <Paperclip className="size-3.5" />
                Attach brief
              </button>
            ) : null}
            <button
              type="button"
              className="portal-review-action-tab"
              onClick={() => setRemarkModalOpen(true)}
              title="Open student feedback"
            >
              <MessageSquare className="size-3.5" />
              Feedback
            </button>
            <button
              type="button"
              className="portal-review-action-tab"
              disabled={
                draftBusy ||
                (!hasContent &&
                  !annotatedHtml.trim() &&
                  !stripRemarkHtml(remark))
              }
              onClick={() => void saveReviewDraft()}
              title="Save annotations and feedback (does not save the mark)"
            >
              {draftBusy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              {draftBusy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="portal-review-action-tab"
              disabled={!aiSummary}
              onClick={() => setAiModalOpen(true)}
            >
              <Brain className="size-3.5" />
              {aiReportLabel}
            </button>
          </div>
          <button
            type="button"
            className="portal-review-action-tab is-primary"
            disabled={
              aiBusy ||
              !hasContent ||
              (isAssignment && !project.assignmentBrief)
            }
            title={
              isAssignment && !project.assignmentBrief
                ? "Attach an assignment brief before running AI review"
                : undefined
            }
            onClick={() => {
              if (isAssignment && !project.assignmentBrief) {
                setError(
                  "Attach a lecturer assignment brief before running AI review. AI grades against the brief.",
                );
                setAttachModalOpen(true);
                return;
              }
              void runAiSummary();
            }}
          >
            {aiBusy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <WandSparkles className="size-3.5" />
            )}
            {aiBusy ? "Analysing…" : aiReviewLabel}
          </button>
        </div>

        {isAssignment ? (
          <div className="portal-review-scorebar">
            <div className="portal-review-scorebar-top">
              <div className="portal-review-scorebar-main">
                <div className="portal-review-scorebar-mark">
                  <span>Score</span>
                  <div className="portal-review-scorebar-input">
                    <Input
                      type="number"
                      min={0}
                      max={maxScore}
                      step={1}
                      inputMode="numeric"
                      placeholder="0"
                      aria-label={`Manual score out of ${maxScore}`}
                      value={scoreInput}
                      onChange={(e) => setScoreInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void saveScore({ acceptAi: false });
                        }
                      }}
                    />
                    <span className="portal-review-scorebar-max">/{maxScore}</span>
                  </div>
                </div>
                <div className="portal-review-scorebar-actions">
                  <Button
                    variant="success"
                    disabled={scoreBusy || scoreInput.trim() === ""}
                    onClick={() => void saveScore({ acceptAi: false })}
                  >
                    {scoreBusy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    {scoreBusy ? "Saving…" : "Save mark"}
                  </Button>
                  {suggestedScore != null ? (
                    <Button
                      type="button"
                      variant="ai"
                      disabled={scoreBusy}
                      onClick={() => {
                        setScoreInput(String(suggestedScore));
                        if (
                          Array.isArray(aiSummary?.criterionScores) &&
                          aiSummary.criterionScores.length > 0
                        ) {
                          const nextInputs: Record<string, string> = {};
                          for (const c of aiSummary.criterionScores) {
                            nextInputs[c.name] = String(Math.round(c.score));
                          }
                          setCriterionInputs(nextInputs);
                        }
                        setMessage(
                          `AI suggestion ${suggestedScore}/${maxScore} filled in. Review and click Save mark to confirm.`,
                        );
                      }}
                    >
                      <Sparkles className="size-4" />
                      Use AI {suggestedScore}
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="portal-review-scorebar-meta">
                {typeof project.score === "number" ? (
                  <span className="portal-students-status is-ok">
                    Saved {project.score}/{maxScore}
                    {project.scoreSource === "ai_approved" ? " · AI" : ""}
                  </span>
                ) : (
                  <span className="portal-students-status is-mid">Not scored</span>
                )}
                {typeof project.assignmentBrief?.wordCountMin === "number" ? (
                  <span
                    className={cn(
                      "portal-students-status",
                      words >= project.assignmentBrief.wordCountMin
                        ? "is-ok"
                        : "is-risk",
                    )}
                    title={`Submission word count vs requirement (${words}/${project.assignmentBrief.wordCountMin} words)`}
                  >
                    {words >= project.assignmentBrief.wordCountMin
                      ? `Target met (${words.toLocaleString()}/${project.assignmentBrief.wordCountMin}w)`
                      : `Under min (${words.toLocaleString()}/${project.assignmentBrief.wordCountMin}w)`}
                  </span>
                ) : (
                  <span className="portal-students-status is-mid">
                    {words.toLocaleString()} words
                  </span>
                )}
                {project.assignmentBrief?.dueAt ? (() => {
                  const dueDate = new Date(project.assignmentBrief.dueAt);
                  const isValid = !Number.isNaN(dueDate.getTime());
                  if (!isValid) return null;
                  const isOverdue = dueDate.getTime() < Date.now();
                  return (
                    <span
                      className={cn(
                        "portal-students-status",
                        isOverdue ? "is-review" : "is-ok",
                      )}
                      title={`Due: ${dueDate.toLocaleString()}`}
                    >
                      Due {dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {isOverdue ? "Overdue" : "On time"}
                    </span>
                  );
                })() : null}
                {typeof project.aiGeneratedPercent === "number" ? (
                  <span
                    className={cn(
                      "portal-students-status",
                      project.aiGeneratedPercent >= 45 ? "is-review" : "is-mid",
                    )}
                  >
                    AI content {project.aiGeneratedPercent}%
                  </span>
                ) : null}
                {aiSummary?.assignmentStatus ? (
                  <span
                    className={cn(
                      "portal-students-status",
                      aiSummary.assignmentStatus === "FULL_MATCH"
                        ? "is-ok"
                        : aiSummary.assignmentStatus === "PARTIAL_MATCH"
                          ? "is-topic"
                          : "is-risk",
                    )}
                  >
                    {aiSummary.assignmentStatus.replace(/_/g, " ")}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </header>

      {error ? (
        <p className="portal-students-error portal-review-toast" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="portal-review-toast-dismiss"
            aria-label="Dismiss error"
            onClick={() => setError(null)}
          >
            <X className="size-4" />
          </button>
        </p>
      ) : null}
      {message ? (
        <p className="portal-review-ok portal-review-toast">
          <span>{message}</span>
          <button
            type="button"
            className="portal-review-toast-dismiss"
            aria-label="Dismiss message"
            onClick={() => setMessage(null)}
          >
            <X className="size-4" />
          </button>
        </p>
      ) : null}

      <div
        className={cn(
          "portal-review-body",
          isAssignment && "is-assignment-review",
        )}
      >
        <section className="portal-review-doc">
          <div className="portal-review-doc-head">
            <div>
              <h2>Submission</h2>
              <p>
                {words.toLocaleString()} {words === 1 ? "word" : "words"}
                {" · "}
                Select text to annotate. Headers and references are protected from over-marking.
              </p>
            </div>
          </div>

          {hasContent || annotatedHtml.trim() ? (
            <ReviewAnnotator
              key={`${page._id}-${latestTrailKey}`}
              contentKey={`${page._id}-${latestTrailKey}`}
              value={annotatedHtml || page.content || ""}
              onChange={setAnnotatedHtml}
              highlightToken={highlightToken}
              highlightQuotes={highlightQuotes}
              areaScores={areaScores}
              onSaveAnnotation={handleSaveAnnotation}
              footerMeta={{
                wordCount: words,
                lastSaved: page.reviewedAt || null,
                version: latestTrail?.versionNumber
                  ? `v${latestTrail.versionNumber}`
                  : "v1",
                authorName: project.student?.name || "Student",
              }}
            />
          ) : (
            <div className="portal-students-empty">
              <h2>No writing yet</h2>
              <p>This page has no content to review.</p>
            </div>
          )}
        </section>

        {!isAssignment ? (
          <aside className="portal-review-aside">
            <ReviewTrailPanel
              trail={page.reviewTrail}
              currentWordCount={words}
            />

            <section className="portal-review-card">
              <div className="portal-feedback-head">
                <div className="portal-feedback-head-copy">
                  <p className="portal-feedback-kicker">Review decision</p>
                  <h2>Decision</h2>
                  <p>Approve the page or request a rewrite.</p>
                </div>
              </div>

              <div className="portal-review-field portal-feedback-field">
                <span>Notes for the student</span>
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
                      Click to open the Word editor — tell the student what to
                      improve…
                    </span>
                  )}
                </button>
              </div>

              <div className="portal-feedback-meta">
                <span className="portal-feedback-words">
                  <strong>{remarkWords.toLocaleString()}</strong>{" "}
                  {remarkWords === 1 ? "word" : "words"}
                  {" · Required for rewrite"}
                </span>
                <em className="portal-feedback-hint">
                  Highlights are shared with the student.
                </em>
              </div>

              {aiSummary ? (
                <Button
                  type="button"
                  variant="ai"
                  size="sm"
                  onClick={insertAiIntoRemark}
                >
                  <Sparkles className="size-3.5" />
                  Send Feedback
                </Button>
              ) : null}

              <div className="portal-review-actions">
                <Button
                  variant="success"
                  disabled={busy}
                  onClick={() => setConfirmAction("approve")}
                >
                  <CircleCheck className="size-4" />
                  Approve
                </Button>
                <Button
                  variant="warning"
                  disabled={busy}
                  onClick={requestRewrite}
                >
                  <RotateCcw className="size-4" />
                  Request rewrite
                </Button>
              </div>
            </section>
          </aside>
        ) : null}
      </div>

      {/* Brief Modal */}
      <ReviewModal
        open={briefModalOpen}
        labelledBy="brief-modal-title"
        title={project.assignmentBrief?.title || "Assignment brief"}
        subtitle="Lecturer instructions, expected deliverables, and marking rubric."
        kicker="Lecturer Brief"
        icon={<ClipboardList className="size-5 text-sky-600" />}
        size="wide"
        onClose={() => setBriefModalOpen(false)}
        footer={
          <Button
            type="button"
            variant="success"
            onClick={() => setBriefModalOpen(false)}
          >
            <CircleCheck className="size-3.5" />
            Done
          </Button>
        }
      >
        {project.assignmentBrief ? (
          <AssignmentBriefPanel brief={project.assignmentBrief} />
        ) : (
          <p className="text-sm text-slate-500">No assignment brief attached.</p>
        )}
      </ReviewModal>

      {/* Attach Brief Modal */}
      <ReviewModal
        open={attachModalOpen}
        labelledBy="attach-modal-title"
        title="Attach assignment brief"
        subtitle="Select an existing assignment brief to grade this student against."
        kicker="Supervision"
        icon={<Paperclip className="size-5 text-amber-600" />}
        onClose={() => setAttachModalOpen(false)}
        footer={
          <>
            <Button
              type="button"
              variant="slate"
              onClick={() => setAttachModalOpen(false)}
            >
              <X className="size-3.5" />
              Cancel
            </Button>
            <Button
              variant="success"
              disabled={attachBusy || !attachBriefId}
              onClick={() => void attachBrief()}
            >
              {attachBusy ? "Attaching…" : "Attach brief"}
            </Button>
          </>
        }
      >
        <div className="portal-review-modal-form">
          <div className="portal-review-field">
            <span>Choose a brief</span>
            <Select
              value={attachBriefId}
              onChange={(e) => setAttachBriefId(e.target.value)}
            >
              <option value="">— Select an assignment brief —</option>
              {myBriefs.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.title} (Max {b.maxScore ?? 100} marks)
                </option>
              ))}
            </Select>
            <em>
              After attaching, run AI review again to grade against its rubric.
            </em>
          </div>
        </div>
      </ReviewModal>

      {/* AI Report Modal */}
      <ReviewModal
        open={aiModalOpen}
        labelledBy="ai-modal-title"
        title={aiReportLabel}
        subtitle={
          aiSummary?.model
            ? `Generated by ${aiSummary.model}`
            : "Review report for this submission"
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
          report={aiSummary}
          status={status.label}
          meta={`${page.title} · ${words.toLocaleString()} words`}
        />
      </ReviewModal>

      {/* Word-like Editor for Feedback */}
      <ReviewModal
        open={remarkModalOpen}
        labelledBy="remark-modal-title"
        title="Feedback for the student"
        subtitle="Write and format feedback in the full Word editor. Use headings, lists, and emphasis as needed."
        kicker="Word editor"
        icon={<PenLine className="size-5 text-indigo-600" />}
        size="editor"
        flushBody
        onClose={() => setRemarkModalOpen(false)}
        footerMeta={
          <span>
            <strong>{remarkWords.toLocaleString()}</strong>{" "}
            {remarkWords === 1 ? "word" : "words"}
            {aiSummary ? " · AI feedback can be sent below" : ""}
          </span>
        }
        footer={
          <>
            <Button
              type="button"
              variant="slate"
              onClick={() => setRemarkModalOpen(false)}
            >
              <X className="size-3.5" />
              Close
            </Button>
            {aiSummary ? (
              <Button
                type="button"
                variant="ai"
                onClick={insertAiIntoRemark}
              >
                <Sparkles className="size-3.5" />
                Send Feedback
              </Button>
            ) : null}
            <Button
              type="button"
              variant="success"
              onClick={() => {
                setRemarkModalOpen(false);
                setMessage("Feedback updated.");
              }}
            >
              <CircleCheck className="size-3.5" />
              Done editing
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
            placeholder="Write continuous feedback for the student — what was strong, what needs citation, and what must be revised before approval…"
          />
        </div>
      </ReviewModal>

      {/* Confirmation Modal for Approve / Rewrite / AI Mark */}
      <ConfirmModal
        open={Boolean(confirmAction)}
        title={confirmCopy.title}
        description={confirmCopy.description}
        confirmLabel={confirmCopy.confirmLabel}
        loadingLabel={confirmCopy.loadingLabel}
        variant={confirmCopy.variant}
        loading={confirmBusy}
        onConfirm={() => {
          if (confirmAction === "approve" || confirmAction === "needs_revision") {
            void submitReview(confirmAction);
          } else if (confirmAction === "accept_ai") {
            void saveScore({ acceptAi: true });
          }
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
