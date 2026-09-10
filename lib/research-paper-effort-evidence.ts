import {
	fetchDatasets,
	fetchDocuments,
	fetchProjects,
	fetchQuestionnaires,
	fetchWorkspace,
	type ResearchDataset,
	type ResearchDocument,
	type ResearchProject,
	type ResearchSourceSelection,
} from "@/lib/research-assets-api";
import { computeNotebookEffort, type NotebookNamedCount } from "@/lib/research-notebook-effort";
import { emptyNotebookData } from "@/lib/research-notebook";
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
	notebookTitle?: string;
	projectId?: string;
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

function projectEvidenceWeight(project: ResearchProject): number {
	const pages = project.notebookData?.pages?.length ?? 0;
	const lab = project.notebookData?.labEntries?.length ?? 0;
	const docs = project.counts?.documents ?? 0;
	const datasets = project.counts?.datasets ?? 0;
	const surveys = project.counts?.questionnaires ?? 0;
	return pages + lab + docs + datasets + surveys;
}

function projectHasEvidence(project: ResearchProject): boolean {
	return projectEvidenceWeight(project) > 0;
}

function cleanTokens(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/^assignment:\s*/i, "")
		.replace(/[^\w\s]/g, " ")
		.split(/\s+/)
		.filter((t) => t.length >= 3);
}

async function resolveProjectIdsAndTitle(
	sources: ResearchSourceSelection | null,
	topic?: string,
	paperTitle?: string,
): Promise<{ projectIds: string[]; primaryTitle?: string }> {
	const fromSources = [...new Set(sources?.projectIds?.filter(Boolean) ?? [])];

	try {
		const projects = await fetchProjects();
		if (!projects.length) {
			return { projectIds: fromSources.slice(0, 8) };
		}

		if (fromSources.length) {
			const matched = projects.find((p) => fromSources.includes(p.id));
			return {
				projectIds: fromSources.slice(0, 8),
				primaryTitle: matched?.title,
			};
		}

		const needleTopic = (topic ?? "").trim();
		const needleTitle = (paperTitle ?? "").trim();
		const tokens = new Set([...cleanTokens(needleTopic), ...cleanTokens(needleTitle)]);

		const scoredProjects = projects.map((p) => {
			const pTitle = p.title.trim();
			const pClean = pTitle.toLowerCase().replace(/^assignment:\s*/i, "");
			const tClean = needleTopic.toLowerCase().replace(/^assignment:\s*/i, "");
			const docClean = needleTitle.toLowerCase();

			let score = 0;
			if (tClean && (pClean.includes(tClean) || tClean.includes(pClean))) {
				score += 50;
			}
			if (docClean && (pClean.includes(docClean) || docClean.includes(pClean))) {
				score += 40;
			}

			const pTokens = cleanTokens(pTitle);
			for (const pt of pTokens) {
				if (tokens.has(pt)) {
					score += 10;
				}
			}

			if (projectHasEvidence(p)) {
				score += 5;
			}

			return { project: p, score };
		});

		scoredProjects.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			return Date.parse(b.project.updatedAt) - Date.parse(a.project.updatedAt);
		});

		const topCandidate = scoredProjects[0];
		if (topCandidate && topCandidate.score > 0) {
			const matching = scoredProjects
				.filter((sp) => sp.score >= Math.max(10, topCandidate.score * 0.6))
				.slice(0, 3)
				.map((sp) => sp.project.id);
			return {
				projectIds: matching,
				primaryTitle: topCandidate.project.title,
			};
		}

		const withEvidence = projects.filter(projectHasEvidence);
		const fallback = withEvidence.length ? withEvidence : projects;
		const sortedFallback = fallback.sort(
			(a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
		);
		const bestFallback = sortedFallback[0];
		return {
			projectIds: sortedFallback.slice(0, 1).map((p) => p.id),
			primaryTitle: bestFallback?.title,
		};
	} catch {
		return { projectIds: fromSources.slice(0, 8) };
	}
}

export async function loadPaperEffortEvidence(
	sources?: ResearchSourceSelection | null,
	topic?: string,
	paperTitle?: string,
): Promise<PaperEffortEvidence> {
	const evidence = emptyPaperEffortEvidence();
	const { projectIds, primaryTitle } = await resolveProjectIdsAndTitle(
		sources ?? null,
		topic,
		paperTitle,
	);

	if (primaryTitle) {
		evidence.notebookTitle = primaryTitle;
	}
	if (projectIds.length > 0) {
		evidence.projectId = projectIds[0];
	}

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
			if (!evidence.notebookTitle && ws.project?.title) {
				evidence.notebookTitle = ws.project.title;
			}
			notebook.pages.push(...(ws.project.notebookData?.pages ?? []));
			notebook.labEntries.push(...(ws.project.notebookData?.labEntries ?? []));
			for (const doc of ws.documents ?? []) {
				if (seenDocs.has(doc.id)) continue;
				seenDocs.add(doc.id);
				wantDocs.delete(doc.id);
				documents.push(doc);
			}
			for (const dataset of ws.datasets ?? []) {
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
		projects: projectIds.length || (evidence.notebookTitle ? 1 : 0),
	};

	return evidence;
}
