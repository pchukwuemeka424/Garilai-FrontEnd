import { fetchDocumentFile, fetchDocuments } from "@/lib/research-assets-api";
import { limitTableRowsInMarkdown } from "@/lib/research-paper-references";
import { injectRoutedVisuals } from "@/lib/research-visual-placement";

const MAX_PAPER_FIGURES = 8;
const MAX_FIGURE_DATA_URL_CHARS = 1_500_000;

function isImageFile(fileName: string, mime: string): boolean {
	if ((mime ?? "").toLowerCase().startsWith("image/")) return true;
	return /\.(jpe?g|png|gif|webp|bmp)$/i.test(fileName ?? "");
}

function figureMime(fileName: string, mime: string): string {
	const trimmed = (mime ?? "").trim().toLowerCase();
	if (trimmed.startsWith("image/")) return trimmed === "image/jpg" ? "image/jpeg" : trimmed;
	const lower = (fileName ?? "").toLowerCase();
	if (lower.endsWith(".png")) return "image/png";
	if (lower.endsWith(".gif")) return "image/gif";
	if (lower.endsWith(".webp")) return "image/webp";
	if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
	return "image/png";
}

function buildResearchFigureBlock(input: {
	index: number;
	title: string;
	fileName?: string;
	mime: string;
	dataUrl: string;
}): string {
	const label = input.title.trim() || input.fileName?.trim() || "Research figure";
	const title = /^figure\s+\d+/i.test(label) ? label : `Figure ${input.index}: ${label}`;
	const caption = input.fileName?.trim()
		? `From notebook file “${input.fileName.trim()}”.`
		: "From research notebook.";
	const payload = {
		type: "research-figure",
		title,
		caption,
		mime: figureMime(input.fileName ?? "", input.mime),
		dataUrl: input.dataUrl.trim(),
	};
	return ["```research-figure", JSON.stringify(payload), "```"].join("\n");
}

/** Pull canonical tables + research-chart fences from visualization artifacts for live draft. */
export function extractLiveVisualizationMarkdown(artifacts: string): string {
	const text = artifacts.trim();
	if (!text) return "";

	// Drop the figure catalog (pixels are injected separately as research-figure blocks).
	const withoutCatalog = text
		.replace(/###\s*Saved notebook figures[\s\S]*?(?=###\s|\s*$)/i, "")
		.trim();

	const parts: string[] = [];

	const sectionRe = /###\s*Dataset figure:\s*([^\n]+)\n([\s\S]*?)(?=###\s*Dataset figure:|\s*$)/gi;
	let matchedSection = false;
	for (const match of withoutCatalog.matchAll(sectionRe)) {
		matchedSection = true;
		const title = (match[1] ?? "Dataset").trim();
		const body = match[2] ?? "";
		const tableMatch = body.match(/\|.+\|\s*\n\|[-:| ]+\|\s*\n(?:\|.+\|\s*\n?)*/);
		const chartMatch = body.match(/```research-chart\s*[\s\S]*?```/i);
		const chunk: string[] = [`### ${title}`];
		if (tableMatch?.[0]) {
			chunk.push("", "**Table**", "", limitTableRowsInMarkdown(tableMatch[0].trim(), 10));
		}
		if (chartMatch?.[0]) {
			chunk.push("", chartMatch[0].trim());
		}
		if (chunk.length > 1) parts.push(chunk.join("\n"));
	}

	if (!matchedSection) {
		for (const match of withoutCatalog.matchAll(/```research-chart\s*[\s\S]*?```/gi)) {
			parts.push(match[0]);
		}
		for (const match of withoutCatalog.matchAll(/\|.+\|\s*\n\|[-:| ]+\|\s*\n(?:\|.+\|\s*\n?)*/g)) {
			parts.push(limitTableRowsInMarkdown(match[0].trim(), 10));
		}
	}

	return limitTableRowsInMarkdown(parts.join("\n\n").trim(), 10);
}

/**
 * Insert live visuals into the draft using scope-aware section placement
 * (Results / Findings / Ch 5 / Methodology, etc.).
 */
export function injectLiveVisualsIntoDraft(
	content: string,
	visualMarkdown: string,
	scope?: string | null,
): string {
	return injectRoutedVisuals(content, scope, visualMarkdown);
}

/** @deprecated Use injectLiveVisualsIntoDraft */
export function injectSavedFiguresIntoDraft(
	content: string,
	figureMarkdown: string,
	scope?: string | null,
): string {
	return injectLiveVisualsIntoDraft(content, figureMarkdown, scope);
}

/** Load notebook/image documents as research-figure markdown for live preview. */
export async function loadLiveFigureMarkdown(
	figureDocumentIds: string[],
	options?: { signal?: AbortSignal },
): Promise<string> {
	const ids = figureDocumentIds
		.map((id) => id.trim())
		.filter((id, index, all) => Boolean(id) && all.indexOf(id) === index)
		.slice(0, MAX_PAPER_FIGURES);
	if (!ids.length) return "";

	const docsById = new Map<string, { id: string; title: string; fileName: string; fileMime: string }>();
	try {
		const docs = await fetchDocuments();
		for (const doc of docs) {
			if (ids.includes(doc.id)) {
				docsById.set(doc.id, {
					id: doc.id,
					title: doc.title,
					fileName: doc.fileName,
					fileMime: doc.fileMime,
				});
			}
		}
	} catch {
		/* Fall through and try file endpoints by id alone. */
	}

	const blocks: string[] = [];
	let index = 0;
	for (const id of ids) {
		if (options?.signal?.aborted) break;
		const meta = docsById.get(id);
		if (meta && !isImageFile(meta.fileName, meta.fileMime)) continue;
		try {
			const file = await fetchDocumentFile(id);
			if (!file?.data) continue;
			const mime = figureMime(file.name || meta?.fileName || "", file.mime || meta?.fileMime || "");
			const dataUrl = file.data.startsWith("data:image/")
				? file.data
				: file.data.startsWith("data:")
					? file.data.replace(/^data:[^;,]*/, `data:${mime}`)
					: `data:${mime};base64,${file.data}`;
			if (!dataUrl.startsWith("data:image/") || dataUrl.length > MAX_FIGURE_DATA_URL_CHARS) continue;
			index += 1;
			blocks.push(
				buildResearchFigureBlock({
					index,
					title: (meta?.title ?? "").trim() || file.name || meta?.fileName || `Figure ${index}`,
					fileName: file.name || meta?.fileName,
					mime: file.mime || meta?.fileMime || mime,
					dataUrl,
				}),
			);
		} catch {
			/* Skip unloadable figures. */
		}
	}
	return blocks.join("\n\n");
}
