"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Database, ImageIcon, Trash2, X } from "lucide-react";

import { AulaLayout } from "@/components/AulaLayout";
import { NotebookHubIllustration } from "@/components/research-notebook/NotebookHubIllustration";
import { NotebookWorkspace } from "@/components/research-notebook/NotebookWorkspace";
import { StudentLayout } from "@/components/StudentLayout";
import {
	createProject,
	deleteProject,
	fetchProjects,
	fetchWorkspace,
	type ResearchProject,
} from "@/lib/research-assets-api";
import { emptyNotebookData, OPEN_CREATE_NOTEBOOK_EVENT } from "@/lib/research-notebook";

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

	const totals = useMemo(() => {
		return projects.reduce(
			(acc, project) => {
				acc.datasets += project.counts.datasets ?? 0;
				acc.files += project.counts.documents ?? 0;
				acc.pages += project.notebookData?.pages.length ?? 0;
				return acc;
			},
			{ datasets: 0, files: 0, pages: 0 },
		);
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
		<div className="nb-hub">
			<section className="nb-hub-hero" aria-labelledby="nb-hub-hero-title">
				<div className="nb-hub-hero-copy">
					<p className="nb-hub-kicker">Research workspace</p>
					<h1 id="nb-hub-hero-title">Research Notebook</h1>
					<p>
						Keep documents, surveys, datasets, figures, and lab logs in one governed thread — ready for
						plotting, review, and later writing.
					</p>
				</div>
				<div className="nb-hub-summary" aria-label="Library summary">
					<div>
						<span className="nb-hub-stat-icon nb-hub-stat-icon-blue" aria-hidden>
							<BookOpen className="size-4" />
						</span>
						<strong>{loading ? "—" : projects.length}</strong>
						<span>Notebooks</span>
					</div>
					<div>
						<span className="nb-hub-stat-icon nb-hub-stat-icon-green" aria-hidden>
							<Database className="size-4" />
						</span>
						<strong>{loading ? "—" : totals.datasets}</strong>
						<span>Datasets</span>
					</div>
					<div>
						<span className="nb-hub-stat-icon nb-hub-stat-icon-purple" aria-hidden>
							<ImageIcon className="size-4" />
						</span>
						<strong>{loading ? "—" : totals.files}</strong>
						<span>Pictures & files</span>
					</div>
				</div>
				<div className="nb-hub-illustration">
					<NotebookHubIllustration />
				</div>
			</section>

			<section className="nb-hub-library" aria-labelledby="nb-library-heading">
				<div className="nb-hub-library-head">
					<h2 id="nb-library-heading">Your notebooks</h2>
					<p>{loading ? "Loading…" : `${projects.length} ${projects.length === 1 ? "notebook" : "notebooks"}`}</p>
				</div>
				{error ? <p className="nb-error">{error}</p> : null}
				{loading ? (
					<div className="nb-hub-skeleton" aria-hidden>
						<span />
						<span />
					</div>
				) : projects.length === 0 ? (
					<div className="nb-hub-empty">
						<BookOpen className="size-6" aria-hidden />
						<p>
							<strong>No notebooks yet</strong>
							Use <span>Create notebook</span> in the top bar to start a workspace.
						</p>
					</div>
				) : (
					<ul className="nb-hub-grid">
						{projects.map((project, index) => {
							const effort = Math.max(0, Math.min(100, project.progress ?? 0));
							const datasets = project.counts.datasets ?? 0;
							const files = project.counts.documents ?? 0;
							const tone = index % 2 === 0 ? "blue" : "green";
							return (
								<li key={project.id} className="nb-hub-row">
									<Link href={`${root}/${project.id}`} className="nb-hub-card">
										<span className={`nb-hub-card-icon nb-hub-card-icon-${tone}`} aria-hidden>
											<BookOpen className="size-4" />
										</span>
										<span className="nb-hub-card-body">
											<strong>{project.title}</strong>
											<span className="nb-hub-card-meta">
												{effort}% effort
												<span aria-hidden> · </span>
												{datasets} {datasets === 1 ? "dataset" : "datasets"}
												<span aria-hidden> · </span>
												{files} {files === 1 ? "file" : "files"}
											</span>
										</span>
										<span className="nb-hub-card-date">Updated {formatUpdated(project.updatedAt)}</span>
									</Link>
									<button
										type="button"
										className="nb-hub-delete"
										aria-label={`Delete ${project.title}`}
										onClick={() => {
											setDeleteError("");
											setPendingDelete(project);
										}}
									>
										<Trash2 className="size-3.5" />
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</section>

			{modalOpen && typeof document !== "undefined"
				? createPortal(
						<div className="nb-create-modal-root" role="presentation">
							<button
								type="button"
								className="nb-create-modal-backdrop"
								aria-label="Close"
								disabled={creating}
								onClick={closeCreateModal}
							/>
							<div
								className="nb-create-modal"
								role="dialog"
								aria-modal="true"
								aria-labelledby="nb-create-modal-title"
							>
								<button
									type="button"
									className="nb-create-modal-close"
									aria-label="Close"
									disabled={creating}
									onClick={closeCreateModal}
								>
									<X className="size-4" />
								</button>
								<p className="nb-hub-kicker">Research notebook</p>
								<h2 id="nb-create-modal-title">Create notebook</h2>
								<p className="nb-create-modal-copy">
									Give the notebook a name. You can add documents, surveys, data, pictures, and lab work after it
									opens.
								</p>
								<form onSubmit={onCreate}>
									<label htmlFor="nb-notebook-name">Notebook name</label>
									<div className="nb-hub-compose-bar">
										<input
											ref={nameRef}
											id="nb-notebook-name"
											value={title}
											onChange={(e) => setTitle(e.target.value)}
											placeholder="Manuscript title or project name"
											required
											maxLength={160}
											autoComplete="off"
											disabled={creating}
										/>
										<button type="submit" disabled={creating || !title.trim()}>
											{creating ? "Creating…" : "Create"}
										</button>
									</div>
									{createError ? <p className="nb-error">{createError}</p> : null}
									<div className="nb-create-modal-actions">
										<button type="button" className="nb-btn nb-btn-ghost" disabled={creating} onClick={closeCreateModal}>
											Cancel
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
						<div className="nb-create-modal-root" role="presentation">
							<button
								type="button"
								className="nb-create-modal-backdrop"
								aria-label="Close"
								disabled={deleting}
								onClick={closeDeleteModal}
							/>
							<div
								className="nb-create-modal"
								role="dialog"
								aria-modal="true"
								aria-labelledby="nb-delete-modal-title"
								aria-describedby="nb-delete-modal-copy"
							>
								<button
									type="button"
									className="nb-create-modal-close"
									aria-label="Close"
									disabled={deleting}
									onClick={closeDeleteModal}
								>
									<X className="size-4" />
								</button>
								<p className="nb-hub-kicker">Research notebook</p>
								<h2 id="nb-delete-modal-title">Delete notebook</h2>
								<p id="nb-delete-modal-copy" className="nb-create-modal-copy">
									Delete “{pendingDelete.title}”? This cannot be undone. Documents, surveys, datasets, and lab
									work in this notebook will be removed permanently.
								</p>
								{deleteError ? <p className="nb-error">{deleteError}</p> : null}
								<div className="nb-create-modal-actions">
									<button type="button" className="nb-btn nb-btn-ghost" disabled={deleting} onClick={closeDeleteModal}>
										Cancel
									</button>
									<button type="button" className="nb-btn nb-btn-danger" disabled={deleting} onClick={() => void onConfirmDelete()}>
										{deleting ? "Deleting…" : "Delete"}
									</button>
								</div>
							</div>
						</div>,
						document.body,
					)
				: null}
		</div>
	);

	return variant === "student" ? <StudentLayout>{inner}</StudentLayout> : <AulaLayout showRightPanel={false}>{inner}</AulaLayout>;
}

export function NotebookDetailPage({ variant, projectId }: { variant: Variant; projectId: string }) {
	const [project, setProject] = useState<ResearchProject | null>(null);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(true);
	const root = basePath(variant);

	const load = useCallback(() => {
		setLoading(true);
		setError("");
		fetchWorkspace(projectId)
			.then((ws) => {
				setProject({
					...ws.project,
					notebookData: ws.project.notebookData ?? emptyNotebookData(),
				});
			})
			.catch((err: unknown) => {
				setProject(null);
				setError(err instanceof Error ? err.message : "Could not open notebook.");
			})
			.finally(() => setLoading(false));
	}, [projectId]);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError("");
		fetchWorkspace(projectId)
			.then((ws) => {
				if (cancelled) return;
				setProject({
					...ws.project,
					notebookData: ws.project.notebookData ?? emptyNotebookData(),
				});
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
	}, [projectId]);

	const inner = (
		<div className="nb-page nb-page-studio">
			{error ? (
				<div className="nb-studio-state" role="alert">
					<p className="nb-hub-kicker">Research notebook</p>
					<h1>This notebook could not be opened</h1>
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
					<p className="nb-hub-kicker">Research notebook</p>
					<h1>Opening notebook</h1>
					<p>Loading documents, surveys, datasets, and lab work for this project.</p>
				</div>
			) : null}
			{project && !error ? (
				<NotebookWorkspace project={project} notebooksHref={root} onProjectChange={setProject} />
			) : null}
		</div>
	);

	return variant === "student" ? (
		<StudentLayout>{inner}</StudentLayout>
	) : (
		<AulaLayout showRightPanel={false} fullHeight>
			{inner}
		</AulaLayout>
	);
}
