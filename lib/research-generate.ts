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
	const analysisHeading = profile.headings.find((h) => /critical analysis|analysis/i.test(h));
	const visualSection =
		resultsHeading ??
		analysisHeading ??
		(profile.headings.includes("Discussion") ? "Discussion" : null) ??
		"Critical Analysis";

	const typeSpecificLines: string[] = [];
	if (profile.scope === "assignment") {
		typeSpecificLines.push(
			`${analysisHeading ?? "Critical Analysis"}: develop the argument with bank-supported evaluation; do not invent Methods, Results, or empirical findings.`,
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
				...(hasCanonicalCharts
					? [
							`Also in **${visualSection}**, insert the provided canonical sample tables (≤5 rows) and \`research-chart\` blocks exactly as written.`,
							"Do not invent, rewrite, rescale, expand, or replace the numeric values in those canonical artifacts.",
						]
					: [
							"If sample tables are provided in the figure list, insert them exactly (≤5 rows — do not expand to the full dataset).",
						]),
			]
		: hasCanonicalVisuals
			? [
					`In **${visualSection}**, insert the provided canonical sample tables (≤5 rows) and \`research-chart\` blocks exactly as written.`,
					"Do not invent, rewrite, rescale, expand, or replace the numeric values in those canonical artifacts.",
					"Discuss them in prose with numbered titles/captions (e.g. Table 1, Figure 1) placed near the first mention.",
					"Do not create extra illustrative images when canonical artifacts are provided; do not leave orphan visuals.",
				]
			: profile.scope === "assignment"
				? [
						"Optional: one short literature-synthesis table in Literature Review or Critical Analysis if it clarifies themes. Prefer prose over charts.",
						"Do not invent empirical findings charts; any illustrative table must be labelled Illustrative and not presented as observed results.",
					]
				: [
						"When no dataset or findings are supplied, create useful literature-synthesis tables and clearly labelled illustrative graphs when they clarify the argument.",
						"Illustrative graph values must be plausible examples only, never presented as observed study findings or cited statistics.",
						`Label every such title and caption with “Illustrative” and explain in **${visualSection}** that the values are synthetic.`,
						"Emit graphs as fenced `research-chart` JSON blocks with this schema:",
						'{"type":"bar|line|area|pie|scatter","kind":"illustrative","title":"Illustrative: descriptive title","caption":"Synthetic example—not observed findings.","xKey":"category field","yKeys":["numeric field"],"data":[{"category field":"Label","numeric field":12}]}',
						"Keep charts to at most 30 data points and tables to the most relevant rows; prefer bar/line/scatter as appropriate.",
						"When a framework, process, or variable model is discussed, include a conceptual `research-image` JSON figure; number and caption it; reference it in prose.",
						"When competing literature themes appear, include a short literature-comparison Markdown table.",
					];

	const userBrief = input.assignmentInstructions?.trim();
	const agentCopy = getScopeAgentCopy(profile.scope);
	const scopedBriefBlock =
		profile.scope === "assignment"
			? []
			: buildScopeBriefPromptLines({
					scope: profile.scope,
					topic: input.topic,
					title: input.idea.title,
					assignmentInstructions: input.assignmentInstructions,
					researchQuestions: input.idea.researchQuestions,
				});
	const assignmentBriefBlock =
		scopedBriefBlock.length
			? scopedBriefBlock
			: profile.scope === "assignment"
				? [
						"**Assignment (primary)**",
						"",
						`**Topic:** ${input.topic.trim() || input.idea.title}`,
						"",
						...(userBrief ? ["**Additional notes:**", "", userBrief, ""] : []),
						"Write a cited coursework assignment on this topic in the selected discipline. Use Title, Introduction, Literature Review, Critical Analysis, Conclusion, and References. Body length must be 1,900–2,100 words excluding references. Do not invent Methods, Results, or empirical findings.",
						"Cite at least 20 verified bank papers with real years (never n.d.). Every major factual claim needs an in-text citation. Every References entry must appear as an in-text citation. Prefer direct higher-education evidence when the topic is about universities, students, or faculty. Format References in APA 7. Do not write editorial asides about abstracts or fact-checking.",
						"If an uploaded file appears below, treat it as additional assignment brief text — not as empirical data.",
					]
				: [];

	const ideaForChat = scopedBriefBlock.length
		? { ...input.idea, rationale: "", researchQuestions: undefined }
		: input.idea;

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
		...formatStructureInstructions(profile),
		profile.scope === "assignment"
			? "Use the approved outline only to organise literature themes; the assignment topic remains the assignment to write."
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
		...(input.sourceContext?.trim()
			? profile.scope === "assignment"
				? [
						profile.scope === "assignment"
							? "The uploaded file is additional assignment brief text. Follow it together with the typed topic. Do not treat it as empirical results."
							: `The uploaded file is additional ${agentCopy.uploadedKind} text. Follow it together with the typed topic and intake fields. Do not treat it as empirical results unless it clearly contains a dataset.`,
						"",
						profile.scope === "assignment"
							? "**Uploaded assignment brief**"
							: `**Uploaded ${agentCopy.uploadedKind}**`,
						"",
						input.sourceContext.trim(),
					]
				: [
						"The user selected a research notebook library and/or uploaded evidence. Use the FULL folder contents below as primary source material: notes, lab log, documents, datasets, surveys, figures, and references.",
						"Align the study title, claims, variables, methods, and findings with the selected notebook material. Do not contradict notebook evidence, notes, datasets, surveys, lab work, or uploaded documents.",
						"Do not skip notes or files in the library. Ground Introduction, Methodology, Results, Discussion, and Conclusion in this material whenever it is relevant.",
						"Use datasets, survey/questionnaire material, response files, lab notes, and notebook pages when present. Use only values present in the selected library for numeric tables and reported findings.",
						"Treat figures/images as metadata-only context here: titles, captions, filenames, and linked lab references. Do not infer unseen image content or claim raw image analysis.",
						"Do not invent a different study or ignore the folder in favour of a generic topic.",
						"",
						"**Selected research library**",
						"",
						input.sourceContext.trim(),
					]
			: []),
		...(hasCanonicalVisuals
			? [
					"",
					"**Canonical tables / figure list**",
					"",
					input.visualizationArtifacts!.trim(),
				]
			: []),
		"",
		"**Approved research outline**",
		"",
		input.outline.trim(),
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
