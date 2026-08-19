"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
	bandLabel,
	type PaperAuthorProfile,
	type PaperEffortSnapshot,
} from "@/lib/research-paper-effort";

type Props = {
	open: boolean;
	onClose: () => void;
	title: string;
	topic: string;
	effort: PaperEffortSnapshot;
	author: PaperAuthorProfile;
	onDownload: () => void;
	downloading?: boolean;
	variant?: "lecturer" | "student";
};

export function EffortReportModal({
	open,
	onClose,
	title,
	topic,
	effort,
	author,
	onDownload,
	downloading = false,
	variant = "lecturer",
}: Props) {
	const titleId = useId();
	const closeRef = useRef<HTMLButtonElement>(null);
	const [mounted, setMounted] = useState(false);
	const isStudent = variant === "student";
	const btnClass = isStudent ? "stu-paper-btn" : "saved-research-btn";
	const btnPrimaryClass = isStudent
		? "stu-paper-btn stu-paper-btn-primary"
		: "saved-research-btn saved-research-btn-primary";

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!open) return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		closeRef.current?.focus();
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener("keydown", onKey);
		};
	}, [open, onClose]);

	if (!mounted || !open) return null;

	return createPortal(
		<div
			className="saved-research-report-backdrop"
			role="presentation"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<div
				className="saved-research-report-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
			>
				<header className="saved-research-report-modal-head">
					<div>
						<p className="saved-research-report-eyebrow">Effort & attribution</p>
						<h2 id={titleId}>Overall score of user’s input</h2>
						<p className="saved-research-report-sub">
							{title.slice(0, 160)}
							{title.length > 160 ? "…" : ""}
						</p>
					</div>
					<div className="saved-research-report-modal-actions">
						<button
							type="button"
							className={btnPrimaryClass}
							onClick={onDownload}
							disabled={downloading}
						>
							{downloading ? "Preparing…" : "Download official PDF report"}
						</button>
						<button
							ref={closeRef}
							type="button"
							className={btnClass}
							onClick={onClose}
						>
							Close
						</button>
					</div>
				</header>

				<div className="saved-research-report-modal-body">
					<div className="saved-research-effort-overall saved-research-report-hero">
						<div
							className="saved-research-effort-ring saved-research-report-ring"
							style={{ ["--p" as string]: String(effort.userEffortScore) }}
							aria-label={`Overall score of user’s input: ${effort.userEffortScore} out of 100`}
						>
							<span className="saved-research-effort-ring-value">{effort.userEffortScore}</span>
							<span className="saved-research-effort-ring-max">/ 100</span>
						</div>
						<div className="saved-research-effort-overall-copy">
							<p className="saved-research-effort-overall-label">Overall score of user’s input</p>
							<p className="saved-research-effort-overall-band">{bandLabel(effort.userBand)}</p>
							<p className="saved-research-effort-overall-formula">
								Capture {effort.captureScore}% + writing {effort.writingScore}% = overall{" "}
								{effort.userEffortScore}/100
							</p>
							{topic.trim() ? (
								<p className="saved-research-report-topic">
									<strong>Topic:</strong> {topic}
								</p>
							) : null}
						</div>
					</div>

					<dl className="saved-research-effort-user">
						<div>
							<dt>Name</dt>
							<dd>{author.name || "—"}</dd>
						</div>
						<div>
							<dt>Email</dt>
							<dd>{author.email || "—"}</dd>
						</div>
						<div>
							<dt>Department</dt>
							<dd>{author.department || "—"}</dd>
						</div>
						<div>
							<dt>Institution</dt>
							<dd>{author.institution || "—"}</dd>
						</div>
					</dl>

					<div className="saved-research-effort-scores">
						<div className="saved-research-effort-score is-user">
							<span className="saved-research-effort-value">{effort.userEffortScore}</span>
							<span className="saved-research-effort-label">Overall input</span>
							<span className="saved-research-effort-band">{bandLabel(effort.userBand)}</span>
						</div>
						<div className="saved-research-effort-score">
							<span className="saved-research-effort-value">{effort.captureScore}</span>
							<span className="saved-research-effort-label">Capture / uploads</span>
						</div>
						<div className="saved-research-effort-score">
							<span className="saved-research-effort-value">{effort.writingScore}</span>
							<span className="saved-research-effort-label">Writing / edits</span>
						</div>
						<div className="saved-research-effort-score">
							<span className="saved-research-effort-value">{effort.artifactScore}</span>
							<span className="saved-research-effort-label">Graphs & labs</span>
						</div>
						<div className="saved-research-effort-score is-ai">
							<span className="saved-research-effort-value">{effort.aiShareScore}</span>
							<span className="saved-research-effort-label">AI text share</span>
						</div>
						<div className="saved-research-effort-score">
							<span className="saved-research-effort-value">{effort.wordCount}</span>
							<span className="saved-research-effort-label">Words</span>
						</div>
					</div>

					<div className="saved-research-effort-grid">
						<div>
							<h3>Uploaded & linked materials</h3>
							<ul className="saved-research-effort-metrics">
								<li>
									<span>Linked projects</span>
									<strong>{effort.materials.projects}</strong>
								</li>
								<li>
									<span>Notes / materials</span>
									<strong>{effort.materials.notes}</strong>
								</li>
								<li>
									<span>Documents</span>
									<strong>{effort.materials.documents}</strong>
								</li>
								<li>
									<span>Datasets</span>
									<strong>{effort.materials.datasets}</strong>
								</li>
								<li>
									<span>Figures</span>
									<strong>{effort.materials.figures}</strong>
								</li>
								<li>
									<span>Lab Log entries</span>
									<strong>{effort.materials.labEntries}</strong>
								</li>
								<li>
									<span>References</span>
									<strong>{effort.materials.references}</strong>
								</li>
							</ul>
						</div>
						<div>
							<h3>Text edited / inserted</h3>
							<ul className="saved-research-effort-metrics">
								<li>
									<span>Words inserted</span>
									<strong>+{effort.edits.wordsInserted}</strong>
								</li>
								<li>
									<span>Words deleted</span>
									<strong>−{effort.edits.wordsDeleted}</strong>
								</li>
								<li>
									<span>Change vs AI baseline</span>
									<strong>{effort.edits.changePercent}%</strong>
								</li>
								<li>
									<span>Sections touched</span>
									<strong>{effort.edits.sectionsTouched}</strong>
								</li>
							</ul>
						</div>
						<div>
							<h3>Graphs, figures & labs in paper</h3>
							<ul className="saved-research-effort-metrics">
								<li>
									<span>Charts</span>
									<strong>{effort.artifacts.charts}</strong>
								</li>
								<li>
									<span>Figures / images</span>
									<strong>{effort.artifacts.figures}</strong>
								</li>
								<li>
									<span>Tables</span>
									<strong>{effort.artifacts.tables}</strong>
								</li>
								<li>
									<span>Lab / experiment mentions</span>
									<strong>{effort.artifacts.labMentions}</strong>
								</li>
							</ul>
						</div>
					</div>

					<ul className="saved-research-effort-summary">
						{effort.summaryLines.map((line) => (
							<li key={line}>{line}</li>
						))}
					</ul>
				</div>
			</div>
		</div>,
		document.body,
	);
}
