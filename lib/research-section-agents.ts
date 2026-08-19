import { SCOPE_OPTIONS, type ResearchScope } from "@/lib/research-ideas";
import { getScopeProfile, type CiteFloor } from "@/lib/research-scope-profiles";

export type ResearchSectionAgent = {
	heading: string;
	name: string;
	role: string;
	work: string;
	citeFloor: CiteFloor;
};

type AgentCopy = {
	heading: string;
	name: string;
	role: string;
	work: string;
};

const ZERO_CITES: CiteFloor = { min: 0, max: 0 };

const AGENT_COPY: Record<
	"assignment" | "conference" | "journal" | "dissertation" | "thesis" | "undergraduate_project",
	AgentCopy[]
> = {
	assignment: [
		{
			heading: "Introduction",
			name: "Introduction Agent",
			role: "Frame the assignment",
			work: "State the topic, aims, and why it matters. No Methods or Results.",
		},
		{
			heading: "Literature Review",
			name: "Literature Review Agent",
			role: "Thematic mapper",
			work: "Short thematic review of debates and gaps — not paper-by-paper.",
		},
		{
			heading: "Critical Analysis",
			name: "Critical Analysis Agent",
			role: "Argumentative core",
			work: "Evaluate claims, compare perspectives, take a reasoned position. Never invent empirical findings.",
		},
		{
			heading: "Conclusion",
			name: "Conclusion Agent",
			role: "Closer",
			work: "Takeaways tied to the assignment question.",
		},
	],
	conference: [
		{
			heading: "Abstract",
			name: "Abstract Agent",
			role: "Compact summary",
			work: "≤150 words covering gap, method, headline finding, implication.",
		},
		{
			heading: "Introduction",
			name: "Introduction Agent",
			role: "Gap setter",
			work: "Problem, gap, and contribution claim for a conference page limit.",
		},
		{
			heading: "Methods",
			name: "Methods Agent",
			role: "Concise designer",
			work: "Reproducible but compact methods (design, sample, instruments, analysis).",
		},
		{
			heading: "Results",
			name: "Results Agent",
			role: "Evidence reporter",
			work: "Report findings only — no interpretation.",
		},
		{
			heading: "Discussion",
			name: "Discussion Agent",
			role: "Interpreter",
			work: "Read results against the literature.",
		},
		{
			heading: "Conclusion",
			name: "Conclusion Agent",
			role: "Closer",
			work: "Focused implications; no thesis-style expansion.",
		},
	],
	journal: [
		{
			heading: "Abstract",
			name: "Abstract Agent",
			role: "Article summary",
			work: "Cover the gap, method, headline finding, and implication for a journal audience.",
		},
		{
			heading: "Introduction",
			name: "Introduction Agent",
			role: "Gap setter",
			work: "Problem, thematic literature, and contribution claim — no standalone Literature Review.",
		},
		{
			heading: "Methods",
			name: "Methods Agent",
			role: "Reproducible designer",
			work: "Design, sample, instruments, procedure, and analysis another researcher could repeat.",
		},
		{
			heading: "Results",
			name: "Results Agent",
			role: "Evidence reporter",
			work: "Report findings only — no interpretation.",
		},
		{
			heading: "Discussion",
			name: "Discussion Agent",
			role: "Interpreter",
			work: "Read results against the literature and include explicit Limitations.",
		},
		{
			heading: "Conclusion",
			name: "Conclusion Agent",
			role: "Closer",
			work: "Synthesis and implications for a journal / research paper.",
		},
	],
	dissertation: [
		{
			heading: "Abstract",
			name: "Abstract Agent",
			role: "Compact doctoral summary",
			work: "300–500 words covering problem, method, headline findings, and contributions.",
		},
		{
			heading: "Introduction",
			name: "Introduction Agent",
			role: "Doctoral framing",
			work: "Problem, aims, and novelty of the study.",
		},
		{
			heading: "Literature Review",
			name: "Literature Review Agent",
			role: "Field mapper",
			work: "Substantial thematic review of the field.",
		},
		{
			heading: "Theoretical Framework",
			name: "Theoretical Framework Agent",
			role: "Theory builder",
			work: "Lenses and constructs, kept distinct from the literature review.",
		},
		{
			heading: "Methodology",
			name: "Methodology Agent",
			role: "Design authority",
			work: "Reproducible doctoral methods.",
		},
		{
			heading: "Results",
			name: "Results Agent",
			role: "Evidence reporter",
			work: "Findings only.",
		},
		{
			heading: "Discussion",
			name: "Discussion Agent",
			role: "Interpreter",
			work: "Results against literature and theory.",
		},
		{
			heading: "Conclusion",
			name: "Conclusion Agent",
			role: "Closer",
			work: "Synthesis of the doctoral study.",
		},
		{
			heading: "Contributions",
			name: "Contributions Agent",
			role: "Novelty claimant",
			work: "State novel scholarly contributions.",
		},
	],
	thesis: [
		{
			heading: "Abstract",
			name: "Abstract Agent",
			role: "Compact thesis summary",
			work: "250–350 words covering problem, method, headline findings, and implication.",
		},
		{
			heading: "Introduction",
			name: "Introduction Agent",
			role: "Master's framing",
			work: "Problem, aims, and bounded original scope.",
		},
		{
			heading: "Literature Review",
			name: "Literature Review Agent",
			role: "Field mapper",
			work: "Substantial thematic literature, not a journal intro.",
		},
		{
			heading: "Methodology",
			name: "Methodology Agent",
			role: "Design authority",
			work: "Reproducible methods.",
		},
		{
			heading: "Findings / Results",
			name: "Findings / Results Agent",
			role: "Evidence reporter",
			work: "Evidence only — no interpretation.",
		},
		{
			heading: "Discussion",
			name: "Discussion Agent",
			role: "Interpreter",
			work: "Findings against the literature.",
		},
		{
			heading: "Conclusion",
			name: "Conclusion Agent",
			role: "Closer",
			work: "Synthesis of the thesis.",
		},
		{
			heading: "Recommendations",
			name: "Recommendations Agent",
			role: "Practice advisor",
			work: "Actionable recommendations, distinct from Conclusion.",
		},
	],
	undergraduate_project: [
		{
			heading: "Abstract",
			name: "Abstract Agent",
			role: "Project summary",
			work: "150–250 words covering topic, method/approach, key results, and implication.",
		},
		{
			heading: "Chapter One: Introduction",
			name: "Chapter One: Introduction Agent",
			role: "Project framing",
			work: "Topic, aims, and project scope.",
		},
		{
			heading: "Chapter Two: Literature Review",
			name: "Chapter Two: Literature Review Agent",
			role: "Field mapper",
			work: "Thematic review for the project.",
		},
		{
			heading: "Chapter Three: System Analysis and Methodology",
			name: "Chapter Three: System Analysis and Methodology Agent",
			role: "Analyst / designer",
			work: "Analysis and methodology for the system or study.",
		},
		{
			heading: "Chapter Four: System Design and Implementation",
			name: "Chapter Four: System Design and Implementation Agent",
			role: "Builder",
			work: "Design and implementation of the system.",
		},
		{
			heading: "Chapter Five: Testing and Results",
			name: "Chapter Five: Testing and Results Agent",
			role: "Evidence reporter",
			work: "Testing and results only.",
		},
		{
			heading: "Chapter Six: Discussion",
			name: "Chapter Six: Discussion Agent",
			role: "Interpreter",
			work: "Interpret testing/results.",
		},
		{
			heading: "Chapter Seven: Conclusion and Recommendations",
			name: "Chapter Seven: Conclusion and Recommendations Agent",
			role: "Closer",
			work: "Conclude and recommend.",
		},
	],
};

function formatCiteHint(floor: CiteFloor): string {
	if (floor.min === 0 && floor.max === 0) return "0 cites.";
	return `${floor.min}–${floor.max} cites.`;
}

function withCiteFloor(copy: AgentCopy, floor: CiteFloor): ResearchSectionAgent {
	const hint = formatCiteHint(floor);
	const work = copy.work.replace(/\s+$/, "");
	const suffix = work.endsWith(".") ? ` ${hint}` : `. ${hint}`;
	return {
		heading: copy.heading,
		name: copy.name,
		role: copy.role,
		work: `${work}${suffix}`,
		citeFloor: floor,
	};
}

export function sectionAgentSlug(heading: string | null | undefined): string {
	return (heading ?? "")
		.trim()
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function getResearchSectionAgents(scope: string | null | undefined): ResearchSectionAgent[] {
	const profile = getScopeProfile(scope);
	const copy = AGENT_COPY[profile.scope as keyof typeof AGENT_COPY];
	if (!copy) return [];
	return copy.map((agent) =>
		withCiteFloor(agent, profile.citationFloors[agent.heading] ?? ZERO_CITES),
	);
}

export function findSectionAgent(
	scope: string | null | undefined,
	section: string | null | undefined,
): ResearchSectionAgent | undefined {
	const slug = sectionAgentSlug(section);
	if (!slug) return undefined;
	return getResearchSectionAgents(scope).find(
		(agent) => sectionAgentSlug(agent.heading) === slug || sectionAgentSlug(agent.name) === slug,
	);
}

export function getResearchSectionAgentGroups(): Array<{
	scope: ResearchScope;
	label: string;
	hint: string;
	agents: ResearchSectionAgent[];
}> {
	return SCOPE_OPTIONS.map((opt) => ({
		scope: opt.id,
		label: opt.label,
		hint: opt.hint,
		agents: getResearchSectionAgents(opt.id),
	}));
}

export function sectionAgentKicker(
	baseKicker: string,
	agent: ResearchSectionAgent | undefined,
): string {
	if (!agent) return baseKicker;
	return `${baseKicker} · ${agent.name} — ${agent.role}`;
}
