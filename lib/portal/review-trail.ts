export type ReviewTrailType =
  | "submitted"
  | "rewrite_requested"
  | "approved";

export type ReviewTrailEvent = {
  _id?: string;
  type: ReviewTrailType;
  at: string;
  actorId?: string;
  remark?: string;
  contentHtml?: string;
  annotatedHtml?: string;
  versionNumber?: number;
  wordCount?: number;
};

export function sortTrailChronological(
  events: ReviewTrailEvent[] | undefined | null,
): ReviewTrailEvent[] {
  if (!Array.isArray(events) || events.length === 0) return [];
  return [...events].sort((a, b) => {
    const aTime = new Date(a.at).getTime();
    const bTime = new Date(b.at).getTime();
    return (Number.isNaN(aTime) ? 0 : aTime) - (Number.isNaN(bTime) ? 0 : bTime);
  });
}

export function latestTrailEvent(
  events: ReviewTrailEvent[] | undefined | null,
): ReviewTrailEvent | undefined {
  const sorted = sortTrailChronological(events);
  return sorted[sorted.length - 1];
}

/** True after the student resubmitted and before the next lecturer decision. */
export function isAwaitingNewReview(
  events: ReviewTrailEvent[] | undefined | null,
): boolean {
  return latestTrailEvent(events)?.type === "submitted";
}

export function trailDraftHtml(event: ReviewTrailEvent): string {
  return String(event.annotatedHtml || event.contentHtml || "").trim();
}

export function formatTrailDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function trailEventLabel(type: ReviewTrailType): string {
  if (type === "rewrite_requested") return "Rewrite requested";
  if (type === "approved") return "Approved";
  return "Student submitted";
}
