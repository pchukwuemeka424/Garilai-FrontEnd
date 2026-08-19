import type { CitationStyle } from "@/lib/citation-styles";
import { getStyleLabel } from "@/lib/citation-styles";
import type { ResearchScope } from "@/lib/research-ideas";
import { getScopeAgentCopy } from "@/lib/research-scope-brief";
import {
	formatAcademicIntegrityRules,
	formatCitationFloorsForPrompt,
	formatHeadingsForPrompt,
	getScopeProfile,
} from "@/lib/research-scope-profiles";

const SESSION_KEY = "aula.research.paper.refine";

export type PendingResearchRefine = {
	prompt: string;
	topic: string;
	citationStyle: CitationStyle;
	scope?: ResearchScope;
};

/** Build a chat-paper job prompt that refines an existing draft (not a blank rewrite from outline). */
export function buildRefineResearchPaperPrompt(input: {
	topic: string;
	content: string;
	citationStyle: CitationStyle;
	scope?: ResearchScope | string | null;
}): string {
	const styleLabel = getStyleLabel(input.citationStyle);
	const topic = input.topic.trim() || "Research paper";
	const draft = input.content.trim();
	const profile = getScopeProfile(input.scope);
	const hasMethods = profile.headings.some((h) => /method/i.test(h));
	const hasResults = profile.headings.some((h) => /result|finding|testing/i.test(h));
	const hasLitReview = profile.headings.some((h) => /literature review/i.test(h));
	const hasCriticalAnalysis = profile.headings.some((h) => /critical analysis/i.test(h));

	const fieldGoals = getScopeAgentCopy(profile.scope).refineGoals.map((goal) => `- ${goal}`);
	const improvementGoals = [
		"- Sharpen focus and objectives in Introduction (or Chapter One).",
		...(hasLitReview
			? ["- Make Literature Review thematic synthesis (not a paper-by-paper dump)."]
			: []),
		...fieldGoals,
		...(hasCriticalAnalysis
			? [
					"- Strengthen Critical Analysis as the argumentative core with bank-supported evaluation.",
					"- Do not introduce Methodology, Methods, Results, or fabricated empirical findings.",
				]
			: []),
		...(hasMethods
			? [
					"- Strengthen Methodology for reproducibility where that section exists; no findings in Methodology.",
				]
			: []),
		...(hasResults
			? [
					"- Tighten results/findings sections to evidence-only reporting linked to research questions; number, caption, and discuss every table/figure in prose.",
					"- Ensure Discussion includes explicit Limitations when present; interpret findings against literature — do not restate findings; tighten Conclusion.",
				]
			: ["- Tighten Conclusion; eliminate duplicated summaries across sections."]),
		"- Upgrade diction to strong academic register; strip stock AI phrasing; prefer analytical verbs over vague intensifiers.",
		"- Eliminate duplicated summaries across overview/introduction/discussion/conclusion; vary wording within paragraphs.",
		...profile.sectionJobs.map((job) => `- ${job}`),
	];

	return [
		`Refine and improve the academic ${profile.label} below on: ${topic}`,
		"",
		`Scope: ${profile.label}`,
		`Reference style: ${styleLabel}`,
		"",
		`Revise the full document in Markdown. Keep this exact ${profile.label} section order with bold-only headings:`,
		formatHeadingsForPrompt(profile) + ".",
		"",
		`Target body length: ${profile.wordTarget.min.toLocaleString()}–${profile.wordTarget.max.toLocaleString()} words excluding references.`,
		`In-text citation floors: ${formatCitationFloorsForPrompt(profile)}. Across the full body, cite at least ${profile.minDistinctCites} distinct bank papers. Use the retrieval bank until this floor is met; only if retrieval returned fewer than ${profile.minDistinctCites} papers may you cite every retrieved paper — never invent fillers. Every References entry must be cited in the body.`,
		"",
		"Improvement goals:",
		...improvementGoals,
		"",
		"Citation rules (mandatory):",
		...formatAcademicIntegrityRules(profile).map((line) => `- ${line}`),
		"",
		"Preserve useful tables, charts, and research-chart / research-image blocks when still valid; ensure each is numbered, captioned, placed near first mention, and referenced in prose — fix or remove unlabelled/orphan visuals.",
		"Return ONLY the full revised document — no meta-commentary.",
		"",
		"**Current draft to refine**",
		"",
		draft,
	].join("\n");
}

export function stagePendingResearchRefine(input: PendingResearchRefine): void {
	if (typeof window === "undefined") return;
	const prompt = input.prompt.trim();
	const topic = input.topic.trim();
	if (!prompt || !topic) return;
	try {
		sessionStorage.setItem(
			SESSION_KEY,
			JSON.stringify({
				prompt,
				topic,
				citationStyle: input.citationStyle,
				...(input.scope ? { scope: input.scope } : {}),
			} satisfies PendingResearchRefine),
		);
	} catch {
		/* storage unavailable */
	}
}

export function consumePendingResearchRefine(): PendingResearchRefine | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = sessionStorage.getItem(SESSION_KEY);
		if (!raw) return null;
		sessionStorage.removeItem(SESSION_KEY);
		const parsed = JSON.parse(raw) as PendingResearchRefine;
		if (!parsed?.prompt?.trim() || !parsed?.topic?.trim() || !parsed?.citationStyle) return null;
		return parsed;
	} catch {
		return null;
	}
}
