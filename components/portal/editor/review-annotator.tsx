"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { posToDOMRect } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import {
  Table,
  TableRow,
  TableCell,
  TableHeader,
} from "@tiptap/extension-table";
import {
  BadgeCheck,
  Calendar,
  CircleAlert,
  Eraser,
  FileText,
  GitBranch,
  MessageSquarePlus,
  Quote,
  Trash2,
  TriangleAlert,
  User,
} from "lucide-react";
import { cn } from "@/lib/portal/cn";
import { toEditorHtml } from "@/components/portal/editor/document-editor";
import {
  applyHighlightsToEditor,
  pickFallbackHighlightQuotes,
  reviewKindFromColor,
  REVIEW_HIGHLIGHT_COLORS,
  REVIEW_HIGHLIGHT_LABELS,
  type AreaScores,
  type ReviewHighlightKind,
  type ReviewTextHighlights,
} from "@/lib/portal/apply-highlights";

export type ReviewAnnotationSavePayload = {
  html: string;
  kind: ReviewHighlightKind;
  quote: string;
  comment: string;
  /** True when clearing a comment from a highlight (keep the mark). */
  removed?: boolean;
};

export type MarginCommentCard = {
  id: string;
  kind: ReviewHighlightKind;
  label: string;
  color: string;
  comment: string;
  top: number;
  quote: string;
};

const CARD_MIN_GAP = 10;
const CARD_EST_HEIGHT = 78;

const ReviewHighlight = Highlight.extend({
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("data-color") ||
          element.style.backgroundColor ||
          null,
        renderHTML: (attributes) => {
          if (!attributes.color) return {};
          const kind = reviewKindFromColor(attributes.color);
          return {
            "data-color": attributes.color,
            ...(kind ? { "data-review": kind } : {}),
            style: `background-color: ${attributes.color}; color: inherit`,
          };
        },
      },
      comment: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute("data-comment") ||
          element.getAttribute("title") ||
          null,
        renderHTML: (attributes) => {
          const comment = String(attributes.comment || "").trim();
          if (!comment) return {};
          return {
            "data-comment": comment,
            title: comment,
          };
        },
      },
    };
  },
});

type ReviewAnnotatorProps = {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  contentKey?: string | number;
  highlightToken?: number;
  highlightQuotes?: ReviewTextHighlights | null;
  areaScores?: AreaScores | null;
  onSaveAnnotation?: (
    payload: ReviewAnnotationSavePayload,
  ) => void | Promise<void>;
  footerMeta?: {
    wordCount?: number;
    lastSaved?: string | Date | null;
    version?: string | number | null;
    authorName?: string | null;
  };
};

function kindFromColor(color: string | undefined): ReviewHighlightKind | null {
  if (!color) return null;
  return reviewKindFromColor(color);
}

function metaForColor(color: string) {
  const col = color.toLowerCase();
  if (col === REVIEW_HIGHLIGHT_COLORS.weakness.toLowerCase()) {
    return {
      kind: "weakness" as const,
      label: "Weakness",
      color: REVIEW_HIGHLIGHT_COLORS.weakness,
      desc: "Argument or requirement weakness",
    };
  }
  if (col === REVIEW_HIGHLIGHT_COLORS.citation.toLowerCase()) {
    return {
      kind: "citation" as const,
      label: "Needs citation",
      color: REVIEW_HIGHLIGHT_COLORS.citation,
      desc: "Uncited factual claim",
    };
  }
  if (col === REVIEW_HIGHLIGHT_COLORS.wrongClaim.toLowerCase()) {
    return {
      kind: "wrongClaim" as const,
      label: "Wrong claim",
      color: REVIEW_HIGHLIGHT_COLORS.wrongClaim,
      desc: "Inaccurate or overstated claim",
    };
  }
  if (col === REVIEW_HIGHLIGHT_COLORS.strength.toLowerCase()) {
    return {
      kind: "strength" as const,
      label: "Strength",
      color: REVIEW_HIGHLIGHT_COLORS.strength,
      desc: "Strong scholarly passage",
    };
  }
  return null;
}

function stackCommentTops(
  items: Array<{ preferredTop: number } & MarginCommentCard>,
): MarginCommentCard[] {
  const sorted = [...items].sort((a, b) => a.preferredTop - b.preferredTop);
  let lastBottom = -Infinity;
  return sorted.map((item) => {
    const top = Math.max(item.preferredTop, lastBottom + CARD_MIN_GAP);
    lastBottom = top + CARD_EST_HEIGHT;
    const { preferredTop: _p, ...card } = item;
    return { ...card, top };
  });
}

/** Collect applied comments from DOM marks and place them in the right rail. */
export function collectMarginCommentsFromRoot(
  root: HTMLElement,
  relativeTo: HTMLElement,
): MarginCommentCard[] {
  const rootRect = relativeTo.getBoundingClientRect();
  const marks = Array.from(
    root.querySelectorAll<HTMLElement>("mark[data-comment]"),
  );
  const items: Array<{ preferredTop: number } & MarginCommentCard> = [];

  marks.forEach((el, index) => {
    const comment = String(el.getAttribute("data-comment") || "").trim();
    if (!comment) return;
    const color =
      el.getAttribute("data-color") ||
      el.style.backgroundColor ||
      REVIEW_HIGHLIGHT_COLORS.weakness;
    const kind =
      (el.getAttribute("data-review") as ReviewHighlightKind | null) ||
      reviewKindFromColor(color) ||
      "weakness";
    const rect = el.getBoundingClientRect();
    const preferredTop = Math.max(0, rect.top - rootRect.top);
    items.push({
      id: `c-${index}-${kind}-${comment.slice(0, 24)}`,
      kind,
      label: REVIEW_HIGHLIGHT_LABELS[kind],
      color: REVIEW_HIGHLIGHT_COLORS[kind],
      comment,
      quote: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160),
      preferredTop,
      top: preferredTop,
    });
  });

  return stackCommentTops(items);
}

function collectCommentsFromEditor(
  editor: Editor,
  relativeTo: HTMLElement,
): MarginCommentCard[] {
  return collectMarginCommentsFromRoot(editor.view.dom, relativeTo);
}

export function ReviewAnnotator({
  value,
  onChange,
  className,
  contentKey = "default",
  highlightToken = 0,
  highlightQuotes = null,
  areaScores: _areaScores = null,
  onSaveAnnotation,
  footerMeta,
}: ReviewAnnotatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const proseRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSaveAnnotationRef = useRef(onSaveAnnotation);
  onSaveAnnotationRef.current = onSaveAnnotation;
  const quotesRef = useRef(highlightQuotes);
  quotesRef.current = highlightQuotes;
  const lastHighlightToken = useRef(0);
  const [selectionTick, setSelectionTick] = useState(0);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [composeTop, setComposeTop] = useState<number | null>(null);
  const [railCards, setRailCards] = useState<MarginCommentCard[]>([]);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const lastSyncedCommentRef = useRef<string | null>(null);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      ReviewHighlight.configure({ multicolor: true }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: { class: "document-editor-image" },
      }),
      Table.configure({
        resizable: false,
        HTMLAttributes: { class: "document-editor-table" },
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    [],
  );

  const editor = useEditor(
    {
      extensions,
      content: toEditorHtml(value),
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: cn(
            "review-annotator-prose ProseMirror w-full max-w-none outline-none",
          ),
        },
      },
      onUpdate: ({ editor: ed }) => {
        onChangeRef.current(ed.getHTML());
      },
    },
    [contentKey],
  );

  useEffect(() => {
    if (!editor) return;
    let raf = 0;
    const bump = () => {
      // Coalesce TipTap events so we don't thrash React state every micro-transaction.
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        setSelectionTick((t) => t + 1);
      });
    };
    editor.on("selectionUpdate", bump);
    editor.on("update", bump);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      editor.off("selectionUpdate", bump);
      editor.off("update", bump);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const next = toEditorHtml(value);
    if (editor.getHTML() === next) return;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, contentKey]);

  useEffect(() => {
    if (!editor || highlightToken <= 0) return;
    if (lastHighlightToken.current === highlightToken) return;
    lastHighlightToken.current = highlightToken;

    const plain = editor.state.doc.textBetween(
      0,
      editor.state.doc.content.size,
      " ",
      " ",
    );

    const hasExplicitQuotes =
      quotesRef.current &&
      ((quotesRef.current.weaknesses?.length || 0) +
        (quotesRef.current.citations?.length || 0) +
        (quotesRef.current.wrongClaims?.length || 0) +
        (quotesRef.current.strengths?.length || 0) >
        0);

    const quotes = hasExplicitQuotes
      ? quotesRef.current!
      : pickFallbackHighlightQuotes(plain);

    requestAnimationFrame(() => {
      if (editor.isDestroyed) return;
      const html = applyHighlightsToEditor(editor, quotes);
      onChangeRef.current(html);
    });
  }, [editor, highlightToken]);

  useEffect(() => {
    function handleScroll(e: Event) {
      const custom = e as CustomEvent<{ title: string }>;
      const title = custom.detail?.title;
      if (!title || !containerRef.current) return;
      const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "");
      const headings = containerRef.current.querySelectorAll(
        "h1, h2, h3, h4, p, strong",
      );
      for (const el of Array.from(headings)) {
        const text = (el.textContent || "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
        if (
          text.length > 3 &&
          (text.includes(cleanTitle) || cleanTitle.includes(text))
        ) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-indigo-400", "rounded");
          setTimeout(() => {
            el.classList.remove("ring-2", "ring-indigo-400", "rounded");
          }, 2000);
          break;
        }
      }
    }
    window.addEventListener("portal-scroll-to-section", handleScroll);
    return () =>
      window.removeEventListener("portal-scroll-to-section", handleScroll);
  }, []);

  const activeHighlightAttrs = editor?.getAttributes("highlight") as
    | { color?: string; comment?: string | null }
    | undefined;
  const activeHighlightColor = activeHighlightAttrs?.color as
    | string
    | undefined;
  const activeMarkComment = String(activeHighlightAttrs?.comment || "").trim();
  const activeHighlightMeta = activeHighlightColor
    ? metaForColor(activeHighlightColor)
    : null;
  const showCompose = Boolean(activeHighlightMeta);
  const activeKind = activeHighlightMeta?.kind ?? null;

  useEffect(() => {
    if (!activeKind) {
      lastSyncedCommentRef.current = null;
      setCommentDraft((prev) => (prev ? "" : prev));
      return;
    }
    const key = `${activeKind}:${activeMarkComment}`;
    if (lastSyncedCommentRef.current === key) return;
    lastSyncedCommentRef.current = key;
    setCommentDraft(activeMarkComment);
  }, [activeKind, activeMarkComment]);

  // Sync margin cards + compose dock Y to the right rail.
  useEffect(() => {
    if (!editor || !layoutRef.current) {
      setRailCards((prev) => (prev.length ? [] : prev));
      setComposeTop((prev) => (prev == null ? prev : null));
      return;
    }

    function cardsEqual(a: MarginCommentCard[], b: MarginCommentCard[]) {
      if (a.length !== b.length) return false;
      return a.every(
        (card, i) =>
          card.id === b[i].id &&
          card.comment === b[i].comment &&
          Math.abs(card.top - b[i].top) < 0.5,
      );
    }

    function refreshRail() {
      if (!editor || editor.isDestroyed || !layoutRef.current) {
        setRailCards((prev) => (prev.length ? [] : prev));
        setComposeTop((prev) => (prev == null ? prev : null));
        return;
      }

      const nextCards = collectCommentsFromEditor(editor, layoutRef.current);
      setRailCards((prev) => (cardsEqual(prev, nextCards) ? prev : nextCards));

      if (!editor.isActive("highlight")) {
        setComposeTop((prev) => (prev == null ? prev : null));
        return;
      }

      const { from, to, empty } = editor.state.selection;
      let rangeFrom = from;
      let rangeTo = empty ? from + 1 : to;
      if (empty) {
        const markType = editor.schema.marks.highlight;
        const color = String(
          editor.getAttributes("highlight")?.color || "",
        ).toLowerCase();
        if (markType && color) {
          const $from = editor.state.selection.$from;
          let start = $from.pos;
          let end = $from.pos;
          editor.state.doc.nodesBetween(
            Math.max(0, $from.pos - 400),
            Math.min(editor.state.doc.content.size, $from.pos + 400),
            (node, pos) => {
              if (!node.isText) return;
              const has = node.marks.some(
                (m) =>
                  m.type === markType &&
                  String(m.attrs.color || "").toLowerCase() === color,
              );
              if (!has) return;
              const s = pos;
              const e = pos + node.nodeSize;
              if ($from.pos >= s && $from.pos <= e) {
                start = s;
                end = e;
              } else if (start < end) {
                if (s === end) end = e;
                if (e === start) start = s;
              }
            },
          );
          if (end > start) {
            rangeFrom = start;
            rangeTo = end;
          }
        }
      }

      const rect = posToDOMRect(
        editor.view,
        rangeFrom,
        Math.max(rangeFrom + 1, rangeTo),
      );
      const layoutRect = layoutRef.current.getBoundingClientRect();
      const nextTop = Math.max(0, rect.top - layoutRect.top);
      setComposeTop((prev) =>
        prev != null && Math.abs(prev - nextTop) < 0.5 ? prev : nextTop,
      );
    }

    refreshRail();
    const scrollParent =
      layoutRef.current.closest(".portal-review-editor") ||
      layoutRef.current.parentElement;
    scrollParent?.addEventListener("scroll", refreshRail, { passive: true });
    window.addEventListener("resize", refreshRail);
    return () => {
      scrollParent?.removeEventListener("scroll", refreshRail);
      window.removeEventListener("resize", refreshRail);
    };
  }, [editor, selectionTick, activeHighlightColor]);

  useEffect(() => {
    if (!showCompose) return;
    const id = window.setTimeout(() => {
      commentInputRef.current?.focus({ preventScroll: true });
    }, 40);
    return () => window.clearTimeout(id);
  }, [activeKind, activeHighlightColor, showCompose]);

  if (!editor) {
    return (
      <div className="min-h-[28rem] animate-pulse bg-[#f8fafc]" />
    );
  }

  const activeEditor = editor;

  function selectedQuote(): string {
    const { from, to } = activeEditor.state.selection;
    if (from === to) return "";
    return activeEditor.state.doc
      .textBetween(from, to, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 280);
  }

  function applyHighlight(color: string) {
    activeEditor
      .chain()
      .focus()
      .toggleHighlight({ color, comment: null })
      .run();
  }

  function clearHighlight() {
    activeEditor.chain().focus().unsetHighlight().run();
    setCommentDraft("");
    setComposeTop(null);
  }

  function findMarkElementForCard(card: MarginCommentCard): HTMLElement | null {
    if (!proseRef.current) return null;
    const marks = Array.from(
      proseRef.current.querySelectorAll<HTMLElement>("mark[data-comment]"),
    );
    return (
      marks.find((el) => {
        const comment = String(el.getAttribute("data-comment") || "").trim();
        const kind =
          (el.getAttribute("data-review") as ReviewHighlightKind | null) ||
          reviewKindFromColor(el.getAttribute("data-color"));
        return comment === card.comment && kind === card.kind;
      }) || null
    );
  }

  async function removeCommentFromMark(opts: {
    kind: ReviewHighlightKind;
    color: string;
    quote: string;
    previousComment: string;
    markEl?: HTMLElement | null;
  }) {
    const { kind, color, quote, previousComment, markEl } = opts;
    if (markEl) {
      const view = activeEditor.view;
      try {
        const from = view.posAtDOM(markEl, 0);
        const to = view.posAtDOM(markEl, markEl.childNodes.length);
        if (typeof from === "number" && typeof to === "number" && to > from) {
          activeEditor
            .chain()
            .focus()
            .setTextSelection({ from, to })
            .setHighlight({ color, comment: null })
            .run();
        } else {
          activeEditor
            .chain()
            .focus()
            .extendMarkRange("highlight")
            .setHighlight({ color, comment: null })
            .run();
        }
      } catch {
        activeEditor
          .chain()
          .focus()
          .extendMarkRange("highlight")
          .setHighlight({ color, comment: null })
          .run();
      }
    } else {
      activeEditor
        .chain()
        .focus()
        .extendMarkRange("highlight")
        .setHighlight({ color, comment: null })
        .run();
    }

    const html = activeEditor.getHTML();
    onChangeRef.current(html);
    setCommentDraft("");
    setComposeTop(null);
    setActiveCardId(null);

    if (layoutRef.current) {
      setRailCards(collectCommentsFromEditor(activeEditor, layoutRef.current));
    }

    if (!onSaveAnnotationRef.current) return;
    setCommentBusy(true);
    try {
      await onSaveAnnotationRef.current({
        html,
        kind,
        quote,
        comment: previousComment,
        removed: true,
      });
    } finally {
      setCommentBusy(false);
    }
  }

  async function undoCardComment(card: MarginCommentCard) {
    const markEl = findMarkElementForCard(card);
    await removeCommentFromMark({
      kind: card.kind,
      color: card.color,
      quote: card.quote,
      previousComment: card.comment,
      markEl,
    });
  }

  async function undoActiveComment() {
    const color = activeEditor.getAttributes("highlight")?.color as
      | string
      | undefined;
    const kind = kindFromColor(color);
    if (!kind || !color) return;
    const previous =
      commentDraft.trim() ||
      String(activeEditor.getAttributes("highlight")?.comment || "").trim();
    if (!previous) return;
    await removeCommentFromMark({
      kind,
      color,
      quote: selectedQuote(),
      previousComment: previous,
    });
  }

  async function applyComment() {
    const color = activeEditor.getAttributes("highlight")?.color as
      | string
      | undefined;
    const kind = kindFromColor(color);
    if (!kind || !color) return;

    const note = commentDraft.trim();
    if (!note) return;

    activeEditor
      .chain()
      .focus()
      .extendMarkRange("highlight")
      .setHighlight({ color, comment: note })
      .run();

    const html = activeEditor.getHTML();
    onChangeRef.current(html);

    const payload: ReviewAnnotationSavePayload = {
      html,
      kind,
      quote: selectedQuote(),
      comment: note,
    };

    const { to } = activeEditor.state.selection;
    activeEditor.commands.setTextSelection(to);
    setComposeTop(null);

    if (layoutRef.current) {
      setRailCards(collectCommentsFromEditor(activeEditor, layoutRef.current));
    }

    if (!onSaveAnnotationRef.current) return;
    setCommentBusy(true);
    try {
      await onSaveAnnotationRef.current(payload);
    } finally {
      setCommentBusy(false);
    }
  }

  function focusCard(card: MarginCommentCard) {
    setActiveCardId(card.id);
    const match = findMarkElementForCard(card);
    match?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (!match) return;
    try {
      const view = activeEditor.view;
      const from = view.posAtDOM(match, 0);
      const to = view.posAtDOM(match, match.childNodes.length);
      if (typeof from === "number" && typeof to === "number" && to > from) {
        activeEditor.chain().focus().setTextSelection({ from, to }).run();
      }
    } catch {
      // Ignore DOM mapping failures; scroll is enough.
    }
  }

  const railMinHeight = Math.max(
    ...railCards.map((c) => c.top + CARD_EST_HEIGHT),
    composeTop != null ? composeTop + 110 : 0,
    48,
  );

  return (
    <div
      ref={containerRef}
      className={cn("portal-review-annotator", className)}
    >
      <div className="portal-review-tools">
        <span className="portal-review-tools-label">Annotate</span>
        <button
          type="button"
          className={cn(
            "portal-review-mark is-weakness",
            activeEditor.isActive("highlight", {
              color: REVIEW_HIGHLIGHT_COLORS.weakness,
            }) && "is-active",
          )}
          onClick={() => applyHighlight(REVIEW_HIGHLIGHT_COLORS.weakness)}
          title="Highlight argument, clarity, or requirement weakness"
        >
          <TriangleAlert className="size-3" />
          Weakness
        </button>
        <button
          type="button"
          className={cn(
            "portal-review-mark is-citation",
            activeEditor.isActive("highlight", {
              color: REVIEW_HIGHLIGHT_COLORS.citation,
            }) && "is-active",
          )}
          onClick={() => applyHighlight(REVIEW_HIGHLIGHT_COLORS.citation)}
          title="Highlight statement needing in-text citation"
        >
          <Quote className="size-3" />
          Needs citation
        </button>
        <button
          type="button"
          className={cn(
            "portal-review-mark is-wrong",
            activeEditor.isActive("highlight", {
              color: REVIEW_HIGHLIGHT_COLORS.wrongClaim,
            }) && "is-active",
          )}
          onClick={() => applyHighlight(REVIEW_HIGHLIGHT_COLORS.wrongClaim)}
          title="Highlight inaccurate or contradictory claim"
        >
          <CircleAlert className="size-3" />
          Wrong claim
        </button>
        <button
          type="button"
          className={cn(
            "portal-review-mark is-strength",
            activeEditor.isActive("highlight", {
              color: REVIEW_HIGHLIGHT_COLORS.strength,
            }) && "is-active",
          )}
          onClick={() => applyHighlight(REVIEW_HIGHLIGHT_COLORS.strength)}
          title="Highlight strong academic passage"
        >
          <BadgeCheck className="size-3" />
          Strength
        </button>
        <button
          type="button"
          className="portal-review-mark is-clear"
          onClick={clearHighlight}
          title="Clear highlight from selected text"
        >
          <Eraser className="size-3" />
          Clear
        </button>
        <p className="portal-review-tools-hint">
          Select text to annotate — comments appear in the right margin
        </p>
      </div>

      <div className="portal-review-editor">
        <div className="portal-review-paper-sheet is-commentable">
          <div ref={layoutRef} className="portal-review-paper-with-rail">
            <div ref={proseRef} className="portal-review-paper-main">
              <EditorContent editor={activeEditor} />

              {footerMeta ? (
                <div className="portal-review-paper-footer">
                  {typeof footerMeta.wordCount === "number" ? (
                    <div className="portal-review-paper-meta-item">
                      <FileText className="size-4 text-slate-400 shrink-0" />
                      <div>
                        <span>Word count</span>
                        <strong>
                          {footerMeta.wordCount.toLocaleString()}
                        </strong>
                      </div>
                    </div>
                  ) : null}
                  {footerMeta.lastSaved ? (
                    <div className="portal-review-paper-meta-item">
                      <Calendar className="size-4 text-slate-400 shrink-0" />
                      <div>
                        <span>Last saved</span>
                        <strong>
                          {typeof footerMeta.lastSaved === "string" ||
                          footerMeta.lastSaved instanceof Date
                            ? new Date(footerMeta.lastSaved).toLocaleString(
                                undefined,
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                },
                              )
                            : "Recently"}
                        </strong>
                      </div>
                    </div>
                  ) : null}
                  {footerMeta.version ? (
                    <div className="portal-review-paper-meta-item">
                      <GitBranch className="size-4 text-slate-400 shrink-0" />
                      <div>
                        <span>Version</span>
                        <strong>{footerMeta.version}</strong>
                      </div>
                    </div>
                  ) : null}
                  {footerMeta.authorName ? (
                    <div className="portal-review-paper-meta-item">
                      <User className="size-4 text-slate-400 shrink-0" />
                      <div>
                        <span>Submitted by</span>
                        <strong>{footerMeta.authorName}</strong>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <aside
              ref={railRef}
              className="portal-review-comments-rail"
              style={{ minHeight: railMinHeight }}
              aria-label="Highlight comments"
            >
              {railCards.length === 0 && !showCompose ? (
                <p className="portal-review-comments-rail-empty">
                  Comments on highlights appear here, along the right margin.
                </p>
              ) : null}

              {railCards.map((card) => (
                <div
                  key={card.id}
                  className={cn(
                    "portal-review-comment-card",
                    `is-${card.kind}`,
                    activeCardId === card.id && "is-active",
                  )}
                  style={{ top: card.top }}
                >
                  <div className="portal-review-comment-card-head">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ background: card.color }}
                    />
                    <strong>{card.label}</strong>
                  </div>
                  <div className="portal-review-comment-card-row">
                    <button
                      type="button"
                      className="portal-review-comment-card-main"
                      onClick={() => focusCard(card)}
                      title={card.quote ? `On: “${card.quote}”` : card.label}
                    >
                      <p className="portal-review-comment-card-body">
                        {card.comment}
                      </p>
                    </button>
                    <button
                      type="button"
                      className="portal-review-comment-undo"
                      disabled={commentBusy}
                      onClick={(e) => {
                        e.stopPropagation();
                        void undoCardComment(card);
                      }}
                      title="Delete comment"
                      aria-label="Delete comment"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {showCompose && activeHighlightMeta && composeTop != null ? (
                <div
                  className="portal-review-rail-compose"
                  style={{
                    top: composeTop,
                    borderColor: activeHighlightMeta.color,
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="portal-review-rail-compose-head">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ background: activeHighlightMeta.color }}
                    />
                    <strong>{activeHighlightMeta.label}</strong>
                    <span>{activeHighlightMeta.desc}</span>
                  </div>
                  <div className="portal-review-rail-compose-row">
                    <input
                      ref={commentInputRef}
                      type="text"
                      className="portal-review-rail-compose-input"
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void applyComment();
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          activeEditor.commands.focus();
                        }
                      }}
                      placeholder="Write a margin comment…"
                      aria-label="Comment on highlighted text"
                      maxLength={500}
                      disabled={commentBusy}
                    />
                    <button
                      type="button"
                      className="portal-review-rail-compose-btn"
                      onClick={() => void applyComment()}
                      disabled={commentBusy || !commentDraft.trim()}
                      title="Apply comment"
                    >
                      <MessageSquarePlus className="size-3.5" />
                      {commentBusy ? "Saving…" : "Apply"}
                    </button>
                    {activeMarkComment ? (
                      <button
                        type="button"
                        className="portal-review-rail-compose-undo"
                        disabled={commentBusy}
                        onClick={() => void undoActiveComment()}
                        title="Delete comment from this highlight"
                        aria-label="Delete comment"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
