"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	ArrowRight,
	CalendarClock,
	ClipboardList,
	FolderKanban,
	MessageSquareText,
	Plus,
	RefreshCw,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/portal-api";
import { projectTypeLabel } from "@/lib/portal/project-types";
import {
	formatNotificationRelative,
	isNotificationUnread,
	notificationHref,
	parseNotificationsPayload,
	type NotificationItem,
} from "@/components/portal/features/notifications/student-notifications";
import { assignmentSubmissionStatus } from "@/lib/portal/assignment-status";
import type { ReviewTrailEvent } from "@/lib/portal/review-trail";

type WorkspaceProject = {
	_id: string;
	title: string;
	projectType: string;
	topic?: string;
	progressPercent?: number;
	status?: string;
	createdAt?: string;
	updatedAt?: string;
	supervisor?: { id: string; name: string; email: string } | null;
	score?: number | null;
	assignmentBrief?: { dueAt?: string | null; courseName?: string | null } | null;
	pages?: Array<{
		_id?: string;
		title?: string;
		reviewStatus?: string;
		content?: string;
		order?: number;
		reviewTrail?: ReviewTrailEvent[];
	}>;
};

type AssignmentNotice = {
	key: string;
	title: string;
	body: string;
	href: string;
	when?: string;
	notificationId?: string;
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
	const status = assignmentSubmissionStatus(row);
	if (status.tone === "revision") return { label: status.label, tone: "alert" };
	if (status.tone === "approved" || status.tone === "graded") {
		return { label: status.label, tone: "done" };
	}
	if (status.tone === "submitted") return { label: status.label, tone: "info" };
	return { label: status.label, tone: status.tone };
}

export function StudentAssistant() {
	const { user } = useAuth();
	const [projects, setProjects] = useState<WorkspaceProject[]>([]);
	const [notifications, setNotifications] = useState<NotificationItem[]>([]);
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(async () => {
		setLoading(true);
		try {
			const [projectList, notificationPayload] = await Promise.all([
				apiFetch("/api/v1/projects").catch(() => []) as Promise<WorkspaceProject[]>,
				apiFetch("/api/v1/notifications").catch(() => null),
			]);
			setProjects(Array.isArray(projectList) ? projectList : []);
			setNotifications(parseNotificationsPayload(notificationPayload).items);
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

	const newAssignmentNotices = useMemo(() => {
		const fromNotifications: AssignmentNotice[] = notifications
			.filter((n) => n.type === "assignment.published" && isNotificationUnread(n))
			.map((n) => ({
				key: `n-${n._id}`,
				title: n.title || "New assignment",
				body: n.body || "Your lecturer published a new assignment brief.",
				href: notificationHref(n, "student") || "/student/assignments",
				when: formatNotificationRelative(n.createdAt),
				notificationId: n._id,
			}));

		if (fromNotifications.length > 0) {
			return fromNotifications.slice(0, 3);
		}

		// Fallback: surface not-started assignments created in the last 14 days.
		const weekMs = 14 * 24 * 60 * 60 * 1000;
		const now = Date.now();
		return assignments
			.filter((row) => {
				const status = assignmentTone(row);
				if (status.tone !== "idle") return false;
				const created = row.createdAt ? new Date(row.createdAt).getTime() : NaN;
				if (Number.isNaN(created) || now - created > weekMs) return false;
				return true;
			})
			.sort(
				(a, b) =>
					new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
			)
			.slice(0, 3)
			.map((row) => {
				const due = row.assignmentBrief?.dueAt
					? `Due ${formatShortDate(row.assignmentBrief.dueAt)}`
					: "Open the brief to get started";
				const course = row.assignmentBrief?.courseName?.trim();
				return {
					key: `a-${row._id}`,
					title: "New assignment",
					body: course ? `${row.title} · ${course}. ${due}.` : `${row.title}. ${due}.`,
					href: projectHref(row),
					when: formatRelative(row.createdAt),
				} satisfies AssignmentNotice;
			});
	}, [notifications, assignments]);

	const dueSoonCount = assignments.filter((a) => dueSoon(a.assignmentBrief?.dueAt)).length;
	const firstName = user?.name.split(" ")[0] ?? "there";
	const hasAttention = revisionItems.length > 0 || dueSoonCount > 0;

	const recentItems = useMemo(() => {
		const assignmentRows = upcomingAssignments.map((row) => {
			const status = assignmentTone(row);
			// Never show "New" after the student has started or submitted.
			const isNew = status.tone === "idle";
			const badge = isNew
				? "New"
				: status.label === "Needs revision"
					? "Revision"
					: status.tone === "info"
						? "Submitted"
						: status.tone === "done"
							? status.label
							: status.tone === "progress"
								? "Pending"
								: "Assignment";
			const badgeTone = isNew
				? "new"
				: status.tone === "alert"
					? "alert"
					: status.tone === "info"
						? "submitted"
						: status.tone === "done"
							? "done"
							: status.tone === "progress"
								? "progress"
								: "assignment";
			const due = row.assignmentBrief?.dueAt
				? `Due ${formatShortDate(row.assignmentBrief.dueAt)}`
				: null;
			return {
				key: `a-${row._id}`,
				href: projectHref(row),
				title: row.title,
				kind: "assignment" as const,
				badge,
				badgeTone,
				due,
				statusLabel: status.label,
				statusTone: badgeTone === "new" ? "idle" : badgeTone,
			};
		});
		const projectRows = activeProjects.map((project) => ({
			key: `p-${project._id}`,
			href: projectHref(project),
			title: project.title,
			kind: "project" as const,
			badge: projectTypeLabel(project.projectType),
			badgeTone: "project" as const,
			due: null as string | null,
			statusLabel: `${project.progressPercent ?? 0}%${
				project.updatedAt ? ` · ${formatRelative(project.updatedAt)}` : ""
			}`,
			statusTone: "project" as const,
		}));
		// Assignments always listed first, then projects.
		return [...assignmentRows, ...projectRows].slice(0, 5);
	}, [upcomingAssignments, activeProjects]);

	const newRecentCount = recentItems.filter((item) => item.badgeTone === "new").length;

	if (!user) return null;

	return (
		<div className="stu-assist">
			<header className="stu-assist-intro">
				<div className="stu-assist-intro-copy">
					<p className="stu-assist-eyebrow">{formatToday()}</p>
					<h1>
						{getGreeting()}, {firstName}
					</h1>
					<p>Submit coursework or open a project folder for supervisor review.</p>
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

			<section className="stu-assist-columns" aria-label="Student assessment">
				<article className="stu-assist-card">
					<div className="stu-assist-card-head">
						<p className="stu-assist-column-kicker">Submit work</p>
						<h2>Hand in your writing</h2>
						<p>Choose an assignment brief or a project folder to submit for review.</p>
					</div>

					<div className="stu-assist-submit-list">
						<Link href="/student/assignments" className="stu-assist-submit-row">
							<span className="stu-assist-column-icon" aria-hidden>
								<ClipboardList size={18} strokeWidth={1.75} />
							</span>
							<span className="stu-assist-submit-copy">
								<strong>Submit assignment</strong>
								<em>
									{loading
										? "Loading briefs…"
										: newAssignmentNotices.length > 0
											? `${newAssignmentNotices.length} new · ${assignments.length} brief${assignments.length === 1 ? "" : "s"}`
											: dueSoonCount > 0
												? `${assignments.length} briefs · ${dueSoonCount} due this week`
												: assignments.length
													? `${assignments.length} lecturer brief${assignments.length === 1 ? "" : "s"}`
													: "Open published lecturer briefs"}
								</em>
							</span>
							{newAssignmentNotices.length > 0 ? (
								<span className="stu-assist-row-badge" aria-label={`${newAssignmentNotices.length} new`}>
									{newAssignmentNotices.length}
								</span>
							) : null}
							<span className="stu-assist-submit-cta">
								Open
								<ArrowRight size={14} />
							</span>
						</Link>

						<Link href="/student/projects/new" className="stu-assist-submit-row">
							<span className="stu-assist-column-icon" aria-hidden>
								<FolderKanban size={18} strokeWidth={1.75} />
							</span>
							<span className="stu-assist-submit-copy">
								<strong>Submit project</strong>
								<em>
									{loading
										? "Loading projects…"
										: researchProjects.length
											? `${researchProjects.length} project folder${researchProjects.length === 1 ? "" : "s"} · create or continue`
											: "Start a thesis, dissertation, or paper"}
								</em>
							</span>
							<span className="stu-assist-submit-cta">
								<Plus size={14} />
								New
							</span>
						</Link>
					</div>

					<div className="stu-assist-card-foot">
						<Link href="/student/projects" className="stu-assist-btn stu-assist-btn-ghost">
							View all projects
						</Link>
						{dueSoonCount > 0 ? (
							<p className="stu-assist-column-meta">
								<CalendarClock size={13} aria-hidden />
								{dueSoonCount} due this week
							</p>
						) : null}
					</div>
				</article>

				<aside className="stu-assist-card stu-assist-card-side">
					<div className="stu-assist-card-head">
						<p className="stu-assist-column-kicker">Workspace</p>
						<h2>Feedback & recent</h2>
						<p>Supervisor comments and your latest drafts.</p>
					</div>

					<div className="stu-assist-side-block">
						<div className="stu-assist-feedback-inline">
							<span className="stu-assist-feedback-icon" aria-hidden>
								<MessageSquareText size={16} />
							</span>
							<div>
								<strong>Feedback</strong>
								<p>
									{loading
										? "Checking supervisor comments…"
										: hasAttention
											? [
													revisionItems.length
														? `${revisionItems.length} need${revisionItems.length === 1 ? "s" : ""} revision`
														: null,
													dueSoonCount ? `${dueSoonCount} due this week` : null,
												]
													.filter(Boolean)
													.join(" · ")
											: "No revision requests right now."}
								</p>
							</div>
							<Link href="/student/feedback" className="stu-assist-btn stu-assist-btn-ghost">
								Review
								<ArrowRight size={14} />
							</Link>
						</div>
					</div>

					<div className="stu-assist-column-body">
						<div className="stu-assist-body-label-row">
							<p className="stu-assist-body-label">Recent</p>
							{newRecentCount > 0 ? (
								<span className="stu-assist-count-badge" aria-label={`${newRecentCount} new`}>
									{newRecentCount} new
								</span>
							) : null}
						</div>
						{loading ? (
							<div className="stu-assist-skeleton" aria-hidden />
						) : recentItems.length === 0 ? (
							<p className="stu-assist-quiet">Nothing submitted yet.</p>
						) : (
							<ul className="stu-assist-preview">
								{recentItems.map((item) => (
									<li key={item.key}>
										<Link href={item.href} className="stu-assist-preview-link">
											<span className="stu-assist-preview-copy">
												<strong>{item.title}</strong>
												<span className="stu-assist-preview-meta">
													{item.due ? <span>{item.due}</span> : null}
													{item.due && item.statusLabel ? (
														<span className="stu-assist-meta-sep" aria-hidden>
															·
														</span>
													) : null}
													{item.statusLabel ? (
														<span
															className={`stu-assist-status tone-${item.statusTone}`}
														>
															{item.statusLabel}
														</span>
													) : null}
												</span>
											</span>
											<span
												className={`stu-assist-item-badge tone-${item.badgeTone}`}
											>
												{item.badge}
											</span>
										</Link>
									</li>
								))}
							</ul>
						)}
					</div>
				</aside>
			</section>
		</div>
	);
}
