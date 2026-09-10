/** Canonical IMRaD-style section headings for generated research papers. */
export const STANDARD_RESEARCH_SECTIONS = [
	"Abstract",
	"Keywords",
	"Study area",
	"Introduction",
	"Literature Review",
	"Methodology",
	"Results / Analysis",
	"Discussion",
	"Conclusion",
	"References",
] as const;

const SECTION_ALIASES: Record<string, (typeof STANDARD_RESEARCH_SECTIONS)[number] | string> = {
	abstract: "Abstract",
	summary: "Abstract",
	keywords: "Keywords",
	keyword: "Keywords",
	"key words": "Keywords",
	"study area": "Study area",
	"study areas": "Study area",
	discipline: "Study area",
	field: "Study area",
	introduction: "Introduction",
	intro: "Introduction",
	"1 introduction": "Introduction",
	"1. introduction": "Introduction",
	"literature review": "Literature Review",
	"related work": "Literature Review",
	"prior work": "Literature Review",
	"theoretical background": "Literature Review",
	methodology: "Methodology",
	methods: "Methods",
	method: "Methodology",
	"materials and methods": "Methodology",
	"materials & methods": "Methodology",
	results: "Results / Analysis",
	"results and discussion": "Results / Analysis",
	"results / analysis": "Results / Analysis",
	"results and analysis": "Results / Analysis",
	"empirical results": "Results / Analysis",
	"findings / results": "Findings / Results",
	findings: "Findings",
	discussion: "Discussion",
	"discussion and implications": "Discussion",
	conclusion: "Conclusion",
	conclusions: "Conclusion",
	"conclusion and future work": "Conclusion",
	references: "References",
	bibliography: "References",
	"works cited": "References",
	/** Preserve type-specific headings (do not collapse into IMRaD). */
	"critical analysis": "Critical Analysis",
	"critical discussion": "Critical Analysis",
	"analysis and discussion": "Critical Analysis",
	"executive summary": "Executive Summary",
	background: "Background",
	objectives: "Objectives",
	analysis: "Analysis",
	recommendations: "Recommendations",
	"problem statement": "Problem Statement",
	timeline: "Timeline",
	"expected outcomes": "Expected Outcomes",
	budget: "Budget",
	"theoretical framework": "Theoretical Framework",
	contributions: "Contributions",
	appendices: "Appendices",
	acknowledgments: "Acknowledgments",
	acknowledgements: "Acknowledgments",
	"title page": "Title Page",
	declaration: "Declaration",
	dedication: "Dedication",
	"table of contents": "Table of Contents",
	"list of tables": "List of Tables",
	"list of figures": "List of Figures",
	"chapter one: introduction": "Chapter One: Introduction",
	"chapter two: literature review": "Chapter Two: Literature Review",
	"chapter three: system analysis and methodology": "Chapter Three: System Analysis and Methodology",
	"chapter three: methodology": "Chapter Three: Methodology",
	"chapter four: system design and implementation": "Chapter Four: System Design and Implementation",
	"chapter four: design and implementation": "Chapter Four: Design and Implementation",
	"chapter five: testing and results": "Chapter Five: Testing and Results",
	"chapter five: results and evaluation": "Chapter Five: Results and Evaluation",
	"chapter six: discussion": "Chapter Six: Discussion",
	"chapter seven: conclusion and recommendations": "Chapter Seven: Conclusion and Recommendations",
};

export function canonicalizeSectionTitle(raw: string): string | null {
	const key = raw
		.replace(/^\d+\.?\s*/, "")
		.replace(/\*\*/g, "")
		.replace(/:+\s*$/g, "")
		.trim()
		.toLowerCase();
	if (!key) return null;
	return SECTION_ALIASES[key] ?? null;
}

const BOLD_SECTION_LINE = /^\*\*([^*\n]+)\*\*[^\S\n]*$/gm;
const BOLD_INLINE_META =
	/^\*\*(Keywords|Keyword|Key words|Study area|Study areas|Discipline|Field)\s*:?\s*\*\*\s*(.+)$/i;
const BOLD_INLINE_META_ALT =
	/^\*\*(Keywords|Keyword|Key words|Study area|Study areas|Discipline|Field)\*\*\s*:?\s*(.+)$/i;
const PLAIN_INLINE_META =
	/^(Keywords|Keyword|Key words|Study area|Study areas|Discipline|Field)\s*:\s*(.+)$/i;

/** Major IMRaD titles that may appear without bold after editor round-trips. */
const PLAIN_SECTION_TITLE =
	/^(Abstract|Summary|Executive summary|Keywords|Keyword|Key words|Study area|Study areas|Discipline|Field|Introduction|Literature Review|Related Work|Methodology|Methods|Results\s*\/\s*Analysis|Results and Analysis|Results|Discussion|Conclusion|Conclusions|References|Bibliography)\s*:?\s*$/i;

const PLAIN_SECTION_WITH_BODY =
	/^(Abstract|Summary|Executive summary|Introduction|Literature Review|Related Work|Methodology|Methods|Results\s*\/\s*Analysis|Results and Analysis|Discussion|Conclusion|Conclusions|References)\s*:\s+(.+)$/i;
/** `**Abstract:** body…` or `**Introduction** body…` — heading stuck to content. */
const BOLD_SECTION_WITH_BODY =
	/^\*\*([^*\n]+?)\*\*\s*:?\s+(.+)$/;

const SMALL_HEADING_WORDS =
	/^(and|or|of|the|in|to|for|a|an|on|vs\.?|via|with|within|into|from|by|as|at|per)$/i;

/**
 * True for bold spans that should become section / subsection headings
 * (IMRaD titles and Title-Case subsection labels), not mid-sentence emphasis.
 */
export function looksLikeBoldHeadingTitle(raw: string): boolean {
	const title = raw.replace(/:+\s*$/, "").trim();
	if (title.length < 3 || title.length > 120) return false;
	if (canonicalizeSectionTitle(title) || /^references$/i.test(title)) return true;
	if (!/^[A-ZÀ-Ö0-9]/.test(title)) return false;
	if (/\(\s*(?:19|20)\d{2}/.test(title)) return false;
	if (/[,;]/.test(title) && title.split(/\s+/).length > 8) return false;

	const words = title.split(/\s+/).filter(Boolean);
	if (words.length === 1) {
		return /^(Introduction|Conclusion|Conclusions|References|Methodology|Methods|Discussion|Abstract|Keywords|Findings|Analysis|Recommendations|Background|Objectives|Limitations|Appendix|Appendices)$/i.test(
			title,
		);
	}
	const headingLike = words.filter(
		(word) => /^[A-ZÀ-Ö0-9]/.test(word) || SMALL_HEADING_WORDS.test(word),
	).length;
	return headingLike >= Math.ceil(words.length * 0.6);
}

/**
 * Models often glue `**Subsection**` onto the previous paragraph or next body line.
 * Lift those bold titles onto their own lines so spacing / HTML conversion can treat them as headings.
 */
export function splitGluedBoldHeadings(content: string): string {
	const source = content.replace(/\r/g, "");
	const re = /\*\*([^*\n]{2,120}?)\*\*\s*:?/g;
	let result = "";
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = re.exec(source))) {
		const title = (match[1] ?? "").replace(/:+\s*$/, "").trim();
		if (!looksLikeBoldHeadingTitle(title)) continue;

		const before = source.slice(lastIndex, match.index);
		result += before.replace(/[ \t]+$/g, "");
		if (result && !/\n\n$/.test(result)) {
			if (!/\n$/.test(result)) result += "\n";
			result += "\n";
		}
		result += `**${title}**\n\n`;
		lastIndex = match.index + match[0].length;
		while (lastIndex < source.length && /[ \t]/.test(source[lastIndex]!)) lastIndex += 1;
		if (source[lastIndex] === "\n") {
			lastIndex += 1;
			if (source[lastIndex] === "\n") lastIndex += 1;
		}
	}

	result += source.slice(lastIndex);
	return result.replace(/\n{3,}/g, "\n\n").trim();
}

/** Journal-style keyword separators (middot), matching Springer-style papers. */
export function formatKeywordTerms(raw: string): string {
	return raw
		.replace(/\*+/g, "")
		.replace(/\s*[;|,]\s*/g, " · ")
		.replace(/\s+·\s+/g, " · ")
		.replace(/\s{2,}/g, " ")
		.replace(/^(?:Keywords|Keyword|Key words)\s*:?\s*/i, "")
		.trim();
}

/**
 * Split mixed front-matter lines such as:
 *   Keywords: a; b Study area: Physics
 *   **Keywords:** a; b **Study area:** Physics
 *   **Abstract:** paragraph on the same line
 * into separate bold headings + content lines.
 */
export function normalizeResearchFrontMatter(content: string): string {
	const lines = content.replace(/\r/g, "").split("\n");
	const out: string[] = [];

	const pushMeta = (label: string, value: string) => {
		const canonical = canonicalizeSectionTitle(label) ?? label;
		const cleaned = value.replace(/\*+/g, "").trim();
		if (!cleaned) {
			out.push(`**${canonical}**`);
			return;
		}
		if (canonical === "Keywords") {
			out.push(`**Keywords**`);
			out.push(formatKeywordTerms(cleaned));
			return;
		}
		out.push(`**${canonical}**`);
		out.push(cleaned);
	};

	const stripMetaPrefix = (raw: string, kind: "keywords" | "study") => {
		let t = raw.replace(/\*+/g, " ").replace(/\s+/g, " ").trim();
		if (kind === "keywords") {
			t = t.replace(/^(?:Keywords?|Key words)\s*:?\s*/i, "");
		} else {
			t = t.replace(/^(?:Study\s+area|Discipline|Field)\s*:?\s*/i, "");
		}
		return t.trim();
	};

	const splitMixedMeta = (text: string): boolean => {
		const plain = text.replace(/\*+/g, " ").replace(/\s+/g, " ").trim();
		const studyIdx = plain.search(/\bStudy\s+area\s*:/i);
		const discIdx = plain.search(/\b(?:Discipline|Field)\s*:/i);
		const kwIdx = plain.search(/\bKeywords?\s*:/i);
		const keyWordsIdx = plain.search(/\bKey\s+words\s*:/i);
		const kStart = kwIdx >= 0 ? kwIdx : keyWordsIdx;
		const studyStart = studyIdx >= 0 ? studyIdx : discIdx;

		if (kStart < 0 && studyStart < 0) return false;

		const before = (kStart >= 0 ? plain.slice(0, kStart) : plain.slice(0, studyStart)).trim();
		if (before) {
			const beforeSection = before.match(/^(Abstract|Summary|Executive summary)\s*:?\s*(.*)$/i);
			if (beforeSection) {
				pushMeta("Abstract", beforeSection[2] ?? "");
				out.push("");
			} else if (!/^(title|paper title)$/i.test(before)) {
				// Preserve orphan text before Keywords (often abstract body after a prior heading).
				out.push(before);
				out.push("");
			}
		}

		if (kStart >= 0 && studyStart > kStart) {
			pushMeta("Keywords", stripMetaPrefix(plain.slice(kStart, studyStart), "keywords"));
			out.push("");
			pushMeta("Study area", stripMetaPrefix(plain.slice(studyStart), "study"));
			return true;
		}

		if (kStart >= 0) {
			pushMeta("Keywords", stripMetaPrefix(plain.slice(kStart), "keywords"));
			return true;
		}

		pushMeta("Study area", stripMetaPrefix(plain.slice(studyStart), "study"));
		return true;
	};

	for (const rawLine of lines) {
		const line = rawLine.trimEnd();
		const trimmed = line.trim();
		if (!trimmed) {
			out.push("");
			continue;
		}

		const boldOnly = trimmed.match(/^\*\*([^*\n]+?)\*\*\s*:?\s*$/);
		if (boldOnly) {
			const canonical = canonicalizeSectionTitle(boldOnly[1] ?? "");
			out.push(canonical ? `**${canonical}**` : trimmed);
			continue;
		}

		const boldInline = trimmed.match(BOLD_INLINE_META) ?? trimmed.match(BOLD_INLINE_META_ALT);
		if (boldInline) {
			const rest = boldInline[2] ?? "";
			if (/\bStudy\s+area\s*:/i.test(rest) || /\b(?:Discipline|Field)\s*:/i.test(rest)) {
				splitMixedMeta(`${boldInline[1]}: ${rest}`);
			} else {
				pushMeta(boldInline[1] ?? "", rest);
			}
			continue;
		}

		const boldWithBody = trimmed.match(BOLD_SECTION_WITH_BODY);
		if (boldWithBody) {
			const title = boldWithBody[1] ?? "";
			const rest = (boldWithBody[2] ?? "").trim();
			const canonical = canonicalizeSectionTitle(title);
			const plainRest = rest.replace(/\*+/g, " ");
			if (
				canonical === "Keywords" ||
				canonical === "Study area" ||
				/\bKeywords?\s*:/i.test(plainRest) ||
				/\bStudy\s+area\s*:/i.test(plainRest)
			) {
				if (canonical && canonical !== "Keywords" && canonical !== "Study area") {
					out.push(`**${canonical}**`);
					if (
						!/^\s*(?:Keywords?|Key words|Study\s+area)\s*:/i.test(plainRest) &&
						!splitMixedMeta(rest)
					) {
						out.push(rest.replace(/\*+/g, "").trim());
					} else {
						splitMixedMeta(
							/^\s*(?:Keywords?|Key words|Study\s+area)\s*:/i.test(plainRest)
								? rest
								: `${canonical}: ${rest}`,
						);
					}
				} else if (!splitMixedMeta(trimmed) && !splitMixedMeta(`${title}: ${rest}`)) {
					pushMeta(title, rest);
				}
				continue;
			}
			if (canonical) {
				out.push(`**${canonical}**`);
				out.push(rest.replace(/\*+/g, "").trim());
				continue;
			}
		}

		if (
			PLAIN_INLINE_META.test(trimmed) ||
			/\bKeywords?\s*:/i.test(trimmed.replace(/\*/g, "")) ||
			/\bStudy\s+area\s*:/i.test(trimmed.replace(/\*/g, ""))
		) {
			if (splitMixedMeta(trimmed)) continue;
		}

		// Plain "Abstract" / "Abstract:" (editor round-trip often drops **bold**).
		const plainAlone = trimmed.match(PLAIN_SECTION_TITLE);
		if (plainAlone) {
			const canonical = canonicalizeSectionTitle(plainAlone[1] ?? "");
			if (canonical) {
				out.push(`**${canonical}**`);
				continue;
			}
		}

		// Plain "Abstract: body…" on one line.
		const plainWithBody = trimmed.match(PLAIN_SECTION_WITH_BODY);
		if (plainWithBody) {
			const canonical = canonicalizeSectionTitle(plainWithBody[1] ?? "");
			if (canonical) {
				out.push(`**${canonical}**`);
				out.push((plainWithBody[2] ?? "").replace(/\*+/g, "").trim());
				continue;
			}
		}

		out.push(line);
	}

	return out
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

const BOLD_SECTION_OR_COLON = /^\*\*([^*\n]+?)\*\*[^\S\n]*:?[^\S\n]*$/gm;

/**
 * Ensure blank lines around section / subsection headings so markdown/HTML parsers
 * do not merge `**Abstract**` / `**Themes**` / `## Abstract` with neighboring body text.
 * Also collapses consecutive duplicate IMRaD headings (e.g. Methodology + Methods → one Methodology).
 */
export function ensureResearchSectionSpacing(content: string): string {
	const lines = content.replace(/\r/g, "").split("\n");
	const out: string[] = [];

	const headingCanonical = (headingLine: string): string | null => {
		const bold = headingLine.match(/^\*\*([^*\n]+?)\*\*[^\S\n]*:?[^\S\n]*$/);
		const hash = headingLine.match(/^#{1,6}\s+(.+?)\s*$/);
		const plain = !bold && !hash ? headingLine.match(PLAIN_SECTION_TITLE) : null;
		const rawTitle = (bold?.[1] ?? hash?.[1] ?? plain?.[1] ?? "").replace(/:+\s*$/, "").trim();
		if (!rawTitle) return null;
		const canonical = canonicalizeSectionTitle(rawTitle);
		if (canonical && (STANDARD_RESEARCH_SECTIONS as readonly string[]).includes(canonical)) {
			return canonical;
		}
		if (/^references$/i.test(rawTitle)) return "References";
		return null;
	};

	const lastNonEmpty = (): string | null => {
		for (let i = out.length - 1; i >= 0; i -= 1) {
			const t = out[i]!.trim();
			if (t) return t;
		}
		return null;
	};

	const isHeadingLine = (trimmed: string): string | null => {
		const bold = trimmed.match(/^\*\*([^*\n]+?)\*\*[^\S\n]*:?[^\S\n]*$/);
		const hash = trimmed.match(/^#{1,6}\s+(.+?)\s*$/);
		const plain = !bold && !hash ? trimmed.match(PLAIN_SECTION_TITLE) : null;
		const rawTitle = (bold?.[1] ?? hash?.[1] ?? plain?.[1] ?? "").replace(/:+\s*$/, "").trim();
		if (!rawTitle || rawTitle.length > 80) return null;

		const hashPrefix = hash?.[0]?.match(/^#{1,6}/)?.[0];
		const canonical = canonicalizeSectionTitle(rawTitle);
		if (canonical && (STANDARD_RESEARCH_SECTIONS as readonly string[]).includes(canonical)) {
			if (bold || plain) return `**${canonical}**`;
			return `${hashPrefix} ${canonical}`;
		}
		if (/^references$/i.test(rawTitle)) {
			if (bold || plain) return "**References**";
			return `${hashPrefix} References`;
		}

		// Bold-only / hash subsection titles (Themes, Framework, Gap, Research design, …).
		if (bold) return `**${rawTitle}**`;
		if (hashPrefix) return `${hashPrefix} ${rawTitle}`;
		return null;
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!;
		const trimmed = line.trim();
		const headingLine = isHeadingLine(trimmed);

		if (headingLine) {
			const canonical = headingCanonical(headingLine);
			const prev = lastNonEmpty();
			if (canonical && prev && headingCanonical(prev) === canonical) {
				/** Drop duplicate IMRaD heading (e.g. **Methodology** then **Methods**). */
				continue;
			}
			if (out.length > 0 && out[out.length - 1]!.trim() !== "") {
				out.push("");
			}
			out.push(headingLine);
			const next = lines[i + 1];
			if (next !== undefined && next.trim() !== "") {
				out.push("");
			}
			continue;
		}

		out.push(line);
	}

	return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Map alternate section labels to standard IMRaD headings. */
export function standardizeResearchSectionHeadings(content: string): string {
	const withFrontMatter = normalizeResearchFrontMatter(content);
	const canonicalized = withFrontMatter.replace(BOLD_SECTION_OR_COLON, (line, title: string) => {
		const canonical = canonicalizeSectionTitle(title);
		return canonical ? `**${canonical}**` : line;
	});
	return ensureResearchSectionSpacing(canonicalized);
}

const HAS_SECTION = (name: string) =>
	new RegExp(`^\\*\\*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\*\\*\\s*$`, "im");

export function paperHasSection(content: string, section: string): boolean {
	return HAS_SECTION(section).test(content);
}

/** Strip arXiv metadata without collapsing paragraph breaks between sections. */
export function stripArxivMetaPreserveLayout(text: string): string {
	return text
		.split("\n")
		.map((line) =>
			line
				.replace(/\barXiv preprint\b[^.\n]*\.?/gi, "")
				.replace(/\barXiv e-?print\b[^.\n]*\.?/gi, "")
				.replace(/\barXiv:\s*[\d.]+[a-z]?\b/gi, "")
				.replace(/\(\s*arXiv:[^)]+\)/gi, "")
				.replace(/,\s*arXiv:[^.\n]*/gi, "")
				.replace(/\bAvailable at arXiv\b[^.\n]*\.?/gi, "")
				.replace(/\bRetrieved from arXiv\b[^.\n]*\.?/gi, "")
				.replace(/\bfrom arXiv\b[^.\n]*\.?/gi, "")
				.replace(/(?<!\]\()https?:\/\/(?:www\.)?arxiv\.org\/[^\s)\],]+/gi, "")
				.replace(/\s*,\s*(?=\.)/g, "")
				.replace(/[ \t]{2,}/g, " ")
				.replace(/\.\s*\./g, ".")
				.replace(/\s+\./g, ".")
				.trim(),
		)
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

export function sectionHeadingId(heading: string): string {
	return `paper-section-${heading
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")}`;
}

const RESEARCH_VISUAL_FENCE =
	/```(?:research-chart|research-image|research-figure)\b[\s\S]*?```/gi;

/**
 * Strips duplicate or redundant paper title lines appearing at the very top of
 * the manuscript before the Abstract (or first canonical section).
 */
export function stripTitleAboveAbstract(content: string, fallbackTitle?: string): string {
	if (!content || !content.trim()) return "";

	const lines = content.replace(/\r/g, "").split("\n");
	let firstSectionIndex = -1;

	// Find the index of the first canonical section heading (e.g. Abstract, Introduction, Chapter One, etc.)
	for (let i = 0; i < lines.length; i++) {
		const trimmed = lines[i]!.trim();
		if (!trimmed) continue;

		const boldMatch = trimmed.match(/^\*\*([^*\n]+?)\*\*\s*:?\s*$/);
		const hashMatch = trimmed.match(/^#{1,6}\s+(.+?)\s*$/);
		const plainMatch = trimmed.match(
			/^(Abstract|Summary|Executive summary|Keywords|Study area|Introduction|Chapter One|Literature Review|Methodology|Methods|Results|Discussion|Conclusion|References)\b/i,
		);

		const candidate = (
			boldMatch?.[1] ??
			hashMatch?.[1] ??
			(plainMatch ? plainMatch[0] : "")
		)
			.replace(/:+\s*$/, "")
			.trim();
		if (candidate) {
			const canonical = canonicalizeSectionTitle(candidate);
			if (
				canonical ||
				/^abstract$/i.test(candidate) ||
				/^introduction$/i.test(candidate) ||
				/^chapter\s+one/i.test(candidate) ||
				/^executive\s+summary/i.test(candidate) ||
				/^summary$/i.test(candidate)
			) {
				firstSectionIndex = i;
				break;
			}
		}
	}

	if (firstSectionIndex >= 0) {
		const beforeLines = lines.slice(0, firstSectionIndex);
		const afterLines = lines.slice(firstSectionIndex);

		// Keep any visual fences or comments that might be before the section
		const preservedBefore = beforeLines.filter((l) => {
			const t = l.trim();
			return t.startsWith("@@RESEARCH_VISUAL_") || t.startsWith("```");
		});

		return [...preservedBefore, ...afterLines].join("\n").replace(/\n{3,}/g, "\n\n").trim();
	}

	// If no canonical section was found yet (e.g. during live streaming when only title has arrived)
	const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);
	if (nonEmpty.length <= 2) {
		const first = nonEmpty[0] ?? "";
		const cleanFirst = first.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim();
		const isTitleLike =
			first.startsWith("#") ||
			first.startsWith("**") ||
			(fallbackTitle &&
				cleanFirst.toLowerCase().includes(fallbackTitle.toLowerCase().slice(0, 20)));
		if (isTitleLike) {
			return "";
		}
	}

	return content;
}

/** Use markdown headings in the UI so Abstract, Introduction, etc. are easy to spot without duplicate title. */
export function promoteBoldSectionsForDisplay(content: string): string {
	const fences: string[] = [];
	const withoutVisuals = content.replace(RESEARCH_VISUAL_FENCE, (match) => {
		fences.push(match.trim());
		return `\n\n@@RESEARCH_VISUAL_${fences.length - 1}@@\n\n`;
	});
	const withoutTitle = stripTitleAboveAbstract(withoutVisuals);
	const split = splitGluedBoldHeadings(withoutTitle);
	const normalized = standardizeResearchSectionHeadings(split);
	const stripped = stripTitleAboveAbstract(normalized);
	let sawCanonicalSection = false;
	const promoted = stripped.replace(BOLD_SECTION_LINE, (line, title: string) => {
		const canonical = canonicalizeSectionTitle(title);
		if (canonical) {
			sawCanonicalSection = true;
			return `## ${canonical}`;
		}
		const trimmed = title.trim();
		if (/^references$/i.test(trimmed)) {
			sawCanonicalSection = true;
			return "## References";
		}
		// Subsections after the first section become ### Subsection
		if (looksLikeBoldHeadingTitle(trimmed)) {
			return sawCanonicalSection ? `### ${trimmed}` : "";
		}
		return line;
	});
	const spaced = ensureResearchSectionSpacing(promoted);
	return spaced
		.replace(/@@RESEARCH_VISUAL_(\d+)@@/g, (_m, index: string) => fences[Number(index)] ?? "")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}
