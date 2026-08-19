"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
	Bell,
	BookOpen,
	CalendarClock,
	ChevronRight,
	ClipboardList,
	FolderKanban,
	Lightbulb,
	MessageSquareText,
	Plus,
	RefreshCw,
	Sparkles,
	type LucideIcon,
} from "lucide-react";

import { NavIcon } from "@/components/aula/NavIcon";
import {
	IconBookmark,
	IconCheck,
	IconClock,
	IconMoveRight,
} from "@/components/ui/ButtonIcon";
import {
	notificationHref,
	parseNotificationsPayload,
	type NotificationItem,
} from "@/components/portal/features/notifications/student-notifications";
import { useAuth } from "@/hooks/useAuth";
import { userInitials } from "@/lib/aula-utils";
import { apiFetch } from "@/lib/portal-api";
import { projectTypeLabel } from "@/lib/portal/project-types";
import { getDisciplineLabel } from "@/lib/research-disciplines";
import { getFeasibilityLabel, getTypeLabel } from "@/lib/research-ideas";
import {
	loadAllSavedIdeas,
	removeSavedIdea,
	type ResearchBoardStatus,
	type SavedIdea,
	updateSavedIdeaStatus,
} from "@/lib/research-storage";
import { STUDENT_BOARD_COLUMNS, STUDENT_NAV_ITEMS } from "@/lib/student-nav";
import { researchTokenAllowance } from "@/lib/student-tokens";

const COLUMN_ACCENTS: Record<ResearchBoardStatus, string> = {
	saved: "saved",
	in_progress: "progress",
	completed: "completed",
};

const STATUS_LABELS: Record<ResearchBoardStatus, string> = {
	saved: "Saved",
	in_progress: "In progress",
	completed: "Completed",
};

const PIPELINE_ICONS: Record<ResearchBoardStatus, ReactNode> = {
	saved: <IconBookmark size={16} />,
	in_progress: <IconClock size={16} />,
	completed: <IconCheck size={16} />,
};

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

function TokenRing({ percentUsed, remaining }: { percentUsed: number; remaining: number }) {
	const radius = 36;
	const circumference = 2 * Math.PI * radius;
	const clamped = Math.min(100, Math.max(0, percentUsed));
	return (
		<div className="stu-home-ring" aria-hidden>
			<svg width="96" height="96" viewBox="0 0 100 100">
				<circle cx="50" cy="50" r={radius} fill="none" stroke="#e8edf2" strokeWidth="8" />
				<circle
					cx="50"
					cy="50"
					r={radius}
					fill="none"
					stroke="#0d9488"
					strokeWidth="8"
					strokeLinecap="round"
					strokeDasharray={circumference}
					strokeDashoffset={circumference * (1 - clamped / 100)}
					transform="rotate(-90 50 50)"
				/>
			</svg>
			<div className="stu-home-ring-label">
				<strong>{remaining.toLocaleString()}</strong>
				<span>tokens left</span>
			</div>
		</div>
	);
}

function BoardCard({
	idea,
	columnId,
	onMove,
	onRemove,
}: {
	idea: SavedIdea;
	columnId: ResearchBoardStatus;
	onMove: (status: ResearchBoardStatus) => void;
	onRemove: () => void;
}) {
	const nextColumns = STUDENT_BOARD_COLUMNS.filter((col) => col.id !== columnId);

	return (
		<article className="stu-home-idea">
			<div className="stu-home-idea-tags">
				<span className="stu-home-chip">{getTypeLabel(idea.type)}</span>
				<span className="stu-home-chip stu-home-chip-muted">{getFeasibilityLabel(idea.feasibility)}</span>
			</div>
			<h3>{idea.title}</h3>
			<p className="stu-home-idea-meta">
				{getDisciplineLabel(idea.discipline)} · {idea.topic}
			</p>
			<p className="stu-home-idea-body">{idea.rationale}</p>
			<div className="stu-home-idea-foot">
				<div className="stu-home-idea-moves">
					{nextColumns.map((col) => (
						<button key={col.id} type="button" className="stu-home-move" onClick={() => onMove(col.id)}>
							<IconMoveRight size={12} />
							{col.label}
						</button>
					))}
				</div>
				<button type="button" className="stu-home-remove" onClick={onRemove} aria-label="Remove idea">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
						<path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
					</svg>
				</button>
			</div>
		</article>
	);
}

function MetricCard({
	label,
	value,
	hint,
	icon: Icon,
	tone,
	href,
	loading,
}: {
	label: string;
	value: number | string;
	hint: string;
	icon: LucideIcon;
	tone: "navy" | "teal" | "amber" | "rose" | "violet";
	href: string;
	loading?: boolean;
}) {
	return (
		<Link href={href} className={`stu-home-metric stu-home-metric-${tone}`}>
			<span className="stu-home-metric-icon" aria-hidden>
				<Icon size={18} strokeWidth={1.75} />
			</span>
			<div className="stu-home-metric-copy">
				<p className="stu-home-metric-label">{label}</p>
				{loading ? (
					<div className="stu-skeleton stu-skeleton-kpi-value" />
				) : (
					<p className="stu-home-metric-value">{value}</p>
				)}
				<p className="stu-home-metric-hint">{loading ? " " : hint}</p>
			</div>
			<ChevronRight size={16} className="stu-home-metric-chevron" aria-hidden />
		</Link>
	);
}

export function StudentDashboard() {
	const { user } = useAuth();
	const [ideas, setIdeas] = useState<SavedIdea[]>([]);
	const [projects, setProjects] = useState<WorkspaceProject[]>([]);
	const [notifications, setNotifications] = useState<NotificationItem[]>([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(async () => {
		setLoading(true);
		try {
			const [nextIdeas, projectList, notificationPayload] = await Promise.all([
				loadAllSavedIdeas(),
				apiFetch("/api/v1/projects").catch(() => []) as Promise<WorkspaceProject[]>,
				apiFetch("/api/v1/notifications").catch(() => []) as Promise<unknown>,
			]);
			setIdeas(nextIdeas);
			setProjects(Array.isArray(projectList) ? projectList : []);
			const parsed = parseNotificationsPayload(notificationPayload);
			setNotifications(parsed.items.slice(0, 4));
			setUnreadCount(parsed.unreadCount);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const ideasByStatus = useMemo(() => {
		const grouped: Record<ResearchBoardStatus, SavedIdea[]> = {
			saved: [],
			in_progress: [],
			completed: [],
		};
		for (const idea of ideas) {
			grouped[idea.status ?? "saved"].push(idea);
		}
		return grouped;
	}, [ideas]);

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
					const da = a.assignmentBrief?.dueAt ? new Date(a.assignmentBrief.dueAt).getTime() : Infinity;
					const db = b.assignmentBrief?.dueAt ? new Date(b.assignmentBrief.dueAt).getTime() : Infinity;
					return da - db;
				})
				.slice(0, 4),
		[assignments],
	);

	const revisionCount = useMemo(
		() =>
			projects.filter((p) =>
				(p.pages || []).some((page) => page.reviewStatus === "needs_revision"),
			).length,
		[projects],
	);
	const dueSoonCount = assignments.filter((a) => dueSoon(a.assignmentBrief?.dueAt)).length;
	const avgProgress =
		researchProjects.length === 0
			? 0
			: Math.round(
					researchProjects.reduce((sum, p) => sum + (p.progressPercent ?? 0), 0) /
						researchProjects.length,
				);
	const continueProject = activeProjects[0] ?? upcomingAssignments[0] ?? null;

	const recentIdeas = useMemo(
		() =>
			[...ideas]
				.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
				.slice(0, 4),
		[ideas],
	);

	const completionPercent =
		ideas.length > 0 ? Math.round((ideasByStatus.completed.length / ideas.length) * 100) : 0;

	const allowance = user?.tokenQuota?.allowance ?? researchTokenAllowance(user?.role) ?? 0;
	const tokensRemaining = user?.tokenQuota?.remaining ?? allowance;
	const tokenPercentUsed =
		allowance > 0 ? Math.min(100, Math.round(((allowance - tokensRemaining) / allowance) * 100)) : 0;

	const handleMove = async (idea: SavedIdea, status: ResearchBoardStatus) => {
		if (!idea.dbId) {
			setIdeas((current) =>
				current.map((item) =>
					item.id === idea.id && item.title === idea.title ? { ...item, status } : item,
				),
			);
			return;
		}
		const next = await updateSavedIdeaStatus(idea.dbId, status);
		setIdeas(next);
	};

	const handleRemove = async (idea: SavedIdea) => {
		const next = await removeSavedIdea(idea.id, idea.title, idea.dbId);
		setIdeas(next);
	};

	if (!user) return null;

	const firstName = user.name.split(" ")[0] ?? user.name;
	const initials = userInitials(user.name);
	const tools = STUDENT_NAV_ITEMS.filter((item) => item.id !== "dashboard");
	const programmeLine = [user.programme, user.department, user.institution]
		.filter(Boolean)
		.join(" · ");

	return (
		<div className="stu-home">
			<section className="stu-home-hero">
				<div className="stu-home-hero-copy">
					<p className="stu-home-hero-date">{formatToday()}</p>
					<h1>
						{getGreeting()}, {firstName}
					</h1>
					<p className="stu-home-hero-lead">
						{programmeLine || "Your writing, supervision, and research in one workspace."}
					</p>
					{user.cohort ? <p className="stu-home-hero-meta">{user.cohort}</p> : null}
				</div>
				<div className="stu-home-hero-actions">
					<button
						type="button"
						className="stu-home-btn stu-home-btn-ghost"
						onClick={() => void refresh()}
						disabled={loading}
					>
						<RefreshCw size={16} className={loading ? "stu-home-spin" : undefined} />
						{loading ? "Syncing…" : "Refresh"}
					</button>
					{continueProject ? (
						<Link href={projectHref(continueProject)} className="stu-home-btn stu-home-btn-light">
							<BookOpen size={16} />
							Continue writing
						</Link>
					) : (
						<Link href="/student/projects/new" className="stu-home-btn stu-home-btn-light">
							<Plus size={16} />
							New project
						</Link>
					)}
					<Link href="/student/research" className="stu-home-btn stu-home-btn-solid">
						<Sparkles size={16} />
						Generate ideas
					</Link>
				</div>
			</section>

			<section className="stu-home-metrics" aria-label="Workspace overview">
				<MetricCard
					label="Projects"
					value={researchProjects.length}
					hint={
						researchProjects.length
							? `${avgProgress}% average progress`
							: "Start a thesis or paper"
					}
					icon={FolderKanban}
					tone="navy"
					href="/student/projects"
					loading={loading}
				/>
				<MetricCard
					label="Assignments"
					value={assignments.length}
					hint={dueSoonCount ? `${dueSoonCount} due this week` : "No deadlines this week"}
					icon={ClipboardList}
					tone="amber"
					href="/student/assignments"
					loading={loading}
				/>
				<MetricCard
					label="Feedback"
					value={revisionCount}
					hint={revisionCount ? "Needs your attention" : "No revisions waiting"}
					icon={MessageSquareText}
					tone="rose"
					href="/student/feedback"
					loading={loading}
				/>
				<MetricCard
					label="Research ideas"
					value={ideas.length}
					hint={ideas.length ? `${completionPercent}% marked complete` : "Save ideas from Research"}
					icon={Lightbulb}
					tone="violet"
					href="/student/research/saved"
					loading={loading}
				/>
				<MetricCard
					label="Updates"
					value={unreadCount}
					hint={unreadCount ? "Unread notifications" : "You're up to date"}
					icon={Bell}
					tone="teal"
					href="/student/notifications"
					loading={loading}
				/>
			</section>

			<div className="stu-home-layout">
				<div className="stu-home-main">
					<section className="stu-home-panel">
						<div className="stu-home-panel-head">
							<div>
								<h2>Active writing</h2>
								<p>Pick up where you left off on dissertations, theses, and papers.</p>
							</div>
							<Link href="/student/projects" className="stu-home-link">
								View all
							</Link>
						</div>
						{loading ? (
							<div className="stu-home-stack">
								<div className="stu-skeleton stu-skeleton-card" />
								<div className="stu-skeleton stu-skeleton-card" />
							</div>
						) : activeProjects.length === 0 ? (
							<div className="stu-home-empty">
								<FolderKanban size={28} />
								<h3>No writing projects yet</h3>
								<p>Create a thesis, dissertation, or research paper to track chapters and supervisor review.</p>
								<Link href="/student/projects/new" className="stu-home-btn stu-home-btn-primary">
									<Plus size={16} />
									Create project
								</Link>
							</div>
						) : (
							<ul className="stu-home-project-list">
								{activeProjects.map((project) => {
									const pct = Math.min(100, Math.max(0, project.progressPercent ?? 0));
									return (
										<li key={project._id}>
											<Link href={projectHref(project)} className="stu-home-project">
												<div className="stu-home-project-top">
													<div>
														<p className="stu-home-project-type">
															{projectTypeLabel(project.projectType)}
														</p>
														<h3>{project.title}</h3>
														<p className="stu-home-project-meta">
															{project.supervisor?.name
																? `Supervisor · ${project.supervisor.name}`
																: "No supervisor assigned"}
															{project.updatedAt ? ` · Updated ${formatRelative(project.updatedAt)}` : ""}
														</p>
													</div>
													<span className="stu-home-project-pct">{pct}%</span>
												</div>
												<div
													className="stu-home-progress"
													role="progressbar"
													aria-valuenow={pct}
													aria-valuemin={0}
													aria-valuemax={100}
												>
													<div className="stu-home-progress-fill" style={{ width: `${pct}%` }} />
												</div>
											</Link>
										</li>
									);
								})}
							</ul>
						)}
					</section>

					<div className="stu-home-split">
						<section className="stu-home-panel">
							<div className="stu-home-panel-head">
								<div>
									<h2>Assignments</h2>
									<p>Coursework briefs and upcoming due dates.</p>
								</div>
								<Link href="/student/assignments" className="stu-home-link">
									Open
								</Link>
							</div>
							{loading ? (
								<div className="stu-skeleton stu-skeleton-card" />
							) : upcomingAssignments.length === 0 ? (
								<p className="stu-home-quiet">No assignments from lecturers yet.</p>
							) : (
								<ul className="stu-home-rows">
									{upcomingAssignments.map((row) => {
										const status = assignmentTone(row);
										return (
											<li key={row._id}>
												<Link href={projectHref(row)} className="stu-home-row">
													<span className="stu-home-row-icon" aria-hidden>
														<ClipboardList size={16} />
													</span>
													<span className="stu-home-row-body">
														<strong>{row.title}</strong>
														<span>
															{row.assignmentBrief?.courseName || "Coursework"}
															{row.assignmentBrief?.dueAt
																? ` · Due ${formatShortDate(row.assignmentBrief.dueAt)}`
																: ""}
														</span>
													</span>
													<span className={`stu-home-status stu-home-status-${status.tone}`}>
														{status.label}
													</span>
												</Link>
											</li>
										);
									})}
								</ul>
							)}
						</section>

						<section className="stu-home-panel">
							<div className="stu-home-panel-head">
								<div>
									<h2>Inbox</h2>
									<p>Supervisor updates and workspace alerts.</p>
								</div>
								<Link href="/student/notifications" className="stu-home-link">
									All updates
								</Link>
							</div>
							{loading ? (
								<div className="stu-skeleton stu-skeleton-card" />
							) : notifications.length === 0 ? (
								<p className="stu-home-quiet">No notifications yet. Feedback and scores will appear here.</p>
							) : (
								<ul className="stu-home-rows">
									{notifications.map((item) => (
										<li key={item._id}>
											<Link href={notificationHref(item) || "/student/notifications"} className="stu-home-row">
												<span className="stu-home-row-icon" aria-hidden>
													<Bell size={16} />
												</span>
												<span className="stu-home-row-body">
													<strong>{item.title}</strong>
													<span>{item.createdAt ? formatRelative(item.createdAt) : "Workspace update"}</span>
												</span>
												{!item.readAt ? <span className="stu-home-dot" aria-label="Unread" /> : null}
											</Link>
										</li>
									))}
								</ul>
							)}
						</section>
					</div>

					<section className="stu-home-panel">
						<div className="stu-home-panel-head">
							<div>
								<h2>Research board</h2>
								<p>Move saved ideas from bookmark to finished topic.</p>
							</div>
							<Link href="/student/research/saved" className="stu-home-link">
								Saved ideas
							</Link>
						</div>

						<div className="stu-home-pipeline">
							<div className="stu-home-pipeline-track">
								<div className="stu-home-pipeline-fill" style={{ width: `${completionPercent}%` }} />
							</div>
							<div className="stu-home-pipeline-steps">
								{STUDENT_BOARD_COLUMNS.map((column) => (
									<div
										key={column.id}
										className={`stu-home-pipeline-step stu-home-pipeline-step-${COLUMN_ACCENTS[column.id]}`}
									>
										<span aria-hidden>{PIPELINE_ICONS[column.id]}</span>
										<strong>{ideasByStatus[column.id].length}</strong>
										<span>{column.label}</span>
									</div>
								))}
							</div>
						</div>

						{loading ? (
							<div className="stu-home-board">
								{STUDENT_BOARD_COLUMNS.map((column) => (
									<div key={column.id} className="stu-home-column">
										<div className="stu-skeleton stu-skeleton-line" />
										<div className="stu-skeleton stu-skeleton-card" />
									</div>
								))}
							</div>
						) : ideas.length === 0 ? (
							<div className="stu-home-empty stu-home-empty-compact">
								<Lightbulb size={26} />
								<h3>No ideas on the board</h3>
								<p>Use Research Assistant to generate topics, then bookmark the ones you want to develop.</p>
								<Link href="/student/research" className="stu-home-btn stu-home-btn-primary">
									<Sparkles size={16} />
									Open Research Assistant
								</Link>
							</div>
						) : (
							<div className="stu-home-board">
								{STUDENT_BOARD_COLUMNS.map((column) => (
									<div
										key={column.id}
										className={`stu-home-column stu-home-column-${COLUMN_ACCENTS[column.id]}`}
									>
										<div className="stu-home-column-head">
											<div>
												<h3>{column.label}</h3>
												<p>{column.hint}</p>
											</div>
											<span>{ideasByStatus[column.id].length}</span>
										</div>
										<div className="stu-home-column-body">
											{ideasByStatus[column.id].length === 0 ? (
												<p className="stu-home-column-empty">Nothing here yet</p>
											) : (
												ideasByStatus[column.id].map((idea) => (
													<BoardCard
														key={`${idea.dbId ?? idea.id}-${idea.savedAt}`}
														idea={idea}
														columnId={column.id}
														onMove={(status) => void handleMove(idea, status)}
														onRemove={() => void handleRemove(idea)}
													/>
												))
											)}
										</div>
									</div>
								))}
							</div>
						)}
					</section>
				</div>

				<aside className="stu-home-aside" aria-label="Profile and shortcuts">
					<div className="stu-home-identity">
						<span className="stu-home-avatar">{initials}</span>
						<div>
							<p className="stu-home-identity-name">{user.name}</p>
							<p className="stu-home-identity-role">{user.programme || user.department || "Student"}</p>
						</div>
						<dl>
							<div>
								<dt>Institution</dt>
								<dd>{user.institution ?? "Not set"}</dd>
							</div>
							<div>
								<dt>Email</dt>
								<dd>{user.email}</dd>
							</div>
						</dl>
					</div>

					<div className="stu-home-tokens">
						<TokenRing percentUsed={tokenPercentUsed} remaining={tokensRemaining} />
						<div>
							<p className="stu-home-tokens-title">Research tokens</p>
							<p className="stu-home-tokens-meta">
								{tokenPercentUsed}% of {allowance.toLocaleString()} used
							</p>
						</div>
					</div>

					{recentIdeas.length > 0 ? (
						<div className="stu-home-aside-block">
							<h3>Recent ideas</h3>
							<ul>
								{recentIdeas.map((idea) => {
									const status = idea.status ?? "saved";
									return (
										<li key={`${idea.dbId ?? idea.id}-${idea.savedAt}`}>
											<p>{idea.title}</p>
											<span>
												{STATUS_LABELS[status]} · {formatShortDate(idea.savedAt)}
											</span>
										</li>
									);
								})}
							</ul>
						</div>
					) : null}

					<div className="stu-home-aside-block">
						<h3>Shortcuts</h3>
						<ul className="stu-home-shortcuts">
							{tools.map((tool) => (
								<li key={tool.id}>
									<Link href={tool.href} className="stu-home-shortcut">
										<span className={`stu-home-shortcut-icon stu-home-shortcut-${tool.id}`} aria-hidden>
											<NavIcon id={tool.id} size={16} />
										</span>
										<span>
											<strong>{tool.label}</strong>
											{tool.description ? <em>{tool.description}</em> : null}
										</span>
										<ChevronRight size={14} />
									</Link>
								</li>
							))}
						</ul>
					</div>

					<div className="stu-home-next">
						<div className="stu-home-next-icon" aria-hidden>
							<CalendarClock size={18} />
						</div>
						<div>
							<p>Suggested next step</p>
							<strong>
								{revisionCount
									? "Review supervisor feedback"
									: continueProject
										? `Continue “${continueProject.title}”`
										: "Generate your first research idea"}
							</strong>
						</div>
						<Link
							href={
								revisionCount
									? "/student/feedback"
									: continueProject
										? projectHref(continueProject)
										: "/student/research"
							}
							className="stu-home-btn stu-home-btn-primary"
						>
							Go
						</Link>
					</div>
				</aside>
			</div>
		</div>
	);
}
