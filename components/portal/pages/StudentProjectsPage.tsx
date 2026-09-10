"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
	Award,
	BookOpen,
	FileText,
	FlaskConical,
	FolderKanban,
	FolderOpen,
	LayoutGrid,
	List,
	MoreVertical,
	Newspaper,
	Plus,
	Search,
	Trash2,
	UserRound,
	X,
	type LucideIcon,
} from "lucide-react";
import { ConfirmModal } from "@/components/portal/ui/confirm-modal";
import { apiFetch } from "@/lib/portal-api";
import {
	PROJECT_TYPES,
	projectAdvisorNoun,
	projectTypeLabel,
} from "@/lib/portal/project-types";
import { cn } from "@/lib/portal/cn";

type Project = {
	_id: string;
	title: string;
	projectType: string;
	topic?: string;
	progressPercent?: number;
	status?: string;
	topicStatus?: "draft" | "submitted" | "approved" | string;
	updatedAt?: string;
	createdAt?: string;
	supervisor?: { id: string; name: string; email: string } | null;
};

type Chapter = {
	_id: string;
	status: string;
};

type ViewMode = "list" | "grid";
type StatusFilter = "all" | "active" | "draft" | "revision" | "completed";

const TYPE_META: Record<string, { icon: LucideIcon }> = {
	dissertation: { icon: Award },
	thesis: { icon: BookOpen },
	research: { icon: FlaskConical },
	project: { icon: FolderKanban },
	capstone: { icon: Award },
	publication: { icon: Newspaper },
};

function projectBucket(
	project: Project,
): "active" | "completed" | "archived" | "revision" | "draft" {
	const pct = project.progressPercent ?? 0;
	if (project.status === "archived") return "archived";
	if (pct >= 100 || project.status === "completed") return "completed";
	if (project.status === "needs_revision") return "revision";
	if (pct === 0 && (project.topicStatus === "draft" || !project.topicStatus)) {
		return "draft";
	}
	return "active";
}

function statusMeta(project: Project): {
	label: string;
	tone: "done" | "revision" | "progress" | "idle" | "archived";
} {
	const bucket = projectBucket(project);
	if (bucket === "completed") return { label: "Completed", tone: "done" };
	if (bucket === "archived") return { label: "Archived", tone: "archived" };
	if (bucket === "revision") return { label: "Needs revision", tone: "revision" };
	if (bucket === "draft") return { label: "Draft", tone: "idle" };
	return { label: "In progress", tone: "progress" };
}

function formatStartDate(value?: string) {
	if (!value) return "-";
	return new Date(value).toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

function formatToday() {
	return new Intl.DateTimeFormat(undefined, {
		weekday: "long",
		month: "long",
		day: "numeric",
	}).format(new Date());
}

export default function StudentProjectsPage() {
	const [projects, setProjects] = useState<Project[]>([]);
	const [chapterStats, setChapterStats] = useState<
		Record<string, { approved: number; total: number }>
	>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
	const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
	const [deleting, setDeleting] = useState(false);

	const [query, setQuery] = useState("");
	const [typeFilter, setTypeFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [viewMode, setViewMode] = useState<ViewMode>("list");

	useEffect(() => {
		let cancelled = false;
		async function load() {
			setLoading(true);
			setError(null);
			try {
				const list = (await apiFetch("/api/v1/projects")) as Project[];
				if (cancelled) return;
				setProjects(list);

				const statsEntries = await Promise.all(
					list.map(async (project) => {
						try {
							const chapters = (await apiFetch(
								`/api/v1/projects/${project._id}/chapters`,
							).catch(() => [])) as Chapter[];
							const approved = chapters.filter(
								(c) => c.status === "approved" || c.status === "locked",
							).length;
							return [
								project._id,
								{ approved, total: Math.max(chapters.length, 0) },
							] as const;
						} catch {
							return [project._id, { approved: 0, total: 0 }] as const;
						}
					}),
				);
				if (cancelled) return;
				setChapterStats(Object.fromEntries(statsEntries));
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "Failed to load projects");
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		void load();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		function onDocClick() {
			setMenuOpenId(null);
		}
		if (menuOpenId) document.addEventListener("click", onDocClick);
		return () => document.removeEventListener("click", onDocClick);
	}, [menuOpenId]);

	const researchProjects = useMemo(
		() => projects.filter((p) => p.projectType !== "assignment"),
		[projects],
	);

	const summary = useMemo(() => {
		let active = 0;
		let drafts = 0;
		let revision = 0;
		let completed = 0;
		for (const project of researchProjects) {
			const bucket = projectBucket(project);
			if (bucket === "completed") completed += 1;
			else if (bucket === "revision") revision += 1;
			else if (bucket === "draft") drafts += 1;
			else if (bucket === "active") active += 1;
		}
		return {
			total: researchProjects.length,
			active,
			drafts,
			revision,
			completed,
		};
	}, [researchProjects]);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return researchProjects.filter((p) => {
			if (typeFilter !== "all" && p.projectType !== typeFilter) return false;
			const bucket = projectBucket(p);
			if (statusFilter === "active" && bucket !== "active" && bucket !== "revision") {
				return false;
			}
			if (statusFilter === "draft" && bucket !== "draft") return false;
			if (statusFilter === "revision" && bucket !== "revision") return false;
			if (statusFilter === "completed" && bucket !== "completed") return false;
			if (!q) return true;
			const hay = [p.title, p.topic, projectTypeLabel(p.projectType), p.supervisor?.name]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();
			return hay.includes(q);
		});
	}, [researchProjects, typeFilter, statusFilter, query]);

	async function confirmDelete() {
		if (!pendingDelete) return;
		setDeleting(true);
		setError(null);
		try {
			await apiFetch(`/api/v1/projects/${pendingDelete._id}`, { method: "DELETE" });
			setProjects((prev) => prev.filter((p) => p._id !== pendingDelete._id));
			setPendingDelete(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not delete project");
		} finally {
			setDeleting(false);
		}
	}

	function chapterCopy(project: Project) {
		const stats = chapterStats[project._id];
		const pct = project.progressPercent ?? 0;
		const approved = stats?.approved ?? 0;
		const total =
			stats?.total && stats.total > 0
				? stats.total
				: pct > 0
					? Math.max(Math.round(100 / Math.max(pct, 1)), approved)
					: 0;
		return total > 0 ? `${approved} of ${total} chapters approved` : "No chapters yet";
	}

	const hasAssignments = projects.some((p) => p.projectType === "assignment");

	if (loading) {
		return (
			<div className="stu-proj" aria-busy="true">
				<header className="stu-proj-intro">
					<div className="stu-proj-intro-copy">
						<p className="stu-proj-eyebrow">{formatToday()}</p>
						<h1>Research projects</h1>
						<p>Loading dissertations, theses, and research folders...</p>
					</div>
				</header>
				<div className="stu-proj-skeleton-strip" aria-hidden />
				<div className="stu-proj-library">
					<div className="stu-proj-skeleton-row" aria-hidden />
					<div className="stu-proj-skeleton-row" aria-hidden />
					<div className="stu-proj-skeleton-row" aria-hidden />
				</div>
			</div>
		);
	}

	return (
		<div className="stu-proj">
			<header className="stu-proj-intro">
				<div className="stu-proj-intro-copy">
					<p className="stu-proj-eyebrow">{formatToday()}</p>
					<h1>Research projects</h1>
					<p>
						Dissertations, theses, and research folders. Coursework lives under{" "}
						<Link href="/student/assignments">Assignments</Link>.
					</p>
				</div>
				<Link href="/student/projects/new" className="stu-proj-btn stu-proj-btn-primary">
					<Plus size={15} />
					New project
				</Link>
			</header>

			<section className="stu-proj-metrics" aria-label="Project summary">
				{(
					[
						["all", "Total", summary.total, "All projects"],
						["active", "Active", summary.active, "In progress"],
						["draft", "Drafts", summary.drafts, "Not started"],
						["revision", "Revision", summary.revision, "Needs work"],
						["completed", "Done", summary.completed, "Completed"],
					] as const
				).map(([value, label, count, hint]) => (
					<button
						key={value}
						type="button"
						className={cn("stu-proj-metric", statusFilter === value && "is-on")}
						onClick={() => setStatusFilter(value)}
						aria-pressed={statusFilter === value}
					>
						<span className="stu-proj-metric-label">{label}</span>
						<strong className="stu-proj-metric-value">{count}</strong>
						<span className="stu-proj-metric-hint">{hint}</span>
					</button>
				))}
			</section>

			{error ? (
				<p className="stu-proj-error" role="alert">
					{error}
				</p>
			) : null}

			<section className="stu-proj-library" aria-labelledby="stu-proj-library-heading">
				<div className="stu-proj-library-head">
					<div>
						<h2 id="stu-proj-library-heading">Library</h2>
						<p>
							{filtered.length}{" "}
							{filtered.length === 1 ? "project" : "projects"}
							{statusFilter !== "all" || typeFilter !== "all" || query
								? " matching filters"
								: ""}
						</p>
					</div>
					<div className="stu-proj-library-tools">
						<div className="stu-proj-tabs" role="tablist" aria-label="Status filter">
							{(
								[
									["all", "All"],
									["active", "Active"],
									["draft", "Drafts"],
									["revision", "Revision"],
									["completed", "Done"],
								] as const
							).map(([value, label]) => (
								<button
									key={value}
									type="button"
									role="tab"
									aria-selected={statusFilter === value}
									className={cn(statusFilter === value && "is-on")}
									onClick={() => setStatusFilter(value)}
								>
									{label}
								</button>
							))}
						</div>
						<select
							value={typeFilter}
							onChange={(e) => setTypeFilter(e.target.value)}
							aria-label="Filter by type"
							className="stu-proj-select"
						>
							<option value="all">All types</option>
							{PROJECT_TYPES.filter((t) => t.value !== "assignment").map((t) => (
								<option key={t.value} value={t.value}>
									{t.label}
								</option>
							))}
						</select>
						<div className="stu-proj-search">
							<Search size={14} aria-hidden />
							<input
								type="search"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Search by title..."
								aria-label="Search projects"
							/>
							{query ? (
								<button
									type="button"
									className="stu-proj-search-clear"
									aria-label="Clear search"
									onClick={() => setQuery("")}
								>
									<X size={14} />
								</button>
							) : null}
						</div>
						<div className="stu-proj-view" role="group" aria-label="View mode">
							<button
								type="button"
								aria-label="List view"
								aria-pressed={viewMode === "list"}
								className={cn(viewMode === "list" && "is-on")}
								onClick={() => setViewMode("list")}
							>
								<List size={14} />
							</button>
							<button
								type="button"
								aria-label="Grid view"
								aria-pressed={viewMode === "grid"}
								className={cn(viewMode === "grid" && "is-on")}
								onClick={() => setViewMode("grid")}
							>
								<LayoutGrid size={14} />
							</button>
						</div>
					</div>
				</div>

				{researchProjects.length === 0 ? (
					<div className="stu-proj-empty">
						<span className="stu-proj-empty-icon" aria-hidden>
							<FolderKanban size={22} />
						</span>
						<h3>
							{hasAssignments ? "No research projects yet" : "No projects yet"}
						</h3>
						<p>
							{hasAssignments ? (
								<>
									Your coursework is listed under{" "}
									<Link href="/student/assignments">Assignments</Link>. Use Projects for
									dissertations, theses, and other research work.
								</>
							) : (
								<>
									Create your first research project, choose a supervisor, then start writing
									chapters.
								</>
							)}
						</p>
						<div className="stu-proj-empty-actions">
							{hasAssignments ? (
								<Link href="/student/assignments" className="stu-proj-btn stu-proj-btn-ghost">
									View assignments
								</Link>
							) : null}
							<Link href="/student/projects/new" className="stu-proj-btn stu-proj-btn-primary">
								<Plus size={15} />
								New project
							</Link>
						</div>
					</div>
				) : filtered.length === 0 ? (
					<div className="stu-proj-empty stu-proj-empty-compact">
						<span className="stu-proj-empty-icon" aria-hidden>
							<Search size={20} />
						</span>
						<h3>No matching projects</h3>
						<p>Try another search term or clear the filters.</p>
						<button
							type="button"
							className="stu-proj-btn stu-proj-btn-ghost"
							onClick={() => {
								setQuery("");
								setTypeFilter("all");
								setStatusFilter("all");
							}}
						>
							Clear filters
						</button>
					</div>
				) : viewMode === "list" ? (
					<div className="stu-proj-list">
						<div className="stu-proj-list-cols" aria-hidden>
							<span>Project</span>
							<span>Type</span>
							<span>Supervisor</span>
							<span>Progress</span>
							<span />
						</div>
						<ul>
							{filtered.map((project) => {
								const Icon = (TYPE_META[project.projectType] || { icon: FileText }).icon;
								const badge = statusMeta(project);
								const pct = Math.min(100, Math.max(0, project.progressPercent ?? 0));
								const needsRevision = project.status === "needs_revision";

								return (
									<li
										key={project._id}
										className={cn("stu-proj-row", needsRevision && "is-alert")}
									>
										<div className="stu-proj-row-main">
											<span className="stu-proj-row-icon" aria-hidden>
												<Icon size={16} strokeWidth={1.75} />
											</span>
											<div className="stu-proj-row-copy">
												<Link href={`/student/projects/${project._id}`}>
													{project.title}
												</Link>
												<p>
													{project.topic || "No topic set yet"}
													{" · "}
													Started {formatStartDate(project.createdAt)}
												</p>
												<span className={cn("stu-proj-badge", `tone-${badge.tone}`)}>
													{badge.label}
												</span>
											</div>
										</div>
										<div className="stu-proj-row-type">
											<span className="stu-proj-mobile-label">Type</span>
											{projectTypeLabel(project.projectType)}
										</div>
										<div className="stu-proj-row-supervisor">
											<span className="stu-proj-mobile-label">Supervisor</span>
											<span>
												<UserRound size={13} aria-hidden />
												{project.supervisor?.name ||
													`No ${projectAdvisorNoun(project.projectType)}`}
											</span>
										</div>
										<div className="stu-proj-row-progress">
											<span className="stu-proj-mobile-label">Progress</span>
											<div className="stu-proj-progress-line">
												<div className="stu-proj-progress">
													<span style={{ width: `${pct}%` }} />
												</div>
												<strong>{pct}%</strong>
											</div>
											<p>{chapterStats[project._id] ? chapterCopy(project) : "Loading chapters..."}</p>
										</div>
										<div className="stu-proj-row-actions">
											<Link
												href={`/student/projects/${project._id}`}
												className="stu-proj-btn stu-proj-btn-ghost stu-proj-btn-sm"
											>
												Open
											</Link>
											<div className="stu-proj-menu">
												<button
													type="button"
													className="stu-proj-icon-btn"
													aria-label={`Options for ${project.title}`}
													onClick={(e) => {
														e.stopPropagation();
														setMenuOpenId((id) =>
															id === project._id ? null : project._id,
														);
													}}
												>
													<MoreVertical size={15} />
												</button>
												{menuOpenId === project._id ? (
													<div className="stu-proj-menu-panel">
														<Link
															href={`/student/projects/${project._id}`}
															onClick={() => setMenuOpenId(null)}
														>
															<FolderOpen size={14} />
															Open editor
														</Link>
														<button
															type="button"
															className="is-danger"
															onClick={() => {
																setMenuOpenId(null);
																setPendingDelete(project);
															}}
														>
															<Trash2 size={14} />
															Delete
														</button>
													</div>
												) : null}
											</div>
										</div>
									</li>
								);
							})}
						</ul>
					</div>
				) : (
					<div className="stu-proj-grid">
						{filtered.map((project) => {
							const Icon = (TYPE_META[project.projectType] || { icon: FileText }).icon;
							const badge = statusMeta(project);
							const pct = Math.min(100, Math.max(0, project.progressPercent ?? 0));
							const needsRevision = project.status === "needs_revision";

							return (
								<article
									key={project._id}
									className={cn("stu-proj-card", needsRevision && "is-alert")}
								>
									<div className="stu-proj-card-top">
										<span className="stu-proj-row-icon" aria-hidden>
											<Icon size={16} strokeWidth={1.75} />
										</span>
										<span className={cn("stu-proj-badge", `tone-${badge.tone}`)}>
											{badge.label}
										</span>
									</div>
									<Link href={`/student/projects/${project._id}`} className="stu-proj-card-title">
										{project.title}
									</Link>
									<p className="stu-proj-card-topic">
										{project.topic || "No topic set yet"}
									</p>
									<p className="stu-proj-card-meta">
										<UserRound size={13} aria-hidden />
										{project.supervisor?.name ||
											`No ${projectAdvisorNoun(project.projectType)}`}
									</p>
									<div className="stu-proj-card-progress">
										<div className="stu-proj-progress-line">
											<div className="stu-proj-progress">
												<span style={{ width: `${pct}%` }} />
											</div>
											<strong>{pct}%</strong>
										</div>
										<p>{chapterCopy(project)}</p>
									</div>
									<div className="stu-proj-card-actions">
										<Link
											href={`/student/projects/${project._id}`}
											className="stu-proj-btn stu-proj-btn-primary stu-proj-btn-sm"
										>
											Open
										</Link>
										<button
											type="button"
											className="stu-proj-icon-btn is-danger"
											aria-label={`Delete ${project.title}`}
											onClick={() => setPendingDelete(project)}
										>
											<Trash2 size={14} />
										</button>
									</div>
								</article>
							);
						})}
					</div>
				)}
			</section>

			<ConfirmModal
				open={Boolean(pendingDelete)}
				title="Delete project?"
				description={
					pendingDelete
						? `"${pendingDelete.title}" and all its chapters will be removed. This cannot be undone.`
						: ""
				}
				confirmLabel="Delete project"
				loading={deleting}
				onCancel={() => {
					if (!deleting) setPendingDelete(null);
				}}
				onConfirm={() => void confirmDelete()}
			/>
		</div>
	);
}
