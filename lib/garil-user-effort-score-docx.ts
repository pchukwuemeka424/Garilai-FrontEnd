import {
	AlignmentType,
	BorderStyle,
	Document,
	Footer,
	Header,
	Packer,
	PageNumber,
	Paragraph,
	ShadingType,
	Table,
	TableCell,
	TableRow,
	TextRun,
	VerticalAlign,
	WidthType,
	type IBorderOptions,
} from "docx";

import type { ResearchSourceSelection } from "@/lib/research-assets-api";
import {
	tallyOfficialPaperEffort,
	type PaperAuthorProfile,
	type PaperEffortSnapshot,
} from "@/lib/research-paper-effort";
import type { PaperEffortEvidence } from "@/lib/research-paper-effort-evidence";

const NAVY = "1B2A41";
const GOLD = "9A6A00";
const GOLD_BG = "FBEFD6";
const TEAL = "1F6F78";
const MUTED = "6B6B6B";
const ROW = "F0F2F4";
const WHITE = "FFFFFF";
const RULE = "D4D9DE";

const thin: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: RULE };
const none: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: WHITE };
const borders = { top: thin, bottom: thin, left: thin, right: thin };
const noBorders = { top: none, bottom: none, left: none, right: none };

export type OfficialEvidenceRow = {
	type: string;
	count: number;
	recorded: string;
};

export type OfficialEffortReportInput = {
	researcherName: string;
	studentStaffId?: string;
	institution: string;
	facultyDepartment: string;
	submissionTitle: string;
	notebookTitle: string;
	sprintLabel?: string;
	compiledAt: Date;
	documentRef: string;
	captureItems: number;
	captureScore: number;
	writingWords: number;
	writingScore: number;
	overallScore: number;
	band: string;
	summaryParagraphs: string[];
	evidenceRows: OfficialEvidenceRow[];
};

function dash(value?: string | null): string {
	const t = value?.trim();
	return t ? t : "—";
}

function namesJoin(names: string[], empty: string): string {
	const clean = names.map((n) => n.trim()).filter(Boolean);
	if (!clean.length) return empty;
	if (clean.length === 1) return clean[0]!;
	if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
	return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}

function compiledLabel(date: Date): string {
	return date.toLocaleString(undefined, {
		day: "numeric",
		month: "long",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function officialBandLabel(score: number, hasEvidence: boolean): string {
	if (!hasEvidence) return "No recorded effort";
	if (score < 40) return "Low";
	if (score < 60) return "Moderate";
	if (score < 80) return "High";
	return "Very high";
}

export function documentReferenceFromId(id: string): string {
	const hex = id.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase() || "00000000";
	return `GARIL-UES-${hex}`;
}

function p(
	text: string,
	opts?: {
		size?: number;
		bold?: boolean;
		color?: string;
		italics?: boolean;
		align?: (typeof AlignmentType)[keyof typeof AlignmentType];
		spaceAfter?: number;
		spaceBefore?: number;
	},
): Paragraph {
	return new Paragraph({
		alignment: opts?.align,
		spacing: { after: opts?.spaceAfter ?? 120, before: opts?.spaceBefore ?? 0, line: 276 },
		children: [
			new TextRun({
				text,
				font: "Calibri",
				size: opts?.size ?? 21,
				bold: opts?.bold,
				italics: opts?.italics,
				color: opts?.color ?? NAVY,
			}),
		],
	});
}

function cell(
	children: Paragraph[],
	opts?: { width?: number; fill?: string; span?: number; borders?: typeof borders },
): TableCell {
	return new TableCell({
		width: opts?.width ? { size: opts.width, type: WidthType.DXA } : undefined,
		columnSpan: opts?.span,
		shading: opts?.fill ? { type: ShadingType.CLEAR, fill: opts.fill } : undefined,
		borders: opts?.borders ?? borders,
		verticalAlign: VerticalAlign.CENTER,
		margins: { top: 60, bottom: 60, left: 80, right: 80 },
		children,
	});
}

function labelValueRow(label: string, value: string, zebra: boolean): TableRow {
	return new TableRow({
		children: [
			cell([p(label, { size: 18, bold: true, color: NAVY, spaceAfter: 0 })], {
				width: 3200,
				fill: zebra ? ROW : WHITE,
			}),
			cell([p(value, { size: 18, color: NAVY, spaceAfter: 0 })], {
				width: 6160,
				fill: zebra ? ROW : WHITE,
			}),
		],
	});
}

function scoreCard(percent: string, title: string, basis: string): TableCell {
	return cell(
		[
			p(percent, { size: 40, bold: true, color: TEAL, spaceAfter: 40, align: AlignmentType.CENTER }),
			p(title, { size: 18, bold: true, color: NAVY, spaceAfter: 40, align: AlignmentType.CENTER }),
			p(basis, { size: 16, color: MUTED, spaceAfter: 0, align: AlignmentType.CENTER }),
		],
		{ width: 3120, fill: ROW },
	);
}

export function buildOfficialEffortDocument(input: OfficialEffortReportInput): Document {
	const compiled = compiledLabel(input.compiledAt);
	const headerBar = new Table({
		width: { size: 9360, type: WidthType.DXA },
		columnWidths: [9360],
		rows: [
			new TableRow({
				children: [
					cell(
						[
							p("GARIL AI  ·  RESEARCH ASSISTANT", {
								size: 16,
								color: GOLD_BG,
								spaceAfter: 80,
							}),
							p("User Effort Score", { size: 40, bold: true, color: WHITE, spaceAfter: 80 }),
							p("Official record of the researcher’s own input into the final research", {
								size: 18,
								color: "E8EEF2",
								spaceAfter: 0,
							}),
						],
						{ fill: NAVY, borders: noBorders, width: 9360 },
					),
				],
			}),
		],
	});

	const goldRule = new Table({
		width: { size: 9360, type: WidthType.DXA },
		columnWidths: [9360],
		rows: [
			new TableRow({
				children: [
					new TableCell({
						width: { size: 9360, type: WidthType.DXA },
						shading: { type: ShadingType.CLEAR, fill: GOLD },
						borders: noBorders,
						children: [new Paragraph({ spacing: { after: 0, before: 0 }, children: [] })],
					}),
				],
			}),
		],
	});

	const details = new Table({
		width: { size: 9360, type: WidthType.DXA },
		columnWidths: [3200, 6160],
		rows: [
			labelValueRow("Researcher", dash(input.researcherName), true),
			labelValueRow("Student / Staff ID", dash(input.studentStaffId), false),
			labelValueRow("Institution", dash(input.institution), true),
			labelValueRow("Faculty / Department", dash(input.facultyDepartment), false),
			labelValueRow("Research submission title", dash(input.submissionTitle), true),
			labelValueRow("Notebook", dash(input.notebookTitle), false),
			labelValueRow("Research sprint", dash(input.sprintLabel), true),
		],
	});

	const scoreCards = new Table({
		width: { size: 9360, type: WidthType.DXA },
		columnWidths: [3120, 3120, 3120],
		rows: [
			new TableRow({
				children: [
					scoreCard(
						`${input.overallScore}%`,
						"Overall user effort score",
						`${input.band} band`,
					),
					scoreCard(
						`${input.captureScore}%`,
						"Capture",
						`${input.captureItems} item${input.captureItems === 1 ? "" : "s"} × 5%`,
					),
					scoreCard(
						`${input.writingScore}%`,
						"Writing",
						`${input.writingWords.toLocaleString()} words · 1% per 100 (remainder counts)`,
					),
				],
			}),
		],
	});

	const breakdownHeader = (text: string) =>
		cell([p(text, { size: 17, bold: true, color: WHITE, spaceAfter: 0 })], { fill: NAVY });

	const breakdown = new Table({
		width: { size: 9360, type: WidthType.DXA },
		columnWidths: [2800, 4360, 2200],
		rows: [
			new TableRow({
				children: [breakdownHeader("Component"), breakdownHeader("Basis"), breakdownHeader("Contribution")],
			}),
			new TableRow({
				children: [
					cell([p("Capture", { size: 18, spaceAfter: 0 })]),
					cell([
						p(`${input.captureItems} recorded item${input.captureItems === 1 ? "" : "s"} at 5% each`, {
							size: 18,
							spaceAfter: 0,
						}),
					]),
					cell([p(`${input.captureScore}%`, { size: 18, bold: true, spaceAfter: 0 })]),
				],
			}),
			new TableRow({
				children: [
					cell([p("Writing", { size: 18, spaceAfter: 0 })], { fill: ROW }),
					cell(
						[
							p(`${input.writingWords.toLocaleString()} words inserted, 1% per 100 words (any remainder still counts as 1%)`, {
								size: 18,
								spaceAfter: 0,
							}),
						],
						{ fill: ROW },
					),
					cell([p(`${input.writingScore}%`, { size: 18, bold: true, spaceAfter: 0 })], { fill: ROW }),
				],
			}),
			new TableRow({
				children: [
					cell([p("Overall user effort score", { size: 18, bold: true, spaceAfter: 0 })], { fill: GOLD_BG }),
					cell([p("Capture plus writing", { size: 18, spaceAfter: 0 })], { fill: GOLD_BG }),
					cell(
						[p(`${input.overallScore}% (${input.band})`, { size: 18, bold: true, color: GOLD, spaceAfter: 0 })],
						{ fill: GOLD_BG },
					),
				],
			}),
		],
	});

	const evidenceHeader = (text: string) =>
		cell([p(text, { size: 17, bold: true, color: WHITE, spaceAfter: 0 })], { fill: NAVY });

	const evidenceRows = input.evidenceRows.map(
		(row, i) =>
			new TableRow({
				children: [
					cell([p(row.type, { size: 18, spaceAfter: 0 })], { fill: i % 2 ? ROW : WHITE }),
					cell([p(String(row.count), { size: 18, spaceAfter: 0 })], { fill: i % 2 ? ROW : WHITE }),
					cell([p(row.recorded || "—", { size: 18, spaceAfter: 0 })], { fill: i % 2 ? ROW : WHITE }),
				],
			}),
	);

	const evidence = new Table({
		width: { size: 9360, type: WidthType.DXA },
		columnWidths: [2800, 1400, 5160],
		rows: [
			new TableRow({
				children: [
					evidenceHeader("Evidence type"),
					evidenceHeader("Count"),
					evidenceHeader("Recorded items"),
				],
			}),
			...evidenceRows,
		],
	});

	return new Document({
		sections: [
			{
				properties: {
					page: {
						size: { width: 11906, height: 16838 },
						margin: { top: 720, bottom: 860, left: 864, right: 864 },
					},
				},
				headers: {
					default: new Header({
						children: [
							p("GARIL AI  ·  Official User Effort Score", {
								size: 14,
								color: MUTED,
								spaceAfter: 0,
							}),
						],
					}),
				},
				footers: {
					default: new Footer({
						children: [
							new Paragraph({
								spacing: { after: 0 },
								children: [
									new TextRun({
										text: "GARIL AI  ·  Research Assistant  ·  Official effort record  ·  Confidential    ",
										font: "Calibri",
										size: 14,
										color: MUTED,
									}),
									new TextRun({
										children: [PageNumber.CURRENT],
										font: "Calibri",
										size: 14,
										color: MUTED,
									}),
								],
							}),
						],
					}),
				},
				children: [
					headerBar,
					goldRule,
					p(`Compiled ${compiled}        Classification: official · submit with the research`, {
						size: 16,
						color: MUTED,
						spaceBefore: 200,
						spaceAfter: 240,
					}),
					p("Submission details", { size: 24, bold: true, color: NAVY, spaceAfter: 160 }),
					details,
					p("User effort score", { size: 24, bold: true, color: NAVY, spaceBefore: 360, spaceAfter: 160 }),
					scoreCards,
					p(
						"How the score is calculated: 5% for each captured item of evidence, plus 1% for every 100 words of original text inserted. Fewer than 100 words still counts as 1%. The institution sets the banding and the pass threshold.",
						{ size: 16, italics: true, color: MUTED, spaceBefore: 160, spaceAfter: 280 },
					),
					p("Summary", { size: 24, bold: true, color: NAVY, spaceAfter: 160 }),
					...input.summaryParagraphs.map((para) => p(para, { size: 20, spaceAfter: 200 })),
					p("Effort breakdown", { size: 24, bold: true, color: NAVY, spaceBefore: 200, spaceAfter: 160 }),
					breakdown,
					p("Evidence register", { size: 24, bold: true, color: NAVY, spaceBefore: 360, spaceAfter: 160 }),
					evidence,
					p("Authenticity and verification", {
						size: 24,
						bold: true,
						color: NAVY,
						spaceBefore: 360,
						spaceAfter: 160,
					}),
					p(`Generated by the GARIL AI Research Assistant on ${compiled}.`, {
						size: 18,
						spaceAfter: 80,
					}),
					p(
						"Based on timestamped inputs captured in the governed workspace, and reconcilable against the live notebook or saved manuscript.",
						{ size: 18, spaceAfter: 80 },
					),
					p(
						"The manuscript was developed with the Research Assistant, which grounds output in the researcher’s documented evidence and in recognised databases such as Google Scholar, arXiv, PubMed, and CORE, and does not permit open-text prompting.",
						{ size: 18, spaceAfter: 80 },
					),
					p(`Document reference: ${input.documentRef}   (verify against the institution’s governance dashboard).`, {
						size: 18,
						spaceAfter: 0,
					}),
				],
			},
		],
	});
}

function recordedOrDash(count: number, detail: string): string {
	if (count <= 0) return "—";
	return detail.trim() || String(count);
}

export function officialReportFromPaper(input: {
	title: string;
	topic: string;
	paperId?: string;
	createdAt?: string;
	effort: PaperEffortSnapshot;
	author?: PaperAuthorProfile | null;
	sources?: ResearchSourceSelection | null;
	evidence?: PaperEffortEvidence | null;
}): OfficialEffortReportInput {
	const effort = input.effort;
	const evidence = input.evidence;
	const official = tallyOfficialPaperEffort({
		evidence,
		materials: effort.materials,
		sources: input.sources,
		wordsInserted: effort.edits.wordsInserted,
	});
	const captureItems = official.captureItems;
	const writingWords = official.writingWords;
	const captureScore = official.captureScore;
	const writingScore = official.writingScore;
	const overallScore = official.userEffortScore;
	const pages = official.pages;
	const files = official.files;
	const surveys = official.surveys;
	const datasets = official.datasets;
	const pictures = official.pictures;
	const lab = official.lab;
	const hasEvidence = captureItems > 0 || writingWords > 0;
	const band = officialBandLabel(overallScore, hasEvidence);
	const notebook = input.topic.trim() || "Research Assistant manuscript";
	const compiledAt = input.createdAt ? new Date(input.createdAt) : new Date();

	const manuscriptInserted = Math.max(0, effort.edits.wordsInserted);
	const writingDetail = manuscriptInserted
		? `${manuscriptInserted.toLocaleString()} inserted in the manuscript after generation`
		: "no original text inserted in the manuscript after generation";

	const summaryParagraphs = [
		`This document reports the User Effort Score for the research submission “${input.title.trim() || "Untitled research"}.” The GARIL AI Research Assistant generates the score from the inputs the researcher captured and the original text they inserted while the manuscript was developed inside the governed workspace. Its purpose is to give the examiner an evidenced view of the extent to which the final research reflects the researcher’s own work.`,
		`On the writing side, the researcher inserted ${writingWords.toLocaleString()} words of original text (${writingDetail}). The current manuscript is ${effort.wordCount.toLocaleString()} words. On the evidence side, the workspace records ${pages} document page${pages === 1 ? "" : "s"}, ${files} uploaded file${files === 1 ? "" : "s"}, ${surveys} survey${surveys === 1 ? "" : "s"}, ${datasets} dataset${datasets === 1 ? "" : "s"}, ${pictures} picture${pictures === 1 ? "" : "s"}, and ${lab} laboratory ${lab === 1 ? "record" : "records"}.`,
		`The Research Assistant builds the manuscript on top of this documented material and does not accept open prompts, so the arguments, findings, and structure stay anchored to evidence the researcher gathered and to sources the institution recognises. The score below measures the researcher’s captured activity within that process. It does not grade academic quality.`,
		`The overall User Effort Score for this submission is ${overallScore} percent, which falls in the ${band} band. This total combines a capture component of ${captureScore} percent (${captureItems} recorded item${captureItems === 1 ? "" : "s"} at 5 percent each) and a writing component of ${writingScore} percent (1 percent for every 100 words inserted, with any remainder still counting as 1 percent). The institution sets the banding and the pass threshold. The figures can be reconciled against the saved manuscript and the evidence register that follows.`,
	];

	return {
		researcherName: dash(input.author?.name),
		studentStaffId: input.author?.email?.trim() || undefined,
		institution: dash(input.author?.institution),
		facultyDepartment: dash(input.author?.department),
		submissionTitle: input.title.trim() || "Untitled research",
		notebookTitle: notebook,
		sprintLabel: compiledAt.toLocaleDateString(undefined, {
			day: "numeric",
			month: "long",
			year: "numeric",
		}),
		compiledAt: new Date(),
		documentRef: documentReferenceFromId(input.paperId || input.title),
		captureItems,
		captureScore,
		writingWords,
		writingScore,
		overallScore,
		band,
		summaryParagraphs,
		evidenceRows: [
			{
				type: "Document pages",
				count: pages,
				recorded: recordedOrDash(
					pages,
					evidence?.pages?.length
						? inventoryDetail(evidence.pages, "—")
						: `${effort.wordCount.toLocaleString()} words`,
				),
			},
			{
				type: "Uploaded files",
				count: files,
				recorded: recordedOrDash(files, inventoryDetail(evidence?.files ?? [], `${files} file(s)`)),
			},
			{
				type: "Surveys",
				count: surveys,
				recorded: recordedOrDash(surveys, inventoryDetail(evidence?.surveys ?? [], `${surveys} survey(s)`)),
			},
			{
				type: "Datasets",
				count: datasets,
				recorded: recordedOrDash(
					datasets,
					inventoryDetail(evidence?.datasets ?? [], `${datasets} dataset(s)`),
				),
			},
			{
				type: "Pictures",
				count: pictures,
				recorded: recordedOrDash(
					pictures,
					inventoryDetail(evidence?.pictures ?? [], `${pictures} picture(s)`),
				),
			},
			{
				type: "Laboratory records",
				count: lab,
				recorded: recordedOrDash(lab, inventoryDetail(evidence?.lab ?? [], `${lab} lab record(s)`)),
			},
		],
	};
}

function inventoryDetail(rows: { name: string; detail: string }[], empty: string): string {
	if (!rows.length) return empty;
	return namesJoin(
		rows.map((r) => (r.detail && r.detail !== "Empty" ? `${r.name} (${r.detail})` : r.name)),
		empty,
	);
}

export function officialReportFromNotebook(input: {
	title: string;
	description?: string;
	notebookId?: string;
	author?: PaperAuthorProfile | null;
	effort: {
		userEffortScore: number;
		captureScore: number;
		writingScore: number;
		userBandLabel: string;
		totalWordsInserted: number;
		wordCount: number;
		labWordCount: number;
		surveyWordCount: number;
		pages: number;
		uploadedFiles: number;
		questionnaires: number;
		datasets: number;
		pictures: number;
		labEntries: number;
		pageInventory: { name: string; detail: string }[];
		fileInventory: { name: string; detail: string }[];
		surveyInventory: { name: string; detail: string }[];
		datasetInventory: { name: string; detail: string }[];
		pictureInventory: { name: string; detail: string }[];
		labInventory: { name: string; detail: string }[];
	};
}): OfficialEffortReportInput {
	const effort = input.effort;
	const notebook = input.title.trim() || "Untitled notebook";
	const summaryParagraphs = [
		`This document reports the User Effort Score for the research submission associated with the notebook “${notebook}.” The GARIL AI Research Assistant generates the score at the close of the research sprint, drawing on the inputs the researcher captured and the writing they inserted while the manuscript was developed inside the governed workspace. Its purpose is to give the examiner an evidenced view of the extent to which the final research reflects the researcher’s own work.`,
		`The researcher inserted ${effort.totalWordsInserted.toLocaleString()} words of original text (${effort.wordCount.toLocaleString()} in document pages, ${effort.labWordCount.toLocaleString()} in laboratory notes, and ${effort.surveyWordCount.toLocaleString()} in survey instruments). Evidence on file comprises ${effort.pages} document page${effort.pages === 1 ? "" : "s"}, ${effort.uploadedFiles} uploaded file${effort.uploadedFiles === 1 ? "" : "s"}, ${effort.questionnaires} survey${effort.questionnaires === 1 ? "" : "s"}, ${effort.datasets} dataset${effort.datasets === 1 ? "" : "s"}, ${effort.pictures} picture${effort.pictures === 1 ? "" : "s"}, and ${effort.labEntries} laboratory ${effort.labEntries === 1 ? "entry" : "entries"}.`,
		`The Research Assistant builds the manuscript on top of this documented material and does not accept open prompts, so the arguments, findings, and structure stay anchored to evidence the researcher gathered and to sources the institution recognises. The score below measures the researcher’s captured activity within that process. It does not grade academic quality.`,
		`The overall User Effort Score for this submission is ${effort.userEffortScore} percent, which falls in the ${effort.userBandLabel} band. This total combines a capture component of ${effort.captureScore} percent and a writing component of ${effort.writingScore} percent. Capture is scored at 5 percent for each recorded item; writing is scored at 1 percent for every 100 words inserted, with any remainder still counting as 1 percent. The institution sets the banding and the pass threshold.`,
	];

	const captureItems = Math.round(effort.captureScore / 3);

	return {
		researcherName: dash(input.author?.name),
		studentStaffId: input.author?.email?.trim() || undefined,
		institution: dash(input.author?.institution),
		facultyDepartment: dash(input.author?.department),
		submissionTitle: notebook,
		notebookTitle: notebook,
		sprintLabel: new Date().toLocaleDateString(undefined, {
			day: "numeric",
			month: "long",
			year: "numeric",
		}),
		compiledAt: new Date(),
		documentRef: documentReferenceFromId(input.notebookId || notebook),
		captureItems,
		captureScore: effort.captureScore,
		writingWords: effort.totalWordsInserted,
		writingScore: effort.writingScore,
		overallScore: effort.userEffortScore,
		band: effort.userBandLabel,
		summaryParagraphs,
		evidenceRows: [
			{
				type: "Document pages",
				count: effort.pages,
				recorded: recordedOrDash(effort.pages, inventoryDetail(effort.pageInventory, "—")),
			},
			{
				type: "Uploaded files",
				count: effort.uploadedFiles,
				recorded: recordedOrDash(effort.uploadedFiles, inventoryDetail(effort.fileInventory, "—")),
			},
			{
				type: "Surveys",
				count: effort.questionnaires,
				recorded: recordedOrDash(effort.questionnaires, inventoryDetail(effort.surveyInventory, "—")),
			},
			{
				type: "Datasets",
				count: effort.datasets,
				recorded: recordedOrDash(effort.datasets, inventoryDetail(effort.datasetInventory, "—")),
			},
			{
				type: "Pictures",
				count: effort.pictures,
				recorded: recordedOrDash(effort.pictures, inventoryDetail(effort.pictureInventory, "—")),
			},
			{
				type: "Laboratory records",
				count: effort.labEntries,
				recorded: recordedOrDash(effort.labEntries, inventoryDetail(effort.labInventory, "—")),
			},
		],
	};
}

export async function downloadOfficialEffortDocx(
	filename: string,
	input: OfficialEffortReportInput,
): Promise<void> {
	const doc = buildOfficialEffortDocument(input);
	const blob = await Packer.toBlob(doc);
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename.endsWith(".docx") ? filename : `${filename}.docx`;
	a.rel = "noopener";
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

const NAVY_RGB: [number, number, number] = [27, 42, 65];
const GOLD_RGB: [number, number, number] = [154, 106, 0];
const GOLD_BG_RGB: [number, number, number] = [251, 239, 214];
const TEAL_RGB: [number, number, number] = [31, 111, 120];
const MUTED_RGB: [number, number, number] = [107, 107, 107];
const ROW_RGB: [number, number, number] = [240, 242, 244];
const RULE_RGB: [number, number, number] = [212, 217, 222];
const SLATE_RGB: [number, number, number] = [51, 65, 85];

function compiledLabelPdf(date: Date): string {
	return date.toLocaleString(undefined, {
		day: "numeric",
		month: "long",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export async function downloadOfficialEffortPdf(
	filename: string,
	input: OfficialEffortReportInput,
): Promise<void> {
	const { jsPDF } = await import("jspdf");
	const doc = new jsPDF({ unit: "pt", format: "a4" });
	const pageWidth = doc.internal.pageSize.getWidth();
	const pageHeight = doc.internal.pageSize.getHeight();
	const margin = 48;
	const maxWidth = pageWidth - margin * 2;
	const footer = 36;
	let y = 0;

	const ensure = (needed: number) => {
		if (y + needed <= pageHeight - footer) return;
		doc.addPage();
		y = margin;
	};

	const wrap = (text: string, width: number, size: number): string[] => {
		doc.setFontSize(size);
		return doc.splitTextToSize(text || " ", width) as string[];
	};

	const paragraph = (
		text: string,
		opts?: { size?: number; bold?: boolean; color?: [number, number, number]; leading?: number; after?: number },
	) => {
		const size = opts?.size ?? 10.5;
		const leading = opts?.leading ?? size + 4;
		doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
		doc.setFontSize(size);
		doc.setTextColor(...(opts?.color ?? SLATE_RGB));
		const lines = wrap(text, maxWidth, size);
		for (const line of lines) {
			ensure(leading + 2);
			doc.text(line, margin, y);
			y += leading;
		}
		y += opts?.after ?? 8;
	};

	const heading = (text: string) => {
		ensure(28);
		y += 10;
		doc.setFont("helvetica", "bold");
		doc.setFontSize(13);
		doc.setTextColor(...NAVY_RGB);
		doc.text(text, margin, y);
		y += 8;
		doc.setDrawColor(...GOLD_RGB);
		doc.setLineWidth(1.2);
		doc.line(margin, y, margin + 72, y);
		y += 12;
	};

	doc.setFillColor(...NAVY_RGB);
	doc.rect(0, 0, pageWidth, 96, "F");
	doc.setFillColor(...GOLD_RGB);
	doc.rect(0, 96, pageWidth, 4, "F");
	doc.setFont("helvetica", "normal");
	doc.setFontSize(8.5);
	doc.setTextColor(232, 238, 242);
	doc.text("GARIL AI  ·  RESEARCH ASSISTANT", margin, 28);
	doc.setFont("helvetica", "bold");
	doc.setFontSize(22);
	doc.setTextColor(255, 255, 255);
	doc.text("User Effort Score", margin, 54);
	doc.setFont("helvetica", "normal");
	doc.setFontSize(10);
	doc.setTextColor(232, 238, 242);
	doc.text("Official record of the researcher’s own input into the final research", margin, 74);
	y = 122;

	doc.setFontSize(8);
	doc.setTextColor(...MUTED_RGB);
	doc.text(`Compiled ${compiledLabelPdf(input.compiledAt)}`, margin, y);
	doc.text("Classification: official · submit with the research", pageWidth - margin, y, { align: "right" });
	y += 22;

	heading("Submission details");
	const details: Array<[string, string]> = [
		["Researcher", input.researcherName],
		["Student / Staff ID", input.studentStaffId?.trim() || "—"],
		["Institution", input.institution],
		["Faculty / Department", input.facultyDepartment],
		["Research submission title", input.submissionTitle],
		["Notebook", input.notebookTitle],
		["Research sprint", input.sprintLabel?.trim() || "—"],
	];
	const labelW = 170;
	const rowH = 20;
	details.forEach((row, i) => {
		ensure(rowH + 2);
		if (i % 2 === 0) {
			doc.setFillColor(...ROW_RGB);
			doc.rect(margin, y - 12, maxWidth, rowH, "F");
		}
		doc.setDrawColor(...RULE_RGB);
		doc.setLineWidth(0.4);
		doc.line(margin, y + 8, margin + maxWidth, y + 8);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(9);
		doc.setTextColor(...NAVY_RGB);
		doc.text(row[0], margin + 8, y);
		doc.setFont("helvetica", "normal");
		const valueLines = wrap(row[1] || "—", maxWidth - labelW - 16, 9);
		doc.text(valueLines[0] || "—", margin + labelW, y);
		y += rowH;
	});
	y += 10;

	heading("User effort score");
	const cardGap = 10;
	const cardW = (maxWidth - cardGap * 2) / 3;
	const cardH = 72;
	ensure(cardH + 24);
	const cards: Array<{ value: string; title: string; basis: string }> = [
		{ value: `${input.overallScore}%`, title: "Overall user effort score", basis: `${input.band} band` },
		{
			value: `${input.captureScore}%`,
			title: "Capture",
			basis: `${input.captureItems} item${input.captureItems === 1 ? "" : "s"} × 5%`,
		},
		{
			value: `${input.writingScore}%`,
			title: "Writing",
			basis: `${input.writingWords.toLocaleString()} words · 1% per 100 (remainder counts)`,
		},
	];
	cards.forEach((card, i) => {
		const x = margin + i * (cardW + cardGap);
		doc.setFillColor(...ROW_RGB);
		doc.roundedRect(x, y, cardW, cardH, 4, 4, "F");
		doc.setFont("helvetica", "bold");
		doc.setFontSize(18);
		doc.setTextColor(...TEAL_RGB);
		doc.text(card.value, x + cardW / 2, y + 26, { align: "center" });
		doc.setFontSize(9);
		doc.setTextColor(...NAVY_RGB);
		doc.text(card.title, x + cardW / 2, y + 44, { align: "center" });
		doc.setFont("helvetica", "normal");
		doc.setFontSize(8);
		doc.setTextColor(...MUTED_RGB);
		doc.text(card.basis, x + cardW / 2, y + 58, { align: "center" });
	});
	y += cardH + 16;
	paragraph(
		"How the score is calculated: 5% for each captured item of evidence, plus 1% for every 100 words of original text inserted. Fewer than 100 words still counts as 1%. The institution sets the banding and the pass threshold.",
		{ size: 8.5, color: MUTED_RGB, after: 6 },
	);

	heading("Summary");
	for (const para of input.summaryParagraphs) {
		paragraph(para, { size: 10, leading: 14, after: 8 });
	}

	heading("Effort breakdown");
	const breakCols = [130, maxWidth - 220, 90];
	const breakRows: Array<[string, string, string, boolean]> = [
		["Component", "Basis", "Contribution", true],
		[
			"Capture",
			`${input.captureItems} recorded item${input.captureItems === 1 ? "" : "s"} at 5% each`,
			`${input.captureScore}%`,
			false,
		],
		[
			"Writing",
			`${input.writingWords.toLocaleString()} words inserted, 1% per 100 words (any remainder still counts as 1%)`,
			`${input.writingScore}%`,
			false,
		],
		["Overall user effort score", "Capture plus writing", `${input.overallScore}% (${input.band})`, false],
	];
	const brH = 22;
	breakRows.forEach((row, i) => {
		ensure(brH + 2);
		if (i === 0) {
			doc.setFillColor(...NAVY_RGB);
			doc.rect(margin, y, maxWidth, brH, "F");
			doc.setTextColor(255, 255, 255);
			doc.setFont("helvetica", "bold");
		} else if (i === breakRows.length - 1) {
			doc.setFillColor(...GOLD_BG_RGB);
			doc.rect(margin, y, maxWidth, brH, "F");
			doc.setTextColor(...GOLD_RGB);
			doc.setFont("helvetica", "bold");
		} else if (i % 2 === 0) {
			doc.setFillColor(...ROW_RGB);
			doc.rect(margin, y, maxWidth, brH, "F");
			doc.setTextColor(...NAVY_RGB);
			doc.setFont("helvetica", "normal");
		} else {
			doc.setTextColor(...NAVY_RGB);
			doc.setFont("helvetica", "normal");
		}
		doc.setFontSize(9);
		let x = margin + 8;
		doc.text(row[0], x, y + 14);
		x += breakCols[0]!;
		doc.text(row[1], x, y + 14);
		x += breakCols[1]!;
		doc.text(row[2], x, y + 14);
		y += brH;
	});
	y += 14;

	heading("Evidence register");
	const evH = 22;
	const evHeader = ["Evidence type", "Count", "Recorded items"];
	ensure(evH * (input.evidenceRows.length + 1) + 8);
	doc.setFillColor(...NAVY_RGB);
	doc.rect(margin, y, maxWidth, evH, "F");
	doc.setFont("helvetica", "bold");
	doc.setFontSize(9);
	doc.setTextColor(255, 255, 255);
	doc.text(evHeader[0]!, margin + 8, y + 14);
	doc.text(evHeader[1]!, margin + 150, y + 14);
	doc.text(evHeader[2]!, margin + 210, y + 14);
	y += evH;
	input.evidenceRows.forEach((row, i) => {
		ensure(evH + 2);
		if (i % 2 === 1) {
			doc.setFillColor(...ROW_RGB);
			doc.rect(margin, y, maxWidth, evH, "F");
		}
		doc.setDrawColor(...RULE_RGB);
		doc.setLineWidth(0.4);
		doc.line(margin, y + evH, margin + maxWidth, y + evH);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(9);
		doc.setTextColor(...NAVY_RGB);
		doc.text(row.type, margin + 8, y + 14);
		doc.text(String(row.count), margin + 150, y + 14);
		const rec = wrap(row.recorded || "—", maxWidth - 230, 9);
		doc.text(rec[0] || "—", margin + 210, y + 14);
		y += evH;
	});
	y += 12;

	heading("Authenticity and verification");
	paragraph(`Generated by the GARIL AI Research Assistant on ${compiledLabelPdf(input.compiledAt)}.`, {
		size: 9.5,
		after: 4,
	});
	paragraph(
		"Based on timestamped inputs captured in the governed workspace, and reconcilable against the live notebook or saved manuscript.",
		{ size: 9.5, after: 4 },
	);
	paragraph(
		"The manuscript was developed with the Research Assistant, which grounds output in the researcher’s documented evidence and in recognised databases such as Google Scholar, arXiv, PubMed, and CORE, and does not permit open-text prompting.",
		{ size: 9.5, after: 4 },
	);
	paragraph(
		`Document reference: ${input.documentRef}   (verify against the institution’s governance dashboard).`,
		{ size: 9.5, after: 8 },
	);

	const pages = doc.getNumberOfPages();
	for (let i = 1; i <= pages; i++) {
		doc.setPage(i);
		doc.setFillColor(...NAVY_RGB);
		doc.rect(0, pageHeight - 28, pageWidth, 28, "F");
		doc.setFont("helvetica", "normal");
		doc.setFontSize(8);
		doc.setTextColor(226, 232, 240);
		doc.text("GARIL AI  ·  Research Assistant  ·  Official effort record  ·  Confidential", margin, pageHeight - 12);
		doc.text(`Page ${i} of ${pages}`, pageWidth - margin, pageHeight - 12, { align: "right" });
	}

	const name = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
	doc.save(name);
}
