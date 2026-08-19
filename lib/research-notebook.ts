export type NotebookPage = {
	id: string;
	title: string;
	html: string;
	updatedAt: string;
};

export type NotebookLabEntry = {
	id: string;
	at: string;
	title: string;
	body: string;
	imageDocumentIds: string[];
};

export type ResearchNotebookData = {
	pages: NotebookPage[];
	labEntries: NotebookLabEntry[];
};

export function emptyNotebookData(): ResearchNotebookData {
	return { pages: [], labEntries: [] };
}

export const OPEN_CREATE_NOTEBOOK_EVENT = "garil:open-create-notebook";
export const COMPILE_NOTEBOOK_EVENT = "garil:compile-notebook";

export function isNotebookListPath(pathname: string): boolean {
	const p = pathname.replace(/\/+$/, "") || "/";
	return p === "/research/notebook" || p === "/student/research/notebook";
}

export function isNotebookDetailPath(pathname: string): boolean {
	return (
		pathname.startsWith("/research/notebook/") || pathname.startsWith("/student/research/notebook/")
	);
}

export function newNotebookId(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
	return `nb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isImageDocument(mime: string): boolean {
	return mime.toLowerCase().startsWith("image/");
}

/** Assignment coursework lives under Assignments — never in the research notebook library. */
export function isAssignmentNotebookProject(project: {
	projectType?: string | null;
}): boolean {
	return (project.projectType ?? "").trim().toLowerCase() === "assignment";
}

export function notebookLibraryHref(variant: "lecturer" | "student"): string {
	return variant === "student" ? "/student/research/notebook" : "/research/notebook";
}

export function notebookLibraryMeta(project: {
	notebookData?: ResearchNotebookData | null;
	counts?: {
		documents?: number;
		datasets?: number;
		questionnaires?: number;
	} | null;
}): string {
	const pages = project.notebookData?.pages.length ?? 0;
	const files = project.counts?.documents ?? 0;
	const datasets = project.counts?.datasets ?? 0;
	const surveys = project.counts?.questionnaires ?? 0;
	const parts: string[] = [];
	if (pages) parts.push(`${pages} ${pages === 1 ? "note" : "notes"}`);
	if (files) parts.push(`${files} ${files === 1 ? "file" : "files"}`);
	if (datasets) parts.push(`${datasets} ${datasets === 1 ? "dataset" : "datasets"}`);
	if (surveys) parts.push(`${surveys} ${surveys === 1 ? "survey" : "surveys"}`);
	return parts.join(" · ") || "Empty notebook";
}
