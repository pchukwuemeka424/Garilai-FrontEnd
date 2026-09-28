"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { BrandLogo } from "@/components/BrandLogo";
import { SiteFooter } from "@/components/SiteFooter";
import { useAuth } from "@/hooks/useAuth";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

const PILOT_MAILTO = "mailto:hello@trustledai.com?subject=GARIL%20AI%20pilot%20enquiry";
const DEMO_MAILTO = "mailto:hello@trustledai.com?subject=GARIL%20AI%20demo%20request";

const NAV_LINKS = [
	{ href: "#overview", label: "Overview" },
	{ href: "#workflows", label: "Workflows" },
	{ href: "#roles", label: "Roles" },
	{ href: "#features", label: "Capabilities" },
	{ href: "#faq", label: "FAQ" },
] as const;

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
			"Help students evidence the work behind their results, so genuine contribution can be recognised and academic integrity is supported by more than a declaration.",
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
			"Work from your own evidence and trusted scholarly sources, keeping ideas and arguments at the centre of the academic output.",
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
			"Manage growing research workloads with structured, timely feedback, while every academic decision stays with the lecturer.",
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
			"Give leadership visibility into AI use across research, teaching and learning, while individual research stays private.",
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

function MenuIcon({ open }: { open: boolean }) {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
			{open ? (
				<>
					<path d="M6 6l12 12" />
					<path d="M18 6 6 18" />
				</>
			) : (
				<>
					<path d="M4 7h16" />
					<path d="M4 12h16" />
					<path d="M4 17h16" />
				</>
			)}
		</svg>
	);
}

export function HomeScreen() {
	const { user, loading, logout } = useAuth();
	const [menuOpen, setMenuOpen] = useState(false);
	const menuId = useId();

	useEffect(() => {
		if (!menuOpen) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setMenuOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [menuOpen]);

	const closeMenu = () => setMenuOpen(false);

	return (
		<div className="home-page">
			<header className="home-header">
				<div className="home-header-inner">
					<Link href="/" className="home-logo" aria-label={APP_NAME} onClick={closeMenu}>
						<BrandLogo height={56} className="home-logo-img" priority />
					</Link>

					<nav className="home-header-nav" aria-label="Page sections">
						{NAV_LINKS.map((link) => (
							<a key={link.href} href={link.href} className="home-header-nav-link">
								{link.label}
							</a>
						))}
					</nav>

					<div className="home-header-actions">
						{loading ? (
							<span className="home-header-muted">Loading…</span>
						) : user ? (
							<>
								<span className="home-header-muted home-header-user">{user.name}</span>
								<Link href="/dashboard" className="home-btn home-btn-primary home-header-cta">
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

						<button
							type="button"
							className="home-menu-toggle"
							aria-expanded={menuOpen}
							aria-controls={menuId}
							aria-label={menuOpen ? "Close menu" : "Open menu"}
							onClick={() => setMenuOpen((open) => !open)}
						>
							<MenuIcon open={menuOpen} />
						</button>
					</div>
				</div>

				{menuOpen ? (
					<div className="home-mobile-menu" id={menuId}>
						<nav className="home-mobile-nav" aria-label="Mobile sections">
							{NAV_LINKS.map((link) => (
								<a key={link.href} href={link.href} className="home-mobile-nav-link" onClick={closeMenu}>
									{link.label}
								</a>
							))}
						</nav>
						{!loading && !user ? (
							<div className="home-mobile-actions">
								<Link href="/login" className="home-btn home-btn-ghost-dark" onClick={closeMenu}>
									Sign in
								</Link>
								<Link href="/register" className="home-btn home-btn-primary" onClick={closeMenu}>
									Get Started
								</Link>
							</div>
						) : null}
						{!loading && user ? (
							<div className="home-mobile-actions">
								<Link href="/dashboard" className="home-btn home-btn-primary" onClick={closeMenu}>
									Open dashboard
								</Link>
								<button
									type="button"
									className="home-btn home-btn-ghost-dark"
									onClick={() => {
										closeMenu();
										logout(false);
									}}
								>
									Sign out
								</button>
							</div>
						) : null}
					</div>
				) : null}
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
							aria-label="Get started"
						>
							{user ? (
								<>
									<Link href="/dashboard" className="home-btn home-btn-light home-btn-lg">
										Open dashboard
									</Link>
									<a href="#overview" className="home-btn home-btn-ghost-light home-btn-lg">
										Explore platform
									</a>
								</>
							) : (
								<>
									<Link href="/register" className="home-btn home-btn-light home-btn-lg">
										Get Started
									</Link>
									<a href={PILOT_MAILTO} className="home-btn home-btn-ghost-light home-btn-lg">
										Request a pilot
									</a>
								</>
							)}
						</div>
					</div>
				</div>
			</section>

			<section className="home-section" id="overview">
				<div className="home-section-inner home-split">
					<div className="home-split-copy home-reveal-delay">
						<p className="home-kicker">Overview</p>
						<h2 className="home-section-title">Governed AI workspace for higher education</h2>
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
							alt="Students and lecturers working in a higher education research workspace"
						/>
					</figure>
				</div>
			</section>

			<section className="home-section home-section-soft" id="different-by-design">
				<div className="home-section-inner">
					<header className="home-section-intro home-section-intro-center">
						<p className="home-kicker">Approach</p>
						<h2 className="home-section-title">Designed for universities. Different by design.</h2>
						<p className="home-section-lead">
							Most AI tools start with a blank prompt. {APP_NAME} starts with structured academic work —
							so confidential research stays inside a governed environment.
						</p>
					</header>
					<div className="home-compare">
						<article className="home-compare-col home-compare-muted">
							<p className="home-compare-label">Typical AI chatbots</p>
							<ul>
								<li>Empty prompt box with no academic structure</li>
								<li>Easy to paste exams, unpublished research and confidential data</li>
								<li>Institution has little visibility or control</li>
							</ul>
						</article>
						<article className="home-compare-col home-compare-accent">
							<p className="home-compare-label">{APP_NAME}</p>
							<ul>
								<li>Guided workflows for research, teaching and learning</li>
								<li>Grounded in trusted scholarly sources</li>
								<li>Safer AI use with institutional oversight built in</li>
							</ul>
						</article>
					</div>
					<p className="home-compare-result">The result is a safer AI experience for higher education.</p>
				</div>
			</section>

			<section className="home-section" id="workflows">
				<div className="home-section-inner">
					<header className="home-section-intro home-section-intro-row">
						<div>
							<p className="home-kicker">Workflows</p>
							<h2 className="home-section-title">Academic workflows</h2>
							<p className="home-section-lead">
								Purpose-built workflows guide users through every stage of academic work — from first
								literature search to final citation audit.
							</p>
						</div>
						<figure className="home-media home-media-wide">
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								src="/images/feature-portal.png?v=20260730"
								alt="Academic workflows guiding research from literature review to thesis writing"
							/>
						</figure>
					</header>
					<ol className="home-workflow-grid">
						{WORKFLOWS.map((workflow, index) => (
							<li key={workflow}>
								<span className="home-workflow-num" aria-hidden>
									{String(index + 1).padStart(2, "0")}
								</span>
								<span className="home-workflow-name">{workflow}</span>
							</li>
						))}
					</ol>
				</div>
			</section>

			<section className="home-section home-section-soft" id="roles">
				<div className="home-section-inner">
					<header className="home-section-intro home-section-intro-center">
						<p className="home-kicker">Roles</p>
						<h2 className="home-section-title">Built for every academic role</h2>
						<p className="home-section-lead">
							Whether you&apos;re teaching a class, supervising research or writing a dissertation, {APP_NAME}{" "}
							provides tools designed around the way higher education works.
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
					<header className="home-section-intro home-section-intro-center">
						<p className="home-kicker">Capabilities</p>
						<h2 className="home-section-title">Four capabilities, one governed environment</h2>
						<p className="home-section-lead">
							Research, teaching, supervision and oversight in one workspace — students keep ownership of
							their ideas, lecturers keep academic judgement, and the university keeps institutional
							oversight.
						</p>
					</header>

					<figure className="home-media home-media-banner">
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							src="/images/feature-agent.png?v=20260730"
							alt="Researchers reviewing scholarly literature with AI-supported academic workflows"
						/>
					</figure>

					<div className="home-capabilities">
						{PLATFORM_FEATURES.map((feature, index) => (
							<article key={feature.title} className="home-capability">
								<div className="home-capability-head">
									<span className="home-capability-icon" aria-hidden>
										<FeatureIcon name={feature.icon} />
									</span>
									<span className="home-capability-index" aria-hidden>
										{String(index + 1).padStart(2, "0")}
									</span>
								</div>
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
						<h2 className="home-section-title">Built with universities in mind</h2>
						<p className="home-section-lead">
							{APP_NAME} helps institutions move beyond AI policies with practical tools that support AI use
							across research, instruction and learning.
						</p>
						<p className="home-section-lead home-section-lead-spaced">Institutional administrators can:</p>
						<ul className="home-checklist home-checklist-grid">
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
				<div className="home-section-inner home-band-inner home-band-purpose">
					<p className="home-band-kicker">Purpose</p>
					<h2 className="home-band-title">More than an AI chatbot</h2>
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
						<h2 className="home-section-title">Frequently asked questions</h2>
						<p className="home-section-lead">
							Quick answers about how {APP_NAME} supports research, teaching and institutional governance.
						</p>
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

			<section className="home-band home-band-cta" id="pilot" aria-labelledby="home-pilot-heading">
				<div className="home-section-inner home-band-inner home-band-cta-inner">
					<div>
						<h2 className="home-band-title" id="home-pilot-heading">
							Bring governed AI to your institution
						</h2>
						<p className="home-band-lead">Talk to us about a structured pilot for your university.</p>
					</div>
					<div className="home-band-actions">
						<a href={PILOT_MAILTO} className="home-btn home-btn-light home-btn-lg">
							Request a pilot
						</a>
						<a href={DEMO_MAILTO} className="home-btn home-btn-ghost-light home-btn-lg">
							Book a demo
						</a>
					</div>
				</div>
			</section>

			<SiteFooter />
		</div>
	);
}
