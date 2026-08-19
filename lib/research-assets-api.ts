import { apiUrl } from "@/lib/api";
import { authHeaders } from "@/lib/auth";
import type { ResearchNotebookData } from "@/lib/research-notebook";
import type { ResearchProjectType } from "@/lib/research-project-types";

export type ResearchDataset = {
	id: string;
	title: string;
	description: string;
	discipline: string;
	format: string;
	year: string;
	license: string;
	accessUrl: string;
	sizeLabel: string;
	tags: string[];
	visibility: "private" | "shared";
	hasFile: boolean;
	fileName: string;
	createdAt: string;
	updatedAt: string;
};

export type AttachmentPayload = {
	name: string;
	mime: string;
	data?: string;
	downloadUrl?: string;
	sizeBytes?: number;
};

export type ResearchSourceSelection = {
	documentIds: string[];
	datasetIds: string[];
	questionnaireIds?: string[];
	/** Legacy note ids retained for saved-paper source compat. */
	noteIds: string[];
	/** Legacy project ids retained for saved-paper source compat. */
	projectIds?: string[];
};

async function parseError(res: Response, fallback: string): Promise<string> {
	try {
		const data = (await res.json()) as { error?: string };
		if (data.error?.trim()) return data.error;
	} catch {
		/* ignore */
	}
	return fallback;
}

function parseTagsText(tagsText: string): string[] {
	return tagsText
		.split(",")
		.map((t) => t.trim())
		.filter(Boolean)
		.slice(0, 20);
}

export function readFileAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === "string") resolve(reader.result);
			else reject(new Error("Could not read file."));
		};
		reader.onerror = () => reject(new Error("Could not read file."));
		reader.readAsDataURL(file);
	});
}

export function downloadDataUrl(dataUrl: string, fileName: string): void {
	const a = document.createElement("a");
	a.href = dataUrl;
	a.download = fileName;
	a.rel = "noopener";
	document.body.appendChild(a);
	a.click();
	a.remove();
}

export async function fetchDatasets(projectId?: string): Promise<ResearchDataset[]> {
	const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
	const res = await fetch(apiUrl(`/api/research/datasets${q}`), { headers: authHeaders() });
	if (res.status === 401) throw new Error("Sign in to view your datasets.");
	if (!res.ok) throw new Error(await parseError(res, "Could not load datasets."));
	const data = (await res.json()) as { datasets?: ResearchDataset[] };
	return data.datasets ?? [];
}

export async function createDataset(input: {
	title: string;
	description: string;
	discipline: string;
	format: string;
	year: string;
	license: string;
	accessUrl: string;
	sizeLabel: string;
	tagsText: string;
	visibility: "private" | "shared";
	projectId?: string;
	fileName?: string;
	fileMime?: string;
	fileData?: string;
	/** When set, uploads directly to MinIO (supports up to 2 GB). */
	file?: File;
}): Promise<ResearchDataset> {
	if (input.file && input.file.size > 8 * 1024 * 1024) {
		return createDatasetViaDirectUpload(input, input.file);
	}

	let fileName = input.fileName;
	let fileMime = input.fileMime;
	let fileData = input.fileData;
	if (input.file) {
		fileName = input.file.name;
		fileMime = input.file.type || "text/csv";
		fileData = await readFileAsDataUrl(input.file);
	}

	const res = await fetch(apiUrl("/api/research/datasets"), {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders() },
		body: JSON.stringify({
			title: input.title,
			description: input.description,
			discipline: input.discipline,
			format: input.format,
			year: input.year,
			license: input.license,
			accessUrl: input.accessUrl,
			sizeLabel: input.sizeLabel,
			tags: parseTagsText(input.tagsText),
			visibility: input.visibility,
			projectId: input.projectId,
			fileName,
			fileMime,
			fileData,
		}),
	});
	if (!res.ok) throw new Error(await parseError(res, "Could not save dataset."));
	const data = (await res.json()) as { dataset?: ResearchDataset };
	if (!data.dataset) throw new Error("Could not save dataset.");
	return data.dataset;
}

/** Direct browser → MinIO PUT (default max 2 GiB). Requires S3 configured + CORS. */
export async function createDatasetViaDirectUpload(
	input: {
		title: string;
		description: string;
		discipline: string;
		format: string;
		year: string;
		license: string;
		accessUrl: string;
		sizeLabel: string;
		tagsText: string;
		visibility: "private" | "shared";
		projectId?: string;
	},
	file: File,
	onProgress?: (ratio: number) => void,
): Promise<ResearchDataset> {
	const sessionRes = await fetch(apiUrl("/api/research/datasets/upload-session"), {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders() },
		body: JSON.stringify({
			title: input.title,
			description: input.description,
			discipline: input.discipline,
			format: input.format,
			year: input.year,
			license: input.license,
			accessUrl: input.accessUrl,
			sizeLabel: input.sizeLabel || undefined,
			tags: parseTagsText(input.tagsText),
			visibility: input.visibility,
			projectId: input.projectId,
			fileName: file.name,
			fileMime: file.type || "application/octet-stream",
			fileSizeBytes: file.size,
		}),
	});
	if (!sessionRes.ok) {
		throw new Error(await parseError(sessionRes, "Could not start MinIO upload."));
	}
	const session = (await sessionRes.json()) as {
		dataset?: ResearchDataset;
		uploadUrl?: string;
	};
	if (!session.dataset?.id || !session.uploadUrl) {
		throw new Error("Could not start MinIO upload.");
	}

	await putFileToPresignedUrl(session.uploadUrl, file, onProgress);

	const doneRes = await fetch(
		apiUrl(`/api/research/datasets/${encodeURIComponent(session.dataset.id)}/complete-upload`),
		{ method: "POST", headers: { ...authHeaders() } },
	);
	if (!doneRes.ok) {
		throw new Error(await parseError(doneRes, "Upload finished but confirmation failed."));
	}
	const done = (await doneRes.json()) as { dataset?: ResearchDataset };
	if (!done.dataset) throw new Error("Upload confirmation failed.");
	return done.dataset;
}

function putFileToPresignedUrl(
	uploadUrl: string,
	file: File,
	onProgress?: (ratio: number) => void,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("PUT", uploadUrl);
		xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
		xhr.upload.onprogress = (event) => {
			if (!onProgress || !event.lengthComputable || event.total <= 0) return;
			onProgress(Math.min(1, event.loaded / event.total));
		};
		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) resolve();
			else reject(new Error(`MinIO upload failed (HTTP ${xhr.status}).`));
		};
		xhr.onerror = () =>
			reject(
				new Error(
					"MinIO upload failed. If the file is larger than ~100 MB, set s3.garilai.com to DNS-only (grey cloud) in Cloudflare.",
				),
			);
		xhr.send(file);
	});
}

export async function fetchDataset(id: string): Promise<ResearchDataset> {
	const res = await fetch(apiUrl(`/api/research/datasets/${encodeURIComponent(id)}`), {
		headers: authHeaders(),
	});
	if (res.status === 401) throw new Error("Sign in to view this dataset.");
	if (res.status === 404) throw new Error("Dataset not found.");
	if (!res.ok) throw new Error(await parseError(res, "Could not load dataset."));
	const data = (await res.json()) as { dataset?: ResearchDataset };
	if (!data.dataset) throw new Error("Dataset not found.");
	return data.dataset;
}

export async function fetchDatasetFile(id: string): Promise<AttachmentPayload | null> {
	const res = await fetch(apiUrl(`/api/research/datasets/${encodeURIComponent(id)}/file`), {
		headers: authHeaders(),
	});
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(await parseError(res, "Could not download file."));
	const data = (await res.json()) as { file?: AttachmentPayload };
	return data.file ?? null;
}

export async function deleteDataset(id: string): Promise<void> {
	const res = await fetch(apiUrl(`/api/research/datasets/${encodeURIComponent(id)}`), {
		method: "DELETE",
		headers: authHeaders(),
	});
	if (!res.ok) throw new Error(await parseError(res, "Could not remove dataset."));
}

export type GraphChartType =
	| "bar"
	| "stacked_bar"
	| "horizontal_bar"
	| "line"
	| "area"
	| "composed"
	| "scatter"
	| "bubble"
	| "pie"
	| "doughnut"
	| "radar"
	| "funnel"
	| "treemap"
	| "histogram";

export const GRAPH_CHART_GROUPS: Array<{ label: string; options: Array<{ value: GraphChartType; label: string }> }> = [
	{
		label: "Comparison",
		options: [
			{ value: "bar", label: "Bar" },
			{ value: "stacked_bar", label: "Stacked bar" },
			{ value: "horizontal_bar", label: "Horizontal bar" },
			{ value: "line", label: "Line" },
			{ value: "area", label: "Area" },
			{ value: "composed", label: "Composed (bar + line)" },
		],
	},
	{
		label: "Distribution",
		options: [
			{ value: "histogram", label: "Histogram" },
			{ value: "scatter", label: "Scatter" },
			{ value: "bubble", label: "Bubble" },
			{ value: "radar", label: "Radar" },
		],
	},
	{
		label: "Part to whole",
		options: [
			{ value: "pie", label: "Pie" },
			{ value: "doughnut", label: "Doughnut" },
			{ value: "funnel", label: "Funnel" },
			{ value: "treemap", label: "Treemap" },
		],
	},
];

export type GraphExplanation = {
	summary: string;
	insights: string[];
	takeaways: string;
	caveats: string;
	generatedBy: "agent" | "heuristic";
};

export type GraphInstructionPlan = {
	goal: string;
	preferredChartType?: GraphChartType | null;
	xKeyHint?: string | null;
	yKeyHints?: string[];
	categoryHint?: string | null;
	valueHint?: string | null;
	filters?: string[];
	sortBy?: string | null;
	sortDirection?: "asc" | "desc" | null;
	limit?: number | null;
	aggregation?: "none" | "sum" | "avg" | "count" | null;
	titleHint?: string | null;
	notes?: string;
	interpretedBy: "agent" | "heuristic";
};

export type GraphAgentStep = {
	id: string;
	agent: string;
	status: "ok" | "skipped" | "fallback";
	detail: string;
};

export type GraphPlotResult = {
	chartType: GraphChartType;
	title: string;
	description: string;
	xKey: string;
	yKeys: string[];
	nameKey?: string;
	valueKey?: string;
	series: Array<Record<string, string | number>>;
	columns: string[];
	rowCount: number;
	usedAgent: boolean;
	datasetTitle: string;
	explanation: GraphExplanation;
	userPrompt?: string;
	instructionPlan?: GraphInstructionPlan | null;
	agentSteps?: GraphAgentStep[];
};

export async function plotDataset(
	id: string,
	input: { chartType: GraphChartType; prompt?: string },
): Promise<GraphPlotResult> {
	const res = await fetch(apiUrl(`/api/research/datasets/${encodeURIComponent(id)}/plot`), {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders() },
		body: JSON.stringify(input),
	});
	if (!res.ok) throw new Error(await parseError(res, "Could not plot dataset."));
	const data = (await res.json()) as { plot?: GraphPlotResult };
	if (!data.plot) throw new Error("Could not plot dataset.");
	return data.plot;
}

export type ProjectStatus = "draft" | "in_progress" | "completed";

export type ResearchProjectSection = {
	id: string;
	title: string;
	content: string;
};

export type ResearchProject = {
	id: string;
	title: string;
	description: string;
	projectType: ResearchProjectType;
	sections: ResearchProjectSection[];
	status: ProjectStatus;
	favorite: boolean;
	progress: number;
	startedAt: string;
	createdAt: string;
	updatedAt: string;
	counts: {
		documents: number;
		datasets: number;
		notes: number;
		references: number;
		questionnaires?: number;
	};
	notebookData?: ResearchNotebookData;
};

export type ResearchDocument = {
	id: string;
	title: string;
	fileName: string;
	fileMime: string;
	sizeLabel: string;
	kind: "doc" | "pdf" | "sheet" | "other";
	hasFile: boolean;
	createdAt: string;
	updatedAt: string;
};

export type ResearchReferenceItem = {
	id: string;
	title: string;
	citation: string;
	sourceUrl: string;
	createdAt: string;
	updatedAt: string;
};

export type ResearchActivity = {
	id: string;
	kind: "dataset" | "document" | "reference" | "project" | "questionnaire";
	label: string;
	at: string;
};

export type ResearchWorkspace = {
	project: ResearchProject;
	datasets: ResearchDataset[];
	documents: ResearchDocument[];
	references: ResearchReferenceItem[];
	questionnaires?: import("@/lib/research-questionnaire").ResearchQuestionnaire[];
	activity: ResearchActivity[];
};

export async function fetchWorkspace(projectId: string): Promise<ResearchWorkspace> {
	const res = await fetch(
		apiUrl(`/api/research/projects/${encodeURIComponent(projectId)}/workspace`),
		{ headers: authHeaders() },
	);
	if (res.status === 401) throw new Error("Sign in to view your research project.");
	if (!res.ok) throw new Error(await parseError(res, "Could not load project workspace."));
	return (await res.json()) as ResearchWorkspace;
}

export async function fetchProjects(): Promise<ResearchProject[]> {
	const res = await fetch(apiUrl("/api/research/projects"), { headers: authHeaders() });
	if (res.status === 401) throw new Error("Sign in to view your research folders.");
	if (!res.ok) throw new Error(await parseError(res, "Could not load research folders."));
	const data = (await res.json()) as { projects?: ResearchProject[] };
	return data.projects ?? [];
}

export async function createProject(input: {
	title: string;
	description?: string;
	projectType?: ResearchProjectType;
}): Promise<ResearchProject> {
	const res = await fetch(apiUrl("/api/research/projects"), {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders() },
		body: JSON.stringify(input),
	});
	if (!res.ok) throw new Error(await parseError(res, "Could not create research folder."));
	const data = (await res.json()) as { project?: ResearchProject };
	if (!data.project) throw new Error("Could not create research folder.");
	return data.project;
}

export async function deleteProject(projectId: string): Promise<void> {
	const res = await fetch(apiUrl(`/api/research/projects/${encodeURIComponent(projectId)}`), {
		method: "DELETE",
		headers: authHeaders(),
	});
	if (!res.ok) throw new Error(await parseError(res, "Could not delete research folder."));
}

export async function updateProject(
	projectId: string,
	input: {
		title?: string;
		description?: string;
		status?: ProjectStatus;
		favorite?: boolean;
		projectType?: ResearchProjectType;
		sections?: Array<{ id: string; title?: string; content?: string }>;
		notebookData?: ResearchNotebookData;
		progress?: number;
	},
): Promise<ResearchProject> {
	const res = await fetch(apiUrl(`/api/research/projects/${encodeURIComponent(projectId)}`), {
		method: "PATCH",
		headers: { "Content-Type": "application/json", ...authHeaders() },
		body: JSON.stringify(input),
	});
	if (!res.ok) throw new Error(await parseError(res, "Could not update project."));
	const data = (await res.json()) as { project?: ResearchProject };
	if (!data.project) throw new Error("Could not update project.");
	return data.project;
}

export async function fetchDocuments(projectId?: string): Promise<ResearchDocument[]> {
	const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
	const res = await fetch(apiUrl(`/api/research/documents${q}`), { headers: authHeaders() });
	if (res.status === 401) throw new Error("Sign in to view your documents.");
	if (!res.ok) throw new Error(await parseError(res, "Could not load documents."));
	const data = (await res.json()) as { documents?: ResearchDocument[] };
	return data.documents ?? [];
}

export async function createDocument(input: {
	title: string;
	fileName: string;
	fileMime: string;
	fileData: string;
	sizeLabel?: string;
	projectId?: string;
}): Promise<ResearchDocument> {
	const res = await fetch(apiUrl("/api/research/documents"), {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders() },
		body: JSON.stringify(input),
	});
	if (!res.ok) throw new Error(await parseError(res, "Could not upload document."));
	const data = (await res.json()) as { document?: ResearchDocument };
	if (!data.document) throw new Error("Could not upload document.");
	return data.document;
}

export async function fetchDocumentFile(id: string): Promise<AttachmentPayload | null> {
	const res = await fetch(apiUrl(`/api/research/documents/${encodeURIComponent(id)}/file`), {
		headers: authHeaders(),
	});
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(await parseError(res, "Could not download document."));
	const data = (await res.json()) as { file?: AttachmentPayload };
	return data.file ?? null;
}

export async function deleteDocument(id: string): Promise<void> {
	const res = await fetch(apiUrl(`/api/research/documents/${encodeURIComponent(id)}`), {
		method: "DELETE",
		headers: authHeaders(),
	});
	if (!res.ok) throw new Error(await parseError(res, "Could not remove document."));
}

export async function createReference(input: {
	title: string;
	citation: string;
	sourceUrl?: string;
	projectId?: string;
}): Promise<ResearchReferenceItem> {
	const res = await fetch(apiUrl("/api/research/references"), {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders() },
		body: JSON.stringify(input),
	});
	if (!res.ok) throw new Error(await parseError(res, "Could not save reference."));
	const data = (await res.json()) as { reference?: ResearchReferenceItem };
	if (!data.reference) throw new Error("Could not save reference.");
	return data.reference;
}

export async function deleteReference(id: string): Promise<void> {
	const res = await fetch(apiUrl(`/api/research/references/${encodeURIComponent(id)}`), {
		method: "DELETE",
		headers: authHeaders(),
	});
	if (!res.ok) throw new Error(await parseError(res, "Could not remove reference."));
}

export async function fetchQuestionnaires(
	projectId?: string,
): Promise<import("@/lib/research-questionnaire").ResearchQuestionnaire[]> {
	const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
	const res = await fetch(apiUrl(`/api/research/questionnaires${q}`), { headers: authHeaders() });
	if (res.status === 401) throw new Error("Sign in to view questionnaires.");
	if (!res.ok) throw new Error(await parseError(res, "Could not load questionnaires."));
	const data = (await res.json()) as {
		questionnaires?: import("@/lib/research-questionnaire").ResearchQuestionnaire[];
	};
	return data.questionnaires ?? [];
}

export async function createQuestionnaire(input: {
	projectId?: string;
	title: string;
	description?: string;
	population?: string;
	sampleSize?: number;
	distributionNote?: string;
	items?: import("@/lib/research-questionnaire").QuestionnaireItem[];
	instrumentDocumentId?: string;
}): Promise<import("@/lib/research-questionnaire").ResearchQuestionnaire> {
	const res = await fetch(apiUrl("/api/research/questionnaires"), {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders() },
		body: JSON.stringify(input),
	});
	if (!res.ok) throw new Error(await parseError(res, "Could not create questionnaire."));
	const data = (await res.json()) as {
		questionnaire?: import("@/lib/research-questionnaire").ResearchQuestionnaire;
	};
	if (!data.questionnaire) throw new Error("Could not create questionnaire.");
	return data.questionnaire;
}

export async function updateQuestionnaire(
	id: string,
	input: {
		title?: string;
		description?: string;
		population?: string;
		sampleSize?: number;
		distributionNote?: string;
		items?: import("@/lib/research-questionnaire").QuestionnaireItem[];
		instrumentDocumentId?: string | null;
	},
): Promise<import("@/lib/research-questionnaire").ResearchQuestionnaire> {
	const res = await fetch(apiUrl(`/api/research/questionnaires/${encodeURIComponent(id)}`), {
		method: "PATCH",
		headers: { "Content-Type": "application/json", ...authHeaders() },
		body: JSON.stringify(input),
	});
	if (!res.ok) throw new Error(await parseError(res, "Could not save questionnaire."));
	const data = (await res.json()) as {
		questionnaire?: import("@/lib/research-questionnaire").ResearchQuestionnaire;
	};
	if (!data.questionnaire) throw new Error("Could not save questionnaire.");
	return data.questionnaire;
}

export async function importQuestionnaireResponses(
	id: string,
	input: { file: File; columnMap?: Record<string, string> },
): Promise<import("@/lib/research-questionnaire").ResearchQuestionnaire> {
	const fileData = await readFileAsDataUrl(input.file);
	const res = await fetch(apiUrl(`/api/research/questionnaires/${encodeURIComponent(id)}/import`), {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders() },
		body: JSON.stringify({
			fileName: input.file.name,
			fileMime: input.file.type || "text/csv",
			fileData,
			columnMap: input.columnMap,
		}),
	});
	if (!res.ok) throw new Error(await parseError(res, "Could not import responses."));
	const data = (await res.json()) as {
		questionnaire?: import("@/lib/research-questionnaire").ResearchQuestionnaire;
	};
	if (!data.questionnaire) throw new Error("Could not import responses.");
	return data.questionnaire;
}

export async function deleteQuestionnaire(id: string): Promise<void> {
	const res = await fetch(apiUrl(`/api/research/questionnaires/${encodeURIComponent(id)}`), {
		method: "DELETE",
		headers: authHeaders(),
	});
	if (!res.ok) throw new Error(await parseError(res, "Could not remove questionnaire."));
}

