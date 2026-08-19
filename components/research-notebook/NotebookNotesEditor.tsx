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

import {
	countWordsFromHtml,
	toEditorHtml,
} from "@/components/portal/editor/document-editor";
import { createDocument, readFileAsDataUrl } from "@/lib/research-assets-api";

const IMAGE_ACCEPT = "image/jpeg,image/png,image/gif,image/webp";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const EDITOR_PROSE_CLASS =
	"document-editor-prose w-full max-w-none min-h-[640px] outline-none focus:outline-none";

type Props = {
	value: string;
	onChange: (html: string) => void;
	projectId: string;
	placeholder?: string;
	onImageUploaded?: () => void;
};

type HeadingLevel = 1 | 2 | 3;

function applyHeading(editor: Editor, level: HeadingLevel) {
	if (editor.isActive("heading", { level })) {
		return editor.chain().focus().setParagraph().run();
	}
	return editor.chain().focus().clearNodes().setHeading({ level }).run();
}

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

export function NotebookNotesEditor({
	value,
	onChange,
	projectId,
	placeholder = "Start the working draft. Paste or insert figures into this page.",
	onImageUploaded,
}: Props) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const projectIdRef = useRef(projectId);
	const placeholderRef = useRef(placeholder);
	const editorRef = useRef<Editor | null>(null);
	const skipContentSyncRef = useRef(false);
	const onChangeRef = useRef(onChange);
	const onImageUploadedRef = useRef(onImageUploaded);
	const initialContentRef = useRef(toEditorHtml(value));
	const [uploading, setUploading] = useState(false);
	const [imageError, setImageError] = useState<string | null>(null);

	projectIdRef.current = projectId;
	placeholderRef.current = placeholder;
	onChangeRef.current = onChange;
	onImageUploadedRef.current = onImageUploaded;

	const uploadAndInsert = useCallback(async (editor: Editor, files: File[]) => {
		if (files.length === 0) return;
		setImageError(null);
		setUploading(true);
		try {
			for (const file of files) {
				if (!isAllowedImage(file)) {
					setImageError("Use a JPEG, PNG, GIF, or WebP under 8 MB.");
					continue;
				}
				const dataUrl = await readFileAsDataUrl(file);
				await createDocument({
					title: file.name,
					fileName: file.name,
					fileMime: file.type,
					fileData: dataUrl,
					projectId: projectIdRef.current,
				});
				editor
					.chain()
					.focus()
					.setImage({ src: dataUrl, alt: file.name.replace(/\.[^.]+$/, "") })
					.run();
				onImageUploadedRef.current?.();
			}
		} catch (err) {
			setImageError(err instanceof Error ? err.message : "Image upload failed.");
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
			TextAlign.configure({ types: ["heading", "paragraph"], defaultAlignment: "justify" }),
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
			},
			handlePaste: (_view: unknown, event: ClipboardEvent) => {
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
				if (moved) return false;
				const ed = editorRef.current;
				if (!ed) return false;
				const images = collectImageFiles(event.dataTransfer?.files);
				if (!images.length) return false;
				event.preventDefault();
				void uploadAndInsert(ed, images);
				return true;
			},
		}),
		[uploadAndInsert],
	);

	const editor = useEditor({
		immediatelyRender: false,
		shouldRerenderOnTransaction: true,
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
		return <div className="nb-word-shell nb-word-loading">Opening document…</div>;
	}

	const wordCount = countWordsFromHtml(editor.getHTML());

	return (
		<div className="nb-word-shell">
			<div className="nb-word-ribbon" role="toolbar" aria-label="Document formatting">
				<RibbonButton label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
					<Undo2 className="size-3.5" />
				</RibbonButton>
				<RibbonButton label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
					<Redo2 className="size-3.5" />
				</RibbonButton>
				<span className="nb-word-sep" />
				<RibbonButton label="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => applyHeading(editor, 1)}>
					<Heading1 className="size-3.5" />
				</RibbonButton>
				<RibbonButton label="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => applyHeading(editor, 2)}>
					<Heading2 className="size-3.5" />
				</RibbonButton>
				<RibbonButton label="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => applyHeading(editor, 3)}>
					<Heading3 className="size-3.5" />
				</RibbonButton>
				<span className="nb-word-sep" />
				<RibbonButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
					<Bold className="size-3.5" />
				</RibbonButton>
				<RibbonButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
					<Italic className="size-3.5" />
				</RibbonButton>
				<RibbonButton label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
					<UnderlineIcon className="size-3.5" />
				</RibbonButton>
				<RibbonButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
					<Strikethrough className="size-3.5" />
				</RibbonButton>
				<span className="nb-word-sep" />
				<RibbonButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
					<List className="size-3.5" />
				</RibbonButton>
				<RibbonButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
					<ListOrdered className="size-3.5" />
				</RibbonButton>
				<RibbonButton
					label="Insert table"
					active={editor.isActive("table")}
					onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
				>
					<TableIcon className="size-3.5" />
				</RibbonButton>
				<span className="nb-word-sep" />
				<RibbonButton label="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
					<AlignLeft className="size-3.5" />
				</RibbonButton>
				<RibbonButton label="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
					<AlignCenter className="size-3.5" />
				</RibbonButton>
				<RibbonButton label="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
					<AlignRight className="size-3.5" />
				</RibbonButton>
				<RibbonButton
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
				</RibbonButton>
				<span className="nb-word-sep" />
				<RibbonButton label="Insert picture" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
					{uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
				</RibbonButton>
				<input
					ref={fileInputRef}
					type="file"
					accept={IMAGE_ACCEPT}
					hidden
					onChange={(e) => {
						const files = collectImageFiles(e.target.files);
						e.target.value = "";
						if (files.length) void uploadAndInsert(editor, files);
					}}
				/>
				<span className="nb-word-spell">
					<SpellCheck className="size-3.5" aria-hidden />
					Manuscript
				</span>
			</div>
			{imageError ? <p className="nb-word-error">{imageError}</p> : null}
			<div className="nb-word-canvas">
				<div className="nb-word-page nb-word-page-full">
					<EditorContent editor={editor} />
				</div>
			</div>
			<div className="nb-word-status">
				<span>
					{wordCount.toLocaleString()} {wordCount === 1 ? "word" : "words"}
				</span>
				<span>Paste or drop pictures · Times New Roman 12 pt</span>
			</div>
		</div>
	);
}

function RibbonButton({
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
			className={`nb-ribbon-btn${active ? " is-on" : ""}`}
		>
			{children}
		</button>
	);
}
