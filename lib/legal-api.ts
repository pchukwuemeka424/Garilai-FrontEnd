import { apiUrl } from "@/lib/api";
import {
	getLegalDocument as getFallbackLegalDocument,
	listFallbackLegalDocuments,
	type LegalDocument,
	type LegalDocumentId,
} from "@/lib/legal-documents";
import { ACCOUNT_POLICY_VERSION } from "@/lib/policy-consent";

export type LegalDocumentApiRecord = LegalDocument & {
	version?: string;
	updatedAt?: string;
};

function isLegalId(value: string): value is LegalDocumentId {
	return value === "terms" || value === "privacy" || value === "aup";
}

function normalizeDocument(raw: Partial<LegalDocumentApiRecord> & { id: string }): LegalDocument {
	const id = isLegalId(raw.id) ? raw.id : "terms";
	const fallback = getFallbackLegalDocument(id);
	return {
		id,
		title: raw.title?.trim() || fallback.title,
		updatedLabel: raw.updatedLabel?.trim() || fallback.updatedLabel,
		intro: raw.intro?.trim() || fallback.intro,
		sections:
			Array.isArray(raw.sections) && raw.sections.length > 0
				? raw.sections.map((section) => ({
						title: section.title ?? "",
						paragraphs: Array.isArray(section.paragraphs)
							? section.paragraphs.map(String)
							: [],
					}))
				: fallback.sections,
	};
}

export async function fetchLegalDocument(id: LegalDocumentId): Promise<LegalDocument> {
	try {
		const res = await fetch(apiUrl(`/api/legal/${encodeURIComponent(id)}`));
		if (!res.ok) return getFallbackLegalDocument(id);
		const data = (await res.json()) as { document?: LegalDocumentApiRecord };
		if (!data.document) return getFallbackLegalDocument(id);
		return normalizeDocument(data.document);
	} catch {
		return getFallbackLegalDocument(id);
	}
}

export async function fetchLegalDocuments(): Promise<{
	documents: LegalDocument[];
	accountPolicyVersion: string;
}> {
	try {
		const res = await fetch(apiUrl("/api/legal"));
		if (!res.ok) {
			return {
				documents: listFallbackLegalDocuments(),
				accountPolicyVersion: ACCOUNT_POLICY_VERSION,
			};
		}
		const data = (await res.json()) as {
			documents?: LegalDocumentApiRecord[];
			accountPolicyVersion?: string;
		};
		const documents = (data.documents ?? []).map(normalizeDocument);
		return {
			documents: documents.length > 0 ? documents : listFallbackLegalDocuments(),
			accountPolicyVersion: data.accountPolicyVersion?.trim() || ACCOUNT_POLICY_VERSION,
		};
	} catch {
		return {
			documents: listFallbackLegalDocuments(),
			accountPolicyVersion: ACCOUNT_POLICY_VERSION,
		};
	}
}

export async function fetchAccountPolicyVersion(): Promise<string> {
	const data = await fetchLegalDocuments();
	return data.accountPolicyVersion;
}
