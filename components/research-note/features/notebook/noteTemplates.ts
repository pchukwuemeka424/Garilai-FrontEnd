import type { RichTextDoc } from '@/components/research-note/storage/types'

export type NoteTemplateId = 'blank' | 'literature' | 'meeting' | 'experiment'

export type NoteTemplate = {
  id: NoteTemplateId
  label: string
  description: string
  title: string
  tags: string[]
  content: RichTextDoc
}

function heading(text: string, level: 2 | 3 = 2) {
  return {
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text }],
  }
}

function paragraph(text = '') {
  return text
    ? { type: 'paragraph', content: [{ type: 'text', text }] }
    : { type: 'paragraph' }
}

function bullet(text: string) {
  return {
    type: 'listItem',
    content: [paragraph(text)],
  }
}

/** Built-in Materials page templates (not the AI journal/thesis upload templates). */
export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'blank',
    label: 'Blank note',
    description: 'Empty page — start from scratch',
    title: 'Untitled page',
    tags: [],
    content: { type: 'doc', content: [paragraph()] },
  },
  {
    id: 'literature',
    label: 'Literature note',
    description: 'Citation, summary, quotes, and critique',
    title: 'Literature note',
    tags: ['literature'],
    content: {
      type: 'doc',
      content: [
        heading('Source'),
        paragraph('Author(s), year, title, DOI / link'),
        heading('Summary'),
        paragraph('What is the main claim or finding?'),
        heading('Key quotes'),
        {
          type: 'bulletList',
          content: [bullet('“…” — page/para'), bullet('')],
        },
        heading('Critique / relevance'),
        paragraph('How does this relate to your research question?'),
      ],
    },
  },
  {
    id: 'meeting',
    label: 'Meeting note',
    description: 'Agenda, decisions, and action items',
    title: 'Meeting note',
    tags: ['meeting'],
    content: {
      type: 'doc',
      content: [
        heading('Attendees'),
        paragraph(''),
        heading('Agenda'),
        {
          type: 'bulletList',
          content: [bullet(''), bullet('')],
        },
        heading('Decisions'),
        {
          type: 'bulletList',
          content: [bullet('')],
        },
        heading('Action items'),
        {
          type: 'bulletList',
          content: [bullet('Owner — task — due date')],
        },
      ],
    },
  },
  {
    id: 'experiment',
    label: 'Experiment plan',
    description: 'Hypothesis, protocol, and expected results',
    title: 'Experiment plan',
    tags: ['methods', 'experiment'],
    content: {
      type: 'doc',
      content: [
        heading('Objective / hypothesis'),
        paragraph(''),
        heading('Materials'),
        {
          type: 'bulletList',
          content: [bullet('')],
        },
        heading('Protocol'),
        {
          type: 'orderedList',
          content: [bullet(''), bullet('')],
        },
        heading('Expected results'),
        paragraph(''),
        heading('Risks / controls'),
        paragraph(''),
      ],
    },
  },
]

export function getNoteTemplate(id: NoteTemplateId): NoteTemplate {
  return NOTE_TEMPLATES.find((t) => t.id === id) ?? NOTE_TEMPLATES[0]!
}
