"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  ClipboardList,
  FileText,
  MessageSquareText,
  PenLine,
  UserRound,
  X,
} from "lucide-react";
import {
  AssignmentBriefPanel,
  type AssignmentBriefView,
} from "@/components/portal/features/assignment/assignment-brief-panel";
import { RemarkHtml } from "@/components/portal/editor/remark-html";
import { apiFetch } from "@/lib/portal-api";
import { stripReviewMarks } from "@/lib/portal/apply-highlights";
import { cn } from "@/lib/portal/cn";

type ProjectPage = {
  _id: string;
  title?: string;
  content?: string;
  order?: number;
  reviewStatus?: "none" | "approved" | "needs_revision" | string;
  reviewRemark?: string;
  reviewAnnotatedHtml?: string;
};

type CriterionScore = {
  name: string;
  score: number;
  maxMarks: number;
};

type AssignmentProject = {
  _id: string;
  title: string;
  projectType: string;
  topic?: string;
  score?: number | null;
  scoreNote?: string;
  criterionScores?: CriterionScore[];
  supervisor?: { id: string; name: string; email: string } | null;
  assignmentBrief?: AssignmentBriefView | null;
  pages?: ProjectPage[];
};

type StatusMeta = {
  label: string;
  tone: "graded" | "approved" | "revision" | "submitted" | "progress" | "idle";
};

function primaryPage(pages: ProjectPage[] | undefined) {
  if (!Array.isArray(pages) || pages.length === 0) return null;
  return [...pages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0] ?? null;
}

function statusMeta(project: AssignmentProject): StatusMeta {
  if (typeof project.score === "number") {
    return { label: "Graded", tone: "graded" };
  }
  const page = primaryPage(project.pages);
  if (page?.reviewStatus === "approved") {
    return { label: "Approved", tone: "approved" };
  }
  if (page?.reviewStatus === "needs_revision") {
    return { label: "Needs revision", tone: "revision" };
  }
  if (page?.reviewStatus && page.reviewStatus !== "none") {
    return { label: "Submitted", tone: "submitted" };
  }
  if (String(page?.content || "").trim()) {
    return { label: "In progress", tone: "progress" };
  }
  return { label: "Not started", tone: "idle" };
}

function stripHtmlToText(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatToday() {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

function formatDue(dueAt: Date) {
  return dueAt.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function StudentAssignmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const [project, setProject] = useState<AssignmentProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [briefModalOpen, setBriefModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [todayLabel, setTodayLabel] = useState("");

  useEffect(() => {
    setTodayLabel(formatToday());
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = (await apiFetch(
          `/api/v1/projects/${id}`,
        )) as AssignmentProject;
        if (cancelled) return;
        if (data.projectType !== "assignment") {
          router.replace(`/student/projects/${id}`);
          return;
        }
        setProject(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load assignment",
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
  }, [id, router]);

  useEffect(() => {
    if (!briefModalOpen && !feedbackModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setBriefModalOpen(false);
      setFeedbackModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [briefModalOpen, feedbackModalOpen]);

  const page = useMemo(
    () => primaryPage(project?.pages),
    [project?.pages],
  );

  if (loading) {
    return (
      <div className="stu-asnd" aria-busy="true">
        <header className="stu-asnd-intro">
          <div className="stu-asnd-intro-copy">
            <Link href="/student/assignments" className="stu-asnd-back">
              <ArrowLeft size={14} />
              Back to assignments
            </Link>
            <p className="stu-asnd-eyebrow">{todayLabel || "Assignment"}</p>
            <h1>Assignment</h1>
            <p>Loading brief, submission, and feedback...</p>
          </div>
        </header>
        <div className="stu-asnd-skeleton-strip" aria-hidden />
        <div className="stu-asnd-panel">
          <div className="stu-asnd-skeleton-block" aria-hidden />
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="stu-asnd">
        <header className="stu-asnd-intro">
          <div className="stu-asnd-intro-copy">
            <Link href="/student/assignments" className="stu-asnd-back">
              <ArrowLeft size={14} />
              Back to assignments
            </Link>
            <p className="stu-asnd-eyebrow">{todayLabel || "Assignment"}</p>
            <h1>Assignment not found</h1>
            <p>{error || "This assignment could not be loaded."}</p>
          </div>
        </header>
        <div className="stu-asnd-empty">
          <span className="stu-asnd-empty-icon" aria-hidden>
            <ClipboardList size={22} />
          </span>
          <h3>Unable to open this assignment</h3>
          <p>It may have been removed, or you may not have access.</p>
          <Link href="/student/assignments" className="stu-asnd-btn stu-asnd-btn-primary">
            View assignments
          </Link>
        </div>
      </div>
    );
  }

  const brief = project.assignmentBrief;
  const status = statusMeta(project);
  const isGraded = typeof project.score === "number";
  const maxScore =
    typeof brief?.maxScore === "number" ? brief.maxScore : 100;
  const dueAt = brief?.dueAt ? new Date(brief.dueAt) : null;
  const dueValid = dueAt && !Number.isNaN(dueAt.getTime());
  const writeHref = page
    ? `/student/projects/${project._id}/pages/${page._id}`
    : `/student/projects/${project._id}`;
  const feedbackRemark = page?.reviewRemark?.trim() || "";
  const scoreNote = project.scoreNote?.trim() || "";
  const criterionScores = Array.isArray(project.criterionScores)
    ? project.criterionScores
    : [];
  const hasFeedbackContent =
    isGraded || Boolean(feedbackRemark) || Boolean(scoreNote);
  // Always show clean submission text — no AI/review highlight marks.
  const submissionHtml = stripReviewMarks(
    page?.content?.trim() || page?.reviewAnnotatedHtml?.trim() || "",
  );
  const hasSubmission = Boolean(stripHtmlToText(submissionHtml));
  const title = brief?.title || project.title;
  const courseLine =
    [brief?.courseName, brief?.courseYear].filter(Boolean).join(" · ") ||
    project.topic ||
    "Coursework assignment";
  const lecturer = project.supervisor?.name || "No lecturer assigned";

  return (
    <div className="stu-asnd">
      <header className="stu-asnd-intro">
        <div className="stu-asnd-intro-copy">
          <Link href="/student/assignments" className="stu-asnd-back">
            <ArrowLeft size={14} />
            Back to assignments
          </Link>
          <p className="stu-asnd-eyebrow">{todayLabel || "Assignment"}</p>
          <h1>{title}</h1>
          <p>
            {courseLine.trim()}. Review the brief, continue your submission, and
            check feedback when it arrives.
          </p>
        </div>
        <div className="stu-asnd-intro-actions">
          {isGraded ? (
            <p className="stu-asnd-score-hero" aria-label="Score">
              <strong>{project.score}</strong>
              <span>/{maxScore}</span>
            </p>
          ) : null}
          <button
            type="button"
            className="stu-asnd-btn stu-asnd-btn-ghost"
            onClick={() => setBriefModalOpen(true)}
          >
            <FileText size={15} />
            Assignment brief
          </button>
          {isGraded ? (
            <button
              type="button"
              className="stu-asnd-btn stu-asnd-btn-primary"
              onClick={() => setFeedbackModalOpen(true)}
            >
              <MessageSquareText size={15} />
              Feedback
            </button>
          ) : (
            <Link href={writeHref} className="stu-asnd-btn stu-asnd-btn-primary">
              <PenLine size={15} />
              {hasSubmission ? "Continue writing" : "Open writing page"}
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </header>

      <section className="stu-asnd-metrics" aria-label="Assignment details">
        <div className="stu-asnd-metric">
          <span className="stu-asnd-metric-label">Status</span>
          <strong className="stu-asnd-metric-value">
            <span className={cn("stu-asnd-badge", `tone-${status.tone}`)}>
              {status.label}
            </span>
          </strong>
          <span className="stu-asnd-metric-hint">Current stage</span>
        </div>
        <div className="stu-asnd-metric">
          <span className="stu-asnd-metric-label">Lecturer</span>
          <strong className="stu-asnd-metric-value stu-asnd-metric-text">
            <UserRound size={14} aria-hidden />
            {lecturer}
          </strong>
          <span className="stu-asnd-metric-hint">Assigned supervisor</span>
        </div>
        <div className="stu-asnd-metric">
          <span className="stu-asnd-metric-label">Due</span>
          <strong className="stu-asnd-metric-value stu-asnd-metric-text">
            <Calendar size={14} aria-hidden />
            {dueValid ? formatDue(dueAt!) : "No due date"}
          </strong>
          <span className="stu-asnd-metric-hint">
            {typeof brief?.maxScore === "number"
              ? `${brief.maxScore} marks`
              : "Deadline"}
          </span>
        </div>
        <div className="stu-asnd-metric">
          <span className="stu-asnd-metric-label">Marks</span>
          <strong className="stu-asnd-metric-value">
            {isGraded ? (
              <>
                {project.score}
                <em>/{maxScore}</em>
              </>
            ) : (
              <>
                —
                <em>/{maxScore}</em>
              </>
            )}
          </strong>
          <span className="stu-asnd-metric-hint">
            {isGraded ? "Graded" : "Awaiting grade"}
          </span>
        </div>
      </section>

      <section className="stu-asnd-panel" aria-labelledby="stu-asnd-submission-heading">
        <div className="stu-asnd-panel-head">
          <div>
            <h2 id="stu-asnd-submission-heading">Your submission</h2>
            <p>
              {hasSubmission
                ? "The written work you uploaded or typed for this assignment."
                : "Nothing submitted yet — open the writing page to start."}
            </p>
          </div>
          {!isGraded ? (
            <Link href={writeHref} className="stu-asnd-btn stu-asnd-btn-ghost stu-asnd-btn-sm">
              <PenLine size={14} />
              {hasSubmission ? "Edit" : "Start"}
            </Link>
          ) : hasFeedbackContent ? (
            <button
              type="button"
              className="stu-asnd-btn stu-asnd-btn-ghost stu-asnd-btn-sm"
              onClick={() => setFeedbackModalOpen(true)}
            >
              <MessageSquareText size={14} />
              View feedback
            </button>
          ) : null}
        </div>

        <div className="stu-asnd-panel-body">
          {hasSubmission ? (
            <div
              className="document-editor-prose stu-asnd-prose"
              dangerouslySetInnerHTML={{ __html: submissionHtml }}
            />
          ) : (
            <div className="stu-asnd-empty stu-asnd-empty-inset">
              <span className="stu-asnd-empty-icon" aria-hidden>
                <FileText size={22} />
              </span>
              <h3>No submission yet</h3>
              <p>Write or upload your assignment to see it here.</p>
              {!isGraded ? (
                <Link href={writeHref} className="stu-asnd-btn stu-asnd-btn-primary">
                  <PenLine size={15} />
                  Open writing page
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </section>

      {!isGraded ? (
        <div className="stu-asnd-footer-actions">
          <Link href={writeHref} className="stu-asnd-btn stu-asnd-btn-primary">
            <PenLine size={15} />
            Work on this assignment
          </Link>
          <Link
            href={`/student/projects/${project._id}`}
            className="stu-asnd-btn stu-asnd-btn-ghost"
          >
            Open project workspace
          </Link>
        </div>
      ) : null}

      {briefModalOpen ? (
        <div
          className="stu-asnd-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assignment-brief-modal-title"
        >
          <button
            type="button"
            className="stu-asnd-modal-backdrop"
            aria-label="Close dialog"
            onClick={() => setBriefModalOpen(false)}
          />
          <div className="stu-asnd-modal-card">
            <div className="stu-asnd-modal-head">
              <h2 id="assignment-brief-modal-title">Assignment brief</h2>
              <button
                type="button"
                className="stu-asnd-btn stu-asnd-btn-ghost stu-asnd-btn-sm"
                aria-label="Close"
                onClick={() => setBriefModalOpen(false)}
              >
                <X size={14} />
              </button>
            </div>
            <div className="stu-asnd-modal-body">
              {brief ? (
                <AssignmentBriefPanel
                  brief={brief}
                  hideHeader
                  className="stu-asnd-brief-panel"
                />
              ) : (
                <div className="stu-asnd-empty stu-asnd-empty-inset">
                  <span className="stu-asnd-empty-icon" aria-hidden>
                    <FileText size={22} />
                  </span>
                  <h3>No assignment brief attached</h3>
                  <p>Your lecturer may still need to publish or attach one.</p>
                </div>
              )}
            </div>
            <div className="stu-asnd-modal-foot">
              <button
                type="button"
                className="stu-asnd-btn stu-asnd-btn-ghost"
                onClick={() => setBriefModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {feedbackModalOpen ? (
        <div
          className="stu-asnd-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assignment-feedback-modal-title"
        >
          <button
            type="button"
            className="stu-asnd-modal-backdrop"
            aria-label="Close dialog"
            onClick={() => setFeedbackModalOpen(false)}
          />
          <div className="stu-asnd-modal-card">
            <div className="stu-asnd-modal-head">
              <h2 id="assignment-feedback-modal-title">Feedback</h2>
              <button
                type="button"
                className="stu-asnd-btn stu-asnd-btn-ghost stu-asnd-btn-sm"
                aria-label="Close"
                onClick={() => setFeedbackModalOpen(false)}
              >
                <X size={14} />
              </button>
            </div>
            <div className="stu-asnd-modal-body stu-asnd-feedback">
              {!hasFeedbackContent ? (
                <div className="stu-asnd-empty stu-asnd-empty-inset">
                  <span className="stu-asnd-empty-icon" aria-hidden>
                    <MessageSquareText size={22} />
                  </span>
                  <h3>No feedback yet</h3>
                  <p>Lecturer comments and marks will appear here after grading.</p>
                </div>
              ) : (
                <>
                  {isGraded ? (
                    <div className="stu-asnd-score-card">
                      <p className="stu-asnd-score-card-label">Lecturer score</p>
                      <p className="stu-asnd-score-card-value">
                        {project.score}
                        <span>/{maxScore}</span>
                      </p>
                      {scoreNote ? (
                        <p className="stu-asnd-score-card-note">{scoreNote}</p>
                      ) : null}
                      {criterionScores.length > 0 ? (
                        <ul className="stu-asnd-criteria">
                          {criterionScores.map((row) => (
                            <li key={row.name}>
                              <span>{row.name}</span>
                              <strong>
                                {row.score}/{row.maxMarks}
                              </strong>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}

                  {feedbackRemark ? (
                    <div
                      className={cn(
                        "stu-asnd-remark",
                        page?.reviewStatus === "approved"
                          ? "is-approved"
                          : "is-revision",
                      )}
                    >
                      <p className="stu-asnd-remark-label">Lecturer feedback</p>
                      <RemarkHtml
                        html={feedbackRemark}
                        className="stu-asnd-remark-body"
                      />
                    </div>
                  ) : isGraded && !scoreNote ? (
                    <p className="stu-asnd-muted">
                      No written remarks were left with this grade.
                    </p>
                  ) : null}
                </>
              )}
            </div>
            <div className="stu-asnd-modal-foot">
              <button
                type="button"
                className="stu-asnd-btn stu-asnd-btn-ghost"
                onClick={() => setFeedbackModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
