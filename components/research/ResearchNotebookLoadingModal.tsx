"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { IconLibrary } from "@/components/ui/ButtonIcon";

type Props = {
	open: boolean;
	notebookTitle?: string;
};

/**
 * Modal shown while a selected research notebook is loaded into the generate brief.
 */
export function ResearchNotebookLoadingModal({ open, notebookTitle }: Props) {
	const titleId = useId();
	const [mounted, setMounted] = useState(false);
	const [step, setStep] = useState(0);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!open) {
			setStep(0);
			return;
		}
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		const timer = window.setInterval(() => {
			setStep((prev) => (prev + 1) % 3);
		}, 1100);
		return () => {
			document.body.style.overflow = previous;
			window.clearInterval(timer);
		};
	}, [open]);

	if (!mounted || !open) return null;

	const label = notebookTitle?.trim() || "your research notebook";
	const steps = ["Reading notes", "Loading datasets", "Preparing images"];

	return createPortal(
		<div className="assign-notebook-loading-backdrop" role="presentation">
			<div
				className="assign-notebook-loading-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-busy="true"
			>
				<div className="assign-notebook-loading-orb" aria-hidden>
					<span className="assign-notebook-loading-spinner" />
					<span className="assign-notebook-loading-icon">
						<IconLibrary size={22} />
					</span>
				</div>
				<p className="assign-notebook-loading-eyebrow">Research notebook</p>
				<h2 id={titleId} className="assign-notebook-loading-title">
					Loading {label}
				</h2>
				<p className="assign-notebook-loading-lead">
					Pulling notes, datasets, and images into your brief…
				</p>
				<ul className="assign-notebook-loading-steps" aria-live="polite">
					{steps.map((item, index) => (
						<li
							key={item}
							className={
								index === step ? "is-active" : index < step ? "is-done" : undefined
							}
						>
							<span className="assign-notebook-loading-dot" aria-hidden />
							{item}
						</li>
					))}
				</ul>
			</div>
		</div>,
		document.body,
	);
}
