"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { AulaModal } from "@/components/aula/AulaModal";
import { NavIcon } from "@/components/aula/NavIcon";
import { AulaLayout } from "@/components/AulaLayout";
import {
	IconArrowRight,
	IconClock,
	IconFileText,
	IconLightbulb,
	IconMicroscope,
	IconPlus,
	IconRefresh,
	IconSparkles,
} from "@/components/ui/ButtonIcon";
import { useAuth } from "@/hooks/useAuth";
import { AULA_HUB_TOOLS, AULA_QUICK_ACCESS } from "@/lib/aula-nav";
import { roleDisplay, userInitials } from "@/lib/aula-utils";
import { loadAllSavedPapers, type SavedResearchPaper } from "@/lib/chat-research-storage";
import { loadAllSavedIdeas, type SavedIdea } from "@/lib/research-storage";
import { savedResearchPagePath } from "@/lib/saved-research-routes";
import { researchTokenAllowance } from "@/lib/student-tokens";

type ActivityItem = {
	id: string;
	kind: "idea" | "paper";
	title: string;
	meta: string;
	href: string;
	at: string;
};

function getGreeting(): string {
	const hour = new Date().getHours();
	if (hour < 12) return "Good morning";
	if (hour < 17) return "Good afternoon";
	return "Good evening";
}

function formatToday(): string {
	return new Intl.DateTimeFormat(undefined, {
		weekday: "long",
		month: "long",
		day: "numeric",
	}).format(new Date());
}

function formatRelative(iso: string): string {
	const t = new Date(iso).getTime();
	if (Number.isNaN(t)) return "";
	const diff = Date.now() - t;
	const mins = Math.floor(diff / 60_000);
	if (mins < 1) return "Just now";
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 14) return `${days}d ago`;
	return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(iso));
}

const TOOL_ICONS: Record<string, ReactNode> = {
	research: <IconMicroscope size={26} />,
};

const KIND_ICONS: Record<ActivityItem["kind"], ReactNode> = {
	idea: <IconLightbulb size={16} />,
	paper: <IconFileText size={16} />,
};

export function AulaDashboard() {
	const router = useRouter();
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);
	const [ideas, setIdeas] = useState<SavedIdea[]>([]);
	const [papers, setPapers] = useState<SavedResearchPaper[]>([]);
	const [quickOpen, setQuickOpen] = useState(false);
	const [toolModalId, setToolModalId] = useState<string | null>(null);
	const [topicDraft, setTopicDraft] = useState("");

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

	const activity = useMemo(() => {
		const items: ActivityItem[] = [
			...ideas.map((idea) => ({
				id: `idea-${idea.dbId ?? idea.id}`,
				kind: "idea" as const,
				title: idea.title,
				meta: idea.topic || idea.discipline || "Research idea",
				href: "/research",
				at: idea.savedAt,
			})),
			...papers.map((paper) => ({
				id: `paper-${paper.id}`,
				kind: "paper" as const,
				title: paper.title || paper.topic,
				meta: "Saved paper",
				href: savedResearchPagePath(paper.id),
				at: paper.updatedAt || paper.createdAt,
			})),
		];
		return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 8);
	}, [ideas, papers]);

	const toolModal = AULA_QUICK_ACCESS.find((t) => t.id === toolModalId) ?? null;

	const startResearch = () => {
		const q = topicDraft.trim();
		if (q && typeof window !== "undefined") {
			sessionStorage.setItem("aula.research.quickTopic", q);
		}
		setQuickOpen(false);
		setTopicDraft("");
		router.push("/research");
	};

	if (!user) return null;

	return (
		<AulaLayout showRightPanel={false}>
			<div className="aula-dash">
				<header className="aula-dash-hero">
					<div className="aula-dash-hero-copy">
						<p className="aula-dash-kicker">{formatToday()}</p>
						<h1 className="aula-dash-title">
							{getGreeting()}, {user.name.split(/\s+/)[0]}
						</h1>
						<p className="aula-dash-subtitle">
							Your teaching and research workspace — pick up where you left off or start something new.
						</p>
					</div>
					<div className="aula-dash-hero-actions">
						<button type="button" className="ghost-btn aula-dash-icon-btn" onClick={() => void load()} disabled={loading}>
							<IconRefresh size={16} />
							Refresh
						</button>
						<button type="button" className="primary-btn" onClick={() => setQuickOpen(true)}>
							<IconPlus size={16} />
							Quick start
						</button>
					</div>
				</header>

				<section className="aula-dash-kpis" aria-label="Workspace summary">
					<article className="aula-dash-kpi">
						<span className="aula-dash-kpi-icon aula-dash-kpi-tokens" aria-hidden>
							<NavIcon id="tokens" size={18} />
						</span>
						<div>
							<p className="aula-dash-kpi-label">AI tokens left</p>
							<p className="aula-dash-kpi-value">{remaining.toLocaleString()}</p>
							{allowance > 0 ? (
								<div className="aula-dash-kpi-track" aria-hidden>
									<span style={{ width: `${tokenPct}%` }} />
								</div>
							) : (
								<p className="aula-dash-kpi-hint">Unlimited / not set</p>
							)}
						</div>
					</article>
					<article className="aula-dash-kpi">
						<span className="aula-dash-kpi-icon aula-dash-kpi-ideas" aria-hidden>
							<IconLightbulb size={18} />
						</span>
						<div>
							<p className="aula-dash-kpi-label">Saved ideas</p>
							<p className="aula-dash-kpi-value">{loading ? "…" : ideas.length}</p>
							<p className="aula-dash-kpi-hint">Research portfolio</p>
						</div>
					</article>
					<article className="aula-dash-kpi">
						<span className="aula-dash-kpi-icon aula-dash-kpi-papers" aria-hidden>
							<IconFileText size={18} />
						</span>
						<div>
							<p className="aula-dash-kpi-label">Papers</p>
							<p className="aula-dash-kpi-value">{loading ? "…" : papers.length}</p>
							<p className="aula-dash-kpi-hint">Drafts & outputs</p>
						</div>
					</article>
				</section>

				<section className="aula-dash-section">
					<div className="aula-dash-section-head">
						<div>
							<h2 className="aula-dash-section-title">Workspace tools</h2>
							<p className="aula-dash-section-desc">Open a tool or preview details before you enter.</p>
						</div>
					</div>
					<div className="aula-dash-tools" role="navigation" aria-label="Workspace tools">
						{AULA_HUB_TOOLS.map((tool) => (
							<article key={tool.id} className={`aula-dash-tool aula-dash-tool-${tool.iconColor}`}>
								<div className="aula-dash-tool-top">
									<span className={`aula-dash-tool-icon aula-quick-icon-${tool.iconColor}`} aria-hidden>
										{TOOL_ICONS[tool.id] ?? <NavIcon id={tool.id} size={26} />}
									</span>
									<button
										type="button"
										className="aula-dash-tool-info"
										onClick={() => setToolModalId(tool.id)}
									>
										Details
									</button>
								</div>
								<h3 className="aula-dash-tool-title">{tool.label}</h3>
								<p className="aula-dash-tool-desc">{tool.description}</p>
								<div className="aula-dash-tool-actions">
									<Link href={tool.href} className="primary-btn aula-dash-tool-open">
										Open
										<IconArrowRight size={14} />
									</Link>
								</div>
							</article>
						))}
					</div>
				</section>

				<div className="aula-dash-split">
					<section className="aula-dash-section aula-dash-panel">
						<div className="aula-dash-section-head">
							<div>
								<h2 className="aula-dash-section-title">Recent activity</h2>
								<p className="aula-dash-section-desc">Ideas and papers.</p>
							</div>
							<Link href="/research/saved" className="ghost-btn">
								View library
							</Link>
						</div>
						{loading ? (
							<p className="muted aula-dash-empty">Loading activity…</p>
						) : activity.length === 0 ? (
							<div className="aula-dash-empty-state">
								<span className="aula-dash-empty-icon" aria-hidden>
									<IconSparkles size={22} />
								</span>
								<p className="aula-dash-empty-title">Nothing here yet</p>
								<p className="muted">Start a research idea to see activity.</p>
								<button type="button" className="primary-btn" onClick={() => setQuickOpen(true)}>
									Quick start
								</button>
							</div>
						) : (
							<ul className="aula-dash-activity">
								{activity.map((item) => (
									<li key={item.id}>
										<Link href={item.href} className="aula-dash-activity-row">
											<span className={`aula-dash-activity-icon aula-dash-kind-${item.kind}`} aria-hidden>
												{KIND_ICONS[item.kind]}
											</span>
											<span className="aula-dash-activity-copy">
												<span className="aula-dash-activity-title">{item.title}</span>
												<span className="aula-dash-activity-meta">{item.meta}</span>
											</span>
											<span className="aula-dash-activity-time">
												<IconClock size={12} />
												{formatRelative(item.at)}
											</span>
										</Link>
									</li>
								))}
							</ul>
						)}
					</section>

					<aside className="aula-dash-section aula-dash-panel">
						<div className="aula-dash-section-head">
							<div>
								<h2 className="aula-dash-section-title">Profile</h2>
								<p className="aula-dash-section-desc">Signed-in workspace identity.</p>
							</div>
						</div>
						<div className="aula-dash-profile">
							<span className="aula-dash-avatar" aria-hidden>
								{userInitials(user.name)}
							</span>
							<div>
								<p className="aula-dash-profile-name">{user.name}</p>
								<p className="aula-dash-profile-email">{user.email}</p>
								<span className="aula-dash-profile-role">{roleDisplay(user.role)}</span>
							</div>
						</div>
						<ul className="aula-dash-shortcuts">
							{AULA_QUICK_ACCESS.map((tool) => (
								<li key={tool.id}>
									<Link href={tool.href} className="aula-dash-shortcut">
										<span className={`aula-dash-shortcut-icon aula-quick-icon-${tool.iconColor}`} aria-hidden>
											{TOOL_ICONS[tool.id] ?? <NavIcon id={tool.id} size={16} />}
										</span>
										<span>{tool.label}</span>
										<IconArrowRight size={14} />
									</Link>
								</li>
							))}
						</ul>
					</aside>
				</div>
			</div>

			<AulaModal
				open={quickOpen}
				onClose={() => setQuickOpen(false)}
				title="Quick start"
				description="Jump into research."
				footer={
					<>
						<button type="button" className="ghost-btn" onClick={() => setQuickOpen(false)}>
							Cancel
						</button>
						<button type="button" className="primary-btn" onClick={startResearch}>
							<IconSparkles size={16} />
							Start research
						</button>
					</>
				}
			>
				<label className="aula-dash-field">
					Research topic (optional)
					<input
						className="topic-input"
						placeholder="e.g. Climate-resilient urban planning"
						value={topicDraft}
						onChange={(e) => setTopicDraft(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") startResearch();
						}}
					/>
				</label>
				<div className="aula-dash-quick-grid">
					<Link href="/research" className="aula-dash-quick-card" onClick={() => setQuickOpen(false)}>
						<span className="aula-quick-icon-blue aula-dash-quick-icon" aria-hidden>
							<IconMicroscope size={20} />
						</span>
						<span>
							<strong>Research Assistant</strong>
							<small>Generate cited research ideas</small>
						</span>
					</Link>
				</div>
			</AulaModal>

			<AulaModal
				open={Boolean(toolModal)}
				onClose={() => setToolModalId(null)}
				title={toolModal?.label ?? "Tool"}
				description={toolModal?.description}
				footer={
					<>
						<button type="button" className="ghost-btn" onClick={() => setToolModalId(null)}>
							Close
						</button>
						{toolModal ? (
							<button
								type="button"
								className="primary-btn"
								onClick={() => {
									setToolModalId(null);
									router.push(toolModal.href);
								}}
							>
								Open {toolModal.label}
								<IconArrowRight size={14} />
							</button>
						) : null}
					</>
				}
			>
				{toolModal ? (
					<div className="aula-dash-tool-modal">
						<span className={`aula-dash-tool-icon aula-quick-icon-${toolModal.iconColor}`} aria-hidden>
							{TOOL_ICONS[toolModal.id] ?? <NavIcon id={toolModal.id} size={28} />}
						</span>
						<ul className="aula-dash-tool-bullets">
							<li>Institution-ready workflows aligned to your faculty context</li>
							<li>Save drafts to your library and resume anytime</li>
							<li>Governed AI usage with token visibility</li>
						</ul>
					</div>
				) : null}
			</AulaModal>
		</AulaLayout>
	);
}
