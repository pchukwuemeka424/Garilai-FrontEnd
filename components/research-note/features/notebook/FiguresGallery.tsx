import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createAsset,
  deleteAsset,
  listAssets,
  updateAsset,
} from '@/components/research-note/storage/repositories'
import { relativeTime } from '@/components/research-note/lib/format'
import { PlusIcon, TrashIcon, ImageIcon } from '@/components/research-note/components/icons'
import type { Asset } from '@/components/research-note/storage/types'
import { WorkspaceSaveButton, useCloudSave } from '@/components/research-note/features/sync/CloudSave'

/**
 * Project-wide figures gallery. Upload images here directly, or add them inside
 * notes — both land in the same asset store.
 */
export function FiguresGallery({
  projectId,
  canWrite = true,
  onOpenNotes,
}: {
  projectId: string
  canWrite?: boolean
  /** Jump to Notes (e.g. after creating a note for a figure). */
  onOpenNotes?: () => void
}) {
  const [items, setItems] = useState<{ asset: Asset; url: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedHint, setSavedHint] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const urlsRef = useRef<string[]>([])
  const cloud = useCloudSave()

  const refresh = useCallback(async () => {
    urlsRef.current.forEach(URL.revokeObjectURL)
    urlsRef.current = []
    const assets = await listAssets(projectId)
    const mapped = assets
      .filter((a) => a.mime.startsWith('image/'))
      .map((asset) => {
        const url = URL.createObjectURL(asset.blob)
        urlsRef.current.push(url)
        return { asset, url }
      })
    setItems(mapped)
  }, [projectId])

  useEffect(() => {
    let alive = true
    setLoading(true)
    refresh()
      .then(() => {
        if (alive) setLoading(false)
      })
      .catch((err) => {
        if (alive) {
          setError(err instanceof Error ? err.message : 'Could not load figures.')
          setLoading(false)
        }
      })
    return () => {
      alive = false
      urlsRef.current.forEach(URL.revokeObjectURL)
      urlsRef.current = []
    }
  }, [refresh])

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (list.length === 0) {
      setError('Choose an image file (PNG, JPG, GIF, WebP, …).')
      return
    }
    setError(null)
    setUploading(true)
    try {
      for (const file of list) {
        await createAsset({
          projectId,
          name: file.name || 'figure',
          mime: file.type || 'image/png',
          blob: file,
        })
      }
      await refresh()
      await cloud.saveNow()
      setSavedHint('Figures uploaded and saved.')
      window.setTimeout(() => setSavedHint(null), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    e.target.value = ''
    if (files?.length) void uploadFiles(files)
  }

  const onRemove = async (id: string, name: string) => {
    if (!window.confirm(`Remove figure "${name || 'image'}"?`)) return
    await deleteAsset(id)
    await refresh()
  }

  const saveCaption = async (id: string, caption: string) => {
    await updateAsset(id, { caption: caption.trim() || undefined })
    setItems((prev) =>
      prev.map((item) =>
        item.asset.id === id
          ? { ...item, asset: { ...item.asset, caption: caption.trim() || undefined } }
          : item,
      ),
    )
    setEditingId(null)
    await cloud.saveNow()
    setSavedHint('Caption saved.')
    window.setTimeout(() => setSavedHint(null), 2000)
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--color-muted)]">
        Loading figures…
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-canvas)] px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]" aria-hidden>
              <ImageIcon className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Figures</h2>
              <p className="text-xs text-[var(--color-muted)]">
                Upload images, edit captions, then insert them from Manuscript (Results / Discussion).
              </p>
            </div>
          </div>
        </div>
        {canWrite && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onFileInput}
            />
            <WorkspaceSaveButton label="Save figures" />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-[var(--color-brand-ink)] disabled:opacity-50"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              {uploading ? 'Uploading…' : 'Upload figure'}
            </button>
            {onOpenNotes && (
              <button
                type="button"
                onClick={onOpenNotes}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface)]"
              >
                Add note
              </button>
            )}
          </>
        )}
      </div>

      {(error || savedHint) && (
        <p
          className={[
            'border-b px-4 py-2 text-sm',
            error ? 'border-red-200 bg-red-50 text-red-700' : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)]',
          ].join(' ')}
          role={error ? 'alert' : undefined}
        >
          {error || savedHint}
        </p>
      )}

      {items.length === 0 ? (
        <div
          className={[
            'm-6 flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors',
            dragOver
              ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5'
              : 'border-[var(--color-border)]',
          ].join(' ')}
          onDragOver={(e) => {
            if (!canWrite) return
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            if (!canWrite) return
            e.preventDefault()
            setDragOver(false)
            void uploadFiles(e.dataTransfer.files)
          }}
        >
          <h2 className="text-lg font-semibold">No figures yet</h2>
          <p className="mt-1 max-w-sm text-sm text-[var(--color-muted)]">
            {canWrite
              ? 'Upload images here, or drag and drop them onto this area. Charts from Data also appear here.'
              : 'Figures added to this project will appear here.'}
          </p>
          {canWrite && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-[var(--color-brand-ink)] disabled:opacity-50"
              >
                <PlusIcon /> {uploading ? 'Uploading…' : 'Upload figure'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          className={[
            'flex-1 overflow-y-auto p-6',
            dragOver ? 'bg-[var(--color-brand)]/5' : '',
          ].join(' ')}
          onDragOver={(e) => {
            if (!canWrite) return
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            if (!canWrite) return
            e.preventDefault()
            setDragOver(false)
            void uploadFiles(e.dataTransfer.files)
          }}
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map(({ asset, url }, i) => (
              <figure
                key={asset.id}
                className="group relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)]"
              >
                <img
                  src={url}
                  alt={asset.caption || asset.name}
                  className="aspect-video w-full object-cover"
                />
                <figcaption className="space-y-1.5 px-3 py-2 text-xs text-[var(--color-muted)]">
                  <div className="flex items-center gap-1">
                    <span className="min-w-0 flex-1 truncate font-medium text-[var(--color-ink)]">
                      Fig. {i + 1}
                    </span>
                    {canWrite && (
                      <button
                        type="button"
                        title="Remove figure"
                        aria-label={`Remove ${asset.name || 'figure'}`}
                        onClick={() => void onRemove(asset.id, asset.name)}
                        className="shrink-0 rounded p-1 text-[var(--color-muted)] opacity-0 hover:bg-[var(--color-surface)] hover:text-red-600 group-hover:opacity-100"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {editingId === asset.id && canWrite ? (
                    <CaptionEditor
                      initial={asset.caption || asset.name || ''}
                      onCancel={() => setEditingId(null)}
                      onSave={(value) => void saveCaption(asset.id, value)}
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={!canWrite}
                      className="block w-full truncate text-left hover:text-[var(--color-ink)] disabled:cursor-default"
                      onClick={() => canWrite && setEditingId(asset.id)}
                      title={canWrite ? 'Edit caption' : undefined}
                    >
                      {asset.caption?.trim() || asset.name || 'Add caption…'}
                      <span className="ml-1 opacity-70">· {relativeTime(asset.createdAt)}</span>
                    </button>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CaptionEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: string
  onCancel: () => void
  onSave: (value: string) => void
}) {
  const [value, setValue] = useState(initial)
  return (
    <div className="space-y-1">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(value)
          if (e.key === 'Escape') onCancel()
        }}
        className="w-full rounded border border-[var(--color-border)] bg-[var(--color-canvas)] px-1.5 py-1 text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-brand)]"
        placeholder="Figure caption"
      />
      <div className="flex gap-1">
        <button
          type="button"
          className="rounded px-1.5 py-0.5 text-[0.65rem] font-medium text-[var(--color-brand)] hover:bg-[var(--color-surface)]"
          onClick={() => onSave(value)}
        >
          Save
        </button>
        <button
          type="button"
          className="rounded px-1.5 py-0.5 text-[0.65rem] hover:bg-[var(--color-surface)]"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
