import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/research-note/components/Modal'
import {
  citeSourceFromReference,
  type CiteSource,
} from '@/components/research-note/ai/agents/citationBank'
import {
  formatCitation,
  formatInTextCite,
  type CitationStyle,
} from '@/components/research-note/features/references/citation'
import { listReferences } from '@/components/research-note/storage/repositories'
import type { Reference } from '@/components/research-note/storage/types'

const plain = (s: string) => s.replace(/\*/g, '')

/** Pick a library reference and insert an in-text citation. */
export function InsertCiteModal({
  open,
  projectId,
  style,
  onClose,
  onInsert,
}: {
  open: boolean
  projectId: string
  style: CitationStyle
  onClose: () => void
  onInsert: (args: { text: string; source: CiteSource }) => void
}) {
  const [refs, setRefs] = useState<Reference[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<'parenthetical' | 'narrative'>('parenthetical')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    setError(null)
    setQuery('')
    setSelectedId(null)
    setForm('parenthetical')
    listReferences(projectId)
      .then((list) => {
        if (!alive) return
        setRefs(list)
        if (list[0]) setSelectedId(list[0].id)
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'Could not load references.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [open, projectId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return refs
    return refs.filter((r) => {
      const hay = `${r.title} ${r.authors.join(' ')} ${r.year ?? ''} ${r.doi ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [refs, query])

  const selected = refs.find((r) => r.id === selectedId) ?? null
  const preview = selected
    ? formatInTextCite(
        {
          authors: selected.authors,
          year: selected.year?.trim() || 'n.d.',
        },
        style,
        Math.max(1, refs.findIndex((r) => r.id === selected.id) + 1),
      )
    : null

  const submit = () => {
    if (!selected || !preview) return
    const index = Math.max(0, refs.findIndex((r) => r.id === selected.id))
    const source = citeSourceFromReference(selected, index, style)
    onInsert({
      text: form === 'narrative' ? preview.narrative : preview.parenthetical,
      source,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Insert citation"
      description="Pick a source from your library. The References section updates when you insert."
      wide
    >
      {loading ? (
        <p className="text-sm text-[var(--color-muted)]">Loading library…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : refs.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">
          Your library is empty. Add DOIs in the References tab first.
        </p>
      ) : (
        <div className="rn-insert-cite">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, author, year, DOI…"
            className="rn-insert-cite-search"
          />
          <ul className="rn-insert-cite-list">
            {filtered.map((ref) => (
              <li key={ref.id}>
                <button
                  type="button"
                  className={`rn-insert-cite-item${selectedId === ref.id ? ' is-selected' : ''}`}
                  onClick={() => setSelectedId(ref.id)}
                >
                  <span>{plain(formatCitation(ref, style))}</span>
                </button>
              </li>
            ))}
          </ul>
          {preview && (
            <div className="rn-insert-cite-preview">
              <div className="rn-insert-cite-forms">
                <button
                  type="button"
                  className={form === 'parenthetical' ? 'is-active' : ''}
                  onClick={() => setForm('parenthetical')}
                >
                  Parenthetical · {preview.parenthetical}
                </button>
                <button
                  type="button"
                  className={form === 'narrative' ? 'is-active' : ''}
                  onClick={() => setForm('narrative')}
                >
                  Narrative · {preview.narrative}
                </button>
              </div>
            </div>
          )}
          <div className="rn-insert-figure-actions">
            <button type="button" className="rn-workspace-btn rn-workspace-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="rn-workspace-btn rn-workspace-btn-primary"
              disabled={!selected}
              onClick={submit}
            >
              Insert cite
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
