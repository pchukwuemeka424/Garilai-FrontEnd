"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminConsoleDetailModal } from "@/components/admin/AdminConsoleDetailModal";
import { AdminDataTable, type AdminTableColumn } from "@/components/admin/AdminDataTable";
import { AdminInput } from "@/components/admin/AdminInput";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
	AdminPanel,
	AdminStatCard,
	formatAdminDate,
	formatAdminRelative,
	SuperAdminShell,
} from "@/components/admin/SuperAdminShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAdminTable } from "@/hooks/useAdminTable";
import { useAuth } from "@/hooks/useAuth";
import { useSuperAdminGuard } from "@/hooks/useAdminGuard";
import {
	bulkAdminDeleteUsers,
	bulkAdminUserStatus,
	createAdminUser,
	deleteAdminUser,
	fetchAdminConsoleAdmins,
	fetchAdminUniversities,
	resetAdminUserPassword,
	updateAdminUser,
	type UniversityRecord,
} from "@/lib/admin-api";
import {
	roleLabel,
	SUPER_ADMIN_CREATE_ROLES,
} from "@/lib/admin-roles";
import type { UserRecord, UserRole } from "@/lib/dashboard";
import { universityDetailHref } from "@/lib/admin-university-href";

type ScopeTab = "all" | "super" | "university";

type CreateForm = {
	name: string;
	email: string;
	password: string;
	role: UserRole;
	universityId: string;
	faculty: string;
	department: string;
	inviteOnly: boolean;
};

const emptyCreate = (): CreateForm => ({
	name: "",
	email: "",
	password: "",
	role: "faculty_admin",
	universityId: "",
	faculty: "",
	department: "",
	inviteOnly: false,
});

function downloadAdminsCsv(
	admins: UserRecord[],
	uniNameById: Map<string, string>,
) {
	const headers = [
		"Name",
		"Email",
		"Role",
		"Scope",
		"University",
		"Status",
		"Faculty",
		"Department",
		"Last Active",
		"Joined",
	];
	const rows = admins.map((a) => [
		a.name,
		a.email,
		a.role,
		a.role === "admin" ? "platform" : "university",
		a.role === "admin"
			? "—"
			: a.universityId
				? uniNameById.get(a.universityId) ?? a.institution ?? ""
				: a.institution ?? "",
		a.status,
		a.faculty ?? "",
		a.department ?? "",
		a.lastActiveAt ?? "",
		a.createdAt,
	]);
	const csv = [headers, ...rows]
		.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
		.join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `garil-admins-${new Date().toISOString().slice(0, 10)}.csv`;
	link.click();
	URL.revokeObjectURL(url);
}

export function AdminAdminsDashboard() {
	const { ready } = useSuperAdminGuard();
	const { user: currentUser } = useAuth();
	const [admins, setAdmins] = useState<UserRecord[]>([]);
	const [universities, setUniversities] = useState<UniversityRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [working, setWorking] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const [scopeTab, setScopeTab] = useState<ScopeTab>("all");
	const [search, setSearch] = useState("");
	const [roleFilter, setRoleFilter] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [universityFilter, setUniversityFilter] = useState("");
	const [showCreate, setShowCreate] = useState(false);
	const [form, setForm] = useState<CreateForm>(emptyCreate);

	const [detailUserId, setDetailUserId] = useState<string | null>(null);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
	const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

	const isSuperCreate = form.role === "admin";

	const load = useCallback(async () => {
		setError(null);
		try {
			const [adminList, uniList] = await Promise.all([
				fetchAdminConsoleAdmins(),
				fetchAdminUniversities(),
			]);
			setAdmins(adminList);
			setUniversities(uniList);
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
		if (isSuperCreate) {
			setForm((f) => ({ ...f, universityId: "", faculty: "", department: "" }));
		}
	}, [isSuperCreate]);

	const uniNameById = useMemo(
		() => new Map(universities.map((u) => [u.id, u.name])),
		[universities],
	);

	const onboardedUniversities = useMemo(
		() => universities.filter((u) => u.status === "active"),
		[universities],
	);

	const superAdmins = useMemo(() => admins.filter((a) => a.role === "admin"), [admins]);
	const universityAdmins = useMemo(() => admins.filter((a) => a.role !== "admin"), [admins]);

	const scoped = useMemo(() => {
		if (scopeTab === "super") return superAdmins;
		if (scopeTab === "university") return universityAdmins;
		return admins;
	}, [scopeTab, admins, superAdmins, universityAdmins]);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		return scoped.filter((a) => {
			if (roleFilter && a.role !== roleFilter) return false;
			if (statusFilter && a.status !== statusFilter) return false;
			if (universityFilter) {
				if (a.role === "admin") return false;
				if (a.universityId !== universityFilter) return false;
			}
			if (
				q &&
				!a.name.toLowerCase().includes(q) &&
				!a.email.toLowerCase().includes(q) &&
				!(a.faculty ?? "").toLowerCase().includes(q) &&
				!(a.institution ?? "").toLowerCase().includes(q) &&
				!(uniNameById.get(a.universityId ?? "") ?? "").toLowerCase().includes(q)
			) {
				return false;
			}
			return true;
		});
	}, [scoped, search, roleFilter, statusFilter, universityFilter, uniNameById]);

	const { pageItems, pagination } = useAdminTable(filtered, {
		resetDeps: [scopeTab, search, roleFilter, statusFilter, universityFilter],
	});

	const stats = useMemo(() => {
		const active = admins.filter((a) => a.status === "active").length;
		const suspended = admins.filter((a) => a.status === "suspended").length;
		const unisCovered = new Set(
			universityAdmins.map((a) => a.universityId).filter(Boolean),
		).size;
		return { active, suspended, unisCovered };
	}, [admins, universityAdmins]);

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!isSuperCreate && !form.universityId) {
			setError("Select an onboarded university for this admin.");
			return;
		}
		if (!form.inviteOnly && form.password.length < 8) {
			setError("Password must be at least 8 characters, or enable invite-only.");
			return;
		}
		setWorking(true);
		setError(null);
		setSuccess(null);
		try {
			const uni = universities.find((u) => u.id === form.universityId);
			await createAdminUser({
				name: form.name.trim(),
				email: form.email.trim(),
				role: form.role,
				status: "active",
				...(form.inviteOnly || !form.password
					? {}
					: { password: form.password }),
				...(isSuperCreate
					? {}
					: {
							universityId: form.universityId,
							institution: uni?.name,
							faculty: form.faculty.trim() || undefined,
							department: form.department.trim() || undefined,
						}),
			});
			setForm(emptyCreate());
			setShowCreate(false);
			setSuccess(
				isSuperCreate
					? "Super administrator created."
					: "University administrator created.",
			);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const setStatus = async (admin: UserRecord, status: UserRecord["status"]) => {
		if (currentUser?.id === admin.id) {
			setError("You cannot change status on your own account.");
			return;
		}
		let suspensionReason: string | undefined;
		if (status === "suspended") {
			const reason = window.prompt("Reason for suspension:")?.trim();
			if (!reason) return;
			suspensionReason = reason;
		}
		setWorking(true);
		setError(null);
		try {
			await updateAdminUser(admin.id, {
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

	const quickResetPassword = async (admin: UserRecord) => {
		const pw = window.prompt(`New password for ${admin.email}:`)?.trim();
		if (!pw) return;
		if (pw.length < 8) {
			setError("Password must be at least 8 characters.");
			return;
		}
		setWorking(true);
		setError(null);
		try {
			await resetAdminUserPassword(admin.id, pw);
			setSuccess(`Password updated for ${admin.email}.`);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const confirmDeleteOne = async () => {
		if (!deleteTarget) return;
		if (currentUser?.id === deleteTarget.id) {
			setError("You cannot delete your own account.");
			setDeleteTarget(null);
			return;
		}
		setWorking(true);
		setError(null);
		try {
			await deleteAdminUser(deleteTarget.id);
			setDeleteTarget(null);
			setSelectedIds((prev) => {
				const next = new Set(prev);
				next.delete(deleteTarget.id);
				return next;
			});
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onBulkStatus = async (status: "active" | "suspended") => {
		const ids = Array.from(selectedIds).filter((id) => id !== currentUser?.id);
		if (ids.length === 0) return;
		let suspensionReason: string | undefined;
		if (status === "suspended") {
			const reason = window.prompt("Reason for suspension:")?.trim();
			if (!reason) return;
			suspensionReason = reason;
		}
		setWorking(true);
		setError(null);
		try {
			await bulkAdminUserStatus(ids, status, suspensionReason);
			setSelectedIds(new Set());
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const confirmBulkDelete = async () => {
		const ids = Array.from(selectedIds).filter((id) => id !== currentUser?.id);
		if (ids.length === 0) {
			setBulkDeleteOpen(false);
			return;
		}
		setWorking(true);
		setError(null);
		try {
			await bulkAdminDeleteUsers(ids);
			setSelectedIds(new Set());
			setBulkDeleteOpen(false);
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
		const pageIds = pageItems.map((a) => a.id);
		const allSelected = pageIds.every((id) => selectedIds.has(id));
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (allSelected) {
				for (const id of pageIds) next.delete(id);
			} else {
				for (const id of pageIds) next.add(id);
			}
			return next;
		});
	};

	const columns: AdminTableColumn<UserRecord>[] = [
		{
			key: "name",
			header: "Admin",
			cell: (a) => (
				<button
					type="button"
					className="ghost-btn"
					style={{ textAlign: "left", padding: 0, border: "none", background: "none" }}
					onClick={() => setDetailUserId(a.id)}
				>
					<strong>{a.name}</strong>
					{currentUser?.id === a.id ? (
						<span className="admin-chip" style={{ marginLeft: 6 }}>
							You
						</span>
					) : null}
					<p className="muted">{a.email}</p>
				</button>
			),
		},
		{
			key: "role",
			header: "Role",
			cell: (a) => (
				<>
					<span className="admin-chip">{roleLabel(a.role)}</span>
					<p className="muted" style={{ fontSize: "0.8em", marginTop: 4 }}>
						{a.role === "admin" ? "Platform" : "University"}
					</p>
				</>
			),
		},
		{
			key: "university",
			header: "University",
			cell: (a) =>
				a.role === "admin" ? (
					<span className="muted">All institutions</span>
				) : a.universityId ? (
					<Link
						href={universityDetailHref(
							universities.find((u) => u.id === a.universityId) ?? a.universityId,
						)}
					>
						{uniNameById.get(a.universityId) ?? a.institution ?? "—"}
					</Link>
				) : (
					a.institution ?? "—"
				),
		},
		{
			key: "status",
			header: "Status",
			cell: (a) => (
				<>
					<span className={`admin-chip admin-chip-status-${a.status}`}>{a.status}</span>
					{a.status === "suspended" && a.suspensionReason ? (
						<p className="muted" style={{ fontSize: "0.8em", marginTop: 4 }}>
							{a.suspensionReason}
						</p>
					) : null}
				</>
			),
		},
		{
			key: "org",
			header: "Faculty / Dept",
			cell: (a) =>
				a.role === "admin" ? (
					"—"
				) : (
					<>
						{a.faculty ?? "—"}
						{a.department ? (
							<p className="muted" style={{ fontSize: "0.8em", marginTop: 4 }}>
								{a.department}
							</p>
						) : null}
					</>
				),
		},
		{
			key: "lastActive",
			header: "Last active",
			cell: (a) => formatAdminRelative(a.lastActiveAt),
		},
		{
			key: "joined",
			header: "Joined",
			cell: (a) => formatAdminDate(a.createdAt),
		},
		{
			key: "actions",
			header: "Actions",
			cell: (a) => {
				const isSelf = currentUser?.id === a.id;
				const options = [
					{ value: "details", label: "Open details" },
					...(!isSelf && a.status !== "active"
						? [{ value: "activate", label: "Activate" }]
						: []),
					...(!isSelf && a.status !== "suspended"
						? [{ value: "suspend", label: "Suspend" }]
						: []),
					{ value: "password", label: "Reset password" },
					...(!isSelf ? [{ value: "delete", label: "Delete" }] : []),
				];
				return (
					<AdminSelect
						compact
						value=""
						disabled={working}
						placeholder="Actions…"
						aria-label={`Actions for ${a.name}`}
						searchThreshold={99}
						options={options}
						onChange={(action) => {
							if (action === "details") setDetailUserId(a.id);
							else if (action === "activate") void setStatus(a, "active");
							else if (action === "suspend") void setStatus(a, "suspended");
							else if (action === "password") void quickResetPassword(a);
							else if (action === "delete") setDeleteTarget(a);
						}}
					/>
				);
			},
		},
	];

	return (
		<SuperAdminShell
			title="Admins"
			subtitle="Create and manage platform super admins and university console administrators."
			breadcrumb="Platform"
			actions={
				<div className="admin-actions-row">
					<button
						type="button"
						className="ghost-btn"
						onClick={() => downloadAdminsCsv(filtered, uniNameById)}
					>
						Export CSV
					</button>
					<button type="button" className="ghost-btn" onClick={() => void load()}>
						Refresh
					</button>
					<button
						type="button"
						className="primary-btn"
						onClick={() => {
							setShowCreate((v) => !v);
							setSuccess(null);
						}}
					>
						{showCreate ? "Close form" : "Create admin"}
					</button>
				</div>
			}
		>
			{error && <div className="banner banner-error">{error}</div>}
			{success && <div className="banner banner-success">{success}</div>}

			<section className="admin-stats">
				<AdminStatCard label="Total admins" value={admins.length} />
				<AdminStatCard label="Super admins" value={superAdmins.length} accent="primary" />
				<AdminStatCard label="University admins" value={universityAdmins.length} />
				<AdminStatCard label="Active" value={stats.active} accent="success" />
				<AdminStatCard
					label="Suspended"
					value={stats.suspended}
					accent={stats.suspended > 0 ? "danger" : undefined}
				/>
				<AdminStatCard label="Unis covered" value={stats.unisCovered} />
			</section>

			{showCreate && (
				<AdminPanel
					title="Create admin"
					description="Super admins manage the whole platform. University roles are limited to one onboarded institution."
				>
					<form className="admin-form-grid" onSubmit={(e) => void handleCreate(e)}>
						<AdminInput
							label="Full name"
							required
							value={form.name}
							onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
							disabled={working}
							autoComplete="name"
							placeholder="Full name"
						/>
						<AdminInput
							label="Email"
							type="email"
							required
							value={form.email}
							onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
							disabled={working}
							autoComplete="email"
							placeholder={
								isSuperCreate ? "superadmin@garilai.com" : "admin@university.edu"
							}
						/>
						<AdminSelect
							id="admin-create-role"
							label="Role"
							value={form.role}
							onChange={(role) => setForm((f) => ({ ...f, role: role as UserRole }))}
							disabled={working}
							searchThreshold={0}
							options={SUPER_ADMIN_CREATE_ROLES.map((opt) => ({
								value: opt.value,
								label: opt.label,
								hint: opt.scope === "platform" ? "Platform-wide" : "University-scoped",
							}))}
						/>
						{!isSuperCreate && (
							<>
								<AdminSelect
									id="admin-create-university"
									label="University"
									span
									value={form.universityId}
									onChange={(universityId) => setForm((f) => ({ ...f, universityId }))}
									required
									disabled={working || onboardedUniversities.length === 0}
									placeholder={
										onboardedUniversities.length === 0
											? "Onboard a university first…"
											: "Select onboarded university…"
									}
									searchPlaceholder="Search universities…"
									searchThreshold={0}
									options={[
										...onboardedUniversities.map((uni) => ({
											value: uni.id,
											label: uni.name,
											hint: "active",
										})),
										...universities
											.filter((u) => u.status !== "active")
											.map((uni) => ({
												value: uni.id,
												label: uni.name,
												hint: uni.status,
												disabled: true,
											})),
									]}
								/>
								<AdminInput
									label="Faculty"
									value={form.faculty}
									onChange={(e) => setForm((f) => ({ ...f, faculty: e.target.value }))}
									disabled={working}
									placeholder="Optional"
								/>
								<AdminInput
									label="Department"
									value={form.department}
									onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
									disabled={working}
									placeholder="Optional"
								/>
							</>
						)}
						{isSuperCreate && (
							<p className="admin-form-span muted" style={{ margin: 0 }}>
								Super administrators are not assigned to a university and can manage every
								onboarded institution.
							</p>
						)}
						<label
							className="admin-form-span"
							style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
						>
							<input
								type="checkbox"
								checked={form.inviteOnly}
								onChange={(e) =>
									setForm((f) => ({
										...f,
										inviteOnly: e.target.checked,
										password: e.target.checked ? "" : f.password,
									}))
								}
								disabled={working}
							/>
							Invite only (no password — account can be activated later)
						</label>
						{!form.inviteOnly && (
							<AdminInput
								label="Password"
								type="password"
								required
								minLength={8}
								value={form.password}
								onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
								disabled={working}
								autoComplete="new-password"
								placeholder="At least 8 characters"
							/>
						)}
						<div className="admin-form-span">
							<button
								type="submit"
								className="primary-btn"
								disabled={
									working ||
									(!isSuperCreate &&
										(onboardedUniversities.length === 0 || !form.universityId))
								}
							>
								{working
									? "Creating…"
									: isSuperCreate
										? "Create super admin"
										: "Create university admin"}
							</button>
						</div>
					</form>
				</AdminPanel>
			)}

			<div className="admin-actions-row" style={{ marginBottom: "1rem", gap: "0.5rem" }}>
				{(
					[
						["all", `All (${admins.length})`],
						["super", `Super (${superAdmins.length})`],
						["university", `University (${universityAdmins.length})`],
					] as const
				).map(([id, label]) => (
					<button
						key={id}
						type="button"
						className={scopeTab === id ? "primary-btn" : "ghost-btn"}
						onClick={() => {
							setScopeTab(id);
							setSelectedIds(new Set());
						}}
					>
						{label}
					</button>
				))}
			</div>

			<AdminPanel title="Admin directory">
				<AdminDataTable
					columns={columns}
					data={pageItems}
					rowKey={(a) => a.id}
					loading={loading}
					search={search}
					onSearchChange={setSearch}
					searchPlaceholder="Search name, email, university…"
					hasActiveFilters={Boolean(roleFilter || statusFilter || universityFilter)}
					emptyMessage="No admins yet. Create a super admin or university admin above."
					emptyFilteredMessage="No admins match these filters."
					selectable={{
						selectedIds,
						onToggle: toggleSelect,
						onToggleAll: toggleAll,
						allVisibleSelected:
							pageItems.length > 0 && pageItems.every((a) => selectedIds.has(a.id)),
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
									className="ghost-btn admin-btn-danger"
									disabled={working}
									onClick={() => setBulkDeleteOpen(true)}
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
								options={SUPER_ADMIN_CREATE_ROLES.map((r) => ({
									value: r.value,
									label: r.label,
								}))}
							/>
							<AdminSelect
								compact
								value={statusFilter}
								onChange={setStatusFilter}
								placeholder="All statuses"
								clearable
								aria-label="Filter by status"
								searchThreshold={99}
								options={[
									{ value: "active", label: "active" },
									{ value: "suspended", label: "suspended" },
									{ value: "inactive", label: "inactive" },
								]}
							/>
							{scopeTab !== "super" && (
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
			</AdminPanel>

			{detailUserId && (
				<AdminConsoleDetailModal
					userId={detailUserId}
					universities={universities}
					currentUserId={currentUser?.id}
					onClose={() => setDetailUserId(null)}
					onUpdated={load}
				/>
			)}

			<ConfirmDialog
				open={Boolean(deleteTarget)}
				title={`Delete ${deleteTarget?.name ?? "admin"}?`}
				description={
					deleteTarget
						? `${deleteTarget.name} (${deleteTarget.email}) will be permanently removed.`
						: ""
				}
				confirmLabel="Delete admin"
				cancelLabel="Keep admin"
				loading={working}
				onConfirm={() => void confirmDeleteOne()}
				onCancel={() => {
					if (!working) setDeleteTarget(null);
				}}
			/>

			<ConfirmDialog
				open={bulkDeleteOpen}
				title={`Delete ${selectedIds.size} admins?`}
				description="Selected admin accounts will be permanently removed. Your own account is never included."
				confirmLabel="Delete selected"
				cancelLabel="Cancel"
				loading={working}
				onConfirm={() => void confirmBulkDelete()}
				onCancel={() => {
					if (!working) setBulkDeleteOpen(false);
				}}
			/>
		</SuperAdminShell>
	);
}
