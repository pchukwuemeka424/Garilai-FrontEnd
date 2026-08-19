"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import {
  Table,
  TableRow,
  TableCell,
  TableHeader,
} from "@tiptap/extension-table";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Redo2,
  SpellCheck,
  Strikethrough,
  Table as TableIcon,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/portal/cn";
import { repairGluedSpaces } from "@/lib/portal/repair-text";
import { normalizeEditorHtml } from "@/lib/portal/normalize-editor-html";
import { apiUpload } from "@/lib/portal-api";

type DocumentEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  /** Stretch the writing surface across the available width. */
  fullWidth?: boolean;
  /** Fill the parent height (modals / workspaces). */
  fillHeight?: boolean;
  /** When set, enables image insert via toolbar / paste / drag-drop. */
  projectId?: string;
};

const IMAGE_ACCEPT = "image/jpeg,image/png,image/gif,image/webp";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const EDITOR_PROSE_CLASS =
  "document-editor-prose w-full max-w-none min-h-[520px] outline-none focus:outline-none";

/** Convert legacy plain-text drafts into simple HTML paragraphs. */
export function toEditorHtml(value: string): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  // Already HTML — normalize alignment/width and repair glued text.
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return normalizeEditorHtml(trimmed);
  }
  const source = looksGlued(trimmed) ? repairGluedSpaces(trimmed) : trimmed;
  return normalizeEditorHtml(
    source
      .split(/\n{2,}/)
      .map((block) => `<p>${escapeHtml(block).replace(/\n/g, " ")}</p>`)
      .join(""),
  );
}

type HeadingLevel = 1 | 2 | 3;

/** Apply / clear a heading; lift out of lists first so toggle always works. */
function applyHeading(editor: Editor, level: HeadingLevel) {
  if (editor.isActive("heading", { level })) {
    return editor.chain().focus().setParagraph().run();
  }
  return editor.chain().focus().clearNodes().setHeading({ level }).run();
}

function looksGlued(text: string): boolean {
  const sample = text.replace(/\s+/g, " ").trim();
  if (sample.length < 40) return false;
  const spaces = (sample.match(/ /g) || []).length;
  // PDF/Word imports often lose spaces; catch sparse spacing early.
  return spaces / sample.length < 0.14 && /[a-z]{10,}/i.test(sample);
}

export function countWordsFromHtml(html: string): number {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return 0;
  return text.split(" ").filter(Boolean).length;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isAllowedImage(file: File) {
  return (
    IMAGE_ACCEPT.split(",").includes(file.type) &&
    file.size > 0 &&
    file.size <= MAX_IMAGE_BYTES
  );
}

function collectImageFiles(list: FileList | File[] | null | undefined): File[] {
  if (!list) return [];
  return Array.from(list).filter(isAllowedImage);
}

/**
 * Word-like document editor: ribbon toolbar + paper page surface.
 */
export function DocumentEditor({
  value,
  onChange,
  placeholder = "Start writing…",
  className,
  readOnly = false,
  fullWidth = false,
  fillHeight = false,
  projectId,
}: DocumentEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectIdRef = useRef(projectId);
  const readOnlyRef = useRef(readOnly);
  const placeholderRef = useRef(placeholder);
  const editorRef = useRef<Editor | null>(null);
  const skipContentSyncRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const initialContentRef = useRef(toEditorHtml(value));
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  projectIdRef.current = projectId;
  readOnlyRef.current = readOnly;
  placeholderRef.current = placeholder;
  onChangeRef.current = onChange;

  const uploadAndInsert = useCallback(async (editor: Editor, files: File[]) => {
    const id = projectIdRef.current;
    if (!id || readOnlyRef.current || files.length === 0) return;

    setImageError(null);
    setUploading(true);
    try {
      for (const file of files) {
        if (!isAllowedImage(file)) {
          setImageError("Use a JPEG, PNG, GIF, or WebP under 5 MB");
          continue;
        }
        const formData = new FormData();
        formData.append("file", file);
        const data = (await apiUpload(
          `/api/v1/projects/${id}/images`,
          formData,
        )) as { url: string };
        if (!data?.url) throw new Error("Upload did not return a URL");
        editor
          .chain()
          .focus()
          .setImage({ src: data.url, alt: file.name.replace(/\.[^.]+$/, "") })
          .run();
      }
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  // TipTap compares extension/editorProps by reference on every render when
  // useEditor deps are []. Recreating them each render calls setOptions →
  // updateState and fights keystrokes (editor appears non-editable).
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
          HTMLAttributes: {
            class: "document-editor-heading",
          },
        },
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        // New paragraphs / nodes default to justify; CSS also justifies
        // prose without an explicit align so existing drafts look correct.
        // Heading CSS forces left-align for title appearance.
        defaultAlignment: "justify",
      }),
      Placeholder.configure({
        placeholder: () => placeholderRef.current,
      }),
      Image.configure({
        // S3/MinIO returns object URLs; local fallback still uses data URLs.
        allowBase64: true,
        HTMLAttributes: {
          class: "document-editor-image",
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: "document-editor-table",
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    [],
  );

  const editorProps = useMemo(
    () => ({
      attributes: {
        class: EDITOR_PROSE_CLASS,
        spellcheck: "true",
        lang: "en",
      },
      handleKeyDown: () => {
        // Block all typing / shortcuts while the chapter is locked for review.
        return readOnlyRef.current;
      },
      handlePaste: (_view: unknown, event: ClipboardEvent) => {
        if (readOnlyRef.current) {
          event.preventDefault();
          return true;
        }
        if (!projectIdRef.current) return false;
        const ed = editorRef.current;
        if (!ed) return false;
        const files = collectImageFiles(event.clipboardData?.files);
        const items = event.clipboardData?.items;
        const fromItems: File[] = [];
        if (items) {
          for (const item of Array.from(items)) {
            if (item.kind === "file" && item.type.startsWith("image/")) {
              const f = item.getAsFile();
              if (f && isAllowedImage(f)) fromItems.push(f);
            }
          }
        }
        const images = files.length ? files : fromItems;
        if (!images.length) return false;
        event.preventDefault();
        void uploadAndInsert(ed, images);
        return true;
      },
      handleDrop: (
        _view: unknown,
        event: DragEvent,
        _slice: unknown,
        moved: boolean,
      ) => {
        if (readOnlyRef.current) {
          event.preventDefault();
          return true;
        }
        if (moved || !projectIdRef.current) {
          return false;
        }
        const ed = editorRef.current;
        if (!ed) return false;
        const images = collectImageFiles(event.dataTransfer?.files);
        if (!images.length) return false;
        event.preventDefault();
        void uploadAndInsert(ed, images);
        return true;
      },
      handleTextInput: () => readOnlyRef.current,
    }),
    [uploadAndInsert],
  );

  const editor = useEditor({
    immediatelyRender: false,
    // Needed so toolbar active states (headings, marks) update while typing.
    shouldRerenderOnTransaction: true,
    editable: !readOnly,
    extensions,
    // Initial content only — live value sync is handled below.
    content: initialContentRef.current,
    editorProps,
    onUpdate: ({ editor: ed }) => {
      if (readOnlyRef.current) return;
      skipContentSyncRef.current = true;
      onChangeRef.current(ed.getHTML());
    },
  });

  editorRef.current = editor;

  // Sync only for external value changes (page load / reset), never our own onUpdate.
  useEffect(() => {
    if (!editor) return;
    if (skipContentSyncRef.current) {
      skipContentSyncRef.current = false;
      return;
    }
    const next = toEditorHtml(value);
    const current = editor.getHTML();
    if (normalizeHtml(current) !== normalizeHtml(next)) {
      editor.commands.setContent(next || "<p></p>", { emitUpdate: false });
      // Force justify on all block nodes after import/load.
      queueMicrotask(() => {
        if (editor.isDestroyed) return;
        const { state } = editor;
        const { tr } = state;
        let modified = false;
        state.doc.descendants((node, pos) => {
          if (!node.isTextblock) return;
          if (node.type.name === "heading") return;
          const align = node.attrs.textAlign;
          if (align !== "justify") {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              textAlign: "justify",
            });
            modified = true;
          }
        });
        if (modified) editor.view.dispatch(tr);
      });
    }
  }, [value, editor]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(!readOnly);
    // TipTap sometimes keeps contenteditable=true until the DOM attr is forced.
    const dom = editor.view.dom as HTMLElement;
    dom.setAttribute("contenteditable", readOnly ? "false" : "true");
    dom.setAttribute("aria-readonly", readOnly ? "true" : "false");
  }, [editor, readOnly]);

  if (!editor) {
    return (
      <div
        className={cn(
          "min-h-[560px] rounded-xl border border-border bg-[#f3f3f3]",
          fillHeight && "min-h-0 flex-1",
          className,
        )}
      />
    );
  }

  const imagesEnabled = Boolean(projectId) && !readOnly;
  const wordCount = countWordsFromHtml(editor.getHTML());

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-[#f3f3f3] shadow-sm",
        fillHeight && "flex min-h-0 flex-1 flex-col",
        readOnly && "opacity-80",
        className,
      )}
    >
      {!readOnly && (
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-[#fafafa] px-2 py-1.5">
        <ToolbarButton
          label="Undo"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          <Undo2 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Redo"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          <Redo2 className="size-3.5" />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          label="Heading 1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => applyHeading(editor, 1)}
        >
          <Heading1 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => applyHeading(editor, 2)}
        >
          <Heading2 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Subheading"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => applyHeading(editor, 3)}
        >
          <Heading3 className="size-3.5" />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="size-3.5" />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          label="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Insert table"
          active={editor.isActive("table")}
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        >
          <TableIcon className="size-3.5" />
        </ToolbarButton>

        <Separator />

        <ToolbarButton
          label="Align left"
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Align center"
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Align right"
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Justify"
          active={
            editor.isActive({ textAlign: "justify" }) ||
            (!editor.isActive({ textAlign: "left" }) &&
              !editor.isActive({ textAlign: "center" }) &&
              !editor.isActive({ textAlign: "right" }))
          }
          onClick={() => {
            editor.chain().focus().selectAll().setTextAlign("justify").run();
            editor.commands.focus();
          }}
        >
          <AlignJustify className="size-3.5" />
        </ToolbarButton>

        {imagesEnabled && (
          <>
            <Separator />
            <ToolbarButton
              label="Insert image"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ImageIcon className="size-3.5" />
              )}
            </ToolbarButton>
            <input
              ref={fileInputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const files = collectImageFiles(e.target.files);
                e.target.value = "";
                if (files.length) void uploadAndInsert(editor, files);
              }}
            />
          </>
        )}

        <span
          className="ml-auto inline-flex items-center gap-1.5 px-1.5 text-[11px] text-foreground/45"
          title="Browser spellcheck is on. Right-click underlined words for suggestions."
        >
          <SpellCheck className="size-3.5 shrink-0" aria-hidden />
          <span className="hidden sm:inline">Spellcheck on</span>
        </span>
      </div>
      )}

      {imageError && (
        <p className="border-b border-danger/20 bg-danger/5 px-3 py-1.5 text-xs text-danger">
          {imageError}
        </p>
      )}

      <div
        className={cn(
          "overflow-auto",
          fillHeight ? "min-h-0 flex-1 p-0" : "max-h-[70vh] py-4",
          !fillHeight && (fullWidth ? "px-2 sm:px-3" : "px-3 sm:px-6 sm:py-6"),
        )}
      >
        <div
          className={cn(
            "w-full bg-white",
            fillHeight
              ? "min-h-full p-0 shadow-none"
              : "min-h-[640px] shadow-[0_1px_3px_rgba(0,0,0,0.12),0_8px_24px_rgba(0,0,0,0.06)]",
            !fillHeight &&
              (fullWidth
                ? "max-w-none px-5 py-8 sm:px-8 sm:py-10 md:px-12"
                : "mx-auto max-w-[816px] px-8 py-10 sm:px-14 sm:py-14"),
          )}
        >
          <EditorContent
            editor={editor}
            className={cn(
              "w-full max-w-none [&_.ProseMirror]:w-full [&_.ProseMirror]:max-w-none",
              readOnly &&
                "[&_.ProseMirror]:cursor-default [&_.ProseMirror]:caret-transparent",
            )}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-[#fafafa] px-3 py-2 text-xs text-foreground/55 sm:px-4">
        <span aria-live="polite">
          {wordCount.toLocaleString()} {wordCount === 1 ? "word" : "words"}
        </span>
        {!readOnly && (
          <span className="text-foreground/40">
            Spelling: right-click underlined words
          </span>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  active,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-foreground/70 transition hover:bg-black/5 hover:text-foreground disabled:opacity-35",
        active && "bg-[#deecf9] text-[#185abd]",
      )}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden />;
}

/** Compare editor HTML ignoring ephemeral attrs TipTap adds (e.g. text-align). */
function normalizeHtml(html: string) {
  return html
    .replace(/\s+style="[^"]*"/gi, "")
    .replace(/\s+class="document-editor-heading"/gi, "")
    .replace(/>\s+</g, "><")
    .replace(/<p><\/p>/g, "")
    .trim();
}
