"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
	ArrowRight,
	BarChart3,
	BookOpen,
	ClipboardList,
	Clock,
	Database,
	FileText,
	FlaskConical,
	Layers,
	Loader2,
	Plus,
	Search,
	Trash2,
	X,
} from "lucide-react";

import { AulaLayout } from "@/components/AulaLayout";
import { useFeatureAiNoticeGate } from "@/components/legal/useFeatureAiNoticeGate";
import { NotebookWorkspace } from "@/components/research-notebook/NotebookWorkspace";
import { StudentLayout } from "@/components/StudentLayout";
import {
	createProject,
	deleteProject,
	fetchProjects,
	fetchWorkspace,
	type ResearchDataset,
	type ResearchDocument,
	type ResearchProject,
} from "@/lib/research-assets-api";
import { emptyNotebookData, OPEN_CREATE_NOTEBOOK_EVENT } from "@/lib/research-notebook";
import type { ResearchQuestionnaire } from "@/lib/research-questionnaire";
import { NOTEBOOK_AI_NOTICE } from "@/lib/feature-ai-notice";

type Variant = "lecturer" | "student";

function basePath(variant: Variant): string {
	return variant === "student" ? "/student/research/notebook" : "/research/notebook";
}

function formatUpdated(iso: string): string {
	try {
		return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(
			new Date(iso),
		);
	} catch {
		return "";
	}
}

export function NotebookListPage({ variant }: { variant: Variant }) {
	const router = useRouter();
	const pathname = usePathname() ?? "";
	const [projects, setProjects] = useState<ResearchProject[]>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [title, setTitle] = useState("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [createError, setCreateError] = useState("");
	const [creating, setCreating] = useState(false);
	const [modalOpen, setModalOpen] = useState(false);
	const [pendingDelete, setPendingDelete] = useState<ResearchProject | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState("");
	const nameRef = useRef<HTMLInputElement>(null);
	const root = basePath(variant);
	const dashboardHref = variant === "student" ? "/student/dashboard" : "/dashboard";
	const { aiNoticeModal } = useFeatureAiNoticeGate(NOTEBOOK_AI_NOTICE, dashboardHref);

	const filteredProjects = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return projects;
		return projects.filter(
			(p) =>
				p.title.toLowerCase().includes(q) ||
				(p.description && p.description.toLowerCase().includes(q)),
		);
	}, [projects, searchQuery]);

	const libraryStats = useMemo(() => {
		let datasets = 0;
		let files = 0;
		let effortSum = 0;
		for (const project of projects) {
			datasets += project.counts?.datasets ?? 0;
			files += project.counts?.documents ?? 0;
			effortSum += Math.max(0, Math.min(100, project.progress ?? 0));
		}
		return {
			notebooks: projects.length,
			datasets,
			files,
			avgEffort: projects.length ? Math.round(effortSum / projects.length) : 0,
		};
	}, [projects]);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			setProjects(await fetchProjects());
			setError("");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not load notebooks.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const closeCreateModal = useCallback(() => {
		if (creating) return;
		setModalOpen(false);
		setCreateError("");
	}, [creating]);

	const openCreateModal = useCallback(() => {
		setCreateError("");
		setTitle("");
		setModalOpen(true);
	}, []);

	useEffect(() => {
		const onOpen = () => openCreateModal();
		window.addEventListener(OPEN_CREATE_NOTEBOOK_EVENT, onOpen);
		return () => window.removeEventListener(OPEN_CREATE_NOTEBOOK_EVENT, onOpen);
	}, [openCreateModal]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const params = new URLSearchParams(window.location.search);
		if (params.get("new") !== "1") return;
		openCreateModal();
		router.replace(root);
	}, [pathname, root, router, openCreateModal]);

	useEffect(() => {
		if (!modalOpen) return;
		const t = window.setTimeout(() => nameRef.current?.focus(), 40);
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") closeCreateModal();
		};
		window.addEventListener("keydown", onKey);
		return () => {
			window.clearTimeout(t);
			window.removeEventListener("keydown", onKey);
		};
	}, [modalOpen, closeCreateModal]);

	const closeDeleteModal = useCallback(() => {
		if (deleting) return;
		setPendingDelete(null);
		setDeleteError("");
	}, [deleting]);

	useEffect(() => {
		if (!pendingDelete) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") closeDeleteModal();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [pendingDelete, closeDeleteModal]);

	async function onConfirmDelete() {
		if (!pendingDelete) return;
		setDeleting(true);
		setDeleteError("");
		try {
			await deleteProject(pendingDelete.id);
			setPendingDelete(null);
			await load();
		} catch (err) {
			setDeleteError(err instanceof Error ? err.message : "Could not delete notebook.");
		} finally {
			setDeleting(false);
		}
	}

	async function onCreate(e: FormEvent) {
		e.preventDefault();
		const name = title.trim();
		if (!name) {
			setCreateError("Enter a notebook name before creating.");
			return;
		}
		setCreating(true);
		setCreateError("");
		try {
			const project = await createProject({ title: name, description: "Research notebook" });
			router.push(`${root}/${project.id}`);
		} catch (err) {
			setCreateError(err instanceof Error ? err.message : "Could not create notebook.");
			setCreating(false);
		}
	}

	const inner = (
		<div className={`nb-hub nb-hub-${variant}`}>
			<header className="nb-hub-intro">
				<div className="nb-hub-intro-copy">
					<p className="nb-hub-eyebrow">Governed research workspace</p>
					<h1 id="nb-hub-hero-title">Notebooks</h1>
					<p>
						Keep literature notes, questionnaires, datasets, figures, and lab records in one manuscript-ready
						workspace.
					</p>
				</div>
				<dl className="nb-hub-stats" aria-label="Library summary">
					<div>
						<dt>Notebooks</dt>
						<dd>{loading ? "—" : libraryStats.notebooks}</dd>
					</div>
					<div>
						<dt>Datasets</dt>
						<dd>{loading ? "—" : libraryStats.datasets}</dd>
					</div>
					<div>
						<dt>Files</dt>
						<dd>{loading ? "—" : libraryStats.files}</dd>
					</div>
					<div>
						<dt>Avg. effort</dt>
						<dd>{loading ? "—" : `${libraryStats.avgEffort}%`}</dd>
					</div>
				</dl>
			</header>

			{!loading && projects.length === 0 ? (
				<ul className="nb-hub-capabilities" aria-label="What a notebook contains">
					<li>
						<span className="nb-hub-cap-icon nb-hub-cap-doc" aria-hidden>
							<FileText className="size-4" />
						</span>
						<div>
							<strong>Documents</strong>
							<span>Notes, PDFs, and source files</span>
						</div>
					</li>
					<li>
						<span className="nb-hub-cap-icon nb-hub-cap-survey" aria-hidden>
							<ClipboardList className="size-4" />
						</span>
						<div>
							<strong>Surveys</strong>
							<span>Questionnaires and captured responses</span>
						</div>
					</li>
					<li>
						<span className="nb-hub-cap-icon nb-hub-cap-data" aria-hidden>
							<BarChart3 className="size-4" />
						</span>
						<div>
							<strong>Data &amp; figures</strong>
							<span>Datasets and publication plots</span>
						</div>
					</li>
					<li>
						<span className="nb-hub-cap-icon nb-hub-cap-lab" aria-hidden>
							<FlaskConical className="size-4" />
						</span>
						<div>
							<strong>Lab work</strong>
							<span>Protocols, observations, and attachments</span>
						</div>
					</li>
				</ul>
			) : null}

			<section className="nb-hub-library" aria-labelledby="nb-library-heading">
				<div className="nb-hub-library-head">
					<div className="nb-hub-library-title-group">
						<h2 id="nb-library-heading">Library</h2>
						<p className="nb-hub-library-subtitle">
							{loading
								? "Loading notebooks…"
								: `${filteredProjects.length} ${filteredProjects.length === 1 ? "notebook" : "notebooks"}`}
						</p>
					</div>

					{projects.length > 0 ? (
						<div className="nb-hub-library-actions">
							<div className="nb-hub-search-box">
								<Search className="size-4 nb-hub-search-icon" aria-hidden />
								<input
									type="search"
									placeholder="Search by title…"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									aria-label="Search notebooks"
								/>
								{searchQuery ? (
									<button
										type="button"
										className="nb-hub-search-clear"
										onClick={() => setSearchQuery("")}
										aria-label="Clear search"
									>
										<X className="size-3.5" />
									</button>
								) : null}
							</div>
							<button type="button" className="nb-hub-create-btn" onClick={openCreateModal}>
								<Plus className="size-4" aria-hidden />
								<span>New notebook</span>
							</button>
						</div>
					) : null}
				</div>

				{error ? (
					<div className="nb-error-banner" role="alert">
						<p>{error}</p>
						<button type="button" className="nb-btn nb-btn-ghost" onClick={() => void load()}>
							Retry
						</button>
					</div>
				) : null}

				{loading ? (
					<div className="nb-hub-skeleton-list" aria-hidden>
						<div className="nb-hub-skeleton-card" />
						<div className="nb-hub-skeleton-card" />
						<div className="nb-hub-skeleton-card" />
					</div>
				) : projects.length === 0 ? (
					<div className="nb-hub-empty">
						<div className="nb-hub-empty-icon" aria-hidden>
							<BookOpen className="size-6" />
						</div>
						<h3>Start a research notebook</h3>
						<p>
							Create a workspace for a manuscript, lab series, or assignment. Documents, data, and figures stay
							together for writing and review.
						</p>
						<button type="button" className="nb-hub-create-btn" onClick={openCreateModal}>
							<Plus className="size-4" aria-hidden />
							Create notebook
						</button>
					</div>
				) : filteredProjects.length === 0 ? (
					<div className="nb-hub-empty nb-hub-empty-compact">
						<div className="nb-hub-empty-icon" aria-hidden>
							<Search className="size-6" />
						</div>
						<h3>No matching notebooks</h3>
						<p>Nothing matches “{searchQuery}”. Try a different title or clear the search.</p>
						<button type="button" className="nb-btn nb-btn-ghost" onClick={() => setSearchQuery("")}>
							Clear search
						</button>
					</div>
				) : (
					<div className="nb-hub-list">
						<div className="nb-hub-list-cols" aria-hidden>
							<span>Notebook</span>
							<span>Effort</span>
							<span>Assets</span>
							<span>Updated</span>
							<span />
						</div>
						{filteredProjects.map((project) => {
							const effort = Math.max(0, Math.min(100, project.progress ?? 0));
							const datasets = project.counts?.datasets ?? 0;
							const files = project.counts?.documents ?? 0;
							const pages = project.notebookData?.pages?.length ?? 1;

							return (
								<div key={project.id} className="nb-hub-card-wrapper">
									<Link href={`${root}/${project.id}`} className="nb-hub-card">
										<div className="nb-hub-card-main">
											<div className="nb-hub-card-icon-box" aria-hidden>
												<BookOpen className="size-4" />
											</div>
											<div className="nb-hub-card-header">
												<h3 className="nb-hub-card-title">{project.title}</h3>
												<p className="nb-hub-card-desc">
													{project.description && project.description !== "Research notebook"
														? project.description
														: "Notes, datasets, and figures"}
												</p>
											</div>
										</div>

										<div className="nb-hub-effort" aria-label={`Effort ${effort} percent`}>
											<div className="nb-hub-effort-track">
												<span style={{ width: `${effort}%` }} />
											</div>
											<strong>{effort}%</strong>
										</div>

										<div className="nb-hub-card-meta-row">
											<span>
												<Database className="size-3" aria-hidden />
												{datasets}
											</span>
											<span>
												<FileText className="size-3" aria-hidden />
												{files}
											</span>
											<span>
												<Layers className="size-3" aria-hidden />
												{pages}
											</span>
										</div>

										<span className="nb-hub-card-date">
											<Clock className="size-3.5" aria-hidden />
											{formatUpdated(project.updatedAt)}
										</span>

										<span className="nb-hub-card-open">
											Open
											<ArrowRight className="size-3.5" aria-hidden />
										</span>
									</Link>

									<button
										type="button"
										className="nb-hub-delete-btn"
										aria-label={`Delete ${project.title}`}
										title={`Delete ${project.title}`}
										onClick={() => {
											setDeleteError("");
											setPendingDelete(project);
										}}
									>
										<Trash2 className="size-3.5" />
									</button>
								</div>
							);
						})}
					</div>
				)}
			</section>

			{modalOpen && typeof document !== "undefined"
				? createPortal(
						<div className={`nb-modal-root nb-hub-${variant}`} role="presentation">
							<div
								className="nb-modal-backdrop"
								aria-label="Close"
								onClick={closeCreateModal}
							/>
							<div
								className="nb-modal-card"
								role="dialog"
								aria-modal="true"
								aria-labelledby="nb-create-modal-title"
							>
								<button
									type="button"
									className="nb-modal-close"
									aria-label="Close modal"
									disabled={creating}
									onClick={closeCreateModal}
								>
									<X className="size-4" />
								</button>

								<div className="nb-modal-header">
									<p className="nb-hub-eyebrow">New workspace</p>
									<h2 id="nb-create-modal-title">Create notebook</h2>
									<p className="nb-modal-copy">
										Use a manuscript title or project topic. Documents, questionnaires, datasets, and figures can
										be added after it opens.
									</p>
								</div>

								<form onSubmit={onCreate} className="nb-modal-form">
									<div className="nb-modal-field">
										<label htmlFor="nb-notebook-name">Notebook name</label>
										<input
											ref={nameRef}
											id="nb-notebook-name"
											value={title}
											onChange={(e) => setTitle(e.target.value)}
											placeholder="e.g. Mechanical Properties of High-Strength Alloys"
											required
											maxLength={160}
											autoComplete="off"
											disabled={creating}
											className="nb-modal-input"
										/>
									</div>

									{createError ? (
										<div className="nb-modal-error" role="alert">
											{createError}
										</div>
									) : null}

									<div className="nb-modal-actions">
										<button
											type="button"
											className="nb-btn nb-btn-ghost"
											disabled={creating}
											onClick={closeCreateModal}
										>
											Cancel
										</button>
										<button
											type="submit"
											disabled={creating || !title.trim()}
											className="nb-btn nb-btn-primary"
										>
											{creating ? (
												<>
													<Loader2 className="size-4 animate-spin" />
													<span>Creating…</span>
												</>
											) : (
												<span>Create notebook</span>
											)}
										</button>
									</div>
								</form>
							</div>
						</div>,
						document.body,
					)
				: null}

			{pendingDelete && typeof document !== "undefined"
				? createPortal(
						<div className={`nb-modal-root nb-hub-${variant}`} role="presentation">
							<div
								className="nb-modal-backdrop"
								aria-label="Close"
								onClick={closeDeleteModal}
							/>
							<div
								className="nb-modal-card"
								role="dialog"
								aria-modal="true"
								aria-labelledby="nb-delete-modal-title"
								aria-describedby="nb-delete-modal-copy"
							>
								<button
									type="button"
									className="nb-modal-close"
									aria-label="Close modal"
									disabled={deleting}
									onClick={closeDeleteModal}
								>
									<X className="size-4" />
								</button>

								<div className="nb-modal-header">
									<span className="nb-modal-danger-badge">Permanent</span>
									<h2 id="nb-delete-modal-title">Delete notebook</h2>
									<p id="nb-delete-modal-copy" className="nb-modal-copy">
										Delete <strong>“{pendingDelete.title}”</strong>? Documents, questionnaires, datasets, and lab
										records in this notebook will be removed and cannot be recovered.
									</p>
								</div>

								{deleteError ? (
									<div className="nb-modal-error" role="alert">
										{deleteError}
									</div>
								) : null}

								<div className="nb-modal-actions">
									<button
										type="button"
										className="nb-btn nb-btn-ghost"
										disabled={deleting}
										onClick={closeDeleteModal}
									>
										Cancel
									</button>
									<button
										type="button"
										className="nb-btn nb-btn-danger"
										disabled={deleting}
										onClick={() => void onConfirmDelete()}
									>
										{deleting ? (
											<>
												<Loader2 className="size-4 animate-spin" />
												<span>Deleting…</span>
											</>
										) : (
											<span>Delete notebook</span>
										)}
									</button>
								</div>
							</div>
						</div>,
						document.body,
					)
				: null}
		</div>
	);

	return variant === "student" ? (
		<StudentLayout>
			{inner}
			{aiNoticeModal}
		</StudentLayout>
	) : (
		<AulaLayout showRightPanel={false}>
			{inner}
			{aiNoticeModal}
		</AulaLayout>
	);
}

export function NotebookDetailPage({ variant, projectId }: { variant: Variant; projectId: string }) {
	const [project, setProject] = useState<ResearchProject | null>(null);
	const [initialDocuments, setInitialDocuments] = useState<ResearchDocument[]>([]);
	const [initialDatasets, setInitialDatasets] = useState<ResearchDataset[]>([]);
	const [initialQuestionnaires, setInitialQuestionnaires] = useState<ResearchQuestionnaire[]>([]);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(true);
	const root = basePath(variant);
	const dashboardHref = variant === "student" ? "/student/dashboard" : "/dashboard";
	const { aiNoticeModal } = useFeatureAiNoticeGate(NOTEBOOK_AI_NOTICE, dashboardHref);

	const applyWorkspace = useCallback((ws: Awaited<ReturnType<typeof fetchWorkspace>>) => {
		setProject({
			...ws.project,
			notebookData: ws.project.notebookData ?? emptyNotebookData(),
		});
		setInitialDocuments(ws.documents ?? []);
		setInitialDatasets(ws.datasets ?? []);
		setInitialQuestionnaires(ws.questionnaires ?? []);
	}, []);

	const load = useCallback(() => {
		setLoading(true);
		setError("");
		fetchWorkspace(projectId)
			.then((ws) => {
				applyWorkspace(ws);
			})
			.catch((err: unknown) => {
				setProject(null);
				setError(err instanceof Error ? err.message : "Could not open notebook.");
			})
			.finally(() => setLoading(false));
	}, [applyWorkspace, projectId]);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError("");
		fetchWorkspace(projectId)
			.then((ws) => {
				if (cancelled) return;
				applyWorkspace(ws);
			})
			.catch((err: unknown) => {
				if (!cancelled) {
					setProject(null);
					setError(err instanceof Error ? err.message : "Could not open notebook.");
				}
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [applyWorkspace, projectId]);

	const inner = (
		<div className="nb-page nb-page-studio">
			{error ? (
				<div className="nb-studio-state" role="alert">
					<span className="nb-hub-badge">Research Workspace</span>
					<h1>Unable to Open Notebook</h1>
					<p>{error}</p>
					<div className="nb-studio-state-actions">
						<Link href={root} className="nb-btn nb-btn-ghost">
							Back to notebooks
						</Link>
						<button type="button" className="nb-btn nb-btn-primary" onClick={load}>
							Try again
						</button>
					</div>
				</div>
			) : null}

			{loading && !error ? (
				<div className="nb-studio-state" aria-busy="true" aria-live="polite">
					<div className="nb-studio-skeleton" aria-hidden>
						<span />
						<span />
						<span />
					</div>
					<span className="nb-hub-badge">Research Workspace</span>
					<h1>Opening Notebook</h1>
					<p>Loading documents, questionnaires, datasets, and lab records for this workspace…</p>
				</div>
			) : null}

			{project && !error && !loading ? (
				<NotebookWorkspace
					key={project.id}
					project={project}
					notebooksHref={root}
					onProjectChange={setProject}
					initialDocuments={initialDocuments}
					initialDatasets={initialDatasets}
					initialQuestionnaires={initialQuestionnaires}
				/>
			) : null}
		</div>
	);

	return variant === "student" ? (
		<StudentLayout>
			{inner}
			{aiNoticeModal}
		</StudentLayout>
	) : (
		<AulaLayout showRightPanel={false} fullHeight>
			{inner}
			{aiNoticeModal}
		</AulaLayout>
	);
}
