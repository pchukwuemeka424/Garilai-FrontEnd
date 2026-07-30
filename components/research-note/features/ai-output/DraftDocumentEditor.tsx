'use client'

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { AssetImage } from '@/components/research-note/features/notebook/assetImages'
import { EditorToolbar } from '@/components/research-note/features/notebook/EditorToolbar'
import { debounce } from '@/components/research-note/lib/debounce'
import { draftContentToHtml } from '@/components/research-note/lib/markdown'

export type DraftDocumentEditorHandle = {
  insertText: (text: string) => void
  insertFigure: (args: {
    src: string
    assetId: string
    alt: string
    caption: string
  }) => void
  focus: () => void
}

/**
 * Word-style rich-text surface for Manuscript sections — toolbar + page-like editor.
 * Mount with a stable `key` (e.g. draft slot) so content reloads per section.
 * Persists HTML; callers can convert to Markdown for export.
 */
export const DraftDocumentEditor = forwardRef<
  DraftDocumentEditorHandle,
  {
    /** Markdown (from AI) or HTML (from prior edits). Used only on mount. */
    content: string
    onChange: (html: string) => void
    editable?: boolean
  }
>(function DraftDocumentEditor({ content, onChange, editable = true }, ref) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const initialHtml = useRef(draftContentToHtml(content)).current
  const urlsRef = useRef<string[]>([])

  const debounced = useMemo(
    () =>
      debounce((html: string) => {
        onChangeRef.current(html)
      }, 400),
    [],
  )
  useEffect(() => () => debounced.flush(), [debounced])
  useEffect(
    () => () => {
      urlsRef.current.forEach(URL.revokeObjectURL)
      urlsRef.current = []
    },
    [],
  )

  const editor = useEditor({
    extensions: [StarterKit, AssetImage.configure({ inline: false })],
    content: initialHtml,
    editable,
    immediatelyRender: true,
    editorProps: {
      attributes: {
        class: 'rp-editor draft-doc-page focus:outline-none',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor: ed }) => {
      debounced(ed.getHTML())
    },
  })

  useEffect(() => {
    editor?.setEditable(editable)
  }, [editor, editable])

  useImperativeHandle(
    ref,
    () => ({
      insertText: (text: string) => {
        if (!editor || !editable) return
        editor.chain().focus().insertContent(`${text} `).run()
      },
      insertFigure: ({ src, assetId, alt, caption }) => {
        if (!editor || !editable) return
        // Keep blob URLs alive for this editor mount (modal URLs get revoked).
        if (src.startsWith('blob:')) urlsRef.current.push(src)
        const nodes: Array<Record<string, unknown>> = [
          {
            type: 'image',
            attrs: {
              src,
              alt,
              'data-asset-id': assetId,
            },
          },
        ]
        if (caption.trim()) {
          nodes.push({
            type: 'paragraph',
            content: [
              {
                type: 'text',
                marks: [{ type: 'italic' }],
                text: caption.trim(),
              },
            ],
          })
        }
        editor.chain().focus().insertContent(nodes).run()
      },
      focus: () => {
        editor?.chain().focus().run()
      },
    }),
    [editor, editable],
  )

  if (!editor) {
    return (
      <div className="rn-draft-editor">
        <div className="rn-draft-editor-scroll">
          <div className="rn-draft-sheet" />
        </div>
      </div>
    )
  }

  return (
    <div className="rn-draft-editor">
      {editable && <EditorToolbar editor={editor} />}
      <div className="rn-draft-editor-scroll">
        <div className="rn-draft-sheet">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
})
