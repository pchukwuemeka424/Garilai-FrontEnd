import type { UniversityFeatures } from "@/lib/university-features";
import { DEFAULT_UNIVERSITY_FEATURES } from "@/lib/university-features";

export type StudentNavItem = {
	id: string;
	label: string;
	href: string;
	description?: string;
};

export type StudentQuickTool = StudentNavItem & {
	iconColor: "blue" | "green" | "purple" | "orange" | "pink" | "teal";
};

export const STUDENT_DASHBOARD_ITEM: StudentNavItem = {
	id: "dashboard",
	label: "Dashboard",
	href: "/student/dashboard",
};

export const STUDENT_RESEARCH_ITEM: StudentNavItem = {
	id: "research",
	label: "Research Assistant",
	href: "/student/research",
	description: "Generate and save research ideas for your projects.",
};

export const STUDENT_NOTEBOOK_ITEM: StudentNavItem = {
	id: "notebook",
	label: "Research Notebook",
	href: "/student/research/notebook",
	description: "Capture notes, datasets, figures, and lab work.",
};

/** Student workspace tools shown on the Student Assistant hub (not nested in the sidebar). */
export const STUDENT_PROJECT_FOLDER_ITEMS: StudentQuickTool[] = [
	{
		id: "projects",
		label: "Projects",
		href: "/student/projects",
		description: "Write theses, dissertations, and research folders.",
		iconColor: "orange",
	},
	{
		id: "assignments",
		label: "Assignments",
		href: "/student/assignments",
		description: "Coursework briefs from your lecturers.",
		iconColor: "purple",
	},
	{
		id: "feedback",
		label: "Feedback",
		href: "/student/feedback",
		description: "Supervisor comments on your drafts.",
		iconColor: "pink",
	},
];

export const STUDENT_ASSISTANT_ITEM: StudentNavItem = {
	id: "assistant",
	label: "Student Assessment",
	href: "/student/assistant",
	description: "Projects, assignments, and supervisor feedback.",
};

const STUDENT_ASSISTANT_PREFIXES = [
	"/student/assistant",
	"/student/projects",
	"/student/assignments",
	"/student/feedback",
] as const;

export function isStudentAssistantPath(pathname: string): boolean {
	return STUDENT_ASSISTANT_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
	);
}

export const STUDENT_NAV_ITEMS: StudentNavItem[] = [
	STUDENT_DASHBOARD_ITEM,
	STUDENT_RESEARCH_ITEM,
	STUDENT_NOTEBOOK_ITEM,
	STUDENT_ASSISTANT_ITEM,
];

export function studentNavItemsForFeatures(
	features?: UniversityFeatures | null,
): StudentNavItem[] {
	const flags = features ?? DEFAULT_UNIVERSITY_FEATURES;
	return STUDENT_NAV_ITEMS.filter((item) => {
		if (item.id === "research") return flags.researchAssistant;
		if (item.id === "notebook") return flags.researchNotebook;
		if (item.id === "assistant") return flags.studentAssessment;
		return true;
	});
}

export const STUDENT_BOARD_COLUMNS = [
	{ id: "saved" as const, label: "Saved", hint: "Ideas you've bookmarked" },
	{ id: "in_progress" as const, label: "In progress", hint: "Ideas you're working on" },
	{ id: "completed" as const, label: "Completed", hint: "Finished research topics" },
];
