"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
	ArrowRight,
	ClipboardList,
	FilePlus2,
	FolderKanban,
	ListPlus,
} from "lucide-react";

import { AulaLayout } from "@/components/AulaLayout";
import { useFeatureAiNoticeGate } from "@/components/legal/useFeatureAiNoticeGate";
import { SUPERVISION_AI_NOTICE } from "@/lib/feature-ai-notice";
import { apiFetch } from "@/lib/portal-api";

function formatBadge(count: number) {
	return count > 99 ? "99+" : String(count);
}

function formatDate(): string {
	return new Intl.DateTimeFormat(undefined, {
		weekday: "long",
		year: "numeric",
		month: "short",
		day: "numeric",
	}).format(new Date());
}

type Overview = {
	projectCount?: number;
	assignmentCount?: number;
	submissionCount?: number;
	topicPending?: number;
};

type SupervisorProject = {
	_id: string;
	progressPercent?: number;
};

export function SupervisionAssistant() {
	const [loading, setLoading] = useState(true);
	const [overview, setOverview] = useState<Overview>({});
	const [projects, setProjects] = useState<SupervisorProject[]>([]);
	const { aiNoticeModal } = useFeatureAiNoticeGate(SUPERVISION_AI_NOTICE, "/dashboard");

	const loadData = useCallback(async () => {
		setLoading(true);

		try {
			const [overviewRes, projectsRes] = await Promise.allSettled([
				apiFetch("/api/v1/analytics/overview") as Promise<Overview>,
				apiFetch("/api/v1/projects") as Promise<SupervisorProject[]>,
			]);

			if (overviewRes.status === "fulfilled" && overviewRes.value) {
				setOverview(overviewRes.value);
			}

			if (projectsRes.status === "fulfilled" && Array.isArray(projectsRes.value)) {
				setProjects(projectsRes.value);
			}
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadData();
	}, [loadData]);

	const totalProjects = overview.projectCount ?? projects.length ?? 0;
	const totalAssignments = overview.assignmentCount ?? 0;
	const totalSubmissions = overview.submissionCount ?? 0;

	return (
		<AulaLayout showRightPanel={false}>
			<div className="supervision-hub">
				<header className="supervision-intro">
					<p className="supervision-intro-kicker">Supervision Assistant · {formatDate()}</p>
					<h1 className="supervision-intro-title">How would you like to supervise today?</h1>
					<p className="supervision-intro-subtitle">
						Review submitted work or create tasks by assigning project and assignment briefs.
					</p>
				</header>

				<section className="supervision-overview" aria-label="Project and assistant supervision">
					<article className="supervision-overview-card">
						<div className="supervision-overview-copy">
							<span className="supervision-overview-eyebrow">Review</span>
							<h2 className="supervision-overview-title">Project/ Assignment Supervision</h2>
							<p className="supervision-overview-desc">
								Open student submissions by type: long-form projects or coursework assignments.
							</p>
						</div>

						<ul className="supervision-overview-entries" aria-label="Submission types">
							<li>
								<Link href="/supervision/projects" className="supervision-overview-entry">
									<span className="supervision-overview-entry-body">
										<span className="supervision-overview-entry-icon" aria-hidden="true">
											<FolderKanban size={18} strokeWidth={1.75} />
										</span>
										<span className="supervision-overview-entry-copy">
											<span className="supervision-overview-entry-title">Submitted projects</span>
											<span className="supervision-overview-entry-meta">
												{loading
													? "Loading projects…"
													: `${formatBadge(totalProjects)} ${totalProjects === 1 ? "project" : "projects"} in review`}
											</span>
										</span>
									</span>
									<span className="supervision-overview-entry-aside">
										<span className="supervision-overview-entry-count">
											{loading ? "…" : formatBadge(totalProjects)}
										</span>
										<span className="supervision-overview-entry-action">
											Open
											<ArrowRight size={15} />
										</span>
									</span>
								</Link>
							</li>
							<li>
								<Link href="/assignments" className="supervision-overview-entry">
									<span className="supervision-overview-entry-body">
										<span className="supervision-overview-entry-icon" aria-hidden="true">
											<ClipboardList size={18} strokeWidth={1.75} />
										</span>
										<span className="supervision-overview-entry-copy">
											<span className="supervision-overview-entry-title">Submitted assignments</span>
											<span className="supervision-overview-entry-meta">
												{loading
													? "Loading assignments…"
													: `${formatBadge(totalSubmissions)} ${totalSubmissions === 1 ? "submission" : "submissions"} · ${formatBadge(totalAssignments)} ${totalAssignments === 1 ? "brief" : "briefs"}`}
											</span>
										</span>
									</span>
									<span className="supervision-overview-entry-aside">
										<span className="supervision-overview-entry-count">
											{loading ? "…" : formatBadge(totalSubmissions)}
										</span>
										<span className="supervision-overview-entry-action">
											Open
											<ArrowRight size={15} />
										</span>
									</span>
								</Link>
							</li>
						</ul>
					</article>

					<article className="supervision-overview-card">
						<div className="supervision-overview-copy">
							<span className="supervision-overview-eyebrow">Create</span>
							<h2 className="supervision-overview-title">Assign a Brief</h2>
							<p className="supervision-overview-desc">
								Publish a new project brief or assignment brief for your students.
							</p>
						</div>

						<ul className="supervision-overview-entries" aria-label="Create task options">
							<li>
								<Link href="/supervision/projects" className="supervision-overview-entry">
									<span className="supervision-overview-entry-body">
										<span className="supervision-overview-entry-icon" aria-hidden="true">
											<FilePlus2 size={18} strokeWidth={1.75} />
										</span>
										<span className="supervision-overview-entry-copy">
											<span className="supervision-overview-entry-title">Assign project brief</span>
											<span className="supervision-overview-entry-meta">
												Theses, dissertations, and research folders
											</span>
										</span>
									</span>
									<span className="supervision-overview-entry-action">
										Assign
										<ArrowRight size={15} />
									</span>
								</Link>
							</li>
							<li>
								<Link href="/supervision/assignments" className="supervision-overview-entry">
									<span className="supervision-overview-entry-body">
										<span className="supervision-overview-entry-icon" aria-hidden="true">
											<ListPlus size={18} strokeWidth={1.75} />
										</span>
										<span className="supervision-overview-entry-copy">
											<span className="supervision-overview-entry-title">Assign assignment brief</span>
											<span className="supervision-overview-entry-meta">
												Create, edit, or delete assignment briefs
											</span>
										</span>
									</span>
									<span className="supervision-overview-entry-action">
										Manage
										<ArrowRight size={15} />
									</span>
								</Link>
							</li>
						</ul>
					</article>
				</section>
			</div>
			{aiNoticeModal}
		</AulaLayout>
	);
}
