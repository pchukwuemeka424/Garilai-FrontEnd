"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
	Calendar,
	ClipboardList,
	LayoutGrid,
	List,
	Plus,
	Search,
	UserRound,
	X,
} from "lucide-react";
import { apiFetch } from "@/lib/portal-api";
import type { AssignmentBriefView } from "@/components/portal/features/assignment/assignment-brief-panel";
import { cn } from "@/lib/portal/cn";

type ProjectPage = {
	_id: string;
	content?: string;
	order?: number;
	reviewStatus?: "none" | "approved" | "needs_revision" | string;
};

type AssignmentRow = {
	_id: string;
	title: string;
	projectType: string;
	score?: number | null;
	updatedAt?: string;
	createdAt?: string;
	supervisor?: { id: string; name: string; email: string } | null;
	assignmentBrief?: AssignmentBriefView | null;
	pages?: ProjectPage[];
};

type StatusMeta = {
	label: string;
	tone: "graded" | "approved" | "revision" | "submitted" | "progress" | "idle";
};

type StatusFilter = "all" | "dueSoon" | "active" | "revision" | "graded";
type ViewMode = "list" | "grid";

function primaryPage(pages: ProjectPage[] | undefined) {
	if (!Array.isArray(pages) || pages.length === 0) return null;
	return [...pages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0] ?? null;
}

function assignmentStatus(row: AssignmentRow): StatusMeta {
	if (typeof row.score === "number") {
		return { label: "Graded", tone: "graded" };
	}
	const page = primaryPage(row.pages);
	if (page?.reviewStatus === "approved") {
		return { label: "Approved", tone: "approved" };
	}
	if (page?.reviewStatus === "needs_revision") {
		return { label: "Needs revision", tone: "revision" };
	}
	if (page?.reviewStatus && page.reviewStatus !== "none") {
		return { label: "Submitted", tone: "submitted" };
	}
	if (String(page?.content || "").trim()) {
		return { label: "In progress", tone: "progress" };
	}
	return { label: "Not started", tone: "idle" };
}

function dueLabel(dueAt?: string | null) {
	if (!dueAt) return null;
	const date = new Date(dueAt);
	if (Number.isNaN(date.getTime())) return null;
	return date.toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

function dueTimestamp(dueAt?: string | null) {
	if (!dueAt) return Number.POSITIVE_INFINITY;
	const t = new Date(dueAt).getTime();
	return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

function isOverdue(dueAt?: string | null, status?: StatusMeta) {
	if (!dueAt) return false;
	if (status?.label === "Graded" || status?.label === "Approved") return false;
	const date = new Date(dueAt);
	if (Number.isNaN(date.getTime())) return false;
	const end = new Date(date);
	end.setHours(23, 59, 59, 999);
	return end.getTime() < Date.now();
}

function isDueSoon(dueAt?: string | null, status?: StatusMeta) {
	if (!dueAt) return false;
	if (status?.label === "Graded" || status?.label === "Approved") return false;
	const t = new Date(dueAt).getTime();
	if (Number.isNaN(t)) return false;
	const now = Date.now();
	const week = 7 * 24 * 60 * 60 * 1000;
	return t >= now && t - now <= week;
}

function statusProgress(status: StatusMeta, row: AssignmentRow, maxScore: number) {
	if (status.tone === "graded") {
		const score = typeof row.score === "number" ? row.score : 0;
		return Math.min(100, Math.round((score / Math.max(maxScore, 1)) * 100));
	}
	if (status.tone === "approved") return 100;
	if (status.tone === "submitted") return 75;
	if (status.tone === "revision") return 55;
	if (status.tone === "progress") return 35;
	return 8;
}

function formatToday() {
	return new Intl.DateTimeFormat(undefined, {
		weekday: "long",
		month: "long",
		day: "numeric",
	}).format(new Date());
}

export default function StudentAssignmentsPage() {
	const [rows, setRows] = useState<AssignmentRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [viewMode, setViewMode] = useState<ViewMode>("list");

	useEffect(() => {
		let cancelled = false;
		async function load() {
			setLoading(true);
			setError(null);
			try {
				const list = (await apiFetch("/api/v1/projects")) as AssignmentRow[];
				if (cancelled) return;
				setRows(
					(Array.isArray(list) ? list : []).filter((p) => p.projectType === "assignment"),
				);
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "Failed to load assignments");
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

	const summary = useMemo(() => {
		let dueSoon = 0;
		let graded = 0;
		let inProgress = 0;
		let needsRevision = 0;
		for (const row of rows) {
			const status = assignmentStatus(row);
			if (status.label === "Graded") graded += 1;
			if (status.label === "In progress" || status.label === "Submitted") {
				inProgress += 1;
			}
			if (status.label === "Needs revision") needsRevision += 1;
			if (isDueSoon(row.assignmentBrief?.dueAt, status)) dueSoon += 1;
		}
		return {
			total: rows.length,
			dueSoon,
			graded,
			inProgress,
			needsRevision,
		};
	}, [rows]);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return rows
			.filter((row) => {
				const status = assignmentStatus(row);
				if (statusFilter === "graded" && status.label !== "Graded") return false;
				if (statusFilter === "revision" && status.label !== "Needs revision") {
					return false;
				}
				if (statusFilter === "dueSoon" && !isDueSoon(row.assignmentBrief?.dueAt, status)) {
					return false;
				}
				if (
					statusFilter === "active" &&
					status.label !== "In progress" &&
					status.label !== "Submitted"
				) {
					return false;
				}
				if (!q) return true;
				const brief = row.assignmentBrief;
				const hay = [
					brief?.title,
					row.title,
					brief?.courseName,
					brief?.courseYear,
					row.supervisor?.name,
					status.label,
				]
					.filter(Boolean)
					.join(" ")
					.toLowerCase();
				return hay.includes(q);
			})
			.sort((a, b) => {
				const statusA = assignmentStatus(a);
				const statusB = assignmentStatus(b);
				const overdueA = isOverdue(a.assignmentBrief?.dueAt, statusA) ? 0 : 1;
				const overdueB = isOverdue(b.assignmentBrief?.dueAt, statusB) ? 0 : 1;
				if (overdueA !== overdueB) return overdueA - overdueB;
				return dueTimestamp(a.assignmentBrief?.dueAt) - dueTimestamp(b.assignmentBrief?.dueAt);
			});
	}, [rows, query, statusFilter]);

	if (loading) {
		return (
			<div className="stu-asn" aria-busy="true">
				<header className="stu-asn-intro">
					<div className="stu-asn-intro-copy">
						<p className="stu-asn-eyebrow">{formatToday()}</p>
						<h1>Assignments</h1>
						<p>Loading coursework briefs and deadlines...</p>
					</div>
				</header>
				<div className="stu-asn-skeleton-strip" aria-hidden />
				<div className="stu-asn-library">
					<div className="stu-asn-skeleton-row" aria-hidden />
					<div className="stu-asn-skeleton-row" aria-hidden />
					<div className="stu-asn-skeleton-row" aria-hidden />
				</div>
			</div>
		);
	}

	return (
		<div className="stu-asn">
			<header className="stu-asn-intro">
				<div className="stu-asn-intro-copy">
					<p className="stu-asn-eyebrow">{formatToday()}</p>
					<h1>Assignments</h1>
					<p>
						Coursework from your lecturers. Open a brief, write the submission, and track
						feedback and marks. Research folders live under{" "}
						<Link href="/student/projects">Projects</Link>.
					</p>
				</div>
				<Link
					href="/student/projects/new?from=assignments"
					className="stu-asn-btn stu-asn-btn-primary"
				>
					<Plus size={15} />
					Start assignment
				</Link>
			</header>

			<section className="stu-asn-metrics" aria-label="Assignment summary">
				{(
					[
						["all", "Total", summary.total, "All briefs"],
						["dueSoon", "Due soon", summary.dueSoon, "Next 7 days"],
						["active", "Active", summary.inProgress, "Drafting"],
						["revision", "Revision", summary.needsRevision, "Returned"],
						["graded", "Graded", summary.graded, "Complete"],
					] as const
				).map(([value, label, count, hint]) => (
					<button
						key={value}
						type="button"
						className={cn("stu-asn-metric", statusFilter === value && "is-on")}
						onClick={() => setStatusFilter(value)}
						aria-pressed={statusFilter === value}
					>
						<span className="stu-asn-metric-label">{label}</span>
						<strong className="stu-asn-metric-value">{count}</strong>
						<span className="stu-asn-metric-hint">{hint}</span>
					</button>
				))}
			</section>

			{error ? (
				<p className="stu-asn-error" role="alert">
					{error}
				</p>
			) : null}

			<section className="stu-asn-library" aria-labelledby="stu-asn-library-heading">
				<div className="stu-asn-library-head">
					<div>
						<h2 id="stu-asn-library-heading">Library</h2>
						<p>
							{filtered.length}{" "}
							{filtered.length === 1 ? "assignment" : "assignments"}
							{statusFilter !== "all" || query ? " matching filters" : ""}
						</p>
					</div>
					<div className="stu-asn-library-tools">
						<div className="stu-asn-tabs" role="tablist" aria-label="Status filter">
							{(
								[
									["all", "All"],
									["dueSoon", "Due soon"],
									["active", "Active"],
									["revision", "Revision"],
									["graded", "Graded"],
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
						<div className="stu-asn-search">
							<Search size={14} aria-hidden />
							<input
								type="search"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Search by title..."
								aria-label="Search assignments"
							/>
							{query ? (
								<button
									type="button"
									className="stu-asn-search-clear"
									aria-label="Clear search"
									onClick={() => setQuery("")}
								>
									<X size={14} />
								</button>
							) : null}
						</div>
						<div className="stu-asn-view" role="group" aria-label="View mode">
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

				{rows.length === 0 ? (
					<div className="stu-asn-empty">
						<span className="stu-asn-empty-icon" aria-hidden>
							<ClipboardList size={22} />
						</span>
						<h3>No assignments yet</h3>
						<p>Start an assignment and select a published brief from your lecturer.</p>
						<Link
							href="/student/projects/new?from=assignments"
							className="stu-asn-btn stu-asn-btn-primary"
						>
							<Plus size={15} />
							Start assignment
						</Link>
					</div>
				) : filtered.length === 0 ? (
					<div className="stu-asn-empty stu-asn-empty-compact">
						<span className="stu-asn-empty-icon" aria-hidden>
							<Search size={20} />
						</span>
						<h3>No matching assignments</h3>
						<p>Try another search term or clear the status filter.</p>
						<button
							type="button"
							className="stu-asn-btn stu-asn-btn-ghost"
							onClick={() => {
								setQuery("");
								setStatusFilter("all");
							}}
						>
							Clear filters
						</button>
					</div>
				) : viewMode === "list" ? (
					<div className="stu-asn-list">
						<div className="stu-asn-list-cols" aria-hidden>
							<span>Assignment</span>
							<span>Due</span>
							<span>Lecturer</span>
							<span>Progress</span>
							<span />
						</div>
						<ul>
							{filtered.map((row) => {
								const brief = row.assignmentBrief;
								const status = assignmentStatus(row);
								const due = dueLabel(brief?.dueAt);
								const overdue = isOverdue(brief?.dueAt, status);
								const soon = isDueSoon(brief?.dueAt, status);
								const maxScore =
									typeof brief?.maxScore === "number" ? brief.maxScore : 100;
								const pct = statusProgress(status, row, maxScore);
								const courseLine = [brief?.courseName, brief?.courseYear]
									.filter(Boolean)
									.join(" · ");

								return (
									<li
										key={row._id}
										className={cn("stu-asn-row", overdue && "is-alert")}
									>
										<div className="stu-asn-row-main">
											<span className="stu-asn-row-icon" aria-hidden>
												<ClipboardList size={16} strokeWidth={1.75} />
											</span>
											<div className="stu-asn-row-copy">
												<Link href={`/student/assignments/${row._id}`}>
													{brief?.title || row.title}
												</Link>
												<p>
													{courseLine || "Coursework assignment"}
													{" · "}
													{maxScore} marks
												</p>
												<span className={cn("stu-asn-badge", `tone-${status.tone}`)}>
													{status.label}
												</span>
											</div>
										</div>
										<div
											className={cn(
												"stu-asn-row-due",
												overdue && "is-overdue",
												soon && !overdue && "is-soon",
											)}
										>
											<span className="stu-asn-mobile-label">Due</span>
											<span>
												<Calendar size={13} aria-hidden />
												{due
													? overdue
														? `Overdue · ${due}`
														: soon
															? `Soon · ${due}`
															: due
													: "No due date"}
											</span>
										</div>
										<div className="stu-asn-row-lecturer">
											<span className="stu-asn-mobile-label">Lecturer</span>
											<span>
												<UserRound size={13} aria-hidden />
												{row.supervisor?.name || "No lecturer"}
											</span>
										</div>
										<div className="stu-asn-row-progress">
											<span className="stu-asn-mobile-label">Progress</span>
											<div className="stu-asn-progress-line">
												<div className="stu-asn-progress">
													<span style={{ width: `${pct}%` }} />
												</div>
												{typeof row.score === "number" ? (
													<strong className="is-score">
														{row.score}
														<em>/{maxScore}</em>
													</strong>
												) : (
													<strong>{pct}%</strong>
												)}
											</div>
										</div>
										<div className="stu-asn-row-actions">
											<Link
												href={`/student/assignments/${row._id}`}
												className="stu-asn-btn stu-asn-btn-ghost stu-asn-btn-sm"
											>
												Open
											</Link>
										</div>
									</li>
								);
							})}
						</ul>
					</div>
				) : (
					<div className="stu-asn-grid">
						{filtered.map((row) => {
							const brief = row.assignmentBrief;
							const status = assignmentStatus(row);
							const due = dueLabel(brief?.dueAt);
							const overdue = isOverdue(brief?.dueAt, status);
							const soon = isDueSoon(brief?.dueAt, status);
							const maxScore =
								typeof brief?.maxScore === "number" ? brief.maxScore : 100;
							const pct = statusProgress(status, row, maxScore);
							const courseLine = [brief?.courseName, brief?.courseYear]
								.filter(Boolean)
								.join(" · ");

							return (
								<article
									key={row._id}
									className={cn("stu-asn-card", overdue && "is-alert")}
								>
									<div className="stu-asn-card-top">
										<span className="stu-asn-row-icon" aria-hidden>
											<ClipboardList size={16} strokeWidth={1.75} />
										</span>
										<span className={cn("stu-asn-badge", `tone-${status.tone}`)}>
											{status.label}
										</span>
									</div>
									<Link
										href={`/student/assignments/${row._id}`}
										className="stu-asn-card-title"
									>
										{brief?.title || row.title}
									</Link>
									<p className="stu-asn-card-topic">
										{courseLine || "Coursework assignment"} · {maxScore} marks
									</p>
									<p
										className={cn(
											"stu-asn-card-meta",
											overdue && "is-overdue",
											soon && !overdue && "is-soon",
										)}
									>
										<Calendar size={13} aria-hidden />
										{due
											? overdue
												? `Overdue · ${due}`
												: soon
													? `Due soon · ${due}`
													: due
											: "No due date"}
									</p>
									<p className="stu-asn-card-meta">
										<UserRound size={13} aria-hidden />
										{row.supervisor?.name || "No lecturer"}
									</p>
									<div className="stu-asn-card-progress">
										<div className="stu-asn-progress-line">
											<div className="stu-asn-progress">
												<span style={{ width: `${pct}%` }} />
											</div>
											{typeof row.score === "number" ? (
												<strong className="is-score">
													{row.score}
													<em>/{maxScore}</em>
												</strong>
											) : (
												<strong>{pct}%</strong>
											)}
										</div>
									</div>
									<Link
										href={`/student/assignments/${row._id}`}
										className="stu-asn-btn stu-asn-btn-primary stu-asn-btn-sm"
									>
										Open assignment
									</Link>
								</article>
							);
						})}
					</div>
				)}
			</section>
		</div>
	);
}
