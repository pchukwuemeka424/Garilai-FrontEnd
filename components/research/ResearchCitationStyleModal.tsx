"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CitationStyleSelect } from "@/components/aula/CitationStyleSelect";
import { IconFileText, IconX } from "@/components/ui/ButtonIcon";
import { loadChatCitationStyle, saveChatCitationStyle } from "@/lib/chat-research-citations";
import { type CitationStyle } from "@/lib/citation-styles";

type Props = {
	open: boolean;
	onClose: () => void;
	onConfirm: (style: CitationStyle) => void;
	/** Paper / idea title shown in the lead copy. */
	projectTitle?: string;
	variant?: "lecturer" | "student";
	/** Optional note under the style picker (outline / research note context). */
	note?: string;
	confirmLabel?: string;
};

/**
 * Popup shown before research paper generation so the user picks a reference style.
 */
export function ResearchCitationStyleModal({
	open,
	onClose,
	onConfirm,
	projectTitle,
	variant = "lecturer",
	note,
	confirmLabel = "Generate paper",
}: Props) {
	const titleId = useId();
	const closeRef = useRef<HTMLButtonElement>(null);
	const [mounted, setMounted] = useState(false);
	const [citationStyle, setCitationStyle] = useState<CitationStyle | "">("");

	const isStudent = variant === "student";

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!open) return;
		setCitationStyle(loadChatCitationStyle() ?? "");
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		closeRef.current?.focus();
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => {
			document.body.style.overflow = previous;
			window.removeEventListener("keydown", onKey);
		};
	}, [open, onClose]);

	if (!mounted || !open) return null;

	const handleConfirm = () => {
		if (!citationStyle) return;
		saveChatCitationStyle(citationStyle);
		onConfirm(citationStyle);
	};

	return createPortal(
		<div
			className={`modal-backdrop research-generate-modal-backdrop${isStudent ? " research-modal-student" : ""}`}
			role="presentation"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<div
				className="modal research-generate-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				onMouseDown={(event) => event.stopPropagation()}
			>
				<header className="modal-header">
					<h3 id={titleId}>Select reference style</h3>
					<button
						ref={closeRef}
						type="button"
						className="icon-btn"
						aria-label="Close"
						onClick={onClose}
					>
						<IconX size={18} />
					</button>
				</header>

				<div className="modal-body research-generate-modal-body">
					<p className="research-generate-modal-lead">
						{projectTitle?.trim() ? (
							<>
								Draft a full paper for <strong>{projectTitle.trim()}</strong>. Choose how
								citations and references should be formatted before generating.
							</>
						) : (
							<>Choose how citations and references should be formatted before generating.</>
						)}
					</p>

					<CitationStyleSelect
						id="research-citation-style-modal"
						value={citationStyle}
						onChange={(style) => {
							setCitationStyle(style);
							if (style) saveChatCitationStyle(style);
						}}
					/>

					{note?.trim() ? (
						<div className="research-generate-modal-outline-note">
							<p>{note.trim()}</p>
						</div>
					) : null}

					{!citationStyle ? (
						<p className="research-generate-modal-error">Select a reference style to continue.</p>
					) : null}
				</div>

				<div className="research-generate-modal-actions">
					<button type="button" className="research-action-btn" onClick={onClose}>
						Cancel
					</button>
					<button
						type="button"
						className="research-action-btn research-action-btn-primary"
						onClick={handleConfirm}
						disabled={!citationStyle}
						title={!citationStyle ? "Select a reference style" : undefined}
					>
						<IconFileText size={14} />
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
