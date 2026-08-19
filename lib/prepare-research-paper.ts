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
import { stagePaperSources } from "@/lib/research-paper-sources";
import type { StudentTokenQuota } from "@/lib/student-tokens";

export type PreparedResearchPaper = {
	prompt: string;
	figureDocumentIds: string[];
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
		: hasSelectedSources
			? fetchResearchSourceContextFromApi(context.sources!, { signal: options?.signal }).then((ctx) => ({
					outline: outline!,
					sourceContext: ctx,
				}))
			: Promise.resolve({ outline: outline!, sourceContext: undefined as string | undefined });

	const [outlineResult, vizResult] = await Promise.all([outlineTask, vizTask]);

	outline = outlineResult.outline;
	sourceContext = outlineResult.sourceContext;

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
	};
}
