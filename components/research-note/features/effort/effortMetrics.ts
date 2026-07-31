import { PUBLICATION_SECTIONS } from '@/components/research-note/config/branding'
import { draftContentToPlainText } from '@/components/research-note/lib/markdown'
import { computeNotebookProgress } from '@/components/research-note/features/progress/progressMetrics'
import { loadProgressTracker } from '@/components/research-note/features/progress/progressTracker'
import { listMaterialInventory } from '@/components/research-note/features/effort/materialInventory'
import {
  getProject,
  listDrafts,
} from '@/components/research-note/storage/repositories'
import type {
  Draft,
  GenerationTrace,
  MaterialChannel,
  MaterialUsageItem,
} from '@/components/research-note/storage/types'

export type EffortBand = 'none' | 'low' | 'moderate' | 'high' | 'very_high'

export type SectionEffortRow = {
  outputType: Draft['outputType']
  section: string | null
  label: string
  wordCount: number
  humanEdited: boolean
  hadAiGeneration: boolean
  /** 0–100 share of final text attributable to user edits / writing. */
  userShare: number
  /** 0–100 share left as AI (or empty). */
  aiShare: number
  agentId: string | null
  materialsUsed: MaterialUsageItem[]
  channelsUsed: MaterialChannel[]
  generatedAt: string | null
}

export type EffortReportSnapshot = {
  projectTitle: string
  projectFocus: string
  generatedAt: string
  /** Overall user effort 0–100 (capture + writing/edits). */
  userEffortScore: number
  /** Overall AI share of manuscript text 0–100. */
  aiShareScore: number
  /** Capture / upload contribution 0–100. */
  captureScore: number
  /** Writing & edit contribution 0–100. */
  writingScore: number
  userBand: EffortBand
  captureCounts: {
    notes: number
    data: number
    figures: number
    labLog: number
    references: number
    templates: number
    uploadedFiles: number
  }
  inventory: MaterialUsageItem[]
  sections: SectionEffortRow[]
  /** Distinct materials that appeared in any generation trace. */
  materialsCitedByAgents: MaterialUsageItem[]
  generationCount: number
  editedSectionCount: number
  manualOnlySectionCount: number
  emptyProject: boolean
  summaryLines: string[]
}

const TRACE_HISTORY_CAP = 12

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

function tokenize(text: string): string[] {
  return draftContentToPlainText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)
}

/** Approximate share of `current` that differs from `baseline` (0–1). */
export function editDistanceRatio(baseline: string, current: string): number {
  const a = tokenize(baseline)
  const b = tokenize(current)
  if (a.length === 0 && b.length === 0) return 0
  if (a.length === 0) return 1
  if (b.length === 0) return 1

  const counts = new Map<string, number>()
  for (const w of a) counts.set(w, (counts.get(w) ?? 0) + 1)
  let common = 0
  for (const w of b) {
    const n = counts.get(w) ?? 0
    if (n > 0) {
      common += 1
      counts.set(w, n - 1)
    }
  }
  const union = a.length + b.length - common
  if (union <= 0) return 0
  // Jaccard distance: how much changed
  return 1 - common / union
}

export function bandForScore(score: number): EffortBand {
  if (score < 20) return 'none'
  if (score < 40) return 'low'
  if (score < 60) return 'moderate'
  if (score < 80) return 'high'
  return 'very_high'
}

export function bandLabel(band: EffortBand): string {
  switch (band) {
    case 'none':
      return 'No recorded effort'
    case 'low':
      return 'Low'
    case 'moderate':
      return 'Moderate'
    case 'high':
      return 'High'
    case 'very_high':
      return 'Very high'
  }
}

function sectionLabel(draft: Draft): string {
  if (draft.outputType === 'publication') {
    return draft.section ? `Manuscript · ${draft.section}` : 'Manuscript'
  }
  if (draft.outputType === 'progressReports') {
    return draft.section ? `Progress · ${draft.section}` : 'Progress Report'
  }
  return draft.section ?? draft.outputType
}

function scoreSection(draft: Draft): SectionEffortRow {
  const plain = draftContentToPlainText(draft.content)
  const words = tokenize(plain).length
  const trace = draft.generationTrace ?? null
  const hadAi = Boolean(trace || (draft.provider && draft.aiBaselineContent))
  const baseline = draft.aiBaselineContent ?? (hadAi && !draft.humanEdited ? draft.content : '')

  let userShare = 0
  if (!plain.trim()) {
    userShare = 0
  } else if (!hadAi) {
    // Fully manual writing
    userShare = 100
  } else if (!draft.humanEdited) {
    userShare = 0
  } else {
    const ratio = editDistanceRatio(baseline || '', draft.content)
    // Map change ratio into contribution; light polish still counts.
    userShare = clamp(ratio * 100 * 1.15)
    if (draft.humanEdited && userShare < 8 && words > 0) userShare = 8
  }

  return {
    outputType: draft.outputType,
    section: draft.section,
    label: sectionLabel(draft),
    wordCount: words,
    humanEdited: draft.humanEdited,
    hadAiGeneration: hadAi,
    userShare,
    aiShare: clamp(100 - userShare),
    agentId: trace?.agentId ?? null,
    materialsUsed: trace?.materials ?? [],
    channelsUsed: trace?.channelsUsed ?? [],
    generatedAt: trace?.generatedAt ?? null,
  }
}

function uniqueMaterials(items: MaterialUsageItem[]): MaterialUsageItem[] {
  const seen = new Set<string>()
  const out: MaterialUsageItem[] = []
  for (const m of items) {
    const key = `${m.channel}:${m.id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(m)
  }
  return out
}

/** Build a full effort / attribution snapshot (always succeeds, even for empty projects). */
export async function computeEffortReport(
  projectId: string,
): Promise<EffortReportSnapshot> {
  const [project, inventory, drafts, tracker] = await Promise.all([
    getProject(projectId),
    listMaterialInventory(projectId),
    listDrafts(projectId),
    loadProgressTracker(projectId),
  ])
  const progress = await computeNotebookProgress(projectId, tracker)

  const manuscriptDrafts = drafts.filter(
    (d) =>
      d.outputType === 'publication' &&
      d.section &&
      PUBLICATION_SECTIONS.includes(d.section as (typeof PUBLICATION_SECTIONS)[number]) &&
      d.section !== 'References',
  )
  const progressDraft = drafts.find(
    (d) => d.outputType === 'progressReports' && d.section === null,
  )

  const sectionDrafts = [
    ...manuscriptDrafts.sort(
      (a, b) =>
        PUBLICATION_SECTIONS.indexOf(a.section as (typeof PUBLICATION_SECTIONS)[number]) -
        PUBLICATION_SECTIONS.indexOf(b.section as (typeof PUBLICATION_SECTIONS)[number]),
    ),
    ...(progressDraft ? [progressDraft] : []),
  ]

  const sections = sectionDrafts.map(scoreSection)

  const captureCounts = {
    notes: inventory.filter((m) => m.channel === 'notes').length,
    data: inventory.filter((m) => m.channel === 'data').length,
    figures: inventory.filter((m) => m.channel === 'figures').length,
    labLog: inventory.filter((m) => m.channel === 'labLog').length,
    references: inventory.filter((m) => m.channel === 'references').length,
    templates: inventory.filter((m) => m.channel === 'templates').length,
    uploadedFiles: inventory.filter((m) => m.channel === 'notes' || m.channel === 'data').length,
  }

  // Capture score mirrors progress capture buckets but always defined.
  const captureScore = clamp(progress.percent * 0.55 + (
    (captureCounts.notes > 0 ? 10 : 0) +
    (captureCounts.data > 0 ? 8 : 0) +
    (captureCounts.figures > 0 ? 7 : 0) +
    (captureCounts.labLog > 0 ? 8 : 0) +
    (captureCounts.references > 0 ? 7 : 0) +
    (tracker.milestones.length > 0 ? 5 : 0)
  ))

  const writable = sections.filter((s) => s.wordCount > 0)
  const writingScore =
    writable.length === 0
      ? 0
      : clamp(
          writable.reduce((sum, s) => sum + s.userShare, 0) / writable.length,
        )

  const aiShareScore =
    writable.length === 0
      ? 0
      : clamp(
          writable.reduce((sum, s) => sum + s.aiShare, 0) / writable.length,
        )

  // Blend: capture work matters even when the user never edited AI text.
  // Baseline 20 so project reports never start at 0; remaining 80 is earned.
  const blended = captureScore * 0.4 + writingScore * 0.6
  const userEffortScore = clamp(20 + blended * 0.8)

  const materialsCitedByAgents = uniqueMaterials(
    sections.flatMap((s) => s.materialsUsed),
  )
  const generationCount = sections.filter((s) => s.hadAiGeneration).length
  const editedSectionCount = sections.filter((s) => s.humanEdited && s.wordCount > 0).length
  const manualOnlySectionCount = sections.filter(
    (s) => !s.hadAiGeneration && s.wordCount > 0,
  ).length

  const emptyProject =
    inventory.length === 0 &&
    writable.length === 0 &&
    tracker.milestones.length === 0

  const summaryLines: string[] = []
  if (emptyProject) {
    summaryLines.push(
      'No Materials, Data, Figures, Lab Log, References, or manuscript text were recorded yet.',
    )
    summaryLines.push(
      'User effort score starts at 20/100 for a new project. This report still documents the empty baseline for audit.',
    )
  } else {
    summaryLines.push(
      `User effort score: ${userEffortScore}/100 (${bandLabel(bandForScore(userEffortScore))}).`,
    )
    summaryLines.push(
      `Capture contribution: ${captureScore}/100 · Writing/edit contribution: ${writingScore}/100 · AI text share: ${aiShareScore}/100.`,
    )
    if (generationCount === 0) {
      summaryLines.push('No AI section generations were recorded for this project.')
    } else {
      summaryLines.push(
        `${generationCount} section(s) were AI-generated; agents grounded ${materialsCitedByAgents.length} material item(s).`,
      )
    }
    if (editedSectionCount > 0) {
      summaryLines.push(
        `User edited ${editedSectionCount} filled section(s) before export.`,
      )
    } else if (generationCount > 0) {
      summaryLines.push(
        'No human edits were recorded on AI drafts before this report.',
      )
    }
    if (manualOnlySectionCount > 0) {
      summaryLines.push(
        `${manualOnlySectionCount} section(s) were written entirely by the user (no AI generation).`,
      )
    }
    if (inventory.length === 0) {
      summaryLines.push(
        'No uploaded or captured notebook materials were available for agents to use.',
      )
    }
  }

  return {
    projectTitle: project?.title ?? 'Untitled project',
    projectFocus: project?.focus ?? '',
    generatedAt: new Date().toISOString(),
    userEffortScore,
    aiShareScore,
    captureScore,
    writingScore,
    userBand: bandForScore(userEffortScore),
    captureCounts,
    inventory,
    sections,
    materialsCitedByAgents,
    generationCount,
    editedSectionCount,
    manualOnlySectionCount,
    emptyProject,
    summaryLines,
  }
}

/** Markdown document suitable for MD / DOCX / PDF export. Always non-empty. */
export function composeEffortReportMarkdown(report: EffortReportSnapshot): string {
  const lines: string[] = [
    `# Effort & attribution report`,
    '',
    `**Project:** ${report.projectTitle}`,
  ]
  if (report.projectFocus.trim()) {
    lines.push(`**Focus:** ${report.projectFocus.trim()}`)
  }
  lines.push(`**Generated:** ${report.generatedAt.slice(0, 19).replace('T', ' ')} UTC`)
  lines.push('')
  lines.push('## Summary scores')
  lines.push('')
  lines.push(`| Metric | Score |`)
  lines.push(`| --- | --- |`)
  lines.push(`| User effort (overall) | ${report.userEffortScore}/100 (${bandLabel(report.userBand)}) |`)
  lines.push(`| Capture / uploads | ${report.captureScore}/100 |`)
  lines.push(`| Writing & edits | ${report.writingScore}/100 |`)
  lines.push(`| AI text share | ${report.aiShareScore}/100 |`)
  lines.push('')
  lines.push('### Findings')
  lines.push('')
  for (const s of report.summaryLines) {
    lines.push(`- ${s}`)
  }

  lines.push('')
  lines.push('## Captured materials')
  lines.push('')
  lines.push(
    `Notes ${report.captureCounts.notes} · Data ${report.captureCounts.data} · Figures ${report.captureCounts.figures} · Lab Log ${report.captureCounts.labLog} · References ${report.captureCounts.references} · Templates ${report.captureCounts.templates}`,
  )
  lines.push('')
  if (report.inventory.length === 0) {
    lines.push('_No materials uploaded or captured._')
  } else {
    for (const m of report.inventory) {
      lines.push(`- **[${m.channel}]** ${m.title}${m.chars ? ` (${m.chars} chars)` : ''}`)
    }
  }

  lines.push('')
  lines.push('## How agents used materials')
  lines.push('')
  if (report.materialsCitedByAgents.length === 0) {
    lines.push(
      '_No agent generation traces yet. Generate or refine a Manuscript section to record which uploads were injected into prompts._',
    )
  } else {
    lines.push('Materials that appeared in at least one AI generation prompt:')
    lines.push('')
    for (const m of report.materialsCitedByAgents) {
      lines.push(`- **[${m.channel}]** ${m.title}`)
    }
  }

  lines.push('')
  lines.push('## Section contribution')
  lines.push('')
  if (report.sections.length === 0) {
    lines.push('_No manuscript or progress narrative text yet._')
  } else {
    lines.push('| Section | Words | User % | AI % | Edited | Agent | Materials used |')
    lines.push('| --- | ---: | ---: | ---: | --- | --- | --- |')
    for (const s of report.sections) {
      const mats =
        s.materialsUsed.length === 0
          ? '—'
          : s.materialsUsed
              .slice(0, 6)
              .map((m) => m.title)
              .join('; ') + (s.materialsUsed.length > 6 ? '…' : '')
      lines.push(
        `| ${s.label} | ${s.wordCount} | ${s.userShare} | ${s.aiShare} | ${s.humanEdited ? 'yes' : 'no'} | ${s.agentId ?? '—'} | ${mats} |`,
      )
    }
  }

  lines.push('')
  lines.push('## Scoring notes')
  lines.push('')
  lines.push(
    '- **Capture** scores notebook activity (Materials, Data, Figures, Lab Log, References, milestones).',
  )
  lines.push(
    '- **Writing & edits** compare each section to its last AI baseline (or award full credit for manual-only text).',
  )
  lines.push(
    '- **User effort** = 20 baseline + 80% × (40% capture + 60% writing/edits). Empty projects still produce this report starting at 20.',
  )
  lines.push('')

  return lines.join('\n')
}

/** Merge a new generation trace onto a draft patch payload. */
export function withGenerationTrace(
  existing: Draft | null | undefined,
  trace: GenerationTrace,
  content: string,
): Pick<
  Draft,
  | 'content'
  | 'humanEdited'
  | 'provider'
  | 'model'
  | 'aiBaselineContent'
  | 'generationTrace'
  | 'generationHistory'
> {
  const history = [...(existing?.generationHistory ?? [])]
  if (existing?.generationTrace) {
    const last = existing.generationTrace
    const already =
      history.length > 0 &&
      history[history.length - 1]?.generatedAt === last.generatedAt &&
      history[history.length - 1]?.agentId === last.agentId
    if (!already) history.push(last)
  }
  history.push(trace)
  while (history.length > TRACE_HISTORY_CAP) history.shift()

  return {
    content,
    humanEdited: false,
    provider: trace.provider,
    model: trace.model,
    aiBaselineContent: content,
    generationTrace: trace,
    generationHistory: history,
  }
}

export { TRACE_HISTORY_CAP }
