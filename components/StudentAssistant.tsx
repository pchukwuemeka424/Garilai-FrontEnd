"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
	ArrowUpRight,
	Bell,
	CalendarClock,
	ChevronRight,
	ClipboardList,
	FolderKanban,
	MessageSquareText,
	Plus,
	RefreshCw,
	type LucideIcon,
} from "lucide-react";

import {
	formatNotificationRelative,
	notificationHref,
	notificationTypeLabel,
	parseNotificationsPayload,
	type NotificationItem,
} from "@/components/portal/features/notifications/student-notifications";
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
	tone: "navy" | "teal" | "amber" | "rose";
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

function ToolModule({
	title,
	description,
	href,
	icon: Icon,
	tone,
	cta,
	children,
}: {
	title: string;
	description: string;
	href: string;
	icon: LucideIcon;
	tone: "navy" | "amber" | "rose" | "teal";
	cta: string;
	children: ReactNode;
}) {
	return (
		<article className={`stu-assist-module stu-assist-module-${tone}`}>
			<div className="stu-assist-module-head">
				<span className="stu-assist-module-icon" aria-hidden>
					<Icon size={18} strokeWidth={1.75} />
				</span>
				<div>
					<h3>{title}</h3>
					<p>{description}</p>
				</div>
			</div>
			<div className="stu-assist-module-body">{children}</div>
			<Link href={href} className="stu-assist-module-cta">
				{cta}
				<ArrowUpRight size={14} />
			</Link>
		</article>
	);
}

export function StudentAssistant() {
	const { user } = useAuth();
	const [projects, setProjects] = useState<WorkspaceProject[]>([]);
	const [notifications, setNotifications] = useState<NotificationItem[]>([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(async () => {
		setLoading(true);
		try {
			const [projectList, notificationPayload] = await Promise.all([
				apiFetch("/api/v1/projects").catch(() => []) as Promise<WorkspaceProject[]>,
				apiFetch("/api/v1/notifications").catch(() => []) as Promise<unknown>,
			]);
			setProjects(Array.isArray(projectList) ? projectList : []);
			const parsed = parseNotificationsPayload(notificationPayload);
			setNotifications(parsed.items.slice(0, 6));
			setUnreadCount(parsed.unreadCount);
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

	if (!user) return null;

	return (
		<div className="stu-home stu-assist">
			<section className="stu-home-hero">
				<div className="stu-home-hero-copy">
					<p className="stu-home-hero-date">{formatToday()}</p>
					<h1>
						{getGreeting()}, {firstName}
					</h1>
					<p className="stu-home-hero-lead">
						Your writing desk for theses, coursework, supervisor feedback, and updates.
					</p>
				</div>
				<div className="stu-home-hero-actions">
					<button
						type="button"
						className="stu-home-btn stu-home-btn-light"
						onClick={() => void refresh()}
						disabled={loading}
					>
						<RefreshCw size={16} className={loading ? "stu-home-spin" : undefined} />
						{loading ? "Syncing…" : "Refresh"}
					</button>
					<Link href="/student/notifications" className="stu-home-btn stu-home-btn-light">
						<Bell size={16} />
						Inbox
						{unreadCount > 0 ? <span className="stu-assist-hero-badge">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
					</Link>
					<Link href="/student/projects/new" className="stu-home-btn stu-home-btn-solid">
						<Plus size={16} />
						New project
					</Link>
				</div>
			</section>

			<section className="stu-home-metrics stu-assist-metrics" aria-label="Workspace overview">
				<MetricCard
					label="Projects"
					value={researchProjects.length}
					hint={researchProjects.length ? `${avgProgress}% average progress` : "Start a thesis or paper"}
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
					label="Revisions"
					value={revisionItems.length}
					hint={revisionItems.length ? "Supervisor comments waiting" : "Nothing to revise"}
					icon={MessageSquareText}
					tone="rose"
					href="/student/feedback"
					loading={loading}
				/>
				<MetricCard
					label="Inbox"
					value={unreadCount}
					hint={unreadCount ? "Unread notifications" : "You're up to date"}
					icon={Bell}
					tone="teal"
					href="/student/notifications"
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
						<div className="stu-home-progress" role="presentation">
							<div
								className="stu-home-progress-fill"
								style={{
									width: `${Math.min(100, Math.max(0, continueProject.progressPercent ?? 0))}%`,
								}}
							/>
						</div>
					</div>
					<ChevronRight size={18} aria-hidden />
				</Link>
			) : null}

			<div className="stu-assist-layout">
				<div className="stu-assist-grid">
					<ToolModule
						title="Projects"
						description="Theses, dissertations, and research folders."
						href="/student/projects"
						icon={FolderKanban}
						tone="navy"
						cta="Open projects"
					>
						{loading ? (
							<div className="stu-skeleton stu-skeleton-card" />
						) : activeProjects.length === 0 ? (
							<p className="stu-home-quiet">No writing projects yet.</p>
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
						tone="amber"
						cta="Open assignments"
					>
						{loading ? (
							<div className="stu-skeleton stu-skeleton-card" />
						) : upcomingAssignments.length === 0 ? (
							<p className="stu-home-quiet">No assignments from lecturers yet.</p>
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
						tone="rose"
						cta="Review feedback"
					>
						{loading ? (
							<div className="stu-skeleton stu-skeleton-card" />
						) : revisionItems.length === 0 ? (
							<p className="stu-home-quiet">No revision requests right now.</p>
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

					<ToolModule
						title="Notifications"
						description="Updates from lecturers and supervisors."
						href="/student/notifications"
						icon={Bell}
						tone="teal"
						cta="Open inbox"
					>
						{loading ? (
							<div className="stu-skeleton stu-skeleton-card" />
						) : notifications.length === 0 ? (
							<p className="stu-home-quiet">No notifications yet.</p>
						) : (
							<ul className="stu-assist-preview">
								{notifications.slice(0, 3).map((item) => {
									const href = notificationHref(item) || "/student/notifications";
									return (
										<li key={item._id}>
											<Link href={href}>
												<strong>{item.title}</strong>
												<span>
													{notificationTypeLabel(item.type)}
													{item.createdAt ? ` · ${formatNotificationRelative(item.createdAt)}` : ""}
												</span>
											</Link>
										</li>
									);
								})}
							</ul>
						)}
					</ToolModule>
				</div>

				<aside className="stu-assist-aside">
					<section className="stu-home-panel">
						<div className="stu-home-panel-head">
							<div>
								<h2>Needs attention</h2>
								<p>Items that should move first.</p>
							</div>
						</div>
						{loading ? (
							<div className="stu-skeleton stu-skeleton-card" />
						) : revisionItems.length === 0 && dueSoonCount === 0 && unreadCount === 0 ? (
							<p className="stu-home-quiet">You're clear — nothing urgent.</p>
						) : (
							<ul className="stu-assist-queue">
								{revisionItems.length > 0 ? (
									<li>
										<Link href="/student/feedback">
											<span className="stu-assist-queue-icon stu-assist-queue-rose" aria-hidden>
												<MessageSquareText size={15} />
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
												<CalendarClock size={15} />
											</span>
											<div>
												<strong>{dueSoonCount} due this week</strong>
												<span>Check assignment deadlines</span>
											</div>
										</Link>
									</li>
								) : null}
								{unreadCount > 0 ? (
									<li>
										<Link href="/student/notifications">
											<span className="stu-assist-queue-icon stu-assist-queue-teal" aria-hidden>
												<Bell size={15} />
											</span>
											<div>
												<strong>{unreadCount} unread updates</strong>
												<span>Review your inbox</span>
											</div>
										</Link>
									</li>
								) : null}
							</ul>
						)}
					</section>

					<section className="stu-home-panel">
						<div className="stu-home-panel-head">
							<div>
								<h2>Quick start</h2>
								<p>Jump into the next writing task.</p>
							</div>
						</div>
						<ul className="stu-home-shortcuts">
							<li>
								<Link href="/student/projects/new" className="stu-home-shortcut">
									<span className="stu-home-shortcut-icon" aria-hidden>
										<Plus size={15} />
									</span>
									<span>
										New project
										<em>Thesis, dissertation, or paper</em>
									</span>
									<ChevronRight size={14} />
								</Link>
							</li>
							<li>
								<Link href="/student/assignments" className="stu-home-shortcut">
									<span className="stu-home-shortcut-icon" aria-hidden>
										<ClipboardList size={15} />
									</span>
									<span>
										Submit coursework
										<em>Open lecturer briefs</em>
									</span>
									<ChevronRight size={14} />
								</Link>
							</li>
							<li>
								<Link href="/student/feedback" className="stu-home-shortcut">
									<span className="stu-home-shortcut-icon" aria-hidden>
										<MessageSquareText size={15} />
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
