import type { Metadata } from "next";

import { LegalDocumentLivePage } from "@/components/legal/LegalDocumentLivePage";
import { APP_NAME } from "@/lib/brand";

export const metadata: Metadata = {
	title: `Privacy Policy · ${APP_NAME}`,
	description: `Privacy Policy for ${APP_NAME}, explaining how account and platform data are handled.`,
};

export default function PrivacyPage() {
	return <LegalDocumentLivePage documentId="privacy" />;
}
