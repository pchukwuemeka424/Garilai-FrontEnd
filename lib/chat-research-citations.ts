import { CITATION_STYLES, DEFAULT_CITATION_STYLE, getStyleLabel, type CitationStyle } from "@/lib/citation-styles";
import {
	formatCitationFloorsForPrompt,
	getScopeProfile,
	parseScopeFromPrompt,
} from "@/lib/research-scope-profiles";
import type { ResearchScope } from "@/lib/research-ideas";

export const CHAT_CITATION_STYLE_KEY = "aula.chat.citationStyle";
export const CHAT_RESEARCH_SCOPE_KEY = "aula.chat.researchScope";

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

export function saveChatResearchScope(scope: ResearchScope): void {
	if (typeof window === "undefined") return;
	try {
		sessionStorage.setItem(CHAT_RESEARCH_SCOPE_KEY, scope);
	} catch {
		/* storage unavailable */
	}
}

export function loadChatResearchScope(): ResearchScope | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = sessionStorage.getItem(CHAT_RESEARCH_SCOPE_KEY)?.trim();
		if (!raw) return null;
		const profile = getScopeProfile(raw);
		return profile.scope;
	} catch {
		return null;
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

export function resolveChatResearchScope(initialPrompt?: string | null): ResearchScope {
	const fromPrompt = initialPrompt ? parseScopeFromPrompt(initialPrompt) : "";
	if (fromPrompt) {
		saveChatResearchScope(fromPrompt);
		return fromPrompt;
	}
	return loadChatResearchScope() ?? "journal";
}

function resolveScope(scope?: ResearchScope | string | null): ResearchScope {
	return getScopeProfile(scope).scope;
}

export function buildChangeCitationStylePrompt(
	style: CitationStyle,
	scope?: ResearchScope | string | null,
): string {
	const label = getStyleLabel(style);
	const profile = getScopeProfile(resolveScope(scope));
	return [
		`Reformat the entire ${profile.label} in this conversation to use ${label} for all in-text citations and the References section.`,
		"Preserve all section headings, arguments, data, and approximate length.",
		"Use bold-only section titles — never hash (#) headings or horizontal rules (---, --).",
		"Update every in-text citation and reference entry to match the target style conventions.",
		"Keep sources from the literature retrieval bank only — do not invent new papers.",
		`If the document has fewer than ${profile.minDistinctCites} bank references, expand body cites from unused bank papers so both the body and References reach at least ${profile.minDistinctCites} (write from bank abstracts). Only if retrieval returned fewer than ${profile.minDistinctCites} papers may you cite every retrieved paper. Never invent fillers. Every References entry must appear as an in-text citation — no uncited list padding.`,
		"Do not add in-text citations to Abstract / Executive Summary / front matter where the type marks 0 cites.",
		"In the References section, format each entry as Author (Year). Title. [Source](url). Source links only in References — never in the body.",
		"Do not mention preprint servers, repository names, or paper ID numbers.",
		"Do not add meta-commentary — return the full revised document in Markdown.",
	].join(" ");
}

export function buildUpdateReferencesPrompt(
	style: CitationStyle,
	scope?: ResearchScope | string | null,
): string {
	const label = getStyleLabel(style);
	const profile = getScopeProfile(resolveScope(scope));
	return [
		`Update and complete the References section of the ${profile.label} above using ${label}.`,
		"Use ONLY papers from the conversation literature retrieval / research API bank.",
		"Ensure every in-text citation has a matching full reference entry from that bank, and every References entry is cited in the body; remove invented or uncited entries.",
		`If the body cites fewer than ${profile.minDistinctCites} distinct bank papers, revise body sections to cite and synthesize more bank abstracts until at least ${profile.minDistinctCites} bank papers appear in both the body and References. Prefer more when the bank is larger. Only if retrieval returned fewer than ${profile.minDistinctCites} papers may you cite every retrieved paper. Never invent fillers or pad uncited References.`,
		"Do not invent authors, years, titles, or DOIs.",
		"Format each entry as: Author (Year). Title. [Source](url). Put Source links only under References.",
		"Do not mention preprint servers, repository names, or paper ID numbers.",
		"Align in-text citations with the reference list where needed — every body cite must match its References entry.",
		"Keep all other sections unchanged unless citation density edits are required to reach the minimum.",
		"Return the full document in Markdown.",
	].join(" ");
}

/** Follow-up: insert missing in-text citations across body sections. */
export function buildEnsureInTextCitationsPrompt(
	style: CitationStyle,
	scope?: ResearchScope | string | null,
): string {
	const label = getStyleLabel(style);
	const profile = getScopeProfile(resolveScope(scope));
	return [
		`Revise the ${profile.label} above to meet strong ${label} in-text citation density in every body section.`,
		`In-text citation floors: ${formatCitationFloorsForPrompt(profile)}.`,
		`Across the full body, cite at least ${profile.minDistinctCites} distinct bank papers. Use the retrieval bank until this floor is met; only if retrieval returned fewer than ${profile.minDistinctCites} papers may you cite every retrieved paper.`,
		"Cite ONLY papers from the conversation literature retrieval / research API bank. Do not invent authors, years, titles, or DOIs.",
		"Every cited sentence must paraphrase or synthesize the matching bank abstract/evidence card — no decorative cites.",
		"Write from the bank — do not pad References with uncited entries. Every References entry must appear as an in-text citation.",
		`References: list exactly the bank papers cited in the body (≥${profile.minDistinctCites} unless the bank is smaller); format as Author (Year). Title. [Source](url).`,
		"Preserve section headings, arguments, tables, charts, and approximate length.",
		"Use bold-only section titles — never hash (#) headings or horizontal rules.",
		"Return the full revised document in Markdown with no meta-commentary.",
	].join(" ");
}

export function isIntegratedResearchPrompt(text: string): boolean {
	return (
		REFERENCE_STYLE_LINE.test(text) ||
		text.includes("**Approved research outline**") ||
		text.includes("## Approved research outline") ||
		text.includes("Write a complete academic research paper based on the approved outline") ||
		/Write a complete academic .+ \(not a generic journal article/i.test(text)
	);
}
