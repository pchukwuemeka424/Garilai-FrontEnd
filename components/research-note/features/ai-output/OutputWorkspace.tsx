import { useEffect, useMemo, useRef, useState } from 'react'
import {
  OUTPUT_TABS,
  PUBLICATION_SECTION_GUIDES,
  PUBLICATION_SECTIONS,
  isAutoManagedPublicationSection,
  isPlainPublicationSection,
  type OutputTabKey,
} from '@/components/research-note/config/branding'
import type { OutputType } from '@/components/research-note/storage/types'
import { useDrafts } from '@/components/research-note/state/useDrafts'
import { useCitationStyle } from '@/components/research-note/state/useCitationStyle'
import type { CitationStyle } from '@/components/research-note/features/references/citation'
import type { AISettings } from '@/components/research-note/ai/settings'
import {
  draftContentToMarkdown,
  draftContentToPlainText,
} from '@/components/research-note/lib/markdown'
import {
  DraftDocumentEditor,
  type DraftDocumentEditorHandle,
} from './DraftDocumentEditor'
import { InsertFigureModal } from './InsertFigureModal'
import { InsertCiteModal } from './InsertCiteModal'
import { assemblePublicationManuscript } from '@/components/research-note/ai/formatting'
import { syncPublicationReferences } from '@/components/research-note/ai/agents/syncPublicationReferences'
import { getAsset } from '@/components/research-note/storage/repositories'
import {
  EXPORT_LABELS,
  exportDraft,
  type ExportFormat,
} from '@/components/research-note/features/export/exporters'
import { TemplatesModal } from './TemplatesModal'
import { WorkspaceSaveButton } from '@/components/research-note/features/sync/CloudSave'
import {
  BookIcon,
  CloseIcon,
  ExportIcon,
  ImageIcon,
  InfoIcon,
  LightbulbIcon,
  ManuscriptIcon,
  TemplateIcon,
} from '@/components/research-note/components/icons'

const OUTPUT_KEYS = Object.keys(OUTPUT_TABS) as OutputTabKey[]
const EXPORT_FORMATS = Object.keys(EXPORT_LABELS) as ExportFormat[]

const FIGURE_SECTIONS = new Set([
  'Materials & Methods',
  'Results',
  'Discussion',
  'Supplementary',
])

const CITE_SECTIONS = new Set([
  'Introduction',
  'Literature Review',
  'Materials & Methods',
  'Results',
  'Discussion',
  'Conclusion',
])

const BODY_STYLE_SECTIONS = new Set([
  'Introduction',
  'Literature Review',
  'Materials & Methods',
  'Results',
  'Discussion',
  'Conclusion',
  'References',
  'Acknowledgements',
  'Supplementary',
  'Abstract',
])

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

/** Manuscript workspace: section drafts, insert tools, citation style, export. */
export function OutputWorkspace({
  projectId,
  settings,
  canWrite,
  author: _author,
  outputType: controlledOutput,
}: {
  projectId: string
  settings: AISettings
  canWrite: boolean
  author: string
  outputType?: OutputTabKey
}) {
  const drafts = useDrafts(projectId, settings)
  const citation = useCitationStyle(projectId)
  const editorRef = useRef<DraftDocumentEditorHandle | null>(null)
  const [internalOutput, setInternalOutput] = useState<OutputType>('publication')
  const activeOutput = controlledOutput ?? internalOutput
  const setActiveOutput = setInternalOutput
  const hideTypeTabs = Boolean(controlledOutput)
  const [activeSection, setActiveSection] = useState<string>(PUBLICATION_SECTIONS[0])
  const [formatError, setFormatError] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showFigurePicker, setShowFigurePicker] = useState(false)
  const [showCitePicker, setShowCitePicker] = useState(false)
  const [guideOpen, setGuideOpen] = useState(true)
  const [editorEpoch, setEditorEpoch] = useState(0)

  const isPublication = activeOutput === 'publication'
  const section = isPublication ? activeSection : null
  const draft = drafts.getDraft(activeOutput, section)
  const slotKey = drafts.slot(activeOutput, section)
  const isPlainField = isPlainPublicationSection(section)
  const isReferencesSection = isAutoManagedPublicationSection(section)
  const sectionGuide =
    isPublication && section ? PUBLICATION_SECTION_GUIDES[section] : null
  const showCiteTools = Boolean(section && CITE_SECTIONS.has(section))
  const showFigureTools = Boolean(section && FIGURE_SECTIONS.has(section))
  const showStyleTools = Boolean(section && BODY_STYLE_SECTIONS.has(section))
  const showTemplatesBtn = Boolean(
    canWrite && section && !isPlainField && section !== 'References',
  )

  const filledCount = useMemo(() => {
    if (!isPublication) return 0
    return PUBLICATION_SECTIONS.filter((sec) =>
      Boolean(draftContentToPlainText(drafts.getDraft(activeOutput, sec)?.content ?? '').trim()),
    ).length
  }, [isPublication, drafts, activeOutput])

  const plainText = draft ? draftContentToPlainText(draft.content) : ''
  const abstractWords = section === 'Abstract' ? wordCount(plainText) : 0
  const titleChars = section === 'Title' ? plainText.trim().length : 0

  useEffect(() => {
    if (!canWrite || drafts.loading) return
    if (drafts.getDraft(activeOutput, section)) return
    void drafts.addBlank(activeOutput, section)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canWrite, drafts.loading, activeOutput, section, draft?.id])

  const onCitationStyleChange = async (next: CitationStyle) => {
    if (!canWrite || citation.applying) return
    const ok = await citation.setStyle(next)
    if (!ok) return
    await drafts.reload()
    setEditorEpoch((n) => n + 1)
  }

  const onReformat = async () => {
    if (!canWrite || !isPublication || citation.applying) return
    setFormatError(null)
    const ok = await citation.reapplyStyle()
    if (!ok) return
    await drafts.reload()
    setEditorEpoch((n) => n + 1)
  }

  const baseName = `${OUTPUT_TABS[activeOutput as OutputTabKey] ?? activeOutput}${section ? '-' + section : ''}`

  const onExport = async (format: ExportFormat) => {
    setShowExport(false)
    if (draft?.content) await exportDraft(format, baseName, draftContentToMarkdown(draft.content))
  }

  const onExportManuscript = async (format: ExportFormat) => {
    setShowExport(false)
    const manuscript = await assemblePublicationManuscript(projectId)
    if (manuscript.trim()) {
      await exportDraft(format, 'Manuscript', draftContentToMarkdown(manuscript))
    }
  }

  const onInsertFigure = async (args: {
    asset: { id: string; name: string }
    src: string
    caption: string
  }) => {
    let src = args.src
    try {
      const fresh = await getAsset(args.asset.id)
      if (fresh) src = URL.createObjectURL(fresh.blob)
    } catch {
      /* fall back to modal src */
    }
    editorRef.current?.insertFigure({
      src,
      assetId: args.asset.id,
      alt: args.asset.name || 'Figure',
      caption: args.caption,
    })
  }

  const onInsertCite = async (args: {
    text: string
    source: import('@/components/research-note/ai/agents/citationBank').CiteSource
  }) => {
    editorRef.current?.insertText(args.text)
    try {
      await syncPublicationReferences(projectId, [args.source], 'manual', 'insert-cite', citation.style)
      await drafts.reload()
    } catch (err) {
      setFormatError(err instanceof Error ? err.message : 'Could not update References section.')
    }
  }

  return (
    <div className="rn-output">
      {!hideTypeTabs && (
        <div className="rn-output-type-tabs">
          {OUTPUT_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveOutput(key)}
              className={`rn-output-type-tab${activeOutput === key ? ' is-active' : ''}`}
            >
              {OUTPUT_TABS[key]}
            </button>
          ))}
        </div>
      )}

      <div className="rn-output-layout">
        {isPublication && (
          <aside className="rn-output-sections" aria-label="Manuscript sections">
            <div className="rn-output-sections-head">
              <ManuscriptIcon className="h-4 w-4" />
              <div>
                <span>Outline</span>
                <p>
                  {filledCount}/{PUBLICATION_SECTIONS.length} filled
                </p>
              </div>
            </div>
            <ol className="rn-output-section-list">
              {PUBLICATION_SECTIONS.map((sec, index) => {
                const active = sec === activeSection
                const filled = Boolean(
                  draftContentToPlainText(drafts.getDraft(activeOutput, sec)?.content ?? '').trim(),
                )
                return (
                  <li key={sec}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSection(sec)
                        setGuideOpen(true)
                      }}
                      className={`rn-output-section-item${active ? ' is-active' : ''}${filled ? ' is-filled' : ''}`}
                    >
                      <span className="rn-output-section-index" aria-hidden>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="rn-output-section-label">{sec}</span>
                      {filled && <span className="rn-output-section-dot" aria-label="Has content" />}
                    </button>
                  </li>
                )
              })}
            </ol>
          </aside>
        )}

        <div className="rn-output-stage">
          <div className="rn-output-chrome">
            <div className="rn-output-docbar">
              <div className="rn-output-docbar-copy">
                <p className="rn-output-eyebrow">Manuscript</p>
                <h3>{section ?? OUTPUT_TABS[activeOutput as OutputTabKey] ?? activeOutput}</h3>
              </div>
              <div className="rn-output-docbar-actions">
                {canWrite && showFigureTools && (
                  <button
                    type="button"
                    className="rn-workspace-btn rn-workspace-btn-ghost"
                    onClick={() => setShowFigurePicker(true)}
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    Figure
                  </button>
                )}
                {canWrite && showCiteTools && (
                  <button
                    type="button"
                    className="rn-workspace-btn rn-workspace-btn-ghost"
                    onClick={() => setShowCitePicker(true)}
                  >
                    <BookIcon className="h-3.5 w-3.5" />
                    Cite
                  </button>
                )}
                {canWrite && (
                  <WorkspaceSaveButton
                    label="Save"
                    onBeforeSave={() => drafts.flushPending()}
                    className="rn-workspace-btn rn-workspace-btn-ghost"
                  />
                )}
                {isReferencesSection && (
                  <span className="rn-output-auto-badge">
                    <InfoIcon className="h-3.5 w-3.5" />
                    Auto-updated
                  </span>
                )}
                <div className="rn-output-export">
                  <button
                    type="button"
                    onClick={() => setShowExport((v) => !v)}
                    disabled={!draft?.content && !isPublication}
                    className="rn-workspace-btn rn-workspace-btn-ghost"
                  >
                    <ExportIcon className="h-3.5 w-3.5" />
                    Export
                  </button>
                  {showExport && (
                    <div
                      className="rn-output-export-menu"
                      onMouseLeave={() => setShowExport(false)}
                    >
                      <p className="rn-output-export-label">This section</p>
                      {EXPORT_FORMATS.map((f) => (
                        <button
                          key={f}
                          type="button"
                          disabled={!draft?.content}
                          onClick={() => void onExport(f)}
                        >
                          {EXPORT_LABELS[f]}
                        </button>
                      ))}
                      {isPublication && (
                        <>
                          <p className="rn-output-export-label rn-output-export-label-split">
                            Full manuscript
                          </p>
                          {EXPORT_FORMATS.map((f) => (
                            <button
                              key={`m-${f}`}
                              type="button"
                              onClick={() => void onExportManuscript(f)}
                            >
                              {EXPORT_LABELS[f]}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {isPublication && showStyleTools && (
              <div className="rn-output-toolbar">
                <label className="rn-output-style-field">
                  <span>Style</span>
                  <select
                    value={citation.style}
                    disabled={!canWrite || citation.applying || !citation.loaded}
                    onChange={(e) => void onCitationStyleChange(e.target.value as CitationStyle)}
                    title="Updates in-text citations and the References section"
                  >
                    {citation.styleGroups.map((group) => (
                      <optgroup key={group.id} label={group.label}>
                        {group.styles.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                {showCiteTools && (
                  <button
                    type="button"
                    onClick={() => void onReformat()}
                    disabled={!canWrite || citation.applying || !citation.loaded}
                    className="rn-workspace-btn rn-workspace-btn-ghost"
                    title="Apply the selected reference style to in-text citations and References"
                  >
                    {citation.applying ? 'Updating…' : 'Reformat cites'}
                  </button>
                )}
                {showTemplatesBtn && (
                  <button
                    type="button"
                    onClick={() => setShowTemplates(true)}
                    className="rn-workspace-btn rn-workspace-btn-ghost rn-output-toolbar-push"
                  >
                    <TemplateIcon className="h-3.5 w-3.5" />
                    Templates
                  </button>
                )}
              </div>
            )}
          </div>

          {(drafts.error || formatError || citation.error) && (
            <p className="rn-workspace-alert" role="alert">
              {drafts.error || formatError || citation.error}
            </p>
          )}

          {!drafts.error &&
            !formatError &&
            drafts.lastLiteratureCount != null &&
            drafts.lastLiteratureCount > 0 && (
              <p className="rn-output-gen-meta" role="status">
                Grounded with {drafts.lastLiteratureCount} literature source
                {drafts.lastLiteratureCount === 1 ? '' : 's'}
                {drafts.lastReferencesSync
                  ? ` · References updated (${drafts.lastReferencesSync.total} total)`
                  : ''}
                . See Progress Reports → Effort & attribution for material usage.
              </p>
            )}

          {draft?.generationTrace && draft.generationTrace.materials.length > 0 && (
            <p className="rn-output-gen-meta" role="status">
              Last AI run used {draft.generationTrace.materials.length} material
              {draft.generationTrace.materials.length === 1 ? '' : 's'} via agent{' '}
              {draft.generationTrace.agentId}
              {draft.humanEdited ? ' · you have edited since' : ''}.
            </p>
          )}

          {!drafts.error &&
            !formatError &&
            !citation.error &&
            citation.lastApply &&
            isPublication &&
            showCiteTools && (
              <p className="rn-output-status">
                Style · {citation.styleLabel}
                {citation.lastApply.references > 0
                  ? ` · ${citation.lastApply.references} references synced`
                  : ''}
              </p>
            )}

          {guideOpen && sectionGuide && (
            <div className="rn-workspace-guide rn-output-section-guide" role="note">
              <LightbulbIcon className="rn-workspace-guide-icon" />
              <p>{sectionGuide}</p>
              <button
                type="button"
                className="rn-workspace-guide-dismiss"
                aria-label="Dismiss tip"
                onClick={() => setGuideOpen(false)}
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div
            className={[
              'rn-output-editor',
              !isPlainField ? 'rn-output-editor-rich' : 'rn-output-editor-plain',
            ].join(' ')}
          >
            {drafts.loading ? (
              <div className="rn-workspace-loading rn-workspace-loading-inline">
                <p>Opening document…</p>
              </div>
            ) : isPlainField ? (
              <PlainFieldPanel
                label={activeSection}
                placeholder={
                  activeSection === 'Title'
                    ? 'e.g. Artificial Intelligence in Higher Education'
                    : 'e.g. artificial intelligence, higher education, pedagogy, assessment'
                }
                value={plainText}
                canWrite={canWrite}
                titleChars={titleChars}
                onChange={(value) => {
                  drafts.editDraft(activeOutput, section, value)
                }}
              />
            ) : canWrite || draft ? (
              <>
                {section === 'Abstract' && (
                  <p className="rn-output-wordcount" aria-live="polite">
                    {abstractWords} word{abstractWords === 1 ? '' : 's'}
                    {abstractWords > 300 ? ' · long for most journals (aim 150–300)' : ''}
                    {abstractWords > 0 && abstractWords < 150 ? ' · often short of 150–300' : ''}
                  </p>
                )}
                <DraftDocumentEditor
                  key={`${slotKey}::${editorEpoch}`}
                  ref={editorRef}
                  content={draft?.content ?? ''}
                  onChange={(html) => drafts.editDraft(activeOutput, section, html)}
                  editable={canWrite && !isReferencesSection}
                />
              </>
            ) : (
              <div className="rn-notes-empty-select">
                <InfoIcon className="h-5 w-5" />
                <p>View-only — ask an editor to open this section.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <TemplatesModal projectId={projectId} open={showTemplates} onClose={() => setShowTemplates(false)} />
      <InsertFigureModal
        open={showFigurePicker}
        projectId={projectId}
        onClose={() => setShowFigurePicker(false)}
        onInsert={(args) => void onInsertFigure(args)}
      />
      <InsertCiteModal
        open={showCitePicker}
        projectId={projectId}
        style={citation.style}
        onClose={() => setShowCitePicker(false)}
        onInsert={(args) => void onInsertCite(args)}
      />
    </div>
  )
}

function PlainFieldPanel({
  label,
  placeholder,
  value,
  canWrite,
  titleChars,
  onChange,
}: {
  label: string
  placeholder: string
  value: string
  canWrite: boolean
  titleChars: number
  onChange: (value: string) => void
}) {
  const isTitle = label === 'Title'
  return (
    <div className={`rn-plain-field${isTitle ? ' rn-plain-field-title' : ''}`}>
      <div className="rn-plain-field-card">
        <label htmlFor="plain-draft-field">
          <span className="rn-plain-field-label">{label}</span>
        </label>
        {isTitle ? (
          <textarea
            id="plain-draft-field"
            value={value}
            readOnly={!canWrite}
            autoFocus={canWrite}
            rows={3}
            placeholder={placeholder}
            onChange={(e) => {
              if (!canWrite) return
              onChange(e.target.value)
            }}
            className="rn-plain-field-input rn-plain-field-title-input"
          />
        ) : (
          <input
            id="plain-draft-field"
            type="text"
            value={value}
            readOnly={!canWrite}
            autoFocus={canWrite}
            placeholder={placeholder}
            onChange={(e) => {
              if (!canWrite) return
              onChange(e.target.value)
            }}
            className="rn-plain-field-input"
          />
        )}
        <p className="rn-plain-field-meta">
          {canWrite ? 'Autosaves with the notebook.' : 'This field is view-only.'}
          {isTitle && titleChars > 0 ? ` · ${titleChars} characters` : ''}
        </p>
      </div>
    </div>
  )
}
