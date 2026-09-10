"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AulaLayout } from "@/components/AulaLayout";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ResearchDocEditor } from "@/components/research/ResearchDocEditor";
import { ResearchPaperMarkdown } from "@/components/research/ResearchPaperMarkdown";
import { StudentLayout } from "@/components/StudentLayout";
import {
	IconChartBar,
	IconChevronLeft,
	IconDownload,
	IconEdit,
	IconFileText,
	IconTrash,
} from "@/components/ui/ButtonIcon";
import { useAuth } from "@/hooks/useAuth";
import {
	downloadResearchPaper,
	extractPaperTitle,
	getSavedResearchPaperById,
	removeSavedPaper,
	updateSavedResearchPaper,
	type SavedResearchPaper,
} from "@/lib/chat-research-storage";
import {
	getScopeDocumentLabel,
	getScopeProjectEyebrow,
	htmlToOutlineText,
	markdownToDocHtml,
} from "@/lib/research-ideas";
import {
	formatResearchPaperReferences,
	validateAndFormatResearchPaperReferences,
} from "@/lib/research-paper-references";
import { promoteBoldSectionsForDisplay, stripTitleAboveAbstract } from "@/lib/research-paper-sections";
import { savedResearchEffortPath, savedResearchListPath } from "@/lib/saved-research-routes";

type Props = {
	variant?: "lecturer" | "student";
};

function formatWhen(iso: string): string {
	try {
		return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
			new Date(iso),
		);
	} catch {
		return iso;
	}
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
	return new Set([...paren, ...narr]).size;
}

function SavedResearchPaperContent({ variant = "lecturer" }: Props) {
	const searchParams = useSearchParams();
	const router = useRouter();
	const { user } = useAuth();
	const id = searchParams.get("id")?.trim() ?? "";
	const isStudent = variant === "student";

	const [paper, setPaper] = useState<SavedResearchPaper | null>(null);
	const [loading, setLoading] = useState(true);
	const [notFound, setNotFound] = useState(false);
	const [topic, setTopic] = useState("");
	const [content, setContent] = useState("");
	const [editorHtml, setEditorHtml] = useState("");
	const [dirty, setDirty] = useState(false);
	const [saving, setSaving] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [pendingDelete, setPendingDelete] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");

	const researchPath = isStudent ? "/student/research" : "/research";
	const savedListPath = savedResearchListPath(variant);

	useEffect(() => {
		if (!id) {
			setLoading(false);
			setNotFound(true);
			setPaper(null);
			return;
		}
		setLoading(true);
		setNotFound(false);
		void getSavedResearchPaperById(id).then(async (loaded) => {
			if (!loaded) {
				setNotFound(true);
				setPaper(null);
				setLoading(false);
				return;
			}

			const { content: formatted, changed } = validateAndFormatResearchPaperReferences(
				loaded.content,
			);

			let nextPaper = loaded;
			if (changed) {
				const result = await updateSavedResearchPaper(id, {
					topic: loaded.topic,
					content: formatted,
				});
				if (result.paper) {
					nextPaper = result.paper;
					setNotice("References formatted.");
					window.setTimeout(() => setNotice(null), 5000);
				} else {
					nextPaper = { ...loaded, content: formatted };
				}
			}

			setPaper(nextPaper);
			setTopic(nextPaper.topic);
			setContent(nextPaper.content);
			setEditorHtml(
				markdownToDocHtml(
					promoteBoldSectionsForDisplay(formatResearchPaperReferences(nextPaper.content)),
				),
			);
			setDirty(false);
			setLoading(false);
		});
	}, [id]);

	const liveContent = useMemo(() => {
		if (viewMode === "edit") {
			const fromHtml = htmlToOutlineText(editorHtml);
			return fromHtml.trim() ? fromHtml : content;
		}
		return content;
	}, [viewMode, editorHtml, content]);

	const formattedContent = useMemo(
		() => (content.trim() ? formatResearchPaperReferences(content) : ""),
		[content],
	);

	const displayTitle = extractPaperTitle(formattedContent || content, topic || "Research paper");
	const documentLabel = getScopeDocumentLabel("journal");
	const eyebrow = getScopeProjectEyebrow("journal").toUpperCase();

	const wordCount = useMemo(() => countWords(liveContent), [liveContent]);
	const citeCount = useMemo(() => countInTextCites(liveContent), [liveContent]);
	const displayDraft = useMemo(
		() => stripTitleAboveAbstract(promoteBoldSectionsForDisplay(formattedContent || content), displayTitle),
		[formattedContent, content, displayTitle],
	);
	const visualCount = useMemo(() => {
		const charts = (displayDraft.match(/```research-chart\b/gi) ?? []).length;
		const figures = (displayDraft.match(/```research-figure\b/gi) ?? []).length;
		const diagrams = (displayDraft.match(/```research-image\b/gi) ?? []).length;
		const tables = (displayDraft.match(/^\|.+\|$/gm) ?? []).length > 1 ? 1 : 0;
		return charts + figures + diagrams + (tables ? 1 : 0);
	}, [displayDraft]);

	const paperMeta = useMemo(
		() => ({
			author: user?.name ?? null,
			department: user?.department ?? null,
			affiliation: user?.institution ?? null,
			fallbackTopic: topic || null,
		}),
		[user?.name, user?.department, user?.institution, topic],
	);

	const applyFormattedContent = useCallback((next: string) => {
		setContent(next);
		setEditorHtml(markdownToDocHtml(promoteBoldSectionsForDisplay(next)));
		setDirty(true);
	}, []);

	const syncContentFromHtml = useCallback((html: string) => {
		setEditorHtml(html);
		setContent(htmlToOutlineText(html));
		setDirty(true);
	}, []);

	const handleSave = useCallback(async () => {
		if (!id || !dirty) return;
		const raw = viewMode === "edit" ? htmlToOutlineText(editorHtml) : content;
		const { content: nextContent } = validateAndFormatResearchPaperReferences(raw);
		setSaving(true);
		setError(null);
		const result = await updateSavedResearchPaper(id, { topic, content: nextContent });
		setSaving(false);
		if (!result.paper) {
			setError(result.error ?? "Could not save changes.");
			return;
		}
		setPaper(result.paper);
		setTopic(result.paper.topic);
		setContent(result.paper.content);
		setEditorHtml(
			markdownToDocHtml(promoteBoldSectionsForDisplay(formatResearchPaperReferences(result.paper.content))),
		);
		setDirty(false);
		setNotice("Changes saved.");
		window.setTimeout(() => setNotice(null), 4000);
	}, [id, dirty, viewMode, editorHtml, content, topic]);

	const handleDownload = useCallback(() => {
		const raw = viewMode === "edit" ? htmlToOutlineText(editorHtml) || content : content;
		if (!raw.trim()) return;
		const { content: nextContent } = validateAndFormatResearchPaperReferences(raw);
		if (nextContent !== raw) {
			applyFormattedContent(nextContent);
		}
		void downloadResearchPaper(
			{
				id: id ?? "",
				topic,
				title: displayTitle,
				content: nextContent,
				createdAt: paper?.createdAt ?? new Date().toISOString(),
				updatedAt: paper?.updatedAt ?? new Date().toISOString(),
			},
			paperMeta,
		);
	}, [
		applyFormattedContent,
		content,
		displayTitle,
		editorHtml,
		id,
		paper?.createdAt,
		paper?.updatedAt,
		paperMeta,
		topic,
		viewMode,
	]);

	const handleDelete = useCallback(async () => {
		if (!id) return;
		setDeleting(true);
		const result = await removeSavedPaper(id, paper ? [paper] : []);
		setDeleting(false);
		setPendingDelete(false);
		if (!result.ok) {
			setError(result.error ?? "Could not delete saved research.");
			return;
		}
		router.push(researchPath);
	}, [id, paper, researchPath, router]);

	if (loading) {
		return (
			<div className={`rg-studio${isStudent ? " rg-studio-student" : ""}`}>
				<div className="rg-studio-atmosphere" aria-hidden />
				<header className="rg-studio-bar">
					<div className="rg-studio-bar-main">
						<Link href={savedListPath} className="rg-studio-back">
							<IconChevronLeft size={16} />
							Saved
						</Link>
						<div className="rg-studio-brand">
							<span className="rg-studio-brand-mark">GARIL</span>
							<span className="rg-studio-brand-sep" aria-hidden />
							<span className="rg-studio-brand-type">{eyebrow}</span>
						</div>
					</div>
				</header>
				<div className="rg-studio-layout">
					<aside className="rg-studio-rail">
						<p className="rg-studio-kicker">Saved research</p>
						<h1 className="rg-studio-title">Loading paper…</h1>
						<p className="rg-studio-phase">
							<span className="rg-studio-phase-dot is-live" aria-hidden />
							Fetching manuscript
						</p>
					</aside>
					<section className="rg-studio-stage">
						<article className="rg-studio-page">
							<div className="rg-studio-waiting">
								<div className="rg-studio-waiting-line" aria-hidden />
								<div className="rg-studio-waiting-line is-mid" aria-hidden />
								<div className="rg-studio-waiting-line is-short" aria-hidden />
								<p>Loading your saved {documentLabel}…</p>
							</div>
						</article>
					</section>
				</div>
			</div>
		);
	}

	if (notFound || !paper) {
		return (
			<div className={`rg-studio${isStudent ? " rg-studio-student" : ""}`}>
				<div className="rg-studio-atmosphere" aria-hidden />
				<header className="rg-studio-bar">
					<div className="rg-studio-bar-main">
						<Link href={savedListPath} className="rg-studio-back">
							<IconChevronLeft size={16} />
							Saved research
						</Link>
						<div className="rg-studio-brand">
							<span className="rg-studio-brand-mark">GARIL</span>
						</div>
					</div>
				</header>
				<div className="rg-studio-shell rg-studio-shell-empty">
					<div className="rg-studio-empty">
						<p className="rg-studio-kicker">GARIL AI</p>
						<h1>Saved research not found</h1>
						<p>It may have been removed or you may not have access to this document.</p>
						<div className="rg-studio-empty-actions">
							<Link href={savedListPath} className="rg-studio-btn rg-studio-btn-primary">
								Back to saved research
							</Link>
							<Link href={researchPath} className="rg-studio-btn">
								Research Assistant
							</Link>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div
			className={`rg-studio${isStudent ? " rg-studio-student" : ""}`}
			role="region"
			aria-label="Saved research paper studio"
		>
			<div className="rg-studio-atmosphere" aria-hidden />

			<header className="rg-studio-bar">
				<div className="rg-studio-bar-main">
					<Link href={savedListPath} className="rg-studio-back">
						<IconChevronLeft size={16} />
						Brief
					</Link>
					<div className="rg-studio-brand">
						<span className="rg-studio-brand-mark">GARIL</span>
						<span className="rg-studio-brand-sep" aria-hidden />
						<span className="rg-studio-brand-type">{eyebrow}</span>
					</div>
				</div>

				<div className="rg-studio-bar-actions">
					<div className="rg-studio-mode-toggle" role="group" aria-label="View mode">
						<button
							type="button"
							className={`rg-studio-mode-btn${viewMode === "preview" ? " is-active" : ""}`}
							onClick={() => setViewMode("preview")}
							title="View rendered manuscript"
						>
							<IconFileText size={14} />
							Preview
						</button>
						<button
							type="button"
							className={`rg-studio-mode-btn${viewMode === "edit" ? " is-active" : ""}`}
							onClick={() => setViewMode("edit")}
							title="Edit manuscript text and citations"
						>
							<IconEdit size={14} />
							Edit
						</button>
					</div>

					<button
						type="button"
						className="rg-studio-bar-btn rg-studio-bar-btn-primary"
						onClick={() => void handleSave()}
						disabled={!dirty || saving}
						title={dirty ? "Save changes to manuscript" : "All changes saved"}
					>
						{saving ? "Saving…" : "Save"}
					</button>

					<button
						type="button"
						className="rg-studio-bar-btn"
						onClick={handleDownload}
						title="Download manuscript as PDF"
					>
						<IconDownload size={14} />
						PDF
					</button>

					<Link
						href={savedResearchEffortPath(id, variant)}
						className="rg-studio-bar-btn"
						title="Open effort and authorship report"
					>
						<IconChartBar size={14} />
						Effort
					</Link>

					<button
						type="button"
						className="rg-studio-bar-btn rg-studio-bar-btn-danger"
						onClick={() => setPendingDelete(true)}
						title="Delete this saved paper"
						aria-label="Delete paper"
					>
						<IconTrash size={14} />
					</button>
				</div>
			</header>

			<div className="rg-studio-layout">
				<aside className="rg-studio-rail">
					<p className="rg-studio-kicker">Live generation</p>
					<h1 className="rg-studio-title">{displayTitle}</h1>
					<p className="rg-studio-phase">
						<span
							className="rg-studio-phase-dot"
							style={{ backgroundColor: dirty ? "#eab308" : "#8b3a4f" }}
							aria-hidden
						/>
						{dirty
							? "Unsaved edits in progress"
							: paper?.updatedAt
								? `Saved · Updated ${formatWhen(paper.updatedAt)}`
								: `Saved manuscript`}
					</p>

					<div
						className="rg-studio-meter"
						role="progressbar"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={100}
						aria-label={`${eyebrow} progress`}
					>
						<div className="rg-studio-meter-head">
							<span>Progress</span>
							<strong>100%</strong>
						</div>
						<div className="rg-studio-meter-track">
							<div className="rg-studio-meter-fill" style={{ width: "100%" }} />
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
							<strong>{dirty ? "Editing" : "Complete"}</strong>
						</div>
					</div>

					{notice && <div className="rg-studio-rail-notice">{notice}</div>}
					{error && (
						<div className="rg-studio-rail-error" role="alert">
							{error}
						</div>
					)}

					<p className="rg-studio-hint">
						Tables, charts, and figures render live as the {documentLabel} streams. You can leave
						this page — GARIL will notify you when it is ready.
					</p>
				</aside>

				<section className="rg-studio-stage">
					<article className="rg-studio-page">
						<header className="rg-studio-page-head">
							<p className="rg-studio-page-kicker">{eyebrow}</p>
							{viewMode === "edit" ? (
								<input
									id="saved-research-topic"
									className="rg-studio-title-input"
									value={topic}
									aria-label="Research topic"
									placeholder="Research topic / title"
									onChange={(event) => {
										setTopic(event.target.value);
										setDirty(true);
									}}
								/>
							) : (
								<h2 className="rg-studio-page-title">{displayTitle}</h2>
							)}
							<p className="rg-studio-page-sub">
								{viewMode === "edit"
									? "Editing manuscript — format and revise text, headings, and citations"
									: "Manuscript is being written live — images, graphs, and tables included"}
							</p>
						</header>

						{viewMode === "edit" ? (
							<div className="saved-research-editor-shell">
								<ResearchDocEditor
									value={editorHtml}
									placeholder="Edit your research paper…"
									ariaLabel="Editable research paper document"
									minHeight="36rem"
									onChange={syncContentFromHtml}
									onBlur={() => {
										const next = htmlToOutlineText(editorHtml);
										if (next !== content) {
											setContent(next);
											setDirty(true);
										}
									}}
								/>
							</div>
						) : (
							<div className="rg-studio-prose">
								<ResearchPaperMarkdown content={displayDraft} allowImages />
							</div>
						)}
					</article>
				</section>
			</div>

			<ConfirmDialog
				open={pendingDelete}
				title="Delete saved research?"
				description={`“${displayTitle.slice(0, 120)}” will be permanently removed.`}
				confirmLabel="Delete"
				loading={deleting}
				onConfirm={() => void handleDelete()}
				onCancel={() => {
					if (deleting) return;
					setPendingDelete(false);
				}}
			/>
		</div>
	);
}

export function SavedResearchPaperPage({ variant = "lecturer" }: Props) {
	const page = <SavedResearchPaperContent variant={variant} />;

	if (variant === "student") {
		return <StudentLayout>{page}</StudentLayout>;
	}

	return (
		<AulaLayout showRightPanel={false} hideTopBar fullHeight>
			{page}
		</AulaLayout>
	);
}
