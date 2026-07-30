import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getDraftFor, listDrafts, saveDraft } from '@/components/research-note/storage/repositories'
import type { Draft, OutputType } from '@/components/research-note/storage/types'
import { generateDraft } from '@/components/research-note/ai/drafting'
import type { AISettings } from '@/components/research-note/ai/settings'
import { debounce } from '@/components/research-note/lib/debounce'
import { withGenerationTrace } from '@/components/research-note/features/effort/effortMetrics'

const slot = (outputType: OutputType, section: string | null) =>
  `${outputType}::${section ?? ''}`

/**
 * A project's AI drafts. Generation goes through the active provider; user edits
 * are persisted with `humanEdited: true` so a later regeneration can be guarded
 * (the UI confirms before overwriting an edited draft). AI runs also store a
 * generationTrace + aiBaselineContent for effort / attribution reports.
 */
export function useDrafts(projectId: string, _settings: AISettings) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [busySlot, setBusySlot] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastLiteratureCount, setLastLiteratureCount] = useState<number | null>(null)
  const [lastReferencesSync, setLastReferencesSync] = useState<{
    added: number
    updated: number
    total: number
  } | null>(null)
  const draftsRef = useRef<Draft[]>([])
  draftsRef.current = drafts
  /** In-flight ensure/create so section switches don't spawn duplicate blanks. */
  const ensuringRef = useRef<Map<string, Promise<Draft>>>(new Map())

  useEffect(() => {
    let alive = true
    setLoading(true)
    listDrafts(projectId).then((list) => {
      if (!alive) return
      setDrafts(list)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [projectId])

  const reload = useCallback(async () => {
    const list = await listDrafts(projectId)
    setDrafts(list)
    return list
  }, [projectId])

  const getDraft = useCallback(
    (outputType: OutputType, section: string | null) =>
      drafts.find((d) => d.outputType === outputType && d.section === section) ?? null,
    [drafts],
  )

  const upsertLocal = (saved: Draft) =>
    setDrafts((prev) => {
      const idx = prev.findIndex((d) => d.id === saved.id)
      if (idx === -1) {
        const slotIdx = prev.findIndex(
          (d) => d.outputType === saved.outputType && d.section === saved.section,
        )
        if (slotIdx === -1) return [...prev, saved]
        const next = [...prev]
        next[slotIdx] = saved
        return next
      }
      const next = [...prev]
      next[idx] = saved
      return next
    })

  const pending = useRef<Map<string, { outputType: OutputType; section: string | null; content: string }>>(new Map())
  const flush = useMemo(
    () =>
      debounce(() => {
        for (const [, { outputType, section, content }] of pending.current) {
          void saveDraft(projectId, outputType, section, { content, humanEdited: true }).then(upsertLocal)
        }
        pending.current.clear()
      }, 700),
    [projectId],
  )
  useEffect(() => () => flush.flush(), [flush])

  const flushPending = useCallback(async () => {
    const entries = [...pending.current.entries()]
    pending.current.clear()
    flush.cancel()
    await Promise.all(
      entries.map(([, { outputType, section, content }]) =>
        saveDraft(projectId, outputType, section, { content, humanEdited: true }).then(upsertLocal),
      ),
    )
  }, [flush, projectId])

  const generate = useCallback(
    async (
      outputType: OutputType,
      section: string | null,
      options?: { existingContent?: string | null; preferPageId?: string | null },
    ) => {
      setError(null)
      setLastLiteratureCount(null)
      setLastReferencesSync(null)
      setBusySlot(slot(outputType, section))
      try {
        pending.current.delete(slot('publication', 'References'))
        flush.flush()
        const result = await generateDraft(
          projectId,
          outputType,
          section,
          options?.existingContent,
          { preferPageId: options?.preferPageId },
        )
        const existing = await getDraftFor(projectId, outputType, section)
        const patch = withGenerationTrace(existing, result.generationTrace, result.content)
        const saved = await saveDraft(projectId, outputType, section, patch)
        upsertLocal(saved)
        const list = await listDrafts(projectId)
        setDrafts(list)
        setLastLiteratureCount(result.literatureCount)
        if (result.referencesTotal > 0 || result.referencesAdded > 0 || result.referencesUpdated > 0) {
          setLastReferencesSync({
            added: result.referencesAdded,
            updated: result.referencesUpdated,
            total: result.referencesTotal,
          })
        }
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Generation failed.')
        return false
      } finally {
        setBusySlot(null)
      }
    },
    [projectId, flush],
  )

  const putAiDraft = useCallback(
    async (
      outputType: OutputType,
      section: string | null,
      content: string,
      provider: string,
      model: string,
    ) => {
      const existing = await getDraftFor(projectId, outputType, section)
      const saved = await saveDraft(projectId, outputType, section, {
        content,
        humanEdited: false,
        provider,
        model,
        aiBaselineContent: content,
        generationTrace: existing?.generationTrace ?? {
          generatedAt: new Date().toISOString(),
          agentId: `${outputType}:${section ?? 'doc'}`,
          provider,
          model,
          mode: 'create',
          literatureCount: 0,
          channelsUsed: [],
          materials: [],
        },
      })
      upsertLocal(saved)
    },
    [projectId],
  )

  const addBlank = useCallback(
    async (outputType: OutputType, section: string | null) => {
      setError(null)
      const key = slot(outputType, section)
      const cached = draftsRef.current.find(
        (d) => d.outputType === outputType && d.section === section,
      )
      if (cached) return cached

      const inflight = ensuringRef.current.get(key)
      if (inflight) return inflight

      const promise = (async () => {
        const fromDb = await getDraftFor(projectId, outputType, section)
        if (fromDb) {
          upsertLocal(fromDb)
          return fromDb
        }
        const saved = await saveDraft(projectId, outputType, section, {
          content: '',
          humanEdited: true,
          provider: null,
          model: null,
        })
        upsertLocal(saved)
        return saved
      })()

      ensuringRef.current.set(key, promise)
      try {
        return await promise
      } finally {
        ensuringRef.current.delete(key)
      }
    },
    [projectId],
  )

  const editDraft = useCallback(
    (outputType: OutputType, section: string | null, content: string) => {
      if (outputType === 'publication' && section === 'References') {
        const existing = draftsRef.current.find(
          (d) => d.outputType === outputType && d.section === section,
        )
        const nextText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        const prevText = (existing?.content ?? '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        if (!nextText || (prevText && nextText.length < Math.min(40, prevText.length / 2))) {
          return
        }
      }
      const key = slot(outputType, section)
      pending.current.set(key, { outputType, section, content })
      setDrafts((prev) => {
        const idx = prev.findIndex(
          (d) => d.outputType === outputType && d.section === section,
        )
        if (idx === -1) {
          return [
            ...prev,
            {
              id: `temp-${key}`,
              projectId,
              outputType,
              section,
              content,
              humanEdited: true,
              provider: null,
              model: null,
              createdAt: '',
              updatedAt: '',
            },
          ]
        }
        const next = [...prev]
        next[idx] = { ...next[idx]!, content, humanEdited: true }
        return next
      })
      flush()
    },
    [flush, projectId],
  )

  return {
    drafts,
    loading,
    busySlot,
    error,
    lastLiteratureCount,
    lastReferencesSync,
    getDraft,
    generate,
    addBlank,
    editDraft,
    putAiDraft,
    slot,
    reload,
    flushPending,
  }
}
