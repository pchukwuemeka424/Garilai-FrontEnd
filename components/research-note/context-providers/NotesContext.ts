import { getPage, listPages } from '@/components/research-note/storage/repositories'
import { docToPlainText } from './extractors'

/**
 * NotesContext — the researcher's notes/pages as plain text for the AI.
 *
 * Shaped as a standalone async fetcher so it can be re-exposed as an MCP
 * resource later with no refactor (spec §5a).
 *
 * When `preferPageId` is set (Draft from note), that page is listed first under
 * a focus heading and other pages follow as secondary context.
 */
export async function getNotesContext(
  projectId: string,
  options?: { preferPageId?: string | null },
): Promise<string> {
  const pages = await listPages(projectId)
  const preferId = options?.preferPageId?.trim() || null

  if (preferId) {
    const focus =
      pages.find((p) => p.id === preferId) ?? (await getPage(preferId))
    if (focus && focus.projectId === projectId) {
      const focusBody = docToPlainText(focus.content)
      const others = pages
        .filter((p) => p.id !== preferId)
        .map((p) => {
          const body = docToPlainText(p.content)
          if (!body) return ''
          return `### ${p.title}\n${body}`
        })
        .filter(Boolean)
      const parts = [
        '## Materials (focused note)',
        `### ${focus.title || 'Untitled page'}\n${focusBody || '(empty note)'}`,
      ]
      if (others.length > 0) {
        parts.push('## Other Materials', others.join('\n\n'))
      }
      return parts.join('\n\n')
    }
  }

  const blocks = pages
    .map((p) => {
      const body = docToPlainText(p.content)
      if (!body) return ''
      return `### ${p.title}\n${body}`
    })
    .filter(Boolean)
  if (blocks.length === 0) return ''
  return `## Materials\n\n${blocks.join('\n\n')}`
}
