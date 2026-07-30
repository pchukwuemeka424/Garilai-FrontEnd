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
		"- Strengthen Methodology clarity; keep study-specific claims consistent with the draft.",
		"- Ensure Discussion includes explicit Limitations; tighten Conclusion.",
		"- Improve academic tone, flow, and coherence from questions → methods → findings → discussion.",
		"",
		"Citation rules (mandatory):",
		"- Cite ONLY papers from the conversation literature retrieval / research API bank. Do not invent authors, years, titles, or DOIs.",
		"- Paraphrase / synthesize bank evidence cards and abstracts — every cited sentence must be supported by the cited abstract.",
		"- Abstract: zero in-text citations.",
		"- Prefer grounded cites over density padding. Scale floors if the bank is thin.",
		"- References: exactly the bank papers cited in the body; format Author (Year). Title. [Source](url).",
		"- Do not use hash (#) Markdown headings or horizontal rules.",
		"",
		"Preserve useful tables, charts, and research-chart / research-image blocks when still valid.",
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
