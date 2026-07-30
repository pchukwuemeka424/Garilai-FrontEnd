import type { CitationStyle } from "@/lib/citation-styles";
import type { IdeaType, ResearchIdea, ResearchScope, ResearchTopicAnalysis } from "@/lib/research-ideas";
import type { ResearchSourceSelection } from "@/lib/research-assets-api";

const DRAFT_KEY_PREFIX = "aula.research.wizard.draft";
const MIGRATION_FLAG = "aula.research.wizard.draft.isolated.v1";

export type ResearchWizardDraft = {
	version: 1;
	step: 1 | 2 | 3;
	discipline: string;
	topic: string;
	scope: ResearchScope | "";
	citationStyle: CitationStyle | "";
	focusFilter: IdeaType | "all";
	localIdeas: ResearchIdea[] | null;
	hasGenerated: boolean;
	topicAnalysis: ResearchTopicAnalysis | null;
	selectedSources: ResearchSourceSelection;
	viewMode: "cards" | "markdown";
	updatedAt: string;
	/** Owner that wrote this draft — reject on mismatch. */
	userId?: string;
};

function storageKey(variant: "lecturer" | "student", userId: string): string {
	return `${DRAFT_KEY_PREFIX}.${variant}.${userId}`;
}

function emptySources(): ResearchSourceSelection {
	return { documentIds: [], datasetIds: [], noteIds: [], projectIds: [] };
}

/** One-time wipe of shared / race-polluted drafts from before per-user isolation. */
function ensureIsolationMigration(): void {
	if (typeof window === "undefined") return;
	try {
		if (sessionStorage.getItem(MIGRATION_FLAG) === "1") return;
		const doomed: string[] = [];
		for (let i = 0; i < sessionStorage.length; i++) {
			const key = sessionStorage.key(i);
			if (key && key.startsWith(DRAFT_KEY_PREFIX)) doomed.push(key);
		}
		for (const key of doomed) sessionStorage.removeItem(key);
		sessionStorage.removeItem("aula.research.quickTopic");
		sessionStorage.setItem(MIGRATION_FLAG, "1");
	} catch {
		/* ignore */
	}
}

/** Drop drafts that do not belong to this user (and any legacy unscoped keys). */
export function purgeForeignWizardDrafts(
	variant: "lecturer" | "student",
	userId: string,
): void {
	if (typeof window === "undefined") return;
	ensureIsolationMigration();
	try {
		const keep = storageKey(variant, userId);
		const doomed: string[] = [];
		for (let i = 0; i < sessionStorage.length; i++) {
			const key = sessionStorage.key(i);
			if (!key || !key.startsWith(DRAFT_KEY_PREFIX)) continue;
			if (key === keep) continue;
			doomed.push(key);
		}
		for (const key of doomed) sessionStorage.removeItem(key);
	} catch {
		/* ignore */
	}
}

/** Clear shared research session leftovers that are not user-scoped. */
export function clearSharedResearchSessionKeys(): void {
	if (typeof window === "undefined") return;
	try {
		sessionStorage.removeItem("aula.research.quickTopic");
		sessionStorage.removeItem("aula.research.paper.sources");
		sessionStorage.removeItem("aula.research.paper.pending");
	} catch {
		/* ignore */
	}
}

export function loadResearchWizardDraft(
	variant: "lecturer" | "student",
	userId?: string | null,
): ResearchWizardDraft | null {
	if (typeof window === "undefined") return null;
	const id = userId?.trim();
	if (!id) return null;

	ensureIsolationMigration();
	purgeForeignWizardDrafts(variant, id);

	try {
		const raw = sessionStorage.getItem(storageKey(variant, id));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as ResearchWizardDraft;
		if (!parsed || parsed.version !== 1) return null;
		// Reject drafts written without owner or for a different account.
		if (parsed.userId && parsed.userId !== id) {
			sessionStorage.removeItem(storageKey(variant, id));
			return null;
		}
		return {
			...parsed,
			userId: id,
			selectedSources: {
				...emptySources(),
				...(parsed.selectedSources ?? {}),
				documentIds: parsed.selectedSources?.documentIds ?? [],
				datasetIds: parsed.selectedSources?.datasetIds ?? [],
				noteIds: parsed.selectedSources?.noteIds ?? [],
				projectIds: parsed.selectedSources?.projectIds ?? [],
			},
		};
	} catch {
		return null;
	}
}

export function saveResearchWizardDraft(
	variant: "lecturer" | "student",
	draft: Omit<ResearchWizardDraft, "version" | "updatedAt" | "userId">,
	userId?: string | null,
): void {
	if (typeof window === "undefined") return;
	const id = userId?.trim();
	// Never write to a guest/shared bucket — that is how topics leaked across accounts.
	if (!id) return;

	try {
		const payload: ResearchWizardDraft = {
			...draft,
			version: 1,
			userId: id,
			updatedAt: new Date().toISOString(),
		};
		sessionStorage.setItem(storageKey(variant, id), JSON.stringify(payload));
	} catch {
		/* quota / private mode */
	}
}

export function clearResearchWizardDraft(
	variant: "lecturer" | "student",
	userId?: string | null,
): void {
	if (typeof window === "undefined") return;
	const id = userId?.trim();
	if (!id) return;
	try {
		sessionStorage.removeItem(storageKey(variant, id));
	} catch {
		/* ignore */
	}
}

/** Fingerprint of inputs that affect idea generation — used to avoid wiping results on Back → Next. */
export function researchWizardInputKey(input: {
	discipline: string;
	topic: string;
	scope: ResearchScope | "";
	citationStyle: CitationStyle | "";
	sources: ResearchSourceSelection;
}): string {
	const sources = {
		documentIds: [...(input.sources.documentIds ?? [])].sort(),
		datasetIds: [...(input.sources.datasetIds ?? [])].sort(),
		noteIds: [...(input.sources.noteIds ?? [])].sort(),
		projectIds: [...(input.sources.projectIds ?? [])].sort(),
	};
	return JSON.stringify({
		discipline: input.discipline,
		topic: input.topic.trim(),
		scope: input.scope,
		citationStyle: input.citationStyle,
		sources,
	});
}
