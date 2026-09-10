"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { EffortReportBody } from "@/components/research/EffortReportBody";
import type { PaperAuthorProfile, PaperEffortSnapshot } from "@/lib/research-paper-effort";
import type { PaperEffortEvidence } from "@/lib/research-paper-effort-evidence";
import type { ResearchSourceSelection } from "@/lib/research-assets-api";

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
	paperId?: string;
	createdAt?: string;
	sources?: ResearchSourceSelection | null;
	evidence?: PaperEffortEvidence | null;
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
	variant: _variant = "lecturer",
	paperId,
	createdAt,
	sources,
	evidence,
}: Props) {
	const titleId = useId();
	const closeRef = useRef<HTMLButtonElement>(null);
	const [mounted, setMounted] = useState(false);
	const btnClass = "saved-research-btn";
	const btnPrimaryClass = "saved-research-btn saved-research-btn-primary";

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
						<p className="saved-research-report-eyebrow">Official Effort & Attribution Record</p>
						<h2 id={titleId}>User Effort Score</h2>
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
							{downloading ? "Preparing…" : "Download official PDF"}
						</button>
						<button ref={closeRef} type="button" className={btnClass} onClick={onClose}>
							Close
						</button>
					</div>
				</header>

				<div className="saved-research-report-modal-body">
					<EffortReportBody
						title={title}
						topic={topic}
						effort={effort}
						author={author}
						paperId={paperId}
						createdAt={createdAt}
						sources={sources}
						evidence={evidence}
					/>
				</div>
			</div>
		</div>,
		document.body,
	);
}
