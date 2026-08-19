import type { ResearchSourceSelection } from "@/lib/research-assets-api";

export type ExportFormat = "pdf" | "md" | "txt" | "docx";

export type EffortBand = "none" | "low" | "moderate" | "high" | "very_high";

export type PaperAuthorProfile = {
	name?: string | null;
	email?: string | null;
	department?: string | null;
	institution?: string | null;
};

export type PaperMaterialCounts = {
	notes: number;
	documents: number;
	datasets: number;
	figures: number;
	labEntries: number;
	references: number;
	templates: number;
	/** Linked research projects at generation time (legacy). */
	projects: number;
};

export type PaperContentArtifacts = {
	charts: number;
	images: number;
	figures: number;
	tables: number;
	labMentions: number;
};

export type PaperEditStats = {
	wordsInserted: number;
	wordsDeleted: number;
	wordsUnchanged: number;
	changePercent: number;
	sectionsTouched: number;
};

export type PaperEffortSnapshot = {
	userEffortScore: number;
	aiShareScore: number;
	captureScore: number;
	writingScore: number;
	artifactScore: number;
	userBand: EffortBand;
	wordCount: number;
	baselineWordCount: number;
	humanEdited: boolean;
	hasBaseline: boolean;
	empty: boolean;
	materials: PaperMaterialCounts;
	artifacts: PaperContentArtifacts;
	edits: PaperEditStats;
	summaryLines: string[];
};

function clamp(n: number, lo = 0, hi = 100): number {
	return Math.max(lo, Math.min(hi, Math.round(n)));
}

export function tokenize(text: string): string[] {
	return text
		.replace(/<[^>]+>/g, " ")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s'-]/gu, " ")
		.split(/\s+/)
		.filter((w) => w.length > 1);
}

/** Approximate share of `current` that differs from `baseline` (0–1). */
export function paperEditDistanceRatio(baseline: string, current: string): number {
	const a = tokenize(baseline);
	const b = tokenize(current);
	if (a.length === 0 && b.length === 0) return 0;
	if (a.length === 0) return 1;
	if (b.length === 0) return 1;

	const counts = new Map<string, number>();
	for (const w of a) counts.set(w, (counts.get(w) ?? 0) + 1);
	let common = 0;
	for (const w of b) {
		const n = counts.get(w) ?? 0;
		if (n > 0) {
			common += 1;
			counts.set(w, n - 1);
		}
	}
	const union = a.length + b.length - common;
	if (union <= 0) return 0;
	return 1 - common / union;
}

export function computeEditStats(baseline: string, current: string): PaperEditStats {
	const a = tokenize(baseline);
	const b = tokenize(current);
	const counts = new Map<string, number>();
	for (const w of a) counts.set(w, (counts.get(w) ?? 0) + 1);
	let common = 0;
	for (const w of b) {
		const n = counts.get(w) ?? 0;
		if (n > 0) {
			common += 1;
			counts.set(w, n - 1);
		}
	}
	const wordsInserted = Math.max(0, b.length - common);
	const wordsDeleted = Math.max(0, a.length - common);
	const changePercent = clamp(paperEditDistanceRatio(baseline, current) * 100);

	const sectionHeading = /(?:^|\n)\s*(?:#{1,3}\s*|\*\*)([^*\n]{2,80})(?:\*\*)?\s*(?:\n|$)/gi;
	const baseSections = new Set<string>();
	const curSections = new Set<string>();
	let m: RegExpExecArray | null;
	const baseNorm = baseline.replace(/\r/g, "");
	const curNorm = current.replace(/\r/g, "");
	while ((m = sectionHeading.exec(baseNorm))) baseSections.add(m[1]!.trim().toLowerCase());
	sectionHeading.lastIndex = 0;
	while ((m = sectionHeading.exec(curNorm))) curSections.add(m[1]!.trim().toLowerCase());

	let sectionsTouched = 0;
	const all = new Set([...baseSections, ...curSections]);
	for (const name of all) {
		const inBase = baseNorm.toLowerCase().includes(name);
		const inCur = curNorm.toLowerCase().includes(name);
		if (inBase !== inCur) {
			sectionsTouched += 1;
			continue;
		}
		// Rough: if heading exists in both, compare nearby body slice length
		if (inBase && inCur) {
			const bi = baseNorm.toLowerCase().indexOf(name);
			const ci = curNorm.toLowerCase().indexOf(name);
			const bSlice = baseNorm.slice(bi, bi + 800);
			const cSlice = curNorm.slice(ci, ci + 800);
			if (paperEditDistanceRatio(bSlice, cSlice) > 0.08) sectionsTouched += 1;
		}
	}

	return {
		wordsInserted,
		wordsDeleted,
		wordsUnchanged: common,
		changePercent,
		sectionsTouched,
	};
}

export function analyzePaperArtifacts(content: string): PaperContentArtifacts {
	const charts = (content.match(/```research-chart\b/gi) ?? []).length;
	const images = (content.match(/```research-image\b/gi) ?? []).length;
	const figures =
		(content.match(/```research-figure\b/gi) ?? []).length +
		(content.match(/!\[[^\]]*\]\([^)]+\)/g) ?? []).length +
		(content.match(/\bFigure\s+\d+/gi) ?? []).length;
	const tables =
		(content.match(/^\s*\|.+\|\s*$/gm) ?? []).length > 0
			? Math.max(1, Math.floor((content.match(/^\s*\|.+\|\s*$/gm) ?? []).length / 3))
			: 0;
	const labMentions = (
		content.match(/\b(lab\s*log|laboratory|experiment(?:al)?\s+(?:protocol|procedure|run)|ELN)\b/gi) ??
		[]
	).length;

	return {
		charts,
		images,
		figures: Math.max(figures, images),
		tables,
		labMentions,
	};
}

export function emptyMaterialCounts(): PaperMaterialCounts {
	return {
		notes: 0,
		documents: 0,
		datasets: 0,
		figures: 0,
		labEntries: 0,
		references: 0,
		templates: 0,
		projects: 0,
	};
}

export function mergeMaterialCounts(...parts: PaperMaterialCounts[]): PaperMaterialCounts {
	const out = emptyMaterialCounts();
	for (const p of parts) {
		out.notes += p.notes;
		out.documents += p.documents;
		out.datasets += p.datasets;
		out.figures += p.figures;
		out.labEntries += p.labEntries;
		out.references += p.references;
		out.templates += p.templates;
		out.projects += p.projects;
	}
	return out;
}

export function materialCountsFromSources(sources?: ResearchSourceSelection | null): PaperMaterialCounts {
	const counts = emptyMaterialCounts();
	if (!sources) return counts;
	counts.documents = sources.documentIds?.length ?? 0;
	counts.datasets = (sources.datasetIds?.length ?? 0) + (sources.questionnaireIds?.length ?? 0);
	counts.notes += sources.noteIds?.length ?? 0;
	counts.projects = sources.projectIds?.length ?? 0;
	return counts;
}

export function bandForScore(score: number): EffortBand {
	if (score < 20) return "none";
	if (score < 40) return "low";
	if (score < 60) return "moderate";
	if (score < 80) return "high";
	return "very_high";
}

export function bandLabel(band: EffortBand): string {
	switch (band) {
		case "none":
			return "No recorded effort";
		case "low":
			return "Low";
		case "moderate":
			return "Moderate";
		case "high":
			return "High";
		case "very_high":
			return "Very high";
	}
}

/** One recorded capture item is worth 5%. Original writing is 1% per 100 words, rounding any remainder up so short inserts still score. */
export const CAPTURE_SCORE_PER_ITEM = 5;

export function scoreWritingWords(writingWords: number): number {
	const words = Math.max(0, writingWords);
	if (words <= 0) return 0;
	return clamp(Math.ceil(words / 100));
}

export function scoreOfficialUserEffort(input: {
	captureItems: number;
	writingWords: number;
}): { captureScore: number; writingScore: number; userEffortScore: number } {
	const captureScore = clamp(Math.max(0, input.captureItems) * CAPTURE_SCORE_PER_ITEM);
	const writingScore = scoreWritingWords(input.writingWords);
	return {
		captureScore,
		writingScore,
		userEffortScore: clamp(captureScore + writingScore),
	};
}

function labRecordCounts(row: { detail?: string } | unknown): boolean {
	if (!row || typeof row !== "object") return false;
	const detail = "detail" in row && typeof row.detail === "string" ? row.detail : "";
	if (!detail) return true;
	if (detail === "Empty") return false;
	return !/\b0 words\b/.test(detail);
}

export function tallyOfficialPaperEffort(input: {
	evidence?: {
		pages?: { detail: string }[];
		files?: unknown[];
		surveys?: unknown[];
		datasets?: unknown[];
		pictures?: unknown[];
		lab?: unknown[];
	} | null;
	materials?: PaperMaterialCounts | null;
	sources?: ResearchSourceSelection | null;
	wordsInserted?: number;
}): {
	pages: number;
	files: number;
	surveys: number;
	datasets: number;
	pictures: number;
	lab: number;
	captureItems: number;
	captureScore: number;
	writingWords: number;
	writingScore: number;
	userEffortScore: number;
} {
	const evidence = input.evidence;
	const materials = input.materials ?? emptyMaterialCounts();
	const sources = input.sources;
	const pages = (evidence?.pages ?? []).filter((row) => row.detail !== "Empty").length;
	const files = Math.max(evidence?.files?.length ?? 0, materials.documents);
	const pictures = Math.max(evidence?.pictures?.length ?? 0, materials.figures);
	const sourceDocUploads = sources?.documentIds?.length ?? 0;
	const extraDocs = Math.max(0, sourceDocUploads - (files + pictures));
	const surveys = Math.max(
		evidence?.surveys?.length ?? 0,
		sources?.questionnaireIds?.length ?? 0,
	);
	const datasets = Math.max(evidence?.datasets?.length ?? 0, sources?.datasetIds?.length ?? 0);
	const lab = Math.max(
		(evidence?.lab ?? []).filter(labRecordCounts).length,
		materials.labEntries,
	);
	const captureItems = pages + files + extraDocs + surveys + datasets + pictures + lab;
	// Manuscript edits after generation only. Notebook prose is already counted as capture items.
	const writingWords = Math.max(0, input.wordsInserted ?? 0);
	const scored = scoreOfficialUserEffort({ captureItems, writingWords });
	return {
		pages,
		files,
		surveys,
		datasets,
		pictures,
		lab,
		captureItems,
		writingWords,
		...scored,
	};
}

function scoreArtifacts(artifacts: PaperContentArtifacts): number {
	const raw =
		Math.min(35, artifacts.charts * 12) +
		Math.min(25, artifacts.figures * 8) +
		Math.min(20, artifacts.tables * 6) +
		Math.min(20, artifacts.labMentions * 4);
	return clamp(raw);
}

/**
 * Score user contribution on a Research Assistant paper.
 * Overall = official capture (5% per item) + writing (1% per 100 manuscript words inserted).
 */
export function computePaperEffort(input: {
	content: string;
	aiBaselineContent?: string | null;
	humanEdited?: boolean;
	topic?: string;
	materials?: PaperMaterialCounts | null;
	sources?: ResearchSourceSelection | null;
	evidence?: {
		pages?: { detail: string }[];
		files?: unknown[];
		surveys?: unknown[];
		datasets?: unknown[];
		pictures?: unknown[];
		lab?: unknown[];
		writingWords?: number;
	} | null;
}): PaperEffortSnapshot {
	const content = input.content.trim();
	const baseline = (input.aiBaselineContent?.trim() || content).trim();
	const words = tokenize(content);
	const baselineWords = tokenize(baseline);
	const materials = input.materials ?? emptyMaterialCounts();
	const artifacts = analyzePaperArtifacts(content);
	const edits = computeEditStats(baseline, content);
	const empty = words.length === 0;
	const artifactScore = scoreArtifacts(artifacts);

	const official = tallyOfficialPaperEffort({
		evidence: input.evidence,
		materials,
		sources: input.sources,
		wordsInserted: edits.wordsInserted,
	});
	const captureScore = official.captureScore;
	const writingScore = official.writingScore;
	const userEffortScore = official.userEffortScore;
	const userBand = bandForScore(userEffortScore);
	const aiShareScore = clamp(100 - writingScore);

	if (empty) {
		return {
			userEffortScore,
			aiShareScore: 0,
			captureScore,
			writingScore,
			artifactScore: 0,
			userBand,
			wordCount: 0,
			baselineWordCount: 0,
			humanEdited: Boolean(input.humanEdited),
			hasBaseline: Boolean(input.aiBaselineContent?.trim()),
			empty: true,
			materials,
			artifacts,
			edits,
			summaryLines: [
				`Overall score of user’s input: ${userEffortScore}/100.`,
				`Capture ${captureScore}/100 (${official.captureItems} item(s) × 5%) · Writing ${writingScore}/100.`,
				captureScore > 0
					? "Uploaded materials are counted toward capture effort."
					: "Upload Materials, Data, Figures, or Lab Log (or insert original text) to raise your score.",
			],
		};
	}

	const ratio = paperEditDistanceRatio(baseline, content);
	const edited =
		Boolean(input.humanEdited) ||
		(Boolean(input.aiBaselineContent?.trim()) && ratio > 0.02) ||
		edits.wordsInserted + edits.wordsDeleted > 0;

	const summaryLines: string[] = [
		`Overall score of user’s input: ${userEffortScore}/100 (${bandLabel(userBand)}).`,
		`Capture ${captureScore}/100 (${official.captureItems} item(s) × 5%) · Writing ${writingScore}/100 (1% per 100 inserted words; remainder counts). Overall is capture plus writing.`,
		`AI text share (writing): ${aiShareScore}/100 · Paper length: ${words.length} words.`,
	];

	const materialBits = [
		materials.notes ? `${materials.notes} note(s)` : null,
		materials.documents ? `${materials.documents} document(s)` : null,
		materials.datasets ? `${materials.datasets} dataset(s)` : null,
		materials.figures ? `${materials.figures} figure(s)` : null,
		materials.labEntries ? `${materials.labEntries} lab entr(y/ies)` : null,
		materials.references ? `${materials.references} reference(s)` : null,
		materials.projects ? `${materials.projects} research note project(s)` : null,
	].filter(Boolean);
	summaryLines.push(
		materialBits.length
			? `Uploaded / linked materials: ${materialBits.join(", ")}.`
			: "No uploaded Materials, Data, Figures, Lab Log, or documents were linked to this paper.",
	);

	summaryLines.push(
		`Text edits vs AI baseline: +${edits.wordsInserted} words inserted, −${edits.wordsDeleted} deleted (${edits.changePercent}% changed, ${edits.sectionsTouched} section(s) touched).`,
	);

	const artifactBits = [
		artifacts.charts ? `${artifacts.charts} chart(s)` : null,
		artifacts.figures ? `${artifacts.figures} figure(s)/image(s)` : null,
		artifacts.tables ? `${artifacts.tables} table(s)` : null,
		artifacts.labMentions ? `${artifacts.labMentions} lab/experiment mention(s)` : null,
	].filter(Boolean);
	summaryLines.push(
		artifactBits.length
			? `In-paper graphs & labs: ${artifactBits.join(", ")}.`
			: "No charts, figures, tables, or lab mentions detected in the paper body yet.",
	);

	if (writingScore === 0) {
		summaryLines.push(
			"No human edits recorded against the AI baseline yet. Edit the document and save to raise your writing score.",
		);
	}

	return {
		userEffortScore,
		aiShareScore,
		captureScore,
		writingScore,
		artifactScore,
		userBand,
		wordCount: words.length,
		baselineWordCount: baselineWords.length,
		humanEdited: edited,
		hasBaseline: Boolean(input.aiBaselineContent?.trim()),
		empty: false,
		materials,
		artifacts,
		edits,
		summaryLines,
	};
}

export function composePaperEffortMarkdown(input: {
	title: string;
	topic: string;
	effort: PaperEffortSnapshot;
	author?: PaperAuthorProfile | null;
}): string {
	const { effort, author } = input;
	const lines = [
		`# Effort & attribution report`,
		``,
		`## Overall score of user’s input`,
		``,
		`**${effort.userEffortScore} / 100** (${bandLabel(effort.userBand)})`,
		``,
		`Capture ${effort.captureScore}% + writing ${effort.writingScore}% = overall ${effort.userEffortScore}/100.`,
		``,
		`**Paper:** ${input.title}`,
		`**Topic:** ${input.topic || "—"}`,
		`**Generated:** ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`,
		``,
		`## Researcher`,
		``,
		`| Field | Value |`,
		`| --- | --- |`,
		`| Name | ${author?.name?.trim() || "—"} |`,
		`| Email | ${author?.email?.trim() || "—"} |`,
		`| Department | ${author?.department?.trim() || "—"} |`,
		`| Institution | ${author?.institution?.trim() || "—"} |`,
		``,
		`## Summary scores`,
		``,
		`| Metric | Score |`,
		`| --- | --- |`,
		`| Overall score of user’s input | ${effort.userEffortScore}/100 (${bandLabel(effort.userBand)}) |`,
		`| Capture / uploads | ${effort.captureScore}/100 |`,
		`| Writing & edits | ${effort.writingScore}/100 |`,
		`| Graphs & labs in paper | ${effort.artifactScore}/100 |`,
		`| AI text share (writing) | ${effort.aiShareScore}/100 |`,
		`| Word count | ${effort.wordCount} |`,
		``,
		`## Uploaded & linked materials`,
		``,
		`| Material | Count |`,
		`| --- | ---: |`,
		`| Linked projects | ${effort.materials.projects} |`,
		`| Notes / materials pages | ${effort.materials.notes} |`,
		`| Documents | ${effort.materials.documents} |`,
		`| Datasets | ${effort.materials.datasets} |`,
		`| Figures | ${effort.materials.figures} |`,
		`| Lab Log entries | ${effort.materials.labEntries} |`,
		`| References | ${effort.materials.references} |`,
		`| Templates | ${effort.materials.templates} |`,
		``,
		`## Text edited / inserted`,
		``,
		`| Edit metric | Value |`,
		`| --- | ---: |`,
		`| Words inserted | ${effort.edits.wordsInserted} |`,
		`| Words deleted | ${effort.edits.wordsDeleted} |`,
		`| Words unchanged | ${effort.edits.wordsUnchanged} |`,
		`| Change vs AI baseline | ${effort.edits.changePercent}% |`,
		`| Sections touched | ${effort.edits.sectionsTouched} |`,
		``,
		`## Graphs, figures & lab content in paper`,
		``,
		`| Artifact | Count |`,
		`| --- | ---: |`,
		`| Charts (\`research-chart\`) | ${effort.artifacts.charts} |`,
		`| Figures / images | ${effort.artifacts.figures} |`,
		`| Tables | ${effort.artifacts.tables} |`,
		`| Lab / experiment mentions | ${effort.artifacts.labMentions} |`,
		``,
		`### Findings`,
		``,
		...effort.summaryLines.map((s) => `- ${s}`),
		``,
		`## Scoring notes`,
		``,
		`- **Capture** is 5% for each recorded item: notebook pages, uploaded files, pictures, datasets, surveys, and lab records from the selected notebook and from documents or datasets picked on Research Assistant.`,
		`- **Writing** is 1% for every 100 words inserted in the manuscript after generation. Any remainder under 100 words still counts as 1%.`,
		`- **Overall user effort** = capture + writing, the same figures as the official PDF report.`,
		`- Generated manuscript text and notebook prose already counted as capture items are not added again as writing.`,
		``,
	];
	return lines.join("\n");
}

function downloadBlob(filename: string, content: string, mime: string): void {
	const blob = new Blob([content], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.rel = "noopener";
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

export async function downloadPaperEffortReport(
	input: {
		title: string;
		topic: string;
		effort: PaperEffortSnapshot;
		author?: PaperAuthorProfile | null;
		paperId?: string;
		createdAt?: string;
		sources?: ResearchSourceSelection | null;
		evidence?: import("@/lib/research-paper-effort-evidence").PaperEffortEvidence | null;
	},
	format: ExportFormat = "pdf",
): Promise<void> {
	const base = `${input.title || "Research"}-User-Effort-Score`.replace(/[^\w.-]+/g, "_");
	if (format === "pdf" || format === "docx") {
		const { downloadOfficialEffortPdf, officialReportFromPaper } = await import(
			"@/lib/garil-user-effort-score-docx"
		);
		await downloadOfficialEffortPdf(
			`${base}.pdf`,
			officialReportFromPaper({
				title: input.title,
				topic: input.topic,
				paperId: input.paperId,
				createdAt: input.createdAt,
				effort: input.effort,
				author: input.author,
				sources: input.sources,
				evidence: input.evidence,
			}),
		);
		return;
	}
	const md = composePaperEffortMarkdown(input);
	downloadBlob(`${base}.md`, md, "text/markdown;charset=utf-8");
}
