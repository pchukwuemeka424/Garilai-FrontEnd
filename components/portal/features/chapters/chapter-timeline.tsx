import { Check, Circle, MessageSquare, X } from "lucide-react";
import Link from "next/link";
import { ChapterStatusChip, type TimelineStatus } from "./chapter-status-chip";

export type TimelineChapter = {
  id?: string;
  title: string;
  status: TimelineStatus;
  due?: string;
  locked?: boolean;
  number?: number;
  /** Supervisor remarks count (shown under Rejected badge). */
  commentCount?: number;
  /** Optional link to open the page / remark. */
  href?: string;
};

export function ChapterTimeline({
  chapters,
  showComments = false,
}: {
  chapters: TimelineChapter[];
  showComments?: boolean;
}) {
  return (
    <ol className="space-y-0">
      {chapters.map((chapter, index) => (
        <li
          key={chapter.id || chapter.title}
          className="relative flex gap-3 py-3"
        >
          {index < chapters.length - 1 && (
            <span className="absolute left-[11px] top-[2.15rem] h-[calc(100%-0.65rem)] w-px bg-border" />
          )}
          <span
            className={`z-10 mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${
              chapter.status === "Approved"
                ? "bg-success text-white"
                : chapter.status === "Rejected"
                  ? "bg-danger text-white"
                  : chapter.status === "In progress" ||
                      chapter.status === "In review"
                    ? "border-2 border-primary/30 bg-primary/10 text-primary"
                    : "border-2 border-border bg-card text-foreground/35"
            }`}
          >
            {chapter.status === "Approved" ? (
              <Check className="size-3.5 stroke-[3]" />
            ) : chapter.status === "Rejected" ? (
              <X className="size-3.5 stroke-[3]" />
            ) : (
              <Circle className="size-2.5 fill-current" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                {chapter.href ? (
                  <Link
                    href={chapter.href}
                    className="text-sm font-semibold text-foreground hover:text-primary hover:underline"
                  >
                    {chapter.title}
                  </Link>
                ) : (
                  <p className="text-sm font-semibold text-foreground">
                    {chapter.title}
                  </p>
                )}
                {!showComments && chapter.due ? (
                  <p className="mt-1 text-xs text-foreground/55">{chapter.due}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <ChapterStatusChip status={chapter.status} />
                {showComments &&
                  chapter.status === "Rejected" &&
                  (chapter.commentCount ?? 0) > 0 && (
                    <p className="flex items-center gap-1.5 text-xs text-foreground/50">
                      <span>
                        {chapter.commentCount}{" "}
                        {chapter.commentCount === 1 ? "comment" : "comments"}
                      </span>
                      <MessageSquare className="size-3.5" />
                    </p>
                  )}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function mapChapterStatus(status: string): TimelineStatus {
  switch (status) {
    case "approved":
    case "locked":
      return "Approved";
    case "rejected":
    case "needs_revision":
      return "Rejected";
    case "submitted":
    case "under_review":
      return "In review";
    case "draft":
      return "In progress";
    default:
      return "Not started";
  }
}

/** Count supervisor remarks: one per non-empty line, or 1 if any text. */
export function countRemarkComments(remark?: string | null) {
  if (!remark?.trim()) return 0;
  const text = remark
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+\n/g, "\n")
    .trim();
  if (!text) return 0;
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return Math.max(lines.length, 1);
}
