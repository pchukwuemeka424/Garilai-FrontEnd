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
				label: "AI Governance Hub",
				href: "/admin",
				iconId: "dashboard",
				description: "Student and lecturer AI posture, alerts, integrity",
				instructions:
					"This is the institutional AI governance overview. Compare student vs lecturer AI posture, review open AI alerts and incidents, check integrity coverage, then open a module from the sidebar to investigate — without opening private research content.",
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
					"See how institutional AI is used across faculties, departments, programmes, cohorts, roles, and AI product surfaces (Research, Notebook, portal AI, chapter AI reviewer). Adoption only — private research content stays hidden.",
				feature: "analytics",
			},
			{
				id: "admin-tokens",
				label: "Token Usage Tracking",
				href: "/admin/tokens",
				iconId: "tokens",
				description: "AI consumption by faculty, department, programme, user",
				instructions:
					"Monitor AI token consumption by faculty, department, programme, and individual users. Use this to manage AI cost and capacity risk across student and lecturer accounts.",
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
					"Every AI-governance-relevant action is recorded here, including student and lecturer AI use and administrative actions. Search and filter the tamper-resistant log for accountability and investigations.",
				feature: "audit",
			},
			{
				id: "admin-alerts",
				label: "AI Governance Alerts",
				href: "/admin/alerts",
				iconId: "alert",
				description: "High-risk AI activity, policy breaches, investigation context",
				instructions:
					"Alerts notify you when high-risk AI activity occurs, such as possible sensitive-data exposure or an institutional AI policy breach. Each alert includes context so you can investigate and respond promptly.",
				feature: "alerts",
			},
			{
				id: "admin-incidents",
				label: "Incident Management",
				href: "/admin/incidents",
				iconId: "incident",
				description: "Record, investigate, and resolve AI misuse with full history",
				instructions:
					"Record, investigate, and resolve incidents relating to AI misuse or policy violations. Each incident keeps a complete history of actions, comments, and resolution status.",
				feature: "incidents",
			},
			{
				id: "admin-users",
				label: "User Management",
				href: "/admin/users",
				iconId: "users",
				description: "Activate, suspend, deactivate; roles and account history",
				instructions:
					"Manage student and lecturer accounts that use institutional AI: activate, suspend, or deactivate access. View roles and governance-related account history.",
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
				label: "AI Governance Reporting",
				href: "/admin/reports",
				iconId: "reports",
				description: "Reports for Management, Senate, and external auditors",
				instructions:
					"Generate AI governance reports for university Management, Senate, and external auditors. Reports summarise AI usage, alerts, incidents, policy compliance, and institutional AI adoption. Export as text or CSV.",
				feature: "reports",
			},
		],
	},
	{
		id: "academic-products",
		label: "AI product oversight",
		items: [
			{
				id: "admin-modules",
				label: "AI product modules",
				href: "/admin/modules",
				iconId: "policy",
				description: "Enable or disable AI surfaces for students and lecturers",
				instructions:
					"Turn institutional AI product modules on or off for your university (Research Assistant, Notebook, Student Assessment, Supervision, Advanced Research). Disabled modules are hidden from students and lecturers and blocked at the API.",
				feature: "modules",
			},
			{
				id: "admin-supervision",
				label: "Supervision AI oversight",
				href: "/admin/supervision",
				iconId: "users",
				description: "Metadata overview of AI-linked supervision projects",
				instructions:
					"Oversee supervision projects that use institutional AI. Assign or reassign supervisors and update project status. Document bodies stay private — this is AI product oversight, not a writing desk.",
				feature: "supervision",
			},
			{
				id: "admin-assessment",
				label: "Assessment AI oversight",
				href: "/admin/assessment",
				iconId: "contribution",
				description: "Metadata overview of briefs and AI-linked submissions",
				instructions:
					"Monitor assignment briefs and student submissions tied to institutional AI. Publish or archive briefs and update submission status. Full assignment text remains private — metadata only.",
				feature: "assessment",
			},
		],
	},
	{
		id: "research",
		label: "AI integrity",
		items: [
			{
				id: "admin-contributions",
				label: "AI Contribution Statements",
				href: "/admin/contributions",
				iconId: "contribution",
				description: "Verify AI-assistance records without exposing the work",
				instructions:
					"Verify AI contribution records for research and portal AI outputs. These show how institutional AI assisted academic work without exposing the work itself. Lecturer titles are encrypted in this console.",
				feature: "contributions",
			},
			{
				id: "admin-provenance",
				label: "AI Provenance",
				href: "/admin/provenance",
				iconId: "provenance",
				description: "Verify AI-assisted process history; privacy preserved",
				instructions:
					"Verify provenance history for AI-assisted research and portal outputs when required for academic integrity. Records show process metadata while preserving user privacy.",
				feature: "provenance",
			},
		],
	},
	{
		id: "controls",
		label: "AI controls",
		items: [
			{
				id: "admin-policies",
				label: "AI Policy Management",
				href: "/admin/policies",
				iconId: "policy",
				description: "Institutional AI rules that trigger alerts on violation",
				instructions:
					"Define institutional AI policies for Research, Notebook, portal AI, chapter AI reviewer, and related surfaces. Policies determine acceptable AI use and trigger governance alerts when violated.",
				feature: "policies",
			},
			{
				id: "admin-privacy",
				label: "AI Privacy Controls",
				href: "/admin/privacy",
				iconId: "privacy",
				description: "Rules that govern access to AI-assisted research data",
				instructions:
					"Configure privacy rules for AI-assisted research data. Governance oversight does not provide access to users’ raw materials unless institutional policy explicitly authorises it.",
				feature: "privacy",
			},
			{
				id: "admin-retention",
				label: "Retention & Deletion",
				href: "/admin/retention",
				iconId: "retention",
				description: "Retain, archive, or delete AI governance and research records",
				instructions:
					"Configure how long AI governance records and research-related data are retained, archived, or deleted, in line with institutional and regulatory requirements. Enforcement is configured here for operators to act on.",
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
			{
				id: "super-supervision",
				label: "Supervision",
				href: "/super-admin/supervision",
				iconId: "users",
				description: "Platform supervision projects",
				instructions:
					"Oversee supervision projects across onboarded universities. Assign supervisors and update status without opening private chapter content.",
			},
			{
				id: "super-assessment",
				label: "Student Assessment",
				href: "/super-admin/assessment",
				iconId: "contribution",
				description: "Platform assignment briefs and submissions",
				instructions:
					"Oversee assignment briefs and student submissions across universities. Publish, archive, or update status while keeping submission text private.",
			},
			{
				id: "super-legal",
				label: "Legal pages",
				href: "/super-admin/legal",
				iconId: "policy",
				description: "Terms, Privacy, and AUP",
				instructions:
					"Edit the public Terms of Service, Privacy Policy, and Acceptable Use Policy. Publishing an update bumps the account policy version so users re-accept at next sign-in.",
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
