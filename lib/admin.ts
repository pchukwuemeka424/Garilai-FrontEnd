import type { StudentTokenQuota } from "@/lib/student-tokens";

export type AdminTokenRecord = {
	id: string;
	name: string;
	email: string;
	role: string;
	faculty?: string | null;
	department?: string | null;
	programme?: string | null;
	universityId?: string | null;
	institution?: string | null;
	tokenAllowance?: number | null;
	tokenQuota: StudentTokenQuota | null;
};

export type TokenAdminStats = {
	userCount: number;
	studentsWithQuota: number;
	lecturersWithQuota: number;
	totalTokensUsed: number;
	dailyTokensApprox?: number;
	weeklyTokensApprox?: number;
	monthlyTokensApprox?: number;
	estimatedCost?: number;
	byFaculty?: Array<{ key: string; label: string; users: number; tokensUsed: number; allowance: number }>;
	byDepartment?: Array<{ key: string; label: string; users: number; tokensUsed: number; allowance: number }>;
	byProgramme?: Array<{ key: string; label: string; users: number; tokensUsed: number; allowance: number }>;
};

export type UpdateTokenInput = {
	reset?: boolean;
	tokensUsed?: number;
	tokenAllowance?: number | null;
};

export type AdminBackupTable = {
	key: string;
	label: string;
	collection: string;
	count: number;
};

export type AdminBackupFile = {
	filename: string;
	size: number;
	createdAt: string;
	tableCount: number | null;
	documentCount: number | null;
};
