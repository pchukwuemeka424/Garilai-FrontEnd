"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminDataTable, type AdminTableColumn } from "@/components/admin/AdminDataTable";
import { AdminInput } from "@/components/admin/AdminInput";
import { AdminPanel, AdminStatCard, formatAdminDate, formatAdminRelative } from "@/components/admin/AdminShell";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { PlatformUserDetailModal } from "@/components/admin/PlatformUserDetailModal";
import { useAdminTable } from "@/hooks/useAdminTable";
import {
	bulkAdminDeleteUsers,
	bulkAdminUserStatus,
	createAdminUser,
	deleteAdminUser,
	fetchAdminUsers,
	resetAdminUserPassword,
	updateAdminUser,
	type UniversityRecord,
} from "@/lib/admin-api";
import { roleLabel } from "@/lib/admin-roles";
import type { UserRecord } from "@/lib/dashboard";

const ALL_ROLES = [
	"lecturer",
	"researcher",
	"student",
	"governance_admin",
	"faculty_admin",
	"department_admin",
	"compliance_officer",
	"data_protection_officer",
	"research_integrity_officer",
	"auditor",
	"viewer",
] as const;

const STATUSES = ["active", "inactive", "suspended"] as const;

type FormState = {
	name: string;
	email: string;
	password: string;
	role: string;
	universityId: string;
	faculty: string;
	department: string;
	programme: string;
	cohort: string;
};

const emptyForm = (universityId = ""): FormState => ({
	name: "",
	email: "",
	password: "",
	role: "student",
	universityId,
	faculty: "",
	department: "",
	programme: "",
	cohort: "",
});

function downloadUserReport(
	users: UserRecord[],
	uniNameById: Map<string, string>,
) {
	const headers = [
		"Name",
		"Email",
		"Role",
		"Status",
		"University",
		"Faculty",
		"Department",
		"Programme",
		"Cohort",
		"Suspension Reason",
		"Last Active",
		"Joined",
		"Tokens Used",
	];
	const rows = users.map((u) => [
		u.name,
		u.email,
		u.role,
		u.status,
		u.universityId ? uniNameById.get(u.universityId) ?? u.institution ?? "" : u.institution ?? "",
		u.faculty ?? "",
		u.department ?? "",
		u.programme ?? "",
		u.cohort ?? "",
		u.suspensionReason ?? "",
		u.lastActiveAt ?? "Never",
		u.createdAt,
		String(u.tokenQuota?.used ?? 0),
	]);
	const csv = [headers, ...rows]
		.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
		.join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `garil-users-${new Date().toISOString().slice(0, 10)}.csv`;
	link.click();
	URL.revokeObjectURL(url);
}

export type PlatformUsersPanelProps = {
	ready: boolean;
	universities: UniversityRecord[];
	/** When set, lock filters/create to this university and hide university filter. */
	fixedUniversityId?: string;
	/** When true, only show console admin roles. */
	adminsOnly?: boolean;
	showStats?: boolean;
	title?: string;
};

export function PlatformUsersPanel({
	ready,
	universities,
	fixedUniversityId,
	adminsOnly = false,
	showStats = true,
	title = "Users",
}: PlatformUsersPanelProps) {
	const [users, setUsers] = useState<UserRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [working, setWorking] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [roleFilter, setRoleFilter] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [universityFilter, setUniversityFilter] = useState(fixedUniversityId ?? "");
	const [showCreate, setShowCreate] = useState(false);
	const [form, setForm] = useState(() => ({
		...emptyForm(fixedUniversityId ?? ""),
		role: adminsOnly ? "faculty_admin" : "student",
	}));
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [detailUserId, setDetailUserId] = useState<string | null>(null);

	const uniNameById = useMemo(
		() => new Map(universities.map((u) => [u.id, u.name])),
		[universities],
	);

	const load = useCallback(async () => {
		setError(null);
		try {
			setUsers(await fetchAdminUsers());
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (ready) void load();
	}, [load, ready]);

	useEffect(() => {
		if (fixedUniversityId) {
			setUniversityFilter(fixedUniversityId);
			setForm((f) => ({ ...f, universityId: fixedUniversityId }));
		}
	}, [fixedUniversityId]);

	const scopedUsers = useMemo(() => {
		const consoleRoles = new Set([
			"governance_admin",
			"faculty_admin",
			"department_admin",
			"compliance_officer",
			"data_protection_officer",
			"research_integrity_officer",
			"auditor",
		]);
		return users.filter((u) => {
			if (u.role === "admin") return false;
			if (adminsOnly && !consoleRoles.has(u.role)) return false;
			if (fixedUniversityId && u.universityId !== fixedUniversityId) return false;
			return true;
		});
	}, [users, adminsOnly, fixedUniversityId]);

	const filtered = useMemo(() => {
		const q = search.toLowerCase();
		return scopedUsers.filter((u) => {
			if (roleFilter && u.role !== roleFilter) return false;
			if (statusFilter && u.status !== statusFilter) return false;
			if (universityFilter && u.universityId !== universityFilter) return false;
			if (
				q &&
				!u.name.toLowerCase().includes(q) &&
				!u.email.toLowerCase().includes(q) &&
				!(u.faculty ?? "").toLowerCase().includes(q) &&
				!(u.department ?? "").toLowerCase().includes(q) &&
				!(u.institution ?? "").toLowerCase().includes(q)
			) {
				return false;
			}
			return true;
		});
	}, [scopedUsers, search, roleFilter, statusFilter, universityFilter]);

	const stats = useMemo(() => {
		const active = scopedUsers.filter((u) => u.status === "active").length;
		const suspended = scopedUsers.filter((u) => u.status === "suspended").length;
		const students = scopedUsers.filter((u) => u.role === "student").length;
		return { total: scopedUsers.length, active, suspended, students };
	}, [scopedUsers]);

	const { pageItems: pagedUsers, pagination } = useAdminTable(filtered);

	const onCreate = async () => {
		if (!form.name.trim() || !form.email.trim()) {
			setError("Name and email are required.");
			return;
		}
		const universityId = fixedUniversityId || form.universityId;
		if (!universityId) {
			setError("Select a university.");
			return;
		}
		setWorking(true);
		setError(null);
		try {
			const uni = universities.find((u) => u.id === universityId);
			await createAdminUser({
				name: form.name.trim(),
				email: form.email.trim(),
				password: form.password || undefined,
				role: form.role as UserRecord["role"],
				universityId,
				institution: uni?.name,
				faculty: form.faculty || undefined,
				department: form.department || undefined,
				programme: form.programme || undefined,
				cohort: form.cohort || undefined,
			});
			setForm({
				...emptyForm(fixedUniversityId ?? ""),
				role: adminsOnly ? "faculty_admin" : "student",
			});
			setShowCreate(false);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onChangeStatus = async (user: UserRecord, status: "active" | "inactive" | "suspended") => {
		let suspensionReason: string | undefined;
		if (status === "suspended") {
			const reason = window.prompt("Reason for suspension:")?.trim();
			if (!reason) return;
			suspensionReason = reason;
		}
		setWorking(true);
		try {
			await updateAdminUser(user.id, {
				status,
				...(suspensionReason ? { suspensionReason } : {}),
			});
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onChangeRole = async (user: UserRecord) => {
		const newRole = window.prompt(`Current role: ${user.role}\nNew role:`, user.role)?.trim();
		if (!newRole || newRole === user.role) return;
		if (!ALL_ROLES.includes(newRole as (typeof ALL_ROLES)[number])) {
			setError(`Invalid role. Valid: ${ALL_ROLES.join(", ")}`);
			return;
		}
		setWorking(true);
		try {
			await updateAdminUser(user.id, { role: newRole as UserRecord["role"] });
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onResetPassword = async (user: UserRecord) => {
		const pw = window.prompt(`Reset password for ${user.email}:`)?.trim();
		if (!pw || pw.length < 8) {
			if (pw) setError("Password must be at least 8 characters.");
			return;
		}
		setWorking(true);
		try {
			await resetAdminUserPassword(user.id, pw);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onDelete = async (user: UserRecord) => {
		if (!window.confirm(`Delete user ${user.name} (${user.email})? This cannot be undone.`)) return;
		setWorking(true);
		try {
			await deleteAdminUser(user.id);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onBulkStatus = async (status: "active" | "inactive" | "suspended") => {
		if (selectedIds.size === 0) return;
		let suspensionReason: string | undefined;
		if (status === "suspended") {
			const reason = window.prompt("Reason for suspension:")?.trim();
			if (!reason) return;
			suspensionReason = reason;
		}
		if (!window.confirm(`Change ${selectedIds.size} users to ${status}?`)) return;
		setWorking(true);
		try {
			await bulkAdminUserStatus(Array.from(selectedIds), status, suspensionReason);
			setSelectedIds(new Set());
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onBulkDelete = async () => {
		if (selectedIds.size === 0) return;
		if (!window.confirm(`Delete ${selectedIds.size} users permanently?`)) return;
		setWorking(true);
		try {
			await bulkAdminDeleteUsers(Array.from(selectedIds));
			setSelectedIds(new Set());
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const toggleSelect = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const toggleAll = () => {
		const pageIds = pagedUsers.map((u) => u.id);
		const allSelected = pageIds.every((id) => selectedIds.has(id));
		if (allSelected) {
			setSelectedIds((prev) => {
				const next = new Set(prev);
				for (const id of pageIds) next.delete(id);
				return next;
			});
		} else {
			setSelectedIds((prev) => {
				const next = new Set(prev);
				for (const id of pageIds) next.add(id);
				return next;
			});
		}
	};

	const columns: AdminTableColumn<UserRecord>[] = [
		{
			key: "name",
			header: "Name",
			cell: (u) => (
				<button
					type="button"
					className="ghost-btn"
					style={{ textAlign: "left", padding: 0, border: "none", background: "none" }}
					onClick={() => setDetailUserId(u.id)}
				>
					<strong>{u.name}</strong>
					<p className="muted">{u.email}</p>
				</button>
			),
		},
		{ key: "role", header: "Role", cell: (u) => <span className="admin-chip">{roleLabel(u.role)}</span> },
		{
			key: "status",
			header: "Status",
			cell: (u) => (
				<>
					<span className={`admin-chip admin-chip-status-${u.status}`}>{u.status}</span>
					{u.status === "suspended" && u.suspensionReason ? (
						<p className="muted" style={{ fontSize: "0.8em", marginTop: 4 }}>
							{u.suspensionReason}
						</p>
					) : null}
				</>
			),
		},
		...(!fixedUniversityId
			? [
					{
						key: "university",
						header: "University",
						cell: (u: UserRecord) =>
							u.universityId
								? uniNameById.get(u.universityId) ?? u.institution ?? "—"
								: u.institution ?? "—",
					} satisfies AdminTableColumn<UserRecord>,
				]
			: []),
		{ key: "faculty", header: "Faculty", cell: (u) => u.faculty ?? "—" },
		{
			key: "tokens",
			header: "Tokens",
			cell: (u) =>
				u.tokenQuota
					? `${u.tokenQuota.used.toLocaleString()} / ${u.tokenQuota.allowance.toLocaleString()}`
					: "—",
		},
		{ key: "lastActive", header: "Last Active", cell: (u) => formatAdminRelative(u.lastActiveAt ?? null) },
		{ key: "joined", header: "Joined", cell: (u) => formatAdminDate(u.createdAt) },
		{
			key: "actions",
			header: "Actions",
			cell: (u) => {
				const actionOptions = [
					{ value: "details", label: "View details" },
					...(u.status !== "active" ? [{ value: "activate", label: "Activate" }] : []),
					...(u.status !== "suspended" ? [{ value: "suspend", label: "Suspend" }] : []),
					...(u.status !== "inactive" ? [{ value: "deactivate", label: "Deactivate" }] : []),
					{ value: "role", label: "Change role" },
					{ value: "password", label: "Reset password" },
					{ value: "delete", label: "Delete" },
				];
				return (
					<div className="admin-row-actions">
						<AdminSelect
							compact
							value=""
							disabled={working}
							placeholder="Actions…"
							aria-label={`Actions for ${u.name}`}
							searchThreshold={99}
							options={actionOptions}
							onChange={(action) => {
								if (action === "details") setDetailUserId(u.id);
								else if (action === "activate") void onChangeStatus(u, "active");
								else if (action === "suspend") void onChangeStatus(u, "suspended");
								else if (action === "deactivate") void onChangeStatus(u, "inactive");
								else if (action === "role") void onChangeRole(u);
								else if (action === "password") void onResetPassword(u);
								else if (action === "delete") void onDelete(u);
							}}
						/>
					</div>
				);
			},
		},
	];

	return (
		<div className="platform-users-panel">
			{error && <div className="banner banner-error">{error}</div>}

			{showStats && (
				<section className="admin-stats">
					<AdminStatCard label="Total" value={stats.total} />
					<AdminStatCard label="Active" value={stats.active} accent="success" />
					<AdminStatCard
						label="Suspended"
						value={stats.suspended}
						accent={stats.suspended > 0 ? "danger" : undefined}
					/>
					{!adminsOnly && (
						<AdminStatCard label="Students" value={stats.students} accent="primary" />
					)}
				</section>
			)}

			<div className="admin-actions-row" style={{ marginBottom: "1rem" }}>
				<button type="button" className="ghost-btn" onClick={() => setShowCreate(!showCreate)}>
					{showCreate ? "Cancel" : `Create ${adminsOnly ? "admin" : "user"}`}
				</button>
				<button
					type="button"
					className="ghost-btn"
					onClick={() => downloadUserReport(filtered, uniNameById)}
				>
					Export CSV
				</button>
				<button type="button" className="ghost-btn" onClick={() => void load()}>
					Refresh
				</button>
			</div>

			{showCreate && (
				<AdminPanel title={`Create ${adminsOnly ? "admin" : "user"}`} description={title}>
					<div className="admin-form-grid">
						<AdminInput
							label="Full name"
							required
							value={form.name}
							onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
							placeholder="Full name"
							autoComplete="name"
						/>
						<AdminInput
							label="Email"
							required
							type="email"
							value={form.email}
							onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
							placeholder="email@university.edu"
							autoComplete="email"
						/>
						<AdminInput
							label="Password"
							type="password"
							value={form.password}
							onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
							placeholder="Leave blank to invite"
							autoComplete="new-password"
							hint="Leave blank to create an invite-only account"
						/>
						<AdminSelect
							id="create-user-role"
							label="Role"
							value={form.role}
							onChange={(role) => setForm((f) => ({ ...f, role }))}
							searchThreshold={0}
							options={(adminsOnly
								? ALL_ROLES.filter((r) =>
										[
											"governance_admin",
											"faculty_admin",
											"auditor",
											"department_admin",
											"compliance_officer",
											"data_protection_officer",
											"research_integrity_officer",
										].includes(r),
									)
								: ALL_ROLES
							).map((r) => ({ value: r, label: roleLabel(r) }))}
						/>
						{!fixedUniversityId && (
							<AdminSelect
								id="create-user-university"
								label="University"
								value={form.universityId}
								onChange={(universityId) => setForm((f) => ({ ...f, universityId }))}
								required
								placeholder="Select university…"
								searchPlaceholder="Search universities…"
								searchThreshold={0}
								options={universities.map((uni) => ({
									value: uni.id,
									label: uni.name,
									hint: uni.status,
								}))}
							/>
						)}
						<AdminInput
							label="Faculty"
							value={form.faculty}
							onChange={(e) => setForm((f) => ({ ...f, faculty: e.target.value }))}
							placeholder="Faculty"
						/>
						<AdminInput
							label="Department"
							value={form.department}
							onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
							placeholder="Department"
						/>
						<AdminInput
							label="Programme"
							value={form.programme}
							onChange={(e) => setForm((f) => ({ ...f, programme: e.target.value }))}
							placeholder="Programme"
						/>
						<AdminInput
							label="Cohort"
							value={form.cohort}
							onChange={(e) => setForm((f) => ({ ...f, cohort: e.target.value }))}
							placeholder="Cohort"
						/>
					</div>
					<button type="button" className="primary-btn" disabled={working} onClick={() => void onCreate()}>
						Create
					</button>
				</AdminPanel>
			)}

			<AdminDataTable
				columns={columns}
				data={pagedUsers}
				rowKey={(u) => u.id}
				loading={loading}
				search={search}
				onSearchChange={setSearch}
				searchPlaceholder="Search by name, email, faculty…"
				hasActiveFilters={Boolean(
					roleFilter || statusFilter || (!fixedUniversityId && universityFilter),
				)}
				selectable={{
					selectedIds,
					onToggle: toggleSelect,
					onToggleAll: toggleAll,
					allVisibleSelected:
						pagedUsers.length > 0 && pagedUsers.every((u) => selectedIds.has(u.id)),
				}}
				bulkBar={
					selectedIds.size > 0 ? (
						<div className="admin-bulk-bar">
							<span>{selectedIds.size} selected</span>
							<button
								type="button"
								className="ghost-btn"
								disabled={working}
								onClick={() => void onBulkStatus("active")}
							>
								Activate
							</button>
							<button
								type="button"
								className="ghost-btn"
								disabled={working}
								onClick={() => void onBulkStatus("suspended")}
							>
								Suspend
							</button>
							<button
								type="button"
								className="ghost-btn"
								disabled={working}
								onClick={() => void onBulkStatus("inactive")}
							>
								Deactivate
							</button>
							<button
								type="button"
								className="ghost-btn admin-btn-danger"
								disabled={working}
								onClick={() => void onBulkDelete()}
							>
								Delete
							</button>
						</div>
					) : undefined
				}
				filters={
					<>
						<AdminSelect
							compact
							value={roleFilter}
							onChange={setRoleFilter}
							placeholder="All roles"
							clearable
							aria-label="Filter by role"
							searchThreshold={0}
							options={ALL_ROLES.map((r) => ({ value: r, label: roleLabel(r) }))}
						/>
						<AdminSelect
							compact
							value={statusFilter}
							onChange={setStatusFilter}
							placeholder="All statuses"
							clearable
							aria-label="Filter by status"
							searchThreshold={99}
							options={STATUSES.map((s) => ({ value: s, label: s }))}
						/>
						{!fixedUniversityId && (
							<AdminSelect
								compact
								value={universityFilter}
								onChange={setUniversityFilter}
								placeholder="All universities"
								clearable
								aria-label="Filter by university"
								searchPlaceholder="Search universities…"
								searchThreshold={0}
								options={universities.map((uni) => ({
									value: uni.id,
									label: uni.name,
								}))}
							/>
						)}
					</>
				}
				pagination={pagination}
			/>

			{detailUserId && (
				<PlatformUserDetailModal
					userId={detailUserId}
					universities={universities}
					onClose={() => setDetailUserId(null)}
					onUpdated={load}
				/>
			)}
		</div>
	);
}
