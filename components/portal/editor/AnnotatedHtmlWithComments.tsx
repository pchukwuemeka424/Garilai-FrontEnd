"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/portal/cn";
import {
  collectMarginCommentsFromRoot,
  type MarginCommentCard,
} from "@/components/portal/editor/review-annotator";

type AnnotatedHtmlWithCommentsProps = {
  html: string;
  className?: string;
  bodyClassName?: string;
  legend?: string;
};

/**
 * Read-only annotated HTML with Google Docs–style right-margin comment cards.
 * Highlights stay inline; comments never enter the paragraph flow.
 */
export function AnnotatedHtmlWithComments({
  html,
  className,
  bodyClassName,
  legend,
}: AnnotatedHtmlWithCommentsProps) {
  const layoutRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [cards, setCards] = useState<MarginCommentCard[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    function refresh() {
      if (!layoutRef.current || !bodyRef.current) {
        setCards((prev) => (prev.length ? [] : prev));
        return;
      }
      const next = collectMarginCommentsFromRoot(
        bodyRef.current,
        layoutRef.current,
      );
      setCards((prev) => {
        if (
          prev.length === next.length &&
          prev.every(
            (card, i) =>
              card.id === next[i].id &&
              card.comment === next[i].comment &&
              Math.abs(card.top - next[i].top) < 0.5,
          )
        ) {
          return prev;
        }
        return next;
      });
    }

    refresh();
    const id = window.requestAnimationFrame(refresh);
    window.addEventListener("resize", refresh);
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("resize", refresh);
    };
  }, [html]);

  function focusCard(card: MarginCommentCard) {
    setActiveId(card.id);
    if (!bodyRef.current) return;
    const marks = Array.from(
      bodyRef.current.querySelectorAll<HTMLElement>("mark[data-comment]"),
    );
    const match = marks.find(
      (el) =>
        String(el.getAttribute("data-comment") || "").trim() === card.comment,
    );
    match?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const railMinHeight = Math.max(
    ...cards.map((c) => c.top + 78),
    cards.length ? 48 : 0,
  );

  return (
    <div ref={layoutRef} className={cn("annotated-html-with-comments", className)}>
      <div className="annotated-html-with-comments-body">
        <div
          ref={bodyRef}
          className={cn(
            "review-highlight-content review-annotated-view prose prose-sm max-w-none text-foreground/80",
            bodyClassName,
          )}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {legend ? (
          <p className="mt-3 text-[11px] text-foreground/45">{legend}</p>
        ) : null}
      </div>
      {cards.length > 0 ? (
        <aside
          className="annotated-html-with-comments-rail"
          style={{ minHeight: railMinHeight }}
          aria-label="Highlight comments"
        >
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              className={cn(
                "portal-review-comment-card",
                `is-${card.kind}`,
                activeId === card.id && "is-active",
              )}
              style={{ top: card.top }}
              onClick={() => focusCard(card)}
              title={card.quote ? `On: “${card.quote}”` : card.label}
            >
              <div className="portal-review-comment-card-head">
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ background: card.color }}
                />
                <strong>{card.label}</strong>
              </div>
              <p className="portal-review-comment-card-body">{card.comment}</p>
            </button>
          ))}
        </aside>
      ) : null}
    </div>
  );
}
