"use client";

import { marked, type Token, type Tokens } from "marked";

import { extractPaperTitle } from "@/lib/research-paper-title";
import {
	canonicalizeSectionTitle,
	formatKeywordTerms,
	promoteBoldSectionsForDisplay,
} from "@/lib/research-paper-sections";
import {
	formatResearchPaperReferences,
	splitReferenceEntries,
} from "@/lib/research-paper-references";

export type ResearchPaperMeta = {
	author?: string | null;
	department?: string | null;
	affiliation?: string | null;
	fallbackTopic?: string | null;
};

export function researchPaperFilename(title: string, fallback = "research-paper"): string {
	const slug = title
		.toLowerCase()
		.replace(/\*\*/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 60);
	return slug || fallback;
}

/** One PDF font family for the whole document (Times = standard academic serif). */
const FONT = "times";

const UNICODE_SPACES = /[\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000\ufeff]/g;

const PAGE = {
	left: 72,
	right: 72,
	top: 72,
	bottom: 72,
};

const SIZE = {
	body: 11,
	abstract: 10,
	title: 17,
	byline: 11,
	affiliation: 10,
	section: 12,
	subsection: 11,
	footer: 9,
};

const LEADING = {
	body: 1.5,
	title: 1.25,
	section: 1.3,
};

const COLOR = {
	text: [15, 15, 15] as [number, number, number],
	muted: [80, 80, 80] as [number, number, number],
	rule: [180, 180, 180] as [number, number, number],
};

const GENERIC_TITLE_LABELS = new Set(["title", "paper title", "research paper", "research paper title"]);

const SECTION_HEADINGS = new Set([
	"abstract",
	"keywords",
	"study area",
	"introduction",
	"literature review",
	"methodology",
	"results / analysis",
	"results",
	"analysis",
	"discussion",
	"conclusion",
	"references",
]);

/** Nigerian states — strip geographic "X State" from PDF (keep "X State University"). */
const NIGERIA_STATE_NAMES = [
	"Abia",
	"Adamawa",
	"Akwa Ibom",
	"Anambra",
	"Bauchi",
	"Bayelsa",
	"Benue",
	"Borno",
	"Cross River",
	"Delta",
	"Ebonyi",
	"Edo",
	"Ekiti",
	"Enugu",
	"Gombe",
	"Imo",
	"Jigawa",
	"Kaduna",
	"Kano",
	"Katsina",
	"Kebbi",
	"Kogi",
	"Kwara",
	"Lagos",
	"Nasarawa",
	"Niger",
	"Ogun",
	"Ondo",
	"Osun",
	"Oyo",
	"Plateau",
	"Rivers",
	"Sokoto",
	"Taraba",
	"Yobe",
	"Zamfara",
] as const;

const NIGERIA_STATE_PATTERN = new RegExp(
	`\\b(?:${NIGERIA_STATE_NAMES.map((name) => name.replace(/\s+/g, "\\s+")).join("|")})\\s+State\\b(?!\\s+University)`,
	"gi",
);

type PdfChartSpec = {
	type: "bar" | "line" | "area" | "pie" | "scatter";
	title: string;
	caption?: string;
	xKey: string;
	yKeys: string[];
	data: Array<Record<string, string | number>>;
};

type PdfBlock =
	| {
			kind: "title" | "section" | "subsection" | "body" | "byline" | "affiliation" | "reference";
			text: string;
	  }
	| { kind: "keywords"; text: string }
	| { kind: "studyArea"; text: string }
	| { kind: "abstractBody"; text: string }
	| { kind: "rule" | "gap" }
	| { kind: "table"; headers: string[]; rows: string[][] }
	| { kind: "chart"; chart: PdfChartSpec }
	| { kind: "image"; title: string; caption: string; nodes: string[]; edges: string[] }
	| { kind: "figure"; title: string; caption: string; mime: string; dataUrl: string };

type FontFace = "normal" | "bold" | "italic" | "bolditalic";

type JsPdfDoc = {
	setFont: (face: string, style: FontFace) => void;
	setFontSize: (size: number) => void;
	getTextWidth: (text: string) => number;
	text: (
		text: string,
		x: number,
		y: number,
		options?: { maxWidth?: number; align?: "left" | "center" | "right" | "justify" },
	) => void;
	setTextColor: (r: number, g: number, b: number) => void;
	setDrawColor: (r: number, g: number, b: number) => void;
	setFillColor: (r: number, g: number, b: number) => void;
	setLineWidth: (width: number) => void;
	line: (x1: number, y1: number, x2: number, y2: number) => void;
	rect: (x: number, y: number, width: number, height: number, style?: "S" | "F" | "FD") => void;
	roundedRect: (
		x: number,
		y: number,
		width: number,
		height: number,
		rx: number,
		ry: number,
		style?: "S" | "F" | "FD",
	) => void;
	circle: (x: number, y: number, radius: number, style?: "S" | "F" | "FD") => void;
};

/** Normalize punctuation that breaks PDF metrics in built-in fonts. */
function normalizePdfPunctuation(text: string): string {
	return text
		.replace(UNICODE_SPACES, " ")
		.replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
		.replace(/[\u2018\u2019\u201A\u2032\u2035]/g, "'")
		.replace(/[\u201C\u201D\u201E\u2033\u2036]/g, '"')
		.replace(/\u2026/g, "...")
		.replace(/\u00B7/g, "-");
}

/** Strip/replace any remaining non-ASCII so jsPDF built-in Times metrics stay stable. */
function toAsciiSafePdfText(text: string): string {
	return text.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, (ch) => {
		const mapped = normalizePdfPunctuation(ch);
		return mapped === ch ? "" : mapped;
	});
}

/**
 * Collapse LLM artifacts like "i n t e g r a t e d" → "integrated".
 * Merges runs of 4+ single-letter "words" regardless of unicode space type.
 */
export function collapseSpacedLetterRuns(text: string): string {
	const words = text.split(/\s+/).filter(Boolean);
	if (!words.length) return text;

	const out: string[] = [];
	let letterRun: string[] = [];

	const flushRun = () => {
		if (letterRun.length >= 4) out.push(letterRun.join(""));
		else out.push(...letterRun);
		letterRun = [];
	};

	for (const word of words) {
		if (word.length === 1 && /[A-Za-z]/.test(word)) {
			letterRun.push(word);
			continue;
		}
		flushRun();
		out.push(word);
	}
	flushRun();

	return out.join(" ");
}

/** Remove geographic "Abia State"-style phrases from PDF output. */
export function stripGeographicStateNames(text: string): string {
	return text
		.replace(NIGERIA_STATE_PATTERN, "")
		.replace(/\(\s*[,;]?\s*\)/g, "")
		.replace(/\s*,\s*,+/g, ",")
		.replace(/\s+([,;:.])/g, "$1")
		.replace(/([,;])\s*(?=[,;])/g, "")
		.replace(/\b(in|at|of|from|within)\s*,\s*/gi, "$1 ")
		.replace(/\b(in|at|of|from|within)\s*\.(?=\s|$)/gi, ".")
		.replace(/^[,\s;]+|[,\s;]+$/g, "")
		.replace(/\s{2,}/g, " ")
		.trim();
}

export function normalizePdfText(raw: string): string {
	let text = raw
		.replace(UNICODE_SPACES, " ")
		.replace(/[\u200B-\u200D\uFEFF]/g, "")
		.replace(/\r\n/g, "\n")
		.replace(/\*\*/g, "")
		.replace(/__(.*?)__/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/[ \t]+/g, " ")
		.trim();

	text = normalizePdfPunctuation(text);
	text = collapseSpacedLetterRuns(text);
	text = stripGeographicStateNames(text);
	text = toAsciiSafePdfText(text);

	// Break only extremely long unbroken tokens (URLs).
	text = text.replace(/\S{50,}/g, (w) => w.match(/.{1,24}/g)?.join(" ") ?? w);

	return text.replace(/\s+/g, " ").trim();
}

function normalizeMarkdownForPdf(markdown: string): string {
	let text = markdown
		.replace(/[\u200B-\u200D\uFEFF]/g, "")
		.replace(/\r\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n");

	text = normalizePdfPunctuation(text);
	text = toAsciiSafePdfText(text);

	return text
		.split("\n")
		.map((line) => collapseSpacedLetterRuns(line.trim()))
		.join("\n")
		.trim();
}

function stripLeadingTitleLabel(text: string): string {
	const cleaned = normalizePdfText(text);
	if (/^title\s+/i.test(cleaned) && cleaned.length > 20) {
		return cleaned.replace(/^title\s+/i, "");
	}
	return cleaned;
}

function isGenericTitle(text: string): boolean {
	return GENERIC_TITLE_LABELS.has(text.toLowerCase().replace(/:$/, "").trim());
}

function flattenTokens(
	tokens: Token[] | undefined,
	options?: { keepLinkUrls?: boolean },
): string {
	if (!tokens?.length) return "";
	const parts: string[] = [];
	const walk = (list: Token[]) => {
		for (const t of list as Tokens.Generic[]) {
			if (t.type === "link") {
				const label = flattenTokens(t.tokens ?? [], options);
				const href = typeof t.href === "string" ? t.href.trim() : "";
				if (options?.keepLinkUrls && href) {
					parts.push(label ? `${label}: ${href}` : href);
				} else {
					parts.push(label);
				}
			} else if (t.type === "strong" || t.type === "em" || t.type === "del") {
				walk(t.tokens ?? []);
			} else if (t.type === "text" || t.type === "escape" || t.type === "codespan") {
				if (t.tokens?.length) walk(t.tokens);
				else if (t.text) parts.push(String(t.text));
			} else if (typeof t.text === "string" && t.text) {
				parts.push(t.text);
			}
		}
	};
	walk(tokens);
	return normalizePdfText(parts.join(" "));
}

function isBoldOnlyParagraph(p: Tokens.Paragraph): boolean {
	const inline = p.tokens ?? [];
	return inline.length === 1 && inline[0]?.type === "strong";
}

/** When marked merges `**Abstract**\nbody` into one paragraph, split heading from body. */
function splitLeadingSectionHeading(p: Tokens.Paragraph): { section: string; body: string } | null {
	const inline = p.tokens ?? [];
	if (inline.length < 2 || inline[0]?.type !== "strong") return null;
	const headingText = flattenTokens([inline[0]!]).trim();
	const section = sectionHeadingLabel(headingText);
	if (!section) return null;
	const body = flattenTokens(inline.slice(1)).replace(/^\s*[:.\-–—]\s*/, "").trim();
	return { section, body };
}

/**
 * Split `**Themes**\nbody` / `**Framework:** body` into a subsection heading + body.
 * Avoids treating same-line inline emphasis (`**critical** findings…`) as a heading.
 */
function splitLeadingSubsectionHeading(
	p: Tokens.Paragraph,
): { heading: string; body: string } | null {
	const inline = p.tokens ?? [];
	if (!inline.length || inline[0]?.type !== "strong") return null;

	const rawHeading = flattenTokens([inline[0]!]).trim();
	const heading = rawHeading.replace(/:+\s*$/, "").trim();
	if (!heading || heading.length > 80) return null;
	if (sectionHeadingLabel(heading)) return null;

	if (inline.length === 1) {
		return { heading, body: "" };
	}

	const restRaw = inline
		.slice(1)
		.map((t) => {
			const g = t as Tokens.Generic;
			return typeof g.raw === "string" ? g.raw : typeof g.text === "string" ? g.text : "";
		})
		.join("");
	const hasLineBreak = /^\s*\n/.test(restRaw);
	const hadColon = /:\s*$/.test(rawHeading) || /^\s*:/.test(restRaw);
	if (!hasLineBreak && !hadColon) return null;

	const body = flattenTokens(inline.slice(1)).replace(/^\s*[:.\-–—]\s*/, "").trim();
	return { heading, body };
}

function sectionHeadingLabel(text: string): string | null {
	const canonical = canonicalizeSectionTitle(text);
	if (canonical) return canonical;

	const key = text.toLowerCase().replace(/:$/, "").trim();
	if (SECTION_HEADINGS.has(key)) {
		return text.replace(/\*\*/g, "").trim();
	}
	return null;
}

function buildSkipKeys(meta: ResearchPaperMeta, extractedTitle: string): Set<string> {
	const skip = new Set<string>();
	const add = (value: string | null | undefined) => {
		const cleaned = normalizePdfText(value ?? "");
		if (cleaned) skip.add(cleaned.toLowerCase());
	};

	add(extractedTitle);
	add(meta.author);
	add(meta.department);
	add(meta.affiliation);
	for (const label of GENERIC_TITLE_LABELS) skip.add(label);

	return skip;
}

function shouldSkipMetadataLine(text: string, skipKeys: Set<string>, extractedTitle: string): boolean {
	const cleaned = stripLeadingTitleLabel(text);
	if (!cleaned) return true;

	// Never drop canonical section headings (normalizePdfText must not erase these).
	if (sectionHeadingLabel(cleaned)) return false;

	const key = cleaned.toLowerCase();
	if (skipKeys.has(key)) return true;
	if (isGenericTitle(cleaned)) return true;

	const titleKey = normalizePdfText(extractedTitle).toLowerCase();
	if (titleKey && key === titleKey) return true;
	if (titleKey && key.startsWith("title ") && key.includes(titleKey)) return true;

	return false;
}

function buildBlocks(markdown: string, meta: ResearchPaperMeta): PdfBlock[] {
	const blocks: PdfBlock[] = [];
	const author = meta.author?.trim() ?? "";
	const department = meta.department?.trim() ?? "";
	const affiliation = meta.affiliation?.trim() ?? "";
	const extractedTitle = extractPaperTitle(markdown, meta.fallbackTopic?.trim() ?? "");
	const skipKeys = buildSkipKeys(meta, extractedTitle);

	if (extractedTitle && !isGenericTitle(extractedTitle)) {
		blocks.push({ kind: "title", text: extractedTitle });
	}
	if (author) blocks.push({ kind: "byline", text: author });
	if (department) blocks.push({ kind: "affiliation", text: department });
	if (affiliation && affiliation.toLowerCase() !== department.toLowerCase()) {
		blocks.push({ kind: "affiliation", text: affiliation });
	}
	if (blocks.length > 0) blocks.push({ kind: "rule" });

	const pushBody = (text: string) => {
		if (shouldSkipMetadataLine(text, skipKeys, extractedTitle)) return;
		const cleaned = stripLeadingTitleLabel(text);
		if (!cleaned) return;
		if (inReferences) {
			for (const entry of splitReferenceEntries(cleaned)) {
				blocks.push({ kind: "reference", text: entry });
			}
			return;
		}
		blocks.push({ kind: "body", text: cleaned });
	};

	let inReferences = false;

	for (const token of marked.lexer(markdown.trim())) {
		if (token.type === "heading") {
			const text = flattenTokens((token as Tokens.Heading).tokens);
			if (!text || shouldSkipMetadataLine(text, skipKeys, extractedTitle)) continue;

			const section = sectionHeadingLabel(text);
			if (section) {
				inReferences = /^references$/i.test(section);
				blocks.push({ kind: "section", text: section });
			} else {
				blocks.push({ kind: "subsection", text: text.replace(/:+\s*$/, "").trim() });
			}
			continue;
		}

		if (token.type === "paragraph") {
			const p = token as Tokens.Paragraph;
			const looseTableLines = p.raw
				.split(/\n/)
				.map((line) => line.trim())
				.filter((line) => line.split("|").length >= 3);
			if (looseTableLines.length >= 2) {
				const cells = (line: string) =>
					line
						.replace(/^\||\|$/g, "")
						.split("|")
						.map((cell) => normalizePdfText(cell));
				const headers = cells(looseTableLines[0]!);
				const rows = looseTableLines
					.slice(1)
					.map(cells)
					.filter((row) => row.length === headers.length);
				if (headers.length >= 2 && rows.length) {
					blocks.push({ kind: "table", headers, rows });
					continue;
				}
			}
			const text = flattenTokens(p.tokens, { keepLinkUrls: inReferences });
			if (!text || shouldSkipMetadataLine(text, skipKeys, extractedTitle)) continue;

			if (isBoldOnlyParagraph(p)) {
				const section = sectionHeadingLabel(text);
				if (section) {
					inReferences = /^references$/i.test(section);
					blocks.push({ kind: "section", text: section });
					continue;
				}
				blocks.push({
					kind: "subsection",
					text: text.replace(/:+\s*$/, "").trim(),
				});
				continue;
			}

			const leading = splitLeadingSectionHeading(p);
			if (leading) {
				inReferences = /^references$/i.test(leading.section);
				blocks.push({ kind: "section", text: leading.section });
				if (leading.body) pushBody(leading.body);
				continue;
			}

			const leadingSub = splitLeadingSubsectionHeading(p);
			if (leadingSub) {
				blocks.push({ kind: "subsection", text: leadingSub.heading });
				if (leadingSub.body) pushBody(leadingSub.body);
				continue;
			}

			pushBody(text);
			continue;
		}

		if (token.type === "list") {
			const list = token as Tokens.List;
			list.items.forEach((item, i) => {
				const marker = list.ordered ? `${(Number(list.start) || 1) + i}.` : "•";
				pushBody(
					`${marker} ${flattenTokens(inlineTokensOf(item.tokens), { keepLinkUrls: inReferences })}`,
				);
			});
			blocks.push({ kind: "gap" });
			continue;
		}

		if (token.type === "blockquote") {
			pushBody(flattenTokens(inlineTokensOf((token as Tokens.Blockquote).tokens)));
			continue;
		}

		if (token.type === "table") {
			const table = token as Tokens.Table;
			const rowValues = (cells: Tokens.TableCell[]) =>
				cells.map((cell) => flattenTokens(cell.tokens));
			blocks.push({
				kind: "table",
				headers: rowValues(table.header),
				rows: table.rows.map(rowValues),
			});
			continue;
		}

		if (token.type === "code" && (token as Tokens.Code).lang?.toLowerCase() === "research-chart") {
			try {
				const chart = JSON.parse((token as Tokens.Code).text) as {
					type?: PdfChartSpec["type"];
					title?: string;
					caption?: string;
					xKey?: string;
					yKeys?: string[];
					data?: Array<Record<string, string | number>>;
				};
				const validTypes = new Set<PdfChartSpec["type"]>(["bar", "line", "area", "pie", "scatter"]);
				if (
					chart.type &&
					validTypes.has(chart.type) &&
					chart.xKey &&
					chart.yKeys?.length &&
					chart.data?.length
				) {
					blocks.push({
						kind: "chart",
						chart: {
							type: chart.type,
							title: chart.title?.trim() || "Research data visualization",
							caption: chart.caption?.trim(),
							xKey: chart.xKey,
							yKeys: chart.yKeys.slice(0, 5),
							data: chart.data.slice(0, 30),
						},
					});
				}
			} catch {
				/* Ignore an incomplete chart block while streaming. */
			}
			continue;
		}

		if (token.type === "code" && (token as Tokens.Code).lang?.toLowerCase() === "research-image") {
			try {
				const image = JSON.parse((token as Tokens.Code).text) as {
					title?: string;
					caption?: string;
					nodes?: Array<{ id?: string; label?: string }>;
					edges?: Array<{ from?: string; to?: string; label?: string }>;
				};
				blocks.push({
					kind: "image",
					title: image.title?.trim() || "Conceptual illustration",
					caption: image.caption?.trim() || "AI-generated conceptual illustration.",
					nodes: (image.nodes ?? [])
						.map((node) => node.label?.trim() ?? "")
						.filter(Boolean)
						.slice(0, 9),
					edges: (image.edges ?? [])
						.filter((edge) => edge.from && edge.to)
						.map((edge) => `${edge.from} → ${edge.to}${edge.label ? `: ${edge.label}` : ""}`)
						.slice(0, 12),
				});
			} catch {
				/* Ignore an incomplete image block while streaming. */
			}
			continue;
		}

		if (token.type === "code" && (token as Tokens.Code).lang?.toLowerCase() === "research-figure") {
			try {
				const figure = JSON.parse((token as Tokens.Code).text) as {
					title?: string;
					caption?: string;
					mime?: string;
					dataUrl?: string;
				};
				const dataUrl = figure.dataUrl?.trim() ?? "";
				if (dataUrl.startsWith("data:image/")) {
					blocks.push({
						kind: "figure",
						title: figure.title?.trim() || "Research figure",
						caption: figure.caption?.trim() || "From research note Figures.",
						mime: figure.mime?.trim() || "image/png",
						dataUrl,
					});
				}
			} catch {
				/* Ignore an incomplete figure block while streaming. */
			}
			continue;
		}

		if (token.type === "space") {
			blocks.push({ kind: "gap" });
		}
	}

	return pruneEmptyStudyAreaSections(coalesceFrontMatterBlocks(blocks));
}

/**
 * Journal-style front matter: Keywords / Study area become labeled blocks
 * (Springer-like: "Keywords term1 · term2"); Abstract keeps a section header
 * then compact body. Skips gap tokens when pairing a heading with its following body.
 */
function coalesceFrontMatterBlocks(blocks: PdfBlock[]): PdfBlock[] {
	const out: PdfBlock[] = [];
	let inAbstract = false;

	const nextContentIndex = (from: number) => {
		let j = from;
		while (j < blocks.length && blocks[j]?.kind === "gap") j += 1;
		return j;
	};

	for (let i = 0; i < blocks.length; i++) {
		const block = blocks[i]!;
		if (block.kind === "section") {
			const title = block.text.trim();

			// Always keep Abstract as a visible section header (same weight as Introduction).
			if (/^abstract$/i.test(title)) {
				out.push({ kind: "section", text: "Abstract" });
				const j = nextContentIndex(i + 1);
				const next = blocks[j];
				if (next?.kind === "body" && next.text.trim()) {
					out.push({ kind: "abstractBody", text: next.text.trim() });
					i = j;
				}
				inAbstract = false;
				continue;
			}

			inAbstract = false;
			if (/^keywords$/i.test(title)) {
				const j = nextContentIndex(i + 1);
				const next = blocks[j];
				if (next?.kind === "body" && next.text.trim()) {
					out.push({ kind: "keywords", text: formatKeywordTerms(next.text) });
					i = j;
					continue;
				}
			}
			if (/^study\s*area$/i.test(title)) {
				const j = nextContentIndex(i + 1);
				const next = blocks[j];
				if (next?.kind === "body" && next.text.trim()) {
					out.push({ kind: "studyArea", text: next.text.trim() });
					i = j;
					continue;
				}
			}
			out.push(block);
			continue;
		}
		// Body that still looks like inline Keywords / Study area / Abstract
		if (block.kind === "body") {
			const abs = block.text.match(/^Abstract\s*:\s*(.+)$/i);
			if (abs?.[1]?.trim()) {
				out.push({ kind: "section", text: "Abstract" });
				out.push({ kind: "abstractBody", text: abs[1].trim() });
				inAbstract = false;
				continue;
			}
			if (/^Abstract\s*:?\s*$/i.test(block.text.trim())) {
				out.push({ kind: "section", text: "Abstract" });
				inAbstract = true;
				continue;
			}
			const kw = block.text.match(/^Keywords?\s*:?\s*(.+)$/i);
			if (kw?.[1] && !/\bStudy\s+area\b/i.test(block.text)) {
				inAbstract = false;
				out.push({ kind: "keywords", text: formatKeywordTerms(kw[1]) });
				continue;
			}
			if (inAbstract) {
				out.push({ kind: "abstractBody", text: block.text });
				continue;
			}
		}
		if (block.kind === "keywords" || block.kind === "studyArea" || block.kind === "section") {
			inAbstract = false;
		}
		out.push(block);
	}
	return out;
}

/** Drop a Study area heading when its body was only a geographic state name. */
function pruneEmptyStudyAreaSections(blocks: PdfBlock[]): PdfBlock[] {
	const out: PdfBlock[] = [];
	for (let i = 0; i < blocks.length; i++) {
		const block = blocks[i]!;
		if (block.kind === "section" && /^study\s*area$/i.test(block.text.trim())) {
			let j = i + 1;
			while (j < blocks.length && blocks[j]?.kind === "gap") j += 1;
			const next = blocks[j];
			const hasBody =
				next &&
				((next.kind === "body" && normalizePdfText(next.text).length > 0) ||
					next.kind === "studyArea" ||
					next.kind === "table" ||
					next.kind === "chart" ||
					next.kind === "image" ||
					next.kind === "figure");
			if (!hasBody) continue;
		}
		if (block.kind === "studyArea" && !normalizePdfText(block.text)) continue;
		out.push(block);
	}
	return out;
}

function inlineTokensOf(blockTokens: Token[] | undefined): Token[] {
	if (!blockTokens) return [];
	return blockTokens.flatMap((t) => (t as Tokens.Generic).tokens ?? [t]);
}

/** Wrap text using jsPDF metrics after full normalization. */
function wrapLines(
	doc: JsPdfDoc,
	text: string,
	maxWidth: number,
	fontName: string,
	fontStyle: FontFace,
	fontSize: number,
): string[] {
	const clean = normalizePdfText(text);
	if (!clean) return [];

	const width = Math.max(24, maxWidth);
	doc.setFont(fontName, fontStyle);
	doc.setFontSize(fontSize);

	const split = (doc as unknown as { splitTextToSize: (t: string, w: number) => string[] }).splitTextToSize;
	if (typeof split === "function") {
		const lines = split.call(doc, clean, width).map((line) => normalizePdfText(String(line)));
		const safe: string[] = [];
		for (const line of lines) {
			if (!line) continue;
			doc.setFont(fontName, fontStyle);
			doc.setFontSize(fontSize);
			// Guard against rare metric misses that leave a line wider than the page.
			if (doc.getTextWidth(line) <= width + 0.5) {
				safe.push(line);
				continue;
			}
			const words = line.split(/\s+/).filter(Boolean);
			let current = "";
			for (const word of words) {
				const trial = current ? `${current} ${word}` : word;
				doc.setFont(fontName, fontStyle);
				doc.setFontSize(fontSize);
				if (!current || doc.getTextWidth(trial) <= width) {
					current = trial;
				} else {
					safe.push(current);
					current = word;
				}
			}
			if (current) safe.push(current);
		}
		return safe.length ? safe : [clean];
	}

	return [clean];
}

export async function renderResearchPaperPdf(
	content: string,
	meta: ResearchPaperMeta = {},
): Promise<import("jspdf").jsPDF | null> {
	// Promote **Abstract** → ## Abstract (same as edit preview) so marked emits heading tokens.
	const markdown = normalizeMarkdownForPdf(
		promoteBoldSectionsForDisplay(formatResearchPaperReferences(content)),
	);
	if (!markdown) return null;

	const { jsPDF } = await import("jspdf");
	const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });

	const pageW = doc.internal.pageSize.getWidth();
	const pageH = doc.internal.pageSize.getHeight();
	const maxWidth = pageW - PAGE.left - PAGE.right;
	let y = PAGE.top;

	doc.setFont(FONT, "normal");
	doc.setFontSize(SIZE.body);

	const lineHeight = (size: number, factor: number) => size * factor;

	const ensure = (need: number) => {
		if (y + need > pageH - PAGE.bottom) {
			doc.addPage();
			doc.setFont(FONT, "normal");
			y = PAGE.top;
		}
	};

	const drawJustifiedLine = (
		line: string,
		x: number,
		lineY: number,
		width: number,
		isLastLine: boolean,
	) => {
		const words = line.trim().split(/\s+/).filter(Boolean);
		if (words.length <= 1 || isLastLine) {
			doc.text(line, x, lineY);
			return;
		}

		const wordsWidth = words.reduce((sum, word) => sum + doc.getTextWidth(word), 0);
		const gaps = words.length - 1;
		const naturalSpace = doc.getTextWidth(" ");
		const extra = width - wordsWidth;
		// Only stretch when the line is reasonably full; avoid huge gaps on short lines.
		if (extra <= naturalSpace * gaps * 0.15 || extra / gaps > naturalSpace * 4) {
			doc.text(line, x, lineY);
			return;
		}

		const gapWidth = extra / gaps;
		let cursor = x;
		for (let i = 0; i < words.length; i++) {
			const word = words[i]!;
			doc.text(word, cursor, lineY);
			cursor += doc.getTextWidth(word) + (i < gaps ? gapWidth : 0);
		}
	};

	const drawLines = (
		lines: string[],
		size: number,
		face: FontFace,
		factor: number,
		x: number,
		color: [number, number, number] = COLOR.text,
		align: "left" | "justify" = "left",
		lineMaxWidth = maxWidth,
	) => {
		doc.setFont(FONT, face);
		doc.setFontSize(size);
		doc.setTextColor(...color);
		const lh = lineHeight(size, factor);
		const drawn: string[] = [];
		for (const rawLine of lines) {
			const line = normalizePdfText(rawLine);
			if (!line) {
				drawn.push("");
				continue;
			}
			doc.setFont(FONT, face);
			doc.setFontSize(size);
			// Re-wrap any line that still exceeds the printable width.
			const parts =
				doc.getTextWidth(line) > lineMaxWidth + 0.5
					? wrapLines(doc, line, lineMaxWidth, FONT, face, size)
					: [line];
			drawn.push(...parts);
		}

		for (let i = 0; i < drawn.length; i++) {
			const part = drawn[i]!;
			if (!part) {
				y += lh * 0.35;
				continue;
			}
			ensure(lh);
			doc.setFont(FONT, face);
			doc.setFontSize(size);
			doc.setTextColor(...color);
			if (align === "justify") {
				const isLastLine = i === drawn.length - 1 || !drawn[i + 1];
				drawJustifiedLine(part, x, y, lineMaxWidth, isLastLine);
			} else {
				doc.text(part, x, y);
			}
			y += lh;
		}
	};

	const drawLeft = (
		text: string,
		size: number,
		face: FontFace,
		factor: number,
		indent = 0,
		align: "left" | "justify" = "left",
	) => {
		const width = maxWidth - indent;
		const lines = wrapLines(doc, text, width, FONT, face, size);
		drawLines(lines, size, face, factor, PAGE.left + indent, COLOR.text, align, width);
	};

	/** Bibliography entry: first line flush left, wrapped lines hanging-indented, left-aligned. */
	const drawReferenceEntry = (text: string) => {
		const hang = 18;
		const words = normalizePdfText(text).split(/\s+/).filter(Boolean);
		if (!words.length) return;

		const lh = lineHeight(SIZE.body, LEADING.body);
		doc.setFont(FONT, "normal");
		doc.setFontSize(SIZE.body);
		doc.setTextColor(...COLOR.text);

		let lineWords: string[] = [];
		let lineIndex = 0;

		const lineMaxWidth = () => (lineIndex === 0 ? maxWidth : maxWidth - hang);
		const lineX = () => (lineIndex === 0 ? PAGE.left : PAGE.left + hang);

		const flush = () => {
			if (!lineWords.length) return;
			ensure(lh);
			doc.setFont(FONT, "normal");
			doc.setFontSize(SIZE.body);
			doc.setTextColor(...COLOR.text);
			doc.text(lineWords.join(" "), lineX(), y);
			y += lh;
			lineWords = [];
			lineIndex += 1;
		};

		for (const word of words) {
			const trial = lineWords.length ? `${lineWords.join(" ")} ${word}` : word;
			if (lineWords.length && doc.getTextWidth(trial) > lineMaxWidth() + 0.5) {
				flush();
			}
			lineWords.push(word);
		}
		flush();
	};

	const drawCenter = (
		text: string,
		size: number,
		face: FontFace,
		factor: number,
		color: [number, number, number] = COLOR.text,
	) => {
		const lines = wrapLines(doc, text, maxWidth, FONT, face, size);
		doc.setFont(FONT, face);
		doc.setFontSize(size);
		doc.setTextColor(...color);
		const lh = lineHeight(size, factor);
		for (const line of lines) {
			ensure(lh);
			const w = doc.getTextWidth(line);
			doc.text(line, (pageW - w) / 2, y);
			y += lh;
		}
	};

	const drawTable = (headers: string[], rows: string[][]) => {
		if (!headers.length) return;
		const columnCount = Math.min(headers.length, 12);
		const columnWidth = maxWidth / columnCount;
		const fontSize = columnCount > 8 ? 6.5 : columnCount > 5 ? 7.5 : 8.5;
		const padding = 3;
		const cellLines = (value: string) =>
			wrapLines(doc, normalizePdfText(value), columnWidth - padding * 2, FONT, "normal", fontSize);
		const rowHeight = (values: string[]) =>
			Math.max(
				fontSize * 1.35 + padding * 2,
				...values.slice(0, columnCount).map((value) => cellLines(value).length * fontSize * 1.25 + padding * 2),
			);
		const drawRow = (values: string[], header = false) => {
			const height = rowHeight(values);
			doc.setFont(FONT, header ? "bold" : "normal");
			doc.setFontSize(fontSize);
			for (let column = 0; column < columnCount; column++) {
				const x = PAGE.left + column * columnWidth;
				if (header) {
					doc.setFillColor(235, 238, 245);
					doc.rect(x, y, columnWidth, height, "F");
				}
				doc.setDrawColor(175, 180, 190);
				doc.rect(x, y, columnWidth, height, "S");
				doc.setTextColor(...COLOR.text);
				const lines = cellLines(values[column] ?? "");
				lines.forEach((line, lineIndex) => {
					doc.text(line, x + padding, y + padding + fontSize + lineIndex * fontSize * 1.25);
				});
			}
			y += height;
		};
		const addTablePage = () => {
			doc.addPage();
			y = PAGE.top;
			drawRow(headers, true);
		};

		const headerHeight = rowHeight(headers);
		if (y + headerHeight > pageH - PAGE.bottom) {
			doc.addPage();
			y = PAGE.top;
		}
		drawRow(headers, true);
		for (const row of rows.slice(0, 40)) {
			const height = rowHeight(row);
			if (y + height > pageH - PAGE.bottom) addTablePage();
			drawRow(row);
		}
		y += 10;
	};

	const drawChart = (chart: PdfChartSpec) => {
		const yKey = chart.yKeys[0];
		if (!yKey) return;
		const values = chart.data
			.map((row) => ({
				label: String(row[chart.xKey] ?? ""),
				value: Number(row[yKey]),
			}))
			.filter((item) => Number.isFinite(item.value))
			.slice(0, 16);
		if (!values.length) return;

		const chartHeight = 220;
		ensure(chartHeight + 55);
		drawCenter(`Figure: ${chart.title}`, 10, "bold", 1.25);
		y += 6;
		const plotX = PAGE.left + 42;
		const plotY = y;
		const plotWidth = maxWidth - 54;
		const plotHeight = 150;
		const minValue = Math.min(0, ...values.map((item) => item.value));
		const maxValue = Math.max(0, ...values.map((item) => item.value));
		const range = maxValue - minValue || 1;
		const valueY = (value: number) => plotY + plotHeight - ((value - minValue) / range) * plotHeight;
		const zeroY = valueY(0);

		doc.setDrawColor(90, 100, 115);
		doc.setLineWidth(0.8);
		doc.line(plotX, plotY, plotX, plotY + plotHeight);
		doc.line(plotX, zeroY, plotX + plotWidth, zeroY);
		doc.setFont(FONT, "normal");
		doc.setFontSize(6.5);
		doc.setTextColor(...COLOR.muted);
		doc.text(normalizePdfText(String(maxValue)), PAGE.left, plotY + 5);
		doc.text(normalizePdfText(String(minValue)), PAGE.left, plotY + plotHeight);

		const colors: Array<[number, number, number]> = [
			[79, 70, 229],
			[8, 145, 178],
			[5, 150, 105],
			[217, 119, 6],
			[220, 38, 38],
		];
		const step = plotWidth / Math.max(values.length, 1);
		const points = values.map((item, index) => ({
			x: plotX + step * index + step / 2,
			y: valueY(item.value),
			...item,
		}));

		if (chart.type === "line" || chart.type === "area" || chart.type === "scatter") {
			points.forEach((point, index) => {
				const color = colors[index % colors.length]!;
				doc.setFillColor(...color);
				doc.circle(point.x, point.y, 2.5, "F");
				if (chart.type !== "scatter" && index > 0) {
					const previous = points[index - 1]!;
					doc.setDrawColor(79, 70, 229);
					doc.setLineWidth(1.5);
					doc.line(previous.x, previous.y, point.x, point.y);
				}
			});
		} else {
			const barWidth = Math.max(5, step * 0.62);
			points.forEach((point, index) => {
				const color = colors[index % colors.length]!;
				doc.setFillColor(...color);
				const top = Math.min(point.y, zeroY);
				doc.rect(point.x - barWidth / 2, top, barWidth, Math.max(1, Math.abs(zeroY - point.y)), "F");
			});
		}

		doc.setFontSize(6);
		points.forEach((point) => {
			const label = normalizePdfText(point.label).slice(0, 12);
			const width = doc.getTextWidth(label);
			doc.text(label, point.x - width / 2, plotY + plotHeight + 10);
		});
		y = plotY + plotHeight + 22;
		if (chart.caption) {
			drawCenter(chart.caption, 8, "italic", 1.25, COLOR.muted);
		}
		y += 12;
	};

	const drawConceptImage = (block: Extract<PdfBlock, { kind: "image" }>) => {
		if (!block.nodes.length) return;
		const rows = Math.ceil(block.nodes.length / 3);
		const figureHeight = 55 + rows * 78;
		ensure(figureHeight + 40);
		drawCenter(`Figure: ${block.title}`, 10, "bold", 1.25);
		y += 8;
		const top = y;
		const boxWidth = (maxWidth - 24) / 3;
		const boxHeight = 48;
		block.nodes.forEach((node, index) => {
			const column = index % 3;
			const row = Math.floor(index / 3);
			const x = PAGE.left + column * (boxWidth + 12);
			const boxY = top + row * 78;
			doc.setFillColor(239, 242, 255);
			doc.setDrawColor(79, 70, 229);
			doc.roundedRect(x, boxY, boxWidth, boxHeight, 6, 6, "FD");
			const lines = wrapLines(doc, node, boxWidth - 12, FONT, "bold", 8);
			doc.setFont(FONT, "bold");
			doc.setFontSize(8);
			lines.slice(0, 3).forEach((line, lineIndex) => {
				const lineWidth = doc.getTextWidth(line);
				doc.text(line, x + (boxWidth - lineWidth) / 2, boxY + 18 + lineIndex * 10);
			});
			if (index < block.nodes.length - 1) {
				const nextColumn = (index + 1) % 3;
				if (nextColumn !== 0) {
					doc.setDrawColor(100, 116, 139);
					doc.line(x + boxWidth, boxY + boxHeight / 2, x + boxWidth + 10, boxY + boxHeight / 2);
				}
			}
		});
		y = top + rows * 78;
		drawCenter(block.caption, 8, "italic", 1.25, COLOR.muted);
		y += 12;
	};

	const drawRasterFigure = (block: Extract<PdfBlock, { kind: "figure" }>) => {
		const match = /^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/i.exec(block.dataUrl);
		if (!match) {
			drawCenter(`Figure: ${block.title}`, 10, "bold", 1.25);
			drawCenter(block.caption, 8, "italic", 1.25, COLOR.muted);
			y += 8;
			return;
		}
		const formatRaw = match[1]!.toLowerCase();
		const format =
			formatRaw.includes("jpeg") || formatRaw.includes("jpg")
				? "JPEG"
				: formatRaw.includes("webp")
					? "WEBP"
					: "PNG";
		const base64 = match[2]!;
		const maxH = 280;
		ensure(maxH + 50);
		drawCenter(`Figure: ${block.title}`, 10, "bold", 1.25);
		y += 6;
		try {
			const props = (
				doc as unknown as {
					getImageProperties: (data: string) => { width: number; height: number };
				}
			).getImageProperties(block.dataUrl);
			const ratio = props.width > 0 ? props.height / props.width : 0.75;
			let w = maxWidth;
			let h = w * ratio;
			if (h > maxH) {
				h = maxH;
				w = h / Math.max(ratio, 0.01);
			}
			const x = PAGE.left + (maxWidth - w) / 2;
			(
				doc as unknown as {
					addImage: (
						data: string,
						format: string,
						x: number,
						y: number,
						w: number,
						h: number,
					) => void;
				}
			).addImage(block.dataUrl, format, x, y, w, h);
			y += h + 8;
			void base64;
		} catch {
			drawCenter("[Figure image could not be embedded]", 9, "italic", 1.25, COLOR.muted);
			y += 8;
		}
		drawCenter(block.caption, 8, "italic", 1.25, COLOR.muted);
		y += 12;
	};

	/** Springer-style labeled line: bold label + regular value on one line. */
	const drawLabeledMeta = (label: string, value: string) => {
		const clean = normalizePdfText(value);
		if (!clean) return;
		const lh = lineHeight(SIZE.body, LEADING.body);
		doc.setFont(FONT, "bold");
		doc.setFontSize(SIZE.body);
		doc.setTextColor(...COLOR.text);
		const labelText = `${label}  `;
		const labelWidth = doc.getTextWidth(labelText);
		const valueWidth = maxWidth - labelWidth;
		const valueLines = wrapLines(doc, clean, Math.max(80, valueWidth), FONT, "normal", SIZE.body);
		ensure(lh * Math.max(1, valueLines.length));
		doc.setFont(FONT, "bold");
		doc.setFontSize(SIZE.body);
		doc.text(labelText, PAGE.left, y);
		doc.setFont(FONT, "normal");
		if (valueLines[0]) {
			doc.text(valueLines[0], PAGE.left + labelWidth, y);
		}
		y += lh;
		for (const line of valueLines.slice(1)) {
			ensure(lh);
			doc.text(line, PAGE.left + labelWidth, y);
			y += lh;
		}
	};

	const blocks = buildBlocks(markdown, meta);

	for (const block of blocks) {
		const text = "text" in block ? normalizePdfText(block.text) : "";
		switch (block.kind) {
			case "title":
				drawCenter(text, SIZE.title, "bold", LEADING.title);
				y += 10;
				break;
			case "byline":
				drawCenter(text, SIZE.byline, "normal", LEADING.body);
				y += 4;
				break;
			case "affiliation":
				drawCenter(text, SIZE.affiliation, "italic", LEADING.body, COLOR.muted);
				y += 10;
				break;
			case "rule":
				ensure(16);
				doc.setDrawColor(...COLOR.rule);
				doc.setLineWidth(0.6);
				doc.line(PAGE.left, y, pageW - PAGE.right, y);
				y += 16;
				break;
			case "section": {
				// Same visual weight for Abstract as Introduction / other IMRaD headings.
				y += 14;
				drawLeft(text, SIZE.section, "bold", LEADING.section);
				y += 8;
				break;
			}
			case "subsection": {
				y += 10;
				drawLeft(text, SIZE.subsection, "bold", LEADING.section);
				y += 6;
				break;
			}
			case "abstractBody":
				drawLeft(text, SIZE.body, "normal", LEADING.body, 0, "justify");
				y += 8;
				break;
			case "keywords":
				y += 6;
				drawLabeledMeta("Keywords", formatKeywordTerms(text));
				y += 8;
				break;
			case "studyArea":
				y += 4;
				drawLabeledMeta("Study area", text);
				y += 12;
				break;
			case "body":
				drawLeft(text, SIZE.body, "normal", LEADING.body, 0, "justify");
				y += 8;
				break;
			case "reference": {
				drawReferenceEntry(text);
				y += 14;
				break;
			}
			case "gap":
				y += 8;
				break;
			case "table":
				drawTable(block.headers, block.rows);
				break;
			case "chart":
				drawChart(block.chart);
				break;
			case "image":
				drawConceptImage(block);
				break;
			case "figure":
				drawRasterFigure(block);
				break;
		}
	}

	const pages = doc.getNumberOfPages();
	for (let p = 1; p <= pages; p++) {
		doc.setPage(p);
		doc.setFont(FONT, "normal");
		doc.setFontSize(SIZE.footer);
		doc.setTextColor(120, 120, 120);
		const label = String(p);
		doc.text(label, (pageW - doc.getTextWidth(label)) / 2, pageH - PAGE.bottom / 2);
	}

	return doc;
}

export async function generateResearchPaperPdfBuffer(
	content: string,
	meta: ResearchPaperMeta = {},
): Promise<ArrayBuffer | null> {
	const doc = await renderResearchPaperPdf(content, meta);
	if (!doc) return null;
	return doc.output("arraybuffer") as ArrayBuffer;
}

export async function downloadMarkdownAsPdf(
	content: string,
	filename: string,
	meta: ResearchPaperMeta = {},
): Promise<void> {
	if (typeof window === "undefined") return;
	const doc = await renderResearchPaperPdf(content, meta);
	if (!doc) return;
	doc.save(`${researchPaperFilename(filename)}.pdf`);
}
