"use client";

import { Bot } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/portal/ui/card";
import { Badge } from "@/components/portal/ui/badge";
import { EmptyState } from "@/components/portal/feedback/empty-state";
import type { AreaScores } from "@/lib/portal/apply-highlights";

export type CorrectionFindingView = {
  id?: string;
  area?: string;
  severity?: "high" | "medium" | "low" | string;
  finding?: string;
  correction?: string;
};

export type CorrectionCheckView = {
  findingId?: string;
  area?: string;
  finding?: string;
  correction?: string;
  status?: "addressed" | "partial" | "not_addressed" | string;
  evidence?: string;
};

export type AiReportData = {
  executiveSummary?: string;
  strengths?: string[];
  weaknesses?: string[];
  /** Research gaps / missing contributions identified by AI Reviewer. */
  researchGaps?: string[];
  /** Ordered fix list for the lecturer / student. */
  revisionPriorities?: string[];
  /** Structured findings the student must correct. */
  correctionFindings?: CorrectionFindingView[];
  /** Prose digest of findings for lecturer remarks. */
  correctionSummary?: string;
  /** Proper continuous supervisor report (preferred display). */
  reviewerReport?: string;
  /** Hide topic-alignment UI for chapter research reviews. */
  hideTopicAlignment?: boolean;
  /** Re-review verification of prior saved findings. */
  correctionChecks?: CorrectionCheckView[];
  addressedCount?: number;
  partialCount?: number;
  outstandingCount?: number;
  priorFindingsCount?: number;
  highlightQuotes?: {
    weaknesses?: string[];
    citations?: string[];
  };
  areaScores?: AreaScores;
  estimatedGrade?: string;
  supervisorRecommendation?: string;
  /** approve | request_revision lean from chapter pipeline. */
  decisionLean?: "approve" | "request_revision";
  writingSuggestions?: string[];
  readabilityScore?: number;
  criticalThinkingScore?: number;
  projectTopic?: string | null;
  topicAlignment?: {
    topic?: string | null;
    score?: number | null;
    notes?: string[];
  };
  /** AI-generated content detection for assignment reviews. */
  aiContent?: {
    detected?: boolean;
    percent?: number;
    signals?: string[];
  };
  /** Suggested mark out of maxScore (lecturer must approve). */
  aiSuggestedScore?: number;
  maxScore?: number;
  /**
   * Overall summary of what was noted — lecturer-facing prose for remarks.
   */
  remarksSummary?: string;
  /** Must-include checklist scored against the lecturer brief. */
  requirementChecks?: Array<{
    item: string;
    met: boolean;
    note: string;
  }>;
  /** Rubric criterion scores that form the AI overall mark. */
  criterionScores?: Array<{
    name: string;
    score: number;
    maxMarks: number;
    comment?: string;
  }>;
  /** Universal academic quality diagnostics (0–100), any discipline. */
  qualityChecks?: Array<{
    name: string;
    score: number;
    comment?: string;
  }>;
  /** Assignment Review Agent v2 gate classification. */
  assignmentStatus?:
    | "FULL_MATCH"
    | "PARTIAL_MATCH"
    | "WEAK_MATCH"
    | "OUT_OF_SCOPE";
  /** Gatekeeper details when assignment review ran. */
  assignmentGate?: {
    confidence?: string;
    expectedDiscipline?: string;
    detectedDiscipline?: string;
    reason?: string;
    assignmentIntentMatch?: number;
    learningOutcomeMatch?: number;
    knowledgeDomainMatch?: number;
    conceptMatch?: number;
    semanticSimilarity?: number;
    overallTopicAlignment?: number;
  };
  /** True when Gatekeeper hard-stopped before rubric marking. */
  markingSkipped?: boolean;
  promptVersion?: string;
  /** Optional pipeline stage summary from assignment / chapter AI review. */
  pipelineStages?: {
    normalize?: { wordCount?: number; tooShort?: boolean };
    structure?: { score?: number; missingSections?: string[] };
    topicAlignment?: {
      score?: number;
      notes?: string[];
      coverage?: number;
    };
    evidence?: { score?: number; citationCount?: number };
    academic?: {
      criticalThinkingScore?: number;
      methodologyScore?: number;
      literatureScore?: number;
      researchGapScore?: number;
    };
    risks?: { aiPercent?: number; riskCount?: number };
    instructionCompliance?: {
      requirementsMetCount?: number;
      requirementsTotal?: number;
      instructionCoverage?: number;
    };
    scoring?: { aiSuggestedScore?: number; estimatedGrade?: string };
    gate?: {
      classification?: string;
      shouldStopMarking?: boolean;
      overallTopicAlignment?: number;
      knowledgeDomainMatch?: number;
      learningOutcomeMatch?: number;
    };
    agents?: {
      gatekeeper?: string;
      marker?: string;
      moderator?: string;
    };
  };
};

type Props = {
  report?: AiReportData | null;
  status?: string;
  meta?: string;
};

export function AIReportPanel({ report, status, meta }: Props) {
  if (!report) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="size-5 text-primary" />
            AI feedback report
          </CardTitle>
          <CardDescription>
            Structured review output for the selected chapter version
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No AI report"
            description="Reports are generated after a chapter submission is reviewed by AI."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-5 text-primary" />
              AI feedback report
            </CardTitle>
            <CardDescription>
              {meta || "Structured review for your submission"}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {status && <Badge variant="neutral">{status}</Badge>}
            {report.assignmentStatus && (
              <Badge
                variant={
                  report.assignmentStatus === "FULL_MATCH"
                    ? "success"
                    : report.assignmentStatus === "PARTIAL_MATCH"
                      ? "warning"
                      : "danger"
                }
              >
                {report.assignmentStatus.replace(/_/g, " ")}
              </Badge>
            )}
            {report.markingSkipped && (
              <Badge variant="danger">Marking skipped</Badge>
            )}
            {report.aiSuggestedScore != null && report.maxScore != null && (
              <Badge variant="default">
                {report.markingSkipped ? "Recommended" : "AI mark"}{" "}
                {report.aiSuggestedScore}/{report.maxScore}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {report.markingSkipped && report.assignmentGate && (
          <div className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-danger/80">
              Assignment validation — marking stopped
            </p>
            <p className="mt-2 text-foreground/85">
              {report.assignmentGate.reason ||
                "Submission does not attempt the assigned task."}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-foreground/60">
              {report.assignmentGate.expectedDiscipline && (
                <span>
                  Expected: {report.assignmentGate.expectedDiscipline}
                </span>
              )}
              {report.assignmentGate.detectedDiscipline && (
                <span>
                  Detected: {report.assignmentGate.detectedDiscipline}
                </span>
              )}
              {report.assignmentGate.confidence && (
                <span>Confidence: {report.assignmentGate.confidence}</span>
              )}
            </div>
            <p className="mt-2 text-[11px] text-foreground/50">
              Rubric / grammar / referencing were not graded. Recommended mark
              is in the 0–15% institutional band.
            </p>
          </div>
        )}

        {!report.markingSkipped && report.assignmentGate && (
          <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
              Assignment Intelligence gate
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {report.assignmentGate.overallTopicAlignment != null && (
                <Badge variant="neutral">
                  Topic {report.assignmentGate.overallTopicAlignment}/100
                </Badge>
              )}
              {report.assignmentGate.knowledgeDomainMatch != null && (
                <Badge variant="neutral">
                  Domain {report.assignmentGate.knowledgeDomainMatch}/100
                </Badge>
              )}
              {report.assignmentGate.learningOutcomeMatch != null && (
                <Badge variant="neutral">
                  Outcomes {report.assignmentGate.learningOutcomeMatch}/100
                </Badge>
              )}
            </div>
          </div>
        )}

        {(report.reviewerReport ||
          report.correctionSummary ||
          report.remarksSummary) && (
          <div className="rounded-xl border border-border bg-muted/40 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
              {report.reviewerReport
                ? "Reviewer report"
                : "Supervisor remarks (draft)"}
            </p>
            <div className="mt-2 space-y-3 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/85">
              {(report.reviewerReport ||
                report.correctionSummary ||
                report.remarksSummary ||
                "")
                .split(/\n\n+/)
                .map((para) => para.trim())
                .filter(Boolean)
                .map((para) => (
                  <p key={para.slice(0, 48)}>{para}</p>
                ))}
            </div>
          </div>
        )}

        {(report.aiSuggestedScore != null || report.aiContent != null) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {report.aiSuggestedScore != null && (
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
                  {report.markingSkipped ? "Recommended mark" : "AI verdict"}
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums">
                  {report.aiSuggestedScore}
                  <span className="text-sm font-semibold text-foreground/40">
                    /{report.maxScore ?? 100}
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] text-foreground/50">
                  {report.markingSkipped
                    ? "Out-of-scope / weak-match band — lecturer must approve"
                    : "Suggested mark — lecturer must approve"}
                </p>
              </div>
            )}
            {report.aiContent != null && !report.markingSkipped && (
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
                  AI-generated content
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums">
                  {report.aiContent.percent ?? 0}
                  <span className="text-sm font-semibold text-foreground/40">
                    %
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] text-foreground/50">
                  {report.aiContent.detected
                    ? "AI writing signals detected"
                    : "No strong AI signals"}
                </p>
              </div>
            )}
          </div>
        )}

        {report.pipelineStages &&
          (report.pipelineStages.structure ||
            report.pipelineStages.evidence ||
            report.pipelineStages.instructionCompliance) && (
            <div className="flex flex-wrap gap-2">
              {report.pipelineStages.structure?.score != null && (
                <Badge variant="neutral">
                  Structure {report.pipelineStages.structure.score}/100
                </Badge>
              )}
              {!report.hideTopicAlignment &&
                !report.reviewerReport &&
                report.pipelineStages.topicAlignment?.score != null && (
                <Badge variant="neutral">
                  Topic {report.pipelineStages.topicAlignment.score}/100
                </Badge>
              )}
              {report.pipelineStages.evidence?.score != null && (
                <Badge variant="neutral">
                  Citations {report.pipelineStages.evidence.score}/100
                  {report.pipelineStages.evidence.citationCount != null
                    ? ` · ${report.pipelineStages.evidence.citationCount} hits`
                    : ""}
                </Badge>
              )}
              {report.pipelineStages.academic?.criticalThinkingScore !=
                null && (
                <Badge variant="neutral">
                  Critical{" "}
                  {report.pipelineStages.academic.criticalThinkingScore}/100
                </Badge>
              )}
              {report.pipelineStages.instructionCompliance && (
                <Badge variant="neutral">
                  Must-include{" "}
                  {report.pipelineStages.instructionCompliance
                    .requirementsMetCount ?? 0}
                  /
                  {report.pipelineStages.instructionCompliance
                    .requirementsTotal ?? 0}
                </Badge>
              )}
              {report.pipelineStages.normalize?.wordCount != null && (
                <Badge variant="neutral">
                  {report.pipelineStages.normalize.wordCount} words
                </Badge>
              )}
            </div>
          )}

        {!report.reviewerReport &&
          report.revisionPriorities &&
          report.revisionPriorities.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
                Revision priorities
              </p>
              <ol className="list-decimal space-y-1.5 pl-4 text-foreground/80">
                {report.revisionPriorities.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
          )}

        {!report.hideTopicAlignment &&
          !report.reviewerReport &&
          (report.projectTopic || report.topicAlignment?.topic) && (
          <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
              Lecturer topic analysed
            </p>
            <p className="mt-1 text-foreground/80">
              {report.projectTopic || report.topicAlignment?.topic}
            </p>
            {report.topicAlignment?.score != null && (
              <p className="mt-1 text-xs text-foreground/55">
                Topic alignment {report.topicAlignment.score}/100
              </p>
            )}
          </div>
        )}
        {report.aiContent?.signals && report.aiContent.signals.length > 0 && (
          <ScoreList
            title="AI detection signals"
            items={report.aiContent.signals}
            score={report.aiContent.percent}
          />
        )}
        {report.executiveSummary && !report.reviewerReport && (
          <p className="text-foreground/75">{report.executiveSummary}</p>
        )}

        {report.requirementChecks && report.requirementChecks.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
              Must include vs submission
            </p>
            <ul className="space-y-1.5">
              {report.requirementChecks.map((check) => (
                <li
                  key={check.item}
                  className="flex flex-wrap items-start gap-2 text-foreground/75"
                >
                  <Badge variant={check.met ? "success" : "danger"}>
                    {check.met ? "Met" : "Missing"}
                  </Badge>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{check.item}</span>
                    {check.note ? (
                      <span className="block text-xs text-foreground/50">
                        {check.note}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.criterionScores &&
          report.criterionScores.length > 0 &&
          !report.markingSkipped && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
              AI rubric scores
            </p>
            <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
              {report.criterionScores.map((row) => (
                <div
                  key={row.name}
                  className="flex flex-wrap items-baseline justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground/80">
                      {row.name}
                    </p>
                    {row.comment ? (
                      <p className="text-[11px] text-foreground/50">
                        {row.comment}
                      </p>
                    ) : null}
                  </div>
                  <p className="tabular-nums text-sm font-semibold">
                    {row.score}/{row.maxMarks}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        {report.markingSkipped && (
          <p className="text-xs text-foreground/55">
            Rubric criterion scores were not assessed because marking was
            stopped at the Assignment Intelligence gate.
          </p>
        )}

        {!report.reviewerReport && (
        <div className="grid gap-4 md:grid-cols-2">
          <ScoreList
            title="Weaknesses"
            items={report.weaknesses}
            score={report.areaScores?.weaknesses}
          />
          <ScoreList
            title="Research gaps"
            items={report.researchGaps}
          />
          {!report.hideTopicAlignment &&
            report.topicAlignment?.notes &&
            report.topicAlignment.notes.length > 0 && (
              <ScoreList
                title="Topic alignment notes"
                items={report.topicAlignment.notes}
                score={report.topicAlignment.score ?? undefined}
              />
            )}
        </div>
        )}
        {!report.reviewerReport &&
          (report.readabilityScore != null ||
            report.criticalThinkingScore != null) && (
          <p className="text-xs text-foreground/55">
            Readability {report.readabilityScore ?? "—"} · Critical thinking{" "}
            {report.criticalThinkingScore ?? "—"}
          </p>
        )}
        {report.supervisorRecommendation && !report.reviewerReport && (
          <div className="rounded-xl bg-muted/40 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
              Supervisor recommendation
            </p>
            <p className="mt-1">{report.supervisorRecommendation}</p>
          </div>
        )}
        {report.writingSuggestions &&
          report.writingSuggestions.length > 0 &&
          !report.reviewerReport && (
          <ScoreList
            title="Writing suggestions"
            items={report.writingSuggestions}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ScoreList({
  title,
  items,
  score,
}: {
  title: string;
  items?: string[];
  score?: number;
}) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-foreground/45">
        <span>{title}</span>
        {score != null && (
          <span className="tabular-nums text-foreground/70">{score}/100</span>
        )}
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="text-foreground/75">
            · {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
