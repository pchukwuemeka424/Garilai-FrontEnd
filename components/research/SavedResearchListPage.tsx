"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, FileText, Lightbulb, Search, Sparkles } from "lucide-react";

import { AulaLayout } from "@/components/AulaLayout";
import { StudentLayout } from "@/components/StudentLayout";
import {
	loadAllSavedPapers,
	removeSavedPaper,
	SAVED_RESEARCH_CHANGED,
	type SavedResearchPaper,
} from "@/lib/chat-research-storage";
import { getDisciplineLabel } from "@/lib/research-disciplines";
import { getFeasibilityLabel, getTypeLabel } from "@/lib/research-ideas";
import { resolvePaperDisplayTitle } from "@/lib/research-paper-title";
import {
	loadAllSavedIdeas,
	removeSavedIdea,
	type SavedIdea,
} from "@/lib/research-storage";
import { savedResearchPagePath } from "@/lib/saved-research-routes";

type Props = {
	variant?: "lecturer" | "student";
};

type LibraryTab = "papers" | "ideas";

function formatWhen(iso: string): string {
	try {
		return new Intl.DateTimeFormat(undefined, {
			dateStyle: "medium",
			timeStyle: "short",
		}).format(new Date(iso));
	} catch {
		return iso;
	}
}

function formatDateOnly(iso: string): string {
	try {
		return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
	} catch {
		return iso;
	}
}

function estimateWords(content: string): number {
	const words = content.trim().match(/\S+/g);
	return words?.length ?? 0;
}

function matchesQuery(haystack: string, query: string): boolean {
	if (!query) return true;
	return haystack.toLowerCase().includes(query);
}

function SavedResearchListContent({ variant = "lecturer" }: Props) {
	const isStudent = variant === "student";
	const researchPath = isStudent ? "/student/research" : "/research";
	const [papers, setPapers] = useState<SavedResearchPaper[]>([]);
	const [ideas, setIdeas] = useState<SavedIdea[]>([]);
	const [loading, setLoading] = useState(true);
	const [removingId, setRemovingId] = useState<string | null>(null);
	const [tab, setTab] = useState<LibraryTab>("papers");
	const [query, setQuery] = useState("");
	const [topicFilter, setTopicFilter] = useState("all");

	const loadResearch = useCallback(async () => {
		setLoading(true);
		const [paperRows, ideaRows] = await Promise.all([loadAllSavedPapers(), loadAllSavedIdeas()]);
		setPapers(paperRows);
		setIdeas(ideaRows);
		setLoading(false);
	}, []);

	useEffect(() => {
		void loadResearch();
	}, [loadResearch]);

	useEffect(() => {
		const onChanged = () => {
			void loadResearch();
		};
		window.addEventListener(SAVED_RESEARCH_CHANGED, onChanged);
		return () => window.removeEventListener(SAVED_RESEARCH_CHANGED, onChanged);
	}, [loadResearch]);

	useEffect(() => {
		if (!loading && papers.length === 0 && ideas.length > 0) {
			setTab("ideas");
		}
	}, [loading, papers.length, ideas.length]);

	const normalizedQuery = query.trim().toLowerCase();

	const topicOptions = useMemo(() => {
		const topics = new Set<string>();
		for (const paper of papers) {
			const topic = paper.topic.trim();
			if (topic) topics.add(topic);
		}
		for (const idea of ideas) {
			const topic = idea.topic.trim();
			if (topic) topics.add(topic);
		}
		return [...topics].sort((a, b) => a.localeCompare(b));
	}, [papers, ideas]);

	const sortedPapers = useMemo(() => {
		return [...papers]
			.filter((paper) => {
				if (topicFilter !== "all" && paper.topic.trim() !== topicFilter) return false;
				const title = resolvePaperDisplayTitle(paper.content, paper.topic);
				return matchesQuery(`${title} ${paper.topic}`, normalizedQuery);
			})
			.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	}, [papers, topicFilter, normalizedQuery]);

	const sortedIdeas = useMemo(() => {
		return [...ideas]
			.filter((idea) => {
				if (topicFilter !== "all" && idea.topic.trim() !== topicFilter) return false;
				return matchesQuery(
					`${idea.title} ${idea.topic} ${idea.discipline} ${idea.rationale}`,
					normalizedQuery,
				);
			})
			.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
	}, [ideas, topicFilter, normalizedQuery]);

	const handleRemovePaper = async (id: string) => {
		setRemovingId(id);
		const result = await removeSavedPaper(id, papers);
		setPapers(result.papers);
		setRemovingId(null);
	};

	const handleRemoveIdea = async (idea: SavedIdea) => {
		const key = idea.dbId ?? `${idea.id}:${idea.title}`;
		setRemovingId(key);
		const next = await removeSavedIdea(idea.id, idea.title, idea.dbId);
		setIdeas(next);
		setRemovingId(null);
	};

	const isEmpty = papers.length === 0 && ideas.length === 0;
	const showFilters = !loading && !isEmpty;

	return (
		<div className="sc-saved-hub">
			<header className="sc-saved-intro">
				<div className="sc-saved-intro-copy">
					<p className="sc-saved-intro-kicker">Your library</p>
					<h1 className="sc-saved-intro-title">Saved research</h1>
					<p className="sc-saved-intro-subtitle">
						Browse papers and bookmarked ideas by topic, with created and updated dates.
					</p>
				</div>
				<Link href={researchPath} className="sc-saved-primary-btn">
					<Sparkles size={16} strokeWidth={1.75} />
					New research
				</Link>
			</header>

			<div className="sc-saved-body">
				{loading && (
					<div className="sc-saved-empty" role="status">
						<div className="sc-saved-spinner" aria-hidden />
						<p className="sc-saved-empty-title">Loading saved research…</p>
					</div>
				)}

				{!loading && isEmpty && (
					<div className="sc-saved-empty">
						<div className="sc-saved-empty-icon" aria-hidden>
							<FileText size={22} strokeWidth={1.75} />
						</div>
						<h2 className="sc-saved-empty-title">No saved research yet</h2>
						<p className="sc-saved-empty-copy">
							Generated papers and bookmarked ideas from Research Assistant will appear here.
						</p>
						<Link href={researchPath} className="sc-saved-primary-btn">
							<Sparkles size={16} strokeWidth={1.75} />
							Start researching
						</Link>
					</div>
				)}

				{showFilters && (
					<>
						<div className="sc-saved-summary" aria-label="Library summary">
							<div className="sc-saved-stat">
								<span className="sc-saved-stat-value">{papers.length}</span>
								<span className="sc-saved-stat-label">
									{papers.length === 1 ? "Paper" : "Papers"}
								</span>
							</div>
							<div className="sc-saved-stat">
								<span className="sc-saved-stat-value">{ideas.length}</span>
								<span className="sc-saved-stat-label">
									{ideas.length === 1 ? "Idea" : "Ideas"}
								</span>
							</div>
							<div className="sc-saved-stat">
								<span className="sc-saved-stat-value">{topicOptions.length}</span>
								<span className="sc-saved-stat-label">
									{topicOptions.length === 1 ? "Topic" : "Topics"}
								</span>
							</div>
						</div>

						<div className="sc-saved-toolbar">
							<div className="sc-saved-tabs" role="tablist" aria-label="Saved library">
								<button
									type="button"
									role="tab"
									className={tab === "papers" ? "sc-saved-tab is-active" : "sc-saved-tab"}
									aria-selected={tab === "papers"}
									onClick={() => setTab("papers")}
								>
									<FileText size={14} strokeWidth={1.75} />
									Papers
									<span className="sc-saved-tab-count">{papers.length}</span>
								</button>
								<button
									type="button"
									role="tab"
									className={tab === "ideas" ? "sc-saved-tab is-active" : "sc-saved-tab"}
									aria-selected={tab === "ideas"}
									onClick={() => setTab("ideas")}
								>
									<Lightbulb size={14} strokeWidth={1.75} />
									Ideas
									<span className="sc-saved-tab-count">{ideas.length}</span>
								</button>
							</div>

							<div className="sc-saved-filters">
								<label className="sc-saved-filter sc-saved-filter-search">
									<span className="sr-only">Search library</span>
									<Search size={15} strokeWidth={1.75} aria-hidden />
									<input
										type="search"
										className="sc-saved-search"
										placeholder="Search title or topic…"
										value={query}
										onChange={(event) => setQuery(event.target.value)}
									/>
								</label>
								<label className="sc-saved-filter">
									<span className="sr-only">Filter by topic</span>
									<select
										className="sc-saved-topic-select"
										value={topicFilter}
										onChange={(event) => setTopicFilter(event.target.value)}
									>
										<option value="all">All topics</option>
										{topicOptions.map((topic) => (
											<option key={topic} value={topic}>
												{topic}
											</option>
										))}
									</select>
								</label>
							</div>
						</div>
					</>
				)}

				{!loading && tab === "papers" && papers.length === 0 && ideas.length > 0 && (
					<div className="sc-saved-empty sc-saved-empty-compact">
						<div className="sc-saved-empty-icon" aria-hidden>
							<FileText size={20} strokeWidth={1.75} />
						</div>
						<h2 className="sc-saved-empty-title">No saved papers yet</h2>
						<p className="sc-saved-empty-copy">
							Generate a paper from Research Assistant and it will appear here with its topic and dates.
						</p>
						<Link href={researchPath} className="sc-saved-ghost-btn">
							Start a paper
							<ArrowRight size={14} />
						</Link>
					</div>
				)}

				{!loading && tab === "papers" && papers.length > 0 && sortedPapers.length === 0 && (
					<div className="sc-saved-empty sc-saved-empty-compact">
						<h2 className="sc-saved-empty-title">No matching papers</h2>
						<p className="sc-saved-empty-copy">Try another topic filter or search term.</p>
					</div>
				)}

				{!loading && tab === "papers" && sortedPapers.length > 0 && (
					<section className="sc-saved-section">
						<ul className="sc-saved-list">
							{sortedPapers.map((paper) => {
								const title = resolvePaperDisplayTitle(paper.content, paper.topic);
								const href = savedResearchPagePath(paper.id, variant);
								const words = estimateWords(paper.content);
								const created = formatDateOnly(paper.createdAt);
								const updated = formatWhen(paper.updatedAt);

								return (
									<li key={paper.id} className="sc-saved-card">
										<div className="sc-saved-card-main">
											<Link href={href} className="sc-saved-card-title">
												{title}
											</Link>
											<div className="sc-saved-card-meta">
												<span className="sc-saved-chip">{paper.topic}</span>
												{words > 0 && (
													<span className="sc-saved-meta-item">
														{words.toLocaleString()} words
													</span>
												)}
												<span className="sc-saved-meta-item">Created {created}</span>
												<span className="sc-saved-meta-item">Updated {updated}</span>
											</div>
										</div>
										<div className="sc-saved-card-actions">
											<Link href={href} className="sc-saved-ghost-btn">
												Open
												<ArrowRight size={14} />
											</Link>
											<button
												type="button"
												className="sc-saved-remove"
												disabled={removingId === paper.id}
												aria-label={`Remove ${title}`}
												onClick={() => void handleRemovePaper(paper.id)}
											>
												{removingId === paper.id ? "…" : "Remove"}
											</button>
										</div>
									</li>
								);
							})}
						</ul>
					</section>
				)}

				{!loading && tab === "ideas" && ideas.length === 0 && (
					<div className="sc-saved-empty sc-saved-empty-compact">
						<div className="sc-saved-empty-icon" aria-hidden>
							<Lightbulb size={20} strokeWidth={1.75} />
						</div>
						<h2 className="sc-saved-empty-title">No saved ideas yet</h2>
						<p className="sc-saved-empty-copy">
							Bookmark an idea in Research Assistant and it will show up here with its topic and date.
						</p>
						<Link href={researchPath} className="sc-saved-ghost-btn">
							Browse ideas
							<ArrowRight size={14} />
						</Link>
					</div>
				)}

				{!loading && tab === "ideas" && ideas.length > 0 && sortedIdeas.length === 0 && (
					<div className="sc-saved-empty sc-saved-empty-compact">
						<h2 className="sc-saved-empty-title">No matching ideas</h2>
						<p className="sc-saved-empty-copy">Try another topic filter or search term.</p>
					</div>
				)}

				{!loading && tab === "ideas" && sortedIdeas.length > 0 && (
					<section className="sc-saved-section">
						<ul className="sc-saved-list">
							{sortedIdeas.map((idea) => {
								const removeKey = idea.dbId ?? `${idea.id}:${idea.title}`;
								return (
									<li key={removeKey} className="sc-saved-card">
										<div className="sc-saved-card-main">
											<p className="sc-saved-card-title">{idea.title}</p>
											{idea.rationale && (
												<p className="sc-saved-card-body">{idea.rationale}</p>
											)}
											<div className="sc-saved-card-meta">
												<span className="sc-saved-chip">{idea.topic}</span>
												<span className="sc-saved-meta-item">
													{getDisciplineLabel(idea.discipline)}
												</span>
												<span className="sc-saved-meta-item">{getTypeLabel(idea.type)}</span>
												<span className="sc-saved-meta-item">
													{getFeasibilityLabel(idea.feasibility)}
												</span>
												<span className="sc-saved-meta-item">
													Saved {formatWhen(idea.savedAt)}
												</span>
											</div>
										</div>
										<div className="sc-saved-card-actions">
											<Link href={`${researchPath}?view=saved`} className="sc-saved-ghost-btn">
												Open
												<ArrowRight size={14} />
											</Link>
											<button
												type="button"
												className="sc-saved-remove"
												disabled={removingId === removeKey}
												aria-label={`Remove ${idea.title}`}
												onClick={() => void handleRemoveIdea(idea)}
											>
												{removingId === removeKey ? "…" : "Remove"}
											</button>
										</div>
									</li>
								);
							})}
						</ul>
						<p className="sc-saved-footer-link">
							<Link href={`${researchPath}?view=saved`} className="sc-saved-text-link">
								Manage ideas in Research Assistant
								<ArrowRight size={14} />
							</Link>
						</p>
					</section>
				)}

				{!loading && (
					<section className="sc-saved-section">
						<div className="sc-saved-ideas-card">
							<p className="sc-saved-ideas-copy">
								Browse your topic generation history in Research Assistant.
							</p>
							<Link href={`${researchPath}?view=history`} className="sc-saved-ghost-btn">
								View history
								<ArrowRight size={14} />
							</Link>
						</div>
					</section>
				)}
			</div>
		</div>
	);
}

export function SavedResearchListPage({ variant = "lecturer" }: Props) {
	const page = <SavedResearchListContent variant={variant} />;

	if (variant === "student") {
		return <StudentLayout>{page}</StudentLayout>;
	}

	return <AulaLayout showRightPanel={false}>{page}</AulaLayout>;
}
