export const ALL_ROLES = [
	"lecturer",
	"admin",
	"viewer",
	"researcher",
	"student",
	"governance_admin",
	"faculty_admin",
	"department_admin",
	"compliance_officer",
	"data_protection_officer",
	"research_integrity_officer",
	"auditor",
] as const;

export type AdminConsoleRole = (typeof ALL_ROLES)[number];

export const ADMIN_CONSOLE_ROLES = [
	"admin",
	"governance_admin",
	"faculty_admin",
	"department_admin",
	"compliance_officer",
	"data_protection_officer",
	"research_integrity_officer",
	"auditor",
] as const;

export function isAdminConsoleRole(role: string | null | undefined): role is AdminConsoleRole {
	return Boolean(role && (ADMIN_CONSOLE_ROLES as readonly string[]).includes(role));
}

export function isSuperAdmin(role: string | null | undefined): boolean {
	return role === "admin";
}

export type GovernanceFeature =
	| "dashboard"
	| "analytics"
	| "audit"
	| "alerts"
	| "users"
	| "incidents"
	| "reports"
	| "tokens"
	| "contributions"
	| "provenance"
	| "privacy"
	| "retention"
	| "policies"
	| "risks"
	| "compliance"
	| "inventory"
	| "approvals"
	| "governance_hub"
	| "sessions"
	| "backup";

export type FeatureAction = "view" | "create" | "edit" | "delete" | "export";

const DEFAULT_ROLE_PERMISSIONS: Record<string, Partial<Record<GovernanceFeature, FeatureAction[]>>> = {
	admin: {},
	governance_admin: {},
	compliance_officer: {
		dashboard: ["view"],
		analytics: ["view", "export"],
		audit: ["view", "export"],
		alerts: ["view"],
		incidents: ["view"],
		reports: ["view", "create", "export"],
		risks: ["view", "create", "edit", "export"],
		compliance: ["view", "create", "edit", "delete", "export"],
		inventory: ["view", "export"],
		policies: ["view"],
		contributions: ["view"],
		provenance: ["view"],
		privacy: ["view"],
		retention: ["view"],
		governance_hub: ["view"],
	},
	faculty_admin: {
		dashboard: ["view"],
		analytics: ["view", "export"],
		audit: ["view"],
		alerts: ["view"],
		users: ["view", "create", "edit"],
		incidents: ["view", "create"],
		reports: ["view"],
		tokens: ["view", "edit"],
		contributions: ["view"],
		provenance: ["view"],
		governance_hub: ["view"],
	},
	department_admin: {
		dashboard: ["view"],
		analytics: ["view"],
		users: ["view", "edit"],
		tokens: ["view"],
		contributions: ["view"],
		governance_hub: ["view"],
	},
	data_protection_officer: {
		dashboard: ["view"],
		privacy: ["view", "create", "edit", "delete", "export"],
		retention: ["view", "create", "edit", "delete", "export"],
		audit: ["view", "export"],
		compliance: ["view"],
		governance_hub: ["view"],
	},
	research_integrity_officer: {
		dashboard: ["view"],
		contributions: ["view", "edit", "export"],
		provenance: ["view", "edit", "export"],
		incidents: ["view", "create", "edit"],
		audit: ["view"],
		governance_hub: ["view"],
	},
	auditor: {
		dashboard: ["view"],
		analytics: ["view", "export"],
		audit: ["view", "export"],
		alerts: ["view"],
		incidents: ["view"],
		reports: ["view", "export"],
		tokens: ["view"],
		contributions: ["view"],
		provenance: ["view"],
		privacy: ["view"],
		retention: ["view"],
		policies: ["view"],
		risks: ["view"],
		compliance: ["view"],
		inventory: ["view"],
		approvals: ["view"],
		governance_hub: ["view"],
	},
};

export function hasPermission(
	role: string | null | undefined,
	feature: GovernanceFeature,
	action: FeatureAction,
): boolean {
	if (!role) return false;
	if (role === "admin" || role === "governance_admin") return true;
	const rolePerms = DEFAULT_ROLE_PERMISSIONS[role];
	if (!rolePerms) return false;
	const featurePerms = rolePerms[feature];
	if (!featurePerms) return false;
	return featurePerms.includes(action);
}

export function canAccessFeature(role: string | null | undefined, feature: GovernanceFeature): boolean {
	return hasPermission(role, feature, "view");
}

export function roleLabel(role: string): string {
	const labels: Record<string, string> = {
		admin: "Super Administrator",
		governance_admin: "Governance Administrator",
		faculty_admin: "Faculty Administrator",
		department_admin: "Department Administrator",
		compliance_officer: "Compliance Officer",
		data_protection_officer: "Data Protection Officer",
		research_integrity_officer: "Research Integrity Officer",
		auditor: "Auditor",
		lecturer: "Lecturer",
		researcher: "Researcher",
		student: "Student",
		viewer: "Viewer",
	};
	return labels[role] ?? role;
}

/** Human-readable access summary for admin console roles. */
export function roleAccessSummary(role: string): string[] {
	if (role === "admin" || role === "governance_admin") {
		return ["Full university governance console", "Users, tokens, audit, policies, reports"];
	}
	const perms = DEFAULT_ROLE_PERMISSIONS[role];
	if (!perms) return ["Limited console access"];
	const features = Object.keys(perms);
	if (features.length === 0) return ["Limited console access"];
	return features.map((feature) => {
		const actions = perms[feature as GovernanceFeature] ?? [];
		return `${feature.replace(/_/g, " ")} (${actions.join(", ")})`;
	});
}

export const SUPER_ADMIN_CREATE_ROLES = [
	{ value: "admin" as const, label: "Super Administrator", scope: "platform" as const },
	{ value: "governance_admin" as const, label: "Governance Administrator", scope: "university" as const },
	{ value: "faculty_admin" as const, label: "Faculty Administrator", scope: "university" as const },
	{ value: "department_admin" as const, label: "Department Administrator", scope: "university" as const },
	{ value: "compliance_officer" as const, label: "Compliance Officer", scope: "university" as const },
	{ value: "data_protection_officer" as const, label: "Data Protection Officer", scope: "university" as const },
	{ value: "research_integrity_officer" as const, label: "Research Integrity Officer", scope: "university" as const },
	{ value: "auditor" as const, label: "Auditor", scope: "university" as const },
];

