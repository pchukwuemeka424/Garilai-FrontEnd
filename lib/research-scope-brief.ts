import type { IdeaType, ResearchScope } from "@/lib/research-ideas";
import { getScopeLabel, normalizeResearchScope } from "@/lib/research-ideas";
import { getScopeProfile } from "@/lib/research-scope-profiles";

export type ScopeBriefFieldKind = "text" | "textarea" | "select";

export type ScopeBriefField = {
	id: string;
	label: string;
	help?: string;
	placeholder?: string;
	required?: boolean;
	kind: ScopeBriefFieldKind;
	options?: { id: string; label: string }[];
	maxLength?: number;
	rows?: number;
};

export type ScopeRefineChip = {
	id: string;
	label: string;
	prompt: string;
};

export type ScopeBriefCopy = {
	kicker: string;
	title: string;
	lead: string;
	topicTitle: string;
	topicHelp: string;
	topicPlaceholder: string;
	notesTitle: string;
	notesHelp: string;
	notesPlaceholder: string;
	notesRequired: boolean;
	/** When false, the notes/instructions card is omitted from intake. */
	showNotes?: boolean;
	generateError: string;
	readyNotesLabel: string;
	readyTopicLabel: string;
	ideaApproach: string;
	ideaType: IdeaType;
	fallbackTopic: string;
	fields: ScopeBriefField[];
	refineChips: ScopeRefineChip[];
};

const COPIES: Record<ResearchScope, ScopeBriefCopy> = {
	assignment: {
		kicker: "Coursework assignment",
		title: "Generate your assignment",
		lead: "Type the topic, then generate a cited assignment in your field — without inventing methods or results.",
		topicTitle: "Assignment topic",
		topicHelp: "The subject or title of the assignment.",
		topicPlaceholder: "Type the assignment topic or question…",
		notesTitle: "Notes for the agent",
		notesHelp: "Optional constraints if you later attach a brief in the workspace.",
		notesPlaceholder: "",
		notesRequired: false,
		showNotes: false,
		generateError: "Enter an assignment topic.",
		readyNotesLabel: "Assignment topic",
		readyTopicLabel: "Assignment topic",
		ideaApproach:
			"Write a cited assignment on this topic. Use Introduction, Literature Review, Critical Analysis, Conclusion, and References. Do not invent Methods or Results.",
		ideaType: "theoretical",
		fallbackTopic: "Coursework assignment",
		fields: [],
		refineChips: [
			{
				id: "critical-analysis",
				label: "Strengthen Critical Analysis",
				prompt:
					"Revise only the Critical Analysis so it is the argumentative core: evaluate competing claims, compare perspectives, and build a reasoned position with bank citations. Do not add Methods, Results, or invented empirical findings.",
			},
			{
				id: "stay-on-topic",
				label: "Stay on topic",
				prompt:
					"Keep every section tightly focused on the assignment topic. Remove anything that does not serve the question implied by the title.",
			},
			{
				id: "no-methods",
				label: "Keep as an assignment",
				prompt:
					"Remove any Methodology, Methods, Results, Findings, Abstract, or Keywords sections. Keep Introduction, Literature Review, Critical Analysis, Conclusion, and References only.",
			},
		],
	},
	conference: {
		kicker: "Conference paper",
		title: "Generate your conference paper",
		lead: "Type the topic, then generate a compact IMRaD conference paper — not a journal article or thesis.",
		topicTitle: "Paper title / topic",
		topicHelp: "Working title or research focus for the submission.",
		topicPlaceholder: "Type the paper title or research focus…",
		notesTitle: "Notes for the agent",
		notesHelp: "Contribution claim, required template, or reviewer constraints.",
		notesPlaceholder: "Optional: contribution statement, forbidden sections, or special formatting…",
		notesRequired: false,
		showNotes: false,
		generateError: "Enter a paper title or topic.",
		readyNotesLabel: "Paper title / topic",
		readyTopicLabel: "Paper title / topic",
		ideaApproach:
			"Write a compact conference contribution with a clear gap, concise reproducible methods, tight results, and a focused discussion. Do not add Acknowledgments or expand into thesis chapters.",
		ideaType: "empirical",
		fallbackTopic: "Conference paper",
		fields: [],
		refineChips: [
			{
				id: "abstract-150",
				label: "Shorten Abstract",
				prompt:
					"Rewrite the Abstract to ≤150 words. Keep the gap, method, headline finding, and implication. Do not cite in the Abstract.",
			},
			{
				id: "compact-methods",
				label: "Compact Methods",
				prompt:
					"Tighten Methods so they are reproducible but concise enough for a conference page limit. Cut thesis-level detail without dropping design, sample, instruments, or analysis.",
			},
			{
				id: "no-thesis",
				label: "Keep conference length",
				prompt:
					"Cut any thesis-style front matter, long literature catalogues, or Acknowledgments. Keep compact IMRaD: Abstract, Keywords, Introduction, Methods, Results, Discussion, Conclusion, References.",
			},
		],
	},
	journal: {
		kicker: "Journal/Research Paper",
		title: "Generate your journal / research paper",
		lead: "Type the topic, then generate a peer-reviewed IMRaD article with Acknowledgments.",
		topicTitle: "Article title / topic",
		topicHelp: "Working title or research focus.",
		topicPlaceholder: "Type the article title or research focus…",
		notesTitle: "Notes for the agent",
		notesHelp: "Special issue theme, house style, or reviewer constraints.",
		notesPlaceholder: "Optional: special issue, reporting guidelines, or journal quirks…",
		notesRequired: false,
		showNotes: false,
		generateError: "Enter an article title or topic.",
		readyNotesLabel: "Article title / topic",
		readyTopicLabel: "Article title / topic",
		ideaApproach:
			"Write a peer-reviewed journal article in IMRaD. Synthesize literature thematically in Introduction and Discussion. Methods must be reproducible; Results are evidence-only; Discussion includes explicit Limitations.",
		ideaType: "empirical",
		fallbackTopic: "Journal/Research Paper",
		fields: [],
		refineChips: [
			{
				id: "imrad",
				label: "Tighten IMRaD",
				prompt:
					"Enforce strict IMRaD: Introduction → Methods → Results → Discussion → Conclusion. Move literature synthesis out of a standalone Literature Review into Introduction and Discussion. Keep Acknowledgments.",
			},
			{
				id: "reproducible-methods",
				label: "Reproducible Methods",
				prompt:
					"Strengthen Methods so another researcher could reproduce the design, sample, instruments, procedure, and analysis. Do not report findings in Methods.",
			},
			{
				id: "limitations",
				label: "Add Limitations",
				prompt:
					"Ensure Discussion includes an explicit Limitations subsection that matches the study design, then interpret findings against literature rather than restating Results.",
			},
		],
	},
	report: {
		kicker: "Project report",
		title: "Generate your report",
		lead: "Type the topic, then generate an applied report with an executive summary, findings, and actionable recommendations.",
		topicTitle: "Report title / topic",
		topicHelp: "What the report is about.",
		topicPlaceholder: "Type the report title or topic…",
		notesTitle: "Scope notes",
		notesHelp: "Audience, constraints, or decisions the report must support.",
		notesPlaceholder: "Optional: audience, embargo, or decisions this report must inform…",
		notesRequired: false,
		showNotes: false,
		generateError: "Enter a report title or topic.",
		readyNotesLabel: "Report title / topic",
		readyTopicLabel: "Report title / topic",
		ideaApproach:
			"Write an applied institutional or industry report: executive summary, objectives, findings, analysis, and numbered actionable recommendations. Do not force journal IMRaD labels.",
		ideaType: "applied",
		fallbackTopic: "Project report",
		fields: [],
		refineChips: [
			{
				id: "exec-summary",
				label: "Sharpen Executive Summary",
				prompt:
					"Rewrite the Executive Summary so it is citation-free and previews objectives, key findings, and recommendations in one page-equivalent block.",
			},
			{
				id: "numbered-recs",
				label: "Number Recommendations",
				prompt:
					"Make Recommendations numbered, actionable, and explicitly grounded in Findings/Analysis. Each recommendation should state who acts, on what, and why the evidence supports it.",
			},
			{
				id: "no-imrad",
				label: "Keep report structure",
				prompt:
					"Do not use journal IMRaD labels (no Literature Review / Results / Discussion pair). Keep Executive Summary, Introduction, Background, Objectives, Methods, Findings, Analysis, Recommendations, Conclusion, References, Appendices.",
			},
		],
	},
	proposal: {
		kicker: "Research proposal",
		title: "Generate your proposal",
		lead: "Type the topic, then generate a proposal with planned methods, timeline, outcomes, and budget — without inventing completed results.",
		topicTitle: "Proposal title / topic",
		topicHelp: "Study or programme title.",
		topicPlaceholder: "Type the proposal title or topic…",
		notesTitle: "Call notes",
		notesHelp: "Eligibility, assessment criteria, or required work packages.",
		notesPlaceholder: "Optional: assessment criteria, work packages, or funder language to echo…",
		notesRequired: false,
		showNotes: false,
		generateError: "Enter a proposal title or topic.",
		readyNotesLabel: "Proposal title / topic",
		readyTopicLabel: "Proposal title / topic",
		ideaApproach:
			"Write a grant or study proposal: problem, objectives, literature, planned methods, timeline, expected outcomes, and budget. Do not invent completed Results or Findings.",
		ideaType: "theoretical",
		fallbackTopic: "Research proposal",
		fields: [],
		refineChips: [
			{
				id: "planned-methods",
				label: "Planned methods only",
				prompt:
					"Rewrite Methodology as planned (not completed) work: design, sample, collection, instruments, analysis. Remove any Results, Findings, or observed data.",
			},
			{
				id: "timeline-budget",
				label: "Fill Timeline & Budget",
				prompt:
					"Ensure Timeline and Budget are concrete forward-looking plans calibrated to the stated duration and funder. Do not invent completed expenditure or results.",
			},
			{
				id: "no-results",
				label: "Remove Results",
				prompt:
					"Delete any Results, Findings, or Results / Analysis sections. This is a proposal. Keep Expected Outcomes as anticipated contributions only.",
			},
		],
	},
	faculty: {
		kicker: "Faculty / grant",
		title: "Generate your programme",
		lead: "Type the topic, then generate a faculty-scale proposal with dense literature, a multi-year timeline, and budget — no empirical Results.",
		topicTitle: "Programme title / topic",
		topicHelp: "The multi-year research programme.",
		topicPlaceholder: "Type the programme title or topic…",
		notesTitle: "Programme notes",
		notesHelp: "Work packages, partners, or institutional priorities.",
		notesPlaceholder: "Optional: partners, work packages, or institutional strategy language…",
		notesRequired: false,
		showNotes: false,
		generateError: "Enter a programme title or topic.",
		readyNotesLabel: "Programme title / topic",
		readyTopicLabel: "Programme title / topic",
		ideaApproach:
			"Write an ambitious multi-year faculty/grant programme: problem, objectives, deep literature, planned methods, multi-year timeline, outcomes, and budget. Never invent completed empirical Results.",
		ideaType: "theoretical",
		fallbackTopic: "Faculty grant programme",
		fields: [],
		refineChips: [
			{
				id: "planned-methods",
				label: "Planned methods only",
				prompt:
					"Rewrite Methodology as planned faculty-scale work. Remove any completed Results or Findings. Keep denser literature and multi-year ambition.",
			},
			{
				id: "timeline-budget",
				label: "Multi-year Timeline & Budget",
				prompt:
					"Expand Timeline and Budget to a multi-year programme with work packages, milestones, and indicative cost headings. Do not invent spent funds or observed results.",
			},
			{
				id: "no-imrad",
				label: "Keep grant structure",
				prompt:
					"Do not collapse into journal IMRaD or thesis chapters. Keep problem, objectives, literature, methodology, timeline, expected outcomes, budget, conclusion, references.",
			},
		],
	},
	undergraduate_project: {
		kicker: "Undergraduate project",
		title: "Generate your project",
		lead: "Type the topic, then generate Chapters 1–7 plus front matter for an undergraduate research project.",
		topicTitle: "Project title / topic",
		topicHelp: "Working title of the undergraduate project.",
		topicPlaceholder: "Type the project title or topic…",
		notesTitle: "Supervisor notes",
		notesHelp: "Required chapters, tools, or marking criteria.",
		notesPlaceholder: "Optional: required tools, chapter extras, or marking rubric notes…",
		notesRequired: false,
		showNotes: false,
		generateError: "Enter a project title or topic.",
		readyNotesLabel: "Project title / topic",
		readyTopicLabel: "Project title / topic",
		ideaApproach:
			"Write an undergraduate project with exact Chapter One–Seven headings plus front matter. Chapter Five reports testing/results; Chapter Six interprets; Chapter Seven concludes with recommendations.",
		ideaType: "applied",
		fallbackTopic: "Undergraduate project",
		fields: [],
		refineChips: [
			{
				id: "keep-chapters",
				label: "Keep Chapters 1–7",
				prompt:
					"Restore the exact undergraduate headings: Title Page, Declaration, Abstract, Acknowledgments, Table of Contents, Chapter One through Chapter Seven, References, Appendices. Do not collapse into journal IMRaD.",
			},
			{
				id: "testing-results",
				label: "Evidence-only Chapter Five",
				prompt:
					"Rewrite Chapter Five: Testing and Results as evidence-only reporting. Move interpretation to Chapter Six: Discussion.",
			},
			{
				id: "front-matter",
				label: "Complete front matter",
				prompt:
					"Ensure Title Page, Declaration, Abstract, Acknowledgments, and Table of Contents are present and citation-free.",
			},
		],
	},
	thesis: {
		kicker: "Master's thesis",
		title: "Generate your thesis",
		lead: "Type the topic, then generate a chapter-style master's thesis with a substantial literature review, findings, and distinct recommendations.",
		topicTitle: "Thesis title / topic",
		topicHelp: "Working title of the thesis.",
		topicPlaceholder: "Type the thesis title or topic…",
		notesTitle: "Handbook notes",
		notesHelp: "School conventions, word bands, or required chapters.",
		notesPlaceholder: "Optional: school conventions, required chapters, or ethics notes…",
		notesRequired: false,
		showNotes: false,
		generateError: "Enter a thesis title or topic.",
		readyNotesLabel: "Thesis title / topic",
		readyTopicLabel: "Thesis title / topic",
		ideaApproach:
			"Write a master's thesis with front matter, substantial thematic literature, reproducible methods, evidence-only findings, discussion, conclusion, and distinct actionable recommendations. Do not rewrite as a short journal article.",
		ideaType: "empirical",
		fallbackTopic: "Master's thesis",
		fields: [],
		refineChips: [
			{
				id: "deepen-lit",
				label: "Deepen Literature Review",
				prompt:
					"Expand Literature Review into substantial thematic synthesis (not paper-by-paper). Keep it distinct from Introduction and from Findings / Results.",
			},
			{
				id: "distinct-recs",
				label: "Distinct Recommendations",
				prompt:
					"Make Recommendations a separate section from Conclusion, with actionable implications for practice or further research grounded in the findings.",
			},
			{
				id: "thesis-order",
				label: "Keep thesis order",
				prompt:
					"Keep thesis section order exactly — Title Page, Abstract, Acknowledgments, Table of Contents, Introduction, Literature Review, Methodology, Findings / Results, Discussion, Conclusion, Recommendations, References, Appendices. Do not rewrite as a journal article.",
			},
		],
	},
	dissertation: {
		kicker: "Doctoral dissertation",
		title: "Generate your dissertation",
		lead: "Type the topic, then generate a cited doctoral dissertation in your field — with a theoretical framework and an explicit Contributions section.",
		topicTitle: "Dissertation topic",
		topicHelp: "The subject or title of the dissertation.",
		topicPlaceholder: "Type the dissertation topic or title…",
		notesTitle: "Doctoral notes",
		notesHelp: "Committee expectations, required chapters, or theory commitments.",
		notesPlaceholder: "Optional: committee notes, theory commitments, or chapter extras…",
		notesRequired: false,
		showNotes: false,
		generateError: "Enter a dissertation topic.",
		readyNotesLabel: "Dissertation topic",
		readyTopicLabel: "Dissertation topic",
		ideaApproach:
			"Write a doctoral dissertation with full front matter, a Theoretical Framework distinct from Literature Review, reproducible methodology, evidence-only Results, Discussion against theory, Conclusion, and novel scholarly Contributions. Never collapse to journal IMRaD.",
		ideaType: "empirical",
		fallbackTopic: "Doctoral dissertation",
		fields: [],
		refineChips: [
			{
				id: "theory",
				label: "Distinct Theoretical Framework",
				prompt:
					"Ensure Theoretical Framework is a distinct section from Literature Review: name the theory, justify it, and show how it organises the research questions and analysis.",
			},
			{
				id: "contributions",
				label: "Spell out Contributions",
				prompt:
					"Rewrite Contributions so they state novel scholarly contributions (theoretical, empirical, and/or methodological) rather than repeating the Conclusion.",
			},
			{
				id: "doctoral-front",
				label: "Doctoral front matter",
				prompt:
					"Preserve doctoral front matter and exact section order including Dedication, List of Tables, and List of Figures. Never collapse to journal IMRaD.",
			},
		],
	},
};

const DISCIPLINE_TOPIC_EXAMPLES: Record<string, string> = {
	accounting: "e.g. Critically evaluate IFRS 15 revenue recognition in listed companies",
	communication: "e.g. Framing of climate activism on digital news platforms",
	finance: "e.g. The effect of capital structure on firm performance in emerging markets",
	journalism: "e.g. Objectivity and audience trust in local television news",
	marketing: "e.g. Influencer marketing and brand authenticity among Gen Z consumers",
};

export function getScopeBriefCopy(scope: string | null | undefined): ScopeBriefCopy {
	const key = normalizeResearchScope(scope) || "journal";
	return COPIES[key] ?? COPIES.journal;
}

export function formatScopeBrief(
	scope: string | null | undefined,
	values: Record<string, string>,
	notes: string,
): string {
	const copy = getScopeBriefCopy(scope);
	if (copy.fields.length === 0) return notes.trim();
	const lines: string[] = [];
	for (const field of copy.fields) {
		const value = values[field.id]?.trim();
		if (!value) continue;
		const option = field.options?.find((item) => item.id === value);
		lines.push(`${field.label}: ${option?.label ?? value}`);
	}
	const trimmedNotes = notes.trim();
	if (trimmedNotes) {
		if (lines.length) lines.push("");
		lines.push(`${copy.notesTitle}:`, trimmedNotes);
	}
	return lines.join("\n").trim();
}

export type ParsedScopeBrief = {
	values: Record<string, string>;
	notes: string;
};

export type ResolvedScopeBrief = ParsedScopeBrief & {
	questionsList: string[];
};

export type DissertationBriefFields = {
	degree: string;
	questions: string;
	questionsList: string[];
	contributions: string;
	notes: string;
};

export type ScopeAgentCopy = {
	fieldJobs: Record<string, string>;
	notesJob: string;
	writeRules: string[];
	refineGoals: string[];
	uploadedKind: string;
	outlinePrimary: string;
};

const AGENT_COPIES: Record<ResearchScope, ScopeAgentCopy> = {
	assignment: {
		fieldJobs: {},
		notesJob: "optional extra constraints — not empirical data",
		writeRules: [],
		refineGoals: [
			"Keep the assignment topic as the assignment to write; do not drift into a different question.",
			"Do not add Methodology, Methods, Results, or invented empirical findings.",
		],
		uploadedKind: "assignment brief",
		outlinePrimary: "assignment topic",
	},
	conference: {
		fieldJobs: {},
		notesJob: "CFP, template, or reviewer constraints — not empirical data",
		writeRules: [
			"Write a compact conference paper. Keep compact IMRaD: Abstract, Keywords, Introduction, Methods, Results, Discussion, Conclusion, References. Do not add Acknowledgments, Title Page, Declaration, or thesis chapters. Keep this deliverable’s required section order and word target.",
			"If an uploaded file appears below, treat it as additional CFP or template text — not as empirical study data unless it clearly contains a dataset.",
		],
		refineGoals: [
			"Do not rewrite as a journal article or thesis.",
			"Keep Methods compact and drop Acknowledgments / front matter.",
		],
		uploadedKind: "CFP or template",
		outlinePrimary: "paper title / topic",
	},
	journal: {
		fieldJobs: {},
		notesJob: "special issue, reporting guidelines, or journal constraints — not empirical data",
		writeRules: [
			"Write a peer-reviewed journal article. Empirical papers use reproducible Methods and evidence-only Results; literature reviews must not invent primary studies or unaudited PRISMA searches; theoretical articles argue from literature and must not invent empirical findings. Follow IMRaD (Introduction → Methods → Results → Discussion → Conclusion) and keep Acknowledgments. Keep this deliverable’s required section order and word target.",
			"If an uploaded file appears below, treat it as additional author guidelines — not as empirical study data unless it clearly contains a dataset.",
		],
		refineGoals: [
			"Do not convert a review or theoretical article into a primary empirical study.",
			"Keep IMRaD and Acknowledgments; do not add a standalone Literature Review heading.",
		],
		uploadedKind: "author guidelines",
		outlinePrimary: "article title / topic",
	},
	report: {
		fieldJobs: {},
		notesJob: "audience, embargo, or decision constraints — not empirical data",
		writeRules: [
			"Write an applied project report. Executive Summary must preview the objectives; Recommendations must be numbered, actionable, and mapped to those objectives. Do not force journal IMRaD labels. Keep this deliverable’s required section order and word target.",
			"If an uploaded file appears below, treat it as additional terms of reference — not as empirical study data unless it clearly contains a dataset.",
		],
		refineGoals: [
			"Recommendations must serve the report objectives derived from the title.",
			"Do not rewrite as journal IMRaD.",
		],
		uploadedKind: "terms of reference",
		outlinePrimary: "report title / topic",
	},
	proposal: {
		fieldJobs: {},
		notesJob: "eligibility, assessment criteria, or work packages — not empirical data",
		writeRules: [
			"Write a grant or study proposal. Methodology describes planned methods only — do not invent completed Results, Findings, or observed empirical data. Keep this deliverable’s required section order and word target.",
			"If an uploaded file appears below, treat it as additional call notes — not as empirical study data unless it clearly contains a dataset.",
		],
		refineGoals: [
			"Calibrate Timeline and Budget to a plausible study duration.",
			"Do not invent completed Results or Findings.",
		],
		uploadedKind: "call notes",
		outlinePrimary: "proposal title / topic",
	},
	faculty: {
		fieldJobs: {},
		notesJob: "work packages, partners, or institutional priorities — not empirical data",
		writeRules: [
			"Write an ambitious multi-year faculty/grant programme. Methodology is planned faculty-scale work only — never invent completed empirical Results. Do not collapse into journal IMRaD or thesis chapters. Keep this deliverable’s required section order and word target.",
			"If an uploaded file appears below, treat it as additional RFP or programme notes — not as empirical study data unless it clearly contains a dataset.",
		],
		refineGoals: [
			"Keep multi-year planned methods only — no completed Results.",
			"Do not collapse into journal IMRaD or thesis chapters.",
		],
		uploadedKind: "RFP or programme notes",
		outlinePrimary: "programme title / topic",
	},
	undergraduate_project: {
		fieldJobs: {},
		notesJob: "required chapters, tools, or marking criteria — not empirical data",
		writeRules: [
			"Write an undergraduate project with exact Chapter One–Seven headings plus front matter. Shape Chapters Three–Five to the project implied by the title (system, empirical, or applied report). Chapter Five reports testing/results; Chapter Six interprets; Chapter Seven concludes with recommendations. Do not collapse into journal IMRaD. Keep this deliverable’s required section order and word target.",
			"If an uploaded file appears below, treat it as additional handbook or marking notes — not as empirical study data unless it clearly contains a dataset.",
		],
		refineGoals: [
			"Keep Chapters One–Seven headings.",
			"Do not collapse into journal IMRaD.",
		],
		uploadedKind: "handbook or marking notes",
		outlinePrimary: "project title / topic",
	},
	thesis: {
		fieldJobs: {},
		notesJob: "school conventions, word bands, or required chapters — not empirical data",
		writeRules: [
			"Write a master's thesis. Introduction must state investigable research questions derived from the title; Findings, Discussion, Conclusion, and Recommendations must answer them. Keep Recommendations distinct from Conclusion. Do not rewrite as a short journal article. Keep this deliverable’s required section order and word target.",
			"If an uploaded file appears below, treat it as additional thesis handbook text — not as empirical study data unless it clearly contains a dataset.",
		],
		refineGoals: [
			"Keep Recommendations distinct from Conclusion.",
			"Do not rewrite as a short journal article.",
		],
		uploadedKind: "thesis handbook",
		outlinePrimary: "thesis title / topic",
	},
	dissertation: {
		fieldJobs: {},
		notesJob: "committee/handbook constraints — not empirical data",
		writeRules: [
			"Write a complete doctoral dissertation. Introduction must state investigable research questions derived from the title; Results, Discussion, and Conclusion must answer them. Theoretical Framework must be distinct from Literature Review and organise those questions. The Contributions section must state novel scholarly contributions (theoretical, empirical, and/or methodological) rather than restating the Conclusion. Never collapse to journal IMRaD. Keep this deliverable’s required section order and word target.",
			"If an uploaded file appears below, treat it as additional doctoral handbook or committee text — not as empirical study data unless it clearly contains a dataset.",
		],
		refineGoals: [
			"Keep Theoretical Framework distinct from Literature Review: name the theory, justify it, and show how it organises the research questions.",
			"Keep the Contributions claims (theoretical, empirical, and/or methodological); do not collapse Contributions into Conclusion.",
		],
		uploadedKind: "doctoral handbook or committee notes",
		outlinePrimary: "dissertation topic",
	},
};

export function getScopeAgentCopy(scope: string | null | undefined): ScopeAgentCopy {
	const key = normalizeResearchScope(scope) || "journal";
	return AGENT_COPIES[key] ?? AGENT_COPIES.journal;
}

/** Split a `formatScopeBrief` string back into labeled field values and notes. */
export function parseScopeBrief(
	scope: string | null | undefined,
	brief: string | null | undefined,
): ParsedScopeBrief {
	const copy = getScopeBriefCopy(scope);
	const values: Record<string, string> = {};
	let notes = "";
	const text = (brief ?? "").replace(/\r/g, "").trim();
	if (!text) return { values, notes };

	const labelToId = new Map<string, string>();
	for (const field of copy.fields) {
		labelToId.set(field.label.toLowerCase(), field.id);
	}
	const notesLabel = copy.notesTitle.toLowerCase();
	const headerRe = /^([^:\n]{1,80}):\s*(.*)$/;

	let currentId: string | null = null;
	let currentIsNotes = false;
	const buckets: Record<string, string[]> = {};
	const noteLines: string[] = [];

	for (const line of text.split("\n")) {
		const match = line.match(headerRe);
		const label = match?.[1]?.trim().toLowerCase() ?? "";
		const fieldId = labelToId.get(label);
		const isNotesHeader = Boolean(match) && label === notesLabel;

		if (fieldId || isNotesHeader) {
			currentId = fieldId ?? null;
			currentIsNotes = isNotesHeader;
			const rest = (match?.[2] ?? "").trim();
			if (currentIsNotes) {
				if (rest) noteLines.push(rest);
			} else if (currentId) {
				buckets[currentId] ??= [];
				if (rest) buckets[currentId].push(rest);
			}
			continue;
		}

		if (currentIsNotes) noteLines.push(line);
		else if (currentId) {
			buckets[currentId] ??= [];
			buckets[currentId].push(line);
		}
	}

	for (const [id, lines] of Object.entries(buckets)) {
		values[id] = lines.join("\n").trim();
	}
	notes = noteLines.join("\n").trim();
	return { values, notes };
}

export function resolveScopeBriefFields(
	scope: string | null | undefined,
	brief: string | null | undefined,
	researchQuestions?: string[] | null,
): ResolvedScopeBrief {
	const parsed = parseScopeBrief(scope, brief);
	const questions = parsed.values.questions?.trim() ?? "";
	const fromBrief = parseResearchQuestions(questions);
	const fromIdea = (researchQuestions ?? []).filter((q) => q.trim().length > 8);
	return {
		values: parsed.values,
		notes: parsed.notes,
		questionsList: fromBrief.length ? fromBrief : fromIdea,
	};
}

export function parseDissertationBrief(brief: string | null | undefined): DissertationBriefFields {
	const parsed = resolveScopeBriefFields("dissertation", brief);
	return {
		degree: parsed.values.degree?.trim() ?? "",
		questions: parsed.values.questions?.trim() ?? "",
		questionsList: parsed.questionsList,
		contributions: parsed.values.contributions?.trim() ?? "",
		notes: parsed.notes,
	};
}

export function resolveDissertationBriefFields(
	brief: string | null | undefined,
	researchQuestions?: string[] | null,
): DissertationBriefFields {
	const parsed = resolveScopeBriefFields("dissertation", brief, researchQuestions);
	return {
		degree: parsed.values.degree?.trim() ?? "",
		questions: parsed.values.questions?.trim() ?? "",
		questionsList: parsed.questionsList,
		contributions: parsed.values.contributions?.trim() ?? "",
		notes: parsed.notes,
	};
}

export function buildScopeBriefPromptLines(input: {
	scope: ResearchScope;
	topic: string;
	title: string;
	assignmentInstructions?: string;
	researchQuestions?: string[];
}): string[] {
	if (input.scope === "assignment") return [];
	const copy = getScopeBriefCopy(input.scope);
	const agent = getScopeAgentCopy(input.scope);
	const resolved = resolveScopeBriefFields(
		input.scope,
		input.assignmentInstructions,
		input.researchQuestions,
	);
	const hasFields = copy.fields.some((field) => resolved.values[field.id]?.trim()) ||
		resolved.questionsList.length > 0 ||
		Boolean(resolved.notes);
	if (!hasFields && !input.assignmentInstructions?.trim()) return [];

	const lines: string[] = [
		`**${copy.kicker} brief (primary — honour these fields)**`,
		"",
		`**Topic:** ${input.topic.trim() || input.title}`,
	];

	for (const field of copy.fields) {
		const job = agent.fieldJobs[field.id];
		if (field.id === "questions") {
			if (!resolved.questionsList.length) continue;
			lines.push(
				"",
				`**${field.label}${job ? ` (${job})` : ""}:**`,
				...resolved.questionsList.map((q, i) => `${i + 1}. ${q}`),
			);
			continue;
		}
		const value = resolved.values[field.id]?.trim();
		if (!value) continue;
		lines.push("", `**${field.label}${job ? ` (${job})` : ""}:**`, value);
	}

	if (resolved.notes) {
		lines.push("", `**${copy.notesTitle} (${agent.notesJob}):**`, resolved.notes);
	}

	lines.push("", ...agent.writeRules);
	return lines;
}

export function parseResearchQuestions(raw: string | null | undefined): string[] {
	if (!raw?.trim()) return [];
	return raw
		.split(/\n+/)
		.map((line) => line.replace(/^\s*(?:rq\s*\d+[:.)-]?\s*|\d+[:.)-]\s*)/i, "").trim())
		.filter((line) => line.length > 8)
		.slice(0, 7);
}

export function resolveBriefIdeaType(
	scope: string | null | undefined,
	values: Record<string, string>,
): IdeaType {
	const copy = getScopeBriefCopy(scope);
	const articleType = values.articleType?.trim();
	if (articleType === "theoretical" || articleType === "review") return "theoretical";
	if (articleType === "empirical") return "empirical";
	const projectType = values.projectType?.trim();
	if (projectType === "empirical") return "empirical";
	if (projectType === "system" || projectType === "report") return "applied";
	return copy.ideaType;
}

export function getScopeRefineChips(scope: string | null | undefined): ScopeRefineChip[] {
	return getScopeBriefCopy(scope).refineChips;
}

const RAIL_SKIP = new Set([
	"Title",
	"Title Page",
	"Declaration",
	"Dedication",
	"Table of Contents",
	"List of Tables",
	"List of Figures",
	"Keywords",
	"Appendices",
]);

export function getScopeRailHeadings(scope: string | null | undefined): string[] {
	return getScopeProfile(scope).headings.filter((heading) => !RAIL_SKIP.has(heading));
}

export function getScopeChecklistItems(scope: string | null | undefined): string[] {
	const profile = getScopeProfile(scope);
	const items = [...profile.sectionJobs.map((job) => job.replace(/^\*\*|\*\*$/g, "").replace(/\*\*/g, ""))];
	const citeHint = `${profile.minDistinctCites}+ distinct cited sources · ${profile.wordTarget.min.toLocaleString()}–${profile.wordTarget.max.toLocaleString()} words`;
	return [citeHint, ...items];
}

export function topicPlaceholderFor(scope: string | null | undefined, discipline: string): string {
	return DISCIPLINE_TOPIC_EXAMPLES[discipline] ?? getScopeBriefCopy(scope).topicPlaceholder;
}

export function scopeBriefEyebrow(scope: string | null | undefined): string {
	return getScopeBriefCopy(scope).kicker || getScopeLabel(scope ?? "journal");
}
