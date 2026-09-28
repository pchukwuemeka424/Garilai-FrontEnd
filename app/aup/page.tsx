import type { Metadata } from "next";

import { LegalDocumentLivePage } from "@/components/legal/LegalDocumentLivePage";
import { APP_NAME } from "@/lib/brand";

export const metadata: Metadata = {
	title: `Acceptable Use Policy · ${APP_NAME}`,
	description: `Acceptable Use Policy for ${APP_NAME}, describing permitted and prohibited platform use.`,
};

export default function AupPage() {
	return <LegalDocumentLivePage documentId="aup" />;
}
