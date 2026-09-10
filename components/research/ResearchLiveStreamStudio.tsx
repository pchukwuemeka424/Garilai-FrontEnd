"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";

import { ResearchPaperMarkdown } from "@/components/research/ResearchPaperMarkdown";
import { IconChevronLeft, IconStop } from "@/components/ui/ButtonIcon";
import { useSmoothProgress } from "@/hooks/useSmoothProgress";
import { getScopeDocumentLabel, getScopeProjectEyebrow } from "@/lib/research-ideas";
import { injectLiveVisualsIntoDraft } from "@/lib/research-live-figures";
import { stripTitleAboveAbstract } from "@/lib/research-paper-sections";

export type ResearchLiveStreamStudioProps = {
	projectName: string;
	scope?: string | null;
	draft: string;
	/** Notebook figure markdown injected into the live draft while generating. */
	figureMarkdown?: string;
	progress: number;
	preparing?: boolean;
	streaming?: boolean;
	complete?: boolean;
	studentUI?: boolean;
	stopping?: boolean;
	backHref?: string;
	backLabel?: string;
	onStop?: () => void;
	/** When false, omit the top bar back link (embedded in an existing workspace chrome). */
	showBackLink?: boolean;
	embedded?: boolean;
};

function liveStatusLabel(
	preparing: boolean,
	percent: number,
	documentLabel: string,
	hasDraft: boolean,
): string {
	if (preparing && !hasDraft) return `Preparing your ${documentLabel}`;
	if (percent < 42 && !hasDraft) return `Gathering sources`;
	if (hasDraft && percent < 94) return `Writing your ${documentLabel}`;
	if (percent < 97) return "Completing citations";
	return "Finalizing manuscript";
}

function countWords(text: string): number {
	const trimmed = text.trim();
	if (!trimmed) return 0;
	return trimmed.split(/\s+/).filter(Boolean).length;
}

const PAREN_CITE =
	/\([A-Za-zÀ-ÖØ-öø-ÿ][^)]{0,80}?\b(?:19|20)\d{2}[a-z]?[^)]*\)/g;
const NARRATIVE_CITE =
	/\b[A-ZÀ-Ö][A-Za-zÀ-ÖØ-öø-ÿ'-]+(?:\s+et\s+al\.?|\s+and\s+[A-ZÀ-Ö][A-Za-zÀ-ÖØ-öø-ÿ'-]+)?\s*\(\s*(?:19|20)\d{2}[a-z]?\s*\)/g;

function countInTextCites(text: string): number {
	if (!text.trim()) return 0;
	const paren = text.match(PAREN_CITE) ?? [];
	const narr = text.match(NARRATIVE_CITE) ?? [];
	// Narrative forms also contain a year paren; prefer unique span starts via Set of matches.
	return new Set([...paren, ...narr]).size;
}

/**
 * ChatGPT-style live manuscript studio used by /research/generating and workspace generation.
 */
export function ResearchLiveStreamStudio({
	projectName,
	scope = null,
	draft,
	figureMarkdown = "",
	progress,
	preparing = false,
	streaming = true,
	complete = false,
	studentUI = false,
	stopping = false,
	backHref,
	backLabel = "Brief",
	onStop,
	showBackLink = true,
	embedded = false,
}: ResearchLiveStreamStudioProps) {
	const documentLabel = getScopeDocumentLabel(scope);
	const eyebrow = getScopeProjectEyebrow(scope);
	const displayDraft = useMemo(
		() => stripTitleAboveAbstract(injectLiveVisualsIntoDraft(draft, figureMarkdown, scope), projectName),
		[draft, figureMarkdown, scope, projectName],
	);
	const hasDraft = displayDraft.trim().length > 0;
	const wordCount = useMemo(() => countWords(draft), [draft]);
	const citeCount = useMemo(() => countInTextCites(draft), [draft]);
	const visualCount = useMemo(() => {
		const charts = (displayDraft.match(/```research-chart\b/gi) ?? []).length;
		const figures = (displayDraft.match(/```research-figure\b/gi) ?? []).length;
		const diagrams = (displayDraft.match(/```research-image\b/gi) ?? []).length;
		const tables = (displayDraft.match(/^\|.+\|$/gm) ?? []).length > 1 ? 1 : 0;
		return charts + figures + diagrams + (tables ? 1 : 0);
	}, [displayDraft]);
	const streamEndRef = useRef<HTMLDivElement>(null);
	const autoScrollRef = useRef(true);
	const percent = useSmoothProgress(Math.max(progress, preparing ? 12 : 20), {
		complete,
		active: preparing || streaming,
		floor: preparing ? 8 : 20,
		autoCreep: true,
	});

	useEffect(() => {
		if (!autoScrollRef.current) return;
		const page = streamEndRef.current?.closest(".rg-studio-page") as HTMLElement | null;
		if (page) {
			page.scrollTop = page.scrollHeight;
			return;
		}
		streamEndRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
	}, [displayDraft, preparing, progress]);

	return (
		<div
			className={`rg-studio${studentUI ? " rg-studio-student" : ""}${embedded ? " rg-studio-embedded" : ""}`}
			role="status"
			aria-live="polite"
			aria-busy={streaming && !complete}
		>
			<div className="rg-studio-atmosphere" aria-hidden />

			<header className="rg-studio-bar">
				<div className="rg-studio-bar-main">
					{showBackLink && backHref ? (
						<Link href={backHref} className="rg-studio-back">
							<IconChevronLeft size={16} />
							{backLabel}
						</Link>
					) : (
						<span className="rg-studio-back is-static">Live generate</span>
					)}
					<div className="rg-studio-brand">
						<span className="rg-studio-brand-mark">GARIL</span>
						<span className="rg-studio-brand-sep" aria-hidden />
						<span className="rg-studio-brand-type">{eyebrow}</span>
					</div>
				</div>
				{streaming && !complete && onStop ? (
					<button
						type="button"
						className="rg-studio-stop"
						onClick={onStop}
						disabled={stopping}
					>
						<IconStop size={14} />
						{stopping ? "Stopping…" : "Stop generating"}
					</button>
				) : null}
			</header>

			<div className="rg-studio-layout">
				<aside className="rg-studio-rail">
					<p className="rg-studio-kicker">Live generation</p>
					<h1 className="rg-studio-title">{projectName}</h1>
					<p className="rg-studio-phase">
						<span className={`rg-studio-phase-dot${streaming && !complete ? " is-live" : ""}`} aria-hidden />
						{liveStatusLabel(preparing, percent, documentLabel, hasDraft)}
					</p>

					<div
						className="rg-studio-meter"
						role="progressbar"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={percent}
						aria-label={`${eyebrow} generation progress`}
					>
						<div className="rg-studio-meter-head">
							<span>Progress</span>
							<strong>{percent}%</strong>
						</div>
						<div className="rg-studio-meter-track">
							<div className="rg-studio-meter-fill" style={{ width: `${percent}%` }} />
						</div>
					</div>

					<div className="rg-studio-meta">
						<div>
							<span>Words</span>
							<strong>{wordCount.toLocaleString()}</strong>
						</div>
						<div>
							<span>In-text cites</span>
							<strong>{citeCount.toLocaleString()}</strong>
						</div>
						<div>
							<span>Visuals</span>
							<strong>{visualCount.toLocaleString()}</strong>
						</div>
						<div>
							<span>Status</span>
							<strong>{streaming && !complete ? "Streaming" : complete ? "Complete" : "Idle"}</strong>
						</div>
					</div>

					{hasDraft && citeCount === 0 && streaming && !complete ? (
						<p className="rg-studio-hint rg-studio-hint-cites">
							Literature citations appear as sections write…
						</p>
					) : (
						<p className="rg-studio-hint">
							Tables, charts, and figures render live as the {documentLabel} streams. You can leave
							this page — GARIL will notify you when it is ready.
						</p>
					)}
				</aside>

				<section className="rg-studio-stage">
					<article
						className="rg-studio-page"
						onScroll={(event) => {
							const el = event.currentTarget;
							const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
							autoScrollRef.current = nearBottom;
						}}
					>
						<header className="rg-studio-page-head">
							<p className="rg-studio-page-kicker">{eyebrow}</p>
							<h2 className="rg-studio-page-title">{projectName}</h2>
							<p className="rg-studio-page-sub">
								{streaming && !complete
									? "Manuscript is being written live — images, graphs, and tables included"
									: "Manuscript generation"}
							</p>
						</header>

						{!hasDraft ? (
							<div className="rg-studio-waiting">
								<div className="rg-studio-waiting-line" aria-hidden />
								<div className="rg-studio-waiting-line is-mid" aria-hidden />
								<div className="rg-studio-waiting-line is-short" aria-hidden />
								<p>
									{preparing
										? `Preparing sources, figures, and structure for your ${documentLabel}…`
										: `Starting the first paragraph of your ${documentLabel}…`}
								</p>
							</div>
						) : (
							<div className="rg-studio-prose">
								<ResearchPaperMarkdown content={displayDraft} allowImages />
								{streaming && !complete ? <span className="rg-studio-caret" aria-hidden /> : null}
							</div>
						)}
						<div ref={streamEndRef} />
					</article>
				</section>
			</div>
		</div>
	);
}
