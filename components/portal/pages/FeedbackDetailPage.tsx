"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileText,
  PenLine,
  UserRound,
} from "lucide-react";
import { Avatar } from "@/components/portal/ui/avatar";
import { Button } from "@/components/portal/ui/button";
import { EmptyState } from "@/components/portal/feedback/empty-state";
import { LoadingPage } from "@/components/portal/feedback/loading-page";
import {
  buildSupervisorComments,
  editorHref,
  findCommentByKey,
  formatDate,
  formatRelative,
  type Chapter,
  type ProjectDetail,
  type SupervisorComment,
} from "@/components/portal/features/feedback/student-feedback";
import { apiFetch } from "@/lib/portal-api";
import { cn } from "@/lib/portal/cn";
import { RemarkHtml } from "@/components/portal/editor/remark-html";

function StatusChip({ status }: { status: "approved" | "needs_revision" }) {
  const approved = status === "approved";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        approved
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-800",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          approved ? "bg-emerald-500" : "bg-amber-500",
        )}
      />
      {approved ? "Approved" : "Needs revision"}
    </span>
  );
}

export default function StudentFeedbackDetailPage() {
  const params = useParams<{ projectId: string; itemKey: string }>();
  const projectId = params.projectId;
  const itemKey = decodeURIComponent(params.itemKey || "");

  const [comment, setComment] = useState<SupervisorComment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!projectId || !itemKey) {
        setError("Invalid feedback link");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const [detail, chapters] = await Promise.all([
          apiFetch(`/api/v1/projects/${projectId}`) as Promise<ProjectDetail>,
          apiFetch(`/api/v1/projects/${projectId}/chapters`).catch(
            () => [],
          ) as Promise<Chapter[]>,
        ]);
        if (cancelled) return;

        const comments = buildSupervisorComments(detail, chapters);
        const matched = findCommentByKey(comments, itemKey);
        if (!matched) {
          setComment(null);
          setError("This feedback item was not found or is no longer available.");
        } else {
          setComment(matched);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load feedback",
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
  }, [projectId, itemKey]);

  if (loading) return <LoadingPage label="Loading feedback…" />;

  if (!comment) {
    return (
      <div className="space-y-6">
        <Link
          href="/student/feedback"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/55 hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to feedback
        </Link>
        <EmptyState
          title="Feedback not found"
          description={
            error ||
            "This chapter remark may have been updated or removed. Return to the list and try again."
          }
          action="All feedback"
          href="/student/feedback"
        />
      </div>
    );
  }

  const approved = comment.status === "approved";
  const dateLabel = formatDate(comment.reviewedAt);
  const relative = formatRelative(comment.reviewedAt);
  const chapterLink = editorHref(comment);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            href="/student/feedback"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/55 hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to feedback
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-[2rem]">
              {comment.chapterTitle}
            </h1>
            <StatusChip status={comment.status} />
          </div>
          <p className="mt-2 text-[15px] text-foreground/60">
            {comment.projectTitle}
          </p>
        </div>
        <Link href={chapterLink} className="shrink-0">
          {approved ? (
            <Button variant="outline" className="w-full sm:w-auto">
              <PenLine className="size-4" />
              View chapter
            </Button>
          ) : (
            <Button className="w-full sm:w-auto">
              <PenLine className="size-4" />
              Revise chapter
            </Button>
          )}
        </Link>
      </div>

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="space-y-6 px-5 py-6 sm:px-7">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-foreground/55">
            {comment.supervisorName ? (
              <span className="inline-flex items-center gap-2">
                <Avatar
                  name={comment.supervisorName}
                  className="size-7 text-[10px]"
                />
                {comment.supervisorName}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="size-4 text-foreground/40" />
                Supervisor
              </span>
            )}
            {relative && (
              <span
                className="inline-flex items-center gap-1.5"
                title={dateLabel || undefined}
              >
                <Clock3 className="size-3.5" />
                {relative}
                {dateLabel ? ` · ${dateLabel}` : ""}
              </span>
            )}
            <Link
              href={`/student/projects/${comment.projectId}`}
              className="inline-flex items-center gap-1.5 text-primary hover:underline"
            >
              <FileText className="size-3.5" />
              Open project
            </Link>
          </div>

          {comment.remark ? (
            <section className="space-y-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-foreground/40">
                Supervisor remark
              </h2>
              <div className="rounded-lg border border-border bg-slate-50/80 px-4 py-4">
                <RemarkHtml html={comment.remark} />
              </div>
            </section>
          ) : (
            <p className="flex items-center gap-2 text-sm text-foreground/55">
              {approved ? (
                <>
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  Approved with no written remark.
                </>
              ) : (
                <>
                  <AlertCircle className="size-4 text-amber-600" />
                  Revision requested with no written remark.
                </>
              )}
            </p>
          )}

          {comment.annotatedHtml ? (
            <section className="space-y-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-foreground/40">
                Where to work — annotated corrections
              </h2>
              <div className="rounded-lg border border-border bg-white px-4 py-4">
                <div
                  className="review-highlight-content review-annotated-view prose prose-sm max-w-none text-foreground/80"
                  dangerouslySetInnerHTML={{
                    __html: comment.annotatedHtml,
                  }}
                />
                <p className="mt-3 text-[11px] text-foreground/45">
                  Yellow = Weaknesses · Orange = Needs citation
                </p>
              </div>
            </section>
          ) : null}

          <div className="flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-foreground/50">
              {approved
                ? "This chapter has been cleared by your supervisor."
                : "Update the chapter, then resubmit for review."}
            </p>
            <Link href={chapterLink}>
              {approved ? (
                <Button variant="outline" className="w-full sm:w-auto">
                  <PenLine className="size-4" />
                  View chapter
                </Button>
              ) : (
                <Button className="w-full sm:w-auto">
                  <PenLine className="size-4" />
                  Revise chapter
                </Button>
              )}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
