import type { CitationStyle } from "@/lib/citation-styles";
import { getStyleLabel } from "@/lib/citation-styles";

const SESSION_KEY = "aula.research.paper.refine";

export type PendingResearchRefine = {
	prompt: string;
	topic: string;
	citationStyle: CitationStyle;
};

/** Build a chat-paper job prompt that refines an existing draft (not a blank rewrite from outline). */
export function buildRefineResearchPaperPrompt(input: {
	topic: string;
	content: string;
	citationStyle: CitationStyle;
}): string {
	const styleLabel = getStyleLabel(input.citationStyle);
	const topic = input.topic.trim() || "Research paper";
	const draft = input.content.trim();

	return [
		`Refine and improve the academic research paper below on: ${topic}`,
		"",
		`Reference style: ${styleLabel}`,
		"",
		"Revise the full paper in Markdown. Keep the same IMRaD order with bold-only headings:",
		"**Title**, **Abstract**, **Keywords**, **Study area**, **Introduction**, **Literature Review**, **Methodology**, **Results / Analysis**, **Discussion**, **Conclusion**, **References**.",
		"",
		"Improvement goals:",
		"- Sharpen the research gap and objectives in Introduction.",
		"- Make Literature Review thematic synthesis (not a paper-by-paper dump).",
		"- Strengthen Methodology for reproducibility (design → sample → collection → instruments → analysis); keep study-specific claims consistent with the draft; no findings in Methodology.",
		"- Tighten Results / Analysis to evidence-only reporting linked to research questions; number, caption, and discuss every table/figure in prose.",
		"- Ensure Discussion includes explicit Limitations; interpret Results against literature — do not restate findings; tighten Conclusion.",
		"- Upgrade diction to strong academic register; strip stock AI phrasing; prefer analytical verbs over vague intensifiers.",
		"- Eliminate duplicated summaries across Abstract, Introduction, Discussion, and Conclusion; vary wording within paragraphs.",
		"- Improve flow and coherence from questions → methods → findings → discussion.",
		"",
		"Citation rules (mandatory):",
		"- Cite ONLY papers from the conversation literature retrieval / research API bank. Do not invent authors, years, titles, or DOIs.",
		"- Paraphrase / synthesize bank evidence cards and abstracts — every cited sentence must be supported by the cited abstract.",
		"- Citation scope: remove or rewrite any body sentence that makes a literature claim without a bank cite, or that asserts more than the cited abstract supports.",
		"- Abstract: zero in-text citations (Abstract may only summarize content the body grounds in cites or study evidence).",
		"- If the draft has fewer than 25 bank references and the retrieval bank has ≥25 papers, expand Introduction, Literature Review, and Discussion by citing and writing from more bank papers until at least 25 distinct bank cites appear in the body and References. Prefer more when the bank is larger. If the bank is smaller, cite every retrieved bank paper — never invent fillers.",
		"- References: exactly the bank papers cited in the body (≥25 when the bank allows); format Author (Year). Title. [Source](url).",
		"- Do not use hash (#) Markdown headings or horizontal rules.",
		"",
		"Preserve useful tables, charts, and research-chart / research-image blocks when still valid; ensure each is numbered, captioned, placed near first mention, and referenced in prose — fix or remove unlabelled/orphan visuals.",
		"Return ONLY the full revised paper — no meta-commentary.",
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
		if (!parsed?.prompt?.trim() || !parsed?.topic?.trim()) return null;
		return parsed;
	} catch {
		return null;
	}
}
