import {
	fetchDatasets,
	fetchDocuments,
	fetchProjects,
	fetchQuestionnaires,
	fetchWorkspace,
	type ResearchDataset,
	type ResearchDocument,
	type ResearchSourceSelection,
} from "@/lib/research-assets-api";
import { computeNotebookEffort, type NotebookNamedCount } from "@/lib/research-notebook-effort";
import { emptyNotebookData, isAssignmentNotebookProject } from "@/lib/research-notebook";
import type { ResearchQuestionnaire } from "@/lib/research-questionnaire";
import { emptyMaterialCounts, type PaperMaterialCounts } from "@/lib/research-paper-effort";

export type EffortNamedItem = {
	name: string;
	detail: string;
};

export type PaperEffortEvidence = {
	materials: PaperMaterialCounts;
	pages: EffortNamedItem[];
	files: EffortNamedItem[];
	surveys: EffortNamedItem[];
	datasets: EffortNamedItem[];
	pictures: EffortNamedItem[];
	lab: EffortNamedItem[];
	/** Words the researcher inserted in notebook pages, lab notes, and surveys. */
	writingWords: number;
	pageWords: number;
	labWords: number;
	surveyWords: number;
	captureScore: number;
	writingScore: number;
	userEffortScore: number;
};

export function emptyPaperEffortEvidence(): PaperEffortEvidence {
	return {
		materials: emptyMaterialCounts(),
		pages: [],
		files: [],
		surveys: [],
		datasets: [],
		pictures: [],
		lab: [],
		writingWords: 0,
		pageWords: 0,
		labWords: 0,
		surveyWords: 0,
		captureScore: 0,
		writingScore: 0,
		userEffortScore: 0,
	};
}

export function hasResearchSources(sources?: ResearchSourceSelection | null): boolean {
	if (!sources) return false;
	return Boolean(
		sources.documentIds?.length ||
			sources.datasetIds?.length ||
			sources.questionnaireIds?.length ||
			sources.noteIds?.length ||
			sources.projectIds?.length,
	);
}

function toNamed(rows: NotebookNamedCount[]): EffortNamedItem[] {
	return rows.map((row) => ({ name: row.name, detail: row.detail }));
}

function projectHasEvidence(project: {
	notebookData?: { pages?: unknown[]; labEntries?: unknown[] } | null;
	counts?: {
		documents?: number;
		datasets?: number;
		questionnaires?: number;
	} | null;
}): boolean {
	const pages = project.notebookData?.pages?.length ?? 0;
	const lab = project.notebookData?.labEntries?.length ?? 0;
	const docs = project.counts?.documents ?? 0;
	const datasets = project.counts?.datasets ?? 0;
	const surveys = project.counts?.questionnaires ?? 0;
	return pages + lab + docs + datasets + surveys > 0;
}

async function resolveProjectIds(
	sources: ResearchSourceSelection | null,
	topic?: string,
): Promise<string[]> {
	const fromSources = [...new Set(sources?.projectIds?.filter(Boolean) ?? [])];
	if (fromSources.length) return fromSources.slice(0, 8);

	try {
		const projects = (await fetchProjects()).filter((p) => !isAssignmentNotebookProject(p));
		if (!projects.length) return [];
		const needle = (topic ?? "").trim().toLowerCase();
		const withEvidence = projects.filter(projectHasEvidence);
		const matched = needle
			? withEvidence.filter((p) => {
					const title = p.title.trim().toLowerCase();
					return title && (needle.includes(title) || title.includes(needle.slice(0, 48)));
				})
			: [];
		const pool = matched.length ? matched : withEvidence;
		return pool
			.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
			.slice(0, matched.length ? 3 : 1)
			.map((p) => p.id);
	} catch {
		return [];
	}
}

export async function loadPaperEffortEvidence(
	sources?: ResearchSourceSelection | null,
	topic?: string,
): Promise<PaperEffortEvidence> {
	const evidence = emptyPaperEffortEvidence();
	const projectIds = await resolveProjectIds(sources ?? null, topic);
	const wantDocs = new Set(sources?.documentIds ?? []);
	const wantDatasets = new Set(sources?.datasetIds ?? []);
	const wantSurveys = new Set(sources?.questionnaireIds ?? []);
	const seenDocs = new Set<string>();
	const seenDatasets = new Set<string>();
	const seenSurveys = new Set<string>();
	const documents: ResearchDocument[] = [];
	const datasets: ResearchDataset[] = [];
	const questionnaires: ResearchQuestionnaire[] = [];
	const notebook = emptyNotebookData();

	for (const projectId of projectIds) {
		try {
			const ws = await fetchWorkspace(projectId);
			notebook.pages.push(...(ws.project.notebookData?.pages ?? []));
			notebook.labEntries.push(...(ws.project.notebookData?.labEntries ?? []));
			for (const doc of ws.documents) {
				if (seenDocs.has(doc.id)) continue;
				seenDocs.add(doc.id);
				wantDocs.delete(doc.id);
				documents.push(doc);
			}
			for (const dataset of ws.datasets) {
				if (seenDatasets.has(dataset.id)) continue;
				seenDatasets.add(dataset.id);
				wantDatasets.delete(dataset.id);
				datasets.push(dataset);
			}
			for (const survey of ws.questionnaires ?? []) {
				if (seenSurveys.has(survey.id)) continue;
				seenSurveys.add(survey.id);
				wantSurveys.delete(survey.id);
				questionnaires.push(survey);
			}
		} catch {
			/* Skip folders the user can no longer load. */
		}
	}

	try {
		if (wantDocs.size || (sources?.documentIds?.length ?? 0)) {
			const docs = await fetchDocuments();
			const selected = new Set(sources?.documentIds ?? []);
			for (const doc of docs) {
				if (seenDocs.has(doc.id)) continue;
				if (!wantDocs.has(doc.id) && !selected.has(doc.id)) continue;
				seenDocs.add(doc.id);
				wantDocs.delete(doc.id);
				documents.push(doc);
			}
		}
	} catch {
		/* ignore */
	}

	try {
		if (wantDatasets.size || (sources?.datasetIds?.length ?? 0)) {
			const rows = await fetchDatasets();
			const selected = new Set(sources?.datasetIds ?? []);
			for (const dataset of rows) {
				if (seenDatasets.has(dataset.id)) continue;
				if (!wantDatasets.has(dataset.id) && !selected.has(dataset.id)) continue;
				seenDatasets.add(dataset.id);
				wantDatasets.delete(dataset.id);
				datasets.push(dataset);
			}
		}
	} catch {
		/* ignore */
	}

	try {
		if (wantSurveys.size || (sources?.questionnaireIds?.length ?? 0)) {
			const rows = await fetchQuestionnaires();
			const selected = new Set(sources?.questionnaireIds ?? []);
			for (const survey of rows) {
				if (seenSurveys.has(survey.id)) continue;
				if (!wantSurveys.has(survey.id) && !selected.has(survey.id)) continue;
				seenSurveys.add(survey.id);
				wantSurveys.delete(survey.id);
				questionnaires.push(survey);
			}
		}
	} catch {
		/* ignore */
	}

	const snapshot = computeNotebookEffort({
		notebook,
		questionnaires,
		datasets,
		documents,
	});

	evidence.pages = toNamed(snapshot.pageInventory);
	evidence.files = toNamed(snapshot.fileInventory);
	evidence.surveys = toNamed(snapshot.surveyInventory);
	evidence.datasets = toNamed(snapshot.datasetInventory);
	evidence.pictures = toNamed(snapshot.pictureInventory);
	evidence.lab = toNamed(snapshot.labInventory);
	evidence.pageWords = snapshot.wordCount;
	evidence.labWords = snapshot.labWordCount;
	evidence.surveyWords = snapshot.surveyWordCount;
	evidence.writingWords = snapshot.totalWordsInserted;
	evidence.captureScore = snapshot.captureScore;
	evidence.writingScore = snapshot.writingScore;
	evidence.userEffortScore = snapshot.userEffortScore;
	evidence.materials = {
		...emptyMaterialCounts(),
		notes: snapshot.pages,
		documents: snapshot.uploadedFiles,
		datasets: snapshot.datasets + snapshot.questionnaires,
		figures: snapshot.pictures,
		labEntries: snapshot.labEntries,
		projects: projectIds.length,
	};

	return evidence;
}
