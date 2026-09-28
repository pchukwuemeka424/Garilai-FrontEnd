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
	const isAssignment = profile.scope === "assignment";
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
		...(isAssignment
			? [
					`- Densify USE THIS CITE citation forms matching ${styleLabel} on every body paragraph from Introduction through Conclusion — including the first Introduction paragraph and the Conclusion.`,
					"- Stay in-field: drop or replace cites whose abstracts do not support the claim’s discipline (e.g. finance papers for education ethics).",
					"- Do not strip existing good bank cites; add missing cites; keep ≥20 distinct bank papers when the bank allows.",
					"- Preserve brief-first structure from the current draft (named parts/tasks); do not force a generic journal layout.",
				]
			: []),
		...profile.sectionJobs.map((job) => `- ${job}`),
	];

	const structureBlock = isAssignment
		? [
				"Revise the full document in Markdown. Preserve the current draft’s section order and any brief-named headings (brief-first). Only if the draft has no usable structure, fall back to:",
				formatHeadingsForPrompt(profile) + ".",
				`Use ONLY USE THIS CITE citation forms matching ${styleLabel} on every body paragraph from the first Introduction paragraph through Conclusion.`,
			]
		: [
				`Revise the full document in Markdown. Keep this exact ${profile.label} section order with bold-only headings:`,
				formatHeadingsForPrompt(profile) + ".",
			];

	return [
		`Refine and improve the academic ${profile.label} below on: ${topic}`,
		"",
		`Scope: ${profile.label}`,
		`Reference style: ${styleLabel}`,
		"",
		...structureBlock,
		"",
		`Target body length: ${profile.wordTarget.min.toLocaleString()}–${profile.wordTarget.max.toLocaleString()} words excluding references${
			isAssignment ? " (unless the draft/brief sets another limit)." : "."
		}`,
		isAssignment
			? `Across the full body, cite at least ${profile.minDistinctCites} distinct bank papers in the chosen reference style (${styleLabel}). Fallback section floors (only if using default headings): ${formatCitationFloorsForPrompt(profile)}. Use the retrieval bank until this floor is met; only if retrieval returned fewer papers may you cite every retrieved paper — never invent fillers. Every References entry must be cited in the body.`
			: `In-text citation floors: ${formatCitationFloorsForPrompt(profile)}. Across the full body, cite at least ${profile.minDistinctCites} distinct bank papers. Use the retrieval bank until this floor is met; only if retrieval returned fewer than ${profile.minDistinctCites} papers may you cite every retrieved paper — never invent fillers. Every References entry must be cited in the body.`,
		"",
		"Improvement goals:",
		...improvementGoals,
		"",
		"Citation rules (mandatory):",
		...formatAcademicIntegrityRules(profile).map((line) => `- ${line}`),
		"",
		"Preserve useful tables, charts, and research-chart / research-image / research-figure blocks when still valid; ensure each is numbered, captioned, placed near first mention, and referenced in prose — fix or remove unlabelled/orphan visuals. Do not strip Markdown tables or figure fences from the draft.",
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
		/* ignore quota / private mode */
	}
}

export function consumePendingResearchRefine(): PendingResearchRefine | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = sessionStorage.getItem(SESSION_KEY);
		if (!raw) return null;
		sessionStorage.removeItem(SESSION_KEY);
		const parsed = JSON.parse(raw) as PendingResearchRefine;
		if (!parsed?.prompt?.trim() || !parsed?.topic?.trim()) return null;
		return parsed;
	} catch {
		return null;
	}
}
