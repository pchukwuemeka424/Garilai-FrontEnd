import {
  listAssets,
  listDatasets,
  listLabEntries,
  listPages,
  listReferences,
  listTemplates,
} from '@/components/research-note/storage/repositories'
import { docToPlainText } from '@/components/research-note/context-providers/extractors'
import type {
  MaterialChannel,
  MaterialUsageItem,
} from '@/components/research-note/storage/types'
import type { MaterialSource } from '@/components/research-note/ai/agents/types'
import type { AgentMaterialSlices } from '@/components/research-note/context-providers'

/** All local notebook materials that can ground an agent prompt. */
export async function listMaterialInventory(
  projectId: string,
): Promise<MaterialUsageItem[]> {
  const [pages, datasets, assets, labEntries, references, templates] =
    await Promise.all([
      listPages(projectId),
      listDatasets(projectId),
      listAssets(projectId),
      listLabEntries(projectId),
      listReferences(projectId),
      listTemplates(projectId),
    ])

  const items: MaterialUsageItem[] = []

  for (const p of pages) {
    const body = docToPlainText(p.content)
    if (!body.trim() && !p.sourceFileName) continue
    items.push({
      channel: 'notes',
      id: p.id,
      title: p.title || p.sourceFileName || 'Untitled note',
      chars: body.length,
    })
  }

  for (const d of datasets) {
    const cells = d.rows.reduce((n, r) => n + Object.keys(r.cells).length, 0)
    items.push({
      channel: 'data',
      id: d.id,
      title: d.name || d.sourceFileName || 'Untitled dataset',
      chars: Math.max(cells * 4, d.name.length),
    })
  }

  for (const a of assets) {
    items.push({
      channel: 'figures',
      id: a.id,
      title: a.caption?.trim() || a.name || 'Untitled figure',
      chars: (a.caption?.length ?? 0) + a.name.length,
    })
  }

  for (const e of labEntries) {
    if (!e.text.trim()) continue
    items.push({
      channel: 'labLog',
      id: e.id,
      title: e.text.trim().slice(0, 72) || 'Lab entry',
      chars: e.text.length,
    })
  }

  for (const r of references) {
    items.push({
      channel: 'references',
      id: r.id,
      title: r.title || r.doi || 'Untitled reference',
      chars: (r.title?.length ?? 0) + (r.abstract?.length ?? 0),
    })
  }

  for (const t of templates) {
    items.push({
      channel: 'templates',
      id: t.id,
      title: t.name || 'Template',
      chars: t.content.length,
    })
  }

  return items
}

/**
 * Pick inventory rows that matched the agent's non-empty read channels,
 * plus optional literature bank entries and style templates.
 */
export function materialsUsedForGeneration(input: {
  inventory: MaterialUsageItem[]
  agents: AgentMaterialSlices
  reads: MaterialSource[]
  hasTemplate: boolean
  literatureCount: number
  citeTitles?: string[]
}): {
  channelsUsed: MaterialChannel[]
  materials: MaterialUsageItem[]
} {
  const channelHasContent: Record<MaterialSource, boolean> = {
    notes: Boolean(input.agents.notes.trim()),
    data: Boolean(input.agents.data.trim()),
    figures: Boolean(input.agents.figures.trim()),
    labLog: Boolean(input.agents.labLog.trim()),
    references: Boolean(input.agents.references.trim()),
    drafts: Boolean(input.agents.drafts.trim()),
  }

  const channelsUsed: MaterialChannel[] = input.reads.filter(
    (r) => channelHasContent[r],
  )

  const materials = input.inventory.filter(
    (m) => m.channel !== 'templates' && m.channel !== 'literature' && channelsUsed.includes(m.channel),
  )

  if (input.hasTemplate) {
    const templates = input.inventory.filter((m) => m.channel === 'templates')
    for (const t of templates) materials.push(t)
    if (templates.length > 0) channelsUsed.push('templates')
  }

  if (input.literatureCount > 0) {
    channelsUsed.push('literature')
    const titles = input.citeTitles?.filter(Boolean) ?? []
    if (titles.length > 0) {
      for (let i = 0; i < titles.length; i++) {
        materials.push({
          channel: 'literature',
          id: `lit-${i + 1}`,
          title: titles[i]!,
          chars: 0,
        })
      }
    } else {
      materials.push({
        channel: 'literature',
        id: 'lit-bank',
        title: `${input.literatureCount} research API paper(s)`,
        chars: 0,
      })
    }
  }

  return { channelsUsed, materials }
}
