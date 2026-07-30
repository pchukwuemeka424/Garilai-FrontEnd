export const DRAFT_FROM_NOTE_KEY = 'rn-draft-from-note'

export type DraftFromNotePayload = {
  projectId: string
  pageId: string
  pageTitle: string
  section?: string
}
