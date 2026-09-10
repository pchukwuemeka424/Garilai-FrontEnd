"use client";

import { useEffect, useRef } from "react";

import type { ChatMessage } from "@/lib/agent-events";
import { APP_NAME } from "@/lib/brand";
import { getScopeDocumentLabel } from "@/lib/research-ideas";
import { promoteBoldSectionsForDisplay } from "@/lib/research-paper-sections";
import { formatTokenUsage } from "@/lib/token-usage";
import { ResearchPaperMarkdown } from "@/components/research/ResearchPaperMarkdown";

const SUGGESTIONS = [
	"The impact of large language models on academic integrity in higher education",
	"A systematic review of renewable energy adoption in Sub-Saharan Africa",
	"Machine learning approaches to early disease detection in clinical settings",
];

type Props = {
	messages: ChatMessage[];
	isBusy: boolean;
	scope?: string | null;
	onSuggestionClick?: (text: string) => void;
	/** Library / saved-paper review — manuscript-first, no chat chrome. */
	documentMode?: boolean;
};

function GeneratingBody({ label, detail }: { label: string; detail?: string }) {
	return (
		<div className="chat-generating" role="status" aria-live="polite">
			<div className="chat-generating-dots" aria-hidden>
				<span />
				<span />
				<span />
			</div>
			<div>
				<p className="chat-generating-label">{label}</p>
				{detail && <p className="chat-generating-detail">{detail}</p>}
			</div>
		</div>
	);
}

function roleLabel(msg: ChatMessage): string {
	if (msg.role === "user") return "You";
	if (msg.role === "assistant") return APP_NAME;
	if (msg.role === "tool") return msg.toolName ?? "Tool";
	return "System";
}

function isSubstantialPaper(content: string): boolean {
	return content.trim().length > 280;
}

function getScrollParent(node: HTMLElement | null): HTMLElement | null {
	let el = node?.parentElement ?? null;
	while (el) {
		const { overflowY } = window.getComputedStyle(el);
		if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") return el;
		el = el.parentElement;
	}
	return null;
}

export function ChatPanel({
	messages,
	isBusy,
	scope = null,
	onSuggestionClick,
	documentMode = false,
}: Props) {
	const rootRef = useRef<HTMLDivElement>(null);
	const endRef = useRef<HTMLDivElement>(null);
	const stickToBottomRef = useRef(true);
	const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
	const assistantHasText = Boolean(lastAssistant?.content.trim());
	const showEmpty = messages.length === 0 && !isBusy;
	const documentLabel = getScopeDocumentLabel(scope);
	const hasPaper = messages.some((m) => m.role === "assistant" && isSubstantialPaper(m.content));
	const studioMode = documentMode || hasPaper;
	const reviewKey = documentMode ? messages.find((m) => m.role === "assistant")?.id ?? "" : "";

	useEffect(() => {
		const parent = getScrollParent(rootRef.current);
		if (!parent) return;

		const onScroll = () => {
			const distance = parent.scrollHeight - parent.scrollTop - parent.clientHeight;
			stickToBottomRef.current = distance < 96;
		};
		onScroll();
		parent.addEventListener("scroll", onScroll, { passive: true });
		return () => parent.removeEventListener("scroll", onScroll);
	}, [studioMode, documentMode]);

	// Reviewing a saved paper: always open at the top (do not jump to References).
	useEffect(() => {
		if (!documentMode) return;
		const parent = getScrollParent(rootRef.current);
		if (!parent) return;
		stickToBottomRef.current = false;
		parent.scrollTo({ top: 0, behavior: "auto" });
	}, [documentMode, reviewKey]);

	// Live generation: follow new text only while the reader is near the bottom.
	useEffect(() => {
		if (documentMode) return;
		if (!stickToBottomRef.current) return;
		const parent = getScrollParent(rootRef.current);
		if (parent) {
			parent.scrollTo({
				top: parent.scrollHeight,
				behavior: isBusy ? "auto" : "smooth",
			});
			return;
		}
		endRef.current?.scrollIntoView({ behavior: isBusy ? "auto" : "smooth", block: "end" });
	}, [messages, isBusy, documentMode]);

	if (showEmpty) {
		return (
			<div className="chat-welcome" ref={rootRef}>
				<div className="chat-welcome-inner">
					<p className="chat-welcome-badge">{documentLabel} workspace</p>
					<h2 className="chat-welcome-title">Generate a cited {documentLabel}</h2>
					<p className="chat-welcome-lead">
						Enter a research topic below. {APP_NAME} produces a structured {documentLabel} with in-text
						citations and a reference list in your chosen style.
					</p>

					{onSuggestionClick && (
						<div className="chat-welcome-suggestions">
							<p className="chat-welcome-suggestions-label">Try a topic</p>
							<div className="chat-welcome-chips">
								{SUGGESTIONS.map((topic) => (
									<button
										key={topic}
										type="button"
										className="chat-welcome-chip"
										onClick={() => onSuggestionClick(topic)}
									>
										{topic}
									</button>
								))}
							</div>
						</div>
					)}
				</div>
			</div>
		);
	}

	const generatingLabel = assistantHasText
		? `Still writing your ${documentLabel}…`
		: `Generating your ${documentLabel}…`;
	const generatingDetail = assistantHasText
		? "Text appears below as each section is drafted."
		: "This may take a minute. Sections and citations will stream in shortly.";

	if (studioMode) {
		const prompts = messages.filter((m) => m.role === "user");
		const papers = messages.filter((m) => m.role === "assistant");
		const primaryPrompt = prompts[0]?.content?.trim() ?? "";
		const followUps = prompts.slice(1);

		return (
			<div className="chat-studio" ref={rootRef}>
				{primaryPrompt ? (
					<div className="chat-studio-brief">
						<span className="chat-studio-brief-label">Topic</span>
						<p className="chat-studio-brief-text">{primaryPrompt}</p>
					</div>
				) : null}

				{followUps.map((msg) => (
					<div key={msg.id} className="chat-studio-followup">
						<span className="chat-studio-followup-label">Revision</span>
						<p className="chat-studio-followup-text">{msg.content}</p>
					</div>
				))}

				{papers.map((msg, index) => {
					const isLatest = index === papers.length - 1;
					const emptyStreaming = isLatest && isBusy && !msg.content.trim();
					return (
						<article
							key={msg.id}
							className={`chat-manuscript${emptyStreaming ? " is-generating" : ""}`}
						>
							<header className="chat-manuscript-toolbar">
								<div className="chat-manuscript-toolbar-main">
									<span className="chat-manuscript-brand">{APP_NAME}</span>
									<span className="chat-manuscript-dot" aria-hidden />
									<span className="chat-manuscript-kind">{documentLabel}</span>
								</div>
								{msg.tokenUsage && !isBusy ? (
									<span
										className="chat-manuscript-meta"
										title={`LLM tokens used to generate this ${documentLabel}`}
									>
										{formatTokenUsage(msg.tokenUsage)}
									</span>
								) : null}
							</header>
							<div className="chat-manuscript-page">
								{msg.content.trim() ? (
									<div className="chat-paper-markdown">
										<ResearchPaperMarkdown content={promoteBoldSectionsForDisplay(msg.content)} />
									</div>
								) : (
									<GeneratingBody label={generatingLabel} detail={generatingDetail} />
								)}
							</div>
						</article>
					);
				})}

				{isBusy && !lastAssistant && (
					<article className="chat-manuscript is-generating">
						<header className="chat-manuscript-toolbar">
							<div className="chat-manuscript-toolbar-main">
								<span className="chat-manuscript-brand">{APP_NAME}</span>
								<span className="chat-manuscript-dot" aria-hidden />
								<span className="chat-manuscript-kind">{documentLabel}</span>
							</div>
						</header>
						<div className="chat-manuscript-page">
							<GeneratingBody label={generatingLabel} detail={generatingDetail} />
						</div>
					</article>
				)}

				{isBusy && assistantHasText && (
					<p className="chat-stream-hint" aria-live="polite">
						<span className="chat-stream-dot" aria-hidden />
						Writing into the manuscript…
					</p>
				)}
				<div ref={endRef} className="chat-thread-end" />
			</div>
		);
	}

	return (
		<div className="chat-thread" ref={rootRef}>
			{messages.map((msg) => (
				<article
					key={msg.id}
					className={`chat-turn chat-turn-${msg.role}${msg.role === "assistant" && isBusy && !msg.content.trim() ? " chat-turn-generating" : ""}`}
				>
					<div className="chat-turn-content">
						<header className="chat-turn-header">
							<span className={`chat-turn-label chat-turn-label-${msg.role}`}>{roleLabel(msg)}</span>
							{msg.role === "assistant" && msg.tokenUsage && !isBusy && (
								<span className="chat-turn-meta" title={`LLM tokens used to generate this ${documentLabel}`}>
									{formatTokenUsage(msg.tokenUsage)}
								</span>
							)}
						</header>
						<div className="chat-turn-body">
							{msg.role === "assistant" ? (
								msg.content.trim() ? (
									<div className="chat-paper-markdown">
										<ResearchPaperMarkdown content={promoteBoldSectionsForDisplay(msg.content)} />
									</div>
								) : (
									<GeneratingBody label={generatingLabel} detail={generatingDetail} />
								)
							) : (
								<p className="chat-turn-text">{msg.content}</p>
							)}
						</div>
					</div>
				</article>
			))}
			{isBusy && !lastAssistant && (
				<article className="chat-turn chat-turn-assistant chat-turn-generating">
					<div className="chat-turn-content">
						<header className="chat-turn-header">
							<span className="chat-turn-label chat-turn-label-assistant">{APP_NAME}</span>
						</header>
						<div className="chat-turn-body">
							<GeneratingBody label={generatingLabel} detail={generatingDetail} />
						</div>
					</div>
				</article>
			)}
			{isBusy && assistantHasText && (
				<p className="chat-stream-hint" aria-live="polite">
					<span className="chat-stream-dot" aria-hidden />
					Generating text…
				</p>
			)}
			<div ref={endRef} className="chat-thread-end" />
		</div>
	);
}
