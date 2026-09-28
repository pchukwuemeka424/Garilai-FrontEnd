import { APP_NAME } from "@/lib/brand";
import { ACCOUNT_POLICY_VERSION } from "@/lib/policy-consent";

export type LegalSection = {
	title: string;
	paragraphs: string[];
};

export type LegalDocumentId = "terms" | "privacy" | "aup";

export type LegalDocument = {
	id: LegalDocumentId;
	title: string;
	updatedLabel: string;
	intro: string;
	sections: LegalSection[];
};

export const TERMS_OF_SERVICE: LegalDocument = {
	id: "terms",
	title: "Terms of Service",
	updatedLabel: `Policy version ${ACCOUNT_POLICY_VERSION} · Placeholder for counsel-approved terms`,
	intro: `${APP_NAME} is a governed AI workspace for research, instruction, and learning in higher education. These Terms describe the conditions for creating an account and using the platform. Final binding language will replace this placeholder.`,
	sections: [
		{
			title: "Accounts and institutional access",
			paragraphs: [
				"You may register only if your institution is onboarded on the platform and you provide accurate account details.",
				"You are responsible for safeguarding your credentials and for activity under your account.",
				"Account access may be suspended or removed where institutional or platform rules require it.",
			],
		},
		{
			title: "Acceptable use",
			paragraphs: [
				"Use the platform for legitimate academic work within your institution’s policies.",
				"Do not misuse the service to harass others, attempt unauthorized access, or circumvent governance controls.",
				"AI tools assist academic work; they do not replace your judgement, authorship, or institutional rules.",
			],
		},
		{
			title: "AI-assisted outputs",
			paragraphs: [
				"Outputs may be drafts or suggestions. You remain accountable for accuracy, originality, citations, and any work you submit for assessment or publication.",
				"Follow your university, faculty, and supervisor requirements on AI disclosure and academic integrity.",
			],
		},
		{
			title: "Changes",
			paragraphs: [
				"We may update these Terms as the product evolves. Material changes may require renewed acceptance at registration or sign-in.",
			],
		},
	],
};

export const PRIVACY_POLICY: LegalDocument = {
	id: "privacy",
	title: "Privacy Policy",
	updatedLabel: `Policy version ${ACCOUNT_POLICY_VERSION} · Placeholder for counsel-approved privacy notice`,
	intro: `${APP_NAME} processes personal and academic data to provide a governed workspace for higher education. This page outlines the categories of information involved. Final binding language will replace this placeholder.`,
	sections: [
		{
			title: "Information we process",
			paragraphs: [
				"Account details such as name, email, institution, department or programme, and role.",
				"Usage and security data needed to operate the service, including authentication and session activity.",
				"Content you submit in academic tools (for example research drafts, notebooks, or uploads) as required to provide those features.",
			],
		},
		{
			title: "How we use information",
			paragraphs: [
				"To create and manage your account, authenticate you, and tailor the workspace to your role and institution.",
				"To deliver AI-assisted academic features under institutional governance controls.",
				"To support integrity, security, and compliance processes where your institution enables them.",
			],
		},
		{
			title: "Cookies",
			paragraphs: [
				"Essential cookies keep the site working. Optional cookies may help understand product usage. You can accept or decline optional cookies via the cookie banner available from the site footer.",
			],
		},
		{
			title: "Retention and institutional controls",
			paragraphs: [
				"Retention and access may follow institutional policies configured for your university, including research privacy and retention settings.",
				"Contact your institutional administrator for local data-protection questions, or email hello@trustledai.com for platform privacy enquiries.",
			],
		},
	],
};

export const ACCEPTABLE_USE_POLICY: LegalDocument = {
	id: "aup",
	title: "Acceptable Use Policy",
	updatedLabel: `Policy version ${ACCOUNT_POLICY_VERSION} · Placeholder for counsel-approved acceptable use rules`,
	intro: `${APP_NAME} provides governed AI tools for higher education. This Acceptable Use Policy describes permitted and prohibited uses of the platform. Final binding language will replace this placeholder.`,
	sections: [
		{
			title: "Permitted use",
			paragraphs: [
				"Use the platform for legitimate academic work within your institution’s policies.",
				"AI tools assist academic work; they do not replace your judgement, authorship, or institutional rules.",
			],
		},
		{
			title: "Prohibited use",
			paragraphs: [
				"Do not misuse the service to harass others, attempt unauthorized access, or circumvent governance controls.",
				"Do not use the platform to generate content that violates academic integrity, institutional policy, or applicable law.",
			],
		},
		{
			title: "Accountability",
			paragraphs: [
				"You remain accountable for accuracy, originality, citations, and any work you submit for assessment or publication.",
				"Follow your university, faculty, and supervisor requirements on AI disclosure and academic integrity.",
			],
		},
	],
};

const BY_ID: Record<LegalDocumentId, LegalDocument> = {
	terms: TERMS_OF_SERVICE,
	privacy: PRIVACY_POLICY,
	aup: ACCEPTABLE_USE_POLICY,
};

export function getLegalDocument(id: LegalDocumentId): LegalDocument {
	return BY_ID[id];
}

export function listFallbackLegalDocuments(): LegalDocument[] {
	return [TERMS_OF_SERVICE, PRIVACY_POLICY, ACCEPTABLE_USE_POLICY];
}
