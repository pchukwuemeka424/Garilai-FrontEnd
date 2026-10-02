"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	ArrowRight,
	BarChart3,
	BookOpen,
	ClipboardCheck,
	ClipboardList,
	Coins,
	FileText,
	Layers,
	Lightbulb,
	MessageSquareText,
	Microscope,
	ShieldCheck,
	Sparkles,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { loadAllSavedPapers } from "@/lib/chat-research-storage";
import { apiFetch } from "@/lib/portal-api";
import { loadAllSavedIdeas } from "@/lib/research-storage";
import { researchTokenAllowance } from "@/lib/student-tokens";

type WorkspaceProject = {
	_id: string;
	projectType: string;
	assignmentBrief?: { dueAt?: string | null } | null;
	pages?: Array<{ reviewStatus?: string }>;
};

function formatAcademicDate(): string {
	return new Intl.DateTimeFormat(undefined, {
		weekday: "long",
		year: "numeric",
		month: "short",
		day: "numeric",
	}).format(new Date());
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

function dueSoon(dueAt?: string | null) {
	if (!dueAt) return false;
	const t = new Date(dueAt).getTime();
	if (Number.isNaN(t)) return false;
	const now = Date.now();
	return t >= now && t - now <= 7 * 24 * 60 * 60 * 1000;
}

export function StudentDashboard() {
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);
	const [ideaCount, setIdeaCount] = useState(0);
	const [paperCount, setPaperCount] = useState(0);
	const [assignmentCount, setAssignmentCount] = useState(0);
	const [dueSoonCount, setDueSoonCount] = useState(0);
	const [revisionCount, setRevisionCount] = useState(0);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const [ideas, papers, projectList] = await Promise.all([
				loadAllSavedIdeas().catch(() => []),
				loadAllSavedPapers().catch(() => []),
				apiFetch("/api/v1/projects").catch(() => []) as Promise<WorkspaceProject[]>,
			]);

			const projects = Array.isArray(projectList) ? projectList : [];
			const assignments = projects.filter(isAssignment);

			setIdeaCount(ideas.length);
			setPaperCount(papers.length);
			setAssignmentCount(assignments.length);
			setDueSoonCount(assignments.filter((row) => dueSoon(row.assignmentBrief?.dueAt)).length);
			setRevisionCount(
				projects.filter((project) =>
					(project.pages || []).some((page) => page.reviewStatus === "needs_revision"),
				).length,
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (!user) return;
		void load();
	}, [load, user]);

	const allowance = user?.tokenQuota?.allowance ?? researchTokenAllowance(user?.role) ?? 0;
	const remaining = user?.tokenQuota?.remaining ?? allowance;
	const used = Math.max(0, allowance - remaining);
	const tokenPct = allowance > 0 ? Math.min(100, Math.round((used / allowance) * 100)) : 0;

	const programmeLine = useMemo(
		() => [user?.programme, user?.department, user?.institution].filter(Boolean).join(" · "),
		[user?.programme, user?.department, user?.institution],
	);

	if (!user) return null;

	const firstName = user.name.split(" ")[0] ?? user.name;
	const stat = (value: number) => (loading ? "—" : value.toLocaleString());

	return (
		<div className="stu-pro-dash">
			<header className="stu-pro-header">
				<div className="stu-pro-header-copy">
					<div className="stu-pro-meta">
						<span className="stu-pro-badge-live">
							<span className="stu-pro-live-dot" />
							Student workspace
						</span>
						<span className="stu-pro-date">{formatAcademicDate()}</span>
					</div>
					<h1 className="stu-pro-title">
						{getGreeting()}, {firstName}
					</h1>
					<p className="stu-pro-subtitle">
						{programmeLine
							? `${programmeLine}${user.cohort ? ` · ${user.cohort}` : ""}`
							: "Generate cited papers, capture notebook evidence, and submit work for lecturer assessment."}
					</p>
				</div>
				<div className="stu-pro-header-actions">
					<Link href="/student/research" className="stu-pro-btn-ghost">
						<Sparkles size={14} />
						<span>New synthesis</span>
					</Link>
					<Link href="/student/assignments" className="stu-pro-btn-solid">
						<span>Open assignments</span>
						<ArrowRight size={14} />
					</Link>
				</div>
			</header>

			<section className="stu-pro-kpis" aria-label="Workspace summary">
				<article className="stu-pro-kpi">
					<div className="stu-pro-kpi-top">
						<span className="stu-pro-kpi-label">Tokens remaining</span>
						<span className="stu-pro-kpi-icon stu-pro-kpi-ink" aria-hidden>
							<Coins size={15} />
						</span>
					</div>
					<p className="stu-pro-kpi-value">{remaining.toLocaleString()}</p>
					{allowance > 0 ? (
						<>
							<div className="stu-pro-kpi-bar" aria-hidden>
								<span style={{ width: `${Math.max(0, 100 - tokenPct)}%` }} />
							</div>
							<p className="stu-pro-kpi-caption">
								{used.toLocaleString()} used of {allowance.toLocaleString()}
							</p>
						</>
					) : (
						<p className="stu-pro-kpi-caption">Institutional allocation</p>
					)}
				</article>

				<article className="stu-pro-kpi">
					<div className="stu-pro-kpi-top">
						<span className="stu-pro-kpi-label">Saved ideas</span>
						<span className="stu-pro-kpi-icon stu-pro-kpi-amber" aria-hidden>
							<Lightbulb size={15} />
						</span>
					</div>
					<p className="stu-pro-kpi-value">{stat(ideaCount)}</p>
					<p className="stu-pro-kpi-caption">
						{loading ? "Loading library…" : paperCount ? `${paperCount} papers saved` : "Topic & brief bank"}
					</p>
				</article>

				<article className="stu-pro-kpi">
					<div className="stu-pro-kpi-top">
						<span className="stu-pro-kpi-label">Assessments</span>
						<span className="stu-pro-kpi-icon stu-pro-kpi-blue" aria-hidden>
							<ClipboardList size={15} />
						</span>
					</div>
					<p className="stu-pro-kpi-value">{stat(assignmentCount)}</p>
					<p className="stu-pro-kpi-caption">
						{loading
							? "Loading briefs…"
							: dueSoonCount
								? `${dueSoonCount} due this week`
								: "Active assignment briefs"}
					</p>
				</article>

				<article className="stu-pro-kpi">
					<div className="stu-pro-kpi-top">
						<span className="stu-pro-kpi-label">Feedback</span>
						<span className="stu-pro-kpi-icon stu-pro-kpi-rose" aria-hidden>
							<MessageSquareText size={15} />
						</span>
					</div>
					<p className="stu-pro-kpi-value">{stat(revisionCount)}</p>
					<Link href="/student/feedback" className="stu-pro-kpi-link">
						<span>Review remarks</span>
						<ArrowRight size={13} />
					</Link>
				</article>
			</section>

			<section className="stu-pro-modules" aria-labelledby="stu-pro-heading">
				<div className="stu-pro-section-head">
					<div>
						<h2 id="stu-pro-heading" className="stu-pro-section-title">
							Academic workspaces
						</h2>
						<p className="stu-pro-section-desc">
							Write with citations, capture empirical evidence, and submit coursework for lecturer review.
						</p>
					</div>
				</div>

				<div className="stu-pro-grid">
					<article className="stu-pro-card stu-pro-card-blue">
						<div className="stu-pro-card-head">
							<div className="stu-pro-card-icon" aria-hidden>
								<Microscope size={22} />
							</div>
							<span className="stu-pro-card-badge">Literature & writing</span>
						</div>

						<h3 className="stu-pro-card-title">Research Assistant</h3>
						<p className="stu-pro-card-desc">
							Generate literature syntheses, methodology frameworks, and cited academic papers for your programme.
						</p>

						<div className="stu-pro-tags">
							<span>APA 7th & IEEE</span>
							<span>Citation verifier</span>
							<span>DOCX / PDF</span>
						</div>

						<div className="stu-pro-workflow">
							<div className="stu-pro-workflow-head">
								<Layers size={13} />
								<span>Workflow</span>
							</div>
							<ol className="stu-pro-steps">
								<li>
									<em>1</em>
									<span>
										<strong>Scope</strong> Set discipline, inquiry questions, and assignment constraints.
									</span>
								</li>
								<li>
									<em>2</em>
									<span>
										<strong>Synthesize</strong> Draft multi-section papers with inline bibliographic anchors.
									</span>
								</li>
								<li>
									<em>3</em>
									<span>
										<strong>Export</strong> Refine wording and save citation-ready manuscripts.
									</span>
								</li>
							</ol>
						</div>

						<div className="stu-pro-card-actions">
							<Link href="/student/research" className="stu-pro-cta">
								<span>Launch Research Assistant</span>
								<ArrowRight size={15} />
							</Link>
							<div className="stu-pro-sublinks">
								<Link href="/student/research/saved">
									<FileText size={12} />
									Saved papers
								</Link>
								<Link href="/student/research">
									<Sparkles size={12} />
									New synthesis
								</Link>
							</div>
						</div>
					</article>

					<article className="stu-pro-card stu-pro-card-teal">
						<div className="stu-pro-card-head">
							<div className="stu-pro-card-icon" aria-hidden>
								<BookOpen size={22} />
							</div>
							<span className="stu-pro-card-badge">Data & visuals</span>
						</div>

						<h3 className="stu-pro-card-title">Research Notebook</h3>
						<p className="stu-pro-card-desc">
							Capture lab notes, statistical plots, and dataset tables, then embed evidence into your papers.
						</p>

						<div className="stu-pro-tags">
							<span>Statistical plots</span>
							<span>Tabular datasets</span>
							<span>Evidence linking</span>
						</div>

						<div className="stu-pro-workflow">
							<div className="stu-pro-workflow-head">
								<Layers size={13} />
								<span>Workflow</span>
							</div>
							<ol className="stu-pro-steps">
								<li>
									<em>1</em>
									<span>
										<strong>Record</strong> Log observations, field notes, and experimental results.
									</span>
								</li>
								<li>
									<em>2</em>
									<span>
										<strong>Visualize</strong> Build figures, distributions, and comparison charts.
									</span>
								</li>
								<li>
									<em>3</em>
									<span>
										<strong>Attach</strong> Link evidence blocks directly into manuscript chapters.
									</span>
								</li>
							</ol>
						</div>

						<div className="stu-pro-card-actions">
							<Link href="/student/research/notebook" className="stu-pro-cta">
								<span>Launch Research Notebook</span>
								<ArrowRight size={15} />
							</Link>
							<div className="stu-pro-sublinks">
								<Link href="/student/research/notebook">
									<BarChart3 size={12} />
									Plot generator
								</Link>
								<Link href="/student/research/notebook">
									<FileText size={12} />
									Dataset library
								</Link>
							</div>
						</div>
					</article>

					<article className="stu-pro-card stu-pro-card-rose">
						<div className="stu-pro-card-head">
							<div className="stu-pro-card-icon" aria-hidden>
								<ClipboardCheck size={22} />
							</div>
							<span className="stu-pro-card-badge">Coursework & review</span>
						</div>

						<h3 className="stu-pro-card-title">Student Assessment</h3>
						<p className="stu-pro-card-desc">
							Submit assignments, manage thesis folders, and track lecturer scores, remarks, and revision requests.
						</p>

						<div className="stu-pro-tags">
							<span>Assignment briefs</span>
							<span>Supervisor remarks</span>
							<span>Project folders</span>
						</div>

						<div className="stu-pro-workflow">
							<div className="stu-pro-workflow-head">
								<Layers size={13} />
								<span>Workflow</span>
							</div>
							<ol className="stu-pro-steps">
								<li>
									<em>1</em>
									<span>
										<strong>Brief</strong> Read the task, rubric, and submission requirements.
									</span>
								</li>
								<li>
									<em>2</em>
									<span>
										<strong>Submit</strong> Send chapters or full papers for lecturer review.
									</span>
								</li>
								<li>
									<em>3</em>
									<span>
										<strong>Revise</strong> Act on scores and feedback until approval.
									</span>
								</li>
							</ol>
						</div>

						<div className="stu-pro-card-actions">
							<Link href="/student/assistant" className="stu-pro-cta">
								<span>Launch Student Assessment</span>
								<ArrowRight size={15} />
							</Link>
							<div className="stu-pro-sublinks">
								<Link href="/student/assignments">
									<ClipboardList size={12} />
									Assignments
								</Link>
								<Link href="/student/feedback">
									<MessageSquareText size={12} />
									Feedback
								</Link>
							</div>
						</div>
					</article>
				</div>
			</section>

			<footer className="stu-pro-footer">
				<div className="stu-pro-footer-copy">
					<span className="stu-pro-footer-icon" aria-hidden>
						<ShieldCheck size={15} />
					</span>
					<p>
						Academic integrity guard active
						<span>Cited sources required · Supervisor review on submitted work</span>
					</p>
				</div>
				<nav className="stu-pro-jumps" aria-label="Quick links">
					<Link href="/student/research/saved">Saved research</Link>
					<Link href="/student/projects">Projects</Link>
					<Link href="/student/feedback">Feedback</Link>
				</nav>
			</footer>
		</div>
	);
}
