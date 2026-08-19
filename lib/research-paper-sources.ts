import type { ResearchSourceSelection } from "@/lib/research-assets-api";

const SESSION_KEY = "aula.research.paper.sources";

function emptySources(): ResearchSourceSelection {
	return { documentIds: [], datasetIds: [], questionnaireIds: [], noteIds: [], projectIds: [] };
}

export function stagePaperSources(sources?: ResearchSourceSelection | null): void {
	if (typeof window === "undefined") return;
	try {
		const payload: ResearchSourceSelection = {
			documentIds: [...(sources?.documentIds ?? [])],
			datasetIds: [...(sources?.datasetIds ?? [])],
			questionnaireIds: [...(sources?.questionnaireIds ?? [])],
			noteIds: [...(sources?.noteIds ?? [])],
			projectIds: [...(sources?.projectIds ?? [])],
		};
		sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
	} catch {
		/* ignore */
	}
}

export function peekPaperSources(): ResearchSourceSelection | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = sessionStorage.getItem(SESSION_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as ResearchSourceSelection;
		return {
			...emptySources(),
			...parsed,
			documentIds: parsed.documentIds ?? [],
			datasetIds: parsed.datasetIds ?? [],
			questionnaireIds: parsed.questionnaireIds ?? [],
			noteIds: parsed.noteIds ?? [],
			projectIds: parsed.projectIds ?? [],
		};
	} catch {
		return null;
	}
}

export function consumePaperSources(): ResearchSourceSelection | null {
	const sources = peekPaperSources();
	if (typeof window !== "undefined") {
		try {
			sessionStorage.removeItem(SESSION_KEY);
		} catch {
			/* ignore */
		}
	}
	return sources;
}
