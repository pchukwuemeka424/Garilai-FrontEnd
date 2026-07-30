"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CitationStyleSelect } from "@/components/aula/CitationStyleSelect";
import { NavIcon } from "@/components/aula/NavIcon";
import { SourceTypeSelect } from "@/components/aula/SourceTypeSelect";
import { AulaLayout } from "@/components/AulaLayout";
import { IconCheck, IconCopy, IconDownload } from "@/components/ui/ButtonIcon";
import {
	EMPTY_REFERENCE,
	formatBibliography,
	formatCitation,
	validateReference,
	type ReferenceInput,
} from "@/lib/citation-format";
import {
	CITATION_STYLES,
	DEFAULT_CITATION_STYLE,
	getStyleLabel,
	type CitationStyle,
} from "@/lib/citation-styles";
import {
	mergeDoiLookups,
	validatePastedBibliography,
	validateReferenceList,
	verifyDoisInReport,
	type ValidationIssue,
	type ValidationReport,
	type ValidationSeverity,
	type ValidatedReference,
} from "@/lib/citation-validate";
import { getSourceBucket, getSourceTypeLabel, SOURCE_TYPES, type SourceType } from "@/lib/source-types";
import { reformatPastedReferences, type ReformattedPaste } from "@/lib/citation-parse";

type FieldDef = {
	key: keyof ReferenceInput;
	label: string;
	placeholder: string;
	type?: "text" | "url";
	half?: boolean;
};

const FIELDS_BY_BUCKET = {
	book: [
		{ key: "authors", label: "Authors", placeholder: "Smith, J. A.; Jones, R. B." },
		{ key: "title", label: "Book title", placeholder: "Title of the book" },
		{ key: "subtitle", label: "Subtitle", placeholder: "Optional subtitle", half: true },
		{ key: "year", label: "Year", placeholder: "2024", half: true },
		{ key: "edition", label: "Edition", placeholder: "2nd", half: true },
		{ key: "publisher", label: "Publisher", placeholder: "Oxford University Press", half: true },
		{ key: "city", label: "City", placeholder: "Oxford", half: true },
		{ key: "doi", label: "DOI", placeholder: "10.1234/example", half: true },
	],
	journal: [
		{ key: "authors", label: "Authors", placeholder: "Smith, J. A.; Jones, R. B." },
		{ key: "title", label: "Article title", placeholder: "Title of the article" },
		{ key: "subtitle", label: "Subtitle", placeholder: "Optional subtitle", half: true },
		{ key: "year", label: "Year", placeholder: "2024", half: true },
		{ key: "journal", label: "Journal", placeholder: "Journal of Educational Technology" },
		{ key: "volume", label: "Volume", placeholder: "42", half: true },
		{ key: "issue", label: "Issue", placeholder: "3", half: true },
		{ key: "pages", label: "Pages", placeholder: "215-232", half: true },
		{ key: "doi", label: "DOI", placeholder: "10.1234/jet.2024.04203", half: true },
	],
	website: [
		{ key: "authors", label: "Authors / Organization", placeholder: "World Health Organization" },
		{ key: "title", label: "Page title", placeholder: "Title of the web page" },
		{ key: "siteName", label: "Website name", placeholder: "WHO", half: true },
		{ key: "year", label: "Year", placeholder: "2024", half: true },
		{ key: "url", label: "URL", placeholder: "https://www.example.org/page", type: "url" },
		{ key: "accessDate", label: "Access date", placeholder: "June 2, 2026", half: true },
	],
	chapter: [
		{ key: "authors", label: "Chapter authors", placeholder: "Smith, J. A." },
		{ key: "title", label: "Chapter title", placeholder: "Title of the chapter" },
		{ key: "bookTitle", label: "Book title", placeholder: "Title of the book" },
		{ key: "editors", label: "Editors", placeholder: "Jones, R. B.; Lee, C.", half: true },
		{ key: "year", label: "Year", placeholder: "2024", half: true },
		{ key: "pages", label: "Pages", placeholder: "45-67", half: true },
		{ key: "publisher", label: "Publisher", placeholder: "Cambridge University Press", half: true },
	],
	conference: [
		{ key: "authors", label: "Authors", placeholder: "Smith, J. A.; Jones, R. B." },
		{ key: "title", label: "Paper title", placeholder: "Title of the conference paper" },
		{ key: "conference", label: "Conference", placeholder: "International Conference on AI in Education" },
		{ key: "year", label: "Year", placeholder: "2024", half: true },
		{ key: "pages", label: "Pages", placeholder: "1-8", half: true },
		{ key: "publisher", label: "Proceedings publisher", placeholder: "ACM", half: true },
		{ key: "city", label: "Location", placeholder: "London, UK", half: true },
	],
} as const satisfies Record<"book" | "journal" | "website" | "chapter" | "conference", FieldDef[]>;

const TITLE_LABEL: Partial<Record<SourceType, string>> = {
	book: "Book title",
	journal: "Article title",
	thesis: "Thesis title",
	dissertation: "Dissertation title",
	report: "Report title",
	patent: "Patent title",
	newspaper: "Article headline",
	magazine: "Article title",
	blog: "Post title",
	video: "Video title",
	podcast: "Episode title",
	film: "Film title",
	dataset: "Dataset title",
	software: "Software name",
	encyclopedia: "Entry title",
	standard: "Standard title",
	legislation: "Act / statute title",
	interview: "Interview title",
	artwork: "Artwork title",
};

function getFieldsForSourceType(type: SourceType): FieldDef[] {
	const bucket = getSourceBucket(type);
	const base = FIELDS_BY_BUCKET[bucket];
	const titleLabel = TITLE_LABEL[type] ?? "Title";
	return base.map((field) => (field.key === "title" ? { ...field, label: titleLabel } : { ...field }));
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
	const [copied, setCopied] = useState(false);

	const copy = useCallback(async () => {
		if (!text) return;
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			/* clipboard unavailable */
		}
	}, [text]);

	return (
		<button type="button" className="ref-btn-ghost" onClick={copy} disabled={!text}>
			{copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
			{copied ? "Copied" : label}
		</button>
	);
}

type WorkMode = "paste" | "manual" | "validate";
type SeverityFilter = "all" | ValidationSeverity;

const PASTE_PLACEHOLDER = `Paste one or more references here — any style works.

Example (APA):
Smith, J. A., & Jones, R. B. (2024). Artificial intelligence in higher education. Journal of Educational Technology, 42(3), 215-232. https://doi.org/10.1234/jet.2024.04203

Separate multiple references with a blank line or numbered list.`;

const VALIDATE_PLACEHOLDER = `Paste your full bibliography to check before submission.

The validator flags:
• Missing authors, titles, years, journals, or publishers
• Invalid DOIs, years, and URLs
• Duplicate entries
• Incomplete locators (volume / pages)

Optionally verify DOIs against Crossref.`;

function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
	const stroke = 6;
	const r = (size - stroke) / 2;
	const c = 2 * Math.PI * r;
	const offset = c - (Math.max(0, Math.min(100, score)) / 100) * c;
	const tone = score >= 85 ? "pass" : score >= 55 ? "review" : "fail";

	return (
		<div className={`ref-score-ring ref-score-ring-${tone}`} style={{ width: size, height: size }}>
			<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={r}
					fill="none"
					stroke="currentColor"
					strokeWidth={stroke}
					opacity={0.15}
				/>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={r}
					fill="none"
					stroke="currentColor"
					strokeWidth={stroke}
					strokeLinecap="round"
					strokeDasharray={c}
					strokeDashoffset={offset}
					transform={`rotate(-90 ${size / 2} ${size / 2})`}
				/>
			</svg>
			<span className="ref-score-ring-value">{score}</span>
		</div>
	);
}

function IssueList({ issues }: { issues: ValidationIssue[] }) {
	if (!issues.length) {
		return <p className="ref-validate-ok">No issues found for this reference.</p>;
	}
	return (
		<ul className="ref-issue-list">
			{issues.map((issue) => (
				<li key={issue.id} className={`ref-issue ref-issue-${issue.severity}`}>
					<span className="ref-issue-sev">{issue.severity}</span>
					<span className="ref-issue-msg">{issue.message}</span>
				</li>
			))}
		</ul>
	);
}

function entryMatchesFilter(entry: ValidatedReference, filter: SeverityFilter): boolean {
	if (filter === "all") return true;
	return entry.issues.some((i) => i.severity === filter);
}

export function ReferenceFormatter() {
	const [style, setStyle] = useState<CitationStyle>(DEFAULT_CITATION_STYLE);
	const [mode, setMode] = useState<WorkMode>("paste");
	const [pastedText, setPastedText] = useState("");
	const [pasteResults, setPasteResults] = useState<ReformattedPaste[]>([]);
	const [pasteFormatted, setPasteFormatted] = useState(false);
	const [input, setInput] = useState<ReferenceInput>({ ...EMPTY_REFERENCE });
	const [bibliography, setBibliography] = useState<ReferenceInput[]>([]);
	const [showErrors, setShowErrors] = useState(false);

	const [validateText, setValidateText] = useState("");
	const [report, setReport] = useState<ValidationReport | null>(null);
	const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
	const [verifyingDois, setVerifyingDois] = useState(false);
	const [doiProgress, setDoiProgress] = useState<{ done: number; total: number } | null>(null);

	const fields = getFieldsForSourceType(input.sourceType);
	const formatted = useMemo(() => formatCitation(style, input), [style, input]);
	const errors = useMemo(() => validateReference(input), [input]);
	const bibliographyText = useMemo(() => formatBibliography(style, bibliography), [style, bibliography]);

	const pasteOutputText = useMemo(
		() => pasteResults.map((r) => r.formatted).filter(Boolean).join("\n\n"),
		[pasteResults],
	);

	const filteredEntries = useMemo(() => {
		if (!report) return [];
		return report.entries.filter((e) => entryMatchesFilter(e, severityFilter));
	}, [report, severityFilter]);

	const update = (key: keyof ReferenceInput, value: string) => {
		setInput((prev) => ({ ...prev, [key]: value }));
	};

	const formatPasted = useCallback(() => {
		const trimmed = pastedText.trim();
		if (!trimmed) {
			setPasteResults([]);
			setPasteFormatted(false);
			return;
		}
		setPasteResults(reformatPastedReferences(trimmed, style));
		setPasteFormatted(true);
	}, [pastedText, style]);

	const runValidator = useCallback(() => {
		const trimmed = validateText.trim();
		if (!trimmed) {
			setReport(null);
			return;
		}
		setReport(validatePastedBibliography(trimmed));
		setSeverityFilter("all");
		setDoiProgress(null);
	}, [validateText]);

	const validateBibliography = useCallback(() => {
		if (!bibliography.length) return;
		setReport(validateReferenceList(bibliography));
		setValidateText(bibliographyText);
		setMode("validate");
		setSeverityFilter("all");
		setDoiProgress(null);
	}, [bibliography, bibliographyText]);

	const verifyDois = useCallback(async () => {
		if (!report?.entries.length) return;
		const withDoi = report.entries.filter((e) => (e.parsed.reference.doi ?? "").trim());
		if (!withDoi.length) return;

		setVerifyingDois(true);
		setDoiProgress({ done: 0, total: withDoi.length });
		try {
			const lookups = await verifyDoisInReport(report, (done, total) => {
				setDoiProgress({ done, total });
			});
			setReport(mergeDoiLookups(report, lookups));
		} finally {
			setVerifyingDois(false);
		}
	}, [report]);

	const applyPasteToForm = (index = 0) => {
		const item = pasteResults[index];
		if (!item) return;
		setInput({ ...item.parsed.reference });
		setMode("manual");
		setShowErrors(false);
	};

	const editValidatedEntry = (entry: ValidatedReference) => {
		setInput({ ...entry.parsed.reference });
		setMode("manual");
		setShowErrors(true);
	};

	const addPasteResultsToBibliography = () => {
		const entries = pasteResults.map((r) => r.parsed.reference).filter((r) => r.title.trim());
		if (!entries.length) return;
		setBibliography((prev) => [...prev, ...entries]);
	};

	useEffect(() => {
		if (!pasteFormatted || !pastedText.trim()) return;
		setPasteResults(reformatPastedReferences(pastedText.trim(), style));
	}, [style, pasteFormatted, pastedText]);

	const addToBibliography = () => {
		const errs = validateReference(input);
		if (errs.length) {
			setShowErrors(true);
			return;
		}
		setBibliography((prev) => [...prev, { ...input }]);
		setInput({ ...EMPTY_REFERENCE, sourceType: input.sourceType });
		setShowErrors(false);
	};

	const removeFromBibliography = (index: number) => {
		setBibliography((prev) => prev.filter((_, i) => i !== index));
	};

	const clearBibliography = () => setBibliography([]);

	const exportBibliography = () => {
		if (!bibliographyText) return;
		const blob = new Blob([bibliographyText], { type: "text/plain;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `references-${style}.txt`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const exportValidationReport = () => {
		if (!report?.entries.length) return;
		const lines = [
			`References validation report`,
			`Score: ${report.overallScore}/100`,
			`Passed: ${report.passed} · Review: ${report.needsReview} · Failed: ${report.failed}`,
			"",
			...report.summary,
			"",
			...report.entries.flatMap((entry) => [
				`[${entry.index + 1}] Score ${entry.score} · ${entry.status.toUpperCase()}`,
				entry.original,
				...entry.issues.map((i) => `  - (${i.severity}) ${i.message}`),
				"",
			]),
		];
		const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "references-validation-report.txt";
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<AulaLayout showRightPanel={false}>
			<div className="ref-page">
				<header className="ref-hero">
					<div className="ref-hero-copy">
						<p className="ref-page-eyebrow">Citation tools</p>
						<h1 className="ref-page-title">References</h1>
						<p className="ref-page-lead">
							Format citations across {CITATION_STYLES.length}+ styles, build a bibliography, and validate
							every entry before you submit.
						</p>
					</div>
					<div className="ref-hero-aside">
						<div className="ref-hero-metric">
							<span className="ref-hero-metric-value">{CITATION_STYLES.length}+</span>
							<span className="ref-hero-metric-label">Styles</span>
						</div>
						<div className="ref-hero-metric">
							<span className="ref-hero-metric-value">{SOURCE_TYPES.length}</span>
							<span className="ref-hero-metric-label">Source types</span>
						</div>
						{bibliography.length > 0 && (
							<button type="button" className="ref-btn ref-btn-outline" onClick={exportBibliography}>
								<IconDownload size={16} />
								Export
							</button>
						)}
					</div>
				</header>

				<div className="ref-control-bar">
					<CitationStyleSelect
						value={style}
						onChange={(next) => {
							if (next) setStyle(next);
						}}
					/>
					<div className="ref-mode-tabs" role="tablist" aria-label="Workspace mode">
						{(
							[
								["paste", "Paste & format"],
								["manual", "Build manually"],
								["validate", "Validate"],
							] as const
						).map(([id, label]) => (
							<button
								key={id}
								type="button"
								role="tab"
								aria-selected={mode === id}
								className={`ref-mode-tab${mode === id ? " ref-mode-tab-active" : ""}`}
								onClick={() => setMode(id)}
							>
								{label}
							</button>
						))}
					</div>
				</div>

				<div className="ref-main-grid">
					{mode === "paste" && (
						<section className="ref-paste-section" aria-labelledby="ref-paste-title">
							<div className="ref-panel-head">
								<div>
									<h2 id="ref-paste-title" className="ref-panel-title">
										Paste your reference
									</h2>
									<p className="ref-panel-sub">Convert any citation style into {getStyleLabel(style)}.</p>
								</div>
								<div className="ref-preview-actions">
									<button
										type="button"
										className="ref-btn-ghost"
										onClick={() => {
											setPastedText("");
											setPasteResults([]);
											setPasteFormatted(false);
										}}
										disabled={!pastedText}
									>
										Clear
									</button>
								</div>
							</div>

							<label className="ref-paste-label sr-only" htmlFor="ref-paste-input">
								Paste reference text
							</label>
							<textarea
								id="ref-paste-input"
								className="ref-paste-input"
								rows={7}
								value={pastedText}
								placeholder={PASTE_PLACEHOLDER}
								onChange={(e) => {
									setPastedText(e.target.value);
									setPasteFormatted(false);
								}}
							/>

							<div className="ref-form-actions">
								<button type="button" className="ref-btn-primary" onClick={formatPasted} disabled={!pastedText.trim()}>
									Format to {getStyleLabel(style)}
								</button>
								{pasteResults.length > 0 && (
									<>
										<button type="button" className="ref-btn-ghost" onClick={() => applyPasteToForm(0)}>
											Edit in form
										</button>
										<button type="button" className="ref-btn-ghost" onClick={addPasteResultsToBibliography}>
											Add {pasteResults.length > 1 ? "all" : ""} to bibliography
										</button>
										<button
											type="button"
											className="ref-btn-ghost"
											onClick={() => {
												setValidateText(pastedText);
												setMode("validate");
												setReport(validatePastedBibliography(pastedText));
											}}
										>
											Validate these
										</button>
									</>
								)}
							</div>

							{pasteFormatted && pasteResults.length === 0 && (
								<p className="ref-paste-hint ref-paste-hint-warn" role="status">
									No reference text detected. Paste a citation and try again.
								</p>
							)}

							{pasteFormatted && pasteResults.length > 0 && (
								<div className="ref-paste-results">
									<div className="ref-paste-results-head">
										<h3 className="ref-paste-results-title">
											Formatted output
											<span className="ref-preview-badge">
												{pasteResults.length} reference{pasteResults.length !== 1 ? "s" : ""}
											</span>
										</h3>
										<CopyButton text={pasteOutputText} label="Copy all" />
									</div>

									<ul className="ref-paste-result-list">
										{pasteResults.map((result, index) => (
											<li key={`${index}-${result.original.slice(0, 20)}`} className="ref-paste-result-item">
												<div className="ref-paste-result-col">
													<span className="ref-paste-result-label">Original</span>
													<p className="ref-paste-original">{result.original}</p>
												</div>
												<div className="ref-paste-result-arrow" aria-hidden>
													<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
														<path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
													</svg>
												</div>
												<div className="ref-paste-result-col ref-paste-result-col-formatted">
													<div className="ref-paste-result-col-head">
														<span className="ref-paste-result-label">{getStyleLabel(style)}</span>
														<span
															className={`ref-confidence ref-confidence-${result.parsed.confidence}`}
															title={result.parsed.warnings.join(" · ") || "Parsed successfully"}
														>
															{result.parsed.confidence === "high"
																? "High confidence"
																: result.parsed.confidence === "medium"
																	? "Review suggested"
																	: "Low confidence"}
														</span>
													</div>
													<p className="ref-preview-text">{result.formatted}</p>
													{result.parsed.warnings.length > 0 && (
														<ul className="ref-paste-warnings">
															{result.parsed.warnings.map((w) => (
																<li key={w}>{w}</li>
															))}
														</ul>
													)}
													<div className="ref-paste-item-actions">
														<CopyButton text={result.formatted} />
														<button type="button" className="ref-btn-ghost" onClick={() => applyPasteToForm(index)}>
															Edit in form
														</button>
													</div>
												</div>
											</li>
										))}
									</ul>
								</div>
							)}
						</section>
					)}

					{mode === "manual" && (
						<div className="ref-workspace">
							<section className="ref-panel ref-panel-form" aria-labelledby="ref-form-title">
								<div className="ref-panel-head">
									<div>
										<h2 id="ref-form-title" className="ref-panel-title">
											Source details
										</h2>
										<p className="ref-panel-sub">Enter fields once — preview updates live.</p>
									</div>
									<SourceTypeSelect
										value={input.sourceType}
										onChange={(sourceType) => setInput((prev) => ({ ...prev, sourceType }))}
									/>
								</div>

								<form
									className="ref-form"
									onSubmit={(e) => {
										e.preventDefault();
										addToBibliography();
									}}
								>
									<div className="ref-form-grid">
										{fields.map((field) => (
											<label
												key={field.key}
												className={`ref-field${field.half ? " ref-field-half" : ""}`}
											>
												<span className="ref-field-label">{field.label}</span>
												<input
													type={field.type ?? "text"}
													className="ref-input"
													value={String(input[field.key] ?? "")}
													placeholder={field.placeholder}
													onChange={(e) => update(field.key, e.target.value)}
												/>
											</label>
										))}
									</div>

									{showErrors && errors.length > 0 && (
										<ul className="ref-errors" role="alert">
											{errors.map((err) => (
												<li key={err}>{err}</li>
											))}
										</ul>
									)}

									<div className="ref-form-actions">
										<button type="submit" className="ref-btn-primary">
											Add to bibliography
										</button>
										<button
											type="button"
											className="ref-btn-ghost"
											onClick={() => {
												setInput({ ...EMPTY_REFERENCE, sourceType: input.sourceType });
												setShowErrors(false);
											}}
										>
											Clear form
										</button>
									</div>
								</form>

								<p className="ref-form-tip">
									Authors: use &quot;Last, First&quot; separated by semicolons — e.g.{" "}
									<code>Smith, J. A.; Jones, R. B.</code>
								</p>
							</section>

							<section className="ref-panel ref-panel-preview" aria-labelledby="ref-preview-title">
								<div className="ref-panel-head">
									<h2 id="ref-preview-title" className="ref-panel-title">
										Formatted citation
									</h2>
									<div className="ref-preview-actions">
										<CopyButton text={formatted} />
									</div>
								</div>

								<div className={`ref-preview-box${formatted ? "" : " ref-preview-empty"}`}>
									{formatted ? (
										<p className="ref-preview-text">{formatted}</p>
									) : (
										<p className="ref-preview-placeholder">Enter source details to see your citation preview.</p>
									)}
								</div>

								<div className="ref-preview-meta">
									<span className="ref-preview-badge">{getStyleLabel(style)}</span>
									<span className="ref-preview-badge ref-preview-badge-muted">
										{getSourceTypeLabel(input.sourceType)}
									</span>
								</div>
							</section>
						</div>
					)}

					{mode === "validate" && (
						<section className="ref-validate-section" aria-labelledby="ref-validate-title">
							<div className="ref-panel-head">
								<div>
									<h2 id="ref-validate-title" className="ref-panel-title">
										References validator
									</h2>
									<p className="ref-panel-sub">
										Check completeness, duplicates, DOI format, and Crossref existence before submission.
									</p>
								</div>
								{bibliography.length > 0 && (
									<button type="button" className="ref-btn-ghost" onClick={validateBibliography}>
										Validate bibliography ({bibliography.length})
									</button>
								)}
							</div>

							<textarea
								id="ref-validate-input"
								className="ref-paste-input"
								rows={8}
								value={validateText}
								placeholder={VALIDATE_PLACEHOLDER}
								onChange={(e) => {
									setValidateText(e.target.value);
									setReport(null);
								}}
								aria-label="Bibliography to validate"
							/>

							<div className="ref-form-actions">
								<button
									type="button"
									className="ref-btn-primary"
									onClick={runValidator}
									disabled={!validateText.trim()}
								>
									Run validation
								</button>
								<button
									type="button"
									className="ref-btn-ghost"
									onClick={() => {
										setValidateText("");
										setReport(null);
										setDoiProgress(null);
									}}
									disabled={!validateText && !report}
								>
									Clear
								</button>
								{report && report.entries.some((e) => (e.parsed.reference.doi ?? "").trim()) && (
									<button
										type="button"
										className="ref-btn-ghost"
										onClick={() => void verifyDois()}
										disabled={verifyingDois}
									>
										{verifyingDois
											? `Verifying DOIs… ${doiProgress ? `${doiProgress.done}/${doiProgress.total}` : ""}`
											: "Verify DOIs (Crossref)"}
									</button>
								)}
								{report && report.entries.length > 0 && (
									<button type="button" className="ref-btn-ghost" onClick={exportValidationReport}>
										<IconDownload size={14} />
										Export report
									</button>
								)}
							</div>

							{report && (
								<div className="ref-validate-results">
									<div className="ref-validate-summary">
										<ScoreRing score={report.overallScore} />
										<div className="ref-validate-summary-copy">
											<p className="ref-validate-summary-title">
												{report.overallScore >= 85
													? "Submission-ready"
													: report.overallScore >= 55
														? "Needs review"
														: "Needs fixes"}
											</p>
											<ul className="ref-validate-summary-list">
												{report.summary.map((line) => (
													<li key={line}>{line}</li>
												))}
											</ul>
										</div>
										<div className="ref-validate-stats" aria-label="Validation counts">
											<div className="ref-validate-stat ref-validate-stat-pass">
												<span className="ref-validate-stat-n">{report.passed}</span>
												<span className="ref-validate-stat-l">Pass</span>
											</div>
											<div className="ref-validate-stat ref-validate-stat-review">
												<span className="ref-validate-stat-n">{report.needsReview}</span>
												<span className="ref-validate-stat-l">Review</span>
											</div>
											<div className="ref-validate-stat ref-validate-stat-fail">
												<span className="ref-validate-stat-n">{report.failed}</span>
												<span className="ref-validate-stat-l">Fail</span>
											</div>
											<div className="ref-validate-stat">
												<span className="ref-validate-stat-n">{report.issueCount.error}</span>
												<span className="ref-validate-stat-l">Errors</span>
											</div>
											<div className="ref-validate-stat">
												<span className="ref-validate-stat-n">{report.issueCount.warning}</span>
												<span className="ref-validate-stat-l">Warnings</span>
											</div>
										</div>
									</div>

									<div className="ref-validate-filters" role="group" aria-label="Filter by severity">
										{(
											[
												["all", "All"],
												["error", "Errors"],
												["warning", "Warnings"],
												["info", "Info"],
											] as const
										).map(([id, label]) => (
											<button
												key={id}
												type="button"
												className={`ref-filter-chip${severityFilter === id ? " ref-filter-chip-active" : ""}`}
												onClick={() => setSeverityFilter(id)}
											>
												{label}
												{id !== "all" && (
													<span className="ref-filter-count">{report.issueCount[id]}</span>
												)}
											</button>
										))}
									</div>

									{filteredEntries.length === 0 ? (
										<p className="ref-paste-hint">No references match this filter.</p>
									) : (
										<ul className="ref-validate-list">
											{filteredEntries.map((entry) => (
												<li
													key={entry.index}
													className={`ref-validate-card ref-validate-card-${entry.status}`}
												>
													<div className="ref-validate-card-head">
														<div className="ref-validate-card-meta">
															<span className="ref-validate-index">#{entry.index + 1}</span>
															<span className={`ref-status-pill ref-status-${entry.status}`}>
																{entry.status}
															</span>
															<span className="ref-validate-score">{entry.score}/100</span>
															<span className="ref-preview-badge ref-preview-badge-muted">
																{getSourceTypeLabel(entry.parsed.reference.sourceType)}
															</span>
														</div>
														<div className="ref-preview-actions">
															<button
																type="button"
																className="ref-btn-ghost"
																onClick={() => editValidatedEntry(entry)}
															>
																Fix in form
															</button>
														</div>
													</div>
													<p className="ref-validate-original">{entry.original}</p>
													{entry.parsed.reference.doi && (
														<p className="ref-validate-doi">
															DOI:{" "}
															<a
																href={`https://doi.org/${entry.parsed.reference.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")}`}
																target="_blank"
																rel="noreferrer"
															>
																{entry.parsed.reference.doi}
															</a>
														</p>
													)}
													<IssueList issues={entry.issues} />
												</li>
											))}
										</ul>
									)}
								</div>
							)}
						</section>
					)}

					<section className="ref-bibliography" aria-labelledby="ref-bib-title">
						<div className="ref-panel-head">
							<h2 id="ref-bib-title" className="ref-panel-title">
								Bibliography
								{bibliography.length > 0 && <span className="ref-bib-count">{bibliography.length}</span>}
							</h2>
							<div className="ref-preview-actions">
								{bibliography.length > 0 && (
									<button type="button" className="ref-btn-ghost" onClick={validateBibliography}>
										Validate list
									</button>
								)}
								<CopyButton text={bibliographyText} label="Copy all" />
								<button
									type="button"
									className="ref-btn-ghost"
									onClick={exportBibliography}
									disabled={!bibliographyText}
								>
									<IconDownload size={14} />
									Export .txt
								</button>
								{bibliography.length > 0 && (
									<button type="button" className="ref-btn-ghost ref-btn-danger" onClick={clearBibliography}>
										Clear list
									</button>
								)}
							</div>
						</div>

						{bibliography.length === 0 ? (
							<div className="ref-bib-empty">
								<div className="ref-bib-empty-icon" aria-hidden>
									<NavIcon id="references" size={22} />
								</div>
								<p className="ref-bib-empty-title">Your bibliography is empty</p>
								<p>
									Paste references to convert them, build entries manually, or validate a list before
									submission.
								</p>
							</div>
						) : (
							<ol className="ref-bib-list">
								{bibliography.map((entry, index) => {
									const line = formatCitation(style, entry);
									return (
										<li key={`${index}-${line.slice(0, 24)}`} className="ref-bib-item">
											<span className="ref-bib-index" aria-hidden>
												{index + 1}.
											</span>
											<p className="ref-bib-text">{line}</p>
											<div className="ref-bib-item-actions">
												<CopyButton text={line} label="Copy" />
												<button
													type="button"
													className="ref-btn-icon"
													aria-label={`Remove reference ${index + 1}`}
													onClick={() => removeFromBibliography(index)}
												>
													<svg
														width="16"
														height="16"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														strokeWidth="1.75"
														aria-hidden
													>
														<path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
													</svg>
												</button>
											</div>
										</li>
									);
								})}
							</ol>
						)}
					</section>
				</div>
			</div>
		</AulaLayout>
	);
}
