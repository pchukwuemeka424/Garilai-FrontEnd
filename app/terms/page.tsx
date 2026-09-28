import type { Metadata } from "next";

import { LegalDocumentLivePage } from "@/components/legal/LegalDocumentLivePage";
import { APP_NAME } from "@/lib/brand";

export const metadata: Metadata = {
	title: `Terms of Service · ${APP_NAME}`,
	description: `Terms of Service for ${APP_NAME}, the governed AI workspace for higher education.`,
};

export default function TermsPage() {
	return <LegalDocumentLivePage documentId="terms" />;
}
