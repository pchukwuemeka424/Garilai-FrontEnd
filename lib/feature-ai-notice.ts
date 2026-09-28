/** Shared helpers for feature-level AI acceptable-use notices. */

export type FeatureAiNoticePoint = {
	title: string;
	body: string;
};

export type FeatureAiNoticeConfig = {
	storageKey: string;
	version: string;
	eyebrow: string;
	title: string;
	lead: string;
	points: readonly FeatureAiNoticePoint[];
	footnote: string;
	acceptLabel: string;
	declineLabel: string;
};

type StoredNotice = {
	version: string;
	acceptedAt: string;
};

function readStored(config: FeatureAiNoticeConfig): StoredNotice | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(config.storageKey);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as StoredNotice;
		if (
			typeof parsed?.version !== "string" ||
			typeof parsed?.acceptedAt !== "string" ||
			parsed.version !== config.version
		) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export function hasAcceptedFeatureAiNotice(config: FeatureAiNoticeConfig): boolean {
	return readStored(config) !== null;
}

export function acceptFeatureAiNotice(config: FeatureAiNoticeConfig): void {
	if (typeof window === "undefined") return;
	try {
		const payload: StoredNotice = {
			version: config.version,
			acceptedAt: new Date().toISOString(),
		};
		window.localStorage.setItem(config.storageKey, JSON.stringify(payload));
	} catch {
		/* storage may be blocked */
	}
}

export function clearFeatureAiNotice(config: FeatureAiNoticeConfig): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.removeItem(config.storageKey);
	} catch {
		/* ignore */
	}
}

export const NOTEBOOK_AI_NOTICE: FeatureAiNoticeConfig = {
	storageKey: "garil-notebook-ai-notice",
	version: "1",
	eyebrow: "Research Notebook · Policy notice",
	title: "Acceptable use of AI for the research notebook",
	lead:
		"You must accept this notice before using Research Notebook. The notebook helps you organise research materials; AI features must not replace your judgement, authorship, or institutional rules.",
	points: [
		{
			title: "You remain responsible for the record",
			body: "Notes, datasets, figures, and lab entries are your research record. You are accountable for accuracy, provenance, and any material you later submit for assessment or publication.",
		},
		{
			title: "Verify AI-assisted content",
			body: "If you use AI to summarise, structure, or analyse notebook materials, check outputs against your primary data and trusted sources before relying on them.",
		},
		{
			title: "Follow institutional AI rules",
			body: "Comply with your university, faculty, ethics, and supervisor policies. Disclose AI assistance wherever your institution requires it.",
		},
		{
			title: "Protect sensitive research data",
			body: "Do not store confidential personal data, identifiable participant information, or proprietary unpublished material unless your institution expressly allows it in this tool.",
		},
		{
			title: "Provenance may be recorded",
			body: "GARIL may retain an AI-assistance provenance record for academic integrity review, without exposing your private notebook content in governance dashboards.",
		},
	],
	footnote:
		"You must accept this notice to use Research Notebook. Declining returns you to the dashboard.",
	acceptLabel: "Accept",
	declineLabel: "Decline",
};

export const SUPERVISION_AI_NOTICE: FeatureAiNoticeConfig = {
	storageKey: "garil-supervision-ai-notice",
	version: "1",
	eyebrow: "Supervision · Policy notice",
	title: "Acceptable use of AI for supervision",
	lead:
		"You must accept this notice before using Supervision. AI here supports review and feedback; it does not replace academic judgement, marking responsibility, or institutional rules.",
	points: [
		{
			title: "You remain the academic decision-maker",
			body: "AI suggestions on assignments, projects, and feedback are assistive only. Final academic judgements, scores, and progression decisions remain yours.",
		},
		{
			title: "Review before you act on AI output",
			body: "Check AI flags, summaries, and draft comments for accuracy and fairness before sharing them with students or recording them as formal feedback.",
		},
		{
			title: "Follow institutional AI and assessment rules",
			body: "Comply with your university, faculty, and quality-assurance policies on AI use in teaching, assessment, and academic integrity review.",
		},
		{
			title: "Protect student and assessment data",
			body: "Treat student work, marks, and personal information as confidential. Do not use AI features in ways that expose sensitive data beyond authorised institutional use.",
		},
		{
			title: "Provenance may be recorded",
			body: "GARIL may retain an AI-assistance provenance record for academic integrity and audit review, without exposing private student work in governance dashboards.",
		},
	],
	footnote:
		"You must accept this notice to use Supervision. Declining returns you to the dashboard.",
	acceptLabel: "Accept",
	declineLabel: "Decline",
};
