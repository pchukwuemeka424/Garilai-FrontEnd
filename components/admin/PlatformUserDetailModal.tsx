"use client";

import { useEffect, useState } from "react";

import { AdminInput } from "@/components/admin/AdminInput";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { formatAdminDate, formatAdminRelative } from "@/components/admin/AdminShell";
import {
	fetchAdminUser,
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

type Props = {
	userId: string;
	universities: UniversityRecord[];
	onClose: () => void;
	onUpdated: () => Promise<void> | void;
};

export function PlatformUserDetailModal({ userId, universities, onClose, onUpdated }: Props) {
	const [user, setUser] = useState<UserRecord | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [form, setForm] = useState({
		name: "",
		email: "",
		role: "",
		status: "",
		universityId: "",
		faculty: "",
		department: "",
		programme: "",
		cohort: "",
		suspensionReason: "",
	});

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
					programme: record.programme ?? "",
					cohort: record.cohort ?? "",
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

	const uniName = (id: string | null | undefined) => {
		if (!id) return "—";
		return universities.find((u) => u.id === id)?.name ?? user?.institution ?? id;
	};

	const save = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!user) return;
		setSaving(true);
		setError(null);
		try {
			const updated = await updateAdminUser(user.id, {
				name: form.name.trim(),
				email: form.email.trim(),
				role: form.role as UserRecord["role"],
				status: form.status as UserRecord["status"],
				universityId: form.universityId || null,
				faculty: form.faculty.trim() || undefined,
				department: form.department.trim() || undefined,
				programme: form.programme.trim() || undefined,
				cohort: form.cohort.trim() || undefined,
				suspensionReason:
					form.status === "suspended" ? form.suspensionReason.trim() || null : null,
			});
			setUser(updated);
			await onUpdated();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	const resetPassword = async () => {
		if (!user) return;
		const pw = window.prompt(`Reset password for ${user.email}:`)?.trim();
		if (!pw || pw.length < 8) {
			if (pw) setError("Password must be at least 8 characters.");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			await resetAdminUserPassword(user.id, pw);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="modal-backdrop" onClick={onClose}>
			<div
				className="modal dash-modal"
				style={{ maxWidth: 720, maxHeight: "90vh", overflow: "auto" }}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="modal-header">
					<h3>{user ? `Account — ${user.name}` : "Account details"}</h3>
					<button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
						×
					</button>
				</div>

				{loading ? (
					<p className="muted">Loading…</p>
				) : !user ? (
					<p className="error-text">{error ?? "User not found."}</p>
				) : (
					<form className="dash-form" onSubmit={(e) => void save(e)}>
						{error && <p className="error-text">{error}</p>}

						<section className="admin-stats" style={{ marginBottom: "1rem" }}>
							<div>
								<p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
									University
								</p>
								<strong>{uniName(user.universityId)}</strong>
							</div>
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
							{user.tokenQuota && (
								<div>
									<p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
										Tokens
									</p>
									<strong>
										{user.tokenQuota.used.toLocaleString()} /{" "}
										{user.tokenQuota.allowance.toLocaleString()}
									</strong>
								</div>
							)}
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
								id="detail-role"
								label="Role"
								value={form.role}
								onChange={(role) => setForm((f) => ({ ...f, role }))}
								disabled={saving || user.role === "admin"}
								searchThreshold={0}
								options={
									user.role === "admin"
										? [{ value: "admin", label: roleLabel("admin") }]
										: ALL_ROLES.map((r) => ({ value: r, label: roleLabel(r) }))
								}
							/>
							<AdminSelect
								id="detail-status"
								label="Status"
								value={form.status}
								onChange={(status) => setForm((f) => ({ ...f, status }))}
								disabled={saving}
								searchThreshold={99}
								options={STATUSES.map((s) => ({ value: s, label: s }))}
							/>
							{user.role !== "admin" && (
								<AdminSelect
									id="detail-university"
									label="University"
									span
									value={form.universityId}
									onChange={(universityId) => setForm((f) => ({ ...f, universityId }))}
									disabled={saving}
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
								disabled={saving}
							/>
							<AdminInput
								label="Department"
								value={form.department}
								onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
								disabled={saving}
							/>
							<AdminInput
								label="Programme"
								value={form.programme}
								onChange={(e) => setForm((f) => ({ ...f, programme: e.target.value }))}
								disabled={saving}
							/>
							<AdminInput
								label="Cohort"
								value={form.cohort}
								onChange={(e) => setForm((f) => ({ ...f, cohort: e.target.value }))}
								disabled={saving}
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

						{(user.invitedAt || (user.complianceFlags && user.complianceFlags.length > 0)) && (
							<p className="muted" style={{ marginTop: "0.75rem" }}>
								{user.invitedAt ? `Invited ${formatAdminDate(user.invitedAt)}. ` : null}
								{user.complianceFlags && user.complianceFlags.length > 0
									? `Flags: ${user.complianceFlags.join(", ")}`
									: null}
							</p>
						)}

						<div className="dash-form-actions">
							<button
								type="button"
								className="ghost-btn"
								disabled={saving}
								onClick={() => void resetPassword()}
							>
								Reset password
							</button>
							<button type="button" className="ghost-btn" onClick={onClose}>
								Close
							</button>
							<button type="submit" className="primary-btn" disabled={saving}>
								{saving ? "Saving…" : "Save changes"}
							</button>
						</div>
					</form>
				)}
			</div>
		</div>
	);
}
