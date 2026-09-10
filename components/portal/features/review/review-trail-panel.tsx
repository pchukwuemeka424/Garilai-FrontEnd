"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Clock3,
  FileText,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/portal/ui/button";
import { RemarkHtml } from "@/components/portal/editor/remark-html";
import { stripRemarkHtml } from "@/lib/portal/remark-html";
import {
  formatTrailDate,
  isAwaitingNewReview,
  latestTrailEvent,
  sortTrailChronological,
  trailDraftHtml,
  trailEventLabel,
  type ReviewTrailEvent,
} from "@/lib/portal/review-trail";
import { cn } from "@/lib/portal/cn";

function eventKey(event: ReviewTrailEvent, index: number) {
  return event._id || `${event.type}-${event.at}-${index}`;
}

export function ReviewTrailPanel({
  trail,
  currentWordCount,
}: {
  trail: ReviewTrailEvent[] | undefined | null;
  currentWordCount?: number;
}) {
  const events = useMemo(() => sortTrailChronological(trail), [trail]);
  const latest = latestTrailEvent(events);
  const awaiting = isAwaitingNewReview(events);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [viewer, setViewer] = useState<ReviewTrailEvent | null>(null);

  if (events.length === 0) return null;

  const viewerHtml = viewer ? trailDraftHtml(viewer) : "";
  const viewerRemark = viewer ? stripRemarkHtml(viewer.remark || "") : "";

  return (
    <section className="portal-review-card">
      <div className="portal-review-card-head">
        <h2>Correction history</h2>
        <p>
          {events.length} {events.length === 1 ? "round" : "rounds"} with dates
        </p>
      </div>
      <ol className="portal-review-trail">
        {events.map((event, index) => {
          const key = eventKey(event, index);
          const expanded = openKey === key;
          const isCurrent = awaiting && latest === event && event.type === "submitted";
          const remarkPreview = stripRemarkHtml(event.remark || "");
          const draft = trailDraftHtml(event);
          const Icon =
            event.type === "approved"
              ? Check
              : event.type === "rewrite_requested"
                ? RotateCcw
                : Send;
          return (
            <li
              key={key}
              className={cn(
                "portal-review-trail-item",
                event.type === "approved" && "is-approved",
                event.type === "rewrite_requested" && "is-rewrite",
                event.type === "submitted" && "is-submitted",
                isCurrent && "is-current",
              )}
            >
              <span className="portal-review-trail-dot" aria-hidden="true">
                <Icon className="size-3" />
              </span>
              <div className="portal-review-trail-body">
                <button
                  type="button"
                  className="portal-review-trail-toggle"
                  aria-expanded={expanded}
                  onClick={() => setOpenKey(expanded ? null : key)}
                >
                  <span className="portal-review-trail-title">
                    {trailEventLabel(event.type)}
                    {isCurrent ? (
                      <em className="portal-review-trail-current">Current</em>
                    ) : null}
                    {typeof event.versionNumber === "number" ? (
                      <span className="portal-review-trail-ver">
                        v{event.versionNumber}
                      </span>
                    ) : null}
                  </span>
                  <span className="portal-review-trail-meta">
                    <Clock3 className="size-3" />
                    {formatTrailDate(event.at) || "Date unknown"}
                    {typeof event.wordCount === "number" && event.wordCount > 0
                      ? ` · ${event.wordCount.toLocaleString()} words`
                      : null}
                    <ChevronDown
                      className={cn(
                        "portal-review-trail-chevron size-3.5",
                        expanded && "is-open",
                      )}
                    />
                  </span>
                </button>
                {expanded ? (
                  <div className="portal-review-trail-detail">
                    {remarkPreview ? (
                      <RemarkHtml
                        html={event.remark || ""}
                        className="portal-review-trail-remark text-sm"
                      />
                    ) : event.type === "submitted" ? (
                      <p className="portal-review-hint">
                        Student correction captured for this round.
                      </p>
                    ) : (
                      <p className="portal-review-hint">No remarks on this round.</p>
                    )}
                    {draft ? (
                      <button
                        type="button"
                        className="portal-review-trail-view"
                        onClick={() => setViewer(event)}
                      >
                        <FileText className="size-3.5" />
                        View that draft
                      </button>
                    ) : (
                      <p className="portal-review-hint">
                        Earlier draft text is no longer stored for this round.
                      </p>
                    )}
                  </div>
                ) : remarkPreview && event.type === "rewrite_requested" ? (
                  <p className="portal-review-trail-snip">{remarkPreview}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="portal-review-hint">
        {awaiting
          ? `The document on the left is the current correction${
              typeof currentWordCount === "number"
                ? ` (${currentWordCount.toLocaleString()} words)`
                : ""
            }. Previous remarks stay in this trail.`
          : latest?.type === "rewrite_requested"
            ? "Waiting for the student to resubmit. Previous rounds stay listed above."
            : "Previous rewrite rounds stay listed here with their dates."}
      </p>

      {viewer ? (
        <div
          className="portal-review-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="trail-draft-title"
        >
          <div
            className="portal-review-modal-scrim"
            onClick={() => setViewer(null)}
            aria-hidden="true"
          />
          <div className="portal-review-modal-panel is-wide">
            <div className="portal-review-modal-head">
              <div className="portal-review-modal-head-main">
                <span className="portal-review-modal-icon">
                  <FileText className="size-5" />
                </span>
                <div>
                  <p className="portal-review-modal-kicker">Correction trail</p>
                  <h2 id="trail-draft-title">{trailEventLabel(viewer.type)}</h2>
                  <p className="portal-review-modal-sub">
                    {formatTrailDate(viewer.at)}
                    {typeof viewer.versionNumber === "number"
                      ? ` · v${viewer.versionNumber}`
                      : ""}
                    {typeof viewer.wordCount === "number" && viewer.wordCount > 0
                      ? ` · ${viewer.wordCount.toLocaleString()} words`
                      : ""}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="portal-review-modal-close"
                onClick={() => setViewer(null)}
                aria-label="Close draft"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="portal-review-modal-body">
              {viewerRemark ? (
                <div className="portal-review-trail-viewer-remark">
                  <p className="portal-review-trail-viewer-kicker">
                    Remarks from this round
                  </p>
                  <RemarkHtml html={viewer.remark || ""} />
                </div>
              ) : null}
              {viewerHtml ? (
                <div
                  className="review-highlight-content document-editor-prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: viewerHtml }}
                />
              ) : (
                <p className="portal-review-hint">No draft is stored for this round.</p>
              )}
            </div>
            <div className="portal-review-modal-foot">
              <div className="portal-review-modal-foot-actions">
                <Button
                  type="button"
                  variant="slate"
                  onClick={() => setViewer(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
