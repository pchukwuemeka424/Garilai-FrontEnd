import { exportDraft, type ExportFormat } from "@/components/research-note/features/export/exporters";
import type { ResearchSourceSelection } from "@/lib/research-assets-api";

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
	/** Research Note projects linked at generation time. */
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

function tokenize(text: string): string[] {
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

/** Extract capture counts from a Research Note ProjectState-like notebook JSON. */
export function materialCountsFromNotebook(notebookData: unknown): PaperMaterialCounts {
	const counts = emptyMaterialCounts();
	if (!notebookData || typeof notebookData !== "object") return counts;
	const n = notebookData as {
		pages?: unknown[];
		datasets?: unknown[];
		assets?: unknown[];
		labEntries?: unknown[];
		references?: unknown[];
		templates?: unknown[];
	};
	counts.notes = Array.isArray(n.pages) ? n.pages.length : 0;
	counts.datasets = Array.isArray(n.datasets) ? n.datasets.length : 0;
	counts.figures = Array.isArray(n.assets) ? n.assets.length : 0;
	counts.labEntries = Array.isArray(n.labEntries) ? n.labEntries.length : 0;
	counts.references = Array.isArray(n.references) ? n.references.length : 0;
	counts.templates = Array.isArray(n.templates) ? n.templates.length : 0;
	counts.projects = 1;
	return counts;
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
	counts.datasets = sources.datasetIds?.length ?? 0;
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

function scoreCapture(materials: PaperMaterialCounts): number {
	const raw =
		(materials.notes > 0 ? 18 : 0) +
		(materials.documents > 0 ? 12 : 0) +
		(materials.datasets > 0 ? 16 : 0) +
		(materials.figures > 0 ? 14 : 0) +
		(materials.labEntries > 0 ? 16 : 0) +
		(materials.references > 0 ? 10 : 0) +
		(materials.projects > 0 ? 8 : 0) +
		Math.min(6, materials.notes + materials.documents);
	return clamp(raw);
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
 * Combines capture (uploads / research note), writing edits, and in-paper graphs/labs.
 */
export function computePaperEffort(input: {
	content: string;
	aiBaselineContent?: string | null;
	humanEdited?: boolean;
	topic?: string;
	materials?: PaperMaterialCounts | null;
}): PaperEffortSnapshot {
	const content = input.content.trim();
	const baseline = (input.aiBaselineContent ?? content).trim();
	const words = tokenize(content);
	const baselineWords = tokenize(baseline);
	const materials = input.materials ?? emptyMaterialCounts();
	const artifacts = analyzePaperArtifacts(content);
	const edits = computeEditStats(baseline, content);
	const empty = words.length === 0;

	const captureScore = scoreCapture(materials);
	const artifactScore = scoreArtifacts(artifacts);

	if (empty) {
		const emptyScore = clamp(20 + captureScore * 0.5 * 0.8);
		return {
			userEffortScore: emptyScore,
			aiShareScore: 0,
			captureScore,
			writingScore: 0,
			artifactScore: 0,
			userBand: bandForScore(emptyScore),
			wordCount: 0,
			baselineWordCount: 0,
			humanEdited: Boolean(input.humanEdited),
			hasBaseline: Boolean(input.aiBaselineContent?.trim()),
			empty: true,
			materials,
			artifacts,
			edits,
			summaryLines: [
				`Overall score of user’s input: ${emptyScore}/100 (starts at 20).`,
				"No paper text yet.",
				captureScore > 0
					? "Uploaded materials are counted toward capture effort."
					: "Upload Materials, Data, Figures, or Lab Log (or edit the paper) to raise your score.",
			],
		};
	}

	const ratio = paperEditDistanceRatio(baseline, content);
	const edited =
		Boolean(input.humanEdited) ||
		(Boolean(input.aiBaselineContent?.trim()) && ratio > 0.02) ||
		edits.wordsInserted + edits.wordsDeleted > 0;

	let writingScore = 0;
	if (!input.aiBaselineContent?.trim() && !edited) {
		writingScore = 0;
	} else if (!edited && ratio < 0.02) {
		writingScore = 0;
	} else {
		writingScore = clamp(ratio * 100 * 1.15);
		if (edited && writingScore < 8) writingScore = 8;
		// Bonus for substantial inserts
		if (edits.wordsInserted >= 80) writingScore = clamp(writingScore + 8);
		if (edits.sectionsTouched >= 2) writingScore = clamp(writingScore + 5);
	}

	// Overall: baseline 20 + 80% × (capture 30% + writing 50% + artifacts 20%)
	const blended = captureScore * 0.3 + writingScore * 0.5 + artifactScore * 0.2
	const userEffortScore = clamp(20 + blended * 0.8);
	const aiShareScore = clamp(100 - writingScore);
	const userBand = bandForScore(userEffortScore);

	const summaryLines: string[] = [
		`Overall score of user’s input: ${userEffortScore}/100 (${bandLabel(userBand)}).`,
		`Capture ${captureScore}/100 · Writing/edits ${writingScore}/100 · Graphs & labs in paper ${artifactScore}/100.`,
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
		`Starts at **20 / 100**, then adds from: 30% capture/uploads · 50% writing/edits · 20% graphs & labs.`,
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
		`| Research Note projects | ${effort.materials.projects} |`,
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
		`- **Capture** counts uploaded/linked Materials, documents, datasets, figures, Lab Log, and Research Note projects.`,
		`- **Writing & edits** compares the current paper to the AI baseline (words inserted/deleted and sections changed).`,
		`- **Graphs & labs** credits charts, figures, tables, and lab/experiment language present in the paper.`,
		`- **Overall user effort** = 20 baseline + 80% × (30% capture + 50% writing + 20% graphs/labs).`,
		`- This report is always available, even when you have not edited or uploaded yet (starts at 20).`,
		``,
	];
	return lines.join("\n");
}

export async function downloadPaperEffortReport(
	input: {
		title: string;
		topic: string;
		effort: PaperEffortSnapshot;
		author?: PaperAuthorProfile | null;
	},
	format: ExportFormat = "pdf",
): Promise<void> {
	const md = composePaperEffortMarkdown(input);
	const base = `${input.title || "Research"}-Effort-Report`;
	await exportDraft(format, base, md);
}
