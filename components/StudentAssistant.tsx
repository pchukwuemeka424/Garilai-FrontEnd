"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
	ArrowRight,
	CalendarClock,
	ChevronRight,
	ClipboardList,
	FolderKanban,
	MessageSquareText,
	Plus,
	RefreshCw,
	type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/portal-api";
import { projectTypeLabel } from "@/lib/portal/project-types";

type WorkspaceProject = {
	_id: string;
	title: string;
	projectType: string;
	topic?: string;
	progressPercent?: number;
	status?: string;
	updatedAt?: string;
	supervisor?: { id: string; name: string; email: string } | null;
	score?: number | null;
	assignmentBrief?: { dueAt?: string | null; courseName?: string | null } | null;
	pages?: Array<{
		_id?: string;
		title?: string;
		reviewStatus?: string;
		content?: string;
	}>;
};

function formatToday(): string {
	return new Intl.DateTimeFormat(undefined, {
		weekday: "long",
		month: "long",
		day: "numeric",
	}).format(new Date());
}

function formatShortDate(iso?: string | null): string {
	if (!iso) return "";
	try {
		return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
			new Date(iso),
		);
	} catch {
		return "";
	}
}

function formatRelative(iso?: string | null): string {
	if (!iso) return "";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	const diffMs = Date.now() - date.getTime();
	const days = Math.floor(diffMs / 86_400_000);
	if (days <= 0) return "Today";
	if (days === 1) return "Yesterday";
	if (days < 7) return `${days} days ago`;
	return formatShortDate(iso);
}

function getGreeting(): string {
	const hour = new Date().getHours();
	if (hour < 12) return "Good morning";
	if (hour < 17) return "Good afternoon";
	return "Good evening";
}

function isAssignment(project: WorkspaceProject) {
	return project.projectType === "assignment";
}

function projectHref(project: WorkspaceProject) {
	return isAssignment(project)
		? `/student/assignments/${project._id}`
		: `/student/projects/${project._id}`;
}

function dueSoon(dueAt?: string | null) {
	if (!dueAt) return false;
	const t = new Date(dueAt).getTime();
	if (Number.isNaN(t)) return false;
	const now = Date.now();
	return t >= now && t - now <= 7 * 24 * 60 * 60 * 1000;
}

function assignmentTone(row: WorkspaceProject): { label: string; tone: string } {
	if (typeof row.score === "number") return { label: "Graded", tone: "graded" };
	const page = row.pages?.[0];
	if (page?.reviewStatus === "approved") return { label: "Approved", tone: "done" };
	if (page?.reviewStatus === "needs_revision") return { label: "Needs revision", tone: "alert" };
	if (page?.reviewStatus && page.reviewStatus !== "none") return { label: "Submitted", tone: "info" };
	if (String(page?.content || "").trim()) return { label: "In progress", tone: "progress" };
	return { label: "Not started", tone: "idle" };
}

function MetricLink({
	label,
	value,
	hint,
	href,
	loading,
}: {
	label: string;
	value: number | string;
	hint: string;
	href: string;
	loading?: boolean;
}) {
	return (
		<Link href={href} className="stu-assist-metric">
			<p className="stu-assist-metric-label">{label}</p>
			{loading ? (
				<span className="stu-assist-metric-value stu-assist-metric-loading">-</span>
			) : (
				<span className="stu-assist-metric-value">{value}</span>
			)}
			<p className="stu-assist-metric-hint">{loading ? "\u00a0" : hint}</p>
		</Link>
	);
}

function ToolModule({
	title,
	description,
	href,
	icon: Icon,
	cta,
	count,
	features,
	steps,
	wide,
	children,
}: {
	title: string;
	description: string;
	href: string;
	icon: LucideIcon;
	cta: string;
	count?: number | string;
	features: string[];
	steps: Array<{ label: string; hint: string }>;
	wide?: boolean;
	children: ReactNode;
}) {
	return (
		<article className={`stu-assist-module${wide ? " stu-assist-module-wide" : ""}`}>
			<div className="stu-assist-module-head">
				<span className="stu-assist-module-icon" aria-hidden>
					<Icon size={16} strokeWidth={1.75} />
				</span>
				<div className="stu-assist-module-title">
					<div className="stu-assist-module-title-row">
						<h3>{title}</h3>
						{count != null ? <span className="stu-assist-module-count">{count}</span> : null}
					</div>
					<p>{description}</p>
				</div>
			</div>

			<ul className="stu-assist-features" aria-label={`${title} features`}>
				{features.map((feature) => (
					<li key={feature}>{feature}</li>
				))}
			</ul>

			<ol className="stu-assist-steps" aria-label={`How to use ${title}`}>
				{steps.map((step, index) => (
					<li key={step.label}>
						<em aria-hidden>{index + 1}</em>
						<div>
							<strong>{step.label}</strong>
							<span>{step.hint}</span>
						</div>
					</li>
				))}
			</ol>

			<div className="stu-assist-module-body">
				<p className="stu-assist-body-label">Recent</p>
				{children}
			</div>
			<Link href={href} className="stu-assist-module-cta">
				{cta}
				<ArrowRight size={14} />
			</Link>
		</article>
	);
}

export function StudentAssistant() {
	const { user } = useAuth();
	const [projects, setProjects] = useState<WorkspaceProject[]>([]);
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(async () => {
		setLoading(true);
		try {
			const projectList = (await apiFetch("/api/v1/projects").catch(
				() => [],
			)) as WorkspaceProject[];
			setProjects(Array.isArray(projectList) ? projectList : []);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const researchProjects = useMemo(
		() => projects.filter((p) => !isAssignment(p) && p.status !== "archived"),
		[projects],
	);
	const assignments = useMemo(() => projects.filter(isAssignment), [projects]);

	const activeProjects = useMemo(
		() =>
			[...researchProjects]
				.sort(
					(a, b) =>
						new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
				)
				.slice(0, 4),
		[researchProjects],
	);

	const upcomingAssignments = useMemo(
		() =>
			[...assignments]
				.sort((a, b) => {
					const da = a.assignmentBrief?.dueAt
						? new Date(a.assignmentBrief.dueAt).getTime()
						: Infinity;
					const db = b.assignmentBrief?.dueAt
						? new Date(b.assignmentBrief.dueAt).getTime()
						: Infinity;
					return da - db;
				})
				.slice(0, 4),
		[assignments],
	);

	const revisionItems = useMemo(() => {
		return projects.flatMap((project) =>
			(project.pages || [])
				.filter((page) => page.reviewStatus === "needs_revision")
				.map((page) => ({
					key: `${project._id}-${page._id || page.title || "page"}`,
					title: page.title || project.title,
					projectTitle: project.title,
					href: isAssignment(project)
						? `/student/assignments/${project._id}`
						: page._id
							? `/student/projects/${project._id}/pages/${page._id}`
							: `/student/feedback`,
				})),
		);
	}, [projects]);

	const dueSoonCount = assignments.filter((a) => dueSoon(a.assignmentBrief?.dueAt)).length;
	const avgProgress =
		researchProjects.length === 0
			? 0
			: Math.round(
					researchProjects.reduce((sum, p) => sum + (p.progressPercent ?? 0), 0) /
						researchProjects.length,
				);

	const continueProject = activeProjects[0] ?? upcomingAssignments[0] ?? null;
	const firstName = user?.name.split(" ")[0] ?? "there";
	const hasAttention = revisionItems.length > 0 || dueSoonCount > 0;

	if (!user) return null;

	return (
		<div className="stu-assist">
			<header className="stu-assist-intro">
				<div className="stu-assist-intro-copy">
					<p className="stu-assist-eyebrow">{formatToday()}</p>
					<h1>
						{getGreeting()}, {firstName}
					</h1>
					<p>Writing desk for theses, coursework, and supervisor feedback.</p>
				</div>
				<div className="stu-assist-intro-actions">
					<button
						type="button"
						className="stu-assist-btn stu-assist-btn-ghost"
						onClick={() => void refresh()}
						disabled={loading}
						aria-label={loading ? "Syncing workspace" : "Refresh workspace"}
					>
						<RefreshCw size={15} className={loading ? "stu-assist-spin" : undefined} />
						<span className="stu-assist-btn-label">{loading ? "Syncing" : "Refresh"}</span>
					</button>
				</div>
			</header>

			<section className="stu-assist-metrics" aria-label="Workspace overview">
				<MetricLink
					label="Projects"
					value={researchProjects.length}
					hint={researchProjects.length ? `${avgProgress}% avg progress` : "Start a thesis or paper"}
					href="/student/projects"
					loading={loading}
				/>
				<MetricLink
					label="Assignments"
					value={assignments.length}
					hint={dueSoonCount ? `${dueSoonCount} due this week` : "No deadlines this week"}
					href="/student/assignments"
					loading={loading}
				/>
				<MetricLink
					label="Revisions"
					value={revisionItems.length}
					hint={revisionItems.length ? "Supervisor comments waiting" : "Nothing to revise"}
					href="/student/feedback"
					loading={loading}
				/>
			</section>

			{continueProject ? (
				<Link href={projectHref(continueProject)} className="stu-assist-continue">
					<div className="stu-assist-continue-copy">
						<p>Continue writing</p>
						<strong>{continueProject.title}</strong>
						<span>
							{isAssignment(continueProject)
								? continueProject.assignmentBrief?.courseName || "Assignment"
								: projectTypeLabel(continueProject.projectType)}
							{continueProject.updatedAt ? ` · Updated ${formatRelative(continueProject.updatedAt)}` : ""}
						</span>
					</div>
					<div className="stu-assist-continue-progress">
						<span>{Math.min(100, Math.max(0, continueProject.progressPercent ?? 0))}%</span>
						<div className="stu-assist-progress" role="presentation">
							<div
								className="stu-assist-progress-fill"
								style={{
									width: `${Math.min(100, Math.max(0, continueProject.progressPercent ?? 0))}%`,
								}}
							/>
						</div>
					</div>
					<span className="stu-assist-continue-open">
						Open
						<ArrowRight size={14} aria-hidden />
					</span>
				</Link>
			) : null}

			<div className="stu-assist-layout">
				<div className="stu-assist-grid">
					<ToolModule
						title="Projects"
						description="Theses, dissertations, and research folders."
						href="/student/projects"
						icon={FolderKanban}
						cta="Open projects"
						count={loading ? "-" : researchProjects.length}
						features={[
							"Chapter writing desk",
							"Supervisor review trail",
							"Import / export drafts",
						]}
						steps={[
							{ label: "Create", hint: "Start a thesis, dissertation, or paper folder" },
							{ label: "Write", hint: "Draft chapters and attach notebook evidence" },
							{ label: "Submit", hint: "Send pages for supervisor review" },
						]}
					>
						{loading ? (
							<div className="stu-assist-skeleton" aria-hidden />
						) : activeProjects.length === 0 ? (
							<p className="stu-assist-quiet">No writing projects yet.</p>
						) : (
							<ul className="stu-assist-preview">
								{activeProjects.slice(0, 3).map((project) => (
									<li key={project._id}>
										<Link href={projectHref(project)}>
											<strong>{project.title}</strong>
											<span>
												{projectTypeLabel(project.projectType)} · {project.progressPercent ?? 0}%
											</span>
										</Link>
									</li>
								))}
							</ul>
						)}
					</ToolModule>

					<ToolModule
						title="Assignments"
						description="Coursework briefs and upcoming due dates."
						href="/student/assignments"
						icon={ClipboardList}
						cta="Open assignments"
						count={loading ? "-" : assignments.length}
						features={[
							"Published lecturer briefs",
							"Due-date tracking",
							"One-page submission",
						]}
						steps={[
							{ label: "Pick brief", hint: "Choose a published coursework brief" },
							{ label: "Draft", hint: "Write or import your submission" },
							{ label: "Hand in", hint: "Submit before the due date" },
						]}
					>
						{loading ? (
							<div className="stu-assist-skeleton" aria-hidden />
						) : upcomingAssignments.length === 0 ? (
							<p className="stu-assist-quiet">No assignments from lecturers yet.</p>
						) : (
							<ul className="stu-assist-preview">
								{upcomingAssignments.slice(0, 3).map((row) => {
									const status = assignmentTone(row);
									return (
										<li key={row._id}>
											<Link href={projectHref(row)}>
												<strong>{row.title}</strong>
												<span>
													{row.assignmentBrief?.dueAt
														? `Due ${formatShortDate(row.assignmentBrief.dueAt)}`
														: "No due date"}
													{" · "}
													{status.label}
												</span>
											</Link>
										</li>
									);
								})}
							</ul>
						)}
					</ToolModule>

					<ToolModule
						title="Feedback"
						description="Supervisor comments on your drafts."
						href="/student/feedback"
						icon={MessageSquareText}
						cta="Review feedback"
						count={loading ? "-" : revisionItems.length}
						wide
						features={[
							"Inline remarks",
							"Revision requests",
							"Scores and decisions",
						]}
						steps={[
							{ label: "Read", hint: "Open remarks on marked chapters or briefs" },
							{ label: "Revise", hint: "Update the draft where feedback points" },
							{ label: "Resubmit", hint: "Send the revised page for another look" },
						]}
					>
						{loading ? (
							<div className="stu-assist-skeleton" aria-hidden />
						) : revisionItems.length === 0 ? (
							<p className="stu-assist-quiet">No revision requests right now.</p>
						) : (
							<ul className="stu-assist-preview">
								{revisionItems.slice(0, 3).map((item) => (
									<li key={item.key}>
										<Link href={item.href}>
											<strong>{item.title}</strong>
											<span>{item.projectTitle}</span>
										</Link>
									</li>
								))}
							</ul>
						)}
					</ToolModule>
				</div>

				<aside className="stu-assist-aside">
					<section className="stu-assist-panel">
						<div className="stu-assist-panel-head">
							<h2>Needs attention</h2>
							<p>Items that should move first.</p>
						</div>
						{loading ? (
							<div className="stu-assist-skeleton" aria-hidden />
						) : !hasAttention ? (
							<p className="stu-assist-quiet">You're clear - nothing urgent.</p>
						) : (
							<ul className="stu-assist-queue">
								{revisionItems.length > 0 ? (
									<li>
										<Link href="/student/feedback">
											<span className="stu-assist-queue-icon stu-assist-queue-rose" aria-hidden>
												<MessageSquareText size={14} />
											</span>
											<div>
												<strong>
													{revisionItems.length}{" "}
													{revisionItems.length === 1 ? "needs revision" : "need revision"}
												</strong>
												<span>Open supervisor feedback</span>
											</div>
										</Link>
									</li>
								) : null}
								{dueSoonCount > 0 ? (
									<li>
										<Link href="/student/assignments">
											<span className="stu-assist-queue-icon stu-assist-queue-amber" aria-hidden>
												<CalendarClock size={14} />
											</span>
											<div>
												<strong>{dueSoonCount} due this week</strong>
												<span>Check assignment deadlines</span>
											</div>
										</Link>
									</li>
								) : null}
							</ul>
						)}
					</section>

					<section className="stu-assist-panel">
						<div className="stu-assist-panel-head">
							<h2>Quick start</h2>
							<p>Jump into the next writing task.</p>
						</div>
						<ul className="stu-assist-shortcuts">
							<li>
								<Link href="/student/projects/new" className="stu-assist-shortcut">
									<span className="stu-assist-shortcut-icon" aria-hidden>
										<Plus size={14} />
									</span>
									<span>
										New project
										<em>Thesis, dissertation, or paper</em>
									</span>
									<ChevronRight size={14} />
								</Link>
							</li>
							<li>
								<Link href="/student/assignments" className="stu-assist-shortcut">
									<span className="stu-assist-shortcut-icon" aria-hidden>
										<ClipboardList size={14} />
									</span>
									<span>
										Submit coursework
										<em>Open lecturer briefs</em>
									</span>
									<ChevronRight size={14} />
								</Link>
							</li>
							<li>
								<Link href="/student/feedback" className="stu-assist-shortcut">
									<span className="stu-assist-shortcut-icon" aria-hidden>
										<MessageSquareText size={14} />
									</span>
									<span>
										Respond to feedback
										<em>Revise marked drafts</em>
									</span>
									<ChevronRight size={14} />
								</Link>
							</li>
						</ul>
					</section>
				</aside>
			</div>
		</div>
	);
}
