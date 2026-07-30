"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { AdminInput } from "@/components/admin/AdminInput";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { formatAdminDate, formatAdminRelative } from "@/components/admin/AdminShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
	deleteAdminUser,
	fetchAdminUser,
	resetAdminUserPassword,
	updateAdminUser,
	type UniversityRecord,
} from "@/lib/admin-api";
import {
	roleAccessSummary,
	roleLabel,
	SUPER_ADMIN_CREATE_ROLES,
} from "@/lib/admin-roles";
import type { UserRecord, UserRole } from "@/lib/dashboard";

type TabId = "profile" | "access" | "security";

type Props = {
	userId: string;
	universities: UniversityRecord[];
	currentUserId?: string | null;
	onClose: () => void;
	onUpdated: () => Promise<void> | void;
};

const STATUSES = ["active", "inactive", "suspended"] as const;

export function AdminConsoleDetailModal({
	userId,
	universities,
	currentUserId,
	onClose,
	onUpdated,
}: Props) {
	const titleId = useId();
	const [mounted, setMounted] = useState(false);
	const [user, setUser] = useState<UserRecord | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [tab, setTab] = useState<TabId>("profile");
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [form, setForm] = useState({
		name: "",
		email: "",
		role: "" as UserRole | "",
		status: "" as UserRecord["status"] | "",
		universityId: "",
		faculty: "",
		department: "",
		suspensionReason: "",
	});

	const isSelf = Boolean(currentUserId && currentUserId === userId);
	const isSuper = form.role === "admin";

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!mounted) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previous;
		};
	}, [mounted]);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			setLoading(true);
			setError(null);
			try {
				const record = await fetchAdminUser(userId);
				if (cancelled) return;
				setUser(record);
				setForm({
					name: record.name,
					email: record.email,
					role: record.role,
					status: record.status,
					universityId: record.universityId ?? "",
					faculty: record.faculty ?? "",
					department: record.department ?? "",
					suspensionReason: record.suspensionReason ?? "",
				});
			} catch (err) {
				if (!cancelled) setError(err instanceof Error ? err.message : String(err));
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [userId]);

	const accessLines = useMemo(
		() => (form.role ? roleAccessSummary(form.role) : []),
		[form.role],
	);

	const universityOptions = useMemo(
		() =>
			universities.map((uni) => ({
				value: uni.id,
				label: uni.name,
				hint: uni.status,
			})),
		[universities],
	);

	const saveProfile = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user) return;
		setSaving(true);
		setError(null);
		try {
			const nextRole = form.role as UserRole;
			const updated = await updateAdminUser(user.id, {
				name: form.name.trim(),
				email: form.email.trim(),
				role: nextRole,
				status: form.status as UserRecord["status"],
				universityId: nextRole === "admin" ? null : form.universityId || null,
				faculty: form.faculty.trim() || undefined,
				department: form.department.trim() || undefined,
				suspensionReason:
					form.status === "suspended" ? form.suspensionReason.trim() || null : null,
			});
			setUser(updated);
			setForm((f) => ({
				...f,
				name: updated.name,
				email: updated.email,
				role: updated.role,
				status: updated.status,
				universityId: updated.universityId ?? "",
				faculty: updated.faculty ?? "",
				department: updated.department ?? "",
				suspensionReason: updated.suspensionReason ?? "",
			}));
			await onUpdated();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	const resetPassword = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user) return;
		if (newPassword.length < 8) {
			setError("Password must be at least 8 characters.");
			return;
		}
		if (newPassword !== confirmPassword) {
			setError("Passwords do not match.");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			await resetAdminUserPassword(user.id, newPassword);
			setNewPassword("");
			setConfirmPassword("");
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	const confirmDelete = async () => {
		if (!user || isSelf) return;
		setSaving(true);
		setError(null);
		try {
			await deleteAdminUser(user.id);
			setDeleteOpen(false);
			await onUpdated();
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	const suspendAccess = async () => {
		if (!user || isSelf) return;
		setSaving(true);
		setError(null);
		try {
			await updateAdminUser(user.id, {
				status: "suspended",
				suspensionReason: "Suspended by super admin",
			});
			const refreshed = await fetchAdminUser(user.id);
			setUser(refreshed);
			setForm((f) => ({
				...f,
				status: refreshed.status,
				suspensionReason: refreshed.suspensionReason ?? "",
			}));
			await onUpdated();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	const reactivateAccess = async () => {
		if (!user || isSelf) return;
		setSaving(true);
		setError(null);
		try {
			await updateAdminUser(user.id, { status: "active" });
			const refreshed = await fetchAdminUser(user.id);
			setUser(refreshed);
			setForm((f) => ({
				...f,
				status: refreshed.status,
				suspensionReason: "",
			}));
			await onUpdated();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	if (!mounted) return null;

	const modal = (
		<div
			className="modal-backdrop confirm-dialog-backdrop"
			role="presentation"
			onClick={saving ? undefined : onClose}
		>
			<div
				className="modal dash-modal admin-console-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				onClick={(e) => e.stopPropagation()}
			>
				<header className="modal-header">
					<div>
						<h3 id={titleId}>{user ? user.name : "Admin details"}</h3>
						{user && (
							<p className="muted" style={{ margin: "0.25rem 0 0" }}>
								{roleLabel(user.role)}
								{user.role === "admin" ? " · Platform" : user.institution ? ` · ${user.institution}` : ""}
							</p>
						)}
					</div>
					<button type="button" className="icon-btn" onClick={onClose} aria-label="Close" disabled={saving}>
						×
					</button>
				</header>

				{loading ? (
					<p className="muted">Loading admin…</p>
				) : !user ? (
					<p className="error-text">{error ?? "Admin not found."}</p>
				) : (
					<>
						<div className="admin-actions-row" style={{ marginBottom: "1rem", gap: "0.5rem", flexWrap: "wrap" }}>
							{(
								[
									["profile", "Profile"],
									["access", "Access"],
									["security", "Security"],
								] as const
							).map(([id, label]) => (
								<button
									key={id}
									type="button"
									className={tab === id ? "primary-btn" : "ghost-btn"}
									onClick={() => setTab(id)}
								>
									{label}
								</button>
							))}
							<span className={`admin-chip admin-chip-status-${user.status}`}>{user.status}</span>
							{isSelf && <span className="admin-chip">You</span>}
						</div>

						{error && <p className="error-text">{error}</p>}

						{tab === "profile" && (
							<form className="dash-form" onSubmit={(e) => void saveProfile(e)}>
								<section className="admin-stats" style={{ marginBottom: "1rem" }}>
									<div>
										<p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
											Last active
										</p>
										<strong>{formatAdminRelative(user.lastActiveAt)}</strong>
									</div>
									<div>
										<p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
											Joined
										</p>
										<strong>{formatAdminDate(user.createdAt)}</strong>
									</div>
									<div>
										<p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
											Updated
										</p>
										<strong>{formatAdminDate(user.updatedAt ?? user.createdAt)}</strong>
									</div>
								</section>

								<div className="admin-form-grid">
									<AdminInput
										label="Full name"
										required
										value={form.name}
										onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
										disabled={saving}
									/>
									<AdminInput
										label="Email"
										type="email"
										required
										value={form.email}
										onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
										disabled={saving}
									/>
									<AdminSelect
										id="admin-detail-status"
										label="Status"
										value={form.status}
										onChange={(status) =>
											setForm((f) => ({ ...f, status: status as UserRecord["status"] }))
										}
										disabled={saving || isSelf}
										searchThreshold={99}
										options={STATUSES.map((s) => ({ value: s, label: s }))}
									/>
									{form.status === "suspended" && (
										<AdminInput
											span
											label="Suspension reason"
											value={form.suspensionReason}
											onChange={(e) =>
												setForm((f) => ({ ...f, suspensionReason: e.target.value }))
											}
											disabled={saving}
										/>
									)}
								</div>

								<div className="dash-form-actions">
									<button type="button" className="ghost-btn" onClick={onClose} disabled={saving}>
										Close
									</button>
									<button type="submit" className="primary-btn" disabled={saving}>
										{saving ? "Saving…" : "Save profile"}
									</button>
								</div>
							</form>
						)}

						{tab === "access" && (
							<form className="dash-form" onSubmit={(e) => void saveProfile(e)}>
								<div className="admin-form-grid">
									<AdminSelect
										id="admin-detail-role"
										label="Role"
										span
										value={form.role}
										onChange={(role) => {
											const next = role as UserRole;
											setForm((f) => ({
												...f,
												role: next,
												universityId: next === "admin" ? "" : f.universityId,
											}));
										}}
										disabled={saving || isSelf}
										searchThreshold={0}
										options={SUPER_ADMIN_CREATE_ROLES.map((opt) => ({
											value: opt.value,
											label: opt.label,
											hint: opt.scope === "platform" ? "Platform" : "University",
										}))}
									/>
									{!isSuper && (
										<>
											<AdminSelect
												id="admin-detail-university"
												label="University"
												span
												value={form.universityId}
												onChange={(universityId) => setForm((f) => ({ ...f, universityId }))}
												required
												disabled={saving}
												placeholder="Select university…"
												searchPlaceholder="Search universities…"
												searchThreshold={0}
												options={universityOptions}
											/>
											<AdminInput
												label="Faculty"
												value={form.faculty}
												onChange={(e) => setForm((f) => ({ ...f, faculty: e.target.value }))}
												disabled={saving}
												placeholder="Optional faculty"
											/>
											<AdminInput
												label="Department"
												value={form.department}
												onChange={(e) =>
													setForm((f) => ({ ...f, department: e.target.value }))
												}
												disabled={saving}
												placeholder="Optional department"
											/>
										</>
									)}
								</div>

								<div style={{ marginTop: "1rem" }}>
									<p className="muted" style={{ marginBottom: "0.5rem" }}>
										Access for {form.role ? roleLabel(form.role) : "this role"}
									</p>
									<div className="admin-chip-row">
										{accessLines.slice(0, 8).map((line) => (
											<span key={line} className="admin-chip">
												{line}
											</span>
										))}
									</div>
								</div>

								<div className="dash-form-actions">
									<button type="button" className="ghost-btn" onClick={onClose} disabled={saving}>
										Close
									</button>
									<button type="submit" className="primary-btn" disabled={saving || isSelf}>
										{saving ? "Saving…" : "Save access"}
									</button>
								</div>
							</form>
						)}

						{tab === "security" && (
							<div className="dash-form">
								<form onSubmit={(e) => void resetPassword(e)}>
									<p className="muted">
										Set a new password for this admin. They can sign in immediately with the new
										credentials.
									</p>
									<div className="admin-form-grid">
										<AdminInput
											label="New password"
											type="password"
											required
											minLength={8}
											value={newPassword}
											onChange={(e) => setNewPassword(e.target.value)}
											disabled={saving}
											autoComplete="new-password"
											placeholder="At least 8 characters"
										/>
										<AdminInput
											label="Confirm password"
											type="password"
											required
											minLength={8}
											value={confirmPassword}
											onChange={(e) => setConfirmPassword(e.target.value)}
											disabled={saving}
											autoComplete="new-password"
										/>
									</div>
									<div className="dash-form-actions">
										<button type="submit" className="primary-btn" disabled={saving}>
											{saving ? "Updating…" : "Reset password"}
										</button>
									</div>
								</form>

								<hr style={{ margin: "1.5rem 0", border: 0, borderTop: "1px solid var(--border, #e5e5e5)" }} />

								<div>
									<h4 style={{ margin: "0 0 0.5rem" }}>Danger zone</h4>
									<p className="muted">
										{isSelf
											? "You cannot delete or suspend your own super admin account from here."
											: "Suspend removes console access. Delete permanently removes the account."}
									</p>
									<div className="admin-actions-row" style={{ marginTop: "0.75rem" }}>
										{!isSelf && user.status === "active" && (
											<button
												type="button"
												className="ghost-btn"
												disabled={saving}
												onClick={() => void suspendAccess()}
											>
												Suspend access
											</button>
										)}
										{!isSelf && user.status !== "active" && (
											<button
												type="button"
												className="ghost-btn"
												disabled={saving}
												onClick={() => void reactivateAccess()}
											>
												Reactivate
											</button>
										)}
										{!isSelf && (
											<button
												type="button"
												className="ghost-btn admin-btn-danger"
												disabled={saving}
												onClick={() => setDeleteOpen(true)}
											>
												Delete admin
											</button>
										)}
									</div>
								</div>
							</div>
						)}
					</>
				)}
			</div>

			<ConfirmDialog
				open={deleteOpen}
				title={`Delete ${user?.name ?? "admin"}?`}
				description="This permanently removes the admin account. This cannot be undone."
				confirmLabel="Delete admin"
				cancelLabel="Keep admin"
				loading={saving}
				onConfirm={() => void confirmDelete()}
				onCancel={() => {
					if (!saving) setDeleteOpen(false);
				}}
			/>
		</div>
	);

	return createPortal(modal, document.body);
}
