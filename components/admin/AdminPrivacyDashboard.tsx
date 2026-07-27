"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
	AdminPanel,
	AdminShell,
	AdminStatCard,
	formatAdminDate,
} from "@/components/admin/AdminShell";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import {
	createAdminPrivacy,
	deleteAdminPrivacy,
	fetchAdminPrivacy,
	updateAdminPrivacy,
} from "@/lib/admin-api";
import type {
	PrivacyStats,
	ResearchPrivacySettingRecord,
} from "@/lib/admin-governance";

const DATA_CLASSES = ["public", "internal", "confidential", "restricted", "special_category"] as const;
const SCOPES = ["institution", "faculty", "department", "role"] as const;
const RAW_ACCESS_LEVELS = ["never", "with_authorisation", "audit_only", "unrestricted"] as const;

const DATA_CLASS_DESCRIPTIONS: Record<string, string> = {
	public: "Non-sensitive data available for open access and public sharing",
	internal: "Data restricted to institutional users only — standard research outputs",
	confidential: "Sensitive data requiring role-based access controls and audit trails",
	restricted: "Highly sensitive data with strict access controls and mandatory encryption",
	special_category: "Data requiring explicit consent under NDPR/GDPR — health, biometric, ethnic origin",
};

const COMPLIANCE_MAP: Record<string, { ndpr: string; gdpr: string }> = {
	public: { ndpr: "NDPA S30 (public data)", gdpr: "Art. 6(1)(e) public interest" },
	internal: { ndpr: "NDPA S29 (processing)", gdpr: "Art. 6(1)(f) legitimate interest" },
	confidential: { ndpr: "NDPA S30(2) (confidential)", gdpr: "Art. 6(1)(a) consent" },
	restricted: { ndpr: "NDPA S31 (restricted)", gdpr: "Art. 9 special categories" },
	special_category: { ndpr: "NDPA S30(1) (sensitive)", gdpr: "Art. 9(2) explicit consent" },
};

const emptyForm = {
	name: "",
	description: "",
	dataClass: "confidential" as string,
	scope: "institution" as string,
	faculties: "",
	roles: "",
	features: "",
	adminRawAccess: "never" as string,
	allowGovernanceMetadata: true,
	allowProvenanceReview: true,
	redactPiiInLogs: true,
	requireExplicitAuthorisation: true,
	enabled: true,
	priority: "100",
};

function exportPrivacyCsv(rules: ResearchPrivacySettingRecord[]) {
	const headers = [
		"ID",
		"Name",
		"Data Class",
		"Scope",
		"Admin Raw Access",
		"Enabled",
		"Priority",
		"Faculties",
		"Roles",
		"Features",
		"Created At",
	];
	const lines = rules.map((r) =>
		[
			r.id,
			r.name,
			r.dataClass,
			r.scope,
			r.adminRawAccess,
			r.enabled ? "Yes" : "No",
			String(r.priority),
			r.faculties.join("; "),
			r.roles.join("; "),
			r.features.join("; "),
			r.createdAt,
		]
			.map((c) => `"${String(c).replace(/"/g, '""')}"`)
			.join(","),
	);
	const csv = [headers.join(","), ...lines].join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `privacy-rules-${new Date().toISOString().slice(0, 10)}.csv`;
	a.click();
	URL.revokeObjectURL(url);
}

export function AdminPrivacyDashboard() {
	const { ready } = useAdminGuard();
	const [settings, setSettings] = useState<ResearchPrivacySettingRecord[]>([]);
	const [stats, setStats] = useState<PrivacyStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [working, setWorking] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [form, setForm] = useState(emptyForm);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [showForm, setShowForm] = useState(false);

	const load = useCallback(async () => {
		setError(null);
		try {
			const data = await fetchAdminPrivacy();
			setSettings(data.settings);
			setStats(data.stats);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (ready) void load();
	}, [load, ready]);

	const startEdit = (rule: ResearchPrivacySettingRecord) => {
		setEditingId(rule.id);
		setShowForm(true);
		setForm({
			name: rule.name,
			description: rule.description ?? "",
			dataClass: rule.dataClass || "confidential",
			scope: rule.scope || "institution",
			faculties: (rule.faculties ?? []).join(", "),
			roles: (rule.roles ?? []).join(", "),
			features: (rule.features ?? []).join(", "),
			adminRawAccess: rule.adminRawAccess || "never",
			allowGovernanceMetadata: rule.allowGovernanceMetadata !== false,
			allowProvenanceReview: rule.allowProvenanceReview !== false,
			redactPiiInLogs: rule.redactPiiInLogs !== false,
			requireExplicitAuthorisation: rule.requireExplicitAuthorisation !== false,
			enabled: rule.enabled,
			priority: String(rule.priority ?? 100),
		});
	};

	const onSave = async () => {
		if (!form.name.trim()) {
			setError("Rule name is required.");
			return;
		}
		setWorking(true);
		setError(null);
		try {
			const payload = {
				name: form.name,
				description: form.description,
				dataClass: form.dataClass,
				scope: form.scope,
				faculties: form.faculties
					.split(",")
					.map((f) => f.trim())
					.filter(Boolean),
				roles: form.roles
					.split(",")
					.map((r) => r.trim())
					.filter(Boolean),
				features: form.features
					.split(",")
					.map((f) => f.trim())
					.filter(Boolean),
				adminRawAccess: form.adminRawAccess,
				allowGovernanceMetadata: form.allowGovernanceMetadata,
				allowProvenanceReview: form.allowProvenanceReview,
				redactPiiInLogs: form.redactPiiInLogs,
				requireExplicitAuthorisation: form.requireExplicitAuthorisation,
				enabled: form.enabled,
				priority: Number.parseInt(form.priority, 10) || 100,
			};
			if (editingId) {
				await updateAdminPrivacy(editingId, payload);
			} else {
				await createAdminPrivacy(payload);
			}
			setForm(emptyForm);
			setEditingId(null);
			setShowForm(false);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const toggle = async (rule: ResearchPrivacySettingRecord) => {
		setWorking(true);
		try {
			await updateAdminPrivacy(rule.id, { enabled: !rule.enabled });
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onDelete = async (id: string) => {
		if (!window.confirm("Delete this privacy rule?")) return;
		setWorking(true);
		try {
			await deleteAdminPrivacy(id);
			if (editingId === id) {
				setEditingId(null);
				setForm(emptyForm);
				setShowForm(false);
			}
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const consentFeatures = useMemo(() => {
		const features = new Set<string>();
		for (const s of settings) {
			if (s.requireExplicitAuthorisation && s.features) {
				for (const f of s.features) features.add(f);
			}
		}
		return Array.from(features);
	}, [settings]);

	return (
		<AdminShell
			title="Research Privacy Controls"
			subtitle="Data classification, access controls, and consent management for research data"
			breadcrumb="Admin · Governance"
			actions={
				<>
					<button
						type="button"
						className="ghost-btn"
						disabled={!settings.length}
						onClick={() => exportPrivacyCsv(settings)}
					>
						Export CSV
					</button>
					<button
						type="button"
						className="ghost-btn"
						onClick={() => {
							setShowForm((v) => !v);
							if (showForm) {
								setEditingId(null);
								setForm(emptyForm);
							}
						}}
					>
						{showForm ? "Hide form" : "New rule"}
					</button>
					<button type="button" className="ghost-btn" onClick={() => void load()}>
						Refresh
					</button>
				</>
			}
		>
			{loading && <p className="muted">Loading privacy controls…</p>}
			{error && <div className="banner banner-error">{error}</div>}

			{stats && (
				<section className="admin-stats">
					<AdminStatCard label="Total" value={stats.total} accent="primary" />
					<AdminStatCard label="Enabled" value={stats.enabled} accent="success" />
					<AdminStatCard label="Deny raw access" value={stats.neverRaw} accent="warning" />
					<AdminStatCard label="Restricted" value={stats.restricted} accent="warning" />
					<AdminStatCard
						label="Special category"
						value={stats.special}
						accent={stats.special > 0 ? "danger" : undefined}
					/>
					<AdminStatCard label="Disabled" value={stats.disabled} accent="primary" />
				</section>
			)}

			<AdminPanel
				title="Data classification levels"
				description="Sensitivity categories applied to research data"
			>
				<div className="admin-bar-list">
					{DATA_CLASSES.map((dc) => (
						<div key={dc} className="admin-bar-item">
							<span className="admin-bar-label">
								<strong>{dc.replace(/_/g, " ")}</strong>
							</span>
							<span className="admin-bar-value">
								{DATA_CLASS_DESCRIPTIONS[dc]}
							</span>
						</div>
					))}
				</div>
			</AdminPanel>

			{showForm && (
				<AdminPanel
					title={editingId ? "Edit privacy rule" : "Create privacy rule"}
					description="Define data access and consent controls for research data"
				>
					<div className="admin-form-grid">
						<label>
							Name
							<input
								className="topic-input"
								value={form.name}
								onChange={(e) =>
									setForm((f) => ({ ...f, name: e.target.value }))
								}
							/>
						</label>
						<label className="admin-form-span">
							Description
							<input
								className="topic-input"
								value={form.description}
								onChange={(e) =>
									setForm((f) => ({ ...f, description: e.target.value }))
								}
							/>
						</label>
						<label>
							Data classification
							<select
								className="topic-input"
								value={form.dataClass}
								onChange={(e) =>
									setForm((f) => ({ ...f, dataClass: e.target.value }))
								}
							>
								{DATA_CLASSES.map((c) => (
									<option key={c} value={c}>
										{c.replace(/_/g, " ")}
									</option>
								))}
							</select>
						</label>
						<label>
							Scope
							<select
								className="topic-input"
								value={form.scope}
								onChange={(e) =>
									setForm((f) => ({ ...f, scope: e.target.value }))
								}
							>
								{SCOPES.map((s) => (
									<option key={s} value={s}>
										{s}
									</option>
								))}
							</select>
						</label>
						<label>
							Faculties (comma-separated)
							<input
								className="topic-input"
								value={form.faculties}
								onChange={(e) =>
									setForm((f) => ({ ...f, faculties: e.target.value }))
								}
							/>
						</label>
						<label>
							Roles (comma-separated)
							<input
								className="topic-input"
								placeholder="lecturer, researcher, student"
								value={form.roles}
								onChange={(e) =>
									setForm((f) => ({ ...f, roles: e.target.value }))
								}
							/>
						</label>
						<label>
							Features (comma-separated)
							<input
								className="topic-input"
								placeholder="research_workspace, ai_sharing…"
								value={form.features}
								onChange={(e) =>
									setForm((f) => ({ ...f, features: e.target.value }))
								}
							/>
						</label>
						<label>
							Admin raw access
							<select
								className="topic-input"
								value={form.adminRawAccess}
								onChange={(e) =>
									setForm((f) => ({
										...f,
										adminRawAccess: e.target.value,
									}))
								}
							>
								{RAW_ACCESS_LEVELS.map((l) => (
									<option key={l} value={l}>
										{l.replace(/_/g, " ")}
									</option>
								))}
							</select>
						</label>
						<label>
							Priority
							<input
								className="topic-input"
								type="number"
								value={form.priority}
								onChange={(e) =>
									setForm((f) => ({ ...f, priority: e.target.value }))
								}
							/>
						</label>
					</div>

					<label className="admin-checkbox-label">
						<input
							type="checkbox"
							checked={form.allowGovernanceMetadata}
							onChange={(e) =>
								setForm((f) => ({
									...f,
									allowGovernanceMetadata: e.target.checked,
								}))
							}
						/>
						Allow governance metadata access
					</label>
					<label className="admin-checkbox-label">
						<input
							type="checkbox"
							checked={form.allowProvenanceReview}
							onChange={(e) =>
								setForm((f) => ({
									...f,
									allowProvenanceReview: e.target.checked,
								}))
							}
						/>
						Allow provenance review
					</label>
					<label className="admin-checkbox-label">
						<input
							type="checkbox"
							checked={form.redactPiiInLogs}
							onChange={(e) =>
								setForm((f) => ({
									...f,
									redactPiiInLogs: e.target.checked,
								}))
							}
						/>
						Redact PII in logs
					</label>
					<label className="admin-checkbox-label">
						<input
							type="checkbox"
							checked={form.requireExplicitAuthorisation}
							onChange={(e) =>
								setForm((f) => ({
									...f,
									requireExplicitAuthorisation: e.target.checked,
								}))
							}
						/>
						Require explicit authorisation
					</label>
					<label className="admin-checkbox-label">
						<input
							type="checkbox"
							checked={form.enabled}
							onChange={(e) =>
								setForm((f) => ({ ...f, enabled: e.target.checked }))
							}
						/>
						Enabled
					</label>

					<div className="admin-actions-row">
						<button
							type="button"
							className="primary-btn"
							disabled={working}
							onClick={() => void onSave()}
						>
							{editingId ? "Save changes" : "Create rule"}
						</button>
						<button
							type="button"
							className="ghost-btn"
							onClick={() => {
								setEditingId(null);
								setForm(emptyForm);
								setShowForm(false);
							}}
						>
							Cancel
						</button>
					</div>
				</AdminPanel>
			)}

			<AdminPanel
				title="Privacy rules"
				description={`${settings.length} rule(s) configured`}
			>
				<div className="admin-table-scroll">
					<table className="admin-simple-table">
						<thead>
							<tr>
								<th>Name</th>
								<th>Data class</th>
								<th>Scope</th>
								<th>Admin raw access</th>
								<th>Enabled</th>
								<th>Priority</th>
								<th>Created</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{settings.length === 0 ? (
								<tr>
									<td colSpan={8} className="muted">
										No privacy rules configured.
									</td>
								</tr>
							) : (
								settings.map((rule) => (
									<tr
										key={rule.id}
										className={!rule.enabled ? "admin-row-muted" : undefined}
									>
										<td>
											<strong>{rule.name}</strong>
											{rule.description && (
												<p className="muted">{rule.description}</p>
											)}
										</td>
										<td>
											<span
												className={`admin-chip admin-chip-${
													rule.dataClass === "special_category"
														? "blocked"
														: rule.dataClass === "restricted"
															? "restricted"
															: "permitted"
												}`}
											>
												{rule.dataClass.replace(/_/g, " ")}
											</span>
										</td>
										<td>{rule.scope}</td>
										<td>{rule.adminRawAccess.replace(/_/g, " ")}</td>
										<td>{rule.enabled ? "Enabled" : "Disabled"}</td>
										<td>{rule.priority}</td>
										<td>{formatAdminDate(rule.createdAt)}</td>
										<td className="admin-row-actions">
											<button
												type="button"
												className="ghost-btn"
												disabled={working}
												onClick={() => startEdit(rule)}
											>
												Edit
											</button>
											<button
												type="button"
												className="ghost-btn"
												disabled={working}
												onClick={() => void toggle(rule)}
											>
												{rule.enabled ? "Disable" : "Enable"}
											</button>
											<button
												type="button"
												className="ghost-btn"
												disabled={working}
												onClick={() => void onDelete(rule.id)}
											>
												Delete
											</button>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</AdminPanel>

			<div className="admin-gov-grid">
				<AdminPanel
					title="Privacy impact assessment"
					description="Evaluate the privacy impact of current rule configuration"
				>
					<div className="admin-bar-list">
						<div className="admin-bar-item">
							<span className="admin-bar-label">Special category rules</span>
							<span className="admin-bar-value">
								{settings.filter((s) => s.dataClass === "special_category").length}
							</span>
						</div>
						<div className="admin-bar-item">
							<span className="admin-bar-label">Rules denying raw access</span>
							<span className="admin-bar-value">
								{settings.filter((s) => s.adminRawAccess === "never").length}
							</span>
						</div>
						<div className="admin-bar-item">
							<span className="admin-bar-label">PII redaction active</span>
							<span className="admin-bar-value">
								{settings.filter((s) => s.redactPiiInLogs && s.enabled).length} of{" "}
								{settings.filter((s) => s.enabled).length} enabled
							</span>
						</div>
						<div className="admin-bar-item">
							<span className="admin-bar-label">Explicit consent required</span>
							<span className="admin-bar-value">
								{settings.filter((s) => s.requireExplicitAuthorisation && s.enabled).length} rules
							</span>
						</div>
					</div>
					<p className="muted" style={{ marginTop: "0.75rem" }}>
						Full DPIA workflow integration planned for future release.
					</p>
				</AdminPanel>

				<AdminPanel
					title="Consent management"
					description="Features requiring explicit user consent"
				>
					{consentFeatures.length === 0 ? (
						<p className="muted">
							No features currently require explicit consent.
						</p>
					) : (
						<div className="admin-bar-list">
							{consentFeatures.map((f) => (
								<div key={f} className="admin-bar-item">
									<span className="admin-bar-label">{f.replace(/_/g, " ")}</span>
									<span className="admin-chip admin-chip-restricted">
										consent required
									</span>
								</div>
							))}
						</div>
					)}
				</AdminPanel>
			</div>

			<AdminPanel
				title="Compliance mapping"
				description="How privacy rules map to NDPR and GDPR requirements"
			>
				<div className="admin-table-scroll">
					<table className="admin-simple-table">
						<thead>
							<tr>
								<th>Data classification</th>
								<th>NDPR basis</th>
								<th>GDPR basis</th>
								<th>Active rules</th>
							</tr>
						</thead>
						<tbody>
							{DATA_CLASSES.map((dc) => {
								const mapping = COMPLIANCE_MAP[dc];
								const count = settings.filter(
									(s) => s.dataClass === dc && s.enabled,
								).length;
								return (
									<tr key={dc}>
										<td>
											<strong>{dc.replace(/_/g, " ")}</strong>
										</td>
										<td>{mapping?.ndpr ?? "—"}</td>
										<td>{mapping?.gdpr ?? "—"}</td>
										<td>{count}</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</AdminPanel>
		</AdminShell>
	);
}
