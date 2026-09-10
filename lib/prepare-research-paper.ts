import type { CitationStyle } from "@/lib/citation-styles";
import {
	fetchResearchOutlineFromApi,
	fetchResearchSourceContextFromApi,
	fetchResearchVisualizationsFromApi,
} from "@/lib/research-api";
import { getDisciplineLabel } from "@/lib/research-disciplines";
import { buildResearchPaperPrompt } from "@/lib/research-generate";
import { peekOutlinePageContext, resolveOutlinePageContext } from "@/lib/research-outline-context";
import { loadSavedOutline, saveResearchOutline } from "@/lib/research-outline-storage";
import { extractLiveVisualizationMarkdown } from "@/lib/research-live-figures";
import { stagePaperSources } from "@/lib/research-paper-sources";
import type { StudentTokenQuota } from "@/lib/student-tokens";

export type PreparedResearchPaper = {
	prompt: string;
	figureDocumentIds: string[];
	/** Canonical dataset tables + research-chart fences for live draft injection. */
	visualizationMarkdown: string;
};

const EMPTY_VIZ = {
	artifacts: "",
	figureAppendix: "",
	hasSavedFigures: false,
	figureDocumentIds: [] as string[],
};

export async function prepareResearchPaperPrompt(
	key: string,
	citationStyle: CitationStyle,
	options?: { onTokenQuota?: (quota: StudentTokenQuota) => void; signal?: AbortSignal },
): Promise<PreparedResearchPaper | null> {
	const context = resolveOutlinePageContext(key) ?? peekOutlinePageContext(key);
	if (!context) return null;

	stagePaperSources(context.sources);

	const datasetIds = context.sources?.datasetIds ?? [];
	const projectIds = context.sources?.projectIds ?? [];
	const documentIds = context.sources?.documentIds ?? [];
	const hasSelectedSources = Boolean(
		context.sources &&
			(documentIds.length ||
				datasetIds.length ||
				(context.sources.questionnaireIds?.length ?? 0) ||
				projectIds.length),
	);

	const disciplineLabel = getDisciplineLabel(context.discipline);
	const topic = context.idea.title || context.topic;

	const vizTask =
		datasetIds.length || projectIds.length || documentIds.length
			? fetchResearchVisualizationsFromApi(
					{
						datasetIds,
						projectIds,
						documentIds,
						topic,
					},
					{ signal: options?.signal },
				).catch(() => EMPTY_VIZ)
			: Promise.resolve(EMPTY_VIZ);

	let outline =
		context.scope === "assignment"
			? null
			: loadSavedOutline(context.idea, context.discipline, context.topic, context.scope);
	let sourceContext: string | undefined;

	const outlineTask = !outline?.trim()
		? fetchResearchOutlineFromApi(
				{
					idea: context.idea,
					disciplineLabel,
					topic: context.topic,
					scope: context.scope,
					sources: context.sources,
					assignmentInstructions: context.assignmentInstructions,
				},
				{ signal: options?.signal },
			).then((result) => {
				if (result.tokenQuota) options?.onTokenQuota?.(result.tokenQuota);
				saveResearchOutline({
					idea: context.idea,
					discipline: context.discipline,
					topic: context.topic,
					scope: context.scope,
					outline: result.outline,
					sources: context.sources,
					assignmentInstructions: context.assignmentInstructions,
				});
				return result;
			})
		: Promise.resolve({
				outline: outline!,
				sourceContext: undefined as string | undefined,
			});

	const sourceContextTask =
		hasSelectedSources && context.sources
			? fetchResearchSourceContextFromApi(context.sources, { signal: options?.signal }).catch(
					() => "",
				)
			: Promise.resolve("");

	const [outlineResult, vizResult, fetchedSourceContext] = await Promise.all([
		outlineTask,
		vizTask,
		sourceContextTask,
	]);

	outline = outlineResult.outline;
	sourceContext =
		(fetchedSourceContext || outlineResult.sourceContext || "").trim() || undefined;

	if (projectIds.length && !sourceContext?.trim()) {
		throw new Error(
			"Could not load the selected research notebook. Re-select the notebook and try again.",
		);
	}

	return {
		prompt: buildResearchPaperPrompt({
			idea: context.idea,
			topic: context.topic,
			disciplineLabel,
			scope: context.scope,
			outline,
			citationStyle,
			sourceContext,
			visualizationArtifacts: vizResult.artifacts || undefined,
			hasSavedFigures: vizResult.hasSavedFigures,
			assignmentInstructions: context.assignmentInstructions,
		}),
		figureDocumentIds: vizResult.figureDocumentIds,
		visualizationMarkdown: extractLiveVisualizationMarkdown(vizResult.artifacts || ""),
	};
}
