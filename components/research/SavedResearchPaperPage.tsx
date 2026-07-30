"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AulaLayout } from "@/components/AulaLayout";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EffortReportModal } from "@/components/research/EffortReportModal";
import { ResearchDocEditor } from "@/components/research/ResearchDocEditor";
import { ResearchPaperMarkdown } from "@/components/research/ResearchPaperMarkdown";
import { StudentLayout } from "@/components/StudentLayout";
import {
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
import { formatResearchPaperReferences } from "@/lib/research-paper-references";
import { loadResearchWizardDraft } from "@/lib/research-wizard-draft";
import { savedResearchListPath } from "@/lib/saved-research-routes";

type ViewMode = "preview" | "edit";

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

	const [paper, setPaper] = useState<SavedResearchPaper | null>(null);
	const [loading, setLoading] = useState(true);
	const [notFound, setNotFound] = useState(false);
	const [mode, setMode] = useState<ViewMode>("edit");
	const [topic, setTopic] = useState("");
	const [content, setContent] = useState("");
	const [editorHtml, setEditorHtml] = useState("");
	const [dirty, setDirty] = useState(false);
	const [saving, setSaving] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [pendingDelete, setPendingDelete] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [exportingEffort, setExportingEffort] = useState(false);
	const [showEffortReport, setShowEffortReport] = useState(false);
	const [materials, setMaterials] = useState<PaperMaterialCounts>(emptyMaterialCounts());

	const researchPath = isStudent ? "/student/research" : "/research";
	const savedListPath = savedResearchListPath(variant);
	const workspacePath = isStudent ? "/student/research/paper" : "/research/paper";

	useEffect(() => {
		if (!id) {
			setLoading(false);
			setNotFound(true);
			setPaper(null);
			return;
		}
		setLoading(true);
		setNotFound(false);
		void getSavedResearchPaperById(id).then((loaded) => {
			if (!loaded) {
				setNotFound(true);
				setPaper(null);
			} else {
				setPaper(loaded);
				setTopic(loaded.topic);
				setContent(loaded.content);
				setEditorHtml(markdownToDocHtml(loaded.content));
				setDirty(false);
				setMode("edit");
			}
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
		if (mode === "edit") {
			const fromHtml = htmlToOutlineText(editorHtml);
			return fromHtml.trim() ? fromHtml : content;
		}
		return content;
	}, [mode, editorHtml, content]);

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

	const authorProfile = useMemo(
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

	const paperMeta = useMemo(
		() => ({
			author: user?.name ?? null,
			department: user?.department ?? null,
			affiliation: user?.institution ?? null,
			fallbackTopic: topic || null,
		}),
		[user?.name, user?.department, user?.institution, topic],
	);

	const syncContentFromHtml = useCallback((html: string) => {
		setEditorHtml(html);
		setContent(htmlToOutlineText(html));
		setDirty(true);
	}, []);

	const handleSave = useCallback(async () => {
		if (!id || !dirty) return;
		const nextContent = htmlToOutlineText(editorHtml);
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
		setEditorHtml(markdownToDocHtml(result.paper.content));
		setDirty(false);
		setNotice("Changes saved.");
		window.setTimeout(() => setNotice(null), 4000);
	}, [id, dirty, topic, editorHtml]);

	const handleDownload = useCallback(() => {
		const nextContent = htmlToOutlineText(editorHtml) || content;
		if (!nextContent.trim()) return;
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
	}, [content, displayTitle, editorHtml, id, paper?.createdAt, paper?.updatedAt, paperMeta, topic]);

	const handleDownloadEffort = useCallback(async () => {
		if (exportingEffort) return;
		setExportingEffort(true);
		try {
			await downloadPaperEffortReport(
				{
					title: displayTitle,
					topic,
					effort,
					author: authorProfile,
				},
				"pdf",
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not download effort report.");
		} finally {
			setExportingEffort(false);
		}
	}, [authorProfile, displayTitle, effort, exportingEffort, topic]);

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

	const enterEditMode = useCallback(() => {
		setEditorHtml(markdownToDocHtml(content));
		setMode("edit");
	}, [content]);

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
					<h1 className="saved-research-title">{displayTitle}</h1>
					<p className="saved-research-meta">
						Last updated {formatWhen(paper.updatedAt)}
						{dirty ? " · Unsaved changes" : ""}
						{` · Overall input score ${effort.userEffortScore}/100`}
					</p>
				</div>
				<div className="saved-research-head-actions">
					<div className="saved-research-mode-toggle" role="tablist" aria-label="View mode">
						<button
							type="button"
							role="tab"
							className={`saved-research-mode-btn${mode === "preview" ? " active" : ""}`}
							aria-selected={mode === "preview"}
							onClick={() => {
								setContent(htmlToOutlineText(editorHtml) || content);
								setMode("preview");
							}}
						>
							<IconFileText size={14} />
							Reading view
						</button>
						<button
							type="button"
							role="tab"
							className={`saved-research-mode-btn${mode === "edit" ? " active" : ""}`}
							aria-selected={mode === "edit"}
							onClick={enterEditMode}
						>
							<IconEdit size={14} />
							Editable document
						</button>
					</div>
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
						onClick={() => setShowEffortReport(true)}
						title="View overall score of user’s input"
					>
						View report
					</button>
					<button
						type="button"
						className={btnClass}
						onClick={() => void handleDownloadEffort()}
						disabled={exportingEffort}
						title="Download user effort & AI attribution report"
					>
						<IconDownload size={16} />
						{exportingEffort ? "Preparing…" : "Effort report"}
					</button>
					<Link href={`${workspacePath}?topic=${encodeURIComponent(topic)}`} className={btnClass}>
						AI workspace
					</Link>
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

			<section className="saved-research-effort saved-research-effort-compact" aria-labelledby="saved-research-effort-title">
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
						<p className="saved-research-effort-overall-formula">
							Open the full report for uploads, edits, graphs/labs, and researcher details.
						</p>
					</div>
					<div className="saved-research-effort-head-actions">
						<button
							type="button"
							className={btnPrimaryClass}
							onClick={() => setShowEffortReport(true)}
						>
							View report
						</button>
						<button
							type="button"
							className={btnClass}
							onClick={() => void handleDownloadEffort()}
							disabled={exportingEffort}
						>
							<IconDownload size={16} />
							{exportingEffort ? "Preparing…" : "Download report"}
						</button>
					</div>
				</div>
			</section>

			<div className={`saved-research-card${mode === "edit" ? " saved-research-card-doc" : ""}`}>
				{mode === "edit" ? (
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
				) : (
					<div className="saved-research-preview research-markdown-panel">
						<ResearchPaperMarkdown content={formattedContent || content} />
					</div>
				)}
			</div>

			<EffortReportModal
				open={showEffortReport}
				onClose={() => setShowEffortReport(false)}
				title={displayTitle}
				topic={topic}
				effort={effort}
				author={authorProfile}
				onDownload={() => void handleDownloadEffort()}
				downloading={exportingEffort}
				variant={variant}
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
