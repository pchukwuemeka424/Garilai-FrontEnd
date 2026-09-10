"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Brain,
  CircleCheck,
  ClipboardList,
  Highlighter,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  PenLine,
  RotateCcw,
  Save,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/portal/ui/button";
import { Input } from "@/components/portal/ui/input";
import { Badge } from "@/components/portal/ui/badge";
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
  hasReviewHighlightQuotes,
  mergeHighlightQuotes,
  pickFallbackHighlightQuotes,
  quotesFromFactCheckClaims,
  type AreaScores,
  type ReviewTextHighlights,
} from "@/lib/portal/apply-highlights";
import {
  analyzeDocumentClaimsAndCitations,
  type FactCheckAuditReport,
} from "@/lib/portal/fact-check-citations";
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
  const [factCheckModalOpen, setFactCheckModalOpen] = useState(false);
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

        const scoreVal =
          typeof payload.project.score === "number"
            ? payload.project.score
            : typeof activeSnapshot?.aiSuggestedScore === "number"
              ? activeSnapshot.aiSuggestedScore
              : null;
        setScoreInput(scoreVal != null ? String(scoreVal) : "");

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
    factCheckModalOpen ||
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

  // Live fact-check and citation audit calculation
  const factCheckAudit: FactCheckAuditReport = useMemo(() => {
    if (aiSummary?.factCheckAudit) {
      return aiSummary.factCheckAudit;
    }
    const source = annotatedHtml || data?.page.content || "";
    return analyzeDocumentClaimsAndCitations(
      source,
      data?.project.topic || data?.project.title,
    );
  }, [aiSummary, annotatedHtml, data?.page.content, data?.project.topic, data?.project.title]);

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

      // Auto-prefill rubric criterion inputs and score input from AI review assessment
      const nextCriterionInputs: Record<string, string> = {};
      if (Array.isArray(summary.criterionScores) && summary.criterionScores.length > 0) {
        for (const c of summary.criterionScores) {
          nextCriterionInputs[c.name] = String(Math.round(c.score));
        }
        setCriterionInputs(nextCriterionInputs);
      }
      if (typeof summary.aiSuggestedScore === "number") {
        setScoreInput(String(summary.aiSuggestedScore));
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

      // Automatically persist all changes (score, criteria, remarks, and annotations)
      // to avoid repetitive clicking of the AI review assignment button.
      try {
        if (isAssignmentRun && typeof summary.aiSuggestedScore === "number") {
          const autoCriterionScores =
            Array.isArray(summary.criterionScores) && summary.criterionScores.length > 0
              ? summary.criterionScores.map((c) => ({
                  name: c.name,
                  score: Math.round(c.score),
                  maxMarks: c.maxMarks,
                }))
              : undefined;

          const savedPayload = (await apiFetch(
            `/api/v1/projects/${params.projectId}/score`,
            {
              method: "POST",
              body: JSON.stringify({
                acceptAiScore: true,
                remark: stripRemarkHtml(editorRemarks) ? editorRemarks : undefined,
                annotatedHtml: sourceHtml || undefined,
                ...(autoCriterionScores ? { criterionScores: autoCriterionScores } : {}),
              }),
            },
          )) as {
            score?: number | null;
            scoredAt?: string | null;
            scoreSource?: string;
            criterionScores?: CriterionScore[];
            assignmentBrief?: AssignmentBriefView | null;
          };

          const savedScore =
            typeof savedPayload.score === "number"
              ? savedPayload.score
              : summary.aiSuggestedScore;

          setData((prev) =>
            prev
              ? {
                  ...prev,
                  project: {
                    ...prev.project,
                    score: savedScore,
                    scoredAt: savedPayload.scoredAt ?? new Date().toISOString(),
                    scoreSource: savedPayload.scoreSource ?? "ai_approved",
                    criterionScores:
                      savedPayload.criterionScores ??
                      autoCriterionScores ??
                      prev.project.criterionScores,
                    assignmentBrief:
                      savedPayload.assignmentBrief ?? prev.project.assignmentBrief,
                  },
                }
              : prev,
          );
        } else if (editorRemarks || sourceHtml) {
          // For chapter research pages, auto-save the page review annotation and remark
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
        setMessage(
          summary.markingSkipped
            ? `Assignment out of scope. Auto-saved marks & remarks (${summary.aiSuggestedScore ?? "—"}/${summary.maxScore ?? 100}).`
            : `AI review completed & auto-saved! Scored ${summary.aiSuggestedScore ?? "—"}/${summary.maxScore ?? 100} with remarks and rubric breakdown.`,
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

  function insertFactCheckClaimsIntoRemark() {
    const flagged = factCheckAudit.claims.filter(
      (c) =>
        c.status === "needs_citation" ||
        c.status === "wrong_claim" ||
        c.status === "mismatched_citation" ||
        Boolean(c.suggestedAction),
    );
    if (flagged.length === 0) {
      setMessage("No uncited or flagged claims found in the fact-check audit.");
      return;
    }
    const bullets = flagged
      .map(
        (c) =>
          `<li><strong>“${c.sentence.slice(0, 120)}${c.sentence.length > 120 ? "…" : ""}”</strong> — ${c.explanation || ""}${c.suggestedAction ? ` (Action: ${c.suggestedAction})` : ""}</li>`,
      )
      .join("");
    const snippet = `<h3>Scholarly Integrity & Citation Issues</h3><ul>${bullets}</ul>`;
    setRemark((prev) => (prev ? `${prev}<br/><br/>${snippet}` : snippet));
    setMessage("Inserted citation and claim audit findings into remarks.");
    setFactCheckModalOpen(false);
    setRemarkModalOpen(true);
  }

  function autoAnnotateFactCheckClaims() {
    const quotes = quotesFromFactCheckClaims(factCheckAudit.claims);
    setHighlightQuotes(quotes);
    setHighlightToken((c) => c + 1);
    setMessage("Fact-check claim highlights applied to document editor.");
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
            "This confirms the student's work meets requirements. You can still leave remarks.",
          confirmLabel: "Approve submission",
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
            description: `Apply the suggested mark of ${suggestedScore ?? "—"}/${maxScore}. The student will be notified. You can still change this later.`,
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

      <header
        className={cn(
          "portal-students-hero",
          isAssignment && "is-scoring",
        )}
      >
        <div className="portal-review-hero-top">
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
            {!isAssignment ? (
              <div className="portal-review-meta">
                <span className={cn("portal-students-status", `is-${status.tone}`)}>
                  {status.label}
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
              </div>
            ) : null}
          </div>
          <div className="portal-students-hero-actions">
            {isAssignment && project.assignmentBrief ? (
              <Button
                type="button"
                variant="info"
                onClick={() => setBriefModalOpen(true)}
              >
                <ClipboardList className="size-4" />
                Brief
              </Button>
            ) : null}
            {isAssignment && !project.assignmentBrief ? (
              <Button
                type="button"
                variant="warning"
                onClick={() => setAttachModalOpen(true)}
              >
                <Paperclip className="size-4" />
                Attach brief
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ai"
              disabled={!aiSummary}
              onClick={() => setAiModalOpen(true)}
            >
              <Brain className="size-4" />
              {aiReportLabel}
            </Button>
            <Button
              variant="ai"
              disabled={aiBusy || !hasContent}
              onClick={() => void runAiSummary()}
            >
              {aiBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <WandSparkles className="size-4" />
              )}
              {aiBusy ? "Analysing…" : aiReviewLabel}
            </Button>
          </div>
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
                      onClick={() => void saveScore({ acceptAi: true })}
                    >
                      <Sparkles className="size-4" />
                      Apply AI {suggestedScore}
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
                <button
                  type="button"
                  onClick={() => setFactCheckModalOpen(true)}
                  className={cn(
                    "portal-students-status cursor-pointer hover:opacity-80 transition",
                    factCheckAudit.integrityScore >= 80
                      ? "is-ok"
                      : factCheckAudit.integrityScore >= 50
                        ? "is-topic"
                        : "is-risk",
                  )}
                  title="Click to view detailed citation and claim fact-check audit"
                >
                  Fact-Check {factCheckAudit.integrityScore}%
                </button>
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

      <div className="portal-review-body">
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
              key={`${page._id}-${latestTrailKey}`}
              contentKey={`${page._id}-${latestTrailKey}`}
              value={annotatedHtml || page.content || ""}
              onChange={setAnnotatedHtml}
              highlightToken={highlightToken}
              highlightQuotes={highlightQuotes}
              areaScores={areaScores}
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

        <aside className="portal-review-aside">
          {!isAssignment ? (
            <ReviewTrailPanel
              trail={page.reviewTrail}
              currentWordCount={words}
            />
          ) : null}

          <section className="portal-review-card">
              <button
                type="button"
                className="portal-review-card-head is-button"
                onClick={() => setRemarkModalOpen(true)}
              >
                <div>
                  <h2>{isAssignment ? "Remarks" : "Decision"}</h2>
                  <p>
                    {isAssignment
                      ? "Section notes on Strength, Weakness, Needs citation, and Wrong claim."
                      : "Approve the page or request a rewrite."}
                  </p>
                </div>
                <span className="portal-review-mark is-citation h-7 px-2.5 text-[11px]">
                  <PenLine className="size-3" />
                  Word editor
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
                      {isAssignment
                        ? "Run AI review assignment to prefill Strength, Weakness, Needs citation, and Wrong claim notes…"
                        : "Click to open the Word editor — tell the student what to improve…"}
                    </span>
                  )}
                </button>
                <em>
                  {remarkWords.toLocaleString()}{" "}
                  {remarkWords === 1 ? "word" : "words"}
                  {isAssignment
                    ? " · Sent with the mark. Yellow = Weakness · Orange = Needs citation · Red = Wrong claim · Green = Strength."
                    : " · Required when requesting a rewrite. Highlights are shared with the student."}
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
                  Insert AI remarks
                </Button>
              ) : null}
              {!isAssignment ? (
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
              ) : null}
            </section>

        </aside>
      </div>

      {/* Fact-Check and Citation Verification Modal */}
      <ReviewModal
        open={factCheckModalOpen}
        labelledBy="factcheck-modal-title"
        title="Fact-Check & Citation Audit"
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
              title="Append uncited and flagged claims to lecturer remarks"
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
                      <p className="font-mono text-xs text-slate-800 leading-snug">{ref.rawEntry}</p>
                      <p className="text-xs text-slate-500 mt-1">{ref.note}</p>
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

      {/* Word-like Editor for Remarks */}
      <ReviewModal
        open={remarkModalOpen}
        labelledBy="remark-modal-title"
        title="Remarks for the student"
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
            {aiSummary ? " · AI remarks can be inserted below" : ""}
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
                Insert AI remarks
              </Button>
            ) : null}
            <Button
              type="button"
              variant="success"
              onClick={() => {
                setRemarkModalOpen(false);
                setMessage("Remarks updated.");
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
