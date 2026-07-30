import { useCallback, useEffect, useState } from 'react'
import {
  EXPORT_LABELS,
  exportDraft,
  type ExportFormat,
} from '@/components/research-note/features/export/exporters'
import {
  bandLabel,
  composeEffortReportMarkdown,
  computeEffortReport,
  type EffortReportSnapshot,
} from '@/components/research-note/features/effort/effortMetrics'
import {
  DownloadIcon,
  ExportIcon,
  FlaskIcon,
  ImageIcon,
  ManuscriptIcon,
  NotebookIcon,
  ReportIcon,
  TableIcon,
} from '@/components/research-note/components/icons'

const EXPORT_FORMATS: ExportFormat[] = ['pdf', 'docx', 'md']

const CHANNEL_ICON: Record<string, typeof NotebookIcon> = {
  notes: NotebookIcon,
  data: TableIcon,
  figures: ImageIcon,
  labLog: FlaskIcon,
  drafts: ManuscriptIcon,
}

/**
 * Live effort / attribution panel. Always downloadable — even when the project
 * has no uploads or edits (scores report as zero with an empty-baseline narrative).
 */
export function EffortReportPanel({
  projectId,
  refreshKey = 0,
}: {
  projectId: string
  /** Bump to force a recompute after generate/edit/save. */
  refreshKey?: string | number
}) {
  const [report, setReport] = useState<EffortReportSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [showExport, setShowExport] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await computeEffortReport(projectId)
      setReport(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build effort report.')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void refresh()
  }, [refresh, refreshKey])

  const onExport = async (format: ExportFormat) => {
    setShowExport(false)
    if (!report || exporting) return
    setExporting(true)
    try {
      const md = composeEffortReportMarkdown(report)
      const base = `${report.projectTitle || 'Project'}-Effort-Report`
      await exportDraft(format, base, md)
    } finally {
      setExporting(false)
    }
  }

  if (loading && !report) {
    return (
      <section className="rn-effort rn-progress-card">
        <h4>Effort & attribution</h4>
        <p className="rn-effort-muted">Computing effort report…</p>
      </section>
    )
  }

  if (error && !report) {
    return (
      <section className="rn-effort rn-progress-card">
        <h4>Effort & attribution</h4>
        <p className="rn-workspace-alert" role="alert">
          {error}
        </p>
        <button type="button" className="rn-workspace-btn rn-workspace-btn-ghost" onClick={() => void refresh()}>
          Retry
        </button>
      </section>
    )
  }

  if (!report) return null

  return (
    <section className="rn-effort rn-progress-card">
      <div className="rn-effort-head">
        <div>
          <h4>
            <ReportIcon className="h-3.5 w-3.5" aria-hidden />
            Effort & attribution
          </h4>
          <p className="rn-effort-muted">
            How agents used your uploads, and how much you contributed via capture and edits.
            Downloadable even when empty.
          </p>
        </div>
        <div className="rn-effort-actions">
          <button
            type="button"
            className="rn-workspace-btn rn-workspace-btn-ghost"
            onClick={() => void refresh()}
            disabled={loading}
          >
            Refresh
          </button>
          <div className="rn-output-export">
            <button
              type="button"
              className="rn-workspace-btn rn-workspace-btn-primary"
              disabled={exporting}
              onClick={() => setShowExport((v) => !v)}
            >
              <DownloadIcon className="h-3.5 w-3.5" aria-hidden />
              {exporting ? 'Exporting…' : 'Download report'}
            </button>
            {showExport && (
              <div className="rn-output-export-menu" onMouseLeave={() => setShowExport(false)}>
                {EXPORT_FORMATS.map((f) => (
                  <button key={f} type="button" onClick={() => void onExport(f)}>
                    <ExportIcon className="h-3.5 w-3.5" aria-hidden />
                    {EXPORT_LABELS[f]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rn-effort-scores">
        <div className="rn-effort-score is-user">
          <span className="rn-effort-score-value">{report.userEffortScore}</span>
          <span className="rn-effort-score-label">User effort</span>
          <span className="rn-effort-score-band">{bandLabel(report.userBand)}</span>
        </div>
        <div className="rn-effort-score">
          <span className="rn-effort-score-value">{report.captureScore}</span>
          <span className="rn-effort-score-label">Capture</span>
        </div>
        <div className="rn-effort-score">
          <span className="rn-effort-score-value">{report.writingScore}</span>
          <span className="rn-effort-score-label">Writing / edits</span>
        </div>
        <div className="rn-effort-score is-ai">
          <span className="rn-effort-score-value">{report.aiShareScore}</span>
          <span className="rn-effort-score-label">AI text share</span>
        </div>
      </div>

      <ul className="rn-effort-summary">
        {report.summaryLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <div className="rn-effort-grid">
        <div>
          <h5>Captured materials</h5>
          {report.inventory.length === 0 ? (
            <p className="rn-effort-muted">None yet — uploads and notes will appear here.</p>
          ) : (
            <ul className="rn-effort-list">
              {report.inventory.slice(0, 12).map((m) => {
                const Icon = CHANNEL_ICON[m.channel] ?? NotebookIcon
                return (
                  <li key={`${m.channel}-${m.id}`}>
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    <span className="rn-effort-channel">[{m.channel}]</span>
                    <span>{m.title}</span>
                  </li>
                )
              })}
              {report.inventory.length > 12 ? (
                <li className="rn-effort-muted">+{report.inventory.length - 12} more in the download</li>
              ) : null}
            </ul>
          )}
        </div>
        <div>
          <h5>Used by agents</h5>
          {report.materialsCitedByAgents.length === 0 ? (
            <p className="rn-effort-muted">
              No generation traces yet. Generate a Manuscript section to record which materials the
              agents read.
            </p>
          ) : (
            <ul className="rn-effort-list">
              {report.materialsCitedByAgents.slice(0, 12).map((m) => (
                <li key={`used-${m.channel}-${m.id}`}>
                  <span className="rn-effort-channel">[{m.channel}]</span>
                  <span>{m.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {report.sections.length > 0 && (
        <div className="rn-effort-sections">
          <h5>Section contribution</h5>
          <div className="rn-effort-table-wrap">
            <table className="rn-effort-table">
              <thead>
                <tr>
                  <th>Section</th>
                  <th>User %</th>
                  <th>AI %</th>
                  <th>Edited</th>
                </tr>
              </thead>
              <tbody>
                {report.sections.map((s) => (
                  <tr key={`${s.outputType}-${s.section ?? ''}`}>
                    <td>
                      {s.label}
                      {s.wordCount > 0 ? (
                        <span className="rn-effort-muted"> · {s.wordCount} words</span>
                      ) : null}
                    </td>
                    <td>{s.userShare}</td>
                    <td>{s.aiShare}</td>
                    <td>{s.humanEdited ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

/** One-shot download helper for the notebook top nav (always works). */
export async function downloadEffortReport(
  projectId: string,
  format: ExportFormat = 'pdf',
): Promise<void> {
  const report = await computeEffortReport(projectId)
  const md = composeEffortReportMarkdown(report)
  await exportDraft(format, `${report.projectTitle || 'Project'}-Effort-Report`, md)
}
