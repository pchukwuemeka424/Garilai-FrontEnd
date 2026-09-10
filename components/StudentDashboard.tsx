"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
	ArrowRight,
	BarChart3,
	BookOpen,
	ClipboardCheck,
	ClipboardList,
	Coins,
	FileText,
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

function WorkspaceCard({
	tone,
	icon,
	badge,
	title,
	description,
	tags,
	steps,
	href,
	cta,
	links,
}: {
	tone: "blue" | "teal" | "purple";
	icon: ReactNode;
	badge: string;
	title: string;
	description: string;
	tags: string[];
	steps: Array<{ label: string; hint: string }>;
	href: string;
	cta: string;
	links: Array<{ href: string; label: string; icon: ReactNode }>;
}) {
	return (
		<article className={`stu-hub-card stu-hub-card-${tone}`}>
			<div className="stu-hub-card-head">
				<div className="stu-hub-card-icon" aria-hidden>
					{icon}
				</div>
				<span className="stu-hub-badge">{badge}</span>
			</div>
			<h3 className="stu-hub-card-title">{title}</h3>
			<p className="stu-hub-card-desc">{description}</p>
			<div className="stu-hub-tags">
				{tags.map((tag) => (
					<span key={tag}>{tag}</span>
				))}
			</div>
			<ol className="stu-hub-path">
				{steps.map((step, index) => (
					<li key={step.label}>
						<em>{index + 1}</em>
						<strong>{step.label}</strong>
						<span>{step.hint}</span>
					</li>
				))}
			</ol>
			<Link href={href} className="stu-hub-cta">
				<span>{cta}</span>
				<ArrowRight size={15} />
			</Link>
			<div className="stu-hub-links">
				{links.map((link) => (
					<Link key={link.href + link.label} href={link.href}>
						{link.icon}
						{link.label}
					</Link>
				))}
			</div>
		</article>
	);
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
		<div className="stu-hub">
			<header className="stu-hub-header">
				<div className="stu-hub-header-copy">
					<div className="stu-hub-meta">
						<span className="stu-hub-live-badge">
							<span className="stu-hub-live-dot" />
							Student workspace
						</span>
						<span className="stu-hub-date">{formatAcademicDate()}</span>
					</div>
					<h1 className="stu-hub-title">
						{getGreeting()}, {firstName}
					</h1>
					<p className="stu-hub-subtitle">
						{programmeLine
							? `${programmeLine}${user.cohort ? ` · ${user.cohort}` : ""}`
							: "Generate cited papers, capture notebook evidence, and submit work for lecturer assessment."}
					</p>
				</div>

				<div className="stu-hub-stats" aria-label="Workspace summary">
					<div className="stu-hub-stat">
						<span className="stu-hub-stat-icon stu-hub-stat-navy" aria-hidden>
							<Coins size={14} />
						</span>
						<div>
							<strong>{remaining.toLocaleString()}</strong>
							<em>Tokens left</em>
						</div>
						{allowance > 0 ? (
							<div className="stu-hub-stat-bar" aria-hidden>
								<span style={{ width: `${Math.max(0, 100 - tokenPct)}%` }} />
							</div>
						) : null}
					</div>
					<div className="stu-hub-stat">
						<span className="stu-hub-stat-icon stu-hub-stat-amber" aria-hidden>
							<Lightbulb size={14} />
						</span>
						<div>
							<strong>{stat(ideaCount)}</strong>
							<em>{paperCount ? `${paperCount} papers` : "Saved ideas"}</em>
						</div>
					</div>
					<div className="stu-hub-stat">
						<span className="stu-hub-stat-icon stu-hub-stat-blue" aria-hidden>
							<ClipboardList size={14} />
						</span>
						<div>
							<strong>{stat(assignmentCount)}</strong>
							<em>{dueSoonCount ? `${dueSoonCount} due this week` : "Assessments"}</em>
						</div>
					</div>
					<div className="stu-hub-stat">
						<span className="stu-hub-stat-icon stu-hub-stat-purple" aria-hidden>
							<MessageSquareText size={14} />
						</span>
						<div>
							<strong>{stat(revisionCount)}</strong>
							<em>Feedback</em>
						</div>
					</div>
				</div>
			</header>

			<section className="stu-hub-modules" aria-labelledby="stu-hub-heading">
				<div className="stu-hub-section-head">
					<h2 id="stu-hub-heading">Your academic tools</h2>
					<p>Open a workspace to write, record evidence, or submit assessed coursework.</p>
				</div>

				<div className="stu-hub-grid">
					<WorkspaceCard
						tone="blue"
						icon={<Microscope size={22} />}
						badge="Literature & writing"
						title="Research Assistant"
						description="Generate literature syntheses, methodology frameworks, and cited academic papers for your programme."
						tags={["APA 7th & IEEE", "Citation verifier", "DOCX / PDF"]}
						steps={[
							{ label: "Scope", hint: "Set the brief" },
							{ label: "Synthesize", hint: "Cite sources" },
							{ label: "Export", hint: "Refine & save" },
						]}
						href="/student/research"
						cta="Launch Research Assistant"
						links={[
							{ href: "/student/research/saved", label: "Saved papers", icon: <FileText size={12} /> },
							{ href: "/student/research", label: "New synthesis", icon: <Sparkles size={12} /> },
						]}
					/>

					<WorkspaceCard
						tone="teal"
						icon={<BookOpen size={22} />}
						badge="Data & visuals"
						title="Research Notebook"
						description="Capture lab notes, statistical plots, and dataset tables, then embed evidence into your papers."
						tags={["Statistical plots", "Tabular datasets", "Evidence linking"]}
						steps={[
							{ label: "Record", hint: "Log evidence" },
							{ label: "Visualize", hint: "Build figures" },
							{ label: "Attach", hint: "Link to writing" },
						]}
						href="/student/research/notebook"
						cta="Launch Research Notebook"
						links={[
							{ href: "/student/research/notebook", label: "Plot generator", icon: <BarChart3 size={12} /> },
							{ href: "/student/research/notebook", label: "Dataset library", icon: <FileText size={12} /> },
						]}
					/>

					<WorkspaceCard
						tone="purple"
						icon={<ClipboardCheck size={22} />}
						badge="Coursework & review"
						title="Student Assessment"
						description="Submit assignments, manage thesis folders, and track lecturer scores, remarks, and revision requests."
						tags={["Assignment briefs", "Supervisor remarks", "Project folders"]}
						steps={[
							{ label: "Brief", hint: "Read the task" },
							{ label: "Submit", hint: "Send for review" },
							{ label: "Revise", hint: "Act on scores" },
						]}
						href="/student/assistant"
						cta="Launch Student Assessment"
						links={[
							{ href: "/student/assignments", label: "Assignments", icon: <ClipboardList size={12} /> },
							{ href: "/student/feedback", label: "Feedback", icon: <MessageSquareText size={12} /> },
						]}
					/>
				</div>
			</section>

			<footer className="stu-hub-footer">
				<div className="stu-hub-footer-copy">
					<span className="stu-hub-footer-icon" aria-hidden>
						<ShieldCheck size={15} />
					</span>
					<p>
						Academic integrity guard active
						<em>Cited sources required · Supervisor review on submitted work</em>
					</p>
				</div>
				<nav className="stu-hub-jumps" aria-label="Quick links">
					<Link href="/student/research/saved">Saved research</Link>
					<Link href="/student/projects">Projects</Link>
					<Link href="/student/feedback">Feedback</Link>
				</nav>
			</footer>
		</div>
	);
}
