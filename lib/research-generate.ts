import { saveChatCitationStyle, saveChatResearchScope } from "@/lib/chat-research-citations";
import { getStyleLabel, type CitationStyle } from "@/lib/citation-styles";
import { formatIdeaForChat, stageChatPrefill, type ResearchIdea, type ResearchScope } from "@/lib/research-ideas";
import { buildScopeBriefPromptLines, getScopeAgentCopy } from "@/lib/research-scope-brief";
import {
	formatAcademicIntegrityRules,
	formatStructureInstructions,
	getScopeProfile,
	parseScopeFromPrompt,
} from "@/lib/research-scope-profiles";
import { getVisualPlacementRules } from "@/lib/research-visual-placement";

export function buildResearchPaperPrompt(input: {
	idea: ResearchIdea;
	topic: string;
	disciplineLabel: string;
	scope: ResearchScope;
	outline: string;
	citationStyle: CitationStyle;
	sourceContext?: string;
	visualizationArtifacts?: string;
	/** User already provided saved figures — do not invent new images. */
	hasSavedFigures?: boolean;
	assignmentInstructions?: string;
}): string {
	const styleLabel = getStyleLabel(input.citationStyle);
	const profile = getScopeProfile(input.scope);
	const hasCanonicalVisuals = Boolean(input.visualizationArtifacts?.trim());
	const hasSavedFigures = Boolean(input.hasSavedFigures);
	const hasCanonicalCharts = /```research-chart\b/i.test(input.visualizationArtifacts ?? "");
	const resultsHeading = profile.headings.find((h) =>
		/result|finding|testing/i.test(h),
	);
	const hasMethods = profile.headings.some((h) => /method/i.test(h));
	const visualPlacement = getVisualPlacementRules(profile.scope);
	const visualSection = visualPlacement.labels.empirical;

	const typeSpecificLines: string[] = [];
	if (profile.scope === "assignment") {
		typeSpecificLines.push(
			"Argumentative body (whatever headings the brief requires, or Critical Analysis in the fallback): develop PhD-level evaluation with bank cites; explain every brief requirement; do not invent Methods, Results, or empirical findings.",
		);
	} else if (profile.scope === "proposal" || profile.scope === "faculty") {
		typeSpecificLines.push(
			"Expected Outcomes / Timeline / Budget: plan forward-looking work — do not invent completed empirical results.",
		);
		if (hasMethods) {
			typeSpecificLines.push(
				"Methodology: describe planned design → sample/materials → collection → instruments → analysis only; no findings.",
			);
		}
	} else if (
		profile.scope === "thesis" ||
		profile.scope === "dissertation" ||
		profile.scope === "undergraduate_project"
	) {
		if (hasMethods) {
			typeSpecificLines.push(
				"Methodology / Methods / Chapter methods: write a reproducible design → sample/materials → collection → instruments → analysis sequence grounded in the selected notebook when present; cite prior methods/standards from the bank only; follow outline methods; no findings in Methodology.",
			);
		}
		if (resultsHeading) {
			typeSpecificLines.push(
				`${resultsHeading}: report RQ-aligned findings from notebook notes, datasets, lab work, and supplied tables/charts first; number and discuss every table/figure in prose; use only evidence values; brief bridge to Discussion only — no full literature debate.`,
			);
		}
		typeSpecificLines.push(
			"When a research notebook library is selected, treat it as the study’s primary evidence base for this long-form deliverable — do not rewrite as a generic literature essay that ignores notebook notes, data, or lab work.",
		);
	} else if (resultsHeading) {
		if (hasMethods) {
			typeSpecificLines.push(
				"Methodology / Methods sections: write a reproducible design → sample/materials → collection → instruments → analysis sequence; cite prior methods/standards from the bank only; follow outline methods; no findings in Methodology. If the topic is a literature review, Methodology must copy the retrieval protocol only — never invent Scopus/Web of Science/ERIC/IEEE searches, dual reviewers, or unaudited PRISMA counts. Include the supplied selection-flow and extraction tables. Results synthesise the included corpus rather than retelling papers.",
			);
		}
		typeSpecificLines.push(
			`${resultsHeading}: report RQ-aligned findings first; number and discuss every table/figure in prose; use only evidence values; brief bridge to Discussion only — no full literature debate.`,
		);
	} else if (profile.scope === "report") {
		typeSpecificLines.push(
			"Findings then Analysis: report evidence first; Recommendations must be actionable and tied to findings.",
		);
	}

	const visualLines = hasSavedFigures
		? [
				"CRITICAL: The user already provided empirical figures with this document.",
				"Do NOT invent, generate, or emit any new images, diagrams, `research-image` blocks, or illustrative `research-chart` blocks.",
				`In **${visualSection}**, discuss the listed saved figures by name (Figure 1, Figure 2, …) with captions stating what each shows.`,
				"The actual figure images are attached automatically after generation — do not invent placeholders, fake image URLs, or `research-figure` blocks.",
				...visualPlacement.promptLines,
				...(hasCanonicalCharts
					? [
							`Also in **${visualSection}**, insert the provided canonical sample tables (≤10 rows) and \`research-chart\` blocks exactly as written.`,
							"Do not invent, rewrite, rescale, expand, or replace the numeric values in those canonical artifacts.",
						]
					: [
							"If sample tables are provided in the figure list, insert them exactly (≤10 rows — do not expand to the full dataset).",
						]),
			]
		: hasCanonicalVisuals
			? [
					`In **${visualSection}**, insert the provided canonical sample tables (≤10 rows) and \`research-chart\` blocks exactly as written.`,
					"Do not invent, rewrite, rescale, expand, or replace the numeric values in those canonical artifacts.",
					"Discuss them in prose with numbered titles/captions (e.g. Table 1, Figure 1) placed near the first mention.",
					"Do not create extra illustrative images when canonical artifacts are provided; do not leave orphan visuals.",
					...visualPlacement.promptLines,
				]
			: profile.scope === "assignment"
				? [
						...visualPlacement.promptLines,
						"Optional: one short literature-synthesis table in Literature Review or Critical Analysis if it clarifies themes. Prefer prose over charts.",
						"Do not invent empirical findings charts; any illustrative table must be labelled Illustrative and not presented as observed results.",
					]
				: [
						...visualPlacement.promptLines,
						"When no dataset or findings are supplied, create useful literature-synthesis tables and clearly labelled illustrative graphs when they clarify the argument.",
						"Illustrative graph values must be plausible examples only, never presented as observed study findings or cited statistics.",
						`Label every such title and caption with “Illustrative” and place synthesis tables in **${visualPlacement.labels.synthesis}**.`,
						"Emit graphs as fenced `research-chart` JSON blocks with this schema:",
						'{"type":"bar|line|area|pie|scatter","kind":"illustrative","title":"Illustrative: descriptive title","caption":"Synthetic example—not observed findings.","xKey":"category field","yKeys":["numeric field"],"data":[{"category field":"Label","numeric field":12}]}',
						"Keep charts to at most 30 data points and tables to at most 10 rows (the most relevant rows); prefer bar/line/scatter as appropriate.",
						`When a framework, process, or variable model is discussed, include a conceptual \`research-image\` JSON figure in **${visualPlacement.labels.conceptual}**; number and caption it; reference it in prose.`,
						"When competing literature themes appear, include a short literature-comparison Markdown table.",
					];

	const userBriefRaw = input.assignmentInstructions?.trim();
	const hasLibrary = Boolean(input.sourceContext?.trim()) && profile.scope !== "assignment";
	// Avoid duplicating full notebook notes in both brief and selected library.
	const userBrief =
		hasLibrary && userBriefRaw && userBriefRaw.length > 4_000
			? `${userBriefRaw.slice(0, 4_000).trimEnd()}\n[Brief notes truncated — full notebook text is in Selected research library.]`
			: userBriefRaw;
	const uploadedBrief = profile.scope === "assignment" ? input.sourceContext?.trim() : "";
	const agentCopy = getScopeAgentCopy(profile.scope);
	const scopedBriefBlock =
		profile.scope === "assignment"
			? []
			: buildScopeBriefPromptLines({
					scope: profile.scope,
					topic: input.topic,
					title: input.idea.title,
					assignmentInstructions: userBrief,
					researchQuestions: input.idea.researchQuestions,
				});
	const assignmentBriefBlock =
		scopedBriefBlock.length
			? scopedBriefBlock
			: profile.scope === "assignment"
				? [
						"**Assignment brief (PRIMARY — generate from this information)**",
						"",
						`**Working title / topic:** ${input.topic.trim() || input.idea.title}`,
						"",
						...(userBrief
							? [
									"**User-provided assignment information (explain and satisfy ALL of this):**",
									"",
									userBrief,
									"",
									"BRIEF-FIRST (hard): Ground the entire document in the information above. Explain and answer every numbered question, task, learning outcome, required section/part, theory, case, marking criterion, word limit, and referencing style named there. Do not invent a different topic or omit brief requirements.",
									"STRUCTURE: If the brief names sections or parts, use those bold headings (plus References unless forbidden). If it lists questions/tasks without headings, create clearly labelled subsections that answer each item in order. Do not collapse all brief tasks into a single Critical Analysis block.",
								]
							: uploadedBrief
								? [
										"**Uploaded assignment brief (explain and satisfy ALL of this extracted text):**",
										"",
										uploadedBrief,
										"",
										"BRIEF-FIRST (hard): Ground the entire document in the uploaded brief above. Explain and answer every numbered question, task, learning outcome, required section/part, theory, case, marking criterion, word limit, and referencing style named there. Do not invent a different topic or omit brief requirements. Treat the upload as brief text, not empirical data.",
										"STRUCTURE: If the brief names sections or parts, use those bold headings (plus References unless forbidden). If it lists questions/tasks without headings, create clearly labelled subsections that answer each item in order. Do not collapse all brief tasks into a single Critical Analysis block.",
									]
								: [
										"No extended brief was supplied — write a cited PhD-level academic assignment focused only on the working title/topic.",
									]),
						"",
						"FALLBACK structure only when the brief does not specify structure: Title, Introduction, Literature Review, Critical Analysis, Conclusion, and References. Default body length 1,900–2,100 words excluding references when the brief does not set a word count. Do not invent Methods, Results, or empirical findings.",
						"VOICE: Write as a doctoral / PhD-level academic — analytical, theory-aware, critically evaluative; not undergraduate summary prose.",
						"REFERENCES (hard): Cite and list at least 20 verified bank papers with real years (never n.d.) whenever the bank has ≥20 papers. Every major factual claim needs an in-text citation. Every References entry must appear as an in-text citation. Prefer direct higher-education evidence when the topic is about universities, students, or faculty. Format References in the selected reference style unless the brief mandates another.",
						"CITATIONS & FACTS: Copy USE THIS CITE strings exactly on every body paragraph from the first Introduction paragraph through Conclusion matching the selected reference style (e.g. [1] for numbered styles, (Author, Year) for author-date styles). Stay in-field: education claims need education abstracts (not finance/clinical). Do not invent statistics, sample sizes, effect sizes, or institutional claims unless they appear in the cited abstract; omit ungrounded points.",
						...(userBrief && uploadedBrief
							? ["If an uploaded file appears below, treat it as part of the same assignment brief — not as empirical data."]
							: []),
					]
				: [];

	const ideaForChat =
		scopedBriefBlock.length || (profile.scope === "assignment" && Boolean(userBrief || uploadedBrief))
			? { ...input.idea, rationale: "", researchQuestions: undefined }
			: input.idea;

	const rawLibrary = input.sourceContext?.trim() ?? "";
	const libraryText =
		rawLibrary.length > 32_000
			? `${rawLibrary.slice(0, 32_000).trimEnd()}\n[Notebook library truncated to fit context.]`
			: rawLibrary;
	const vizText = (input.visualizationArtifacts ?? "").trim();
	const vizClipped =
		vizText.length > 8_000
			? `${vizText.slice(0, 8_000).trimEnd()}\n[Canonical visuals truncated — full tables/charts are injected after save.]`
			: vizText;
	const outlineText = input.outline.trim();
	const outlineClipped =
		outlineText.length > 14_000
			? `${outlineText.slice(0, 14_000).trimEnd()}\n[Outline truncated to fit context.]`
			: outlineText;

	const libraryBlock =
		libraryText
			? profile.scope === "assignment"
				? userBrief
					? [
							"The uploaded file is part of the assignment brief. Follow it together with the working title and the user-provided information above. Do not treat it as empirical results.",
							"",
							"**Uploaded assignment brief**",
							"",
							libraryText,
						]
					: []
				: [
						"NOTEBOOK-FIRST (hard): The user selected a research notebook library and/or uploaded evidence. Use the FULL folder contents below as primary source material for this deliverable: notes, lab log, documents, datasets, surveys, figures, and references.",
						"Align the study title, claims, variables, methods, findings/results, and contributions with the selected notebook material. Do not contradict notebook evidence or invent a different study.",
						"Do not skip notes or files in the library. Ground Introduction, Methodology, Results/Findings (or equivalent chapters), Discussion, and Conclusion in this material whenever it is relevant.",
						"Use datasets, survey/questionnaire material, response files, lab notes, and notebook pages when present. Use only values present in the selected library for numeric tables and reported findings.",
						"Treat figures/images as metadata-only context here: titles, captions, filenames, and linked lab references. Do not infer unseen image content or claim raw image analysis.",
						"Published literature from the retrieval bank supports Literature Review / Theoretical Framework and citations — it must not replace notebook evidence in Methods/Results.",
						"",
						"**Selected research library**",
						"",
						libraryText,
					]
			: [];

	return [
		...assignmentBriefBlock,
		...(assignmentBriefBlock.length ? [""] : []),
		formatIdeaForChat(ideaForChat, input.topic),
		"",
		`Discipline: ${input.disciplineLabel}`,
		`Scope: ${profile.label}`,
		"",
		`Reference style: ${styleLabel}`,
		"",
		// Place notebook evidence before structure/outline so long-form agents see it first.
		...libraryBlock,
		...(libraryBlock.length ? [""] : []),
		...formatStructureInstructions(profile),
		profile.scope === "assignment"
			? userBrief || uploadedBrief
				? "Use the approved outline only to organise literature themes and brief coverage; the user-provided assignment information remains primary — explain and satisfy that full brief with its own structure, not a different question."
				: "Use the approved outline only to organise literature themes; the assignment topic remains the assignment to write."
			: libraryBlock.length
				? `Use the approved outline to organise the ${profile.label}; the selected research notebook library remains the primary evidence base for study-specific sections.`
				: scopedBriefBlock.length
					? `Use the approved outline to organise the ${profile.label}; the intake fields (${agentCopy.outlinePrimary}) remain primary.`
					: "Follow the outline's research question, objectives, methodology, literature themes, expected contributions, and timeline where they fit this deliverable type.",
		"Expand each required section into substantive prose with in-text citations and a References section in the selected style.",
		...formatAcademicIntegrityRules(profile),
		"Document quality: state a clear gap or focus; synthesize literature thematically (not paper-by-paper); include Limitations where relevant; use cautious language when evidence is thin; keep section jobs coherent for this deliverable type.",
		...typeSpecificLines,
		"Use sources from the outline's literature review and Sources for further reading only when they also appear in the retrieval bank; paraphrase bank abstracts for in-text cites.",
		"Create concise Markdown tables for useful comparisons, literature synthesis, methods, or results when those sections exist. Every table/figure needs a numbered title, one-sentence caption, and an in-text reference near first mention.",
		"Every table must use valid GitHub-flavored Markdown: one pipe-delimited header row, an immediate separator row such as `| --- | --- |`, then pipe-delimited data rows. Never imitate a table with plain text and pipe characters.",
		"Never create a section titled “Data Source and Variables” (or similar). Dataset samples belong only in results/findings sections when those exist, capped at 5 rows.",
		...visualLines,
		...(hasCanonicalVisuals && vizClipped
			? [
					"",
					"**Canonical tables / figure list**",
					"",
					vizClipped,
				]
			: []),
		"",
		"**Approved research outline**",
		"",
		outlineClipped,
	].join("\n");
}

/** Stage the full research prompt and citation style before navigating to chat. */
export function stageResearchGeneration(
	prompt: string,
	citationStyle: CitationStyle,
	scope?: ResearchScope,
): void {
	saveChatCitationStyle(citationStyle);
	if (scope) saveChatResearchScope(scope);
	else {
		const profile = getScopeProfile(parseScopeMaybe(prompt));
		saveChatResearchScope(profile.scope);
	}
	stageChatPrefill(prompt);
}

function parseScopeMaybe(prompt: string): ResearchScope {
	return parseScopeFromPrompt(prompt) || "journal";
}
