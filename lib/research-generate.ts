import { saveChatCitationStyle } from "@/lib/chat-research-citations";
import { getStyleLabel, type CitationStyle } from "@/lib/citation-styles";
import { formatIdeaForChat, SCOPE_OPTIONS, stageChatPrefill, type ResearchIdea, type ResearchScope } from "@/lib/research-ideas";

export function buildResearchPaperPrompt(input: {
	idea: ResearchIdea;
	topic: string;
	disciplineLabel: string;
	scope: ResearchScope;
	outline: string;
	citationStyle: CitationStyle;
	sourceContext?: string;
	visualizationArtifacts?: string;
	/** User already saved Figures in a research note — do not invent new images. */
	hasSavedFigures?: boolean;
	/** Skip LLM outline — ground the paper in the selected research note. */
	skipOutline?: boolean;
}): string {
	const styleLabel = getStyleLabel(input.citationStyle);
	const scopeLabel = SCOPE_OPTIONS.find((s) => s.id === input.scope)?.label ?? input.scope;
	const hasCanonicalVisuals = Boolean(input.visualizationArtifacts?.trim());
	const hasSavedFigures = Boolean(input.hasSavedFigures);
	const fromNote = Boolean(input.skipOutline);

	return [
		formatIdeaForChat(input.idea, input.topic),
		"",
		`Discipline: ${input.disciplineLabel}`,
		`Scope: ${scopeLabel}`,
		"",
		`Reference style: ${styleLabel}`,
		"",
		fromNote
			? "Write a complete academic research paper grounded in the selected research note evidence below. Do not wait for or invent a separate research outline."
			: "Write a complete academic research paper based on the approved outline below.",
		fromNote
			? "Derive aims, methods, findings, and claims from the research note (and any study framing listed). Prefer the note over generic assumptions."
			: "Follow the outline's research question, objectives, methodology, literature themes, expected contributions, and timeline.",
		"Expand each section into substantive prose with in-text citations and a References section in the selected style.",
		"Use this exact IMRaD order with bold-only headings on their own lines: **Title**, **Abstract**, **Keywords**, **Study area**, **Introduction**, **Literature Review**, **Methodology**, **Results / Analysis**, **Discussion**, **Conclusion**, **References**.",
		"After **Keywords**, put terms on the next line separated by middots (term1 · term2 · term3). After **Study area**, put the discipline on the next line. Never merge Keywords and Study area on one line.",
		"Never skip **Abstract** or **Introduction**; do not merge them with other sections.",
		"In-text citation floors (distinct author–year from the retrieval bank): Abstract 0 (no cites — never cite Abstract); Introduction 8–12; Literature Review 12–18; Methodology 4–8; Results / Analysis 3–6; Discussion 8–12; Conclusion 3–6. Across the full body, use at least 25 distinct bank papers when the retrieval bank has ≥25 papers (prefer more when larger); if the bank is smaller, cite every retrieved bank paper. Prefer grounded paraphrases over density padding.",
		"Cite ONLY papers from the conversation literature retrieval / research API bank. Do not invent authors, years, or titles.",
		"Paraphrase / synthesize bank evidence cards and abstracts into literature claims. Every cited sentence must be supported by the cited paper’s abstract — no decorative cites. Write Introduction, Literature Review, and Discussion from the bank — do not list references that were never cited in prose.",
		"Citation scope (hard): every literature claim needs a bank in-text cite; prose must not exceed what that cite’s abstract supports; no uncited filler outside Methods/Results study evidence; omit points that cannot be grounded.",
		"References list: exactly the bank papers cited in the body (matching each in-text cite), minimum 25 entries when the bank has ≥25 papers. A References section that invents different sources or pads uncited entries is invalid.",
		"Paper quality: state a clear research gap; synthesize literature thematically (not paper-by-paper); include explicit Limitations; use cautious language when evidence is thin; keep questions → methods → findings → discussion coherent.",
		"Strong academic English: discipline-precise, argumentative, non-formulaic; prefer analytical verbs over vague intensifiers; ban stock AI phrases (e.g. “rapidly evolving”, “delve into”, “landscape of”, “it is worth noting”).",
		"Anti-repetition: do not recycle the same summary across Abstract, Introduction, Discussion, and Conclusion; Discussion must interpret Results against literature — not restate findings; vary wording within paragraphs.",
		"Methodology: write a reproducible design → sample/materials → collection → instruments → analysis sequence; cite prior methods/standards from the bank only; follow outline/note methods; no findings in Methodology.",
		"Results / Analysis: report RQ-aligned findings first; number and discuss every table/figure in prose; use only evidence values; brief bridge to Discussion only — no full literature debate.",
		"Do not use hash (#) Markdown headings or horizontal rules (---, --).",
		fromNote
			? "For Literature Review, use only what is supported by the research note references/findings and bank evidence cards — do not fabricate a long outline-driven literature plan."
			: "Use sources from the outline's literature review and Sources for further reading only when they also appear in the retrieval bank; paraphrase bank abstracts for in-text cites.",
		"Create concise Markdown tables for useful comparisons, literature synthesis, methods, or results. Every table/figure needs a numbered title, one-sentence caption, and an in-text reference near first mention.",
		"Every table must use valid GitHub-flavored Markdown: one pipe-delimited header row, an immediate separator row such as `| --- | --- |`, then pipe-delimited data rows. Never imitate a table with plain text and pipe characters.",
		"Never create a section titled “Data Source and Variables” (or similar). Dataset samples belong only in Results / Analysis, capped at 5 rows.",
		...(hasSavedFigures
			? [
					"CRITICAL: The user already saved empirical figures in their research note.",
					"Do NOT invent, generate, or emit any new images, diagrams, `research-image` blocks, or illustrative `research-chart` blocks.",
					"In Results / Analysis, discuss the listed saved figures by name (Figure 1, Figure 2, …) with captions stating what each shows, and insert the provided sample tables exactly (≤5 rows — do not expand to the full dataset).",
					"The actual figure images are attached automatically after generation — do not invent placeholders or fake image URLs.",
				]
			: hasCanonicalVisuals
				? [
						"In Results / Analysis, insert the provided canonical sample tables (≤5 rows) and `research-chart` blocks exactly as written.",
						"Do not invent, rewrite, rescale, expand, or replace the numeric values in those canonical artifacts.",
						"Discuss them in prose with numbered titles/captions (e.g. Table 1, Figure 1) placed near the first mention.",
						"Do not create extra illustrative images when canonical artifacts are provided; do not leave orphan visuals.",
					]
				: [
						"When no dataset or findings are supplied, create useful literature-synthesis tables and clearly labelled illustrative graphs when they clarify the argument.",
						"Illustrative graph values must be plausible examples only, never presented as observed study findings or cited statistics.",
						"Label every such title and caption with “Illustrative” and explain in Results / Analysis that the values are synthetic.",
						"Emit graphs as fenced `research-chart` JSON blocks with this schema:",
						'{"type":"bar|line|area|pie|scatter","kind":"illustrative","title":"Illustrative: descriptive title","caption":"Synthetic example—not observed findings.","xKey":"category field","yKeys":["numeric field"],"data":[{"category field":"Label","numeric field":12}]}',
						"Keep charts to at most 30 data points and tables to the most relevant rows; prefer bar/line/scatter as appropriate.",
						"Create a conceptual figure only when it materially clarifies a framework (fenced `research-image` JSON); number and caption it; reference it in prose.",
					]),
		...(input.sourceContext?.trim()
			? [
					"Use the selected research note / document evidence below throughout the paper—not only in Results.",
					"Derive **Title** from the research note's suggested interest topic / study title (refine for academic style if needed; do not invent an unrelated title).",
					"Write **Abstract** from the note's aims, methods, data/evidence, and findings; keep claims supported by the note.",
					"Ground Introduction, Methodology, and Discussion in the note's notebook content, data, figures, and findings.",
					"Use only values present in the selected evidence for numeric tables.",
					"",
					"**Selected user evidence**",
					"",
					input.sourceContext.trim(),
				]
			: []),
		...(hasCanonicalVisuals
			? [
					"",
					"**Canonical research note tables / saved figure list**",
					"",
					input.visualizationArtifacts!.trim(),
				]
			: []),
		"",
		fromNote ? "**Study framing (from idea / research note — not an LLM outline)**" : "**Approved research outline**",
		"",
		input.outline.trim(),
	].join("\n");
}

/** Stage the full research prompt and citation style before navigating to chat. */
export function stageResearchGeneration(prompt: string, citationStyle: CitationStyle): void {
	saveChatCitationStyle(citationStyle);
	stageChatPrefill(prompt);
}
