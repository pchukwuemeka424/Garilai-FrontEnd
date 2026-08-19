import { normalizeResearchScope, type ResearchScope } from "@/lib/research-ideas";
import { sectionAgentSlug } from "@/lib/research-section-agents";

export const RESEARCH_GENERATE_PATH = {
	lecturer: "/research/generate",
	student: "/student/research/generate",
} as const;

/** Static /research/* segments that must not be treated as a workspace type slug. */
export const RESEARCH_RESERVED_SEGMENTS = new Set([
	"generate",
	"outline",
	"saved",
	"note",
	"notebook",
]);

const SCOPE_SLUGS: Record<ResearchScope, string> = {
	assignment: "assignment",
	conference: "conference-paper",
	journal: "journal",
	report: "report",
	proposal: "proposal",
	faculty: "faculty",
	thesis: "thesis",
	dissertation: "dissertation",
	undergraduate_project: "undergraduate-project",
};

const SLUG_TO_SCOPE: Record<string, ResearchScope> = Object.fromEntries(
	Object.entries(SCOPE_SLUGS).map(([scope, slug]) => [slug, scope as ResearchScope]),
) as Record<string, ResearchScope>;

/** Older URL segments still resolve to a current research type. */
const LEGACY_SLUG_TO_SCOPE: Record<string, ResearchScope> = {
	paper: "journal",
	conference: "conference",
};

export function scopeToSlug(scope: string | null | undefined): string {
	const normalized = normalizeResearchScope(scope) || "journal";
	return SCOPE_SLUGS[normalized];
}

export function slugToScope(slug: string | null | undefined): ResearchScope | "" {
	if (!slug) return "";
	const trimmed = slug.trim().toLowerCase();
	return SLUG_TO_SCOPE[trimmed] ?? LEGACY_SLUG_TO_SCOPE[trimmed] ?? "";
}

export function canonicalResearchScopeSlug(slug: string | null | undefined): string {
	const scope = slugToScope(slug);
	return scope ? scopeToSlug(scope) : "";
}

export function isResearchWorkspaceSlug(slug: string | null | undefined): boolean {
	if (!slug) return false;
	const trimmed = slug.trim().toLowerCase();
	if (RESEARCH_RESERVED_SEGMENTS.has(trimmed)) return false;
	return Boolean(slugToScope(trimmed));
}

export function researchWorkspaceBasePath(
	scope: string | null | undefined,
	variant: "lecturer" | "student" = "lecturer",
): string {
	const slug = scopeToSlug(scope);
	return variant === "student" ? `/student/research/${slug}` : `/research/${slug}`;
}

export function researchScopeBriefPath(
	scope: string | null | undefined,
	variant: "lecturer" | "student" = "lecturer",
	discipline?: string | null,
	section?: string | null,
): string {
	const base = researchWorkspaceBasePath(scope, variant);
	const params = new URLSearchParams();
	const id = discipline?.trim();
	if (id) params.set("discipline", id);
	const slug = sectionAgentSlug(section);
	if (slug) params.set("section", slug);
	const query = params.toString();
	return query ? `${base}?${query}` : base;
}

/** @deprecated Use researchScopeBriefPath("assignment", variant, discipline) */
export function researchAssignmentBriefPath(
	variant: "lecturer" | "student" = "lecturer",
	discipline?: string | null,
): string {
	return researchScopeBriefPath("assignment", variant, discipline);
}

function parseResearchWorkspaceSlug(pathname: string | null | undefined): string | null {
	if (!pathname) return null;
	const lecturer = pathname.match(/^\/research\/([^/?#]+)\/?$/);
	if (lecturer?.[1]) return lecturer[1];
	const student = pathname.match(/^\/student\/research\/([^/?#]+)\/?$/);
	if (student?.[1]) return student[1];
	return null;
}

export function isResearchWorkspacePath(pathname: string | null | undefined): boolean {
	const slug = parseResearchWorkspaceSlug(pathname);
	return isResearchWorkspaceSlug(slug);
}

export function parseScopeFromPathname(pathname: string | null | undefined): ResearchScope | "" {
	const slug = parseResearchWorkspaceSlug(pathname);
	return slugToScope(slug);
}

export function researchGeneratePagePath(
	key: string,
	variant: "lecturer" | "student" = "lecturer",
): string {
	const base = variant === "student" ? RESEARCH_GENERATE_PATH.student : RESEARCH_GENERATE_PATH.lecturer;
	return `${base}?key=${encodeURIComponent(key)}`;
}

export function researchPaperWorkspacePath(
	topic: string,
	variant: "lecturer" | "student" = "lecturer",
	key?: string,
	scope?: string | null,
): string {
	const trimmed = topic.trim();
	const base = researchWorkspaceBasePath(scope, variant);
	const params = new URLSearchParams();
	params.set("generate", "1");
	if (trimmed) params.set("topic", trimmed);
	if (key?.trim()) params.set("key", key.trim());
	return `${base}?${params.toString()}`;
}
