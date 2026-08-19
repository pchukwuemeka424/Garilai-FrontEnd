"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminDataTable, type AdminTableColumn } from "@/components/admin/AdminDataTable";
import { AdminPanel, AdminShell, AdminStatCard, formatAdminDate, formatAdminRelative } from "@/components/admin/AdminShell";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { useAdminTable } from "@/hooks/useAdminTable";
import {
	bulkAdminDeleteUsers,
	bulkAdminUserStatus,
	createAdminUser,
	deleteAdminUser,
	fetchAdminUserGovernanceHistory,
	fetchAdminUsers,
	resetAdminUserPassword,
	updateAdminUser,
} from "@/lib/admin-api";
import { roleLabel } from "@/lib/admin-roles";
import type { AuditLogRecord } from "@/lib/admin-governance";
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

const emptyForm = {
	name: "",
	email: "",
	password: "",
	role: "lecturer" as string,
	faculty: "",
	department: "",
	programme: "",
	cohort: "",
	status: "active" as string,
};

function downloadUserReport(users: UserRecord[]) {
	const headers = ["Name", "Email", "Role", "Status", "Faculty", "Department", "Programme", "Cohort", "Last Active", "Joined", "Tokens Used"];
	const rows = users.map((u) => [
		u.name, u.email, u.role, u.status,
		u.faculty ?? "", u.department ?? "", u.programme ?? "", u.cohort ?? "",
		u.lastActiveAt ?? "Never", u.createdAt, String(u.tokenQuota?.used ?? 0),
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

export function AdminUsersDashboard() {
	const { ready } = useAdminGuard();
	const [users, setUsers] = useState<UserRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [working, setWorking] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [roleFilter, setRoleFilter] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [facultyFilter, setFacultyFilter] = useState("");
	const [showCreate, setShowCreate] = useState(false);
	const [form, setForm] = useState(emptyForm);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [historyUser, setHistoryUser] = useState<UserRecord | null>(null);
	const [historyEvents, setHistoryEvents] = useState<AuditLogRecord[]>([]);
	const [historyLoading, setHistoryLoading] = useState(false);

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

	const faculties = useMemo(
		() => [...new Set(users.map((u) => u.faculty).filter(Boolean) as string[])].sort(),
		[users],
	);

	const filtered = useMemo(() => {
		const q = search.toLowerCase();
		return users.filter((u) => {
			if (roleFilter && u.role !== roleFilter) return false;
			if (statusFilter && u.status !== statusFilter) return false;
			if (facultyFilter && (u.faculty ?? "") !== facultyFilter) return false;
			if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !(u.faculty ?? "").toLowerCase().includes(q) && !(u.department ?? "").toLowerCase().includes(q)) return false;
			return true;
		});
	}, [users, search, roleFilter, statusFilter, facultyFilter]);

	const stats = useMemo(() => {
		const active = users.filter((u) => u.status === "active").length;
		const suspended = users.filter((u) => u.status === "suspended").length;
		const inactive = users.filter((u) => u.status === "inactive").length;
		const neverActive = users.filter((u) => !u.lastActiveAt).length;
		const admins = users.filter((u) => ["governance_admin", "faculty_admin", "department_admin", "compliance_officer", "data_protection_officer", "research_integrity_officer", "auditor"].includes(u.role)).length;
		const thisWeek = users.filter((u) => new Date(u.createdAt).getTime() > Date.now() - 7 * 86_400_000).length;
		return { total: users.length, active, suspended, inactive, neverActive, admins, thisWeek };
	}, [users]);

	const { pageItems: pagedUsers, pagination } = useAdminTable(filtered);

	const onCreate = async () => {
		if (!form.name.trim() || !form.email.trim()) {
			setError("Name and email are required.");
			return;
		}
		setWorking(true);
		setError(null);
		try {
			await createAdminUser({
				name: form.name.trim(),
				email: form.email.trim(),
				password: form.password || undefined,
				role: form.role as UserRecord["role"],
				faculty: form.faculty || undefined,
				department: form.department || undefined,
				programme: form.programme || undefined,
				cohort: form.cohort || undefined,
			});
			setForm(emptyForm);
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
		if (!pw || pw.length < 6) {
			if (pw) setError("Password must be at least 6 characters.");
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

	const onHistory = async (user: UserRecord) => {
		setHistoryUser(user);
		setHistoryLoading(true);
		setError(null);
		try {
			const data = await fetchAdminUserGovernanceHistory(user.id);
			setHistoryEvents(data.events);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setHistoryEvents([]);
		} finally {
			setHistoryLoading(false);
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
		{ key: "name", header: "Name", cell: (u) => <><strong>{u.name}</strong><p className="muted">{u.email}</p></> },
		{ key: "role", header: "Role", cell: (u) => <span className="admin-chip">{roleLabel(u.role)}</span> },
		{ key: "status", header: "Status", cell: (u) => <span className={`admin-chip admin-chip-status-${u.status}`}>{u.status}</span> },
		{ key: "faculty", header: "Faculty", cell: (u) => u.faculty ?? "—" },
		{ key: "department", header: "Department", cell: (u) => u.department ?? "—" },
		{ key: "programme", header: "Programme", cell: (u) => u.programme ?? "—" },
		{ key: "lastActive", header: "Last Active", cell: (u) => formatAdminRelative(u.lastActiveAt ?? null) },
		{ key: "joined", header: "Joined", cell: (u) => formatAdminDate(u.createdAt) },
		{
			key: "actions",
			header: "Actions",
			cell: (u) => (
				<div className="admin-row-actions">
					<select
						className="topic-input admin-action-select"
						value=""
						disabled={working}
						onChange={(e) => {
							const action = e.target.value;
							e.target.value = "";
							if (action === "activate") void onChangeStatus(u, "active");
							else if (action === "suspend") void onChangeStatus(u, "suspended");
							else if (action === "deactivate") void onChangeStatus(u, "inactive");
							else if (action === "role") void onChangeRole(u);
							else if (action === "history") void onHistory(u);
							else if (action === "password") void onResetPassword(u);
							else if (action === "delete") void onDelete(u);
						}}
					>
						<option value="">Actions…</option>
						{u.status !== "active" && <option value="activate">Activate</option>}
						{u.status !== "suspended" && <option value="suspend">Suspend</option>}
						{u.status !== "inactive" && <option value="deactivate">Deactivate</option>}
						<option value="role">Change role</option>
						<option value="history">Governance history</option>
						<option value="password">Reset password</option>
						<option value="delete">Delete</option>
					</select>
				</div>
			),
		},
	];

	return (
		<AdminShell
			title="User Management"
			subtitle="Activate, suspend, or deactivate accounts; view roles and governance history"
			breadcrumb="Admin · Accountability"
			actions={
				<div className="admin-actions-row">
					<button type="button" className="ghost-btn" onClick={() => setShowCreate(!showCreate)}>
						{showCreate ? "Cancel" : "Create User"}
					</button>
					<button type="button" className="ghost-btn" onClick={() => downloadUserReport(filtered)}>
						Export CSV
					</button>
					<button type="button" className="ghost-btn" onClick={() => void load()}>
						Refresh
					</button>
				</div>
			}
		>
			{error && <div className="banner banner-error">{error}</div>}

			<section className="admin-stats">
				<AdminStatCard label="Total Users" value={stats.total} />
				<AdminStatCard label="Active" value={stats.active} accent="success" />
				<AdminStatCard label="Suspended" value={stats.suspended} accent={stats.suspended > 0 ? "danger" : undefined} />
				<AdminStatCard label="Inactive" value={stats.inactive} accent={stats.inactive > 0 ? "warning" : undefined} />
				<AdminStatCard label="Never Engaged" value={stats.neverActive} hint="No activity recorded" />
				<AdminStatCard label="Admin Roles" value={stats.admins} accent="primary" />
				<AdminStatCard label="New This Week" value={stats.thisWeek} accent="primary" />
			</section>

			{showCreate && (
				<AdminPanel title="Create User" description="Invite or directly create a new account">
					<div className="admin-form-grid">
						<label>
							Full Name *
							<input className="topic-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" />
						</label>
						<label>
							Email *
							<input className="topic-input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@university.edu" />
						</label>
						<label>
							Password
							<input className="topic-input" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Leave blank for invite" />
						</label>
						<label>
							Role
							<select className="topic-input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
								{ALL_ROLES.map((r) => (
									<option key={r} value={r}>{roleLabel(r)}</option>
								))}
							</select>
						</label>
						<label>
							Faculty
							<input className="topic-input" value={form.faculty} onChange={(e) => setForm((f) => ({ ...f, faculty: e.target.value }))} />
						</label>
						<label>
							Department
							<input className="topic-input" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
						</label>
						<label>
							Programme
							<input className="topic-input" value={form.programme} onChange={(e) => setForm((f) => ({ ...f, programme: e.target.value }))} />
						</label>
						<label>
							Cohort
							<input className="topic-input" value={form.cohort} onChange={(e) => setForm((f) => ({ ...f, cohort: e.target.value }))} />
						</label>
					</div>
					<button type="button" className="primary-btn" disabled={working} onClick={() => void onCreate()}>
						Create User
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
				searchPlaceholder="Search users by name, email, faculty…"
				hasActiveFilters={Boolean(roleFilter || statusFilter || facultyFilter)}
				selectable={{
					selectedIds,
					onToggle: toggleSelect,
					onToggleAll: toggleAll,
					allVisibleSelected: pagedUsers.length > 0 && pagedUsers.every((u) => selectedIds.has(u.id)),
				}}
				bulkBar={
					selectedIds.size > 0 ? (
						<div className="admin-bulk-bar">
							<span>{selectedIds.size} selected</span>
							<button type="button" className="ghost-btn" disabled={working} onClick={() => void onBulkStatus("active")}>Activate</button>
							<button type="button" className="ghost-btn" disabled={working} onClick={() => void onBulkStatus("suspended")}>Suspend</button>
							<button type="button" className="ghost-btn" disabled={working} onClick={() => void onBulkStatus("inactive")}>Deactivate</button>
							<button type="button" className="ghost-btn admin-btn-danger" disabled={working} onClick={() => void onBulkDelete()}>Delete</button>
						</div>
					) : undefined
				}
				filters={
					<>
						<select className="topic-input" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
							<option value="">All roles</option>
							{ALL_ROLES.map((r) => (
								<option key={r} value={r}>{roleLabel(r)}</option>
							))}
						</select>
						<select className="topic-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
							<option value="">All statuses</option>
							{STATUSES.map((s) => (
								<option key={s} value={s}>{s}</option>
							))}
						</select>
						<select className="topic-input" value={facultyFilter} onChange={(e) => setFacultyFilter(e.target.value)}>
							<option value="">All faculties</option>
							{faculties.map((f) => (
								<option key={f} value={f}>{f}</option>
							))}
						</select>
					</>
				}
				pagination={pagination}
			/>

			{historyUser && (
				<AdminPanel
					title={`Governance history — ${historyUser.name}`}
					description={historyUser.email}
				>
					<button type="button" className="ghost-btn" onClick={() => setHistoryUser(null)}>
						Close
					</button>
					{historyLoading ? (
						<p className="muted">Loading history…</p>
					) : historyEvents.length === 0 ? (
						<p className="muted">No governance events recorded for this account.</p>
					) : (
						<div className="admin-timeline">
							{historyEvents.map((event) => (
								<div key={event.id} className="admin-timeline-entry">
									<span className="admin-timeline-dot" aria-hidden />
									<span className="admin-timeline-time">{formatAdminRelative(event.createdAt)}</span>
									<span className="admin-timeline-action">{event.action}</span>
									<span className="admin-timeline-note">{event.summary}</span>
								</div>
							))}
						</div>
					)}
				</AdminPanel>
			)}
		</AdminShell>
	);
}
