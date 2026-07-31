import { CITATION_STYLES, DEFAULT_CITATION_STYLE, getStyleLabel, type CitationStyle } from "@/lib/citation-styles";

export const CHAT_CITATION_STYLE_KEY = "aula.chat.citationStyle";

const REFERENCE_STYLE_LINE = /^Reference style:\s*(.+)$/im;

export function parseCitationStyleFromText(text: string): CitationStyle | null {
	const match = text.match(REFERENCE_STYLE_LINE);
	if (!match?.[1]) return null;

	const value = match[1].trim();
	const byId = CITATION_STYLES.find((s) => s.id === value);
	if (byId) return byId.id;

	const byLabel = CITATION_STYLES.find((s) => s.label.toLowerCase() === value.toLowerCase());
	return byLabel?.id ?? null;
}

export function loadChatCitationStyle(): CitationStyle | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = sessionStorage.getItem(CHAT_CITATION_STYLE_KEY)?.trim();
		if (!raw) return null;
		return CITATION_STYLES.some((s) => s.id === raw) ? (raw as CitationStyle) : null;
	} catch {
		return null;
	}
}

export function saveChatCitationStyle(style: CitationStyle): void {
	if (typeof window === "undefined") return;
	try {
		sessionStorage.setItem(CHAT_CITATION_STYLE_KEY, style);
	} catch {
		/* storage unavailable */
	}
}

export function clearChatCitationStyle(): void {
	if (typeof window === "undefined") return;
	try {
		sessionStorage.removeItem(CHAT_CITATION_STYLE_KEY);
	} catch {
		/* storage unavailable */
	}
}

export function resolveChatCitationStyle(initialPrompt?: string | null): CitationStyle {
	const fromPrompt = initialPrompt ? parseCitationStyleFromText(initialPrompt) : null;
	if (fromPrompt) {
		saveChatCitationStyle(fromPrompt);
		return fromPrompt;
	}

	return loadChatCitationStyle() ?? DEFAULT_CITATION_STYLE;
}

export function buildChangeCitationStylePrompt(style: CitationStyle): string {
	const label = getStyleLabel(style);
	return [
		`Reformat the entire research paper in this conversation to use ${label} for all in-text citations and the References section.`,
		"Preserve all section headings, arguments, data, and approximate length.",
		"Use bold-only section titles (e.g. **Introduction**, **References**) — never hash (#) headings or horizontal rules (---, --).",
		"Update every in-text citation and reference entry to match the target style conventions.",
		"Keep sources from the literature retrieval bank only — do not invent new papers.",
		"If the paper has fewer than 25 bank references and the retrieval bank has ≥25 papers, also expand body cites from unused bank papers so References reaches at least 25 (write from bank abstracts — no list padding).",
		"Do not add in-text citations to Abstract — Abstract must remain citation-free.",
		"In the References section, format each entry as Author (Year). Title. [Source](url). Source links only in References — never in the body.",
		"Do not mention preprint servers, repository names, or paper ID numbers.",
		"Do not add meta-commentary — return the full revised paper in Markdown.",
	].join(" ");
}

export function buildUpdateReferencesPrompt(style: CitationStyle): string {
	const label = getStyleLabel(style);
	return [
		`Update and complete the References section of the research paper above using ${label}.`,
		"Use ONLY papers from the conversation literature retrieval / research API bank.",
		"Ensure every in-text citation has a matching full reference entry from that bank; remove invented or uncited entries.",
		"If the body cites fewer than 25 distinct bank papers and the bank has ≥25 papers, revise body sections to cite and synthesize more bank abstracts until at least 25 bank papers appear in both the body and References. Prefer more when the bank is larger. If the bank is smaller, cite every retrieved bank paper — never invent fillers.",
		"Do not invent authors, years, titles, or DOIs.",
		"Format each entry as: Author (Year). Title. [Source](url). Put Source links only under References.",
		"Do not mention preprint servers, repository names, or paper ID numbers.",
		"Align in-text citations with the reference list where needed — every body cite must match its References entry.",
		"Keep all other sections unchanged unless citation density edits are required to reach the minimum.",
		"Return the full paper in Markdown.",
	].join(" ");
}

/** Follow-up: insert missing in-text citations across body sections. */
export function buildEnsureInTextCitationsPrompt(style: CitationStyle): string {
	const label = getStyleLabel(style);
	return [
		`Revise the research paper above to meet strong ${label} in-text citation density in every body section.`,
		"Abstract: 0 in-text citations — never cite the Abstract.",
		"Introduction: 8–12 distinct cites. Literature Review: 12–18. Methodology: 4–8. Results / Analysis: 3–6. Discussion: 8–12. Conclusion: 3–6.",
		"Across the full body, use at least 25 distinct bank papers when the retrieval bank has ≥25 papers (prefer more when larger); if the bank is smaller, cite every retrieved bank paper.",
		"Cite ONLY papers from the conversation literature retrieval / research API bank. Do not invent authors, years, titles, or DOIs.",
		"Every cited sentence must paraphrase or synthesize the matching bank abstract/evidence card — no decorative cites.",
		"Write from the bank — do not pad References with uncited entries.",
		"References: list exactly the bank papers cited in the body (≥25 when the bank allows); format as Author (Year). Title. [Source](url).",
		"Preserve section headings, arguments, tables, charts, and approximate length.",
		"Use bold-only section titles — never hash (#) headings or horizontal rules.",
		"Return the full revised paper in Markdown with no meta-commentary.",
	].join(" ");
}

export function isIntegratedResearchPrompt(text: string): boolean {
	return (
		REFERENCE_STYLE_LINE.test(text) ||
		text.includes("**Approved research outline**") ||
		text.includes("## Approved research outline") ||
		text.includes("Write a complete academic research paper based on the approved outline")
	);
}
