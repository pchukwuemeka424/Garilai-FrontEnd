"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
	ArrowRight,
	BarChart3,
	BookOpen,
	CheckCircle2,
	Coins,
	FileText,
	GraduationCap,
	Layers,
	Library,
	Lightbulb,
	Microscope,
	ShieldCheck,
	Sparkles,
} from "lucide-react";

import { AulaLayout } from "@/components/AulaLayout";
import { useAuth } from "@/hooks/useAuth";
import { loadAllSavedPapers, type SavedResearchPaper } from "@/lib/chat-research-storage";
import { loadAllSavedIdeas, type SavedIdea } from "@/lib/research-storage";
import { researchTokenAllowance } from "@/lib/student-tokens";

function formatAcademicDate(): string {
	return new Intl.DateTimeFormat(undefined, {
		weekday: "long",
		year: "numeric",
		month: "short",
		day: "numeric",
	}).format(new Date());
}

export function AulaDashboard() {
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);
	const [ideas, setIdeas] = useState<SavedIdea[]>([]);
	const [papers, setPapers] = useState<SavedResearchPaper[]>([]);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const [ideaRows, paperRows] = await Promise.all([
				loadAllSavedIdeas().catch(() => [] as SavedIdea[]),
				loadAllSavedPapers().catch(() => [] as SavedResearchPaper[]),
			]);
			setIdeas(ideaRows);
			setPapers(paperRows);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (!user) return;
		void load();
	}, [load, user]);

	const allowance = user?.tokenQuota?.allowance ?? researchTokenAllowance(user?.role ?? "lecturer") ?? 0;
	const remaining = user?.tokenQuota?.remaining ?? allowance;
	const used = Math.max(0, allowance - remaining);
	const tokenPct = allowance > 0 ? Math.min(100, Math.round((used / allowance) * 100)) : 0;

	if (!user) return null;

	const isStudent = user.role === "student";
	const researchHref = isStudent ? "/student/research" : "/research";

	return (
		<AulaLayout showRightPanel={false}>
			<div className="aula-pro-dash">
				{/* Top Executive Header */}
				<header className="aula-pro-header">
					<div className="aula-pro-header-copy">
						<div className="aula-pro-meta-bar">
							<span className="aula-pro-node-badge">
								<span className="aula-pro-live-dot" />
								Academic Node Active
							</span>
							<span className="aula-pro-date">{formatAcademicDate()}</span>
						</div>
						<h1 className="aula-pro-title">Institutional Research & Supervision Workspace</h1>
						<p className="aula-pro-subtitle">
							Governed AI ecosystem for academic literature synthesis, empirical notebook analysis, and supervised thesis management.
						</p>
					</div>
				</header>

				{/* Solid KPI Metrics Strip */}
				<section className="aula-pro-kpis" aria-label="System Metrics Summary">
					{/* KPI 1: Tokens / Compute */}
					<article className="aula-pro-kpi-card">
						<div>
							<div className="aula-pro-kpi-top">
								<span className="aula-pro-kpi-label">Compute Tokens</span>
								<div className="aula-pro-kpi-icon kpi-icon-navy">
									<Coins size={16} />
								</div>
							</div>
							<p className="aula-pro-kpi-value">{remaining.toLocaleString()}</p>
							{allowance > 0 ? (
								<div className="aula-pro-kpi-bar" aria-hidden>
									<span
										className="aula-pro-kpi-bar-fill"
										style={{ width: `${100 - tokenPct}%` }}
									/>
								</div>
							) : null}
						</div>
						<p className="aula-pro-kpi-caption">
							{allowance > 0
								? `${used.toLocaleString()} used of ${allowance.toLocaleString()} quota`
								: "Institutional allocation unlimited"}
						</p>
					</article>

					{/* KPI 2: Saved Ideas */}
					<article className="aula-pro-kpi-card">
						<div>
							<div className="aula-pro-kpi-top">
								<span className="aula-pro-kpi-label">Research Hypotheses</span>
								<div className="aula-pro-kpi-icon kpi-icon-amber">
									<Lightbulb size={16} />
								</div>
							</div>
							<p className="aula-pro-kpi-value">{loading ? "—" : ideas.length}</p>
						</div>
						<p className="aula-pro-kpi-caption">Structured topic & brief bank</p>
					</article>

					{/* KPI 3: Research Papers */}
					<article className="aula-pro-kpi-card">
						<div>
							<div className="aula-pro-kpi-top">
								<span className="aula-pro-kpi-label">Synthesized Papers</span>
								<div className="aula-pro-kpi-icon kpi-icon-blue">
									<FileText size={16} />
								</div>
							</div>
							<p className="aula-pro-kpi-value">{loading ? "—" : papers.length}</p>
						</div>
						<p className="aula-pro-kpi-caption">Cited drafts and published exports</p>
					</article>

					{/* KPI 4: Total Library Repository */}
					<article className="aula-pro-kpi-card">
						<div>
							<div className="aula-pro-kpi-top">
								<span className="aula-pro-kpi-label">Total Documents</span>
								<div className="aula-pro-kpi-icon kpi-icon-purple">
									<Library size={16} />
								</div>
							</div>
							<p className="aula-pro-kpi-value">
								{loading ? "—" : (ideas.length + papers.length).toLocaleString()}
							</p>
						</div>
						<Link href="/research/saved" className="aula-pro-kpi-link">
							<span>Open Academic Library</span>
							<ArrowRight size={13} />
						</Link>
					</article>
				</section>

				{/* 3 Core Functional Workspace Cards */}
				<section className="aula-pro-modules-section" aria-labelledby="aula-pro-hub-heading">
					<div className="aula-pro-section-header">
						<div>
							<h2 id="aula-pro-hub-heading" className="aula-pro-section-title">
								Core Academic Engines
							</h2>
							<p className="aula-pro-section-desc">
								Governed AI modules for literature synthesis, empirical lab data, and postgraduate thesis supervision.
							</p>
						</div>
					</div>

					<div className="aula-pro-grid">
						{/* Module 1: Research Assistant */}
						<article className="aula-pro-card card-blue">
							<div className="aula-pro-card-head">
								<div className="aula-pro-card-icon">
									<Microscope size={24} />
								</div>
								<span className="aula-pro-badge">Literature & Writing</span>
							</div>

							<h3 className="aula-pro-card-title">Research Assistant</h3>
							<p className="aula-pro-card-desc">
								Generate deep literature syntheses, methodology frameworks, and academic papers backed by verifiable institutional citations.
							</p>

							{/* Capabilities */}
							<div className="aula-pro-tags">
								<span className="aula-pro-tag">APA 7th & IEEE</span>
								<span className="aula-pro-tag">Citation Verifier</span>
								<span className="aula-pro-tag">DOCX / PDF</span>
							</div>

							{/* 3-Step Systematic Workflow */}
							<div className="aula-pro-workflow">
								<div className="aula-pro-workflow-head">
									<Layers size={13} />
									<span>Systematic Workflow</span>
								</div>
								<ol className="aula-pro-steps">
									<li className="aula-pro-step">
										<span className="aula-pro-step-num">1</span>
										<div className="aula-pro-step-text">
											<strong className="aula-pro-step-title">Scope & Hypothesis:</strong>
											Select academic discipline, set inquiry questions, or import assignment rubrics.
										</div>
									</li>
									<li className="aula-pro-step">
										<span className="aula-pro-step-num">2</span>
										<div className="aula-pro-step-text">
											<strong className="aula-pro-step-title">Synthesis & Citations:</strong>
											Synthesize deep multi-chapter drafts with inline bibliographic anchors.
										</div>
									</li>
									<li className="aula-pro-step">
										<span className="aula-pro-step-num">3</span>
										<div className="aula-pro-step-text">
											<strong className="aula-pro-step-title">Review & Dissemination:</strong>
											Export publication-ready manuscripts with verified source banks.
										</div>
									</li>
								</ol>
							</div>

							<div className="aula-pro-card-actions">
								<Link href={researchHref} className="aula-pro-cta-btn">
									<span>Launch Research Assistant</span>
									<ArrowRight size={15} />
								</Link>
								<div className="aula-pro-sublinks">
									<Link href="/research/saved" className="aula-pro-sublink">
										<FileText size={12} />
										<span>Saved Papers</span>
									</Link>
									<Link href={researchHref} className="aula-pro-sublink">
										<Sparkles size={12} />
										<span>New Synthesis</span>
									</Link>
								</div>
							</div>
						</article>

						{/* Module 2: Research Notebook */}
						<article className="aula-pro-card card-teal">
							<div className="aula-pro-card-head">
								<div className="aula-pro-card-icon">
									<BookOpen size={24} />
								</div>
								<span className="aula-pro-badge">Data & Visuals</span>
							</div>

							<h3 className="aula-pro-card-title">Research Notebook</h3>
							<p className="aula-pro-card-desc">
								Record lab data, generate dynamic statistical plots, format analytical tables, and link empirical evidence to papers.
							</p>

							{/* Capabilities */}
							<div className="aula-pro-tags">
								<span className="aula-pro-tag">Statistical Plots</span>
								<span className="aula-pro-tag">Tabular Datasets</span>
								<span className="aula-pro-tag">Evidence Linking</span>
							</div>

							{/* 3-Step Systematic Workflow */}
							<div className="aula-pro-workflow">
								<div className="aula-pro-workflow-head">
									<Layers size={13} />
									<span>Systematic Workflow</span>
								</div>
								<ol className="aula-pro-steps">
									<li className="aula-pro-step">
										<span className="aula-pro-step-num">1</span>
										<div className="aula-pro-step-text">
											<strong className="aula-pro-step-title">Data Ingestion:</strong>
											Record empirical field observations, experimental data, or literature excerpts.
										</div>
									</li>
									<li className="aula-pro-step">
										<span className="aula-pro-step-num">2</span>
										<div className="aula-pro-step-text">
											<strong className="aula-pro-step-title">Statistical Charts:</strong>
											Render interactive boxplots, distribution models, and comparison figures.
										</div>
									</li>
									<li className="aula-pro-step">
										<span className="aula-pro-step-num">3</span>
										<div className="aula-pro-step-text">
											<strong className="aula-pro-step-title">Manuscript Embedding:</strong>
											Insert visual figure assets and dataset blocks directly into paper chapters.
										</div>
									</li>
								</ol>
							</div>

							<div className="aula-pro-card-actions">
								<Link href="/research/notebook" className="aula-pro-cta-btn">
									<span>Launch Research Notebook</span>
									<ArrowRight size={15} />
								</Link>
								<div className="aula-pro-sublinks">
									<Link href="/research/notebook" className="aula-pro-sublink">
										<BarChart3 size={12} />
										<span>Plot Generator</span>
									</Link>
									<Link href="/research/notebook" className="aula-pro-sublink">
										<FileText size={12} />
										<span>Dataset Library</span>
									</Link>
								</div>
							</div>
						</article>

						{/* Module 3: Supervision Assistant */}
						<article className="aula-pro-card card-purple">
							<div className="aula-pro-card-head">
								<div className="aula-pro-card-icon">
									<GraduationCap size={24} />
								</div>
								<span className="aula-pro-badge">Supervision & Review</span>
							</div>

							<h3 className="aula-pro-card-title">Supervision Assistant</h3>
							<p className="aula-pro-card-desc">
								Supervise undergraduate and postgraduate dissertations, annotate drafts with AI feedback, and manage assignment scoring.
							</p>

							{/* Capabilities */}
							<div className="aula-pro-tags">
								<span className="aula-pro-tag">Inline Annotations</span>
								<span className="aula-pro-tag">Grading Rubrics</span>
								<span className="aula-pro-tag">Thesis Folders</span>
							</div>

							{/* 3-Step Systematic Workflow */}
							<div className="aula-pro-workflow">
								<div className="aula-pro-workflow-head">
									<Layers size={13} />
									<span>Systematic Workflow</span>
								</div>
								<ol className="aula-pro-steps">
									<li className="aula-pro-step">
										<span className="aula-pro-step-num">1</span>
										<div className="aula-pro-step-text">
											<strong className="aula-pro-step-title">Project Triage:</strong>
											Inspect student thesis repositories, topic proposals, and submitted chapters.
										</div>
									</li>
									<li className="aula-pro-step">
										<span className="aula-pro-step-num">2</span>
										<div className="aula-pro-step-text">
											<strong className="aula-pro-step-title">AI Feedback:</strong>
											Highlight passages, attach editorial remarks, and verify source authenticity.
										</div>
									</li>
									<li className="aula-pro-step">
										<span className="aula-pro-step-num">3</span>
										<div className="aula-pro-step-text">
											<strong className="aula-pro-step-title">Milestone Tracking:</strong>
											Approve thesis stages, export mark sheets, and monitor supervisee analytics.
										</div>
									</li>
								</ol>
							</div>

							<div className="aula-pro-card-actions">
								<Link href="/supervision/projects" className="aula-pro-cta-btn">
									<span>Launch Supervision Assistant</span>
									<ArrowRight size={15} />
								</Link>
								<div className="aula-pro-sublinks">
									<Link href="/reviews" className="aula-pro-sublink">
										<CheckCircle2 size={12} />
										<span>Chapter Reviews</span>
									</Link>
									<Link href="/assignments" className="aula-pro-sublink">
										<GraduationCap size={12} />
										<span>Assignments</span>
									</Link>
								</div>
							</div>
						</article>
					</div>
				</section>

				{/* Institutional Compliance & Governance Banner */}
				<footer className="aula-pro-footer-banner">
					<div className="aula-pro-compliance-left">
						<div className="aula-pro-compliance-icon">
							<ShieldCheck size={16} />
						</div>
						<div className="aula-pro-compliance-text">
							Institutional Governance Guard Active
							<span className="aula-pro-compliance-sub">
								— Zero Hallucination Enforced • Role-Based Security
							</span>
						</div>
					</div>

					<div className="aula-pro-quick-jumps">
						<Link href="/research/saved" className="aula-pro-jump-link">
							Saved Research
						</Link>
						<Link href="/supervision/projects" className="aula-pro-jump-link">
							Supervisee Folders
						</Link>
						<Link href="/analytics" className="aula-pro-jump-link">
							Institution Analytics
						</Link>
					</div>
				</footer>
			</div>
		</AulaLayout>
	);
}
