"use client";

import { useMemo } from "react";
import {
	officialReportFromPaper,
	type OfficialEffortReportInput,
} from "@/lib/garil-user-effort-score-docx";
import type { PaperAuthorProfile, PaperEffortSnapshot } from "@/lib/research-paper-effort";
import type { PaperEffortEvidence } from "@/lib/research-paper-effort-evidence";
import type { ResearchSourceSelection } from "@/lib/research-assets-api";

export type EffortReportBodyProps = {
	title: string;
	topic: string;
	effort: PaperEffortSnapshot;
	author: PaperAuthorProfile;
	paperId?: string;
	createdAt?: string;
	sources?: ResearchSourceSelection | null;
	evidence?: PaperEffortEvidence | null;
	report?: OfficialEffortReportInput | null;
};

function formatCompiledDateTime(date: Date): string {
	try {
		const dateStr = date.toLocaleDateString("en-GB", {
			day: "numeric",
			month: "long",
			year: "numeric",
		});
		const timeStr = date.toLocaleTimeString("en-GB", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		});
		return `${dateStr} at ${timeStr}`;
	} catch {
		return date.toLocaleString();
	}
}

export function EffortReportBody({
	title,
	topic,
	effort,
	author,
	paperId,
	createdAt,
	sources,
	evidence,
	report: providedReport,
}: EffortReportBodyProps) {
	const report = useMemo(() => {
		if (providedReport) return providedReport;
		return officialReportFromPaper({
			title,
			topic,
			paperId,
			createdAt,
			effort,
			author,
			sources,
			evidence,
		});
	}, [providedReport, title, topic, paperId, createdAt, effort, author, sources, evidence]);

	const compiledDateFormatted = useMemo(() => {
		return formatCompiledDateTime(report.compiledAt ? new Date(report.compiledAt) : new Date());
	}, [report.compiledAt]);

	const submissionDetails: Array<[string, string]> = [
		["Researcher", report.researcherName || "—"],
		["Student / Staff ID", report.studentStaffId || "—"],
		["Institution", report.institution || "—"],
		["Faculty / Department", report.facultyDepartment || "—"],
		["Research submission title", report.submissionTitle || "—"],
		["Notebook", report.notebookTitle || "—"],
		["Research sprint", report.sprintLabel || "—"],
	];

	return (
		<article className="official-effort-doc" aria-label="Official User Effort Score Record">
			{/* Header Navy Banner with Gold Bar */}
			<header className="official-effort-header">
				<div className="official-effort-kicker">GARIL AI · RESEARCH ASSISTANT</div>
				<h1 className="official-effort-title">User Effort Score</h1>
				<p className="official-effort-subtitle">
					Official record of the researcher’s own input into the final research
				</p>
			</header>

			{/* Meta strip */}
			<div className="official-effort-meta-strip">
				<span className="official-effort-meta-compiled">
					Compiled {compiledDateFormatted}
				</span>
				<span className="official-effort-meta-classification">
					Classification: official · submit with the research
				</span>
			</div>

			<div className="official-effort-content">
				{/* Section 1: Submission details */}
				<section className="official-effort-section">
					<h2 className="official-effort-heading">Submission details</h2>
					<div className="official-effort-heading-rule" />

					<div className="official-effort-table-wrap">
						<table className="official-effort-details-table">
							<tbody>
								{submissionDetails.map(([label, value], idx) => (
									<tr key={label} className={idx % 2 === 0 ? "is-even" : "is-odd"}>
										<th scope="row" className="official-detail-label">
											{label}
										</th>
										<td className="official-detail-value">{value}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>

				{/* Section 2: User effort score */}
				<section className="official-effort-section">
					<h2 className="official-effort-heading">User effort score</h2>
					<div className="official-effort-heading-rule" />

					<div className="official-effort-cards-grid">
						<div className="official-effort-card is-overall">
							<div className="official-effort-card-value">{report.overallScore}%</div>
							<div className="official-effort-card-label">Overall user effort score</div>
							<div className="official-effort-card-band">{report.band} band</div>
						</div>

						<div className="official-effort-card">
							<div className="official-effort-card-value">{report.captureScore}%</div>
							<div className="official-effort-card-label">Capture</div>
							<div className="official-effort-card-sub">
								{report.captureItems} item{report.captureItems === 1 ? "" : "s"} × 5%
							</div>
						</div>

						<div className="official-effort-card">
							<div className="official-effort-card-value">{report.writingScore}%</div>
							<div className="official-effort-card-label">Writing</div>
							<div className="official-effort-card-sub">
								{report.writingWords.toLocaleString()} words · 1% per 100 (remainder counts)
							</div>
						</div>
					</div>

					<div className="official-effort-calc-note">
						<strong>How the score is calculated:</strong> 5% for each captured item of evidence, plus 1% for every 100 words of original text inserted. Fewer than 100 words still counts as 1%. The institution sets the banding and the pass threshold.
					</div>
				</section>

				{/* Section 3: Summary */}
				<section className="official-effort-section">
					<h2 className="official-effort-heading">Summary</h2>
					<div className="official-effort-heading-rule" />

					<div className="official-effort-summary-narrative">
						{report.summaryParagraphs.map((paragraph, i) => (
							<p key={i}>{paragraph}</p>
						))}
					</div>
				</section>

				{/* Section 4: Effort breakdown */}
				<section className="official-effort-section">
					<h2 className="official-effort-heading">Effort breakdown</h2>
					<div className="official-effort-heading-rule" />

					<div className="official-effort-table-wrap">
						<table className="official-effort-data-table">
							<thead>
								<tr>
									<th>Component</th>
									<th>Basis</th>
									<th>Contribution</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td className="is-component">Capture</td>
									<td>{report.captureItems} recorded item{report.captureItems === 1 ? "" : "s"} at 5% each</td>
									<td className="is-contribution">{report.captureScore}%</td>
								</tr>
								<tr>
									<td className="is-component">Writing</td>
									<td>
										{report.writingWords.toLocaleString()} words inserted, 1% per 100 words (any remainder still counts as 1%)
									</td>
									<td className="is-contribution">{report.writingScore}%</td>
								</tr>
								<tr className="is-total-row">
									<td className="is-component">Overall user effort score</td>
									<td>Capture plus writing</td>
									<td className="is-contribution">
										{report.overallScore}% ({report.band})
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</section>

				{/* Section 5: Evidence register */}
				<section className="official-effort-section">
					<h2 className="official-effort-heading">Evidence register</h2>
					<div className="official-effort-heading-rule" />

					<div className="official-effort-table-wrap">
						<table className="official-effort-data-table">
							<thead>
								<tr>
									<th>Evidence type</th>
									<th>Count</th>
									<th>Recorded items</th>
								</tr>
							</thead>
							<tbody>
								{report.evidenceRows.map((row) => (
									<tr key={row.type}>
										<td className="is-component">{row.type}</td>
										<td className="is-count">{row.count}</td>
										<td className="is-recorded">{row.recorded || "—"}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>

				{/* Section 6: Authenticity and verification */}
				<section className="official-effort-section">
					<h2 className="official-effort-heading">Authenticity and verification</h2>
					<div className="official-effort-heading-rule" />

					<div className="official-effort-verification-box">
						<ul className="official-effort-verification-list">
							<li>
								Generated by the GARIL AI Research Assistant on {compiledDateFormatted}.
							</li>
							<li>
								Based on timestamped inputs captured in the governed workspace, and reconcilable against the live notebook or saved manuscript.
							</li>
							<li>
								The manuscript was developed with the Research Assistant, which grounds output in the researcher’s documented evidence and in recognised databases such as Google Scholar, arXiv, PubMed, and CORE, and does not permit open-text prompting.
							</li>
							<li>
								Document reference: <strong>{report.documentRef}</strong> (verify against the institution’s governance dashboard).
							</li>
						</ul>
					</div>
				</section>

				{/* Document Footer */}
				<footer className="official-effort-footer">
					<div className="official-effort-footer-text">
						GARIL AI · Research Assistant · Official effort record · Confidential
					</div>
					<div className="official-effort-footer-badge">
						{report.documentRef}
					</div>
				</footer>
			</div>
		</article>
	);
}
