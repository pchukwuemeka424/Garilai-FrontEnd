"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { studentHasResearchTokens } from "@/components/StudentTokenQuota";
import { AulaLayout } from "@/components/AulaLayout";
import { CitationStyleSelect } from "@/components/aula/CitationStyleSelect";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EffortReportModal } from "@/components/research/EffortReportModal";
import { ResearchDocEditor } from "@/components/research/ResearchDocEditor";
import { StudentLayout } from "@/components/StudentLayout";
import {
	IconDownload,
	IconRefresh,
	IconTrash,
} from "@/components/ui/ButtonIcon";
import { useAuth } from "@/hooks/useAuth";
import {
	loadChatCitationStyle,
	saveChatCitationStyle,
} from "@/lib/chat-research-citations";
import {
	downloadResearchPaper,
	extractPaperTitle,
	getSavedResearchPaperById,
	removeSavedPaper,
	updateSavedResearchPaper,
	type SavedResearchPaper,
} from "@/lib/chat-research-storage";
import {
	DEFAULT_CITATION_STYLE,
	getStyleLabel,
	type CitationStyle,
} from "@/lib/citation-styles";
import { htmlToOutlineText, markdownToDocHtml } from "@/lib/research-ideas";
import { fetchNotebook } from "@/lib/research-assets-api";
import {
	bandLabel,
	computePaperEffort,
	downloadPaperEffortReport,
	emptyMaterialCounts,
	materialCountsFromNotebook,
	materialCountsFromSources,
	mergeMaterialCounts,
	type PaperMaterialCounts,
} from "@/lib/research-paper-effort";
import { peekPaperSources } from "@/lib/research-paper-sources";
import {
	formatResearchPaperReferences,
	reformatResearchPaperReferencesByStyle,
	validateAndFormatResearchPaperReferences,
} from "@/lib/research-paper-references";
import { promoteBoldSectionsForDisplay } from "@/lib/research-paper-sections";
import { researchPaperWorkspacePath } from "@/lib/research-generate-routes";
import {
	buildRefineResearchPaperPrompt,
	stagePendingResearchRefine,
} from "@/lib/research-paper-refine";
import { loadResearchWizardDraft } from "@/lib/research-wizard-draft";
import { savedResearchListPath } from "@/lib/saved-research-routes";

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

function SavedResearchPaperContent({ variant = "lecturer" }: Props) {
	const searchParams = useSearchParams();
	const router = useRouter();
	const { user } = useAuth();
	const id = searchParams.get("id")?.trim() ?? "";
	const isStudent = variant === "student";
	const hasTokens = studentHasResearchTokens(user?.tokenQuota, user?.role);

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
	const [applyingStyle, setApplyingStyle] = useState(false);
	const [citationStyle, setCitationStyle] = useState<CitationStyle>(DEFAULT_CITATION_STYLE);
	const [pendingDelete, setPendingDelete] = useState(false);
	const [pendingRegenerate, setPendingRegenerate] = useState(false);
	const [regenerating, setRegenerating] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [effortReportOpen, setEffortReportOpen] = useState(false);
	const [downloadingEffort, setDownloadingEffort] = useState(false);
	const [materials, setMaterials] = useState<PaperMaterialCounts>(emptyMaterialCounts());

	useEffect(() => {
		setCitationStyle(loadChatCitationStyle() ?? DEFAULT_CITATION_STYLE);
	}, [id]);

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

	useEffect(() => {
		let alive = true;
		const run = async () => {
			const wizard = loadResearchWizardDraft(isStudent ? "student" : "lecturer", user?.id);
			const staged = peekPaperSources();
			const sources =
				paper?.sources ??
				staged ??
				wizard?.selectedSources ??
				null;

			let counts = materialCountsFromSources(sources);
			const projectIds = sources?.projectIds ?? [];
			if (projectIds.length > 0) {
				const notebooks = await Promise.all(
					projectIds.map((projectId) =>
						fetchNotebook(projectId)
							.then((res) => materialCountsFromNotebook(res.notebookData))
							.catch(() => emptyMaterialCounts()),
					),
				);
				counts = mergeMaterialCounts(counts, ...notebooks);
				// Avoid double-counting projects from both sources + notebooks
				counts.projects = projectIds.length;
			}
			if (alive) setMaterials(counts);
		};
		void run();
		return () => {
			alive = false;
		};
	}, [paper?.sources, paper?.id, isStudent, user?.id]);

	const liveContent = useMemo(() => {
		const fromHtml = htmlToOutlineText(editorHtml);
		return fromHtml.trim() ? fromHtml : content;
	}, [editorHtml, content]);

	const effort = useMemo(
		() =>
			computePaperEffort({
				content: liveContent,
				aiBaselineContent: paper?.aiBaselineContent ?? paper?.content ?? null,
				humanEdited: paper?.humanEdited || dirty,
				topic,
				materials,
			}),
		[liveContent, paper?.aiBaselineContent, paper?.content, paper?.humanEdited, dirty, topic, materials],
	);

	const effortAuthor = useMemo(
		() => ({
			name: user?.name ?? null,
			email: user?.email ?? null,
			department: user?.department ?? null,
			institution: user?.institution ?? null,
		}),
		[user?.name, user?.email, user?.department, user?.institution],
	);

	const formattedContent = useMemo(
		() => (content.trim() ? formatResearchPaperReferences(content) : ""),
		[content],
	);
	const displayTitle = extractPaperTitle(formattedContent || content, topic || "Research paper");

	const handleDownloadEffortReport = useCallback(async () => {
		setDownloadingEffort(true);
		setError(null);
		try {
			await downloadPaperEffortReport({
				title: displayTitle,
				topic,
				effort,
				author: effortAuthor,
			});
		} catch (downloadError) {
			setError(
				downloadError instanceof Error
					? downloadError.message
					: "Could not download effort report.",
			);
		} finally {
			setDownloadingEffort(false);
		}
	}, [displayTitle, topic, effort, effortAuthor]);

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

	const handleCitationStyleChange = useCallback((style: CitationStyle | "") => {
		if (!style) return;
		setCitationStyle(style);
		saveChatCitationStyle(style);
	}, []);

	const handleApplyReferenceStyle = useCallback(async () => {
		if (!id) return;
		setApplyingStyle(true);
		setError(null);
		saveChatCitationStyle(citationStyle);

		const raw = htmlToOutlineText(editorHtml) || content;
		const styled = reformatResearchPaperReferencesByStyle(raw, citationStyle);
		const { content: formatted } = validateAndFormatResearchPaperReferences(styled.content);
		applyFormattedContent(formatted);

		const result = await updateSavedResearchPaper(id, { topic, content: formatted });
		setApplyingStyle(false);
		if (!result.paper) {
			setError(result.error ?? "Could not save reformatted references.");
			return;
		}
		setPaper(result.paper);
		setContent(result.paper.content);
		setEditorHtml(
			markdownToDocHtml(promoteBoldSectionsForDisplay(formatResearchPaperReferences(result.paper.content))),
		);
		setDirty(false);
		const styleLabel = getStyleLabel(citationStyle);
		setNotice(
			styled.entryCount > 0
				? styled.changed
					? `References reformatted to ${styleLabel} (${styled.entryCount} entr${styled.entryCount === 1 ? "y" : "ies"}).`
					: `References already match ${styleLabel}.`
				: "No References entries found to reformat.",
		);
		window.setTimeout(() => setNotice(null), 5000);
	}, [applyFormattedContent, citationStyle, content, editorHtml, id, topic]);

	const handleSave = useCallback(async () => {
		if (!id || !dirty) return;
		const raw = htmlToOutlineText(editorHtml);
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
	}, [id, dirty, topic, editorHtml]);

	const handleDownload = useCallback(() => {
		const raw = htmlToOutlineText(editorHtml) || content;
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

	const startRegenerate = useCallback(async () => {
		const draft = liveContent.trim() || content.trim();
		if (!draft || draft.length < 200) {
			setError("Paper content is too short to regenerate.");
			setPendingRegenerate(false);
			return;
		}

		setRegenerating(true);
		setError(null);
		setPendingRegenerate(false);

		try {
			if (dirty) {
				const saved = await updateSavedResearchPaper(id, {
					topic: topic.trim() || paper?.topic || "Research paper",
					content: draft,
				});
				if (!saved.paper) {
					throw new Error(saved.error ?? "Save your changes before regenerating.");
				}
				setPaper(saved.paper);
				setDirty(false);
			}

			const refineTopic = topic.trim() || paper?.topic || displayTitle || "Research paper";
			const prompt = buildRefineResearchPaperPrompt({
				topic: refineTopic,
				content: draft,
				citationStyle,
			});
			saveChatCitationStyle(citationStyle);
			stagePendingResearchRefine({
				prompt,
				topic: refineTopic,
				citationStyle,
			});
			router.push(researchPaperWorkspacePath(refineTopic, variant));
		} catch (regenError) {
			setRegenerating(false);
			setError(
				regenError instanceof Error
					? regenError.message
					: "Could not start paper regeneration.",
			);
		}
	}, [
		citationStyle,
		content,
		dirty,
		displayTitle,
		id,
		liveContent,
		paper?.topic,
		router,
		topic,
		variant,
	]);

	const btnClass = isStudent ? "stu-paper-btn" : "saved-research-btn";
	const btnPrimaryClass = isStudent
		? "stu-paper-btn stu-paper-btn-primary"
		: "saved-research-btn saved-research-btn-primary";

	if (loading) {
		return (
			<div className={`saved-research-page${isStudent ? " saved-research-page-student" : ""}`}>
				<p className="saved-research-muted">Loading saved research…</p>
			</div>
		);
	}

	if (notFound || !paper) {
		return (
			<div className={`saved-research-page${isStudent ? " saved-research-page-student" : ""}`}>
				<Link href={savedListPath} className={isStudent ? "stu-research-paper-back" : "saved-research-back"}>
					← Back to saved research
				</Link>
				<div className="saved-research-empty">
					<h2>Saved research not found</h2>
					<p>It may have been removed or you may not have access.</p>
				</div>
			</div>
		);
	}

	return (
		<div className={`saved-research-page${isStudent ? " saved-research-page-student" : ""}`}>
			<div className="saved-research-top">
				<Link href={savedListPath} className={isStudent ? "stu-research-paper-back" : "saved-research-back"}>
					← Back to saved research
				</Link>
			</div>

			<header className="saved-research-head">
				<div className="saved-research-head-main">
					<p className="saved-research-meta">
						Last updated {formatWhen(paper.updatedAt)}
						{dirty ? " · Unsaved changes" : ""}
						{` · Overall input score ${effort.userEffortScore}/100`}
					</p>
				</div>
				<div className="saved-research-head-actions">
					<button
						type="button"
						className={btnPrimaryClass}
						onClick={() => void handleSave()}
						disabled={!dirty || saving}
					>
						{saving ? "Saving…" : "Save changes"}
					</button>
					<button type="button" className={btnClass} onClick={handleDownload}>
						<IconDownload size={16} />
						Download PDF
					</button>
					<button
						type="button"
						className={btnClass}
						onClick={() => setPendingRegenerate(true)}
						disabled={regenerating || applyingStyle || saving || !hasTokens}
						title={
							!hasTokens
								? "Research token limit reached"
								: "Refine and improve this research paper with a new AI pass"
						}
					>
						<IconRefresh size={16} />
						{regenerating ? "Starting…" : "Regenerate"}
					</button>
					<button
						type="button"
						className={`${btnClass} saved-research-btn-danger`}
						onClick={() => setPendingDelete(true)}
					>
						<IconTrash size={16} />
						Delete
					</button>
				</div>
			</header>

			{notice && <div className="saved-research-notice saved-research-notice-success">{notice}</div>}
			{error && (
				<div className="saved-research-notice saved-research-notice-error" role="alert">
					{error}
				</div>
			)}

			<section
				className="saved-research-citation-bar"
				aria-label="Reference style controls"
			>
				<div className="saved-research-citation-bar-main">
					<CitationStyleSelect
						id="saved-research-citation-style"
						value={citationStyle}
						onChange={handleCitationStyleChange}
					/>
					<p className="saved-research-citation-bar-hint">
						Active: <strong>{getStyleLabel(citationStyle)}</strong> — reformats the References
						section only. Source links are preserved.
					</p>
				</div>
				<div className="saved-research-citation-bar-actions">
					<button
						type="button"
						className={btnPrimaryClass}
						onClick={() => void handleApplyReferenceStyle()}
						disabled={applyingStyle}
						title="Reformat References to the selected style"
					>
						{applyingStyle ? "Applying…" : "Apply reference style"}
					</button>
				</div>
			</section>

			<section className="saved-research-effort saved-research-effort-compact" aria-labelledby="saved-research-effort-title">
				<div className="saved-research-effort-head">
					<div className="saved-research-effort-overall">
						<div
							className="saved-research-effort-ring"
							style={{ ["--p" as string]: String(effort.userEffortScore) }}
							aria-label={`Overall score of user’s input: ${effort.userEffortScore} out of 100`}
						>
							<span className="saved-research-effort-ring-value">{effort.userEffortScore}</span>
							<span className="saved-research-effort-ring-max">/ 100</span>
						</div>
						<div className="saved-research-effort-overall-copy">
							<h2 id="saved-research-effort-title" className="saved-research-effort-overall-label">
								Overall score of user’s input
							</h2>
							<p className="saved-research-effort-overall-band">{bandLabel(effort.userBand)}</p>
						</div>
					</div>
					<div className="saved-research-effort-head-actions">
						<button
							type="button"
							className={btnPrimaryClass}
							onClick={() => setEffortReportOpen(true)}
						>
							Effort Report
						</button>
					</div>
				</div>
			</section>

			<div className="saved-research-card saved-research-card-doc">
				<div className="saved-research-edit saved-research-edit-doc">
					<label className="saved-research-field-label" htmlFor="saved-research-topic">
						Research topic
					</label>
					<input
						id="saved-research-topic"
						className="saved-research-topic-input"
						value={topic}
						onChange={(event) => {
							setTopic(event.target.value);
							setDirty(true);
						}}
					/>
					<p className="saved-research-field-label">Standard editable document</p>
					<ResearchDocEditor
						value={editorHtml}
						placeholder="Edit your research paper like a Word document…"
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
			</div>

			<EffortReportModal
				open={effortReportOpen}
				onClose={() => setEffortReportOpen(false)}
				title={displayTitle}
				topic={topic}
				effort={effort}
				author={effortAuthor}
				onDownload={() => void handleDownloadEffortReport()}
				downloading={downloadingEffort}
				variant={variant}
			/>

			<ConfirmDialog
				open={pendingRegenerate}
				title="Regenerate this paper?"
				description="AI will refine the current draft (stronger gap, literature synthesis, limitations, and grounded citations). Unsaved edits are saved first. Generation uses research tokens and may take several minutes."
				confirmLabel="Regenerate"
				loading={regenerating}
				onConfirm={() => void startRegenerate()}
				onCancel={() => {
					if (regenerating) return;
					setPendingRegenerate(false);
				}}
			/>

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

	return <AulaLayout>{page}</AulaLayout>;
}
