"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
	AlertCircle,
	Award,
	Bell,
	CheckCheck,
	CheckCircle2,
	ClipboardList,
	FolderKanban,
	MailOpen,
	RefreshCw,
	Search,
	Send,
	type LucideIcon,
} from "lucide-react";

import {
	formatNotificationRelative,
	formatNotificationWhen,
	isNotificationUnread,
	notificationHref,
	notificationTypeLabel,
	parseNotificationsPayload,
	type NotificationItem,
} from "@/components/portal/features/notifications/student-notifications";

import { apiFetch } from "@/lib/portal-api";

type FilterTab = "all" | "unread" | "read";

type TypeTone = "navy" | "teal" | "amber" | "rose" | "violet";

function formatToday() {
	return new Intl.DateTimeFormat(undefined, {
		weekday: "long",
		month: "long",
		day: "numeric",
	}).format(new Date());
}

function typeMeta(type?: string): { icon: LucideIcon; tone: TypeTone } {
	switch (type) {
		case "assignment.scored":
			return { icon: Award, tone: "amber" };
		case "page.approved":
		case "chapter.approved":
			return { icon: CheckCircle2, tone: "teal" };
		case "page.needs_revision":
		case "chapter.needs_revision":
			return { icon: AlertCircle, tone: "rose" };
		case "chapter.submitted":
			return { icon: Send, tone: "navy" };
		case "project.assigned":
			return { icon: FolderKanban, tone: "violet" };
		default:
			return { icon: Bell, tone: "navy" };
	}
}

function dayHeading(iso?: string) {
	if (!iso) return "Earlier";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "Earlier";
	const startOf = (value: Date) =>
		new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
	const diffDays = Math.round((startOf(new Date()) - startOf(date)) / 86_400_000);
	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Yesterday";
	if (diffDays > 1 && diffDays < 7) {
		return date.toLocaleDateString(undefined, { weekday: "long" });
	}
	return date.toLocaleDateString(undefined, {
		month: "long",
		day: "numeric",
		year: "numeric",
	});
}

function groupByDay(items: NotificationItem[]) {
	const groups: Array<{ heading: string; items: NotificationItem[] }> = [];
	for (const item of items) {
		const heading = dayHeading(item.createdAt);
		const last = groups[groups.length - 1];
		if (last && last.heading === heading) {
			last.items.push(item);
		} else {
			groups.push({ heading, items: [item] });
		}
	}
	return groups;
}

function MetricButton({
	label,
	value,
	hint,
	icon: Icon,
	tone,
	active,
	onClick,
}: {
	label: string;
	value: number;
	hint: string;
	icon: LucideIcon;
	tone: TypeTone;
	active?: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`stu-home-metric stu-home-metric-${tone}${active ? " stu-home-metric-active" : ""}`}
		>
			<span className="stu-home-metric-icon" aria-hidden>
				<Icon size={18} strokeWidth={1.75} />
			</span>
			<div className="stu-home-metric-copy">
				<p className="stu-home-metric-label">{label}</p>
				<p className="stu-home-metric-value">{value}</p>
				<p className="stu-home-metric-hint">{hint}</p>
			</div>
		</button>
	);
}

export default function StudentNotificationsPage() {
	const [items, setItems] = useState<NotificationItem[]>([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [filter, setFilter] = useState<FilterTab>("all");
	const [query, setQuery] = useState("");
	const [busyId, setBusyId] = useState<string | null>(null);
	const [markingAll, setMarkingAll] = useState(false);

	const load = useCallback(async (quiet = false) => {
		if (!quiet) setLoading(true);
		setError(null);
		try {
			const data = parseNotificationsPayload(await apiFetch("/api/v1/notifications"));
			setItems(data.items);
			setUnreadCount(data.unreadCount);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load notifications");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const readCount = useMemo(
		() => items.filter((n) => !isNotificationUnread(n)).length,
		[items],
	);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return items.filter((n) => {
			if (filter === "unread" && !isNotificationUnread(n)) return false;
			if (filter === "read" && isNotificationUnread(n)) return false;
			if (!q) return true;
			const hay = [n.title, n.body, n.type, notificationTypeLabel(n.type)]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();
			return hay.includes(q);
		});
	}, [items, filter, query]);

	const groups = useMemo(() => groupByDay(filtered), [filtered]);

	async function markOne(id: string) {
		const target = items.find((n) => n._id === id);
		if (!target || !isNotificationUnread(target)) return;
		setBusyId(id);
		try {
			await apiFetch(`/api/v1/notifications/${id}/read`, { method: "POST" });
			const now = new Date().toISOString();
			setItems((prev) =>
				prev.map((n) => (n._id === id ? { ...n, readAt: n.readAt || now } : n)),
			);
			setUnreadCount((c) => Math.max(0, c - 1));
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to mark notification as read");
		} finally {
			setBusyId(null);
		}
	}

	async function markAllRead() {
		if (unreadCount === 0) return;
		setMarkingAll(true);
		try {
			await apiFetch("/api/v1/notifications", { method: "PATCH" });
			const now = new Date().toISOString();
			setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || now })));
			setUnreadCount(0);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to mark all as read");
		} finally {
			setMarkingAll(false);
		}
	}

	return (
		<div className="stu-home stu-inbox">
			<section className="stu-home-hero">
				<div className="stu-home-hero-copy">
					<p className="stu-home-hero-date">{formatToday()}</p>
					<h1>Notifications</h1>
					<p className="stu-home-hero-lead">
						Updates from lecturers, supervisors, and reviews — open an item to jump
						straight to the related work.
					</p>
				</div>
				<div className="stu-home-hero-actions">
					<button
						type="button"
						className="stu-home-btn stu-home-btn-light"
						onClick={() => void load(true)}
						disabled={loading}
					>
						<RefreshCw size={16} className={loading ? "stu-home-spin" : undefined} />
						{loading ? "Syncing…" : "Refresh"}
					</button>
					<button
						type="button"
						className="stu-home-btn stu-home-btn-solid"
						disabled={unreadCount === 0 || markingAll}
						onClick={() => void markAllRead()}
					>
						<CheckCheck size={16} />
						{markingAll ? "Marking…" : "Mark all read"}
					</button>
				</div>
			</section>

			<section className="stu-home-metrics stu-inbox-metrics" aria-label="Inbox overview">
				<MetricButton
					label="Inbox"
					value={items.length}
					hint="All in-app alerts"
					icon={Bell}
					tone="navy"
					active={filter === "all"}
					onClick={() => setFilter("all")}
				/>
				<MetricButton
					label="Unread"
					value={unreadCount}
					hint={unreadCount ? "Waiting for your attention" : "You're up to date"}
					icon={MailOpen}
					tone="teal"
					active={filter === "unread"}
					onClick={() => setFilter("unread")}
				/>
				<MetricButton
					label="Read"
					value={readCount}
					hint="Already reviewed"
					icon={CheckCircle2}
					tone="violet"
					active={filter === "read"}
					onClick={() => setFilter("read")}
				/>
			</section>

			{error ? (
				<div className="stu-inbox-banner" role="alert">
					<p>{error}</p>
					<button type="button" onClick={() => void load()}>
						Try again
					</button>
				</div>
			) : null}

			<section className="stu-home-panel stu-inbox-panel">
				<div className="stu-home-panel-head stu-inbox-toolbar">
					<div>
						<h2>Inbox</h2>
						<p>
							{loading
								? "Loading your updates…"
								: filtered.length === 1
									? "1 notification"
									: `${filtered.length} notifications`}
							{query.trim() ? ` matching “${query.trim()}”` : ""}
						</p>
					</div>
					<div className="stu-inbox-controls">
						<div className="stu-inbox-tabs" role="tablist" aria-label="Filter notifications">
							{(
								[
									["all", "All"],
									["unread", "Unread"],
									["read", "Read"],
								] as const
							).map(([value, label]) => (
								<button
									key={value}
									type="button"
									role="tab"
									aria-selected={filter === value}
									className={filter === value ? "is-active" : undefined}
									onClick={() => setFilter(value)}
								>
									{label}
									{value === "unread" && unreadCount > 0 ? (
										<span>{unreadCount > 99 ? "99+" : unreadCount}</span>
									) : null}
								</button>
							))}
						</div>
						<label className="stu-inbox-search">
							<Search size={15} aria-hidden />
							<input
								type="search"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Search updates…"
							/>
						</label>
					</div>
				</div>

				{loading ? (
					<div className="stu-inbox-skeleton">
						<div className="stu-skeleton stu-skeleton-line" />
						<div className="stu-skeleton stu-skeleton-card" />
						<div className="stu-skeleton stu-skeleton-card" />
					</div>
				) : items.length === 0 ? (
					<div className="stu-inbox-empty">
						<span className="stu-inbox-empty-icon" aria-hidden>
							<Bell size={22} strokeWidth={1.75} />
						</span>
						<h3>You&apos;re all caught up</h3>
						<p>New notifications from lecturers and reviews will appear here.</p>
						<Link href="/student/dashboard" className="stu-home-btn stu-home-btn-primary">
							Back to dashboard
						</Link>
					</div>
				) : filtered.length === 0 ? (
					<div className="stu-inbox-empty">
						<span className="stu-inbox-empty-icon" aria-hidden>
							<Search size={22} strokeWidth={1.75} />
						</span>
						<h3>No matching notifications</h3>
						<p>Try another search term or clear the filter.</p>
						<button
							type="button"
							className="stu-home-btn stu-inbox-clear"
							onClick={() => {
								setQuery("");
								setFilter("all");
							}}
						>
							Clear filters
						</button>
					</div>
				) : (
					<div className="stu-inbox-feed">
						{groups.map((group) => (
							<section key={group.heading} className="stu-inbox-group">
								<h3 className="stu-inbox-day">{group.heading}</h3>
								<ul>
									{group.items.map((row) => {
										const unread = isNotificationUnread(row);
										const href = notificationHref(row, "student");
										const meta = typeMeta(row.type);
										const Icon = meta.icon;
										const typeLabel = notificationTypeLabel(row.type);
										const when =
											formatNotificationRelative(row.createdAt) ||
											formatNotificationWhen(row.createdAt);

										const open = () => {
											if (unread) void markOne(row._id);
										};

										const body: ReactNode = (
											<>
												<span className={`stu-inbox-icon stu-inbox-icon-${meta.tone}`} aria-hidden>
													<Icon size={16} strokeWidth={1.75} />
												</span>
												<div className="stu-inbox-copy">
													<div className="stu-inbox-title-row">
														{unread ? (
															<span className="stu-inbox-dot" aria-label="Unread" />
														) : null}
														<strong>{row.title || "Notification"}</strong>
													</div>
													{row.body ? <p>{row.body}</p> : null}
													<div className="stu-inbox-meta">
														<span className={`stu-inbox-chip stu-inbox-chip-${meta.tone}`}>
															{typeLabel}
														</span>
														<time
															dateTime={row.createdAt}
															title={formatNotificationWhen(row.createdAt)}
														>
															{when}
														</time>
													</div>
												</div>
											</>
										);

										return (
											<li
												key={row._id}
												className={unread ? "stu-inbox-row is-unread" : "stu-inbox-row"}
											>
												{href ? (
													<Link href={href} className="stu-inbox-main" onClick={open}>
														{body}
													</Link>
												) : (
													<div className="stu-inbox-main">{body}</div>
												)}
												<div className="stu-inbox-actions">
													{href ? (
														<Link href={href} className="stu-inbox-open" onClick={open}>
															<ClipboardList size={14} />
															Open
														</Link>
													) : null}
													{unread ? (
														<button
															type="button"
															className="stu-inbox-mark"
															disabled={busyId === row._id}
															onClick={() => void markOne(row._id)}
														>
															<MailOpen size={14} />
															{busyId === row._id ? "…" : "Mark read"}
														</button>
													) : (
														<span className="stu-inbox-read">
															<CheckCircle2 size={14} />
															Read
														</span>
													)}
												</div>
											</li>
										);
									})}
								</ul>
							</section>
						))}
					</div>
				)}
			</section>
		</div>
	);
}
