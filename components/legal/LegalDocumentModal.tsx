"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { APP_COMPANY } from "@/lib/brand";
import { fetchLegalDocument } from "@/lib/legal-api";
import { getLegalDocument, type LegalDocument, type LegalDocumentId } from "@/lib/legal-documents";

type Props = {
	documentId: LegalDocumentId | null;
	onClose: () => void;
};

export function LegalDocumentModal({ documentId, onClose }: Props) {
	const titleId = useId();
	const closeRef = useRef<HTMLButtonElement>(null);
	const [mounted, setMounted] = useState(false);
	const [doc, setDoc] = useState<LegalDocument | null>(null);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!documentId) {
			setDoc(null);
			return;
		}
		setDoc(getLegalDocument(documentId));
		let cancelled = false;
		void fetchLegalDocument(documentId).then((loaded) => {
			if (!cancelled) setDoc(loaded);
		});
		return () => {
			cancelled = true;
		};
	}, [documentId]);

	useEffect(() => {
		if (!doc) return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		const frame = window.requestAnimationFrame(() => closeRef.current?.focus());

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKeyDown);

		return () => {
			window.cancelAnimationFrame(frame);
			document.body.style.overflow = previousOverflow;
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [doc, onClose]);

	if (!mounted || !doc) return null;

	const modal = (
		<div
			className="modal-backdrop legal-doc-modal-backdrop"
			role="presentation"
			onClick={onClose}
		>
			<div
				className="legal-doc-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				onClick={(event) => event.stopPropagation()}
			>
				<header className="legal-doc-modal-header">
					<div>
						<p className="legal-doc-modal-eyebrow">{APP_COMPANY}</p>
						<h2 id={titleId} className="legal-doc-modal-title">
							{doc.title}
						</h2>
						<p className="legal-doc-modal-updated">{doc.updatedLabel}</p>
					</div>
					<button
						ref={closeRef}
						type="button"
						className="legal-doc-modal-close"
						onClick={onClose}
						aria-label="Close"
					>
						×
					</button>
				</header>

				<div className="legal-doc-modal-body">
					<p className="legal-page-intro">{doc.intro}</p>
					{doc.sections.map((section, sectionIndex) => (
						<section key={`${section.title}-${sectionIndex}`} className="legal-page-section">
							<h3 className="legal-page-section-title">{section.title}</h3>
							{section.paragraphs.map((paragraph, paragraphIndex) => (
								<p key={`${sectionIndex}-${paragraphIndex}`} className="legal-page-paragraph">
									{paragraph}
								</p>
							))}
						</section>
					))}
					<p className="legal-page-contact">
						Questions about this document:{" "}
						<a href="mailto:hello@trustledai.com">hello@trustledai.com</a>
					</p>
				</div>

				<footer className="legal-doc-modal-footer">
					<button type="button" className="legal-doc-modal-action" onClick={onClose}>
						Close
					</button>
				</footer>
			</div>
		</div>
	);

	return createPortal(modal, document.body);
}
