"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BookOpen, Printer } from "lucide-react";

import { AulaLayout } from "@/components/AulaLayout";
import { EffortReportBody } from "@/components/research/EffortReportBody";
import { StudentLayout } from "@/components/StudentLayout";
import { IconChevronLeft, IconDownload } from "@/components/ui/ButtonIcon";
import { useAuth } from "@/hooks/useAuth";
import {
	resolvePaperDisplayTitle,
	getSavedResearchPaperById,
	updateSavedResearchPaper,
	type SavedResearchPaper,
} from "@/lib/chat-research-storage";
import {
	computePaperEffort,
	downloadPaperEffortReport,
	type PaperAuthorProfile,
	type PaperEffortSnapshot,
} from "@/lib/research-paper-effort";
import {
	hasResearchSources,
	loadPaperEffortEvidence,
	type PaperEffortEvidence,
} from "@/lib/research-paper-effort-evidence";
import { peekPaperSources } from "@/lib/research-paper-sources";
import { loadResearchWizardDraft } from "@/lib/research-wizard-draft";
import { savedResearchListPath, savedResearchPagePath } from "@/lib/saved-research-routes";
import {
	fetchProjects,
	type ResearchProject,
	type ResearchSourceSelection,
} from "@/lib/research-assets-api";
import { notebookLibraryMeta } from "@/lib/research-notebook";

type Props = {
	variant?: "lecturer" | "student";
};

function SavedResearchEffortContent({ variant = "lecturer" }: Props) {
	const searchParams = useSearchParams();
	const { user } = useAuth();
	const id = searchParams.get("id")?.trim() ?? "";
	const isStudent = variant === "student";
	const paperPath = id ? savedResearchPagePath(id, variant) : savedResearchListPath(variant);
	const savedListPath = savedResearchListPath(variant);

	const [paper, setPaper] = useState<SavedResearchPaper | null>(null);
	const [effort, setEffort] = useState<PaperEffortSnapshot | null>(null);
	const [sources, setSources] = useState<ResearchSourceSelection | null>(null);
	const [evidence, setEvidence] = useState<PaperEffortEvidence | null>(null);
	const [projects, setProjects] = useState<ResearchProject[]>([]);
	const [loading, setLoading] = useState(true);
	const [switchingProject, setSwitchingProject] = useState(false);
	const [notFound, setNotFound] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [downloading, setDownloading] = useState(false);

	const author: PaperAuthorProfile = {
		name: user?.name ?? null,
		email: user?.email ?? null,
		department: user?.department ?? null,
		institution: user?.institution ?? null,
	};

	useEffect(() => {
		if (!id) {
			setLoading(false);
			setNotFound(true);
			setPaper(null);
			setEffort(null);
			setSources(null);
			setEvidence(null);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setNotFound(false);
		setError(null);

		void (async () => {
			const [loaded, userProjects] = await Promise.all([
				getSavedResearchPaperById(id),
				fetchProjects().catch(() => [] as ResearchProject[]),
			]);

			if (cancelled) return;
			if (!loaded) {
				setNotFound(true);
				setPaper(null);
				setEffort(null);
				setSources(null);
				setEvidence(null);
				setLoading(false);
				return;
			}

			setProjects(userProjects);

			try {
				const wizard = loadResearchWizardDraft(isStudent ? "student" : "lecturer", user?.id);
				const staged = peekPaperSources();
				const stored = loaded.sources ?? null;
				const resolvedSources = hasResearchSources(stored)
					? stored
					: staged ?? wizard?.selectedSources ?? stored;
				const paperTitle = resolvePaperDisplayTitle(loaded.content, loaded.topic || "Research paper");
				const loadedEvidence = await loadPaperEffortEvidence(
					resolvedSources,
					loaded.topic,
					paperTitle,
				);
				if (cancelled) return;
				const snapshot = computePaperEffort({
					content: loaded.content,
					aiBaselineContent: loaded.aiBaselineContent ?? loaded.content ?? null,
					humanEdited: loaded.humanEdited,
					topic: loaded.topic,
					materials: loadedEvidence.materials,
					sources: resolvedSources,
					evidence: loadedEvidence,
				});
				setPaper(loaded);
				setEffort(snapshot);
				setSources(resolvedSources ?? null);
				setEvidence(loadedEvidence);
			} catch (loadError) {
				if (cancelled) return;
				setPaper(loaded);
				setEffort(null);
				setSources(null);
				setEvidence(null);
				setError(
					loadError instanceof Error ? loadError.message : "Could not load the effort report.",
				);
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [id, isStudent, user?.id]);

	const displayTitle = paper
		? resolvePaperDisplayTitle(paper.content, paper.topic || "Research paper")
		: "Effort report";

	const handleSelectProject = useCallback(
		async (projectId: string) => {
			if (!paper) return;
			setSwitchingProject(true);
			setError(null);
			try {
				const nextSources: ResearchSourceSelection = {
					documentIds: sources?.documentIds ?? [],
					datasetIds: sources?.datasetIds ?? [],
					questionnaireIds: sources?.questionnaireIds ?? [],
					noteIds: sources?.noteIds ?? [],
					projectIds: projectId ? [projectId] : [],
				};
				const nextEvidence = await loadPaperEffortEvidence(
					nextSources,
					paper.topic,
					displayTitle,
				);
				const nextSnapshot = computePaperEffort({
					content: paper.content,
					aiBaselineContent: paper.aiBaselineContent ?? paper.content ?? null,
					humanEdited: paper.humanEdited,
					topic: paper.topic,
					materials: nextEvidence.materials,
					sources: nextSources,
					evidence: nextEvidence,
				});

				setSources(nextSources);
				setEvidence(nextEvidence);
				setEffort(nextSnapshot);

				await updateSavedResearchPaper(paper.id, {
					sources: nextSources,
				});
			} catch (switchError) {
				setError(
					switchError instanceof Error
						? switchError.message
						: "Could not link selected notebook.",
				);
			} finally {
				setSwitchingProject(false);
			}
		},
		[displayTitle, paper, sources],
	);

	const handleDownload = useCallback(async () => {
		if (!paper || !effort) return;
		setDownloading(true);
		setError(null);
		try {
			const wizard = loadResearchWizardDraft(isStudent ? "student" : "lecturer", user?.id);
			const staged = peekPaperSources();
			const stored = paper.sources ?? null;
			const resolvedSources = hasResearchSources(stored)
				? stored
				: staged ?? wizard?.selectedSources ?? stored;
			const loadedEvidence = await loadPaperEffortEvidence(
				resolvedSources,
				paper.topic,
				displayTitle,
			);
			await downloadPaperEffortReport({
				title: displayTitle,
				topic: paper.topic,
				effort,
				author,
				paperId: paper.id,
				createdAt: paper.createdAt,
				sources: resolvedSources,
				evidence: loadedEvidence,
			});
		} catch (downloadError) {
			setError(
				downloadError instanceof Error
					? downloadError.message
					: "Could not download effort report.",
			);
		} finally {
			setDownloading(false);
		}
	}, [author, displayTitle, effort, isStudent, paper, user?.id]);

	if (loading) {
		return (
			<div className="saved-research-effort-page">
				<div className="saved-research-effort-page-top">
					<Link href={paperPath} className="saved-research-back">
						<IconChevronLeft size={14} />
						Back to paper
					</Link>
				</div>
				<div className="saved-research-empty">
					<h2>Loading effort report…</h2>
					<p>Scoring capture, writing, and linked materials for this manuscript.</p>
				</div>
			</div>
		);
	}

	if (notFound || !paper) {
		return (
			<div className="saved-research-effort-page">
				<div className="saved-research-effort-page-top">
					<Link href={savedListPath} className="saved-research-back">
						<IconChevronLeft size={14} />
						Saved research
					</Link>
				</div>
				<div className="saved-research-empty">
					<h2>Saved research not found</h2>
					<p>It may have been removed or you may not have access to this document.</p>
				</div>
			</div>
		);
	}

	const selectedProjectId =
		sources?.projectIds?.[0] || evidence?.projectId || (projects.length === 1 ? projects[0]?.id : "");

	const totalItemsCaptured =
		(evidence?.pages.length ?? 0) +
		(evidence?.files.length ?? 0) +
		(evidence?.surveys.length ?? 0) +
		(evidence?.datasets.length ?? 0) +
		(evidence?.pictures.length ?? 0) +
		(evidence?.lab.length ?? 0);

	return (
		<div className="saved-research-effort-page">
			<div className="saved-research-effort-page-top">
				<Link href={paperPath} className="saved-research-back">
					<IconChevronLeft size={14} />
					Back to paper
				</Link>

				{effort ? (
					<div className="saved-research-effort-page-actions">
						<button
							type="button"
							className="saved-research-btn"
							onClick={() => window.print()}
							title="Print this official record"
						>
							<Printer className="size-3.5" />
							Print record
						</button>
						<button
							type="button"
							className="saved-research-btn saved-research-btn-primary"
							onClick={() => void handleDownload()}
							disabled={downloading}
						>
							<IconDownload size={14} />
							{downloading ? "Preparing…" : "Download official PDF"}
						</button>
					</div>
				) : null}
			</div>

			{projects.length > 0 ? (
				<div className="saved-research-effort-source-bar">
					<div className="saved-research-effort-source-info">
						<span className="saved-research-effort-source-label">
							<BookOpen className="size-4" />
							Linked Research Notebook:
						</span>
						<select
							className="saved-research-effort-source-select"
							value={selectedProjectId}
							onChange={(e) => void handleSelectProject(e.target.value)}
							disabled={switchingProject}
							aria-label="Select linked research notebook"
						>
							{projects.map((p) => (
								<option key={p.id} value={p.id}>
									{p.title} ({notebookLibraryMeta(p)})
								</option>
							))}
						</select>
					</div>

					<span className="saved-research-effort-source-stats">
						{totalItemsCaptured} item{totalItemsCaptured === 1 ? "" : "s"} captured ({effort?.captureScore ?? 0}% capture)
					</span>
				</div>
			) : null}

			{error ? (
				<div className="saved-research-notice saved-research-notice-error" role="alert">
					{error}
				</div>
			) : null}

			{effort ? (
				<div className="saved-research-effort-page-card">
					<EffortReportBody
						title={displayTitle}
						topic={paper.topic}
						effort={effort}
						author={author}
						paperId={paper.id}
						createdAt={paper.createdAt}
						sources={sources}
						evidence={evidence}
					/>
				</div>
			) : (
				<div className="saved-research-empty">
					<h2>Effort report unavailable</h2>
					<p>The manuscript loaded, but the effort score could not be calculated.</p>
				</div>
			)}
		</div>
	);
}

export function SavedResearchEffortPage({ variant = "lecturer" }: Props) {
	const page = <SavedResearchEffortContent variant={variant} />;

	if (variant === "student") {
		return <StudentLayout>{page}</StudentLayout>;
	}

	return <AulaLayout showRightPanel={false}>{page}</AulaLayout>;
}
