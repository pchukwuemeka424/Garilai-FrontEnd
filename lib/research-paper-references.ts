import { formatCitation } from "@/lib/citation-format";
import { parsePastedReference } from "@/lib/citation-parse";
import { getStyleFamily, type CitationStyle } from "@/lib/citation-styles";
import {
	standardizeResearchSectionHeadings,
	stripArxivMetaPreserveLayout,
} from "@/lib/research-paper-sections";

const REFERENCES_HEADING = /^(?:\#{1,6}\s+|\*\*)References(?:\*\*)?\s*$/im;
const ARXIV_ID = /[\d]{4}\.[\d]{4,5}(?:v\d+)?[a-z]?/i;
const MD_LINK = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/gi;

/** Normalize headings: strip hash prefixes, use bold section titles; remove divider lines. */
export function normalizeResearchPaperMarkdown(content: string): string {
	return standardizeResearchSectionHeadings(
		content
			.replace(/^(\#{1,6}\s+)\*\*([^*\n]+)\*\*\s*$/gm, "**$2**")
			.replace(/^(\#{1,6}\s+)\*([^*\n]+)\*\s*$/gm, "**$2**")
			.replace(/^(\#{1,6}\s+)(.+?)\s*$/gm, "**$2**")
			.replace(/^[\s]*(-{2,}|_{2,}|\*{2,})[\s]*$/gm, "")
			.replace(/\n{3,}/g, "\n\n")
			.trim(),
	);
}

/** Remove visible arXiv labels, IDs, and bare repository URLs from text. */
export function stripArxivMeta(text: string): string {
	return stripArxivMetaPreserveLayout(text);
}

/** Keep link labels; drop URLs — used on the paper body so sources only appear under References. */
function stripMarkdownLinksKeepLabel(text: string): string {
	return text
		.replace(MD_LINK, "$1")
		.replace(/(?<!\]\()https?:\/\/[^\s)\],]+/gi, "")
		.replace(/[ \t]{2,}/g, " ")
		.replace(/\s+\./g, ".")
		.replace(/\.\s*\./g, ".")
		.trim();
}

function extractSourceUrl(text: string): string | null {
	const sourceLink = text.match(/\[Source\]\((https?:\/\/[^)]+)\)/i);
	if (sourceLink?.[1]) return sourceLink[1].replace(/[.,;:]+$/, "");

	const anyLink = text.match(/\]\((https?:\/\/[^)]+)\)/i);
	if (anyLink?.[1]) return anyLink[1].replace(/[.,;:]+$/, "");

	const urlMatch = text.match(/https?:\/\/[^\s)\],]+/i);
	if (urlMatch?.[0]) return urlMatch[0].replace(/[.,;:]+$/, "");

	const idMatch = text.match(new RegExp(`\\barXiv:\\s*(${ARXIV_ID.source})`, "i"));
	if (idMatch?.[1]) return `https://arxiv.org/abs/${idMatch[1]}`;

	const absMatch = text.match(new RegExp(`arxiv\\.org/abs/(${ARXIV_ID.source})`, "i"));
	if (absMatch?.[1]) return `https://arxiv.org/abs/${absMatch[1]}`;

	return null;
}

function removeBareUrls(text: string): string {
	return text.replace(/(?<!\]\()https?:\/\/[^\s)\],]+/gi, "").replace(/[ \t]{2,}/g, " ").trim();
}

/**
 * Split a References block into one entry per source.
 * Handles blank lines and run-on paragraphs (no blank lines between entries).
 */
export function splitReferenceEntries(text: string): string[] {
	const trimmed = text.replace(/\r/g, "").trim();
	if (!trimmed) return [];

	const byBlank = trimmed
		.split(/\n\s*\n+/)
		.map((chunk) => chunk.replace(/\s+/g, " ").trim())
		.filter(Boolean);
	if (byBlank.length > 1) {
		return byBlank.flatMap((chunk) => splitReferenceEntries(chunk));
	}

	const single = byBlank[0] ?? trimmed.replace(/\s+/g, " ").trim();

	const afterUrl = single.split(
		/(?<=https?:\/\/[^\s]+)\.?\s+(?=[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ''\-.,\s]{1,80}?\(\d{4}[a-z]?\))/,
	);
	if (afterUrl.length > 1) {
		return afterUrl.map((c) => c.trim()).filter(Boolean);
	}

	const afterSentence = single.split(
		/(?<=\.)\s+(?=[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ''\-]+(?:,|\s|&|et\s+al)[^()]{0,100}?\(\d{4}[a-z]?\))/,
	);
	if (afterSentence.length > 1) {
		return afterSentence.map((c) => c.trim()).filter(Boolean);
	}

	return [single];
}

function finalizeReferenceLine(line: string): string {
	let result = stripArxivMeta(line);
	result = removeBareUrls(result);
	return result
		.replace(/\s+\[Source\]/gi, " [Source]")
		.replace(/\s+\./g, ".")
		.replace(/\.\s*\./g, ".")
		.replace(/\.\s*\[Source\]/i, ". [Source]")
		.trim();
}

/**
 * Normalize a reference entry to:
 *   Author (Year). Title. [Source](url).
 */
function formatReferenceEntry(line: string): string {
	const trimmed = line.trim();
	if (!trimmed || REFERENCES_HEADING.test(trimmed)) return trimmed;

	const sourceUrl = extractSourceUrl(trimmed);
	let working = stripArxivMeta(trimmed);

	working = working.replace(MD_LINK, "$1");
	working = working.replace(/https?:\/\/[^\s)\],]+/gi, "").replace(/\barXiv:\s*[\d.]+[a-z]?\b/gi, "");
	working = working.replace(/[ \t]{2,}/g, " ").trim();
	working = working.replace(/\bSource\.?\s*$/i, "").trim();

	const numbered = working.match(/^(\d+\.\s+|\[\d+\]\s+)([\s\S]+)$/);
	const prefixNum = numbered?.[1] ?? "";
	let body = (numbered?.[2] ?? working).trim();
	body = body.replace(/\s+/g, " ").replace(/[:.,;\s]+$/g, "").trim();

	if (!sourceUrl) {
		return finalizeReferenceLine(`${prefixNum}${body}.`);
	}

	return finalizeReferenceLine(`${prefixNum}${body}. [Source](${sourceUrl}).`);
}

function isReferenceEntryStart(line: string): boolean {
	const t = line.trim();
	if (!t) return false;
	if (/^\d+\.\s+/.test(t) || /^\[\d+\]/.test(t)) return true;
	if (/\(\d{4}[a-z]?\)/.test(t) && t.length > 12) return true;
	if (/\[[^\]]+\]\(https?:\/\/[^)]+\)/.test(t) && t.length > 20) return true;
	return false;
}

/** Group wrapped reference lines into entries; each gets a Source link. */
function formatReferencesBlock(section: string): string {
	const lines = section.split("\n");
	const headingIndex = lines.findIndex((line) => REFERENCES_HEADING.test(line.trim()));
	if (headingIndex < 0) return stripArxivMeta(section);

	const head = lines.slice(0, headingIndex + 1);
	const rawBody = lines.slice(headingIndex + 1);
	const entries: string[] = [];
	let current = "";

	for (const line of rawBody) {
		const trimmed = line.trim();
		if (!trimmed) {
			if (current) {
				entries.push(current);
				current = "";
			}
			continue;
		}
		if (isReferenceEntryStart(trimmed) && current) {
			entries.push(current);
			current = trimmed;
		} else {
			current = current ? `${current} ${trimmed}` : trimmed;
		}
	}
	if (current) entries.push(current);

	const exploded = entries.flatMap((entry) => splitReferenceEntries(entry));
	const formatted = exploded.map((entry) => formatReferenceEntry(entry)).filter(Boolean);

	// Double newline between entries so Markdown/PDF treat each as its own block.
	return [...head, "", ...formatted.flatMap((entry, i) => (i === 0 ? [entry] : ["", entry]))]
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trimEnd();
}

/** Strip source links from the body; keep [Source](url) on References entries only. */
export function formatResearchPaperReferences(content: string): string {
	const trimmed = normalizeResearchPaperMarkdown(content);
	if (!trimmed) return trimmed;

	const headingMatch = trimmed.match(REFERENCES_HEADING);
	if (!headingMatch || headingMatch.index === undefined) {
		return stripMarkdownLinksKeepLabel(stripArxivMeta(trimmed));
	}

	const body = stripMarkdownLinksKeepLabel(
		stripArxivMeta(trimmed.slice(0, headingMatch.index).trimEnd()),
	);
	const references = trimmed.slice(headingMatch.index);

	return `${body}\n\n${formatReferencesBlock(references)}`.trim();
}

export type ResearchReferencesIssue = {
	code:
		| "missing_section"
		| "empty_section"
		| "missing_source"
		| "run_on"
		| "insufficient_entries";
	message: string;
};

export type ResearchReferencesValidation = {
	ok: boolean;
	entryCount: number;
	entriesWithSource: number;
	issues: ResearchReferencesIssue[];
	/** True when formatting would change the stored markdown. */
	needsFormat: boolean;
};

function extractReferencesBody(content: string): string | null {
	const match = content.match(REFERENCES_HEADING);
	if (!match || match.index === undefined) return null;
	return content.slice(match.index + match[0].length);
}

/** Validate References structure, spacing, and Source links. */
export function validateResearchPaperReferences(content: string): ResearchReferencesValidation {
	const trimmed = content.trim();
	const formatted = formatResearchPaperReferences(trimmed);
	const needsFormat = Boolean(trimmed) && formatted !== trimmed;
	const issues: ResearchReferencesIssue[] = [];

	const refsBody = extractReferencesBody(trimmed);
	if (refsBody === null) {
		return {
			ok: false,
			entryCount: 0,
			entriesWithSource: 0,
			issues: [
				{
					code: "missing_section",
					message: "No References section found.",
				},
			],
			needsFormat,
		};
	}

	const entries = splitReferenceEntries(refsBody);
	if (entries.length === 0) {
		issues.push({
			code: "empty_section",
			message: "References section is empty.",
		});
	}

	// Detect run-on: one physical paragraph holding multiple author-year starts.
	const compact = refsBody.replace(/\s+/g, " ").trim();
	const authorYearHits = compact.match(
		/\b[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-öø-ÿ''\-]+[^()]{0,80}?\(\d{4}[a-z]?\)/g,
	);
	if ((authorYearHits?.length ?? 0) > 1 && !/\n\s*\n/.test(refsBody)) {
		issues.push({
			code: "run_on",
			message: "References run together without blank lines between entries.",
		});
	}

	let entriesWithSource = 0;
	for (const entry of entries) {
		if (/\[Source\]\(https?:\/\/[^)]+\)/i.test(entry) || /\]\(https?:\/\/[^)]+\)/.test(entry)) {
			entriesWithSource += 1;
		}
	}
	const missingSource = entries.length - entriesWithSource;
	if (missingSource > 0) {
		issues.push({
			code: "missing_source",
			message: `${missingSource} reference${missingSource === 1 ? "" : "s"} missing a Source link.`,
		});
	}

	if (entries.length > 0 && entries.length < 25) {
		issues.push({
			code: "insufficient_entries",
			message: `Only ${entries.length} reference entr${entries.length === 1 ? "y" : "ies"} found; minimum is 25 from the research bank.`,
		});
	}

	return {
		ok: issues.length === 0,
		entryCount: entries.length,
		entriesWithSource,
		issues,
		needsFormat,
	};
}

/** Format References and return validation of the result. */
export function validateAndFormatResearchPaperReferences(content: string): {
	content: string;
	validation: ResearchReferencesValidation;
	changed: boolean;
} {
	const original = content.trim();
	const next = formatResearchPaperReferences(original);
	const validation = validateResearchPaperReferences(next);
	return {
		content: next,
		validation: { ...validation, needsFormat: false },
		changed: next !== original,
	};
}

function isNumberedBibliographyStyle(style: CitationStyle): boolean {
	const family = getStyleFamily(style);
	return (
		family === "ieee" ||
		family === "vancouver" ||
		family === "ama" ||
		family === "acs" ||
		family === "nature" ||
		style === "cse-citation-sequence"
	);
}

function usesBracketNumbers(style: CitationStyle): boolean {
	const family = getStyleFamily(style);
	return family === "ieee" || family === "acs" || family === "nature";
}

/**
 * Normalize an entry for parsing: drop markdown links, numbering, and URLs
 * (URL is tracked separately so years in arXiv paths are not parsed as publication years).
 */
function prepareEntryForParse(text: string): string {
	return text
		.replace(/\[Source\]\((https?:\/\/[^)]+)\)/gi, "")
		.replace(/\[([^\]]*)\]\((https?:\/\/[^)]+)\)/gi, "$1")
		.replace(/(?<!\]\()https?:\/\/[^\s)\],]+/gi, "")
		.replace(/^\s*(?:\d+\.|\[\d+\])\s*/, "")
		.replace(/\bSource\.?\s*$/i, "")
		.replace(/\s*\[Online\]\.?/gi, "")
		.replace(/\s*Available at:?\s*/gi, "")
		.replace(/\s*Available:\s*/gi, "")
		.replace(/\s*Retrieved(?:\s+from)?\s*/gi, "")
		.replace(/\s*Accessed:?\s*(?:\d{4})?\.?/gi, "")
		.replace(/\s+/g, " ")
		.replace(/[.,;:\s]+$/g, "")
		.trim();
}

function cleanReferenceTitle(raw: string): string {
	return raw
		.replace(/^["“]|["”]$/g, "")
		.replace(/[.,;:\s]+$/g, "")
		.trim();
}

function normalizePaperAuthors(raw: string): string {
	return raw
		.replace(/\s+&\s+/g, "; ")
		.replace(/\s+and\s+/gi, "; ")
		.replace(/\bet\s+al\.?/gi, "et al.")
		.replace(/\.+$/, "")
		.trim();
}

/**
 * Parse a research-paper References line into structured fields.
 * Handles Author (Year). Title. plus common styled variants.
 */
function parsePaperReferenceEntry(entry: string, sourceUrl: string | null) {
	const compact = prepareEntryForParse(entry);
	const url = sourceUrl || undefined;

	// Author (Year). Title …
	const apaLike = compact.match(/^(.+?)\s*\((\d{4}[a-z]?)\)\.?\s+(.+)$/i);
	if (apaLike) {
		const authors = normalizePaperAuthors(apaLike[1]!);
		const year = apaLike[2]!;
		const title = cleanReferenceTitle(apaLike[3]!);
		if (authors && title && year) {
			return { sourceType: "website" as const, authors, title, year, url };
		}
	}

	// Author Year. "Title"
	const chicagoLike = compact.match(/^(.+?)\s+(\d{4}[a-z]?)\.\s+["“](.+?)["”]\.?$/);
	if (chicagoLike) {
		return {
			sourceType: "website" as const,
			authors: normalizePaperAuthors(chicagoLike[1]!),
			year: chicagoLike[2]!,
			title: cleanReferenceTitle(chicagoLike[3]!),
			url,
		};
	}

	// Author. "Title." Year
	const mlaLike = compact.match(/^(.+?)\.\s+["“](.+?)["”]\.?\s*,?\s*(\d{4}[a-z]?)\.?$/);
	if (mlaLike) {
		return {
			sourceType: "website" as const,
			authors: normalizePaperAuthors(mlaLike[1]!),
			title: cleanReferenceTitle(mlaLike[2]!),
			year: mlaLike[3]!,
			url,
		};
	}

	// F. Last, "Title," Year  |  F. Last and B. Last, "Title," Year
	const ieeeLike = compact.match(
		/^((?:[A-Z]\.\s*)+[A-Za-z'''\-]+(?:(?:\s*,\s*|\s+and\s+)(?:[A-Z]\.\s*)*[A-Za-z'''\-]+)*),\s*["“](.+?)["”][,.]?\s*,?\s*(\d{4}[a-z]?)\.?$/,
	);
	if (ieeeLike) {
		return {
			sourceType: "website" as const,
			authors: normalizePaperAuthors(ieeeLike[1]!),
			title: cleanReferenceTitle(ieeeLike[2]!),
			year: ieeeLike[3]!,
			url,
		};
	}

	const parsed = parsePastedReference(compact || entry);
	return {
		...parsed.reference,
		authors: normalizePaperAuthors(parsed.reference.authors || ""),
		url,
		title: cleanReferenceTitle(parsed.reference.title || ""),
		siteName: undefined,
		sourceType: "website" as const,
	};
}

function collectReferenceEntries(refsSection: string): { heading: string; entries: string[] } {
	const lines = refsSection.replace(/\r/g, "").split("\n");
	const headingIndex = lines.findIndex((line) => REFERENCES_HEADING.test(line.trim()));
	const heading = headingIndex >= 0 ? lines[headingIndex]!.trim() : "**References**";
	const rawBody = (headingIndex >= 0 ? lines.slice(headingIndex + 1) : lines).join("\n");

	const entries: string[] = [];
	let current = "";
	for (const line of rawBody.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) {
			if (current) {
				entries.push(current);
				current = "";
			}
			continue;
		}
		if (isReferenceEntryStart(trimmed) && current) {
			entries.push(current);
			current = trimmed;
		} else {
			current = current ? `${current} ${trimmed}` : trimmed;
		}
	}
	if (current) entries.push(current);

	return {
		heading,
		entries: entries.flatMap((entry) => splitReferenceEntries(entry)).filter(Boolean),
	};
}

function withBibliographyNumber(line: string, index: number, style: CitationStyle): string {
	const body = line.replace(/^\s*(?:\d+\.|\[\d+\])\s*/, "").trim();
	if (!isNumberedBibliographyStyle(style)) return body;
	if (usesBracketNumbers(style)) return `[${index + 1}] ${body}`;
	return `${index + 1}. ${body}`;
}

/**
 * Parse each References entry and rewrite it in the chosen citation style.
 * Preserves [Source](url) links via the shared paper reference formatter.
 */
export function reformatResearchPaperReferencesByStyle(
	content: string,
	style: CitationStyle,
): { content: string; changed: boolean; entryCount: number } {
	const trimmed = normalizeResearchPaperMarkdown(content);
	if (!trimmed) {
		return { content: trimmed, changed: false, entryCount: 0 };
	}

	const headingMatch = trimmed.match(REFERENCES_HEADING);
	if (!headingMatch || headingMatch.index === undefined) {
		return { content: trimmed, changed: false, entryCount: 0 };
	}

	const body = trimmed.slice(0, headingMatch.index).trimEnd();
	const refsSection = trimmed.slice(headingMatch.index);
	const { heading, entries } = collectReferenceEntries(refsSection);

	if (entries.length === 0) {
		return { content: trimmed, changed: false, entryCount: 0 };
	}

	const reformatted = entries.map((entry, index) => {
		const sourceUrl = extractSourceUrl(entry);
		const parsed = parsePaperReferenceEntry(entry, sourceUrl);
		const family = getStyleFamily(style);
		// Numeric STEM styles format cleaner as journal/default than website ("Accessed: year").
		const numericFamily =
			family === "ieee" ||
			family === "vancouver" ||
			family === "ama" ||
			family === "acs" ||
			family === "nature";
		const reference = {
			...parsed,
			// Keep URL off the formatter input so styles don't embed bare links / "Available at".
			url: undefined,
			doi: undefined,
			sourceType: numericFamily ? ("journal" as const) : ("website" as const),
			siteName: undefined,
			journal: undefined,
		};

		let formatted = formatCitation(style, reference).trim();
		if (!formatted) {
			formatted = prepareEntryForParse(entry) || entry;
		}

		// Strip formatter leftovers, then attach Source URL for the paper normalizer.
		formatted = formatted
			.replace(/(?<!\]\()https?:\/\/[^\s)\],]+/gi, "")
			.replace(/\s*\[Online\]\.?/gi, "")
			.replace(/\s*Available at:?\s*/gi, "")
			.replace(/\s*Available:\s*/gi, "")
			.replace(/\."(\s*)$/g, '"$1')
			.replace(/\s+/g, " ")
			.replace(/[.,;:\s]+$/g, "")
			.trim();

		if (sourceUrl) {
			formatted = `${formatted}. ${sourceUrl}`;
		} else {
			formatted = `${formatted}.`;
		}

		return withBibliographyNumber(formatted, index, style);
	});

	const next = formatResearchPaperReferences(
		`${body}\n\n${heading}\n\n${reformatted.join("\n\n")}`.trim(),
	);

	return {
		content: next,
		changed: next !== trimmed,
		entryCount: reformatted.length,
	};
}
