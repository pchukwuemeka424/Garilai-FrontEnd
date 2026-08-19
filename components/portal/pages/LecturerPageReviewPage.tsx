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
  Award,
  Bot,
  Check,
  FileText,
  Loader2,
  Paperclip,
  PenLine,
  RotateCcw,
  Sparkles,
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
  stripReviewMarks,
  type AreaScores,
  type ReviewTextHighlights,
} from "@/lib/portal/apply-highlights";
import { isSinglePageProjectType } from "@/lib/portal/project-types";
import { AssignmentBriefPanel } from "@/components/portal/features/assignment/assignment-brief-panel";
import type { AssignmentBriefView } from "@/components/portal/features/assignment/assignment-brief-panel";
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

function formatAiIntoRemark(summary: PageAiSummary) {
  if (summary.markingSkipped && summary.remarksSummary?.trim()) {
    return summary.remarksSummary.trim();
  }
  if (summary.markingSkipped && summary.assignmentGate?.reason?.trim()) {
    return summary.assignmentGate.reason.trim();
  }
  if (summary.reviewerReport?.trim()) {
    return summary.reviewerReport.trim();
  }
  if (summary.correctionSummary?.trim()) {
    return summary.correctionSummary.trim();
  }
  if (summary.remarksSummary?.trim()) {
    return summary.remarksSummary.trim();
  }
  const lines: string[] = [];
  if (summary.executiveSummary) {
    lines.push(summary.executiveSummary);
  }
  if (summary.supervisorRecommendation) {
    lines.push(summary.supervisorRecommendation);
  }
  return lines.join("\n\n");
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
  }, [open, escapeDisabled, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="portal-review-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <button
        type="button"
        className="portal-review-modal-scrim"
        aria-label="Close dialog"
        onClick={onClose}
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
              <span className="portal-review-modal-icon" aria-hidden>
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
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
  const [scoreInput, setScoreInput] = useState("");
  const [scoreNote, setScoreNote] = useState("");
  const [criterionInputs, setCriterionInputs] = useState<
    Record<string, string>
  >({});
  const [myBriefs, setMyBriefs] = useState<BriefOption[]>([]);
  const [attachBriefId, setAttachBriefId] = useState("");
  const [attachBusy, setAttachBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [briefModalOpen, setBriefModalOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [attachModalOpen, setAttachModalOpen] = useState(false);
  const [remarkModalOpen, setRemarkModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<PendingConfirm>(null);
  const [aiSummary, setAiSummary] = useState<PageAiSummary | null>(null);
  const [annotatorKey] = useState(0);
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
        setRemark(payload.page.reviewRemark || "");
        setScoreInput(
          typeof payload.project.score === "number"
            ? String(payload.project.score)
            : "",
        );
        setScoreNote(payload.project.scoreNote || "");
        const criteria = payload.project.assignmentBrief?.rubric || [];
        const existing = payload.project.criterionScores || [];
        const inputs: Record<string, string> = {};
        for (const row of criteria) {
          const found = existing.find((c) => c.name === row.name);
          inputs[row.name] =
            found && typeof found.score === "number" ? String(found.score) : "";
        }
        setCriterionInputs(inputs);
        // Show plain content on load — AI highlights apply only after "AI review".
        const initialHtml = stripReviewMarks(
          payload.page.reviewAnnotatedHtml || payload.page.content || "",
        );
        setAnnotatedHtml(initialHtml);

        const pageFindings = payload.page.aiCorrectionFindings;
        const pageSummary = payload.page.aiCorrectionSummary;
        const pageChecks = payload.page.aiCorrectionChecks;
        const snapshot = payload.project.aiReviewSnapshot as
          | (PageAiSummary & { pageId?: string })
          | null
          | undefined;
        const snapshotForPage =
          snapshot &&
          typeof snapshot === "object" &&
          String(snapshot.pageId || "") === String(payload.page._id)
            ? snapshot
            : null;

        const isAssignmentProject = isSinglePageProjectType(
          payload.project.projectType,
        );

        if (pageFindings?.length || pageSummary || pageChecks?.length) {
          const fromPage: PageAiSummary = {
            ...(snapshotForPage || {}),
            correctionFindings: pageFindings,
            correctionSummary: pageSummary,
            reviewerReport: pageSummary || snapshotForPage?.reviewerReport,
            // Do not restore Correction check UI
            correctionChecks: undefined,
            addressedCount: undefined,
            partialCount: undefined,
            outstandingCount: undefined,
            priorFindingsCount: undefined,
            remarksSummary: pageSummary || snapshotForPage?.remarksSummary,
            hideTopicAlignment: true,
            topicAlignment: undefined,
            projectTopic: undefined,
            highlightQuotes: undefined,
          };
          setAiSummary(fromPage);
          if (fromPage.areaScores) setAreaScores(fromPage.areaScores);
        } else if (snapshotForPage) {
          // Restore report UI from matching page snapshot only (no highlights).
          const cleaned: PageAiSummary = isAssignmentProject
            ? {
                ...snapshotForPage,
                hideTopicAlignment: false,
                correctionChecks: undefined,
                addressedCount: undefined,
                partialCount: undefined,
                outstandingCount: undefined,
                priorFindingsCount: undefined,
                highlightQuotes: undefined,
              }
            : {
                ...snapshotForPage,
                hideTopicAlignment: true,
                correctionChecks: undefined,
                addressedCount: undefined,
                partialCount: undefined,
                outstandingCount: undefined,
                priorFindingsCount: undefined,
                topicAlignment: undefined,
                projectTopic: undefined,
                highlightQuotes: undefined,
              };
          setAiSummary(cleaned);
          if (cleaned.areaScores) setAreaScores(cleaned.areaScores);
        }

        if (isAssignmentProject && !payload.project.assignmentBrief) {
          try {
            const list = (await apiFetch(
              "/api/v1/assignment-briefs",
            )) as BriefOption[];
            if (!cancelled) {
              setMyBriefs(list.filter((b) => b.status === "published"));
            }
          } catch {
            if (!cancelled) setMyBriefs([]);
          }
        } else if (!cancelled) {
          setMyBriefs([]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load page");
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
  }, [params.projectId, params.pageId]);

  const anyModalOpen =
    briefModalOpen ||
    aiModalOpen ||
    scoreModalOpen ||
    attachModalOpen ||
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

      const local = pickFallbackHighlightQuotes(plain);
      const quotes = mergeHighlightQuotes(summary.highlightQuotes, local);

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
      // Prefill lecturer remark with the overall AI remarks summary.
      const remarksBlock = formatAiIntoRemark(summary);
      if (remarksBlock.trim()) {
        setRemark(toEditorHtml(remarksBlock));
      }
      const isAssignmentRun = data
        ? isSinglePageProjectType(data.project.projectType)
        : false;
      if (isAssignmentRun) {
        setMessage(
          summary.markingSkipped
            ? `Assignment is out of scope. Marking stopped — remarks prefilled. Recommended mark ${summary.aiSuggestedScore ?? "—"}/${summary.maxScore ?? 100}.`
            : "AI review ready. Remarks prefilled. Open the report, then approve the mark or enter your own.",
        );
      } else {
        setMessage(
          "AI chapter review ready. Reviewer report and remarks prefilled.",
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
    const block = toEditorHtml(formatAiIntoRemark(aiSummary));
    setRemark((prev) => {
      if (!stripRemarkHtml(prev)) return block;
      return `${toEditorHtml(prev)}${block}`;
    });
    setMessage("AI remarks added to the Word editor.");
    setRemarkModalOpen(true);
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
    if (!acceptAi && rubric.length > 0) {
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
            scoreNote: scoreNote.trim() || undefined,
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
                scoreNote: updated.scoreNote ?? scoreNote.trim(),
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
      setScoreNote(updated.scoreNote ?? scoreNote.trim());
      setMessage(
        acceptAi
          ? `AI mark approved: ${savedScore}/${maxScore}. Student notified.`
          : `Manual score saved: ${savedScore}/${maxScore}. Student notified.`,
      );
      setConfirmAction(null);
      setScoreModalOpen(false);
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
    ? "AI review assignment"
    : "AI Review Chapter";
  const aiReportLabel = isAssignment
    ? "AI report"
    : "AI Review Chapter Report";
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
  const rubric = project.assignmentBrief?.rubric || [];
  const status = reviewStatus(page.reviewStatus);
  const pageList = [...(data.pages || [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
  const words = countWords(annotatedHtml || page.content || "");
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
          title: "Approve this submission?",
          description: `${project.student?.name || "The student"} will be notified that ${isAssignment ? "the assignment" : "this page"} is approved.${stripRemarkHtml(remark) ? " Your remarks and highlights will be shared." : ""}`,
          confirmLabel: "Approve and notify",
          loadingLabel: "Approving…",
          variant: "primary" as const,
        }
      : confirmAction === "needs_revision"
        ? {
            title: "Request a rewrite?",
            description:
              "Your remarks and highlights will be sent to the student. They will need to revise before this can be approved.",
            confirmLabel: "Request rewrite",
            loadingLabel: "Sending…",
            variant: "danger" as const,
          }
        : {
            title: "Approve the AI mark?",
            description: `Apply the suggested mark of ${suggestedScore ?? "—"}\/${maxScore}. The student will be notified. You can still change this later.`,
            confirmLabel: "Approve AI mark",
            loadingLabel: "Saving…",
            variant: "primary" as const,
          };

  return (
    <div className="portal-review">
      <Link href={backHref} className="portal-students-back">
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>

      <header className="portal-students-hero">
        <div className="min-w-0">
          <p className="portal-students-kicker">
            {isAssignment ? "Assignment review" : "Chapter review"}
          </p>
          <h1 className="portal-students-title">{page.title}</h1>
          <p className="portal-students-lead">
            {project.student?.name || "Student"}
            {project.student?.email ? ` · ${project.student.email}` : ""}
            {" · "}
            {project.title}
          </p>
          <div className="portal-review-meta">
            <span className={cn("portal-students-status", `is-${status.tone}`)}>
              {status.label}
            </span>
            {isAssignment && typeof project.score === "number" ? (
              <span className="portal-students-status is-ok">
                Score {project.score}/{maxScore}
                {project.scoreSource === "ai_approved" ? " · AI" : ""}
              </span>
            ) : isAssignment ? (
              <span className="portal-students-status is-mid">Not scored</span>
            ) : null}
            {isAssignment &&
            typeof project.aiGeneratedPercent === "number" ? (
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
        <div className="portal-students-hero-actions">
          {isAssignment && project.assignmentBrief ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setBriefModalOpen(true)}
            >
              <FileText className="size-4" />
              Brief
            </Button>
          ) : null}
          {isAssignment && !project.assignmentBrief ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setAttachModalOpen(true)}
            >
              <Paperclip className="size-4" />
              Attach brief
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={!aiSummary}
            onClick={() => setAiModalOpen(true)}
          >
            <Sparkles className="size-4" />
            {aiReportLabel}
          </Button>
          {isAssignment ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setScoreModalOpen(true)}
            >
              <Award className="size-4" />
              {typeof project.score === "number" ? "Update score" : "Set score"}
            </Button>
          ) : null}
          <Button
            disabled={aiBusy || !hasContent}
            onClick={() => void runAiSummary()}
          >
            {aiBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Bot className="size-4" />
            )}
            {aiBusy ? "Analysing…" : aiReviewLabel}
          </Button>
        </div>
      </header>

      {pageList.length > 1 ? (
        <nav className="portal-review-pages" aria-label="Project pages">
          {pageList.map((item, index) => (
            <Link
              key={item._id}
              href={`/supervision/projects/${project._id}/pages/${item._id}`}
              className={cn(
                "portal-review-page-link",
                item._id === page._id && "is-active",
              )}
            >
              {index + 1}. {item.title}
            </Link>
          ))}
        </nav>
      ) : null}

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

      <div className="portal-review-body">
        <section className="portal-review-doc">
          <div className="portal-review-doc-head">
            <div>
              <h2>Submission</h2>
              <p>
                {words.toLocaleString()} {words === 1 ? "word" : "words"}
                {" · "}
                Select text to highlight, then send a decision.
              </p>
            </div>
            {aiSummary ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setAiModalOpen(true)}
              >
                <Sparkles className="size-3.5" />
                View AI report
              </Button>
            ) : null}
          </div>
          {aiSummary ? (
            <div className="portal-review-ai-strip">
              <div className="min-w-0">
                <p className="portal-review-ai-strip-kicker">AI review ready</p>
                <p>
                  {aiSummary.markingSkipped
                    ? "Marking stopped — submission is out of scope."
                    : isAssignment
                      ? "Gatekeeper, marker, and moderator have finished."
                      : "Chapter review is ready for your decision."}
                  {suggestedScore != null
                    ? ` Recommended ${suggestedScore}/${maxScore}.`
                    : ""}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setAiModalOpen(true)}
              >
                Open report
              </Button>
            </div>
          ) : null}
          {hasContent || annotatedHtml.trim() ? (
            <ReviewAnnotator
              key={`${page._id}-${annotatorKey}`}
              contentKey={`${page._id}-${annotatorKey}`}
              value={annotatedHtml || page.content || ""}
              onChange={setAnnotatedHtml}
              highlightToken={highlightToken}
              highlightQuotes={highlightQuotes}
              areaScores={areaScores}
            />
          ) : (
            <div className="portal-students-empty">
              <h2>No writing yet</h2>
              <p>This page has no content to review.</p>
            </div>
          )}
        </section>

        <aside className="portal-review-aside">
          <section className="portal-review-card">
            <div className="portal-review-card-head">
              <h2>Snapshot</h2>
              <p>Status at a glance before you decide.</p>
            </div>
            <div className="portal-review-stat-grid">
              <div className="portal-review-stat">
                <span>Decision</span>
                <strong>{status.label}</strong>
              </div>
              {isAssignment ? (
                <div className="portal-review-stat">
                  <span>Score</span>
                  <strong>
                    {typeof project.score === "number"
                      ? `${project.score}/${maxScore}`
                      : "—"}
                  </strong>
                </div>
              ) : (
                <div className="portal-review-stat">
                  <span>Words</span>
                  <strong>{words.toLocaleString()}</strong>
                </div>
              )}
              <div className="portal-review-stat">
                <span>AI content</span>
                <strong>
                  {typeof project.aiGeneratedPercent === "number"
                    ? `${project.aiGeneratedPercent}%`
                    : "—"}
                </strong>
              </div>
            </div>
            {page.reviewedAt ? (
              <p className="portal-review-hint">
                Last reviewed {new Date(page.reviewedAt).toLocaleString()}
              </p>
            ) : (
              <p className="portal-review-hint">No decision recorded yet.</p>
            )}
          </section>

          <section className="portal-review-card">
            <button
              type="button"
              className="portal-review-card-head is-button"
              onClick={() => setRemarkModalOpen(true)}
            >
              <div>
                <h2>Decision</h2>
                <p>Approve the page or request a rewrite.</p>
              </div>
              <PenLine className="size-4 shrink-0 text-foreground/40" />
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
                    Click to open the Word editor — tell the student what to
                    improve…
                  </span>
                )}
              </button>
              <em>
                {remarkWords.toLocaleString()}{" "}
                {remarkWords === 1 ? "word" : "words"} · Required when
                requesting a rewrite. Highlights are shared with the student.
              </em>
            </div>
            {aiSummary ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={insertAiIntoRemark}
              >
                <Sparkles className="size-3.5" />
                Insert AI remarks
              </Button>
            ) : null}
            <div className="portal-review-actions">
              <Button
                disabled={busy}
                onClick={() => setConfirmAction("approve")}
              >
                <Check className="size-4" />
                Approve
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={requestRewrite}
              >
                <RotateCcw className="size-4" />
                Request rewrite
              </Button>
            </div>
          </section>

          {isAssignment ? (
            <section className="portal-review-card">
              <div className="portal-review-card-head">
                <h2>Score</h2>
                <p>
                  {typeof project.score === "number"
                    ? `Currently ${project.score}/${maxScore}${project.scoreSource === "ai_approved" ? " (AI mark)" : ""}.`
                    : `Enter a mark out of ${maxScore}.`}
                </p>
              </div>
              {suggestedScore != null ? (
                <div className="portal-review-verdict">
                  <p>AI verdict</p>
                  <div className="portal-review-verdict-row">
                    <div>
                      <span>Suggested</span>
                      <strong>
                        {suggestedScore}
                        <small>/{maxScore}</small>
                      </strong>
                    </div>
                    {typeof project.aiGeneratedPercent === "number" ? (
                      <div>
                        <span>AI content</span>
                        <strong>{project.aiGeneratedPercent}%</strong>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="portal-review-hint">
                  Run AI review to generate a suggested mark, or enter one
                  yourself.
                </p>
              )}
              <Button
                type="button"
                variant={typeof project.score === "number" ? "outline" : "default"}
                onClick={() => setScoreModalOpen(true)}
              >
                <Award className="size-4" />
                {typeof project.score === "number" ? "Update score" : "Set score"}
              </Button>
              {project.scoredAt ? (
                <p className="portal-review-hint">
                  Last scored {new Date(project.scoredAt).toLocaleString()}
                </p>
              ) : null}
            </section>
          ) : null}
        </aside>
      </div>

      <ReviewModal
        open={remarkModalOpen}
        title="Remarks for the student"
        kicker="Decision"
        subtitle={`${page.title} · ${project.student?.name || "Student"}`}
        icon={<PenLine className="size-4" />}
        labelledBy="remark-editor-modal-title"
        size="editor"
        flushBody
        escapeDisabled={Boolean(confirmAction)}
        onClose={() => setRemarkModalOpen(false)}
        footerMeta={
          <>
            <strong>
              {remarkWords.toLocaleString()}{" "}
              {remarkWords === 1 ? "word" : "words"}
            </strong>
            <span>Shared with the student after you decide. Required for rewrite.</span>
          </>
        }
        footer={
          <>
            {aiSummary ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={insertAiIntoRemark}
              >
                <Sparkles className="size-4" />
                Insert AI remarks
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={requestRewrite}
            >
              <RotateCcw className="size-4" />
              Request rewrite
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => setConfirmAction("approve")}
            >
              <Check className="size-4" />
              Approve
            </Button>
          </>
        }
      >
        <DocumentEditor
          value={remark}
          onChange={setRemark}
          placeholder="Write clear, specific feedback the student can act on…"
          fullWidth
          fillHeight
          className="portal-review-remark-editor"
        />
      </ReviewModal>

      <ReviewModal
        open={Boolean(isAssignment && project.assignmentBrief && briefModalOpen)}
        title="Assignment brief"
        kicker="Brief"
        subtitle={project.assignmentBrief?.title}
        icon={<FileText className="size-4" />}
        labelledBy="assignment-brief-modal-title"
        size="wide"
        escapeDisabled={Boolean(confirmAction)}
        onClose={() => setBriefModalOpen(false)}
        footer={
          <Button
            type="button"
            variant="outline"
            onClick={() => setBriefModalOpen(false)}
          >
            Close
          </Button>
        }
      >
        {project.assignmentBrief ? (
          <AssignmentBriefPanel
            brief={project.assignmentBrief}
            className="border-0 shadow-none"
            hideHeader
          />
        ) : null}
      </ReviewModal>

      <ReviewModal
        open={aiModalOpen && Boolean(aiSummary)}
        title="AI feedback report"
        kicker={isAssignment ? "Assignment review" : "Chapter review"}
        subtitle={
          aiSummary
            ? `${page.title} · ${aiSummary.model || "local"}${aiSummary.promptVersion ? ` · ${aiSummary.promptVersion}` : ""}`
            : undefined
        }
        icon={<Sparkles className="size-4" />}
        labelledBy="ai-report-modal-title"
        size="wide"
        escapeDisabled={Boolean(confirmAction)}
        onClose={() => setAiModalOpen(false)}
        footerMeta={
          <span>
            Read the report, then insert remarks or continue to a decision.
          </span>
        }
        footer={
          <>
            {aiSummary ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  insertAiIntoRemark();
                  setAiModalOpen(false);
                }}
              >
                <Sparkles className="size-4" />
                Insert into remarks
              </Button>
            ) : null}
            {isAssignment ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setAiModalOpen(false);
                  setScoreModalOpen(true);
                }}
              >
                <Award className="size-4" />
                Set score
              </Button>
            ) : null}
            <Button type="button" size="sm" onClick={() => setAiModalOpen(false)}>
              Done
            </Button>
          </>
        }
      >
        {aiSummary ? (
          <AIReportPanel
            report={{
              ...aiSummary,
              decisionLean: undefined,
              hideTopicAlignment: isAssignment
                ? false
                : aiSummary.hideTopicAlignment,
            }}
            status={
              isAssignment
                ? aiSummary.markingSkipped
                  ? "assignment gate — marking skipped"
                  : "assignment AI review"
                : "chapter AI review"
            }
            meta={`Model: ${aiSummary.model || "local"}${aiSummary.promptVersion ? ` · ${aiSummary.promptVersion}` : ""}`}
          />
        ) : null}
      </ReviewModal>

      <ReviewModal
        open={scoreModalOpen && isAssignment}
        title="Set score"
        kicker="Marking"
        subtitle={`Mark this assignment out of ${maxScore}.`}
        icon={<Award className="size-4" />}
        labelledBy="score-modal-title"
        size="narrow"
        escapeDisabled={Boolean(confirmAction)}
        onClose={() => setScoreModalOpen(false)}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={scoreBusy}
              onClick={() => setScoreModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={scoreBusy || scoreInput.trim() === ""}
              onClick={() => void saveScore()}
            >
              {scoreBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {typeof project.score === "number" ? "Update score" : "Save score"}
            </Button>
          </>
        }
      >
        {suggestedScore != null ||
        typeof project.aiGeneratedPercent === "number" ? (
          <div className="portal-review-verdict">
            <p>AI verdict</p>
            <div className="portal-review-verdict-row">
              {suggestedScore != null ? (
                <div>
                  <span>Suggested</span>
                  <strong>
                    {suggestedScore}
                    <small>/{maxScore}</small>
                  </strong>
                </div>
              ) : null}
              {typeof project.aiGeneratedPercent === "number" ? (
                <div>
                  <span>AI content</span>
                  <strong>{project.aiGeneratedPercent}%</strong>
                </div>
              ) : null}
            </div>
            {suggestedScore != null ? (
              <Button
                disabled={scoreBusy}
                onClick={() => setConfirmAction("accept_ai")}
              >
                <Check className="size-4" />
                Approve AI mark
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="portal-review-hint">
            Run AI review first if you want a suggested mark.
          </p>
        )}

        {rubric.length > 0 ? (
          <div className="portal-review-rubric">
            <p>Rubric</p>
            {rubric.map((row) => (
              <label key={row.name} className="portal-review-rubric-row">
                <span>
                  {row.name}
                  <small> / {row.maxMarks}</small>
                </span>
                <Input
                  className="w-20"
                  type="number"
                  min={0}
                  max={row.maxMarks}
                  step={1}
                  inputMode="numeric"
                  value={criterionInputs[row.name] ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCriterionInputs((prev) => {
                      const next = { ...prev, [row.name]: value };
                      const filled = rubric.every((r) => {
                        const raw = next[r.name];
                        return raw != null && String(raw).trim() !== "";
                      });
                      if (filled) {
                        const sum = rubric.reduce((s, r) => {
                          const n = Number(next[r.name]);
                          return s + (Number.isFinite(n) ? n : 0);
                        }, 0);
                        setScoreInput(String(sum));
                      }
                      return next;
                    });
                  }}
                  placeholder="0"
                  aria-label={`Score for ${row.name}`}
                />
              </label>
            ))}
          </div>
        ) : null}

        <div className="portal-review-score-row">
          <label className="portal-review-field">
            <span>Manual score</span>
            <Input
              type="number"
              min={0}
              max={maxScore}
              step={1}
              inputMode="numeric"
              value={scoreInput}
              onChange={(e) => setScoreInput(e.target.value)}
              placeholder={`0–${maxScore}`}
              aria-label={`Assignment score out of ${maxScore}`}
            />
          </label>
          <span className="portal-review-outof">/ {maxScore}</span>
        </div>

        <label className="portal-review-field">
          <span>Score note</span>
          <textarea
            value={scoreNote}
            onChange={(e) => setScoreNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Optional note about the mark…"
          />
        </label>
      </ReviewModal>

      <ReviewModal
        open={attachModalOpen && isAssignment && !project.assignmentBrief}
        title="Attach assignment brief"
        kicker="Brief"
        subtitle="Scoring will use the brief’s max marks and rubric."
        icon={<Paperclip className="size-4" />}
        labelledBy="attach-brief-modal-title"
        size="narrow"
        escapeDisabled={Boolean(confirmAction)}
        onClose={() => setAttachModalOpen(false)}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={attachBusy}
              onClick={() => setAttachModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={attachBusy || !attachBriefId}
              onClick={() => void attachBrief()}
            >
              {attachBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Attach brief
            </Button>
          </>
        }
      >
        <label className="portal-review-field">
          <span>Published brief</span>
          <Select
            value={attachBriefId}
            onChange={(e) => setAttachBriefId(e.target.value)}
            disabled={myBriefs.length === 0}
          >
            <option value="">
              {myBriefs.length === 0
                ? "No published briefs"
                : "Select brief…"}
            </option>
            {myBriefs.map((b) => (
              <option key={b._id} value={b._id}>
                {b.title}
                {typeof b.maxScore === "number"
                  ? ` (${b.maxScore} marks)`
                  : ""}
              </option>
            ))}
          </Select>
        </label>
      </ReviewModal>

      <ConfirmModal
        open={Boolean(confirmAction)}
        title={confirmCopy.title}
        description={confirmCopy.description}
        confirmLabel={confirmCopy.confirmLabel}
        loadingLabel={confirmCopy.loadingLabel}
        variant={confirmCopy.variant}
        loading={confirmBusy}
        onConfirm={() => {
          if (confirmAction === "accept_ai") {
            void saveScore({ acceptAi: true });
            return;
          }
          if (confirmAction === "approve" || confirmAction === "needs_revision") {
            void submitReview(confirmAction);
          }
        }}
        onCancel={() => {
          if (!confirmBusy) setConfirmAction(null);
        }}
      />
    </div>
  );
}
