import type { ResearchScope } from "@/lib/research-ideas";
import { normalizeResearchScope } from "@/lib/research-ideas";
import { getScopeProfile } from "@/lib/research-scope-profiles";

export type VisualBucket =
	| "results"
	| "methods"
	| "introduction"
	| "literatureReview"
	| "theoreticalFramework"
	| "design"
	| "findings"
	| "methodologyPlanned";

const REFERENCES_HEADING = /^(?:#{1,3}\s+|\*\*)References(?:\*\*)?\s*$/im;
const NEXT_SECTION_HEADING = /^(?:#{1,3}\s+|\*\*)[A-Za-z][^*\n]*?(?:\*\*)?\s*$/m;

/** Heading patterns used to locate insertion points in a live/saved draft. */
const BUCKET_HEADINGS: Record<VisualBucket, RegExp> = {
	results:
		/^(?:#{1,3}\s+|\*\*)(?:(?:Chapter\s+(?:Five|5)[:\s]+)?(?:Testing\s+and\s+)?Results?|Findings(?:\s*\/\s*Results)?|Results(?:\s*(?:\/|and)\s*Analysis)?)\b(?:\*\*)?.*$/im,
	findings: /^(?:#{1,3}\s+|\*\*)Findings\b(?:\*\*)?.*$/im,
	methods:
		/^(?:#{1,3}\s+|\*\*)(?:(?:Chapter\s+(?:Three|3)[:\s]+)?(?:System\s+Analysis\s+and\s+)?Methodology|Methods)\b(?:\*\*)?.*$/im,
	methodologyPlanned:
		/^(?:#{1,3}\s+|\*\*)(?:Methodology|Methods)\b(?:\*\*)?.*$/im,
	introduction: /^(?:#{1,3}\s+|\*\*)(?:(?:Chapter\s+(?:One|1)[:\s]+)?Introduction)\b(?:\*\*)?.*$/im,
	literatureReview:
		/^(?:#{1,3}\s+|\*\*)(?:(?:Chapter\s+(?:Two|2)[:\s]+)?Literature\s+Review|Background)\b(?:\*\*)?.*$/im,
	theoreticalFramework:
		/^(?:#{1,3}\s+|\*\*)Theoretical\s+Framework\b(?:\*\*)?.*$/im,
	design:
		/^(?:#{1,3}\s+|\*\*)(?:Chapter\s+(?:Four|4)[:\s]+)?(?:System\s+)?Design(?:\s+and\s+Implementation)?\b(?:\*\*)?.*$/im,
};

export type VisualPlacementRules = {
	/** Primary section for notebook images / dataset charts / tables. */
	empiricalBucket: VisualBucket;
	/** Section for conceptual research-image diagrams. */
	conceptualBucket: VisualBucket;
	/** Section for protocol / instrument / sampling tables. */
	protocolBucket: VisualBucket;
	/** Section for literature synthesis tables (no dataset). */
	synthesisBucket: VisualBucket;
	/** Human-readable section titles for prompt instructions. */
	labels: {
		empirical: string;
		conceptual: string;
		protocol: string;
		synthesis: string;
	};
	/** Prompt lines describing where to place each visual type. */
	promptLines: string[];
	/** One-line sectionJobs rule for the scope profile. */
	sectionJob: string;
};

function resolveScope(scope: string | null | undefined): ResearchScope {
	return normalizeResearchScope(scope) || "journal";
}

/** Resolve where each visual type belongs for a deliverable scope. */
export function getVisualPlacementRules(scope: string | null | undefined): VisualPlacementRules {
	const key = resolveScope(scope);
	const profile = getScopeProfile(key);
	const empiricalHeading =
		profile.headings.find((h) => /result|finding|testing/i.test(h)) ??
		(key === "proposal" || key === "faculty" ? "Methodology" : "Results");
	const methodsHeading =
		profile.headings.find((h) => /method/i.test(h)) ?? "Methods";
	const litHeading =
		profile.headings.find((h) => /literature|background/i.test(h)) ?? "Literature Review";

	switch (key) {
		case "journal":
		case "conference":
			return {
				empiricalBucket: "results",
				conceptualBucket: "introduction",
				protocolBucket: "methods",
				synthesisBucket: "introduction",
				labels: {
					empirical: "Results",
					conceptual: "Introduction",
					protocol: "Methods",
					synthesis: "Introduction",
				},
				promptLines: [
					"Place empirical tables, charts, and notebook figures in **Results**; discuss each by number in prose.",
					"Place study-design, sampling, instrument, and protocol tables in **Methods** (no findings).",
					"Place conceptual framework diagrams (`research-image`) in **Introduction** (or Methods if purely methodological).",
					"Place literature-synthesis tables (no dataset) in **Introduction** or **Discussion**, labelled Illustrative.",
					"Discussion interprets Results visuals only — do not re-insert raw charts. Never place visuals in Abstract, Conclusion, Acknowledgments, or References.",
				],
				sectionJob:
					"Place empirical tables/charts/figures in **Results**; study design and protocol tables in **Methods**; conceptual models in **Introduction**; never after References.",
			};
		case "dissertation":
			return {
				empiricalBucket: "results",
				conceptualBucket: "theoreticalFramework",
				protocolBucket: "methods",
				synthesisBucket: "literatureReview",
				labels: {
					empirical: "Results",
					conceptual: "Theoretical Framework",
					protocol: "Methodology",
					synthesis: "Literature Review",
				},
				promptLines: [
					"Place empirical tables, charts, and notebook figures in **Results**; discuss each by number in prose.",
					"Place protocol, sampling, and instrument tables in **Methodology** (no findings).",
					"Place conceptual framework diagrams (`research-image`) in **Theoretical Framework** (fallback Literature Review).",
					"Place thematic literature-synthesis tables in **Literature Review**, labelled Illustrative.",
					"Discussion interprets Results visuals only. Never place visuals after References.",
				],
				sectionJob:
					"Place empirical tables/charts/figures in **Results**; conceptual models in **Theoretical Framework**; synthesis tables in **Literature Review**; never after References.",
			};
		case "thesis":
			return {
				empiricalBucket: "results",
				conceptualBucket: "literatureReview",
				protocolBucket: "methods",
				synthesisBucket: "literatureReview",
				labels: {
					empirical: "Findings / Results",
					conceptual: "Literature Review",
					protocol: "Methodology",
					synthesis: "Literature Review",
				},
				promptLines: [
					"Place empirical tables, charts, and notebook figures in **Findings / Results**; discuss each by number in prose.",
					"Place protocol, sampling, and instrument tables in **Methodology** (no findings).",
					"Place conceptual framework diagrams (`research-image`) in **Literature Review** or **Introduction** (this deliverable has no Theoretical Framework chapter).",
					"Place thematic literature-synthesis tables in **Literature Review**, labelled Illustrative.",
					"Discussion interprets Findings visuals only. Never place visuals after References.",
				],
				sectionJob:
					"Place empirical tables/charts/figures in **Findings / Results**; conceptual models and synthesis tables in **Literature Review**; protocol tables in **Methodology**; never after References.",
			};
		case "undergraduate_project":
			return {
				empiricalBucket: "results",
				conceptualBucket: "design",
				protocolBucket: "methods",
				synthesisBucket: "literatureReview",
				labels: {
					empirical: "Chapter Five: Testing and Results",
					conceptual: "Chapter Four: System Design and Implementation",
					protocol: "Chapter Three: System Analysis and Methodology",
					synthesis: "Chapter Two: Literature Review",
				},
				promptLines: [
					"Place empirical test-output tables, charts, and notebook figures in **Chapter Five: Testing and Results**.",
					"Place requirements, analysis, and sampling tables in **Chapter Three: System Analysis and Methodology**.",
					"Place UI mockups, architecture, and system-design diagrams (`research-image`) in **Chapter Four: System Design and Implementation**.",
					"Place literature-synthesis tables in **Chapter Two: Literature Review**, labelled Illustrative.",
					"Never place visuals after References.",
				],
				sectionJob:
					"Place empirical visuals in **Chapter Five: Testing and Results**; design diagrams in **Chapter Four**; protocol/analysis tables in **Chapter Three**; synthesis tables in **Chapter Two**; never after References.",
			};
		case "report":
			return {
				empiricalBucket: "findings",
				conceptualBucket: "literatureReview",
				protocolBucket: "methods",
				synthesisBucket: "literatureReview",
				labels: {
					empirical: "Findings",
					conceptual: "Background",
					protocol: "Methods",
					synthesis: "Background",
				},
				promptLines: [
					"Place empirical tables, charts, and notebook figures in **Findings**.",
					"Place methods and data-collection tables in **Methods**.",
					"Place background synthesis tables and conceptual diagrams in **Background**, labelled Illustrative.",
					"Analysis may interpret Findings visuals — do not duplicate raw charts. Never place visuals after References.",
				],
				sectionJob:
					"Place empirical tables/charts/figures in **Findings**; methods tables in **Methods**; synthesis tables in **Background**; never after References.",
			};
		case "proposal":
		case "faculty":
			return {
				empiricalBucket: "methodologyPlanned",
				conceptualBucket: "literatureReview",
				protocolBucket: "methodologyPlanned",
				synthesisBucket: "literatureReview",
				labels: {
					empirical: "Methodology",
					conceptual: litHeading,
					protocol: methodsHeading,
					synthesis: litHeading,
				},
				promptLines: [
					"This deliverable has no Results/Findings section — do not invent completed empirical results.",
					`Place planned study-design, protocol, and instrument tables in **${methodsHeading}**.`,
					`If notebook charts/tables are supplied, treat them as planned instruments in **${methodsHeading}** and label them Illustrative/planned — never as observed findings.`,
					`Place literature-synthesis tables and conceptual diagrams in **${litHeading}**.`,
					"Never place visuals after References.",
				],
				sectionJob:
					"Place planned protocol/instrument tables in **Methodology**; synthesis tables and conceptual models in **Literature Review**; never invent Results or place visuals after References.",
			};
		case "assignment":
		default:
			return {
				empiricalBucket: "results",
				conceptualBucket: "literatureReview",
				protocolBucket: "methods",
				synthesisBucket: "literatureReview",
				labels: {
					empirical: empiricalHeading,
					conceptual: "Critical Analysis",
					protocol: "Methods",
					synthesis: "Literature Review",
				},
				promptLines: [
					"Assignment visuals are brief-driven. Prefer prose over charts.",
					"Optional: one short literature-synthesis table in Literature Review or Critical Analysis if it clarifies themes, labelled Illustrative.",
					"Do not invent empirical findings charts unless the brief explicitly requires Methods/Results.",
					"Never place visuals after References.",
				],
				sectionJob:
					"Prefer prose; place any illustrative synthesis tables in **Literature Review** or **Critical Analysis**; never invent empirical Results unless the brief requires them.",
			};
	}
}

/** Insert `block` inside the matched section (before the next major heading). */
export function insertIntoSection(
	content: string,
	block: string,
	headingPattern: RegExp,
): string | null {
	const trimmed = block.trim();
	if (!trimmed) return content;
	const body = content.trimEnd();
	const match = headingPattern.exec(body);
	if (!match || match.index == null) return null;
	const afterStart = match.index + match[0].length;
	const rest = body.slice(afterStart);
	const nextHeading = rest.search(NEXT_SECTION_HEADING);
	if (nextHeading >= 0) {
		const insertAt = afterStart + nextHeading;
		return `${body.slice(0, insertAt).trimEnd()}\n\n${trimmed}\n\n${body.slice(insertAt)}`;
	}
	return `${body.slice(0, afterStart).trimEnd()}\n\n${trimmed}\n`;
}

/** Prefer target section; fall back through alternates; never after References. */
export function insertVisualBlock(
	content: string,
	block: string,
	bucket: VisualBucket,
	fallbacks: VisualBucket[] = [],
): string {
	const trimmed = block.trim();
	if (!trimmed) return content;
	const order = [bucket, ...fallbacks];
	for (const key of order) {
		const pattern = BUCKET_HEADINGS[key];
		const next = insertIntoSection(content, trimmed, pattern);
		if (next != null) return next;
	}
	const body = content.trimEnd();
	const refs = REFERENCES_HEADING.exec(body);
	if (refs && refs.index != null) {
		return `${body.slice(0, refs.index).trimEnd()}\n\n${trimmed}\n\n${body.slice(refs.index)}`;
	}
	return `${body}\n\n${trimmed}\n`;
}

export type RoutedVisualBlocks = {
	empirical: string;
	conceptual: string;
	protocol: string;
	synthesis: string;
};

const RESEARCH_FIGURE_FENCE = /```research-figure\b[\s\S]*?```/gi;
const RESEARCH_CHART_FENCE = /```research-chart\b[\s\S]*?```/gi;
const RESEARCH_IMAGE_FENCE = /```research-image\b[\s\S]*?```/gi;
const PROTOCOL_HINT =
	/\b(prisma|selection[- ]flow|extraction table|protocol|sampling frame|instrument|questionnaire)\b/i;

/**
 * Split visual markdown into placement buckets.
 * Empirical notebook figures/charts/tables → results (or planned methodology for proposals).
 * Conceptual research-image → conceptual bucket.
 * Protocol-tagged tables → methods.
 */
export function routeVisualBlocks(visualMarkdown: string): RoutedVisualBlocks {
	const text = visualMarkdown.trim();
	if (!text) {
		return { empirical: "", conceptual: "", protocol: "", synthesis: "" };
	}

	const figures = (text.match(RESEARCH_FIGURE_FENCE) ?? []).map((m) => m.trim());
	const charts = (text.match(RESEARCH_CHART_FENCE) ?? []).map((m) => m.trim());
	const images = (text.match(RESEARCH_IMAGE_FENCE) ?? []).map((m) => m.trim());

	let remainder = text
		.replace(RESEARCH_FIGURE_FENCE, "")
		.replace(RESEARCH_CHART_FENCE, "")
		.replace(RESEARCH_IMAGE_FENCE, "")
		.replace(/\n{3,}/g, "\n\n")
		.trim();

	const protocolParts: string[] = [];
	const empiricalParts: string[] = [...figures, ...charts];
	const synthesisParts: string[] = [];

	// Chunk remaining markdown (tables / titled sections) by double newlines.
	const chunks = remainder
		.split(/\n{2,}/)
		.map((c) => c.trim())
		.filter(Boolean);
	for (const chunk of chunks) {
		if (PROTOCOL_HINT.test(chunk)) {
			protocolParts.push(chunk);
		} else if (/^\|/.test(chunk) || /^###\s+/m.test(chunk) || /\*\*Table\*\*/i.test(chunk)) {
			empiricalParts.push(chunk);
		} else if (chunk.length > 40) {
			synthesisParts.push(chunk);
		} else {
			empiricalParts.push(chunk);
		}
	}

	return {
		empirical: empiricalParts.join("\n\n").trim(),
		conceptual: images.join("\n\n").trim(),
		protocol: protocolParts.join("\n\n").trim(),
		synthesis: synthesisParts.join("\n\n").trim(),
	};
}

/** Inject routed visual blocks into draft content using scope placement rules. */
export function injectRoutedVisuals(
	content: string,
	scope: string | null | undefined,
	visualMarkdown: string,
): string {
	const blocks = visualMarkdown.trim();
	if (!blocks || !content.trim()) return content;

	const rules = getVisualPlacementRules(scope);
	const routed = routeVisualBlocks(blocks);
	let next = content;

	const draftHasFigure = /```research-figure\b/i.test(next);
	const draftHasChart = /```research-chart\b/i.test(next);
	const draftHasImage = /```research-image\b/i.test(next);

	// If the model already streamed charts/figures, only backfill missing notebook images.
	if (draftHasChart || draftHasFigure || draftHasImage) {
		const figureOnly = (blocks.match(RESEARCH_FIGURE_FENCE) ?? []).join("\n\n").trim();
		if (figureOnly && !draftHasFigure) {
			return insertVisualBlock(next, figureOnly, rules.empiricalBucket, ["results", "findings", "methods"]);
		}
		return content;
	}

	if (routed.protocol) {
		next = insertVisualBlock(next, routed.protocol, rules.protocolBucket, ["methods", "methodologyPlanned"]);
	}
	if (routed.conceptual) {
		next = insertVisualBlock(next, routed.conceptual, rules.conceptualBucket, [
			"theoreticalFramework",
			"literatureReview",
			"introduction",
			"design",
		]);
	}
	if (routed.synthesis && !routed.empirical) {
		next = insertVisualBlock(next, routed.synthesis, rules.synthesisBucket, [
			"literatureReview",
			"introduction",
		]);
	}
	if (routed.empirical) {
		const label = `### Notebook evidence visuals\n\n${routed.empirical}`;
		next = insertVisualBlock(next, label, rules.empiricalBucket, [
			"results",
			"findings",
			"methodologyPlanned",
			"methods",
		]);
	}

	return next;
}
