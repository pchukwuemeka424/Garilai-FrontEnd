import {
	fetchDatasetFile,
	fetchDocumentFile,
	fetchWorkspace,
	type ResearchDataset,
	type ResearchDocument,
	type ResearchWorkspace,
} from "@/lib/research-assets-api";
import { emptyNotebookData, isImageDocument } from "@/lib/research-notebook";

const MAX_IMAGES = 8;
const MAX_DATASET_ROWS = 10;
const MAX_DATASET_COLS = 10;
const MAX_DATASET_CHARS = 80_000;

export type NotebookBriefDatasetPreview = {
	id: string;
	title: string;
	meta: string;
	headers: string[];
	rows: string[][];
	truncated: boolean;
	error?: string;
};

export type NotebookBriefImagePreview = {
	id: string;
	title: string;
	fileName: string;
	src: string | null;
};

export type NotebookBriefPrefill = {
	/** Note / lab HTML for the manuscript editor (no dataset tables or figure files). */
	notesHtml: string;
	title: string;
	datasets: NotebookBriefDatasetPreview[];
	images: NotebookBriefImagePreview[];
};

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function pageHasContent(html: string): boolean {
	return html
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/gi, " ")
		.replace(/\s+/g, " ")
		.trim().length > 0;
}

function decodeAttachmentText(dataUrl: string): string {
	try {
		if (dataUrl.includes("base64,")) {
			const b64 = dataUrl.split("base64,")[1] ?? "";
			const binary = atob(b64);
			const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
			return new TextDecoder().decode(bytes);
		}
		if (dataUrl.includes(",")) return decodeURIComponent(dataUrl.split(",").slice(1).join(","));
		return dataUrl;
	} catch {
		return "";
	}
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
	const cells: string[] = [];
	let current = "";
	let inQuotes = false;
	for (let i = 0; i < line.length; i += 1) {
		const ch = line[i];
		if (ch === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"';
				i += 1;
			} else {
				inQuotes = !inQuotes;
			}
			continue;
		}
		if (ch === delimiter && !inQuotes) {
			cells.push(current.trim());
			current = "";
			continue;
		}
		current += ch;
	}
	cells.push(current.trim());
	return cells;
}

function parseDatasetTable(
	raw: string,
	formatHint: string,
): { headers: string[]; rows: string[][]; truncated: boolean } | null {
	const text = raw.replace(/^\uFEFF/, "").trim();
	if (!text) return null;

	const format = formatHint.toLowerCase();
	if (format.includes("json") || text.startsWith("{") || text.startsWith("[")) {
		try {
			const parsed: unknown = JSON.parse(text);
			if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object" && parsed[0]) {
				const headers = Array.from(
					new Set(
						parsed.flatMap((row) =>
							row && typeof row === "object" ? Object.keys(row as Record<string, unknown>) : [],
						),
					),
				).slice(0, MAX_DATASET_COLS);
				const rows = parsed.slice(0, MAX_DATASET_ROWS).map((row) =>
					headers.map((key) => {
						const value = row && typeof row === "object" ? (row as Record<string, unknown>)[key] : "";
						if (value == null) return "";
						if (typeof value === "object") return JSON.stringify(value);
						return String(value);
					}),
				);
				return { headers, rows, truncated: parsed.length > rows.length };
			}
		} catch {
			/* fall through */
		}
	}

	const delimiter = format.includes("tsv") || text.includes("\t") ? "\t" : ",";
	const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
	if (!lines.length) return null;
	const headers = splitDelimitedLine(lines[0], delimiter).slice(0, MAX_DATASET_COLS);
	const dataLines = lines.slice(1, MAX_DATASET_ROWS + 1);
	const rows = dataLines.map((line) => {
		const cells = splitDelimitedLine(line, delimiter);
		return headers.map((_, i) => cells[i] ?? "");
	});
	return {
		headers,
		rows,
		truncated: lines.length - 1 > rows.length,
	};
}

function notesHtmlFromWorkspace(ws: ResearchWorkspace): string {
	const project = ws.project;
	const notebook = project.notebookData ?? emptyNotebookData();
	const parts: string[] = [];

	const pagesWithContent = notebook.pages.filter((page) => pageHasContent(page.html));
	if (pagesWithContent.length) {
		for (const page of pagesWithContent) {
			const title = page.title?.trim();
			if (title && title.toLowerCase() !== (project.title || "").trim().toLowerCase()) {
				parts.push(`<h2>${escapeHtml(title)}</h2>`);
			}
			parts.push(page.html);
		}
	} else {
		parts.push(`<h1>${escapeHtml(project.title || "Untitled notebook")}</h1>`);
		if (project.description?.trim()) {
			parts.push(`<p>${escapeHtml(project.description.trim())}</p>`);
		}
	}

	const labWithContent = notebook.labEntries.filter((entry) => entry.body.trim());
	if (labWithContent.length) {
		parts.push("<h2>Lab log</h2>");
		for (const entry of labWithContent) {
			parts.push(`<h3>${escapeHtml(entry.title || "Lab entry")}</h3>`);
			parts.push(
				entry.body
					.split(/\n{2,}/)
					.map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
					.join(""),
			);
		}
	}

	return parts.join("").trim();
}

async function datasetPreview(dataset: ResearchDataset): Promise<NotebookBriefDatasetPreview> {
	const meta = [dataset.format, dataset.fileName, dataset.sizeLabel].filter(Boolean).join(" · ");
	const base = {
		id: dataset.id,
		title: dataset.title || "Dataset",
		meta,
		headers: [] as string[],
		rows: [] as string[][],
		truncated: false,
	};

	if (!dataset.hasFile) {
		return { ...base, error: "No file attached." };
	}

	try {
		const file = await fetchDatasetFile(dataset.id);
		if (!file?.data) return { ...base, error: "Dataset file unavailable." };
		const textLike =
			/csv|tsv|json|text|plain/i.test(file.mime) || /\.(csv|tsv|json|txt)$/i.test(file.name);
		if (!textLike) {
			return { ...base, error: `Attached file: ${file.name || dataset.fileName || "file"}` };
		}
		const raw = decodeAttachmentText(file.data).slice(0, MAX_DATASET_CHARS);
		const table = parseDatasetTable(raw, file.name || dataset.format || file.mime || "");
		if (!table?.headers.length) {
			return { ...base, error: "Could not parse a table preview." };
		}
		return {
			...base,
			headers: table.headers,
			rows: table.rows,
			truncated: table.truncated,
		};
	} catch {
		return { ...base, error: "Could not load dataset preview." };
	}
}

async function imagePreview(doc: ResearchDocument): Promise<NotebookBriefImagePreview> {
	const base = {
		id: doc.id,
		title: doc.title || doc.fileName || "Image",
		fileName: doc.fileName || "",
		src: null as string | null,
	};
	try {
		const file = await fetchDocumentFile(doc.id);
		if (file?.data) return { ...base, src: file.data };
	} catch {
		/* keep null src */
	}
	return base;
}

async function prefillFromWorkspace(ws: ResearchWorkspace): Promise<NotebookBriefPrefill> {
	const images = ws.documents.filter((doc) => isImageDocument(doc.fileMime)).slice(0, MAX_IMAGES);
	const [datasets, imagePreviews] = await Promise.all([
		Promise.all(ws.datasets.map((dataset) => datasetPreview(dataset))),
		Promise.all(images.map((img) => imagePreview(img))),
	]);

	return {
		notesHtml: notesHtmlFromWorkspace(ws),
		title: ws.project.title || "Untitled notebook",
		datasets,
		images: imagePreviews,
	};
}

/** Load notes for the editor plus dataset/image previews for the panel below. */
export async function loadNotebookBriefPrefill(projectIds: string[]): Promise<NotebookBriefPrefill> {
	const ids = projectIds.map((id) => id.trim()).filter(Boolean);
	if (!ids.length) {
		return { notesHtml: "", title: "", datasets: [], images: [] };
	}

	const notesParts: string[] = [];
	const datasets: NotebookBriefDatasetPreview[] = [];
	const images: NotebookBriefImagePreview[] = [];
	let title = "";

	for (const id of ids) {
		try {
			const ws = await fetchWorkspace(id);
			const part = await prefillFromWorkspace(ws);
			if (!title) title = part.title;
			if (part.notesHtml) {
				if (ids.length > 1) {
					notesParts.push(`<h1>${escapeHtml(part.title)}</h1>${part.notesHtml}`);
				} else {
					notesParts.push(part.notesHtml);
				}
			}
			datasets.push(...part.datasets);
			images.push(...part.images);
		} catch {
			/* skip failed notebooks */
		}
	}

	return {
		notesHtml: notesParts.join(""),
		title: title || "Selected research notebook",
		datasets,
		images,
	};
}

/** @deprecated Prefer loadNotebookBriefPrefill — kept for any residual imports. */
export async function buildNotebookBriefHtml(projectIds: string[]): Promise<string> {
	const prefill = await loadNotebookBriefPrefill(projectIds);
	return prefill.notesHtml;
}
