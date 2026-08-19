"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CitationStyleSelect } from "@/components/aula/CitationStyleSelect";
import { IconFileText, IconX } from "@/components/ui/ButtonIcon";
import { loadChatCitationStyle, saveChatCitationStyle } from "@/lib/chat-research-citations";
import {
	CITATION_STYLE_GROUPS,
	getStyleLabel,
	type CitationStyle,
} from "@/lib/citation-styles";

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

const POPULAR_STYLE_IDS: CitationStyle[] = [
	"apa-7",
	"harvard",
	"mla-9",
	"ieee",
	"vancouver",
	"chicago-author-date",
];

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

	const popularStyles = useMemo(() => {
		const all = CITATION_STYLE_GROUPS.flatMap((group) => group.styles);
		return POPULAR_STYLE_IDS.map((id) => all.find((style) => style.id === id)).filter(
			(style): style is NonNullable<typeof style> => Boolean(style),
		);
	}, []);

	const selectedMeta = useMemo(() => {
		if (!citationStyle) return null;
		return (
			CITATION_STYLE_GROUPS.flatMap((group) => group.styles).find((style) => style.id === citationStyle) ??
			null
		);
	}, [citationStyle]);

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

	const chooseStyle = (style: CitationStyle) => {
		setCitationStyle(style);
		saveChatCitationStyle(style);
	};

	return createPortal(
		<div
			className={`research-style-modal-backdrop${isStudent ? " research-style-modal-student" : ""}`}
			role="presentation"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<div
				className="research-style-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				onMouseDown={(event) => event.stopPropagation()}
			>
				<header className="research-style-modal-header">
					<div className="research-style-modal-header-main">
						<span className="research-style-modal-badge" aria-hidden>
							<IconFileText size={18} />
						</span>
						<div>
							<p className="research-style-modal-eyebrow">Before you generate</p>
							<h3 id={titleId}>Choose citation style</h3>
						</div>
					</div>
					<button
						ref={closeRef}
						type="button"
						className="research-style-modal-close"
						aria-label="Close"
						onClick={onClose}
					>
						<IconX size={18} />
					</button>
				</header>

				<div className="research-style-modal-body">
					<p className="research-style-modal-lead">
						{projectTitle?.trim() ? (
							<>
								Formatting citations for <strong>{projectTitle.trim()}</strong>. Pick a
								reference style so in-text cites and the References list stay consistent.
							</>
						) : (
							<>
								Pick a reference style so in-text cites and the References list stay consistent
								throughout the document.
							</>
						)}
					</p>

					<div className="research-style-popular">
						<div className="research-style-section-label">Popular styles</div>
						<div className="research-style-popular-grid" role="listbox" aria-label="Popular citation styles">
							{popularStyles.map((style) => {
								const active = citationStyle === style.id;
								return (
									<button
										key={style.id}
										type="button"
										role="option"
										aria-selected={active}
										className={`research-style-card${active ? " is-active" : ""}`}
										onClick={() => chooseStyle(style.id)}
									>
										<span className="research-style-card-title">{style.label}</span>
										<span className="research-style-card-hint">{style.hint}</span>
									</button>
								);
							})}
						</div>
					</div>

					<div className="research-style-all">
						<div className="research-style-section-label">All styles</div>
						<CitationStyleSelect
							id="research-citation-style-modal"
							value={citationStyle}
							onChange={(style) => {
								setCitationStyle(style);
								if (style) saveChatCitationStyle(style);
							}}
							placeholder="Browse every reference style"
							searchPlaceholder="Search APA, MLA, IEEE…"
							hideLabel
						/>
					</div>

					{selectedMeta ? (
						<div className="research-style-selected" aria-live="polite">
							<span className="research-style-selected-label">Selected</span>
							<span className="research-style-selected-value">{getStyleLabel(selectedMeta.id)}</span>
							{selectedMeta.hint ? (
								<span className="research-style-selected-hint">{selectedMeta.hint}</span>
							) : null}
						</div>
					) : null}

					{note?.trim() ? (
						<div className="research-style-note">
							<p>{note.trim()}</p>
						</div>
					) : null}

					{!citationStyle ? (
						<p className="research-style-error">Select a citation style to continue.</p>
					) : null}
				</div>

				<footer className="research-style-modal-footer">
					<button type="button" className="research-style-btn research-style-btn-ghost" onClick={onClose}>
						Cancel
					</button>
					<button
						type="button"
						className="research-style-btn research-style-btn-primary"
						onClick={handleConfirm}
						disabled={!citationStyle}
						title={!citationStyle ? "Select a citation style" : undefined}
					>
						<IconFileText size={15} />
						{confirmLabel}
					</button>
				</footer>
			</div>
		</div>,
		document.body,
	);
}
