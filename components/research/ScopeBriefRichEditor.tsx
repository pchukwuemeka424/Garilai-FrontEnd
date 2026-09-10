"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	Bold,
	Heading2,
	ImageIcon,
	Italic,
	List,
	ListOrdered,
	Loader2,
	Redo2,
	Table as TableIcon,
	Underline as UnderlineIcon,
	Undo2,
} from "lucide-react";

import {
	countWordsFromHtml,
	toEditorHtml,
} from "@/components/portal/editor/document-editor";
import { readFileAsDataUrl } from "@/lib/research-assets-api";

const IMAGE_ACCEPT = "image/jpeg,image/png,image/gif,image/webp";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const EDITOR_PROSE_CLASS =
	"assign-rich-prose document-editor-prose w-full max-w-none min-h-[9rem] outline-none focus:outline-none";

type Props = {
	value: string;
	onChange: (html: string) => void;
	placeholder?: string;
	ariaLabel?: string;
	disabled?: boolean;
};

function isAllowedImage(file: File) {
	return IMAGE_ACCEPT.split(",").includes(file.type) && file.size > 0 && file.size <= MAX_IMAGE_BYTES;
}

function collectImageFiles(list: FileList | File[] | null | undefined): File[] {
	if (!list) return [];
	return Array.from(list).filter(isAllowedImage);
}

function normalizeHtml(html: string) {
	return html
		.replace(/\s+style="[^"]*"/gi, "")
		.replace(/\s+class="document-editor-heading"/gi, "")
		.replace(/>\s+</g, "><")
		.replace(/<p><\/p>/g, "")
		.trim();
}

async function insertImages(editor: Editor, files: File[]) {
	for (const file of files) {
		if (!isAllowedImage(file)) continue;
		const dataUrl = await readFileAsDataUrl(file);
		editor
			.chain()
			.focus()
			.setImage({ src: dataUrl, alt: file.name.replace(/\.[^.]+$/, "") })
			.run();
	}
}

/**
 * Compact TipTap editor for research generate briefs: bold/italic, lists, tables, images.
 */
export function ScopeBriefRichEditor({
	value,
	onChange,
	placeholder = "Paste or write your topic and brief…",
	ariaLabel = "Research brief",
	disabled = false,
}: Props) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const placeholderRef = useRef(placeholder);
	const editorRef = useRef<Editor | null>(null);
	const skipContentSyncRef = useRef(false);
	const onChangeRef = useRef(onChange);
	const disabledRef = useRef(disabled);
	const initialContentRef = useRef(toEditorHtml(value));
	const [uploading, setUploading] = useState(false);
	const [imageError, setImageError] = useState<string | null>(null);

	placeholderRef.current = placeholder;
	onChangeRef.current = onChange;
	disabledRef.current = disabled;

	const uploadAndInsert = useCallback(async (editor: Editor, files: File[]) => {
		if (disabledRef.current || files.length === 0) return;
		setImageError(null);
		setUploading(true);
		try {
			const allowed = files.filter(isAllowedImage);
			if (allowed.length < files.length) {
				setImageError("Use a JPEG, PNG, GIF, or WebP under 5 MB.");
			}
			if (!allowed.length) return;
			await insertImages(editor, allowed);
		} catch (err) {
			setImageError(err instanceof Error ? err.message : "Image insert failed.");
		} finally {
			setUploading(false);
		}
	}, []);

	const extensions = useMemo(
		() => [
			StarterKit.configure({
				heading: {
					levels: [1, 2, 3],
					HTMLAttributes: { class: "document-editor-heading" },
				},
			}),
			Underline,
			TextAlign.configure({ types: ["heading", "paragraph"], defaultAlignment: "left" }),
			Placeholder.configure({ placeholder: () => placeholderRef.current }),
			Image.configure({
				allowBase64: true,
				HTMLAttributes: { class: "document-editor-image" },
			}),
			Table.configure({ resizable: true, HTMLAttributes: { class: "document-editor-table" } }),
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
				"aria-label": ariaLabel,
			},
			handlePaste: (_view: unknown, event: ClipboardEvent) => {
				if (disabledRef.current) return false;
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
			handleDrop: (_view: unknown, event: DragEvent, _slice: unknown, moved: boolean) => {
				if (moved || disabledRef.current) return false;
				const ed = editorRef.current;
				if (!ed) return false;
				const images = collectImageFiles(event.dataTransfer?.files);
				if (!images.length) return false;
				event.preventDefault();
				void uploadAndInsert(ed, images);
				return true;
			},
		}),
		[ariaLabel, uploadAndInsert],
	);

	const editor = useEditor({
		immediatelyRender: false,
		shouldRerenderOnTransaction: true,
		editable: !disabled,
		extensions,
		content: initialContentRef.current,
		editorProps,
		onUpdate: ({ editor: ed }) => {
			skipContentSyncRef.current = true;
			onChangeRef.current(ed.getHTML());
		},
	});

	editorRef.current = editor;

	useEffect(() => {
		if (!editor) return;
		editor.setEditable(!disabled);
	}, [disabled, editor]);

	useEffect(() => {
		if (!editor) return;
		if (skipContentSyncRef.current) {
			skipContentSyncRef.current = false;
			return;
		}
		const next = toEditorHtml(value);
		if (normalizeHtml(editor.getHTML()) !== normalizeHtml(next)) {
			editor.commands.setContent(next || "<p></p>", { emitUpdate: false });
		}
	}, [value, editor]);

	if (!editor) {
		return <div className="assign-rich-loading">Opening editor…</div>;
	}

	const wordCount = countWordsFromHtml(editor.getHTML());

	return (
		<div className={`assign-rich${disabled ? " is-disabled" : ""}`}>
			<div className="assign-rich-toolbar" role="toolbar" aria-label="Formatting">
				<ToolBtn label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
					<Undo2 className="size-3.5" />
				</ToolBtn>
				<ToolBtn label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
					<Redo2 className="size-3.5" />
				</ToolBtn>
				<span className="assign-rich-sep" aria-hidden />
				<ToolBtn
					label="Heading"
					active={editor.isActive("heading", { level: 2 })}
					onClick={() =>
						editor.isActive("heading", { level: 2 })
							? editor.chain().focus().setParagraph().run()
							: editor.chain().focus().clearNodes().setHeading({ level: 2 }).run()
					}
				>
					<Heading2 className="size-3.5" />
				</ToolBtn>
				<ToolBtn label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
					<Bold className="size-3.5" />
				</ToolBtn>
				<ToolBtn label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
					<Italic className="size-3.5" />
				</ToolBtn>
				<ToolBtn
					label="Underline"
					active={editor.isActive("underline")}
					onClick={() => editor.chain().focus().toggleUnderline().run()}
				>
					<UnderlineIcon className="size-3.5" />
				</ToolBtn>
				<span className="assign-rich-sep" aria-hidden />
				<ToolBtn
					label="Bulleted list"
					active={editor.isActive("bulletList")}
					onClick={() => editor.chain().focus().toggleBulletList().run()}
				>
					<List className="size-3.5" />
				</ToolBtn>
				<ToolBtn
					label="Numbered list"
					active={editor.isActive("orderedList")}
					onClick={() => editor.chain().focus().toggleOrderedList().run()}
				>
					<ListOrdered className="size-3.5" />
				</ToolBtn>
				<ToolBtn
					label="Insert table"
					active={editor.isActive("table")}
					onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
				>
					<TableIcon className="size-3.5" />
				</ToolBtn>
				<span className="assign-rich-sep" aria-hidden />
				<ToolBtn
					label="Align left"
					active={editor.isActive({ textAlign: "left" })}
					onClick={() => editor.chain().focus().setTextAlign("left").run()}
				>
					<AlignLeft className="size-3.5" />
				</ToolBtn>
				<ToolBtn
					label="Align center"
					active={editor.isActive({ textAlign: "center" })}
					onClick={() => editor.chain().focus().setTextAlign("center").run()}
				>
					<AlignCenter className="size-3.5" />
				</ToolBtn>
				<ToolBtn
					label="Align right"
					active={editor.isActive({ textAlign: "right" })}
					onClick={() => editor.chain().focus().setTextAlign("right").run()}
				>
					<AlignRight className="size-3.5" />
				</ToolBtn>
				<span className="assign-rich-sep" aria-hidden />
				<ToolBtn label="Insert image" disabled={uploading || disabled} onClick={() => fileInputRef.current?.click()}>
					{uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
				</ToolBtn>
				<input
					ref={fileInputRef}
					type="file"
					accept={IMAGE_ACCEPT}
					hidden
					disabled={disabled}
					onChange={(e) => {
						const files = collectImageFiles(e.target.files);
						e.target.value = "";
						if (files.length) void uploadAndInsert(editor, files);
					}}
				/>
			</div>
			{imageError ? <p className="assign-rich-error">{imageError}</p> : null}
			<div className="assign-rich-surface">
				<EditorContent editor={editor} />
			</div>
			<p className="assign-rich-hint">
				{wordCount.toLocaleString()} {wordCount === 1 ? "word" : "words"} · bullets, numbers, tables, paste or drop images
			</p>
		</div>
	);
}

function ToolBtn({
	children,
	onClick,
	active,
	disabled,
	label,
}: {
	children: ReactNode;
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
			className={`assign-rich-btn${active ? " is-on" : ""}`}
		>
			{children}
		</button>
	);
}
