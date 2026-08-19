export type AulaNavItem = {
	id: string;
	label: string;
	href: string;
	description?: string;
	adminOnly?: boolean;
	badge?: string;
};

export type AulaNavGroup = {
	id: string;
	label: string;
	items: AulaNavItem[];
};

export type QuickAccessTool = AulaNavItem & {
	iconColor: "blue" | "green" | "purple" | "orange" | "pink" | "teal";
};

/** Tools shown on /dashboard quick access — sidebar nav is derived from this list. */
export const AULA_QUICK_ACCESS: QuickAccessTool[] = [
	{
		id: "research",
		label: "Research Assistant",
		href: "/research",
		description: "Develop research ideas with cited references in your house style.",
		iconColor: "blue",
	},
	{
		id: "notebook",
		label: "Research Notebook",
		href: "/research/notebook",
		description: "Capture notes, datasets, figures, and lab work.",
		iconColor: "teal",
	},
	{
		id: "projects",
		label: "Projects",
		href: "/supervision/projects",
		description: "Supervise theses, dissertations, and student research folders.",
		iconColor: "orange",
	},
	{
		id: "reviews",
		label: "Reviews",
		href: "/reviews",
		description: "Review submitted chapters and assignment drafts.",
		iconColor: "green",
	},
	{
		id: "assignments",
		label: "Assignments",
		href: "/assignments",
		description: "Publish briefs, mark submissions, and export scores.",
		iconColor: "purple",
	},
	{
		id: "students",
		label: "Students",
		href: "/students",
		description: "Track supervisees and their progress.",
		iconColor: "teal",
	},
	{
		id: "analytics",
		label: "Analytics",
		href: "/analytics",
		description: "A snapshot of supervision activity in this workspace.",
		iconColor: "pink",
	},
];

const AULA_PROJECT_FOLDER_IDS = [
	"projects",
	"reviews",
	"assignments",
	"students",
	"analytics",
] as const;

const AULA_SUPERVISION_NOTIFICATION: QuickAccessTool = {
	id: "notifications",
	label: "Notifications",
	href: "/notifications",
	description: "Alerts from student submissions and project activity.",
	iconColor: "pink",
};

/** Supervision tools shown on the Supervision Assistant hub (not nested in the sidebar). */
export const AULA_PROJECT_FOLDER_ITEMS: QuickAccessTool[] = [
	...AULA_QUICK_ACCESS.filter((tool) =>
		(AULA_PROJECT_FOLDER_IDS as readonly string[]).includes(tool.id),
	),
	AULA_SUPERVISION_NOTIFICATION,
];

export const AULA_SUPERVISION_ITEM: AulaNavItem = {
	id: "supervision",
	label: "Supervision Assistant",
	href: "/supervision",
	description: "Projects, reviews, assignments, students, and analytics.",
};

const SUPERVISION_ACTIVE_PREFIXES = [
	"/supervision",
	"/reviews",
	"/assignments",
	"/students",
	"/analytics",
	"/notifications",
] as const;

export function isSupervisionPath(pathname: string): boolean {
	return SUPERVISION_ACTIVE_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
	);
}

export const AULA_RESEARCH_ITEM: AulaNavItem = {
	id: "research",
	label: "Research Assistant",
	href: "/research",
	description: AULA_QUICK_ACCESS.find((t) => t.id === "research")?.description,
};

export const AULA_NOTEBOOK_ITEM: AulaNavItem = {
	id: "notebook",
	label: "Research Notebook",
	href: "/research/notebook",
	description: AULA_QUICK_ACCESS.find((t) => t.id === "notebook")?.description,
};

/** Post-login hub cards on /dashboard — primary workspace entry points. */
export const AULA_HUB_TOOLS: QuickAccessTool[] = AULA_QUICK_ACCESS;

export type AulaTopbarNavItem = AulaNavItem & {
	/** `exact` matches only the path; `prefix` also matches nested routes. */
	match?: "exact" | "prefix";
};

export const AULA_DASHBOARD_ITEM: AulaNavItem = {
	id: "dashboard",
	label: "Dashboard",
	href: "/dashboard",
};

export type AulaTopbarContext = {
	title: string;
	tagline: string;
	cta?: { label: string; href: string };
};

const AULA_TOPBAR_DEFAULT: AulaTopbarContext = {
	title: "Dashboard",
	tagline: "Teaching and research workspace for higher institutions",
};

/** Primary navigation shown in the dashboard top bar — one item per lecturer workspace page. */
export const AULA_TOPBAR_NAV: AulaTopbarNavItem[] = [
	{
		id: "dashboard",
		label: "Overview",
		href: "/dashboard",
		match: "exact",
		description: AULA_TOPBAR_DEFAULT.tagline,
	},
	{
		id: "research",
		label: "Research",
		href: "/research",
		match: "prefix",
		description: AULA_QUICK_ACCESS.find((t) => t.id === "research")?.description,
	},
	{
		id: "projects",
		label: "Projects",
		href: "/supervision/projects",
		match: "prefix",
		description: AULA_QUICK_ACCESS.find((t) => t.id === "projects")?.description,
	},
	{
		id: "reviews",
		label: "Reviews",
		href: "/reviews",
		match: "prefix",
		description: AULA_QUICK_ACCESS.find((t) => t.id === "reviews")?.description,
	},
	{
		id: "assignments",
		label: "Assignments",
		href: "/assignments",
		match: "prefix",
		description: AULA_QUICK_ACCESS.find((t) => t.id === "assignments")?.description,
	},
	{
		id: "students",
		label: "Students",
		href: "/students",
		match: "prefix",
		description: AULA_QUICK_ACCESS.find((t) => t.id === "students")?.description,
	},
	{
		id: "analytics",
		label: "Analytics",
		href: "/analytics",
		match: "prefix",
		description: AULA_QUICK_ACCESS.find((t) => t.id === "analytics")?.description,
	},
];

export function isAulaTopbarItemActive(pathname: string, item: AulaTopbarNavItem): boolean {
	const base = aulaHrefPath(item.href);

	if (item.id === "research" && (pathname === "/dashboard/research" || pathname.startsWith("/dashboard/research/"))) {
		return true;
	}

	if (item.match === "prefix") {
		return pathname === base || pathname.startsWith(`${base}/`);
	}

	return pathname === base || pathname === `${base}/`;
}

function topbarTitleForItem(item: AulaTopbarNavItem): string {
	if (item.id === "dashboard") return AULA_TOPBAR_DEFAULT.title;
	const tool = AULA_QUICK_ACCESS.find((t) => t.id === item.id);
	if (tool) return tool.label;
	return item.label;
}

function topbarCtaForItem(item: AulaTopbarNavItem): AulaTopbarContext["cta"] {
	switch (item.id) {
		case "research":
			return undefined;
		case "projects":
			return undefined;
		case "reviews":
			return undefined;
		case "assignments":
			return { label: "New Assignment", href: "/assignments/new" };
		case "students":
			return undefined;
		case "analytics":
			return undefined;
		default:
			return undefined;
	}
}

export function aulaTopbarContext(pathname: string): AulaTopbarContext {
	if (pathname === "/supervision" || pathname === "/supervision/") {
		return {
			title: "Supervision Assistant",
			tagline: AULA_SUPERVISION_ITEM.description ?? AULA_TOPBAR_DEFAULT.tagline,
		};
	}

	if (pathname === "/notifications" || pathname.startsWith("/notifications/")) {
		return {
			title: "Notifications",
			tagline: AULA_SUPERVISION_NOTIFICATION.description ?? AULA_TOPBAR_DEFAULT.tagline,
			cta: { label: "Open inbox", href: "/notifications" },
		};
	}

	const onNotebook =
		pathname === "/research/notebook" || pathname.startsWith("/research/notebook/");
	if (onNotebook) {
		const onDetail = pathname.startsWith("/research/notebook/");
		return {
			title: "Research Notebook",
			tagline: "Capture notes, surveys, datasets, figures, and lab work",
			cta: onDetail
				? { label: "Compile note", href: pathname }
				: { label: "Create notebook", href: "/research/notebook?new=1" },
		};
	}

	const activeItem = AULA_TOPBAR_NAV.find((item) => isAulaTopbarItemActive(pathname, item));
	if (!activeItem) return AULA_TOPBAR_DEFAULT;
	if (activeItem.id === "dashboard") return AULA_TOPBAR_DEFAULT;

	const onAssignmentsList = pathname === "/assignments" || pathname === "/assignments/";
	const onSupervision = pathname === "/supervision" || pathname.startsWith("/supervision/");

	return {
		title: topbarTitleForItem(activeItem),
		tagline: activeItem.description ?? AULA_TOPBAR_DEFAULT.tagline,
		cta:
			onSupervision || (activeItem.id === "assignments" && onAssignmentsList)
				? undefined
				: topbarCtaForItem(activeItem),
	};
}

export const AULA_MAIN_NAV: AulaNavGroup = {
	id: "main",
	label: "Main",
	items: [AULA_DASHBOARD_ITEM, AULA_RESEARCH_ITEM, AULA_NOTEBOOK_ITEM, AULA_SUPERVISION_ITEM],
};

export const AULA_ADMIN_ITEM: AulaNavItem = {
	id: "admin",
	label: "Admin",
	href: "/admin",
	adminOnly: true,
};

export const AULA_NAV_GROUPS: AulaNavGroup[] = [AULA_MAIN_NAV];

export function aulaHrefPath(href: string): string {
	return href.split("#")[0] ?? href;
}

export function aulaHrefHash(href: string): string | null {
	const hash = href.split("#")[1];
	return hash ? `#${hash}` : null;
}
