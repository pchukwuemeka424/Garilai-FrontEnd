"use client";

import { useEffect, useMemo, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
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
  Quote,
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
  type AreaScores,
  type ReviewTextHighlights,
} from "@/lib/portal/apply-highlights";

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
  footerMeta?: {
    wordCount?: number;
    lastSaved?: string | Date | null;
    version?: string | number | null;
    authorName?: string | null;
  };
};

export function ReviewAnnotator({
  value,
  onChange,
  className,
  contentKey = "default",
  highlightToken = 0,
  highlightQuotes = null,
  areaScores: _areaScores = null,
  footerMeta,
}: ReviewAnnotatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const quotesRef = useRef(highlightQuotes);
  quotesRef.current = highlightQuotes;
  const lastHighlightToken = useRef(0);

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

  if (!editor) {
    return (
      <div className="min-h-[28rem] animate-pulse bg-[#f8fafc]" />
    );
  }

  const activeEditor = editor;

  function applyHighlight(color: string) {
    activeEditor.chain().focus().toggleHighlight({ color }).run();
  }

  const activeHighlightColor = activeEditor.getAttributes("highlight")
    ?.color as string | undefined;

  const activeHighlightMeta = (() => {
    if (!activeHighlightColor) return null;
    const col = activeHighlightColor.toLowerCase();
    if (col === REVIEW_HIGHLIGHT_COLORS.weakness.toLowerCase()) {
      return {
        label: "Weakness",
        color: REVIEW_HIGHLIGHT_COLORS.weakness,
        desc: "Argument or requirement weakness",
      };
    }
    if (col === REVIEW_HIGHLIGHT_COLORS.citation.toLowerCase()) {
      return {
        label: "Needs citation",
        color: REVIEW_HIGHLIGHT_COLORS.citation,
        desc: "Uncited factual claim",
      };
    }
    if (col === REVIEW_HIGHLIGHT_COLORS.wrongClaim.toLowerCase()) {
      return {
        label: "Wrong claim",
        color: REVIEW_HIGHLIGHT_COLORS.wrongClaim,
        desc: "Inaccurate or overstated claim",
      };
    }
    if (col === REVIEW_HIGHLIGHT_COLORS.strength.toLowerCase()) {
      return {
        label: "Strength",
        color: REVIEW_HIGHLIGHT_COLORS.strength,
        desc: "Strong scholarly passage",
      };
    }
    return {
      label: "Custom Highlight",
      color: col,
      desc: "Annotated passage",
    };
  })();

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
          <TriangleAlert className="size-3.5" />
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
          <Quote className="size-3.5" />
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
          <CircleAlert className="size-3.5" />
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
          <BadgeCheck className="size-3.5" />
          Strength
        </button>
        <button
          type="button"
          className="portal-review-mark is-clear"
          onClick={() => activeEditor.chain().focus().unsetHighlight().run()}
          title="Clear highlight from selected text"
        >
          <Eraser className="size-3.5" />
          Clear
        </button>
        <p className="portal-review-tools-hint">Select text to annotate</p>
      </div>

      {activeHighlightMeta ? (
        <div className="portal-review-highlight-bar">
          <div className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full shrink-0"
              style={{ background: activeHighlightMeta.color }}
            />
            <span className="font-semibold text-slate-800 text-xs">
              {activeHighlightMeta.label}:
            </span>
            <span className="text-slate-500 text-xs">
              {activeHighlightMeta.desc}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              className="portal-review-mark is-weakness h-7 px-2 text-[11px]"
              onClick={() => applyHighlight(REVIEW_HIGHLIGHT_COLORS.weakness)}
            >
              <TriangleAlert className="size-3" />
              Weakness
            </button>
            <button
              type="button"
              className="portal-review-mark is-citation h-7 px-2 text-[11px]"
              onClick={() => applyHighlight(REVIEW_HIGHLIGHT_COLORS.citation)}
            >
              <Quote className="size-3" />
              Citation
            </button>
            <button
              type="button"
              className="portal-review-mark is-wrong h-7 px-2 text-[11px]"
              onClick={() => applyHighlight(REVIEW_HIGHLIGHT_COLORS.wrongClaim)}
            >
              <CircleAlert className="size-3" />
              Wrong claim
            </button>
            <button
              type="button"
              className="portal-review-mark is-strength h-7 px-2 text-[11px]"
              onClick={() => applyHighlight(REVIEW_HIGHLIGHT_COLORS.strength)}
            >
              <BadgeCheck className="size-3" />
              Strength
            </button>
            <button
              type="button"
              className="portal-review-mark is-clear h-7 px-2 text-[11px]"
              onClick={() => activeEditor.chain().focus().unsetHighlight().run()}
            >
              <Eraser className="size-3" />
              Remove
            </button>
          </div>
        </div>
      ) : null}

      <div className="portal-review-editor">
        <div className="portal-review-paper-sheet">
          <EditorContent editor={activeEditor} />

          {footerMeta ? (
            <div className="portal-review-paper-footer">
              {typeof footerMeta.wordCount === "number" ? (
                <div className="portal-review-paper-meta-item">
                  <FileText className="size-4 text-slate-400 shrink-0" />
                  <div>
                    <span>Word count</span>
                    <strong>{footerMeta.wordCount.toLocaleString()}</strong>
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
      </div>
    </div>
  );
}
