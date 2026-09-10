"use client";

import Link from "next/link";

import { BrandLogo } from "@/components/BrandLogo";
import { SiteFooter } from "@/components/SiteFooter";
import { useAuth } from "@/hooks/useAuth";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

const PILOT_MAILTO = "mailto:hello@trustledai.com?subject=GARIL%20AI%20pilot%20enquiry";
const DEMO_MAILTO = "mailto:hello@trustledai.com?subject=GARIL%20AI%20demo%20request";

const INTRO_POINTS = [
	"Structured academic workflows",
	"Search trusted research databases from one workspace",
	"Evidence-backed research with citation verification",
] as const;

const WORKFLOWS = [
	"Literature Review",
	"Research Paper",
	"Research Proposal",
	"Thesis & Dissertation",
	"Research Gap Analysis",
	"Study Comparison",
	"Citation Audit",
] as const;

const ROLES = [
	{
		title: "Students",
		description:
			"Develop stronger research papers, projects, dissertations and literature reviews with structured guidance throughout the research process.",
		icon: "student",
	},
	{
		title: "Lecturers",
		description:
			"Supervise student research, review submissions against your own requirements and issue structured feedback, while keeping full academic judgement over every assessment.",
		icon: "lecturer",
	},
	{
		title: "Researchers",
		description:
			"Explore scholarly literature, identify research gaps, organise evidence and produce high-quality academic work grounded in trusted sources.",
		icon: "researcher",
	},
] as const;

const PLATFORM_FEATURES = [
	{
		title: "Academic Contribution & Provenance",
		description:
			"GARIL AI helps students evidence the work behind their results, so genuine contribution can be recognised and academic integrity is supported by more than a declaration.",
		points: [
			"Evidence of authentic student contribution",
			"Supports fair, confident assessment",
			"Strengthens academic integrity across the institution",
		],
		icon: "provenance",
	},
	{
		title: "AI Research Assistant",
		description:
			"An academic research assistant that helps students and researchers work from their own evidence and trusted scholarly sources, keeping their ideas and arguments at the centre of the work.",
		points: [
			"Organise literature and synthesise evidence",
			"Identify research gaps and strengthen outputs",
			"Verified citations in standard academic styles",
		],
		icon: "search",
	},
	{
		title: "AI-Assisted Supervision",
		description:
			"Supervision support that helps lecturers manage growing research workloads with structured, timely feedback, while every academic decision stays with the lecturer.",
		points: [
			"Faster, more consistent feedback for students",
			"Less time spent on repetitive review",
			"Full lecturer ownership of assessment",
		],
		icon: "lecturer",
	},
	{
		title: "Evidence-Backed Governance",
		description:
			"Institutional oversight of AI use across research, teaching and learning, giving leadership the visibility it needs while individual research stays private.",
		points: [
			"Insight into AI adoption across the institution",
			"Reporting ready for Management and Senate",
			"Oversight without access to private research content",
		],
		icon: "governance",
	},
] as const;

const INSTITUTION_POINTS = [
	"Understand AI adoption across departments",
	"Support academic integrity initiatives",
	"Generate governance reports",
	"Maintain audit records",
	"Manage institutional access",
	"Monitor research activity through institutional dashboards",
] as const;

const FAQS = [
	{
		question: `How is ${APP_NAME} different from ChatGPT and other AI chatbots?`,
		answer: `${APP_NAME} is designed specifically for higher education. Instead of a blank chat window, users work through structured academic workflows for research, instruction and learning. This reduces the risk of exposing confidential institutional information while providing access to trusted scholarly sources.`,
	},
	{
		question: `Which academic databases does ${APP_NAME} search?`,
		answer: `${APP_NAME} searches trusted scholarly sources, including arXiv, Semantic Scholar and Crossref, helping users ground their work in academic evidence.`,
	},
	{
		question: "Which citation styles are supported?",
		answer:
			"APA, MLA, IEEE and Harvard citation styles are supported, with automatic citation formatting and bibliography generation.",
	},
	{
		question: `Can universities deploy ${APP_NAME} across the institution?`,
		answer: `Yes. ${APP_NAME} supports institution-wide deployment across universities, colleges of education and polytechnics, providing students, lecturers and researchers with a shared academic AI environment.`,
	},
	{
		question: `Who can use ${APP_NAME}?`,
		answer: `${APP_NAME} is designed for undergraduate and postgraduate students, lecturers, researchers and institutional administrators.`,
	},
	{
		question: `Is ${APP_NAME} only for research?`,
		answer: `No. ${APP_NAME} supports the full academic journey. Users can conduct research, supervise student projects, write dissertations and explore scholarly literature from one platform.`,
	},
] as const;

function FeatureIcon({ name }: { name: string }) {
	const props = {
		width: 22,
		height: 22,
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: 1.75,
		strokeLinecap: "round" as const,
		strokeLinejoin: "round" as const,
		"aria-hidden": true,
	};

	switch (name) {
		case "search":
			return (
				<svg {...props}>
					<circle cx="11" cy="11" r="7" />
					<path d="m21 21-4.3-4.3" />
				</svg>
			);
		case "file":
			return (
				<svg {...props}>
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
					<path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
				</svg>
			);
		case "pen":
			return (
				<svg {...props}>
					<path d="M12 20h9" />
					<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
				</svg>
			);
		case "shield":
			return (
				<svg {...props}>
					<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
				</svg>
			);
		case "brain":
			return (
				<svg {...props}>
					<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
					<path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
				</svg>
			);
		case "sparkles":
			return (
				<svg {...props}>
					<path d="m12 3-1.9 5.8H4.4L10 13.2 8.1 19 12 15.4 15.9 19 14 13.2l5.6-4.4h-6.1L12 3Z" />
				</svg>
			);
		case "provenance":
			return (
				<svg {...props}>
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
					<path d="M14 2v6h6M9 15l2 2 4-4" />
				</svg>
			);
		case "governance":
			return (
				<svg {...props}>
					<path d="M3 21h18" />
					<path d="M5 21V8l7-4 7 4v13" />
					<path d="M9 21v-4h6v4" />
					<path d="M9 10h1M14 10h1M9 14h1M14 14h1" />
				</svg>
			);
		case "student":
			return (
				<svg {...props}>
					<path d="M22 10 12 5 2 10l10 5 10-5Z" />
					<path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5" />
				</svg>
			);
		case "lecturer":
			return (
				<svg {...props}>
					<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
					<circle cx="9" cy="7" r="4" />
					<path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
				</svg>
			);
		case "researcher":
			return (
				<svg {...props}>
					<circle cx="11" cy="11" r="7" />
					<path d="m21 21-4.3-4.3" />
					<path d="M11 8v6M8 11h6" />
				</svg>
			);
		default:
			return (
				<svg {...props}>
					<path d="M20 6 9 17l-5-5" />
				</svg>
			);
	}
}

function CheckIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
			<path d="M20 6 9 17l-5-5" />
		</svg>
	);
}

export function HomeScreen() {
	const { user, loading, logout } = useAuth();

	return (
		<div className="home-page">
			<header className="home-header">
				<div className="home-header-inner">
					<Link href="/" className="home-logo" aria-label={APP_NAME}>
						<BrandLogo height={56} className="home-logo-img" priority />
					</Link>

					<nav className="home-header-actions" aria-label="Account">
						{loading ? (
							<span className="home-header-muted">Loading…</span>
						) : user ? (
							<>
								<span className="home-header-muted home-header-user">{user.name}</span>
								<Link href="/dashboard" className="home-header-link home-header-link-strong">
									Dashboard
								</Link>
								<button type="button" className="home-header-link" onClick={() => logout(false)}>
									Sign out
								</button>
							</>
						) : (
							<>
								<Link href="/login" className="home-header-link">
									Sign in
								</Link>
								<Link href="/register" className="home-btn home-btn-primary home-header-cta">
									Get Started
								</Link>
							</>
						)}
					</nav>
				</div>
			</header>

			<section className="home-hero" aria-label="Introduction">
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img className="home-hero-bg" src="/images/hero-researcher.png?v=20260730" alt="" aria-hidden />
				<div className="home-hero-overlay" aria-hidden />
				<div className="home-hero-content">
					<div className="home-hero-inner">
						<p className="home-hero-brand home-hero-animate home-hero-animate-1">{APP_NAME}</p>
						<h1 className="home-hero-title home-hero-animate home-hero-animate-2">
							{user ? <>Welcome back, {user.name.split(" ")[0]}</> : APP_TAGLINE}
						</h1>
						<p className="home-hero-lead home-hero-animate home-hero-animate-3">
							{user
								? "Continue research, teaching and academic projects in your institutional workspace."
								: "A purpose-built academic AI workspace for universities — with institutional visibility built in."}
						</p>
						<div
							className="home-hero-actions home-hero-animate home-hero-animate-4"
							role="group"
							aria-label="Contact"
						>
							<a href={PILOT_MAILTO} className="home-btn home-btn-light">
								Request a pilot
							</a>
							<a href={DEMO_MAILTO} className="home-btn home-btn-ghost-light">
								Book a demo
							</a>
						</div>
					</div>
				</div>
			</section>

			<section className="home-section" id="overview">
				<div className="home-section-inner home-split">
					<div className="home-split-copy home-reveal-delay">
						<p className="home-kicker">Overview</p>
						<h2 className="home-section-title">Governed AI Workspace for Higher Education</h2>
						<p className="home-section-lead">
							{APP_NAME} brings research, teaching and learning into a single academic workspace designed
							specifically for higher education. Instead of open-ended prompting, users work through structured
							academic workflows supported by trusted scholarly sources.
						</p>
						<ul className="home-checklist">
							{INTRO_POINTS.map((point) => (
								<li key={point}>
									<span className="home-checklist-icon" aria-hidden>
										<CheckIcon />
									</span>
									<span>{point}</span>
								</li>
							))}
						</ul>
					</div>
					<figure className="home-media">
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							src="/images/feature-workflows.png?v=20260730"
							alt="Students and lecturers working in a Nigerian higher education research workspace"
						/>
					</figure>
				</div>
			</section>

			<section className="home-section home-section-soft" id="different-by-design">
				<div className="home-section-inner home-prose">
					<p className="home-kicker">Approach</p>
					<h2 className="home-section-title">Designed for Universities. Different by Design.</h2>
					<div className="home-prose-body">
						<p>Most AI chatbots begin with an empty prompt box.</p>
						<p>
							That simple design encourages users to paste exam scripts, unpublished research, participant data
							and confidential university documents into AI systems the institution does not control.
						</p>
						<p>{APP_NAME} takes a different approach.</p>
						<p>
							Students, lecturers and researchers work through guided academic workflows rather than blank
							conversations. Research activities are built around trusted academic sources and purpose-designed
							research actions, reducing the need to expose confidential institutional information.
						</p>
						<p className="home-prose-emphasis">The result is a safer AI experience for higher education.</p>
					</div>
				</div>
			</section>

			<section className="home-section" id="workflows">
				<div className="home-section-inner home-split home-split-reverse">
					<figure className="home-media">
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							src="/images/feature-portal.png?v=20260730"
							alt="Academic workflows guiding research from literature review to thesis writing"
						/>
					</figure>
					<div className="home-split-copy">
						<p className="home-kicker">Workflows</p>
						<h2 className="home-section-title">Academic Workflows</h2>
						<p className="home-section-lead">
							Purpose-built workflows guide users through every stage of academic work.
						</p>
						<ul className="home-workflow-list">
							{WORKFLOWS.map((workflow) => (
								<li key={workflow}>{workflow}</li>
							))}
						</ul>
					</div>
				</div>
			</section>

			<section className="home-section home-section-soft" id="roles">
				<div className="home-section-inner">
					<header className="home-section-intro">
						<p className="home-kicker">Roles</p>
						<h2 className="home-section-title">Built for Every Academic Role</h2>
						<p className="home-section-lead">
							Whether you&apos;re teaching a class, supervising research or writing a dissertation, {APP_NAME}{" "}
							provides AI tools designed around the way higher education works.
						</p>
					</header>
					<div className="home-roles">
						{ROLES.map((role) => (
							<article key={role.title} className="home-role">
								<span className="home-role-icon" aria-hidden>
									<FeatureIcon name={role.icon} />
								</span>
								<h3>{role.title}</h3>
								<p>{role.description}</p>
							</article>
						))}
					</div>
				</div>
			</section>

			<section className="home-section" id="features">
				<div className="home-section-inner">
					<header className="home-section-intro home-section-intro-row">
						<div>
							<p className="home-kicker">Capabilities</p>
							<h2 className="home-section-title">Four Capabilities, One Governed Environment</h2>
							<p className="home-section-lead">
								GARIL AI brings research, teaching, supervision and oversight into a single academic workspace,
								where AI supports the work while students keep ownership of their ideas, lecturers keep academic
								judgement, and the University keeps institutional oversight.
							</p>
						</div>
						<figure className="home-media home-media-wide">
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								src="/images/feature-agent.png?v=20260730"
								alt="Researchers reviewing scholarly literature with AI-supported academic workflows"
							/>
						</figure>
					</header>

					<div className="home-capabilities">
						{PLATFORM_FEATURES.map((feature) => (
							<article key={feature.title} className="home-capability">
								<span className="home-capability-icon" aria-hidden>
									<FeatureIcon name={feature.icon} />
								</span>
								<div>
									<h3>{feature.title}</h3>
									<p>{feature.description}</p>
									<ul className="home-checklist">
										{feature.points.map((point) => (
											<li key={point}>
												<span className="home-checklist-icon" aria-hidden>
													<CheckIcon />
												</span>
												<span>{point}</span>
											</li>
										))}
									</ul>
								</div>
							</article>
						))}
					</div>
				</div>
			</section>

			<section className="home-section home-section-soft" id="institutions">
				<div className="home-section-inner home-split">
					<div className="home-split-copy">
						<p className="home-kicker">Institutions</p>
						<h2 className="home-section-title">Built with Universities in Mind</h2>
						<p className="home-section-lead">
							{APP_NAME} helps institutions move beyond AI policies by providing practical tools that support AI
							use across research, instruction and learning.
						</p>
						<p className="home-section-lead home-section-lead-spaced">Institutional administrators can:</p>
						<ul className="home-checklist">
							{INSTITUTION_POINTS.map((point) => (
								<li key={point}>
									<span className="home-checklist-icon" aria-hidden>
										<CheckIcon />
									</span>
									<span>{point}</span>
								</li>
							))}
						</ul>
					</div>
					<figure className="home-media">
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							src="/images/feature-workflows.png?v=20260730"
							alt="Institutional dashboard for monitoring governed AI use across academic activities"
						/>
					</figure>
				</div>
			</section>

			<section className="home-band" id="purpose">
				<div className="home-section-inner home-band-inner">
					<h2 className="home-band-title">More Than an AI Chatbot</h2>
					<div className="home-band-copy">
						<p>{APP_NAME} wasn&apos;t built to answer general questions.</p>
						<p>It was built to support the work that happens every day in universities.</p>
						<p>
							From supervising student research to writing dissertations and exploring academic literature, every
							capability is designed around higher education.
						</p>
					</div>
				</div>
			</section>

			<section className="home-section" id="faq">
				<div className="home-section-inner home-faq">
					<header className="home-section-intro home-faq-intro">
						<p className="home-kicker">Support</p>
						<h2 className="home-section-title">Frequently Asked Questions</h2>
					</header>
					<div className="home-faq-list">
						{FAQS.map((faq) => (
							<details key={faq.question} className="home-faq-item">
								<summary>{faq.question}</summary>
								<p>{faq.answer}</p>
							</details>
						))}
					</div>
				</div>
			</section>

			<section className="home-band" id="pilot" aria-labelledby="home-pilot-heading">
				<div className="home-section-inner home-band-inner">
					<h2 className="home-band-title" id="home-pilot-heading">
						Bring governed AI to your institution
					</h2>
					<p className="home-band-lead">Talk to us about a structured pilot for your university.</p>
					<div className="home-band-actions">
						<a href={PILOT_MAILTO} className="home-btn home-btn-light">
							Request a pilot
						</a>
					</div>
				</div>
			</section>

			<SiteFooter />
		</div>
	);
}
