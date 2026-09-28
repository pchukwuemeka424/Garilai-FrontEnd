"use client";

import { useEffect, useState } from "react";

import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";
import { fetchLegalDocument } from "@/lib/legal-api";
import { getLegalDocument, type LegalDocument, type LegalDocumentId } from "@/lib/legal-documents";

type Props = {
	documentId: LegalDocumentId;
};

export function LegalDocumentLivePage({ documentId }: Props) {
	const [document, setDocument] = useState<LegalDocument>(() => getLegalDocument(documentId));
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		void fetchLegalDocument(documentId).then((doc) => {
			if (!cancelled) {
				setDocument(doc);
				setLoading(false);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [documentId]);

	return (
		<>
			{loading ? <span className="sr-only">Loading document…</span> : null}
			<LegalDocumentPage document={document} />
		</>
	);
}
