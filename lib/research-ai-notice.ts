/** Versioned so copy changes can re-prompt acknowledgment. */
export const RESEARCH_AI_NOTICE_VERSION = "2";
export const RESEARCH_AI_NOTICE_KEY = "garil-research-ai-notice";

export const RESEARCH_AI_NOTICE_TITLE = "Acceptable use of AI for research";

export const RESEARCH_AI_NOTICE_EYEBROW = "Research Assistant · Policy notice";

export const RESEARCH_AI_NOTICE_LEAD =
	"You must accept this notice before using Research Assistant. AI here supports academic work; it does not replace your judgement, authorship, or institutional rules.";

export type ResearchAiNoticePoint = {
	title: string;
	body: string;
};

export const RESEARCH_AI_NOTICE_POINTS: readonly ResearchAiNoticePoint[] = [
	{
		title: "You remain the author",
		body: "Outputs are AI-assisted drafts, not finished submissions. You are accountable for accuracy, originality, citations, and any work you submit for assessment or publication.",
	},
	{
		title: "Verify before you use or submit",
		body: "Check claims, quotations, and references against trusted scholarly sources. Do not rely on AI output as final evidence.",
	},
	{
		title: "Follow institutional AI rules",
		body: "Comply with your university, faculty, and supervisor policies. Disclose AI assistance wherever your institution or publisher requires it.",
	},
	{
		title: "Protect sensitive information",
		body: "Do not enter confidential personal data, unpublished proprietary material, or identifiable research-participant data unless your institution expressly allows it in this tool.",
	},
	{
		title: "Provenance may be recorded",
		body: "GARIL may retain an AI-assistance provenance record for academic integrity review, without exposing your private research content in governance dashboards.",
	},
] as const;

/** @deprecated Prefer RESEARCH_AI_NOTICE_POINTS — kept for any leftover list UIs. */
export const RESEARCH_AI_NOTICE_BODY = RESEARCH_AI_NOTICE_POINTS.map(
	(point) => `${point.title}: ${point.body}`,
);

export const RESEARCH_AI_NOTICE_ACCEPT_LABEL = "Accept";

export const RESEARCH_AI_NOTICE_DECLINE_LABEL = "Decline";

export const RESEARCH_AI_NOTICE_FOOTNOTE =
	"You must accept this notice to use Research Assistant. Declining returns you to the dashboard.";

export const RESEARCH_AI_NOTICE_REQUIRED_ERROR =
	"Please accept the AI acceptable use notice before generating.";

type StoredNotice = {
	version: string;
	acceptedAt: string;
};

function readStored(): StoredNotice | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(RESEARCH_AI_NOTICE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as StoredNotice;
		if (
			typeof parsed?.version !== "string" ||
			typeof parsed?.acceptedAt !== "string" ||
			parsed.version !== RESEARCH_AI_NOTICE_VERSION
		) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export function hasAcceptedResearchAiNotice(): boolean {
	return readStored() !== null;
}

export function acceptResearchAiNotice(): void {
	if (typeof window === "undefined") return;
	try {
		const payload: StoredNotice = {
			version: RESEARCH_AI_NOTICE_VERSION,
			acceptedAt: new Date().toISOString(),
		};
		window.localStorage.setItem(RESEARCH_AI_NOTICE_KEY, JSON.stringify(payload));
	} catch {
		/* storage may be blocked */
	}
}

export function clearResearchAiNotice(): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.removeItem(RESEARCH_AI_NOTICE_KEY);
	} catch {
		/* ignore */
	}
}
