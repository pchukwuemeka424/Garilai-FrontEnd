export const QUESTIONNAIRE_ITEM_KINDS = [
	"open",
	"yes_no",
	"multiple_choice",
	"likert",
	"numeric",
] as const;

export type QuestionnaireItemKind = (typeof QUESTIONNAIRE_ITEM_KINDS)[number];

export type QuestionnaireItem = {
	id: string;
	prompt: string;
	kind: QuestionnaireItemKind;
	options: string[];
	scaleMin: number;
	scaleMax: number;
	column: string;
};

export type ResearchQuestionnaire = {
	id: string;
	title: string;
	description: string;
	population: string;
	sampleSize: number;
	distributionNote: string;
	items: QuestionnaireItem[];
	responseDatasetId: string | null;
	instrumentDocumentId: string | null;
	rowCount: number;
	importedFileName: string;
	columns: string[];
	createdAt: string;
	updatedAt: string;
};

export const QUESTIONNAIRE_KIND_LABELS: Record<QuestionnaireItemKind, string> = {
	open: "Open text",
	yes_no: "Yes / no",
	multiple_choice: "Multiple choice",
	likert: "Likert scale",
	numeric: "Numeric",
};

export function newQuestionnaireItem(partial?: Partial<QuestionnaireItem>): QuestionnaireItem {
	const id =
		typeof crypto !== "undefined" && "randomUUID" in crypto
			? crypto.randomUUID()
			: `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
	return {
		id,
		prompt: "",
		kind: "open",
		options: [],
		scaleMin: 1,
		scaleMax: 5,
		column: "",
		...partial,
	};
}
