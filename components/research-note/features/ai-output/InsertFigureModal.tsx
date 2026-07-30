import { useEffect, useState } from 'react'
import { Modal } from '@/components/research-note/components/Modal'
import { listAssets, updateAsset } from '@/components/research-note/storage/repositories'
import type { Asset } from '@/components/research-note/storage/types'

type GalleryItem = { asset: Asset; url: string }

/** Pick a project figure and optional caption to insert into the manuscript. */
export function InsertFigureModal({
  open,
  projectId,
  onClose,
  onInsert,
}: {
  open: boolean
  projectId: string
  onClose: () => void
  onInsert: (args: {
    asset: Asset
    src: string
    caption: string
  }) => void
}) {
  const [items, setItems] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    const urls: string[] = []
    setLoading(true)
    setError(null)
    setSelectedId(null)
    setCaption('')
    listAssets(projectId)
      .then((assets) => {
        if (!alive) return
        const images = assets.filter((a) => a.mime.startsWith('image/'))
        const mapped = images.map((asset) => {
          const url = URL.createObjectURL(asset.blob)
          urls.push(url)
          return { asset, url }
        })
        setItems(mapped)
        if (mapped[0]) {
          setSelectedId(mapped[0].asset.id)
          setCaption(mapped[0].asset.caption?.trim() || mapped[0].asset.name || '')
        }
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'Could not load figures.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
      urls.forEach(URL.revokeObjectURL)
    }
  }, [open, projectId])

  const selected = items.find((i) => i.asset.id === selectedId) ?? null

  const submit = async () => {
    if (!selected) return
    const nextCaption = caption.trim()
    if (nextCaption !== (selected.asset.caption ?? '').trim()) {
      try {
        await updateAsset(selected.asset.id, { caption: nextCaption || undefined })
      } catch {
        /* still insert even if caption persist fails */
      }
    }
    const figIndex = items.findIndex((i) => i.asset.id === selected.asset.id) + 1
    const label = nextCaption || selected.asset.name || 'Untitled'
    onInsert({
      asset: selected.asset,
      src: selected.url,
      caption: `Figure ${figIndex}. ${label}`,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Insert figure"
      description="Choose a figure from this notebook and set its caption."
      wide
    >
      {loading ? (
        <p className="text-sm text-[var(--color-muted)]">Loading figures…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">
          No figures yet. Upload images in the Figures tab, or save a chart from Data.
        </p>
      ) : (
        <div className="rn-insert-figure">
          <div className="rn-insert-figure-grid">
            {items.map(({ asset, url }, i) => (
              <button
                key={asset.id}
                type="button"
                className={`rn-insert-figure-tile${selectedId === asset.id ? ' is-selected' : ''}`}
                onClick={() => {
                  setSelectedId(asset.id)
                  setCaption(asset.caption?.trim() || asset.name || '')
                }}
              >
                <img src={url} alt={asset.name} />
                <span>Fig. {i + 1}</span>
              </button>
            ))}
          </div>
          <label className="rn-insert-figure-caption">
            <span>Caption</span>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Short scholarly caption"
            />
          </label>
          <div className="rn-insert-figure-actions">
            <button type="button" className="rn-workspace-btn rn-workspace-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="rn-workspace-btn rn-workspace-btn-primary"
              disabled={!selected}
              onClick={() => void submit()}
            >
              Insert
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
