import { bandForScore, scoreOfficialUserEffort, tokenize, type EffortBand } from "@/lib/research-paper-effort";
import { isImageDocument, type ResearchNotebookData } from "@/lib/research-notebook";
import type { ResearchQuestionnaire } from "@/lib/research-questionnaire";
import type { ResearchDataset, ResearchDocument } from "@/lib/research-assets-api";

export type NotebookNamedCount = {
	name: string;
	detail: string;
	words?: number;
	body?: string;
};

export type NotebookEffortSnapshot = {
	userEffortScore: number;
	captureScore: number;
	writingScore: number;
	artifactScore: number;
	userBand: EffortBand;
	userBandLabel: string;
	wordCount: number;
	labWordCount: number;
	surveyWordCount: number;
	totalWordsInserted: number;
	pages: number;
	questionnaires: number;
	datasets: number;
	pictures: number;
	uploadedFiles: number;
	labEntries: number;
	captureLine: string;
	pageInventory: NotebookNamedCount[];
	fileInventory: NotebookNamedCount[];
	pictureInventory: NotebookNamedCount[];
	datasetInventory: NotebookNamedCount[];
	surveyInventory: NotebookNamedCount[];
	labInventory: NotebookNamedCount[];
};

export function htmlToPlainText(html: string): string {
	return html
		.replace(/<\s*br\s*\/?>/gi, "\n")
		.replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&quot;/gi, '"')
		.replace(/\u00a0/g, " ")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.replace(/[ \t]{2,}/g, " ")
		.trim();
}

function wordsIn(text: string): number {
	return tokenize(text).length;
}

/** Shared formula: 5% per captured item + 1% per 100 inserted words. */
export function scoreNotebookEffortCore(input: {
	pageHtmls: string[];
	labBodies: string[];
	surveyTexts: string[];
	fileCount: number;
	surveyCount: number;
	datasetCount: number;
	pictureCount: number;
}): { captureScore: number; writingScore: number; userEffortScore: number; wordCount: number } {
	const pageWords = input.pageHtmls.map((html) => wordsIn(htmlToPlainText(html)));
	const labWords = input.labBodies.map((body) => wordsIn(body));
	const surveyWords = input.surveyTexts.map((text) => wordsIn(text));
	const wordCount = pageWords.reduce((sum, n) => sum + n, 0);
	const labWordCount = labWords.reduce((sum, n) => sum + n, 0);
	const surveyWordCount = surveyWords.reduce((sum, n) => sum + n, 0);
	const totalWords = wordCount + labWordCount + surveyWordCount;
	const pageCount = pageWords.filter((n) => n > 0).length;
	const labCount = labWords.filter((n) => n > 0).length;
	const captureItems =
		pageCount + input.fileCount + input.surveyCount + input.datasetCount + input.pictureCount + labCount;
	const scored = scoreOfficialUserEffort({ captureItems, writingWords: totalWords });
	return {
		captureScore: scored.captureScore,
		writingScore: scored.writingScore,
		userEffortScore: scored.userEffortScore,
		wordCount: totalWords,
	};
}

function notebookBandLabel(score: number, hasEvidence: boolean): string {
	if (!hasEvidence) return "No recorded effort";
	if (score < 40) return "Low";
	if (score < 60) return "Moderate";
	if (score < 80) return "High";
	return "Very high";
}

export function computeNotebookEffort(input: {
	notebook: ResearchNotebookData;
	questionnaires: ResearchQuestionnaire[];
	datasets: ResearchDataset[];
	documents: ResearchDocument[];
}): NotebookEffortSnapshot {
	const pages = input.notebook.pages;
	const labEntries = input.notebook.labEntries;
	const pictures = input.documents.filter((d) => isImageDocument(d.fileMime));
	const files = input.documents.filter((d) => !isImageDocument(d.fileMime));

	const pageInventory: NotebookNamedCount[] = pages.map((p) => {
		const body = htmlToPlainText(p.html);
		const words = wordsIn(body);
		return {
			name: p.title.trim() || "Untitled page",
			detail: words ? `${words.toLocaleString()} words` : "Empty",
			words,
			body,
		};
	});
	const wordCount = pageInventory.reduce((sum, p) => sum + (p.words ?? 0), 0);

	const labInventory: NotebookNamedCount[] = labEntries.map((e) => {
		const body = e.body.trim();
		const words = wordsIn(body);
		return {
			name: e.title.trim() || "Lab entry",
			detail: `${new Date(e.at).toISOString().slice(0, 10)} · ${words.toLocaleString()} words · ${e.imageDocumentIds.length} attached image${e.imageDocumentIds.length === 1 ? "" : "s"}`,
			words,
			body,
		};
	});
	const labWordCount = labInventory.reduce((sum, e) => sum + (e.words ?? 0), 0);

	const surveyInventory: NotebookNamedCount[] = input.questionnaires.map((q) => {
		const itemLines = q.items
			.map((item, i) => `${i + 1}. ${item.prompt.trim() || "(untitled item)"} [${item.kind}]`)
			.join("\n");
		const body = [
			q.description.trim() && `Description: ${q.description.trim()}`,
			q.population.trim() && `Population: ${q.population.trim()}`,
			q.distributionNote.trim() && `Distribution: ${q.distributionNote.trim()}`,
			itemLines && `Items:\n${itemLines}`,
		]
			.filter(Boolean)
			.join("\n");
		const words = wordsIn(`${q.description} ${q.population} ${q.distributionNote} ${q.items.map((item) => item.prompt).join(" ")}`);
		return {
			name: q.title.trim() || "Untitled survey",
			detail: `${q.items.length} item${q.items.length === 1 ? "" : "s"} · sample ${q.sampleSize || 0} · ${q.rowCount} response row${q.rowCount === 1 ? "" : "s"}${q.importedFileName ? ` · ${q.importedFileName}` : ""}`,
			words,
			body,
		};
	});
	const surveyWordCount = surveyInventory.reduce((sum, q) => sum + (q.words ?? 0), 0);

	const totalWordsInserted = wordCount + labWordCount + surveyWordCount;

	const pictureInventory: NotebookNamedCount[] = pictures.map((d) => ({
		name: d.title || d.fileName,
		detail: [d.fileName, d.fileMime, d.sizeLabel].filter(Boolean).join(" · "),
	}));
	const fileInventory: NotebookNamedCount[] = files.map((d) => ({
		name: d.title || d.fileName,
		detail: [d.fileName, d.kind, d.sizeLabel].filter(Boolean).join(" · "),
	}));
	const datasetInventory: NotebookNamedCount[] = input.datasets.map((d) => ({
		name: d.title || d.fileName || "Untitled dataset",
		detail: [d.fileName || "no file", d.format || d.discipline, d.sizeLabel].filter(Boolean).join(" · "),
	}));

	const pageCount = pageInventory.filter((p) => (p.words ?? 0) > 0).length;
	const surveyCount = input.questionnaires.length;
	const datasetCount = input.datasets.length;
	const pictureCount = pictures.length;
	const labCount = labInventory.filter((e) => (e.words ?? 0) > 0).length;
	const fileCount = files.length;

	const scored = scoreNotebookEffortCore({
		pageHtmls: pages.map((p) => p.html),
		labBodies: labEntries.map((e) => e.body),
		surveyTexts: input.questionnaires.map(
			(q) => `${q.description} ${q.population} ${q.distributionNote} ${q.items.map((item) => item.prompt).join(" ")}`,
		),
		fileCount,
		surveyCount,
		datasetCount,
		pictureCount,
	});
	const captureItems = pageCount + fileCount + surveyCount + datasetCount + pictureCount + labCount;
	const captureScore = scored.captureScore;
	const writingScore = scored.writingScore;
	const artifactScore = 0;
	const hasEvidence = captureItems + totalWordsInserted > 0;
	const userEffortScore = scored.userEffortScore;
	const userBand = hasEvidence ? bandForScore(userEffortScore) : "none";

	const captureLine = [
		`${pageCount} page${pageCount === 1 ? "" : "s"}`,
		`${fileCount} file${fileCount === 1 ? "" : "s"}`,
		`${surveyCount} survey${surveyCount === 1 ? "" : "s"}`,
		`${datasetCount} dataset${datasetCount === 1 ? "" : "s"}`,
		`${pictureCount} picture${pictureCount === 1 ? "" : "s"}`,
		`${labCount} lab ${labCount === 1 ? "entry" : "entries"}`,
	].join(" · ");

	return {
		userEffortScore,
		captureScore,
		writingScore,
		artifactScore,
		userBand,
		userBandLabel: notebookBandLabel(userEffortScore, hasEvidence),
		wordCount,
		labWordCount,
		surveyWordCount,
		totalWordsInserted,
		pages: pageCount,
		questionnaires: surveyCount,
		datasets: datasetCount,
		pictures: pictureCount,
		uploadedFiles: fileCount,
		labEntries: labCount,
		captureLine,
		pageInventory,
		fileInventory,
		pictureInventory,
		datasetInventory,
		surveyInventory,
		labInventory,
	};
}

function namesList(rows: NotebookNamedCount[], fallback: string): string {
	if (!rows.length) return fallback;
	const names = rows.map((r) => r.name).filter(Boolean);
	if (names.length === 1) return names[0]!;
	if (names.length === 2) return `${names[0]} and ${names[1]}`;
	return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function composeNotebookEffortSummary(title: string, effort: NotebookEffortSnapshot): string {
	const notebook = title.trim() || "Untitled notebook";
	const missing: string[] = [];
	if (!effort.pages) missing.push("document text");
	if (!effort.uploadedFiles) missing.push("uploaded files");
	if (!effort.datasets) missing.push("datasets");
	if (!effort.pictures) missing.push("pictures");
	if (!effort.questionnaires) missing.push("surveys");
	if (!effort.labEntries) missing.push("laboratory records");

	const p1 = `This report presents a professional record of research effort captured in the notebook “${notebook}”. The researcher inserted ${effort.totalWordsInserted.toLocaleString()} words in total, of which ${effort.wordCount.toLocaleString()} appear in the document, ${effort.labWordCount.toLocaleString()} in laboratory notes, and ${effort.surveyWordCount.toLocaleString()} in survey instruments. Evidence on file comprises ${effort.pages} document page${effort.pages === 1 ? "" : "s"}, ${effort.uploadedFiles} uploaded file${effort.uploadedFiles === 1 ? "" : "s"}, ${effort.questionnaires} survey${effort.questionnaires === 1 ? "" : "s"}, ${effort.datasets} dataset${effort.datasets === 1 ? "" : "s"}, ${effort.pictures} picture${effort.pictures === 1 ? "" : "s"}, and ${effort.labEntries} laboratory ${effort.labEntries === 1 ? "entry" : "entries"}.`;

	const p2 = `Overall effort is ${effort.userEffortScore} percent (${effort.userBandLabel}). Capture accounts for ${effort.captureScore} percent, at 5 percent for each recorded item (page, file, survey, dataset, picture, or laboratory entry). Writing accounts for ${effort.writingScore} percent, at 1 percent for every 100 words inserted (any remainder still counts as 1 percent).`;

	const docNames = namesList(
		effort.pageInventory.filter((p) => (p.words ?? 0) > 0),
		"no titled pages with text",
	);
	const p3 = `Documentary inserts are recorded under ${docNames}. ${
		effort.questionnaires
			? `Survey instruments include ${namesList(effort.surveyInventory, "untitled surveys")}. `
			: ""
	}${
		effort.datasets ? `Datasets on file include ${namesList(effort.datasetInventory, "untitled datasets")}. ` : ""
	}${
		effort.pictures ? `Pictures on file include ${namesList(effort.pictureInventory, "untitled images")}. ` : ""
	}${
		effort.labEntries ? `Laboratory records include ${namesList(effort.labInventory, "untitled lab entries")}. ` : ""
	}${
		missing.length
			? `No evidence has yet been recorded for ${missing.join(", ")}.`
			: "All principal notebook surfaces contain recorded evidence."
	}`;

	const p4 =
		"The register below lists every captured item. The appendix reproduces the full text inserted in the document so that the record may be reviewed independently of the live notebook.";

	return [p1, p2, p3, p4].join("\n\n");
}

export async function downloadNotebookEffortReport(input: {
	title: string;
	description?: string;
	notebookId?: string;
	author?: import("@/lib/research-paper-effort").PaperAuthorProfile | null;
	effort: NotebookEffortSnapshot;
}): Promise<void> {
	const { downloadOfficialEffortPdf, officialReportFromNotebook } = await import(
		"@/lib/garil-user-effort-score-docx"
	);
	const base = `${input.title || "Notebook"}-User-Effort-Score`.replace(/[^\w.-]+/g, "_");
	await downloadOfficialEffortPdf(
		`${base}.pdf`,
		officialReportFromNotebook({
			title: input.title,
			description: input.description,
			notebookId: input.notebookId,
			author: input.author,
			effort: input.effort,
		}),
	);
}

