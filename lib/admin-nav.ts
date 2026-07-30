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
		id: "governance",
		label: "Governance",
		items: [
			{
				id: "admin-governance-hub",
				label: "Governance Dashboard",
				href: "/admin",
				iconId: "dashboard",
				description: "Real-time governance overview, alerts, compliance posture",
				instructions:
					"Use this hub for a live overview of AI governance at your university. Review open alerts and incidents, pending approvals, compliance posture, and high-risk systems before drilling into a specific module from the sidebar.",
				feature: "governance_hub",
			},
			{
				id: "admin-reports",
				label: "Governance Reporting",
				href: "/admin/reports",
				iconId: "reports",
				description: "Generate reports for Management, Senate, auditors",
				instructions:
					"Generate and download governance reports for Management, Senate, or auditors. Choose an audience and period, then review past reports. Use this page when you need formal evidence of AI use, risk, and compliance for institutional reporting.",
				feature: "reports",
			},
		],
	},
	{
		id: "users",
		label: "User Management",
		items: [
			{
				id: "admin-users",
				label: "Account Management",
				href: "/admin/users",
				iconId: "users",
				description: "Activate, suspend, deactivate, role assignment, invitations",
				instructions:
					"Manage university accounts: create or invite users, assign roles, and activate, suspend, or deactivate access. Use this page to control who can use GARIL AI and which governance permissions they hold.",
				feature: "users",
			},
			{
				id: "admin-analytics",
				label: "Usage Analytics",
				href: "/admin/analytics",
				iconId: "analytics",
				description: "Adoption trends, engagement by faculty, department, programme",
				instructions:
					"Track how AI is adopted across faculties, departments, programmes, and roles. Use intensity and feature breakdowns to spot heavy users, underused capabilities, and units that may need training or policy attention.",
				feature: "analytics",
			},
			{
				id: "admin-tokens",
				label: "Token Usage Tracking",
				href: "/admin/tokens",
				iconId: "tokens",
				description: "Quotas, consumption, budgets, forecasting, anomaly detection",
				instructions:
					"Monitor token consumption against quotas, set or reset limits, and investigate anomalies. Use faculty and department budgets plus forecasts to plan capacity and prevent unexpected overuse.",
				feature: "tokens",
			},
		],
	},
	{
		id: "safety",
		label: "Safety & Compliance",
		items: [
			{
				id: "admin-audit",
				label: "Immutable Audit Log",
				href: "/admin/audit",
				iconId: "audit",
				description: "Tamper-resistant, hash-chained, searchable event log",
				instructions:
					"Search the tamper-resistant audit trail of admin and AI governance actions. Flag suspicious events for investigation. Use this page for accountability reviews, incident evidence, and compliance audits.",
				feature: "audit",
			},
			{
				id: "admin-alerts",
				label: "Governance Alerts",
				href: "/admin/alerts",
				iconId: "alert",
				description: "Auto-trigger rules, escalation, notification delivery",
				instructions:
					"Triage governance alerts (policy risks, unusual activity, sensitive-data signals). Acknowledge, investigate, escalate, or resolve each alert. Create manual alerts when you need to open a case outside the automated rules.",
				feature: "alerts",
			},
			{
				id: "admin-incidents",
				label: "Incident Management",
				href: "/admin/incidents",
				iconId: "incident",
				description: "Report, investigate, resolve with SLA tracking",
				instructions:
					"Open and manage formal AI governance incidents with severity, ownership, evidence, and SLA targets. Use this page for breaches, misconduct, model failures, or other events that need a documented response path.",
				feature: "incidents",
			},
			{
				id: "admin-policies",
				label: "Policy Management",
				href: "/admin/policies",
				iconId: "policy",
				description: "Define rules, condition builder, runtime enforcement",
				instructions:
					"Define what is permitted, restricted, or blocked for AI features, tools, datasets, and use cases. Test policies against roles and faculties before enabling them. Conflicts highlight overlapping rules that need resolution.",
				feature: "policies",
			},
		],
	},
	{
		id: "risk",
		label: "Risk & Compliance",
		items: [
			{
				id: "admin-risks",
				label: "Risk Register",
				href: "/admin/risks",
				iconId: "risk",
				description: "Identify, assess, mitigate institutional AI risks",
				instructions:
					"Maintain the institutional AI risk register: score likelihood and impact, assign owners, and track mitigation. Use the heatmap to prioritise high inherent risks and record treatment plans until residual risk is accepted or closed.",
				feature: "risks",
			},
			{
				id: "admin-compliance",
				label: "Compliance Controls",
				href: "/admin/compliance",
				iconId: "compliance",
				description: "NDPR, EU AI Act, ISO 42001, Nigeria AI Act mapping",
				instructions:
					"Map and track controls against frameworks such as NDPR, EU AI Act, ISO 42001, and the Nigeria AI Act. Update status, evidence, and owners so you can show progress against gaps and prepare for audits.",
				feature: "compliance",
			},
			{
				id: "admin-inventory",
				label: "AI System Inventory",
				href: "/admin/inventory",
				iconId: "inventory",
				description: "AI models registry, risk tier, DPIA status",
				instructions:
					"Register every AI system used at the university, classify risk tier, and track DPIA status. Keep owners and review dates current so high-risk or restricted systems stay visible to governance and compliance teams.",
				feature: "inventory",
			},
			{
				id: "admin-approvals",
				label: "Approval Requests",
				href: "/admin/approvals",
				iconId: "approval",
				description: "Tool, dataset, model approval workflows",
				instructions:
					"Review requests to introduce tools, datasets, models, integrations, or use cases. Move items through under review → approved or rejected with notes. Use this queue before new AI resources go live.",
				feature: "approvals",
			},
		],
	},
	{
		id: "research",
		label: "Research Integrity",
		items: [
			{
				id: "admin-contributions",
				label: "AI Contribution Statements",
				href: "/admin/contributions",
				iconId: "contribution",
				description: "Verify AI disclosure records for research outputs",
				instructions:
					"Review and verify AI contribution disclosures attached to research outputs. Check that disclosure forms are complete when AI was used, then mark statements verified. Use this for academic integrity without opening the underlying research content.",
				feature: "contributions",
			},
			{
				id: "admin-provenance",
				label: "Research Provenance",
				href: "/admin/provenance",
				iconId: "provenance",
				description: "Verify AI-assisted research process transparency",
				instructions:
					"Inspect AI-assisted research process records for transparency and integrity. Review provenance chains, clear or escalate records, and keep process metadata auditable for supervisors and integrity officers.",
				feature: "provenance",
			},
		],
	},
	{
		id: "data",
		label: "Data Governance",
		items: [
			{
				id: "admin-privacy",
				label: "Research Privacy Controls",
				href: "/admin/privacy",
				iconId: "privacy",
				description: "Data classification, consent, anonymization rules",
				instructions:
					"Configure how research data classes may be accessed, shared, or anonymised. Enable consent requirements and deny-raw-access rules for sensitive categories so privacy controls stay aligned with NDPR/GDPR expectations.",
				feature: "privacy",
			},
			{
				id: "admin-retention",
				label: "Retention & Deletion",
				href: "/admin/retention",
				iconId: "retention",
				description: "Retention policies, legal hold, deletion requests",
				instructions:
					"Set how long research and platform data is kept, place legal holds when needed, and process subject deletion or export requests. Use this page for lifecycle compliance and responding to erasure requests.",
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
				description: "Papers, notebooks, and uploads",
				instructions:
					"Manage platform research content: saved papers, research notebooks (CanvAtlas projects), and uploaded documents or datasets. Filter by university, inspect details, and delete items when needed for support or compliance.",
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
