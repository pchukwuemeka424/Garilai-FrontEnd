"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { AulaLayout } from "@/components/AulaLayout";
import { ResearchLiveStreamStudio } from "@/components/research/ResearchLiveStreamStudio";
import { ResearchPaperMarkdown } from "@/components/research/ResearchPaperMarkdown";
import { StudentLayout } from "@/components/StudentLayout";
import { IconChevronLeft } from "@/components/ui/ButtonIcon";
import {
	loadChatCitationStyle,
	saveChatCitationStyle,
} from "@/lib/chat-research-citations";
import { CITATION_STYLES, DEFAULT_CITATION_STYLE } from "@/lib/citation-styles";
import { prepareResearchPaperPrompt } from "@/lib/prepare-research-paper";
import { researchScopeBriefPath } from "@/lib/research-generate-routes";
import { getScopeDocumentLabel, getScopeProjectEyebrow } from "@/lib/research-ideas";
import {
	cancelResearchJob,
	fetchResearchJobById,
	startResearchPaperJob,
} from "@/lib/research-jobs-api";
import {
	clearTrackedResearchJob,
	isTerminalResearchJobStatus,
	markTrackedResearchJobNotified,
	setTrackedResearchJob,
} from "@/lib/research-job-tracker";
import {
	peekOutlinePageContext,
	resolveOutlinePageContext,
} from "@/lib/research-outline-context";
import { hasResearchSources } from "@/lib/research-paper-effort-evidence";
import { consumePendingResearchPaper } from "@/lib/research-paper-pending";
import { peekPaperSources } from "@/lib/research-paper-sources";
import { injectLiveVisualsIntoDraft, loadLiveFigureMarkdown } from "@/lib/research-live-figures";
import { savedResearchPagePath } from "@/lib/saved-research-routes";

const POLL_MS = 800;

type Props = {
	variant?: "lecturer" | "student";
};

function paperSourcesForJob(paperKey?: string | null) {
	const staged = peekPaperSources();
	if (hasResearchSources(staged)) return staged;
	if (paperKey) {
		const fromOutline =
			peekOutlinePageContext(paperKey)?.sources ?? resolveOutlinePageContext(paperKey)?.sources ?? null;
		if (hasResearchSources(fromOutline)) return fromOutline;
	}
	return staged;
}

export function ResearchLiveGeneratePage({ variant = "lecturer" }: Props) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const isStudent = variant === "student";
	const key = searchParams.get("key")?.trim() ?? "";
	const topicFromQuery = searchParams.get("topic")?.trim() ?? "";

	const [projectName, setProjectName] = useState(topicFromQuery || "Research document");
	const [scope, setScope] = useState<string | null>(null);
	const [preparing, setPreparing] = useState(true);
	const [progress, setProgress] = useState(20);
	const [draft, setDraft] = useState("");
	const [figureMarkdown, setFigureMarkdown] = useState("");
	const [jobId, setJobId] = useState<string | null>(null);
	const [running, setRunning] = useState(false);
	const [complete, setComplete] = useState(false);
	const [stopping, setStopping] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [backHref, setBackHref] = useState(isStudent ? "/student/research" : "/research");

	const startedRef = useRef(false);
	const stopRequestedRef = useRef(false);
	const prepAbortRef = useRef<AbortController | null>(null);
	const jobIdRef = useRef<string | null>(null);
	const draftLenRef = useRef(0);

	const documentLabel = getScopeDocumentLabel(scope);
	const eyebrow = getScopeProjectEyebrow(scope);
	const researchPath = isStudent ? "/student/research" : "/research";
	const streaming = (preparing || running) && !complete && !error;
	const hasDraft = draft.trim().length > 0;

	useEffect(() => {
		jobIdRef.current = jobId;
	}, [jobId]);

	useEffect(() => {
		if (!key || startedRef.current) return;
		startedRef.current = true;

		const styleFromQuery = searchParams.get("style")?.trim() ?? "";
		const parsedStyleFromQuery = styleFromQuery
			? (CITATION_STYLES.find(
					(s) =>
						s.id === styleFromQuery ||
						s.label.toLowerCase() === styleFromQuery.toLowerCase(),
				)?.id ?? null)
			: null;

		const context = resolveOutlinePageContext(key) ?? peekOutlinePageContext(key);
		const pending = consumePendingResearchPaper();
		const citationStyle =
			parsedStyleFromQuery ||
			pending?.citationStyle ||
			context?.citationStyle ||
			loadChatCitationStyle() ||
			DEFAULT_CITATION_STYLE;

		saveChatCitationStyle(citationStyle);

		const displayTopic =
			pending?.projectName?.trim() ||
			topicFromQuery ||
			context?.idea.title?.trim() ||
			context?.topic?.trim() ||
			"Research document";
		setProjectName(displayTopic);
		setScope(context?.scope ?? null);
		if (context?.returnTo?.trim()) {
			setBackHref(context.returnTo.trim());
		} else if (context?.scope) {
			setBackHref(
				researchScopeBriefPath(context.scope, isStudent ? "student" : "lecturer", context.discipline),
			);
		}

		if (!context) {
			setPreparing(false);
			setError("Generation context was lost. Go back and start again.");
			return;
		}

		stopRequestedRef.current = false;
		setPreparing(true);
		setError(null);
		setProgress(20);
		setDraft("");
		prepAbortRef.current?.abort();
		const prepController = new AbortController();
		prepAbortRef.current = prepController;

		void prepareResearchPaperPrompt(key, citationStyle, { signal: prepController.signal })
			.then(async (prepared) => {
				if (prepController.signal.aborted || stopRequestedRef.current) return;
				const prompt = prepared?.prompt?.trim() ?? "";
				if (!prompt) throw new Error("Could not prepare research paper.");

				const figureIds = prepared?.figureDocumentIds ?? [];
				const vizMarkdown = prepared?.visualizationMarkdown?.trim() ?? "";
				const liveParts: string[] = [];
				if (vizMarkdown) liveParts.push(vizMarkdown);
				if (figureIds.length) {
					try {
						const figures = await loadLiveFigureMarkdown(figureIds, {
							signal: prepController.signal,
						});
						if (!prepController.signal.aborted && figures.trim()) {
							liveParts.push(figures);
						}
					} catch {
						/* Live figures are optional; generation can continue without them. */
					}
				}
				if (!prepController.signal.aborted && liveParts.length) {
					setFigureMarkdown(liveParts.join("\n\n"));
				}

				const job = await startResearchPaperJob({
					prompt,
					topic: displayTopic || undefined,
					figureDocumentIds: prepared?.figureDocumentIds,
					visualizationMarkdown: prepared?.visualizationMarkdown,
					sources: paperSourcesForJob(key),
				});

				if (stopRequestedRef.current) {
					await cancelResearchJob(job.id);
					clearTrackedResearchJob(job.id);
					return;
				}

				setTrackedResearchJob({ jobId: job.id, topic: job.topic || displayTopic });
				setJobId(job.id);
				setProgress((prev) => Math.max(prev, job.progress ?? 20, 20));
				if (job.draftContent?.trim()) {
					draftLenRef.current = job.draftContent.length;
					setDraft(job.draftContent);
				}
				setRunning(true);
			})
			.catch((prepError) => {
				if (prepController.signal.aborted || (prepError instanceof Error && prepError.name === "AbortError")) {
					return;
				}
				if (stopRequestedRef.current) return;
				setError(
					prepError instanceof Error ? prepError.message : "Could not start research generation.",
				);
			})
			.finally(() => {
				if (prepAbortRef.current === prepController) prepAbortRef.current = null;
				setPreparing(false);
			});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key]);

	useEffect(() => {
		if (!jobId || !running) return;

		let cancelled = false;

		const finishWithPaper = async (savedResearchId: string, finishedJobId: string) => {
			markTrackedResearchJobNotified(finishedJobId);
			clearTrackedResearchJob(finishedJobId);
			setComplete(true);
			setProgress(100);
			setRunning(false);
			router.replace(savedResearchPagePath(savedResearchId, isStudent ? "student" : "lecturer"));
		};

		const poll = async () => {
			const job = await fetchResearchJobById(jobId);
			if (cancelled || !job) return;

			setProgress((prev) => Math.max(prev, job.progress ?? 20, 20));
			if (typeof job.draftContent === "string" && job.draftContent.length > draftLenRef.current) {
				draftLenRef.current = job.draftContent.length;
				setDraft(job.draftContent);
			}

			if (job.status === "completed" && job.savedResearchId) {
				await finishWithPaper(job.savedResearchId, job.id);
				return;
			}

			if (isTerminalResearchJobStatus(job.status)) {
				markTrackedResearchJobNotified(job.id);
				clearTrackedResearchJob(job.id);
				setRunning(false);
				if (job.status === "cancelled") {
					setError("Generation stopped.");
					return;
				}
				setError(job.error || "Research generation failed.");
			}
		};

		void poll();
		const timer = window.setInterval(() => void poll(), POLL_MS);
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, [jobId, running, router, isStudent]);

	const handleStop = useCallback(async () => {
		if (stopping) return;
		stopRequestedRef.current = true;
		setStopping(true);
		prepAbortRef.current?.abort();
		const id = jobIdRef.current;
		try {
			if (id) {
				await cancelResearchJob(id);
				clearTrackedResearchJob(id);
			}
			setRunning(false);
			setPreparing(false);
			setError("Generation stopped.");
		} finally {
			setStopping(false);
		}
	}, [stopping]);

	const emptyState = (
		<div className="rg-studio-shell rg-studio-shell-empty">
			<Link href={researchPath} className="rg-studio-back">
				<IconChevronLeft size={16} />
				Research Assistant
			</Link>
			<div className="rg-studio-empty">
				<p className="rg-studio-kicker">GARIL AI</p>
				<h1>Nothing to generate</h1>
				<p>Open generation from a research brief or outline to continue.</p>
			</div>
		</div>
	);

	const errorState = (
		<div className="rg-studio-shell rg-studio-shell-empty">
			<Link href={backHref} className="rg-studio-back">
				<IconChevronLeft size={16} />
				Back
			</Link>
			<div className="rg-studio-empty">
				<p className="rg-studio-kicker">{eyebrow}</p>
				<h1>Could not finish your {documentLabel}</h1>
				<p>{error}</p>
				<div className="rg-studio-empty-actions">
					<Link href={backHref} className="rg-studio-btn rg-studio-btn-primary">
						Return to brief
					</Link>
					<Link href={researchPath} className="rg-studio-btn">
						Research Assistant
					</Link>
				</div>
			</div>
			{hasDraft ? (
				<article className="rg-studio-page rg-studio-page-error">
					<p className="rg-studio-page-note">Draft captured before stop</p>
					<div className="rg-studio-prose">
						<ResearchPaperMarkdown
							content={injectLiveVisualsIntoDraft(draft, figureMarkdown, scope)}
							allowImages
						/>
					</div>
				</article>
			) : null}
		</div>
	);

	const liveState = (
		<ResearchLiveStreamStudio
			projectName={projectName}
			scope={scope}
			draft={draft}
			figureMarkdown={figureMarkdown}
			progress={progress}
			preparing={preparing}
			streaming={streaming}
			complete={complete}
			studentUI={isStudent}
			stopping={stopping}
			backHref={backHref}
			onStop={() => void handleStop()}
		/>
	);

	const body = !key ? emptyState : error && !running && !preparing && !complete ? errorState : liveState;

	return isStudent ? <StudentLayout>{body}</StudentLayout> : <AulaLayout showRightPanel={false}>{body}</AulaLayout>;
}
