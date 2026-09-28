"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
	acceptFeatureAiNotice,
	clearFeatureAiNotice,
	type FeatureAiNoticeConfig,
} from "@/lib/feature-ai-notice";

type Props = {
	open: boolean;
	config: FeatureAiNoticeConfig;
	onAccept: () => void;
	onDecline: () => void;
};

function ShieldIcon() {
	return (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
			<path
				d="M12 3 5 6v5c0 4.5 2.9 7.8 7 9 4.1-1.2 7-4.5 7-9V6l-7-3Z"
				stroke="currentColor"
				strokeWidth="1.75"
				strokeLinejoin="round"
			/>
			<path
				d="M9.5 12.2 11.2 14l3.5-4"
				stroke="currentColor"
				strokeWidth="1.75"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

/**
 * Blocking AUP modal for a product feature until the user accepts or declines.
 * Decline is handled by the parent (usually return to dashboard).
 */
export function FeatureAiUseNoticeModal({ open, config, onAccept, onDecline }: Props) {
	const titleId = useId();
	const descId = useId();
	const acceptRef = useRef<HTMLButtonElement>(null);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!open) return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		const frame = window.requestAnimationFrame(() => acceptRef.current?.focus());
		return () => {
			window.cancelAnimationFrame(frame);
			document.body.style.overflow = previousOverflow;
		};
	}, [open]);

	if (!mounted || !open) return null;

	const handleAccept = () => {
		acceptFeatureAiNotice(config);
		onAccept();
	};

	const handleDecline = () => {
		clearFeatureAiNotice(config);
		onDecline();
	};

	const modal = (
		<div className="modal-backdrop research-ai-notice-backdrop" role="presentation">
			<div
				className="research-ai-notice-modal"
				role="alertdialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={descId}
			>
				<header className="research-ai-notice-modal-header">
					<span className="research-ai-notice-modal-icon" aria-hidden>
						<ShieldIcon />
					</span>
					<div className="research-ai-notice-modal-heading">
						<p className="research-ai-notice-eyebrow">{config.eyebrow}</p>
						<h2 id={titleId} className="research-ai-notice-modal-title">
							{config.title}
						</h2>
					</div>
				</header>

				<div className="research-ai-notice-modal-body" id={descId}>
					<p className="research-ai-notice-lead">{config.lead}</p>
					<ol className="research-ai-notice-points">
						{config.points.map((point, index) => (
							<li key={point.title} className="research-ai-notice-point">
								<span className="research-ai-notice-point-index" aria-hidden>
									{index + 1}
								</span>
								<div className="research-ai-notice-point-copy">
									<strong className="research-ai-notice-point-title">{point.title}</strong>
									<p className="research-ai-notice-point-body">{point.body}</p>
								</div>
							</li>
						))}
					</ol>
				</div>

				<footer className="research-ai-notice-modal-footer">
					<p className="research-ai-notice-footnote">{config.footnote}</p>
					<div className="research-ai-notice-modal-actions">
						<button
							type="button"
							className="research-ai-notice-btn research-ai-notice-btn-decline"
							onClick={handleDecline}
						>
							{config.declineLabel}
						</button>
						<button
							ref={acceptRef}
							type="button"
							className="research-ai-notice-btn research-ai-notice-btn-accept"
							onClick={handleAccept}
						>
							{config.acceptLabel}
						</button>
					</div>
				</footer>
			</div>
		</div>
	);

	return createPortal(modal, document.body);
}
