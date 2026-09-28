"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AulaLayout } from "@/components/AulaLayout";
import { ChatPanel } from "@/components/ChatPanel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ResearchLiveStreamStudio } from "@/components/research/ResearchLiveStreamStudio";
import {
	ResearchScopeRefineChips,
} from "@/components/research/ResearchScopeWorkspaceTools";
import { ResearchCitationToolbar } from "@/components/ResearchCitationToolbar";
import { Sidebar } from "@/components/Sidebar";
import { IconChevronLeft, IconDownload, IconFileText, IconStop } from "@/components/ui/ButtonIcon";
import { useAuth } from "@/hooks/useAuth";
import { useGarilSocket } from "@/hooks/useGarilSocket";
import {
	downloadResearchPaper,
	resolvePaperDisplayTitle,
	loadAllSavedPapers,
	removeAllSavedPapers,
	removeSavedPaper,
	saveResearchPaper,
	type SavedResearchPaper,
} from "@/lib/chat-research-storage";
import { downloadMarkdownAsPdf } from "@/lib/research-paper-pdf";
import {
	clearChatCitationStyle,
	isIntegratedResearchPrompt,
	resolveChatCitationStyle,
	resolveChatResearchScope,
	saveChatCitationStyle,
	saveChatResearchScope,
} from "@/lib/chat-research-citations";
import { formatResearchPaperReferences } from "@/lib/research-paper-references";
import { promoteBoldSectionsForDisplay } from "@/lib/research-paper-sections";
import {
	consumeChatPrefill,
	getGenerateResearchLabel,
	getScopeDocumentLabel,
	getScopeProjectEyebrow,
	type ResearchScope,
} from "@/lib/research-ideas";
import {
	isResearchWorkspacePath,
	parseScopeFromPathname,
} from "@/lib/research-generate-routes";
import { prepareResearchPaperPrompt } from "@/lib/prepare-research-paper";
import { loadLiveFigureMarkdown } from "@/lib/research-live-figures";
import { peekPaperSources } from "@/lib/research-paper-sources";
import { hasResearchSources } from "@/lib/research-paper-effort-evidence";
import { peekOutlinePageContext, resolveOutlinePageContext } from "@/lib/research-outline-context";
import { consumePendingResearchPaper } from "@/lib/research-paper-pending";
import { consumePendingResearchRefine } from "@/lib/research-paper-refine";
import { getScopeProfile, parseScopeFromPrompt } from "@/lib/research-scope-profiles";
import { fetchSavedResearchById } from "@/lib/research-api";
import { cancelResearchJob, fetchResearchJobById, startResearchPaperJob } from "@/lib/research-jobs-api";
import {
	clearTrackedResearchJob,
	getTrackedResearchJob,
	isTerminalResearchJobStatus,
	markTrackedResearchJobNotified,
	setTrackedResearchJob,
} from "@/lib/research-job-tracker";
import { ResearchPaperMarkdown } from "@/components/research/ResearchPaperMarkdown";
import { savedResearchPagePath } from "@/lib/saved-research-routes";
import { DEFAULT_CITATION_STYLE, type CitationStyle } from "@/lib/citation-styles";
import type { ChatMessage } from "@/lib/agent-events";

function readInitialChatState(): { input: string; citationStyle: CitationStyle } {
	const prefill = consumeChatPrefill();
	return { input: prefill, citationStyle: resolveChatCitationStyle(prefill) };
}

function SendIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
			<path d="m22 2-7 20-4-9-9-4 20-7z" strokeLinejoin="round" />
		</svg>
	);
}

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

export function GarilApp({ layout = "aula" }: { layout?: "aula" | "student" }) {
	const { user, loading: authLoading, setTokenQuota } = useAuth();
	const socketEnabled = !authLoading && Boolean(user);
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const savedIdFromUrl = searchParams.get("saved");
	const savedPaperVariant = layout === "student" ? "student" : "lecturer";
	const {
		status,
		messages,
		error,
		isBusy,
		sendPrompt,
		sendResearchPaper,
		resetSession,
		abort,
		sessionId,
	} = useGarilSocket({ enabled: socketEnabled });

	const [initialChat] = useState(readInitialChatState);
	const [input, setInput] = useState(initialChat.input);
	const [citationStyle, setCitationStyle] = useState(initialChat.citationStyle);
	const [documentScope, setDocumentScope] = useState<ResearchScope>(() => {
		if (typeof window === "undefined") return "journal";
		return (
			parseScopeFromPathname(window.location.pathname) ||
			resolveChatResearchScope(initialChat.input)
		);
	});
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const prefillFocusedRef = useRef(false);
	const autoGenerateRef = useRef(false);
	const pendingAutoGenerateRef = useRef(false);
	const pendingPaperKeyRef = useRef<string | null>(null);
	const researchFlowGenerationRef = useRef(false);
	const [researchFlowActive, setResearchFlowActive] = useState(false);
	const [paperPreparing, setPaperPreparing] = useState(false);
	const [paperPrepError, setPaperPrepError] = useState<string | null>(null);
	const [projectName, setProjectName] = useState<string | null>(null);
	const [backgroundJobId, setBackgroundJobId] = useState<string | null>(null);
	const [backgroundJobRunning, setBackgroundJobRunning] = useState(false);
	const [backgroundJobProgress, setBackgroundJobProgress] = useState(20);
	const [backgroundJobDraft, setBackgroundJobDraft] = useState("");
	const [backgroundFigureMarkdown, setBackgroundFigureMarkdown] = useState("");
	const [stoppingGeneration, setStoppingGeneration] = useState(false);
	const prepAbortRef = useRef<AbortController | null>(null);
	const stopRequestedRef = useRef(false);
	const draftLenRef = useRef(0);
	const [savedPapers, setSavedPapers] = useState<SavedResearchPaper[]>([]);
	const [viewingSaved, setViewingSaved] = useState<SavedResearchPaper | null>(null);
	const [saveNotice, setSaveNotice] = useState<string | null>(null);
	const [removingSavedId, setRemovingSavedId] = useState<string | null>(null);
	const [pendingDelete, setPendingDelete] = useState<
		{ mode: "one"; id: string; title: string } | { mode: "all"; count: number } | null
	>(null);
	const [previewOpen, setPreviewOpen] = useState(false);
	const prevBusyRef = useRef(false);

	const hasAssistantPaper = messages.some((m) => m.role === "assistant" && m.content.trim().length > 0);

	useEffect(() => {
		void loadAllSavedPapers().then(setSavedPapers);
	}, [user?.id]);

	useEffect(() => {
		if (!savedIdFromUrl) return;
		router.replace(savedResearchPagePath(savedIdFromUrl, savedPaperVariant));
	}, [savedIdFromUrl, savedPaperVariant, router]);

	const paperTopic =
		messages.find((m) => m.role === "user")?.content.trim() ??
		viewingSaved?.topic ??
		"";
	const lastAssistantMessage = [...messages]
		.reverse()
		.find((m) => m.role === "assistant" && m.content.trim());
	const paperContent = lastAssistantMessage?.content.trim() ?? "";
	const paperTokenUsage = lastAssistantMessage?.tokenUsage;
	const activePaperContent = viewingSaved?.content ?? paperContent;
	const formattedPaperContent = activePaperContent ? formatResearchPaperReferences(activePaperContent) : "";
	const paperTitle = resolvePaperDisplayTitle(formattedPaperContent || activePaperContent, paperTopic || "Research paper");
	const paperReady = Boolean(formattedPaperContent) && !isBusy && !backgroundJobRunning;
	const isStudent = layout === "student";
	const isResearchPaperRoute = isResearchWorkspacePath(pathname);
	const showResearchLoadingScreen =
		isResearchPaperRoute &&
		researchFlowActive &&
		!paperPrepError &&
		(paperPreparing || backgroundJobRunning || isBusy || !paperReady);
	const loadingProjectName =
		projectName?.trim() || paperTitle || getScopeProjectEyebrow(documentScope);
	const documentLabel = getScopeDocumentLabel(documentScope);

	const applyDocumentScope = useCallback((scope: ResearchScope | string | null | undefined) => {
		const next = getScopeProfile(scope).scope;
		saveChatResearchScope(next);
		setDocumentScope(next);
		return next;
	}, []);

	useEffect(() => {
		const fromPath = parseScopeFromPathname(pathname);
		if (fromPath) applyDocumentScope(fromPath);
	}, [pathname, applyDocumentScope]);

	const firstUserPrompt = messages.find((m) => m.role === "user")?.content.trim() ?? initialChat.input.trim();
	const showCitationToolbar =
		hasAssistantPaper &&
		!viewingSaved &&
		(isIntegratedResearchPrompt(firstUserPrompt) || paperContent.length > 0);

	const displayMessages: ChatMessage[] = viewingSaved
		? [
				{ id: `saved-u-${viewingSaved.id}`, role: "user", content: viewingSaved.topic },
				{
					id: `saved-a-${viewingSaved.id}`,
					role: "assistant",
					content: formatResearchPaperReferences(viewingSaved.content),
					...(viewingSaved.tokenUsage ? { tokenUsage: viewingSaved.tokenUsage } : {}),
				},
			]
		: messages;

	useEffect(() => {
		if (prevBusyRef.current && !isBusy && !viewingSaved) {
			if (paperTopic && paperContent.length > 400) {
				void saveResearchPaper(paperTopic, paperContent, {
					sessionId,
					tokenUsage: paperTokenUsage,
					sources:
						peekPaperSources() ??
						(() => {
							const key = searchParams.get("key")?.trim() || "";
							if (!key) return null;
							return (
								peekOutlinePageContext(key)?.sources ??
								resolveOutlinePageContext(key)?.sources ??
								null
							);
						})(),
				}).then((next) => {
					setSavedPapers(next);
					const saved =
						next.find((paper) => paper.topic.trim().toLowerCase() === paperTopic.trim().toLowerCase()) ??
						next[0];

					if (isResearchPaperRoute && researchFlowGenerationRef.current && saved?.id) {
						researchFlowGenerationRef.current = false;
						setResearchFlowActive(false);
						setViewingSaved(saved);
						// User is still on this page — keep the manuscript here; only open a tab if they left.
						if (typeof document !== "undefined" && document.hidden) {
							window.open(
								savedResearchPagePath(saved.id, savedPaperVariant),
								"_blank",
								"noopener,noreferrer",
							);
						}
						setSaveNotice(
							isStudent
								? "Research ready and saved to your history."
								: `${getScopeProjectEyebrow(documentScope)} ready — scroll to review the draft below.`,
						);
					} else {
						setSaveNotice(
							isStudent
								? "Research saved automatically to your history."
								: "Research saved to your library.",
						);
					}
					window.setTimeout(() => setSaveNotice(null), 8000);
				});
			}
		}
		prevBusyRef.current = isBusy;
	}, [
		isBusy,
		paperTopic,
		paperContent,
		paperTokenUsage,
		viewingSaved,
		sessionId,
		isStudent,
		isResearchPaperRoute,
		savedPaperVariant,
		searchParams,
	]);

	const handleSavePaper = () => {
		if (!paperTopic || !paperContent) return;
		void saveResearchPaper(paperTopic, paperContent, {
			sessionId,
			tokenUsage: paperTokenUsage,
			sources: peekPaperSources() ?? null,
		}).then((next) => {
			setSavedPapers(next);
			setSaveNotice("Research saved.");
			window.setTimeout(() => setSaveNotice(null), 4000);
		});
	};

	const paperMeta = useMemo(
		() => ({
			author: user?.name ?? null,
			department: user?.department ?? null,
			affiliation: user?.institution ?? null,
			fallbackTopic: paperTopic || initialChat.input.trim() || null,
		}),
		[user?.name, user?.department, user?.institution, paperTopic, initialChat.input],
	);

	const handleDownloadPdf = useCallback(() => {
		const content = viewingSaved?.content ?? paperContent;
		if (!content) return;
		const topic = viewingSaved?.topic ?? paperTopic;
		const title = resolvePaperDisplayTitle(content, topic || "research-paper");
		void downloadMarkdownAsPdf(formatResearchPaperReferences(content), title, {
			...paperMeta,
			fallbackTopic: topic || paperMeta.fallbackTopic,
		});
	}, [paperContent, paperTopic, paperMeta, viewingSaved]);

	const handleSelectSaved = (paper: SavedResearchPaper) => {
		setViewingSaved(paper);
		setSaveNotice(null);
		setPreviewOpen(false);
	};

	const handleRemoveSaved = useCallback(
		(id: string) => {
			const paper = savedPapers.find((p) => p.id === id);
			const title = paper
				? resolvePaperDisplayTitle(paper.content, paper.topic).slice(0, 120)
				: "Saved research";
			setPendingDelete({ mode: "one", id, title });
		},
		[savedPapers],
	);

	const handleRemoveAllSaved = useCallback(() => {
		if (savedPapers.length === 0) return;
		setPendingDelete({ mode: "all", count: savedPapers.length });
	}, [savedPapers.length]);

	const executePendingDelete = useCallback(() => {
		if (!pendingDelete) return;

		if (pendingDelete.mode === "one") {
			const { id } = pendingDelete;
			setRemovingSavedId(id);
			void removeSavedPaper(id, savedPapers)
				.then((result) => {
					setSavedPapers(result.papers);
					if (viewingSaved?.id === id) setViewingSaved(null);
					setSaveNotice(
						result.ok
							? "Research removed."
							: (result.error ?? "Could not remove research. Try again."),
					);
					window.setTimeout(() => setSaveNotice(null), 5000);
				})
				.catch(() => {
					setSaveNotice("Could not remove research.");
					window.setTimeout(() => setSaveNotice(null), 4000);
				})
				.finally(() => {
					setRemovingSavedId(null);
					setPendingDelete(null);
				});
			return;
		}

		setRemovingSavedId("__all__");
		void removeAllSavedPapers(savedPapers)
			.then((result) => {
				setSavedPapers(result.papers);
				if (result.ok) setViewingSaved(null);
				setSaveNotice(
					result.ok
						? "All saved research removed."
						: (result.error ?? "Some items could not be removed."),
				);
				window.setTimeout(() => setSaveNotice(null), 5000);
			})
			.catch(() => {
				setSaveNotice("Could not remove saved research.");
				window.setTimeout(() => setSaveNotice(null), 4000);
			})
			.finally(() => {
				setRemovingSavedId(null);
				setPendingDelete(null);
			});
	}, [pendingDelete, savedPapers, viewingSaved?.id]);

	const handleNewSession = () => {
		setViewingSaved(null);
		setPreviewOpen(false);
		clearChatCitationStyle();
		setCitationStyle(DEFAULT_CITATION_STYLE);
		resetSession();
	};

	const handleCitationPrompt = useCallback(
		(prompt: string, style: CitationStyle) => {
			setCitationStyle(style);
			setViewingSaved(null);
			sendPrompt(prompt);
		},
		[sendPrompt],
	);

	const adoptStartedJob = useCallback(
		async (job: { id: string; topic: string; progress?: number; draftContent?: string | null }) => {
			if (stopRequestedRef.current) {
				await cancelResearchJob(job.id);
				clearTrackedResearchJob(job.id);
				return false;
			}
			setTrackedResearchJob({ jobId: job.id, topic: job.topic });
			setBackgroundJobId(job.id);
			setBackgroundJobProgress((prev) => Math.max(prev, job.progress ?? 20, 20));
			if (typeof job.draftContent === "string" && job.draftContent.length > 0) {
				draftLenRef.current = job.draftContent.length;
				setBackgroundJobDraft(job.draftContent);
			} else {
				draftLenRef.current = 0;
				setBackgroundJobDraft("");
			}
			setBackgroundJobRunning(true);
			return true;
		},
		[],
	);

	const resetGenerationUi = useCallback((notice?: string) => {
		autoGenerateRef.current = false;
		researchFlowGenerationRef.current = false;
		setResearchFlowActive(false);
		setPaperPreparing(false);
		setBackgroundJobRunning(false);
		setBackgroundJobId(null);
		setBackgroundJobProgress(20);
		setBackgroundJobDraft("");
		draftLenRef.current = 0;
		setStoppingGeneration(false);
		setPaperPrepError(null);
		if (notice) {
			setSaveNotice(notice);
			window.setTimeout(() => setSaveNotice(null), 6000);
		}
	}, []);

	const handleStopGeneration = useCallback(async () => {
		if (stoppingGeneration) return;
		stopRequestedRef.current = true;
		setStoppingGeneration(true);
		prepAbortRef.current?.abort();
		if (isBusy) abort();

		const jobId = backgroundJobId ?? getTrackedResearchJob()?.jobId ?? null;
		if (jobId) {
			await cancelResearchJob(jobId);
			clearTrackedResearchJob(jobId);
		}
		resetGenerationUi("Generation stopped.");
	}, [abort, backgroundJobId, isBusy, resetGenerationUi, stoppingGeneration]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = input.trim();
		if (!trimmed || isBusy || backgroundJobRunning) return;
		setInput("");
		setViewingSaved(null);
		if (!hasAssistantPaper) {
			sendResearchPaper(trimmed);
		} else {
			sendPrompt(trimmed);
		}
	};

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		if (params.get("generate") === "1") {
			pendingAutoGenerateRef.current = true;
		}
		const paperKey = params.get("key")?.trim();
		const topicParam = params.get("topic")?.trim();
		if (topicParam) {
			setProjectName(topicParam);
		}
		if (paperKey) {
			pendingPaperKeyRef.current = paperKey;
			const context = peekOutlinePageContext(paperKey) ?? resolveOutlinePageContext(paperKey);
			if (context?.scope) {
				applyDocumentScope(context.scope);
			}
		}
		if (params.has("topic") || params.has("generate") || params.has("key")) {
			params.delete("topic");
			params.delete("generate");
			params.delete("key");
			const rest = params.toString();
			const nextUrl = `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`;
			window.history.replaceState(null, "", nextUrl);
		}
	}, [applyDocumentScope]);

	useEffect(() => {
		if (!pendingAutoGenerateRef.current || autoGenerateRef.current) return;
		if (authLoading || !user) return;
		if (isBusy || backgroundJobRunning || hasAssistantPaper || viewingSaved) return;
		stopRequestedRef.current = false;

		const refine = consumePendingResearchRefine();
		if (refine?.prompt?.trim()) {
			autoGenerateRef.current = true;
			pendingAutoGenerateRef.current = false;
			researchFlowGenerationRef.current = true;
			setResearchFlowActive(true);
			setViewingSaved(null);
			const displayTopic = refine.topic.trim();
			if (displayTopic) setProjectName(displayTopic);
			saveChatCitationStyle(refine.citationStyle);
			if (refine.scope) applyDocumentScope(refine.scope);
			setCitationStyle(refine.citationStyle);
			setInput(refine.prompt);
			setPaperPreparing(true);
			setPaperPrepError(null);
			setBackgroundJobProgress(20);
			setBackgroundJobDraft("");
			draftLenRef.current = 0;

			void startResearchPaperJob({
				prompt: refine.prompt,
				topic: displayTopic || undefined,
				sources: paperSourcesForJob(),
			})
				.then((job) => adoptStartedJob(job))
				.catch((startError) => {
					autoGenerateRef.current = false;
					setResearchFlowActive(false);
					researchFlowGenerationRef.current = false;
					setPaperPrepError(
						startError instanceof Error
							? startError.message
							: "Could not start research refinement.",
					);
				})
				.finally(() => setPaperPreparing(false));
			return;
		}

		const pending = consumePendingResearchPaper();
		const paperKey = pending?.key ?? pendingPaperKeyRef.current;
		pendingPaperKeyRef.current = null;

		if (paperKey) {
			autoGenerateRef.current = true;
			pendingAutoGenerateRef.current = false;
			researchFlowGenerationRef.current = true;
			setResearchFlowActive(true);
			let displayTopic = pending?.projectName?.trim() || "";
			if (pending?.projectName?.trim()) {
				setProjectName(pending.projectName.trim());
			} else {
				const context = resolveOutlinePageContext(paperKey) ?? peekOutlinePageContext(paperKey);
				if (context?.idea.title) {
					displayTopic = context.idea.title;
					setProjectName(context.idea.title);
				}
			}
			setPaperPreparing(true);
			setPaperPrepError(null);
			setBackgroundJobProgress(20);
			setBackgroundJobDraft("");
			setBackgroundFigureMarkdown("");
			draftLenRef.current = 0;
			prepAbortRef.current?.abort();
			const prepController = new AbortController();
			prepAbortRef.current = prepController;

			void prepareResearchPaperPrompt(paperKey, pending?.citationStyle ?? DEFAULT_CITATION_STYLE, {
				onTokenQuota: setTokenQuota,
				signal: prepController.signal,
			})
				.then(async (prepared) => {
					if (prepController.signal.aborted) return;
					const prompt = prepared?.prompt?.trim() ?? "";
					if (!prompt) {
						throw new Error("Could not prepare research paper.");
					}
					const style = pending?.citationStyle ?? DEFAULT_CITATION_STYLE;
					saveChatCitationStyle(style);
					const scope =
						parseScopeFromPrompt(prompt) ||
						(peekOutlinePageContext(paperKey) ?? resolveOutlinePageContext(paperKey))?.scope ||
						"journal";
					applyDocumentScope(scope);
					setCitationStyle(style);
					setInput(prompt);

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
							/* optional live figures */
						}
					}
					if (!prepController.signal.aborted && liveParts.length) {
						setBackgroundFigureMarkdown(liveParts.join("\n\n"));
					}

					const job = await startResearchPaperJob({
						prompt,
						topic: displayTopic || undefined,
						figureDocumentIds: prepared?.figureDocumentIds,
						visualizationMarkdown: prepared?.visualizationMarkdown,
						sources: paperSourcesForJob(paperKey),
					});
					await adoptStartedJob(job);
				})
				.catch((prepError) => {
					if (prepController.signal.aborted || (prepError instanceof Error && prepError.name === "AbortError")) {
						return;
					}
					autoGenerateRef.current = false;
					setResearchFlowActive(false);
					researchFlowGenerationRef.current = false;
					setPaperPrepError(
						prepError instanceof Error ? prepError.message : "Could not start research generation.",
					);
				})
				.finally(() => {
					if (prepAbortRef.current === prepController) prepAbortRef.current = null;
					setPaperPreparing(false);
				});
			return;
		}

		if (!input.trim()) return;

		autoGenerateRef.current = true;
		pendingAutoGenerateRef.current = false;
		researchFlowGenerationRef.current = true;
		setResearchFlowActive(true);
		setPaperPrepError(null);
		setBackgroundJobDraft("");
		draftLenRef.current = 0;
		applyDocumentScope(parseScopeFromPrompt(input) || resolveChatResearchScope(input));
		void startResearchPaperJob({
			prompt: input.trim(),
			topic: projectName?.trim() || undefined,
			sources: paperSourcesForJob(),
		})
			.then((job) => adoptStartedJob(job))
			.catch((startError) => {
				autoGenerateRef.current = false;
				setResearchFlowActive(false);
				researchFlowGenerationRef.current = false;
				setPaperPrepError(
					startError instanceof Error ? startError.message : "Could not start research generation.",
				);
			});
	}, [
		authLoading,
		user,
		input,
		isBusy,
		backgroundJobRunning,
		hasAssistantPaper,
		viewingSaved,
		projectName,
		setTokenQuota,
		applyDocumentScope,
		adoptStartedJob,
	]);

	useEffect(() => {
		if (!paperPreparing || backgroundJobRunning) return;
		const timer = window.setInterval(() => {
			setBackgroundJobProgress((prev) => (prev < 38 ? prev + 1 : prev));
		}, 700);
		return () => window.clearInterval(timer);
	}, [paperPreparing, backgroundJobRunning]);

	useEffect(() => {
		if (!backgroundJobId || !backgroundJobRunning) return;

		let cancelled = false;

		const finishWithPaper = async (savedResearchId: string, jobId: string) => {
			markTrackedResearchJobNotified(jobId);
			const paper = await fetchSavedResearchById(savedResearchId);
			if (cancelled) return;
			if (!paper) {
				setPaperPrepError("Research finished but the saved paper could not be loaded.");
				setBackgroundJobRunning(false);
				setResearchFlowActive(false);
				researchFlowGenerationRef.current = false;
				return;
			}

			setSavedPapers((prev) => {
				const without = prev.filter((p) => p.id !== paper.id);
				return [paper, ...without];
			});
			setViewingSaved(paper);
			setBackgroundJobRunning(false);
			researchFlowGenerationRef.current = false;
			setResearchFlowActive(false);

			if (isResearchPaperRoute) {
				// Stay on the live draft if the user is still here; open a tab only if they navigated away.
				if (typeof document !== "undefined" && document.hidden) {
					window.open(
						savedResearchPagePath(paper.id, savedPaperVariant),
						"_blank",
						"noopener,noreferrer",
					);
				}
				setSaveNotice(
					isStudent
						? "Research ready and saved to your history."
						: `${getScopeProjectEyebrow(documentScope)} ready — review the draft below.`,
				);
			} else {
				setSaveNotice(
					isStudent
						? "Research saved automatically to your history."
						: "Research saved to your library.",
				);
			}
			window.setTimeout(() => setSaveNotice(null), 8000);
			clearTrackedResearchJob(jobId);
		};

		const poll = async () => {
			const job = await fetchResearchJobById(backgroundJobId);
			if (cancelled || !job) return;

			setBackgroundJobProgress((prev) => Math.max(prev, job.progress ?? 20, 20));
			if (typeof job.draftContent === "string" && job.draftContent.length > draftLenRef.current) {
				draftLenRef.current = job.draftContent.length;
				setBackgroundJobDraft(job.draftContent);
			}

			if (job.status === "completed" && job.savedResearchId) {
				setBackgroundJobProgress(100);
				await finishWithPaper(job.savedResearchId, job.id);
				return;
			}

			if (isTerminalResearchJobStatus(job.status)) {
				markTrackedResearchJobNotified(job.id);
				clearTrackedResearchJob(job.id);
				setBackgroundJobRunning(false);
				setResearchFlowActive(false);
				researchFlowGenerationRef.current = false;
				if (job.status === "cancelled") {
					setPaperPrepError(null);
					setSaveNotice("Generation stopped.");
					window.setTimeout(() => setSaveNotice(null), 6000);
					return;
				}
				setPaperPrepError(job.error || "Research generation failed.");
			}
		};

		void poll();
		const timer = window.setInterval(() => void poll(), 800);
		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, [
		backgroundJobId,
		backgroundJobRunning,
		isResearchPaperRoute,
		isStudent,
		savedPaperVariant,
	]);

	useEffect(() => {
		if (!isResearchPaperRoute || authLoading || !user) return;
		const tracked = getTrackedResearchJob();
		if (!tracked || tracked.notified || backgroundJobRunning || backgroundJobId) return;

		let cancelled = false;
		void fetchResearchJobById(tracked.jobId).then((job) => {
			if (cancelled || !job) return;
			if (!isTerminalResearchJobStatus(job.status)) {
				setBackgroundJobId(job.id);
				setBackgroundJobProgress((prev) => Math.max(prev, job.progress ?? 20, 20));
				if (typeof job.draftContent === "string" && job.draftContent.length > 0) {
					draftLenRef.current = job.draftContent.length;
					setBackgroundJobDraft(job.draftContent);
				}
				setBackgroundJobRunning(true);
				setResearchFlowActive(true);
				setProjectName((prev) => prev || job.topic);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [isResearchPaperRoute, authLoading, user, backgroundJobRunning, backgroundJobId]);

	useEffect(() => {
		if (pendingAutoGenerateRef.current || !input.trim() || prefillFocusedRef.current) return;
		prefillFocusedRef.current = true;
		inputRef.current?.focus();
	}, [input]);

	const connectionLabel =
		status === "connected" ? "Connected" : status === "connecting" ? "Connecting…" : "Offline";
	const connectionTone =
		status === "connected" ? "online" : status === "connecting" ? "pending" : "offline";

	const handleSuggestionClick = useCallback((topic: string) => {
		setInput(topic);
		inputRef.current?.focus();
	}, []);

	const handleRefineChip = useCallback(
		(prompt: string) => {
			const trimmed = prompt.trim();
			if (!trimmed || isBusy || backgroundJobRunning || status !== "connected") return;
			setViewingSaved(null);
			sendPrompt(trimmed);
		},
		[backgroundJobRunning, isBusy, sendPrompt, status],
	);

	const researchHomeHref = isStudent ? "/student/research" : "/research";
	const showWorkspaceBack = isStudent || isResearchWorkspacePath(pathname);

	const workspace = (
		<>
			<div className="chat-workspace">
				<header className="chat-workspace-header">
					<div className="chat-workspace-header-main">
						<div className="chat-workspace-heading">
							{showWorkspaceBack ? (
								<Link href={researchHomeHref} className="chat-workspace-back">
									<IconChevronLeft size={15} />
									Research Assistant
								</Link>
							) : null}
							<div className="chat-workspace-title-row">
								<div className="chat-workspace-title-block">
									<p className="chat-workspace-kicker">{documentLabel}</p>
									<h1 className="chat-workspace-title">{getScopeProjectEyebrow(documentScope)} workspace</h1>
								</div>
								<span className={`chat-status-badge chat-status-badge-${connectionTone}`}>
									<span className="chat-status-dot" aria-hidden />
									{connectionLabel}
								</span>
							</div>
							<p className="chat-workspace-lead">
								Draft a cited {documentLabel}, refine citation style, and export to PDF.
							</p>
						</div>
					</div>
					<div className="chat-workspace-actions">
						{hasAssistantPaper && !isBusy ? (
							<>
								{paperReady ? (
									<button type="button" className="chat-workspace-btn" onClick={() => setPreviewOpen(true)}>
										<IconFileText size={15} />
										Preview
									</button>
								) : null}
								<button type="button" className="chat-workspace-btn" onClick={handleDownloadPdf}>
									<IconDownload size={15} />
									Download PDF
								</button>
								<button type="button" className="chat-workspace-btn" onClick={handleSavePaper}>
									Save to library
								</button>
							</>
						) : null}
						<button
							type="button"
							className="chat-workspace-btn chat-workspace-btn-new"
							onClick={handleNewSession}
							disabled={isBusy}
						>
							New session
						</button>
					</div>
				</header>

				<div className="chat-workspace-body">
					{showResearchLoadingScreen ? (
						<div className="chat-main research-paper-loading-host research-live-studio-host">
							<ResearchLiveStreamStudio
								projectName={loadingProjectName}
								scope={documentScope}
								draft={backgroundJobDraft}
								figureMarkdown={backgroundFigureMarkdown}
								progress={Math.max(backgroundJobProgress, 20)}
								preparing={paperPreparing && !backgroundJobRunning}
								streaming={paperPreparing || backgroundJobRunning}
								complete={false}
								studentUI={isStudent}
								stopping={stoppingGeneration}
								showBackLink={false}
								embedded
								onStop={() => void handleStopGeneration()}
							/>
						</div>
					) : (
						<>
					<Sidebar
						savedPapers={savedPapers}
						activeSavedId={viewingSaved?.id ?? null}
						onSelectSaved={handleSelectSaved}
						onRemoveSaved={handleRemoveSaved}
						onRemoveAllSaved={handleRemoveAllSaved}
						removingSavedId={removingSavedId}
						onDownloadSaved={(paper) => void downloadResearchPaper(paper, paperMeta)}
					/>

					<div className={`chat-main${viewingSaved ? " chat-main-reviewing" : ""}`}>
						{viewingSaved && (
							<div className="chat-mode-banner" role="status">
								<div className="chat-mode-banner-copy">
									<span className="chat-mode-banner-label">Library</span>
									<p className="chat-mode-banner-text">
										{resolvePaperDisplayTitle(viewingSaved.content, viewingSaved.topic)}
									</p>
								</div>
								<div className="chat-mode-banner-actions">
									<button type="button" className="chat-mode-banner-btn" onClick={() => setViewingSaved(null)}>
										Back to live session
									</button>
									<button
										type="button"
										className="chat-mode-banner-btn chat-mode-banner-btn-danger"
										disabled={removingSavedId !== null}
										onClick={() => handleRemoveSaved(viewingSaved.id)}
									>
										Remove
									</button>
								</div>
							</div>
						)}

						<div className="chat-main-scroll">
							{socketEnabled && (status === "disconnected" || status === "error") && (
								<div className="chat-toast chat-toast-error" role="alert">
									{error ??
										"Not connected. Start the backend with npm run dev:backend (port 3141), then refresh."}
								</div>
							)}
							{saveNotice && !viewingSaved && (
								<div className="chat-toast chat-toast-success">{saveNotice}</div>
							)}
							{error && status === "connected" && (
								<div className="chat-toast chat-toast-error">{error}</div>
							)}
							{paperPrepError && (
								<div className="chat-toast chat-toast-error" role="alert">
									{paperPrepError}
								</div>
							)}
							<ChatPanel
								messages={displayMessages}
								isBusy={(isBusy || paperPreparing || backgroundJobRunning) && !viewingSaved}
								scope={documentScope}
								onSuggestionClick={handleSuggestionClick}
								documentMode={Boolean(viewingSaved)}
							/>
						</div>

						{!viewingSaved && (
							<>
						<ResearchCitationToolbar
							visible={showCitationToolbar}
							disabled={isBusy || status !== "connected"}
							citationStyle={citationStyle}
							onCitationStyleChange={setCitationStyle}
							onApplyStyle={handleCitationPrompt}
							onUpdateReferences={handleCitationPrompt}
						/>

						<ResearchScopeRefineChips
							scope={documentScope}
							visible={hasAssistantPaper && !viewingSaved}
							disabled={isBusy || backgroundJobRunning || status !== "connected"}
							onSelect={handleRefineChip}
						/>

						<form className="chat-composer" onSubmit={handleSubmit}>
							<div className="chat-composer-card">
								<label className="sr-only" htmlFor="chat-composer-input">
									Research topic or follow-up message
								</label>
								<textarea
									id="chat-composer-input"
									ref={inputRef}
									rows={2}
									placeholder={
										hasAssistantPaper
											? "Ask for revisions, expand a section, or change emphasis…"
											: `Enter a research topic to generate a full cited ${documentLabel}…`
									}
									value={input}
									onChange={(e) => setInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && !e.shiftKey) {
											e.preventDefault();
											handleSubmit(e);
										}
									}}
									disabled={status !== "connected" || backgroundJobRunning}
								/>
								<div className="chat-composer-footer">
									{isBusy || backgroundJobRunning || paperPreparing ? (
										<button
											type="button"
											className="chat-composer-stop"
											onClick={() => {
												if (backgroundJobRunning || paperPreparing) {
													void handleStopGeneration();
													return;
												}
												abort();
											}}
											disabled={stoppingGeneration}
										>
											<IconStop size={14} />
											{stoppingGeneration ? "Stopping…" : "Stop generation"}
										</button>
									) : (
										<p className="chat-composer-hint">
											{hasAssistantPaper
												? "Enter to send · Shift+Enter for newline"
												: `First message generates a complete ${documentLabel} with in-text citations`}
										</p>
									)}
									<button
										type="submit"
										className="chat-composer-send"
										disabled={!input.trim() || isBusy || backgroundJobRunning || status !== "connected"}
										aria-label={
											hasAssistantPaper ? "Send message" : getGenerateResearchLabel(documentScope)
										}
									>
										<SendIcon />
										<span>{hasAssistantPaper ? "Send" : "Generate"}</span>
									</button>
								</div>
							</div>
						</form>
							</>
						)}
					</div>
						</>
					)}
				</div>
			</div>

			<ConfirmDialog
				open={pendingDelete !== null}
				title={pendingDelete?.mode === "all" ? "Clear all saved research?" : "Delete saved research?"}
				description={
					pendingDelete?.mode === "all"
						? `This will permanently remove all ${pendingDelete.count} saved papers from your library. This action cannot be undone.`
						: pendingDelete?.mode === "one"
							? `“${pendingDelete.title}” will be removed from your saved research library. This cannot be undone.`
							: ""
				}
				confirmLabel={pendingDelete?.mode === "all" ? "Clear all" : "Delete"}
				loading={removingSavedId !== null}
				onConfirm={executePendingDelete}
				onCancel={() => {
					if (removingSavedId !== null) return;
					setPendingDelete(null);
				}}
			/>

			{previewOpen && formattedPaperContent && (
				<div
					className="research-history-modal-backdrop"
					role="presentation"
					onClick={() => setPreviewOpen(false)}
				>
					<div
						className="research-history-modal"
						role="dialog"
						aria-modal="true"
						aria-labelledby="paper-preview-title"
						onClick={(event) => event.stopPropagation()}
					>
						<header className="research-history-modal-head">
							<div>
								<h3 id="paper-preview-title">{paperTitle}</h3>
								<p className="research-history-modal-meta">Preview · download when ready</p>
							</div>
							<button type="button" className="research-history-modal-close" onClick={() => setPreviewOpen(false)}>
								Close
							</button>
						</header>
						<div className="research-history-modal-body research-markdown-panel">
							<ResearchPaperMarkdown
								content={promoteBoldSectionsForDisplay(formattedPaperContent)}
							/>
						</div>
						<footer className="research-history-modal-foot">
							<button type="button" className="chat-workspace-btn" onClick={() => setPreviewOpen(false)}>
								Close
							</button>
							<button type="button" className="chat-workspace-btn chat-workspace-btn-new" onClick={handleDownloadPdf}>
								<IconDownload size={16} />
								Download PDF
							</button>
						</footer>
					</div>
				</div>
			)}
		</>
	);

	return layout === "student" ? (
		<div className="stu-research-paper-page">{workspace}</div>
	) : (
		<AulaLayout showRightPanel={false} fullHeight hideTopBar>
			{isResearchWorkspacePath(pathname) ? (
				<div className="research-paper-workspace-page">{workspace}</div>
			) : (
				workspace
			)}
		</AulaLayout>
	);
}
