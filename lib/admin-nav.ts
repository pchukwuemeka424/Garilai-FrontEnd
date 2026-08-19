export type AdminNavItem = {
	id: string;
	label: string;
	href: string;
	iconId: string;
	/** Short sidebar hint */
	description?: string;
	/** Longer on-page guide explaining what the page is for */
	instructions?: string;
	feature?: string;
};

export type AdminNavGroup = {
	id: string;
	label: string;
	items: AdminNavItem[];
};

export const ADMIN_LOGIN_PATH = "/admin/login";
export const SUPER_ADMIN_LOGIN_PATH = "/super-admin/login";
export const SUPER_ADMIN_HOME_PATH = "/super-admin";

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
	{
		id: "overview",
		label: "Overview",
		items: [
			{
				id: "admin-governance-hub",
				label: "Governance Dashboard",
				href: "/admin",
				iconId: "dashboard",
				description: "Real-time AI use, alerts, adoption, platform health",
				instructions:
					"This is the single real-time overview of AI use at your institution. Review key governance metrics, active alerts, adoption trends, and platform health, then open a module from the sidebar to investigate.",
				feature: "governance_hub",
			},
		],
	},
	{
		id: "usage",
		label: "Usage",
		items: [
			{
				id: "admin-analytics",
				label: "Usage Analytics",
				href: "/admin/analytics",
				iconId: "analytics",
				description: "Adoption by faculty, department, programme, cohort",
				instructions:
					"See how GARIL AI is used across faculties, departments, programmes, and cohorts. Review adoption and engagement without opening private research content.",
				feature: "analytics",
			},
			{
				id: "admin-tokens",
				label: "Token Usage Tracking",
				href: "/admin/tokens",
				iconId: "tokens",
				description: "Consumption by faculty, department, programme, user",
				instructions:
					"Monitor AI token consumption by faculty, department, programme, and individual users. Use this to manage operational cost, spot unusually high usage, and plan capacity.",
				feature: "tokens",
			},
		],
	},
	{
		id: "accountability",
		label: "Accountability",
		items: [
			{
				id: "admin-audit",
				label: "Immutable Audit Log",
				href: "/admin/audit",
				iconId: "audit",
				description: "Searchable, filterable, tamper-resistant event log",
				instructions:
					"Every governance-relevant action on the platform is recorded here, including user and administrative actions. Search and filter the tamper-resistant log for accountability and investigations.",
				feature: "audit",
			},
			{
				id: "admin-alerts",
				label: "Governance Alerts",
				href: "/admin/alerts",
				iconId: "alert",
				description: "High-risk activity, policy breaches, investigation context",
				instructions:
					"Alerts notify you when high-risk activity occurs, such as possible sensitive-data exposure or an institutional policy breach. Each alert includes context so you can investigate and respond promptly.",
				feature: "alerts",
			},
			{
				id: "admin-incidents",
				label: "Incident Management",
				href: "/admin/incidents",
				iconId: "incident",
				description: "Record, investigate, and resolve with full history",
				instructions:
					"Record, investigate, and resolve incidents relating to platform misuse or policy violations. Each incident keeps a complete history of actions, comments, and resolution status.",
				feature: "incidents",
			},
			{
				id: "admin-users",
				label: "User Management",
				href: "/admin/users",
				iconId: "users",
				description: "Activate, suspend, deactivate; roles and account history",
				instructions:
					"Manage user accounts: activate, suspend, or deactivate access as needed. View user status, assigned roles, and governance-related account history.",
				feature: "users",
			},
		],
	},
	{
		id: "reporting",
		label: "Reporting",
		items: [
			{
				id: "admin-reports",
				label: "Governance Reporting",
				href: "/admin/reports",
				iconId: "reports",
				description: "Reports for Management, Senate, and external auditors",
				instructions:
					"Generate governance reports for university Management, Senate, and external auditors. Reports summarise platform usage, governance activity, incidents, policy compliance, and institutional AI adoption.",
				feature: "reports",
			},
		],
	},
	{
		id: "research",
		label: "Research integrity",
		items: [
			{
				id: "admin-contributions",
				label: "AI Contribution Statements",
				href: "/admin/contributions",
				iconId: "contribution",
				description: "Verify AI-assistance records without exposing the work",
				instructions:
					"Verify that AI contribution records have been generated for research outputs. These records show how GARIL AI assisted a piece of academic work without exposing the work itself. Lecturer research titles are encrypted in this console.",
				feature: "contributions",
			},
			{
				id: "admin-provenance",
				label: "Research Provenance",
				href: "/admin/provenance",
				iconId: "provenance",
				description: "Verify AI-assisted process history; privacy preserved",
				instructions:
					"Authorised reviewers can verify the provenance history of a research output when required for academic integrity. The record shows the AI-assisted process while preserving user privacy. Lecturer research titles are encrypted here.",
				feature: "provenance",
			},
		],
	},
	{
		id: "controls",
		label: "Controls",
		items: [
			{
				id: "admin-policies",
				label: "Policy Management",
				href: "/admin/policies",
				iconId: "policy",
				description: "Institutional AI rules that trigger alerts on violation",
				instructions:
					"Define and manage institutional AI policies that apply within GARIL AI. Policies determine acceptable AI use, trigger governance alerts when violated, and provide a consistent governance framework.",
				feature: "policies",
			},
			{
				id: "admin-privacy",
				label: "Research Privacy Controls",
				href: "/admin/privacy",
				iconId: "privacy",
				description: "Rules that govern access to user research data",
				instructions:
					"Configure and enforce privacy rules that govern access to user research data. Governance oversight does not provide access to users’ raw research materials unless institutional policy explicitly authorises it.",
				feature: "privacy",
			},
			{
				id: "admin-retention",
				label: "Retention & Deletion",
				href: "/admin/retention",
				iconId: "retention",
				description: "Retain, archive, or delete governance and research records",
				instructions:
					"Configure how long governance records and research-related data are retained, archived, or deleted, in line with institutional and regulatory requirements.",
				feature: "retention",
			},
		],
	},
];

export const SUPER_ADMIN_NAV_GROUPS: AdminNavGroup[] = [
	{
		id: "platform",
		label: "Platform",
		items: [
			{
				id: "super-overview",
				label: "Platform overview",
				href: "/super-admin",
				iconId: "dashboard",
				description: "Onboarded universities and admin coverage",
				instructions:
					"See platform-wide coverage of onboarded universities and their admin accounts. Use this overview to spot institutions that still need setup or lack university administrators.",
			},
			{
				id: "super-universities",
				label: "Universities",
				href: "/super-admin/universities",
				iconId: "dashboard",
				description: "Onboard and activate universities",
				instructions:
					"Onboard new universities and activate or update institution records. Each university becomes a tenant so its admins and users only see their own governance data. Open a university for tenant-level user and admin management, and set default token allowances for students and lecturers.",
			},
			{
				id: "super-users",
				label: "All users",
				href: "/super-admin/users",
				iconId: "users",
				description: "Platform-wide accounts, suspend, delete",
				instructions:
					"Manage every account across onboarded universities: open full user details, create students and lecturers, suspend or delete users, reset passwords, and filter by institution or role.",
			},
			{
				id: "super-admins",
				label: "Admins",
				href: "/super-admin/admins",
				iconId: "users",
				description: "Super admins and university console admins",
				instructions:
					"Create platform super administrators or university console roles for onboarded institutions. Use filters, bulk actions, and the detail panel to manage access, reset passwords, suspend, or delete admins.",
			},
			{
				id: "super-tokens",
				label: "Token management",
				href: "/super-admin/tokens",
				iconId: "tokens",
				description: "Quotas, usage, university defaults",
				instructions:
					"Monitor token usage across the platform, reset or adjust individual allowances, and set default student and lecturer token quotas for each onboarded university.",
			},
			{
				id: "super-activities",
				label: "Activities",
				href: "/super-admin/activities",
				iconId: "audit",
				description: "Platform-wide admin and system activity",
				instructions:
					"Review platform-wide activity across universities: onboarding, user changes, token updates, and governance events. Filter by category or severity to investigate recent actions.",
			},
			{
				id: "super-research",
				label: "Research content",
				href: "/super-admin/research",
				iconId: "research",
				description: "Papers and uploads",
				instructions:
					"Manage platform research content: saved papers and uploaded documents or datasets. Filter by university, inspect details, and delete items when needed for support or compliance.",
			},
		],
	},
];

export function adminNavGroupsForRole(role: string | null | undefined): AdminNavGroup[] {
	if (role === "admin") return SUPER_ADMIN_NAV_GROUPS;
	return ADMIN_NAV_GROUPS;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((group) => group.items);
export const SUPER_ADMIN_NAV_ITEMS: AdminNavItem[] = SUPER_ADMIN_NAV_GROUPS.flatMap(
	(group) => group.items,
);

export function adminHrefPath(href: string): string {
	return href.split("#")[0] ?? href;
}

export function isAdminNavActive(pathname: string, href: string): boolean {
	const path = adminHrefPath(href);
	if (path === "/admin" || path === "/super-admin") return pathname === path;
	return pathname === path || pathname.startsWith(`${path}/`);
}

/** Resolve the on-page instructions for the current admin route. */
export function adminPageInstructionsForPath(
	pathname: string,
	items: AdminNavItem[] = ADMIN_NAV_ITEMS,
): string | undefined {
	const exact = items.find((item) => adminHrefPath(item.href) === pathname);
	if (exact?.instructions) return exact.instructions;

	const match = items.find((item) => isAdminNavActive(pathname, item.href));
	return match?.instructions;
}
