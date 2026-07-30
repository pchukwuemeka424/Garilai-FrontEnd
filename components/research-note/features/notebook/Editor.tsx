import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { RichTextDoc } from '@/components/research-note/storage/types'
import { createAsset } from '@/components/research-note/storage/repositories'
import { debounce } from '@/components/research-note/lib/debounce'
import { EditorToolbar } from './EditorToolbar'
import { AssetImage, resolveImageAssets } from './assetImages'

/**
 * Rich-text note editor (TipTap / ProseMirror) with inline images.
 *
 * Mount keyed by `pageId` (`<Editor key={pageId} .../>`). On mount we resolve
 * any asset-backed images to fresh object URLs; the inner editor then runs with
 * that resolved content. Content autosaves on a trailing debounce and flushes
 * on unmount, so switching pages never loses edits. All local, offline.
 */
/** Imperative handle for document import/export from outside the editor. */
export interface EditorApi {
  setContentHTML: (html: string) => void
  getJSON: () => RichTextDoc
}

/** Extract image files from a clipboard/drag DataTransfer, if any. */
export function imageFilesFrom(dt: DataTransfer | null | undefined): File[] {
  if (!dt) return []
  return Array.from(dt.files ?? []).filter((f) => f.type.startsWith('image/'))
}

/** Extract PDF files from a drag DataTransfer. */
export function pdfFilesFrom(dt: DataTransfer | null | undefined): File[] {
  if (!dt) return []
  return Array.from(dt.files ?? []).filter(
    (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name),
  )
}

export function Editor({
  pageId,
  projectId,
  initialContent,
  onSave,
  onReady,
  editable = true,
}: {
  pageId: string
  projectId: string
  initialContent: RichTextDoc | null
  onSave: (pageId: string, doc: RichTextDoc) => void
  onReady?: (api: EditorApi) => void
  editable?: boolean
}) {
  const initialRef = useRef(initialContent)
  const urlsRef = useRef<string[]>([])
  const [ready, setReady] = useState<{ content: RichTextDoc | null } | null>(null)

  // Resolve asset images once per page (component is keyed by pageId).
  useEffect(() => {
    let alive = true
    ;(async () => {
      const doc = initialRef.current
      const resolved = doc
        ? await resolveImageAssets(doc, (u) => urlsRef.current.push(u))
        : null
      if (alive) setReady({ content: resolved })
    })()
    return () => {
      urlsRef.current.forEach(URL.revokeObjectURL)
      urlsRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!ready) {
    return (
      <div className="p-8 text-sm text-[var(--color-muted)]">Loading note…</div>
    )
  }

  return (
    <EditorInner
      pageId={pageId}
      projectId={projectId}
      initialContent={ready.content}
      onSave={onSave}
      onReady={onReady}
      registerUrl={(u) => urlsRef.current.push(u)}
      editable={editable}
    />
  )
}

function EditorInner({
  pageId,
  projectId,
  initialContent,
  onSave,
  onReady,
  registerUrl,
  editable,
}: {
  pageId: string
  projectId: string
  initialContent: RichTextDoc | null
  onSave: (pageId: string, doc: RichTextDoc) => void
  onReady?: (api: EditorApi) => void
  registerUrl: (url: string) => void
  editable: boolean
}) {
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  const debouncedSave = useMemo(
    () => debounce((doc: RichTextDoc) => onSaveRef.current(pageId, doc), 700),
    [pageId],
  )
  useEffect(() => () => debouncedSave.flush(), [debouncedSave])

  // Store an image file as an asset and insert it at the cursor.
  const insertImageFile = async (file: File) => {
    if (!editorRef.current) return
    const asset = await createAsset({
      projectId,
      name: file.name || 'pasted-image',
      mime: file.type,
      blob: file,
    })
    const url = URL.createObjectURL(file)
    registerUrl(url)
    editorRef.current
      .chain()
      .focus()
      .setImage({ src: url, alt: file.name, 'data-asset-id': asset.id } as { src: string })
      .run()
  }

  /** Store a PDF as an asset and insert a labelled attachment paragraph. */
  const insertPdfFile = async (file: File) => {
    if (!editorRef.current) return
    const asset = await createAsset({
      projectId,
      name: file.name || 'attached.pdf',
      mime: file.type || 'application/pdf',
      blob: file,
    })
    const label = file.name || 'Attached PDF'
    editorRef.current
      .chain()
      .focus()
      .insertContent([
        {
          type: 'blockquote',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  marks: [{ type: 'bold' }],
                  text: `📎 PDF attached: ${label}`,
                },
              ],
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `Stored in notebook assets (${asset.id.slice(0, 8)}…). Add quotes and notes below.`,
                },
              ],
            },
          ],
        },
        { type: 'paragraph' },
      ])
      .run()
  }

  const editor = useEditor({
    extensions: [StarterKit, AssetImage.configure({ inline: false })],
    content: (initialContent as JSONContent | null) ?? '',
    editable,
    editorProps: {
      attributes: { class: 'rp-editor focus:outline-none', spellcheck: 'true' },
      // Paste an image straight from the clipboard (screenshots, copied figures).
      handlePaste: (_view, event) => {
        if (!editable) return false
        const files = imageFilesFrom(event.clipboardData)
        if (files.length === 0) return false
        files.forEach((f) => void insertImageFile(f))
        return true
      },
      // Drag-and-drop image or PDF files into the note.
      handleDrop: (_view, event) => {
        if (!editable) return false
        const dt = (event as DragEvent).dataTransfer
        const images = imageFilesFrom(dt)
        const pdfs = pdfFilesFrom(dt)
        if (images.length === 0 && pdfs.length === 0) return false
        event.preventDefault()
        images.forEach((f) => void insertImageFile(f))
        pdfs.forEach((f) => void insertPdfFile(f))
        return true
      },
    },
    onUpdate: ({ editor }) => debouncedSave(editor.getJSON() as RichTextDoc),
  })
  const editorRef = useRef(editor)
  editorRef.current = editor

  // Keep the editor's editable flag in sync (read-only for View-only collaborators).
  useEffect(() => {
    editor?.setEditable(editable)
  }, [editor, editable])

  // Expose an import/export handle once the editor exists.
  useEffect(() => {
    if (!editor || !onReady) return
    onReady({
      setContentHTML: (html) => editor.commands.setContent(html),
      getJSON: () => editor.getJSON() as RichTextDoc,
    })
  }, [editor, onReady])

  const fileRef = useRef<HTMLInputElement>(null)

  const onPickImage = () => fileRef.current?.click()

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file || !editor) return
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      await insertPdfFile(file)
      return
    }
    const asset = await createAsset({
      projectId,
      name: file.name,
      mime: file.type,
      blob: file,
    })
    const url = URL.createObjectURL(file)
    registerUrl(url)
    editor
      .chain()
      .focus()
      .setImage({ src: url, alt: file.name, 'data-asset-id': asset.id } as {
        src: string
      })
      .run()
  }

  return (
    <div className="flex h-full flex-col">
      {editor && editable && <EditorToolbar editor={editor} onInsertImage={onPickImage} />}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf,.pdf"
        className="hidden"
        onChange={onFile}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="w-full px-6 py-6 sm:px-8 sm:py-8">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
