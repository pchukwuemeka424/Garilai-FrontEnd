"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	ArrowRight,
	BarChart3,
	BookOpenCheck,
	Flame,
	FolderKanban,
	GraduationCap,
	TrendingUp,
	Users,
} from "lucide-react";

import { AulaLayout } from "@/components/AulaLayout";
import { apiFetch } from "@/lib/portal-api";

function formatBadge(count: number) {
	return count > 99 ? "99+" : String(count);
}

type StudentInfo = {
	id: string;
	name: string;
	email: string;
};

type SupervisorProject = {
	_id: string;
	title: string;
	projectType: string;
	progressPercent?: number;
	topicStatus?: string;
	status?: string;
	stage?: string;
	topic?: string;
	updatedAt?: string;
	studentId?: string;
	student: StudentInfo | null;
};

type PendingReview = {
	_id: string;
	title: string;
	number: number;
	status: string;
	updatedAt?: string;
	projectId: string;
	projectTitle: string;
	student: StudentInfo | null;
};

type Supervisee = {
	id: string;
	name: string;
	email: string;
	projects: unknown[];
	progress: number;
};

type Overview = {
	projectCount?: number;
	assignmentCount?: number;
	submissionCount?: number;
	studentCount?: number;
	pendingReviews?: number;
	progressBuckets?: {
		low: number;
		mid: number;
		high: number;
	};
	topicPending?: number;
};

export function SupervisionAssistant() {
	const [loading, setLoading] = useState(true);

	const [overview, setOverview] = useState<Overview>({});
	const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
	const [projects, setProjects] = useState<SupervisorProject[]>([]);
	const [students, setStudents] = useState<Supervisee[]>([]);

	const loadData = useCallback(async () => {
		setLoading(true);

		try {
			const [overviewRes, reviewsRes, projectsRes, studentsRes] =
				await Promise.allSettled([
					apiFetch("/api/v1/analytics/overview") as Promise<Overview>,
					apiFetch("/api/v1/supervisor/reviews") as Promise<PendingReview[]>,
					apiFetch("/api/v1/projects") as Promise<SupervisorProject[]>,
					apiFetch("/api/v1/students") as Promise<Supervisee[]>,
				]);

			if (overviewRes.status === "fulfilled" && overviewRes.value) {
				setOverview(overviewRes.value);
			}

			if (reviewsRes.status === "fulfilled" && Array.isArray(reviewsRes.value)) {
				setPendingReviews(reviewsRes.value);
			}

			if (projectsRes.status === "fulfilled" && Array.isArray(projectsRes.value)) {
				setProjects(projectsRes.value);
			}

			if (studentsRes.status === "fulfilled" && Array.isArray(studentsRes.value)) {
				setStudents(studentsRes.value);
			}
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	// Counts
	const totalProjects = overview.projectCount ?? projects.length ?? 0;
	const totalBriefs = overview.assignmentCount ?? 0;
	const totalSubmissions = overview.submissionCount ?? 0;
	const totalStudents = overview.studentCount ?? students.length ?? 0;
	const pendingReviewCount = overview.pendingReviews ?? pendingReviews.length ?? 0;
	const topicPendingCount = overview.topicPending ?? 0;

	// Progress Average
	const avgProgress = useMemo(() => {
		if (projects.length === 0) return 0;
		const sum = projects.reduce((acc, p) => acc + (Number(p.progressPercent) || 0), 0);
		return Math.round(sum / projects.length);
	}, [projects]);

	// Buckets
	const buckets = overview.progressBuckets || {
		low: projects.filter((p) => (p.progressPercent ?? 0) < 30).length,
		mid: projects.filter(
			(p) => (p.progressPercent ?? 0) >= 30 && (p.progressPercent ?? 0) < 70,
		).length,
		high: projects.filter((p) => (p.progressPercent ?? 0) >= 70).length,
	};
	const totalBucketCount = (buckets.low + buckets.mid + buckets.high) || 1;
	const highPct = Math.round((buckets.high / totalBucketCount) * 100);

	return (
		<AulaLayout showRightPanel={false}>
			<div className="supervision-hub">
				{/* KPI Metrics Row */}
				<section className="supervision-kpi-grid" aria-label="Supervision Key Metrics">
					{/* 1. Assignments */}
					<Link href="/assignments" className="supervision-kpi-card supervision-kpi-card--violet">
						<div className="supervision-kpi-header">
							<span className="supervision-kpi-label">Assignments & Briefs</span>
							<span className="supervision-kpi-icon-pill">
								<GraduationCap size={16} />
							</span>
						</div>
						<div className="supervision-kpi-val-row">
							<span className="supervision-kpi-value">{loading ? "…" : totalBriefs}</span>
						</div>
						<div className="supervision-kpi-hint">
							{totalSubmissions > 0
								? `${totalSubmissions} student ${totalSubmissions === 1 ? "submission" : "submissions"}`
								: "Published coursework briefs"}
						</div>
					</Link>

					{/* 2. Projects */}
					<Link href="/supervision/projects" className="supervision-kpi-card supervision-kpi-card--amber">
						<div className="supervision-kpi-header">
							<span className="supervision-kpi-label">Supervised Projects</span>
							<span className="supervision-kpi-icon-pill">
								<FolderKanban size={16} />
							</span>
						</div>
						<div className="supervision-kpi-val-row">
							<span className="supervision-kpi-value">{loading ? "…" : totalProjects}</span>
						</div>
						<div className="supervision-kpi-hint">
							{topicPendingCount > 0
								? `${topicPendingCount} topic ${topicPendingCount === 1 ? "sign-off" : "sign-offs"} pending`
								: "Active supervisee folders"}
						</div>
					</Link>

					{/* 3. Supervisees */}
					<Link href="/students" className="supervision-kpi-card supervision-kpi-card--teal">
						<div className="supervision-kpi-header">
							<span className="supervision-kpi-label">Supervisees</span>
							<span className="supervision-kpi-icon-pill">
								<Users size={16} />
							</span>
						</div>
						<div className="supervision-kpi-val-row">
							<span className="supervision-kpi-value">{loading ? "…" : totalStudents}</span>
						</div>
						<div className="supervision-kpi-hint">Assigned students on roster</div>
					</Link>

					{/* 4. Reviews */}
					<Link
						href="/reviews"
						className={`supervision-kpi-card ${pendingReviewCount > 0 ? "supervision-kpi-card--rose supervision-kpi-alert" : "supervision-kpi-card--emerald"}`}
					>
						<div className="supervision-kpi-header">
							<span className="supervision-kpi-label">Pending Reviews</span>
							<span className="supervision-kpi-icon-pill">
								<BookOpenCheck size={16} />
							</span>
						</div>
						<div className="supervision-kpi-val-row">
							<span className="supervision-kpi-value">{loading ? "…" : pendingReviewCount}</span>
							{pendingReviewCount > 0 ? (
								<span className="supervision-kpi-alert-badge">
									<Flame size={12} />
									Action req.
								</span>
							) : null}
						</div>
						<div className="supervision-kpi-hint">
							{pendingReviewCount > 0
								? `${pendingReviewCount} chapter ${pendingReviewCount === 1 ? "draft" : "drafts"} awaiting sign-off`
								: "Review queue is all clear"}
						</div>
					</Link>

					{/* 5. Cohort Velocity */}
					<Link href="/analytics" className="supervision-kpi-card supervision-kpi-card--navy">
						<div className="supervision-kpi-header">
							<span className="supervision-kpi-label">Avg Cohort Progress</span>
							<span className="supervision-kpi-icon-pill">
								<BarChart3 size={16} />
							</span>
						</div>
						<div className="supervision-kpi-val-row">
							<span className="supervision-kpi-value">{loading ? "…" : `${avgProgress}%`}</span>
						</div>
						<div className="supervision-kpi-hint">
							<TrendingUp size={13} />
							{buckets.high} on track ({highPct}%)
						</div>
					</Link>
				</section>

				{/* Core Supervision Suites */}
				<section aria-labelledby="supervision-suites-heading">
					<div className="supervision-tools-section-head">
						<div>
							<h2 id="supervision-suites-heading" className="supervision-tools-title">
								Supervision Workspaces
							</h2>
							<p className="supervision-tools-subtitle">
								Publish briefs, supervise projects, manage supervisees, and review locked chapters.
							</p>
						</div>
					</div>

					<div className="supervision-suites-grid">
						{/* 1. Assignments */}
						<Link href="/assignments" className="supervision-suite-card">
							<div className="supervision-suite-top">
								<div
									className="supervision-suite-icon-box"
									style={{ background: "rgba(124, 58, 237, 0.1)", color: "#7c3aed" }}
								>
									<GraduationCap size={22} />
								</div>
								<div className="supervision-suite-top-meta">
									<span
										className="supervision-suite-pill"
										style={{ background: "rgba(124, 58, 237, 0.1)", color: "#7c3aed" }}
									>
										Grading & Briefs
									</span>
									<span
										className="aula-dash-count-badge"
										aria-label={`${totalBriefs} ${totalBriefs === 1 ? "brief" : "briefs"}`}
									>
										{loading ? "…" : formatBadge(totalBriefs)}
									</span>
								</div>
							</div>
							<div className="supervision-suite-body">
								<h3 className="supervision-suite-title">Assignments</h3>
								<p className="supervision-suite-desc">
									Publish coursework briefs, review student draft submissions, score rubrics, and export grades.
								</p>
							</div>
							<div className="supervision-suite-footer">
								<span className="supervision-suite-stat">
									{totalBriefs} {totalBriefs === 1 ? "brief" : "briefs"}
									{totalSubmissions > 0
										? ` · ${totalSubmissions} ${totalSubmissions === 1 ? "submission" : "submissions"}`
										: ""}
								</span>
								<span className="supervision-suite-open">
									Open Briefs <ArrowRight size={14} />
								</span>
							</div>
						</Link>

						{/* 2. Projects */}
						<Link href="/supervision/projects" className="supervision-suite-card">
							<div className="supervision-suite-top">
								<div
									className="supervision-suite-icon-box"
									style={{ background: "rgba(217, 119, 6, 0.12)", color: "#b45309" }}
								>
									<FolderKanban size={22} />
								</div>
								<div className="supervision-suite-top-meta">
									<span
										className="supervision-suite-pill"
										style={{ background: "rgba(217, 119, 6, 0.12)", color: "#b45309" }}
									>
										Theses & Folders
									</span>
									<span
										className={
											topicPendingCount > 0 ? "aula-notify-badge" : "aula-dash-count-badge"
										}
										aria-label={
											topicPendingCount > 0
												? `${topicPendingCount} topic ${topicPendingCount === 1 ? "sign-off" : "sign-offs"} pending`
												: `${totalProjects} ${totalProjects === 1 ? "project" : "projects"}`
										}
									>
										{loading
											? "…"
											: formatBadge(topicPendingCount > 0 ? topicPendingCount : totalProjects)}
									</span>
								</div>
							</div>
							<div className="supervision-suite-body">
								<h3 className="supervision-suite-title">Projects</h3>
								<p className="supervision-suite-desc">
									Supervise theses, dissertations, and student research folders with chapter approvals and TipTap editing.
								</p>
							</div>
							<div className="supervision-suite-footer">
								<span className="supervision-suite-stat">
									{totalProjects} {totalProjects === 1 ? "project" : "projects"}
									{topicPendingCount > 0
										? ` · ${topicPendingCount} topic ${topicPendingCount === 1 ? "sign-off" : "sign-offs"} pending`
										: ""}
								</span>
								<span className="supervision-suite-open">
									Open Hub <ArrowRight size={14} />
								</span>
							</div>
						</Link>

						{/* 3. Supervisees */}
						<Link href="/students" className="supervision-suite-card">
							<div className="supervision-suite-top">
								<div
									className="supervision-suite-icon-box"
									style={{ background: "rgba(13, 148, 136, 0.12)", color: "#0f766e" }}
								>
									<Users size={22} />
								</div>
								<div className="supervision-suite-top-meta">
									<span
										className="supervision-suite-pill"
										style={{ background: "rgba(13, 148, 136, 0.12)", color: "#0f766e" }}
									>
										Cohort Directory
									</span>
									<span
										className="aula-dash-count-badge"
										aria-label={`${totalStudents} ${totalStudents === 1 ? "student" : "students"}`}
									>
										{loading ? "…" : formatBadge(totalStudents)}
									</span>
								</div>
							</div>
							<div className="supervision-suite-body">
								<h3 className="supervision-suite-title">Supervisees</h3>
								<p className="supervision-suite-desc">
									Track supervisee milestone velocity, view individual chapter submissions, and monitor engagement.
								</p>
							</div>
							<div className="supervision-suite-footer">
								<span className="supervision-suite-stat">
									{totalStudents} {totalStudents === 1 ? "student" : "students"}
								</span>
								<span className="supervision-suite-open">
									Open Roster <ArrowRight size={14} />
								</span>
							</div>
						</Link>

						{/* 4. Reviews */}
						<Link href="/reviews" className="supervision-suite-card">
							<div className="supervision-suite-top">
								<div
									className="supervision-suite-icon-box"
									style={{ background: "rgba(5, 150, 105, 0.12)", color: "#059669" }}
								>
									<BookOpenCheck size={22} />
								</div>
								<div className="supervision-suite-top-meta">
									<span
										className="supervision-suite-pill"
										style={{
											background: pendingReviewCount > 0 ? "#fee2e2" : "rgba(5, 150, 105, 0.12)",
											color: pendingReviewCount > 0 ? "#dc2626" : "#059669",
										}}
									>
										{pendingReviewCount > 0 ? "Action Needed" : "Feedback Studio"}
									</span>
									{loading ? (
										<span className="aula-dash-count-badge" aria-label="Loading pending reviews">
											…
										</span>
									) : pendingReviewCount > 0 ? (
										<span
											className="aula-notify-badge"
											aria-label={`${pendingReviewCount} pending reviews`}
										>
											{formatBadge(pendingReviewCount)}
										</span>
									) : (
										<span className="aula-dash-count-badge" aria-label="0 pending reviews">
											0
										</span>
									)}
								</div>
							</div>
							<div className="supervision-suite-body">
								<h3 className="supervision-suite-title">Reviews</h3>
								<p className="supervision-suite-desc">
									Annotate locked student chapters, run AI rubric pre-checks, score criteria, and return governed feedback.
								</p>
							</div>
							<div className="supervision-suite-footer">
								<span className="supervision-suite-stat">
									{pendingReviewCount > 0 ? `${pendingReviewCount} pending` : "Queue clear"}
								</span>
								<span className="supervision-suite-open">
									Open Reviews <ArrowRight size={14} />
								</span>
							</div>
						</Link>
					</div>
				</section>
			</div>
		</AulaLayout>
	);
}
