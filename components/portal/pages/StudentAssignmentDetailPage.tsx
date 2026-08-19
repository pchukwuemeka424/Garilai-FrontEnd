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
import {
  AssignmentBriefPanel,
  type AssignmentBriefView,
} from "@/components/portal/features/assignment/assignment-brief-panel";
import { apiFetch } from "@/lib/portal-api";
import { stripReviewMarks } from "@/lib/portal/apply-highlights";
import { cn } from "@/lib/portal/cn";
import { RemarkHtml } from "@/components/portal/editor/remark-html";

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

function primaryPage(pages: ProjectPage[] | undefined) {
  if (!Array.isArray(pages) || pages.length === 0) return null;
  return [...pages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0] ?? null;
}

function statusMeta(project: AssignmentProject) {
  if (typeof project.score === "number") {
    return { label: "Graded", variant: "success" as const };
  }
  const page = primaryPage(project.pages);
  if (page?.reviewStatus === "approved") {
    return { label: "Approved", variant: "success" as const };
  }
  if (page?.reviewStatus === "needs_revision") {
    return { label: "Needs revision", variant: "warning" as const };
  }
  if (page?.reviewStatus && page.reviewStatus !== "none") {
    return { label: "Submitted", variant: "default" as const };
  }
  if (String(page?.content || "").trim()) {
    return { label: "In progress", variant: "default" as const };
  }
  return { label: "Not started", variant: "neutral" as const };
}

function stripHtmlToText(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
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

  if (loading) return <LoadingPage label="Loading assignment…" />;

  if (error || !project) {
    return (
      <div className="space-y-4">
        <Link
          href="/student/assignments"
          className="inline-flex items-center gap-2 text-sm font-semibold text-foreground/55 hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          Back to assignments
        </Link>
        <EmptyState
          title="Assignment not found"
          description={error || "This assignment could not be loaded."}
          action="View assignments"
          href="/student/assignments"
        />
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

  return (
    <div className="space-y-5">
      <Link
        href="/student/assignments"
        className="inline-flex items-center gap-2 text-sm font-semibold text-foreground/55 hover:text-primary"
      >
        <ArrowLeft className="size-4" />
        Back to assignments
      </Link>

      <Card className="rounded-xl shadow-sm">
        <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-accent/10 text-accent">
                <ClipboardList className="size-4" />
              </span>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <CardTitle className="font-display text-2xl">
              {brief?.title || project.title}
            </CardTitle>
            <CardDescription className="space-y-1.5 text-sm">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1">
                  <UserRound className="size-3.5 text-primary" />
                  {project.supervisor?.name || "No lecturer assigned"}
                </span>
                {dueValid && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="size-3.5" />
                    Due{" "}
                    {dueAt!.toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                )}
              </span>
              {[brief?.courseName, brief?.courseYear]
                .filter(Boolean)
                .join(" · ") || project.topic || "Coursework assignment"}
            </CardDescription>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            {isGraded && (
              <p className="text-lg font-bold tabular-nums text-emerald-700">
                {project.score}
                <span className="text-sm font-semibold text-foreground/45">
                  /{maxScore}
                </span>
              </p>
            )}
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBriefModalOpen(true)}
              >
                <FileText className="size-4" />
                Assignment brief
              </Button>
              {isGraded ? (
                <Button
                  type="button"
                  onClick={() => setFeedbackModalOpen(true)}
                >
                  <MessageSquareText className="size-4" />
                  Feedback
                </Button>
              ) : (
                <Link href={writeHref}>
                  <Button>
                    <PenLine className="size-4" />
                    {hasSubmission ? "Continue writing" : "Open writing page"}
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PenLine className="size-4 text-primary" />
            Your submission
          </CardTitle>
          <CardDescription>
            {hasSubmission
              ? "The written work you uploaded or typed for this assignment."
              : "Nothing submitted yet — open the writing page to start."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasSubmission ? (
            <div
              className="document-editor-prose max-w-none rounded-xl border border-border bg-background px-4 py-4 text-foreground"
              dangerouslySetInnerHTML={{ __html: submissionHtml }}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
              <FileText className="mx-auto size-8 text-foreground/35" />
              <p className="mt-3 text-sm font-semibold text-foreground/80">
                No submission yet
              </p>
              <p className="mt-1 text-sm text-foreground/55">
                Write or upload your assignment to see it here.
              </p>
              {!isGraded ? (
                <Link href={writeHref} className="mt-4 inline-flex">
                  <Button size="sm">
                    <PenLine className="size-4" />
                    Open writing page
                  </Button>
                </Link>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {!isGraded ? (
        <div className="flex flex-wrap gap-3">
          <Link href={writeHref}>
            <Button variant="secondary">
              <PenLine className="size-4" />
              Work on this assignment
            </Button>
          </Link>
          <Link href={`/student/projects/${project._id}`}>
            <Button variant="ghost">Open project workspace</Button>
          </Link>
        </div>
      ) : null}

      {briefModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assignment-brief-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Close dialog"
            onClick={() => setBriefModalOpen(false)}
          />
          <div className="relative flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2
                id="assignment-brief-modal-title"
                className="text-sm font-bold text-foreground"
              >
                Assignment brief
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                aria-label="Close"
                onClick={() => setBriefModalOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {brief ? (
                <AssignmentBriefPanel
                  brief={brief}
                  hideHeader
                  className="border-0 shadow-none"
                />
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
                  <FileText className="mx-auto size-8 text-foreground/35" />
                  <p className="mt-3 text-sm font-semibold text-foreground/80">
                    No assignment brief attached
                  </p>
                  <p className="mt-1 text-sm text-foreground/55">
                    Your lecturer may still need to publish or attach one.
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end border-t border-border px-4 py-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBriefModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {feedbackModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assignment-feedback-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Close dialog"
            onClick={() => setFeedbackModalOpen(false)}
          />
          <div className="relative flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2
                id="assignment-feedback-modal-title"
                className="text-sm font-bold text-foreground"
              >
                Feedback
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                aria-label="Close"
                onClick={() => setFeedbackModalOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              {!hasFeedbackContent ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
                  <MessageSquareText className="mx-auto size-8 text-foreground/35" />
                  <p className="mt-3 text-sm font-semibold text-foreground/80">
                    No feedback yet
                  </p>
                  <p className="mt-1 text-sm text-foreground/55">
                    Lecturer comments and marks will appear here after grading.
                  </p>
                </div>
              ) : (
                <>
                  {isGraded ? (
                    <div className="rounded-xl border border-emerald-600/20 bg-emerald-50 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800/70">
                        Lecturer score
                      </p>
                      <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-800">
                        {project.score}
                        <span className="text-sm font-semibold text-emerald-700/70">
                          /{maxScore}
                        </span>
                      </p>
                      {scoreNote ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-900/80">
                          {scoreNote}
                        </p>
                      ) : null}
                      {criterionScores.length > 0 ? (
                        <ul className="mt-3 divide-y divide-emerald-600/15 rounded-lg border border-emerald-600/15 bg-white/60">
                          {criterionScores.map((row) => (
                            <li
                              key={row.name}
                              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                            >
                              <span className="text-emerald-950/80">
                                {row.name}
                              </span>
                              <span className="shrink-0 font-semibold text-emerald-900/70">
                                {row.score}/{row.maxMarks}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}

                  {feedbackRemark ? (
                    <div
                      className={cn(
                        "rounded-xl border px-4 py-3 text-sm",
                        page?.reviewStatus === "approved"
                          ? "border-success/30 bg-success/10"
                          : "border-amber-500/30 bg-amber-50",
                      )}
                    >
                      <p
                        className={cn(
                          "font-semibold",
                          page?.reviewStatus === "approved"
                            ? "text-success"
                            : "text-amber-950",
                        )}
                      >
                        Lecturer feedback
                      </p>
                      <RemarkHtml
                        html={feedbackRemark}
                        className="mt-2 text-sm text-foreground/80"
                      />
                    </div>
                  ) : isGraded && !scoreNote ? (
                    <p className="text-sm text-foreground/55">
                      No written remarks were left with this grade.
                    </p>
                  ) : null}
                </>
              )}
            </div>
            <div className="flex justify-end border-t border-border px-4 py-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFeedbackModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
