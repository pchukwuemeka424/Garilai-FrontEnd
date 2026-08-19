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
import { Eraser, Highlighter, Quote, Sparkles } from "lucide-react";
import { Button } from "@/components/portal/ui/button";
import { cn } from "@/lib/portal/cn";
import { toEditorHtml } from "@/components/portal/editor/document-editor";
import {
  applyHighlightsToEditor,
  mergeHighlightQuotes,
  pickFallbackHighlightQuotes,
  REVIEW_HIGHLIGHT_COLORS,
  REVIEW_HIGHLIGHT_LABELS,
  type AreaScores,
  type ReviewTextHighlights,
} from "@/lib/portal/apply-highlights";

type ReviewAnnotatorProps = {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  contentKey?: string | number;
  highlightToken?: number;
  highlightQuotes?: ReviewTextHighlights | null;
  areaScores?: AreaScores | null;
};

const COLOUR_KEY = [
  {
    kind: "weakness" as const,
    meaning: "Issue in argument, clarity, structure, or meeting the brief",
  },
  {
    kind: "citation" as const,
    meaning: "Claim or statement that needs an in-text citation",
  },
  {
    kind: "strength" as const,
    meaning: "Strong passage (optional — use when marking strengths)",
  },
];

export function ReviewAnnotator({
  value,
  onChange,
  className,
  contentKey = "default",
  highlightToken = 0,
  highlightQuotes = null,
  areaScores = null,
}: ReviewAnnotatorProps) {
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
      Highlight.configure({ multicolor: true }),
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
    const quotes =
      quotesRef.current &&
      ((quotesRef.current.weaknesses?.length || 0) +
        (quotesRef.current.citations?.length || 0) >
        0)
        ? quotesRef.current
        : pickFallbackHighlightQuotes(plain);

    const local = pickFallbackHighlightQuotes(plain);
    const merged = mergeHighlightQuotes(quotesRef.current || quotes, local);

    requestAnimationFrame(() => {
      if (editor.isDestroyed) return;
      const html = applyHighlightsToEditor(editor, merged);
      onChangeRef.current(html);
    });
  }, [editor, highlightToken]);

  if (!editor) {
    return (
      <div className="min-h-[28rem] animate-pulse bg-[#f8fafc]" />
    );
  }

  const activeEditor = editor;

  function applyHighlight(color: string) {
    activeEditor.chain().focus().toggleHighlight({ color }).run();
  }

  return (
    <div className={cn("portal-review-annotator", className)}>
      <ul className="portal-review-key">
        {COLOUR_KEY.map((item) => (
          <li key={item.kind} className="portal-review-key-item">
            <span
              className="portal-review-key-swatch"
              style={{ background: REVIEW_HIGHLIGHT_COLORS[item.kind] }}
              aria-hidden
            />
            <span>
              <strong>{REVIEW_HIGHLIGHT_LABELS[item.kind]}</strong>
              {item.meaning}
            </span>
          </li>
        ))}
      </ul>

      <div className="portal-review-tools">
        <span className="portal-review-tools-label">Annotate</span>
        <Button
          type="button"
          size="sm"
          variant={
            activeEditor.isActive("highlight", {
              color: REVIEW_HIGHLIGHT_COLORS.weakness,
            })
              ? "default"
              : "outline"
          }
          onClick={() => applyHighlight(REVIEW_HIGHLIGHT_COLORS.weakness)}
          title={REVIEW_HIGHLIGHT_LABELS.weakness}
        >
          <Highlighter className="size-3.5" />
          Weaknesses
        </Button>
        <Button
          type="button"
          size="sm"
          variant={
            activeEditor.isActive("highlight", {
              color: REVIEW_HIGHLIGHT_COLORS.citation,
            })
              ? "default"
              : "outline"
          }
          onClick={() => applyHighlight(REVIEW_HIGHLIGHT_COLORS.citation)}
          title={REVIEW_HIGHLIGHT_LABELS.citation}
        >
          <Quote className="size-3.5" />
          Needs citation
        </Button>
        <Button
          type="button"
          size="sm"
          variant={
            activeEditor.isActive("highlight", {
              color: REVIEW_HIGHLIGHT_COLORS.strength,
            })
              ? "default"
              : "outline"
          }
          onClick={() => applyHighlight(REVIEW_HIGHLIGHT_COLORS.strength)}
          title={REVIEW_HIGHLIGHT_LABELS.strength}
        >
          <Sparkles className="size-3.5" />
          Strength
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => activeEditor.chain().focus().unsetHighlight().run()}
          title="Clear highlight"
        >
          <Eraser className="size-3.5" />
          Clear
        </Button>
        <p className="portal-review-tools-hint">Select text to mark</p>
      </div>

      <div className="portal-review-editor">
        <EditorContent editor={activeEditor} />
      </div>

      {areaScores && (
        <div className="portal-review-scores">
          <span>
            Weakness severity{" "}
            <strong>{areaScores.weaknesses}/100</strong>
          </span>
          <span style={{ marginLeft: "auto" }}>
            Overall <strong>{areaScores.overall}/100</strong>
          </span>
        </div>
      )}
    </div>
  );
}
