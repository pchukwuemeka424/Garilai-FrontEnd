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
	createAdminDeletionRequest,
	createAdminRetentionPolicy,
	deleteAdminRetentionPolicy,
	fetchAdminRetention,
	updateAdminDeletionRequest,
	updateAdminRetentionPolicy,
} from "@/lib/admin-api";
import type {
	DeletionRequestRecord,
	RetentionPolicyRecord,
	RetentionStats,
} from "@/lib/admin-governance";

const DATA_CATEGORIES = [
	"chat_sessions",
	"research_outputs",
	"audit_logs",
	"user_accounts",
	"ai_interactions",
	"governance_records",
	"documents",
	"notes",
] as const;

const EXPIRY_ACTIONS = ["archive", "delete", "anonymize"] as const;
const REQUEST_TYPES = ["erasure", "export", "restrict"] as const;

function categoryLabel(id: string) {
	return id.replace(/_/g, " ");
}

function exportPoliciesCsv(policies: RetentionPolicyRecord[]) {
	const headers = [
		"ID",
		"Name",
		"Data Category",
		"Retain Days",
		"Archive Days",
		"Action On Expiry",
		"Legal Hold",
		"Enabled",
		"Regulatory Basis",
		"Created At",
	];
	const lines = policies.map((p) =>
		[
			p.id,
			p.name,
			p.dataCategory,
			String(p.retainDays),
			String(p.archiveDays),
			p.actionOnExpiry,
			p.legalHold ? "Yes" : "No",
			p.enabled ? "Yes" : "No",
			p.regulatoryBasis,
			p.createdAt,
		]
			.map((c) => `"${String(c).replace(/"/g, '""')}"`)
			.join(","),
	);
	const csv = [headers.join(","), ...lines].join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `retention-policies-${new Date().toISOString().slice(0, 10)}.csv`;
	a.click();
	URL.revokeObjectURL(url);
}

function exportDeletionsCsv(requests: DeletionRequestRecord[]) {
	const headers = [
		"ID",
		"Subject Name",
		"Subject Email",
		"Request Type",
		"Status",
		"Scope",
		"Legal Hold",
		"Due At",
		"Completed At",
		"Created At",
	];
	const lines = requests.map((r) =>
		[
			r.id,
			r.subjectName,
			r.subjectEmail,
			r.requestType,
			r.status,
			r.scope,
			r.legalHold ? "Yes" : "No",
			r.dueAt ?? "",
			r.completedAt ?? "",
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
	a.download = `deletion-requests-${new Date().toISOString().slice(0, 10)}.csv`;
	a.click();
	URL.revokeObjectURL(url);
}

const emptyPolicy = {
	name: "",
	description: "",
	dataCategory: "chat_sessions" as string,
	retainDays: "365",
	archiveDays: "90",
	actionOnExpiry: "archive" as string,
	legalHold: false,
	enabled: true,
	regulatoryBasis: "",
};

const emptyDeletion = {
	subjectName: "",
	subjectEmail: "",
	requestType: "erasure" as string,
	scope: "",
	notes: "",
};

export function AdminRetentionDashboard() {
	const { ready } = useAdminGuard();
	const [policies, setPolicies] = useState<RetentionPolicyRecord[]>([]);
	const [deletions, setDeletions] = useState<DeletionRequestRecord[]>([]);
	const [stats, setStats] = useState<RetentionStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [working, setWorking] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [policyForm, setPolicyForm] = useState(emptyPolicy);
	const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
	const [showPolicyForm, setShowPolicyForm] = useState(false);

	const [deletionForm, setDeletionForm] = useState(emptyDeletion);
	const [showDeletionForm, setShowDeletionForm] = useState(false);

	const load = useCallback(async () => {
		setError(null);
		try {
			const data = await fetchAdminRetention();
			setPolicies(data.policies);
			setDeletions(data.deletionRequests);
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

	const legalHoldPolicies = useMemo(
		() => policies.filter((p) => p.legalHold),
		[policies],
	);

	const onSavePolicy = async () => {
		if (!policyForm.name.trim()) {
			setError("Policy name is required.");
			return;
		}
		setWorking(true);
		setError(null);
		try {
			const payload = {
				...policyForm,
				retainDays: Number.parseInt(policyForm.retainDays, 10) || 365,
				archiveDays: Number.parseInt(policyForm.archiveDays, 10) || 0,
			};
			if (editingPolicyId) {
				await updateAdminRetentionPolicy(editingPolicyId, payload);
			} else {
				await createAdminRetentionPolicy(payload);
			}
			setPolicyForm(emptyPolicy);
			setEditingPolicyId(null);
			setShowPolicyForm(false);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const startEditPolicy = (policy: RetentionPolicyRecord) => {
		setEditingPolicyId(policy.id);
		setShowPolicyForm(true);
		setPolicyForm({
			name: policy.name,
			description: policy.description,
			dataCategory: policy.dataCategory,
			retainDays: String(policy.retainDays),
			archiveDays: String(policy.archiveDays),
			actionOnExpiry: policy.actionOnExpiry,
			legalHold: policy.legalHold,
			enabled: policy.enabled,
			regulatoryBasis: policy.regulatoryBasis,
		});
	};

	const togglePolicy = async (policy: RetentionPolicyRecord) => {
		setWorking(true);
		try {
			await updateAdminRetentionPolicy(policy.id, { enabled: !policy.enabled });
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const toggleHold = async (policy: RetentionPolicyRecord) => {
		setWorking(true);
		try {
			await updateAdminRetentionPolicy(policy.id, {
				legalHold: !policy.legalHold,
			});
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onDeletePolicy = async (id: string) => {
		if (!window.confirm("Permanently delete this retention policy?")) return;
		setWorking(true);
		try {
			await deleteAdminRetentionPolicy(id);
			if (editingPolicyId === id) {
				setEditingPolicyId(null);
				setPolicyForm(emptyPolicy);
				setShowPolicyForm(false);
			}
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onCreateDeletion = async () => {
		if (!deletionForm.subjectName.trim() || !deletionForm.subjectEmail.trim()) {
			setError("Subject name and email are required.");
			return;
		}
		setWorking(true);
		setError(null);
		try {
			await createAdminDeletionRequest(deletionForm);
			setDeletionForm(emptyDeletion);
			setShowDeletionForm(false);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const advanceDeletion = async (id: string, status: string) => {
		setWorking(true);
		try {
			await updateAdminDeletionRequest(id, {
				status,
				...(status === "completed"
					? { completedAt: new Date().toISOString() }
					: {}),
			});
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const markDeletionHold = async (id: string) => {
		setWorking(true);
		try {
			const req = deletions.find((d) => d.id === id);
			await updateAdminDeletionRequest(id, {
				legalHold: !req?.legalHold,
			});
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const complianceCalendar = useMemo(() => {
		const now = Date.now();
		return policies
			.filter((p) => p.enabled && !p.legalHold)
			.map((p) => {
				const created = new Date(p.createdAt).getTime();
				const expiresAt = created + p.retainDays * 86_400_000;
				const daysRemaining = Math.ceil((expiresAt - now) / 86_400_000);
				return { policy: p, expiresAt, daysRemaining };
			})
			.sort((a, b) => a.expiresAt - b.expiresAt)
			.slice(0, 10);
	}, [policies]);

	return (
		<AdminShell
			title="Retention & Deletion Management"
			subtitle="How long governance and research-related records are retained, archived, or deleted"
			breadcrumb="Admin · Controls"
			actions={
				<>
					<button
						type="button"
						className="ghost-btn"
						disabled={!policies.length}
						onClick={() => {
							exportPoliciesCsv(policies);
							if (deletions.length) exportDeletionsCsv(deletions);
						}}
					>
						Export CSV
					</button>
					<button type="button" className="ghost-btn" onClick={() => void load()}>
						Refresh
					</button>
				</>
			}
		>
			{loading && <p className="muted">Loading retention controls…</p>}
			{error && <div className="banner banner-error">{error}</div>}

			{stats && (
				<section className="admin-stats">
					<AdminStatCard label="Policies" value={stats.policies} accent="primary" />
					<AdminStatCard label="Enabled" value={stats.enabled} accent="success" />
					<AdminStatCard
						label="Legal holds"
						value={stats.legalHolds}
						accent={stats.legalHolds > 0 ? "warning" : undefined}
					/>
					<AdminStatCard
						label="Deletion total"
						value={stats.deletionTotal}
						accent="primary"
					/>
					<AdminStatCard
						label="Deletion open"
						value={stats.deletionOpen}
						accent={stats.deletionOpen > 0 ? "danger" : undefined}
					/>
					<AdminStatCard
						label="Deletion completed"
						value={stats.deletionCompleted}
						accent="success"
					/>
				</section>
			)}

			<div className="admin-actions-row">
				<button
					type="button"
					className="primary-btn"
					onClick={() => {
						setShowPolicyForm((v) => !v);
						if (showPolicyForm) {
							setEditingPolicyId(null);
							setPolicyForm(emptyPolicy);
						}
					}}
				>
					{showPolicyForm ? "Hide policy form" : "New policy"}
				</button>
				<button
					type="button"
					className="ghost-btn"
					onClick={() => setShowDeletionForm((v) => !v)}
				>
					{showDeletionForm ? "Hide deletion form" : "New deletion request"}
				</button>
			</div>

			{showPolicyForm && (
				<AdminPanel
					title={editingPolicyId ? "Edit retention policy" : "Create retention policy"}
					description="Define data lifecycle rules by category"
				>
					<div className="admin-form-grid">
						<label>
							Name
							<input
								className="topic-input"
								value={policyForm.name}
								onChange={(e) =>
									setPolicyForm((f) => ({ ...f, name: e.target.value }))
								}
							/>
						</label>
						<label className="admin-form-span">
							Description
							<input
								className="topic-input"
								value={policyForm.description}
								onChange={(e) =>
									setPolicyForm((f) => ({
										...f,
										description: e.target.value,
									}))
								}
							/>
						</label>
						<label>
							Data category
							<select
								className="topic-input"
								value={policyForm.dataCategory}
								onChange={(e) =>
									setPolicyForm((f) => ({
										...f,
										dataCategory: e.target.value,
									}))
								}
							>
								{DATA_CATEGORIES.map((c) => (
									<option key={c} value={c}>
										{categoryLabel(c)}
									</option>
								))}
							</select>
						</label>
						<label>
							Retain days
							<input
								className="topic-input"
								type="number"
								value={policyForm.retainDays}
								onChange={(e) =>
									setPolicyForm((f) => ({
										...f,
										retainDays: e.target.value,
									}))
								}
							/>
						</label>
						<label>
							Archive days
							<input
								className="topic-input"
								type="number"
								value={policyForm.archiveDays}
								onChange={(e) =>
									setPolicyForm((f) => ({
										...f,
										archiveDays: e.target.value,
									}))
								}
							/>
						</label>
						<label>
							Action on expiry
							<select
								className="topic-input"
								value={policyForm.actionOnExpiry}
								onChange={(e) =>
									setPolicyForm((f) => ({
										...f,
										actionOnExpiry: e.target.value,
									}))
								}
							>
								{EXPIRY_ACTIONS.map((a) => (
									<option key={a} value={a}>
										{a}
									</option>
								))}
							</select>
						</label>
						<label>
							Regulatory basis
							<input
								className="topic-input"
								placeholder="NDPA / institutional policy"
								value={policyForm.regulatoryBasis}
								onChange={(e) =>
									setPolicyForm((f) => ({
										...f,
										regulatoryBasis: e.target.value,
									}))
								}
							/>
						</label>
					</div>
					<label className="admin-checkbox-label">
						<input
							type="checkbox"
							checked={policyForm.legalHold}
							onChange={(e) =>
								setPolicyForm((f) => ({
									...f,
									legalHold: e.target.checked,
								}))
							}
						/>
						Legal hold (prevent deletion)
					</label>
					<label className="admin-checkbox-label">
						<input
							type="checkbox"
							checked={policyForm.enabled}
							onChange={(e) =>
								setPolicyForm((f) => ({
									...f,
									enabled: e.target.checked,
								}))
							}
						/>
						Enabled
					</label>
					<div className="admin-actions-row">
						<button
							type="button"
							className="primary-btn"
							disabled={working}
							onClick={() => void onSavePolicy()}
						>
							{editingPolicyId ? "Save policy" : "Create policy"}
						</button>
						<button
							type="button"
							className="ghost-btn"
							onClick={() => {
								setEditingPolicyId(null);
								setPolicyForm(emptyPolicy);
								setShowPolicyForm(false);
							}}
						>
							Cancel
						</button>
					</div>
				</AdminPanel>
			)}

			<AdminPanel
				title="Retention policies"
				description={`${policies.length} policies configured`}
			>
				<div className="admin-table-scroll">
					<table className="admin-simple-table">
						<thead>
							<tr>
								<th>Name</th>
								<th>Data category</th>
								<th>Retain days</th>
								<th>Archive days</th>
								<th>On expiry</th>
								<th>Legal hold</th>
								<th>Enabled</th>
								<th>Regulatory basis</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{policies.length === 0 ? (
								<tr>
									<td colSpan={9} className="muted">
										No retention policies configured.
									</td>
								</tr>
							) : (
								policies.map((policy) => (
									<tr
										key={policy.id}
										className={
											!policy.enabled ? "admin-row-muted" : undefined
										}
									>
										<td>
											<strong>{policy.name}</strong>
											{policy.description && (
												<p className="muted">{policy.description}</p>
											)}
										</td>
										<td>{categoryLabel(policy.dataCategory)}</td>
										<td>{policy.retainDays}d</td>
										<td>{policy.archiveDays}d</td>
										<td>{policy.actionOnExpiry}</td>
										<td>
											{policy.legalHold ? (
												<span className="admin-chip admin-chip-restricted">
													held
												</span>
											) : (
												"—"
											)}
										</td>
										<td>{policy.enabled ? "Enabled" : "Disabled"}</td>
										<td>{policy.regulatoryBasis || "—"}</td>
										<td className="admin-row-actions">
											<button
												type="button"
												className="ghost-btn"
												disabled={working}
												onClick={() => startEditPolicy(policy)}
											>
												Edit
											</button>
											<button
												type="button"
												className="ghost-btn"
												disabled={working}
												onClick={() => void togglePolicy(policy)}
											>
												{policy.enabled ? "Disable" : "Enable"}
											</button>
											<button
												type="button"
												className="ghost-btn"
												disabled={working}
												onClick={() => void toggleHold(policy)}
											>
												{policy.legalHold
													? "Release hold"
													: "Legal hold"}
											</button>
											<button
												type="button"
												className="ghost-btn"
												disabled={working}
												onClick={() =>
													void onDeletePolicy(policy.id)
												}
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

			{showDeletionForm && (
				<AdminPanel
					title="Create deletion request"
					description="Submit a subject access / erasure / export request"
				>
					<div className="admin-form-grid">
						<label>
							Subject name
							<input
								className="topic-input"
								value={deletionForm.subjectName}
								onChange={(e) =>
									setDeletionForm((f) => ({
										...f,
										subjectName: e.target.value,
									}))
								}
							/>
						</label>
						<label>
							Subject email
							<input
								className="topic-input"
								value={deletionForm.subjectEmail}
								onChange={(e) =>
									setDeletionForm((f) => ({
										...f,
										subjectEmail: e.target.value,
									}))
								}
							/>
						</label>
						<label>
							Request type
							<select
								className="topic-input"
								value={deletionForm.requestType}
								onChange={(e) =>
									setDeletionForm((f) => ({
										...f,
										requestType: e.target.value,
									}))
								}
							>
								{REQUEST_TYPES.map((t) => (
									<option key={t} value={t}>
										{t}
									</option>
								))}
							</select>
						</label>
						<label>
							Scope
							<input
								className="topic-input"
								placeholder="e.g. all research data, chat sessions"
								value={deletionForm.scope}
								onChange={(e) =>
									setDeletionForm((f) => ({
										...f,
										scope: e.target.value,
									}))
								}
							/>
						</label>
						<label className="admin-form-span">
							Notes
							<input
								className="topic-input"
								value={deletionForm.notes}
								onChange={(e) =>
									setDeletionForm((f) => ({
										...f,
										notes: e.target.value,
									}))
								}
							/>
						</label>
					</div>
					<div className="admin-actions-row">
						<button
							type="button"
							className="primary-btn"
							disabled={working}
							onClick={() => void onCreateDeletion()}
						>
							Submit request
						</button>
						<button
							type="button"
							className="ghost-btn"
							onClick={() => {
								setShowDeletionForm(false);
								setDeletionForm(emptyDeletion);
							}}
						>
							Cancel
						</button>
					</div>
				</AdminPanel>
			)}

			<AdminPanel
				title="Deletion requests"
				description={`${deletions.length} request(s)`}
			>
				<div className="admin-table-scroll">
					<table className="admin-simple-table">
						<thead>
							<tr>
								<th>Subject</th>
								<th>Email</th>
								<th>Type</th>
								<th>Status</th>
								<th>Scope</th>
								<th>Legal hold</th>
								<th>Due</th>
								<th>Completed</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{deletions.length === 0 ? (
								<tr>
									<td colSpan={9} className="muted">
										No deletion requests.
									</td>
								</tr>
							) : (
								deletions.map((req) => (
									<tr
										key={req.id}
										className={
											req.legalHold
												? "admin-row-flagged"
												: undefined
										}
									>
										<td>
											<strong>{req.subjectName}</strong>
										</td>
										<td>{req.subjectEmail}</td>
										<td>{req.requestType}</td>
										<td>
											<span
												className={`admin-chip admin-chip-${
													req.status === "completed"
														? "permitted"
														: req.status === "rejected"
															? "blocked"
															: "restricted"
												}`}
											>
												{req.status.replace(/_/g, " ")}
											</span>
										</td>
										<td>{req.scope || "—"}</td>
										<td>
											{req.legalHold ? (
												<span className="admin-chip admin-chip-restricted">
													held
												</span>
											) : (
												"—"
											)}
										</td>
										<td>
											{req.dueAt
												? formatAdminDate(req.dueAt)
												: "—"}
										</td>
										<td>
											{req.completedAt
												? formatAdminDate(req.completedAt)
												: "—"}
										</td>
										<td className="admin-row-actions">
											{req.status === "pending" && (
												<button
													type="button"
													className="ghost-btn"
													disabled={working}
													onClick={() =>
														void advanceDeletion(
															req.id,
															"in_progress",
														)
													}
												>
													Approve
												</button>
											)}
											{req.status === "pending" && (
												<button
													type="button"
													className="ghost-btn"
													disabled={working}
													onClick={() =>
														void advanceDeletion(
															req.id,
															"rejected",
														)
													}
												>
													Reject
												</button>
											)}
											{req.status === "in_progress" && (
												<button
													type="button"
													className="primary-btn"
													disabled={working}
													onClick={() =>
														void advanceDeletion(
															req.id,
															"completed",
														)
													}
												>
													Complete
												</button>
											)}
											{req.status !== "completed" &&
												req.status !== "rejected" && (
													<button
														type="button"
														className="ghost-btn"
														disabled={working}
														onClick={() =>
															void markDeletionHold(req.id)
														}
													>
														{req.legalHold
															? "Release hold"
															: "Legal hold"}
													</button>
												)}
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
					title="Compliance calendar"
					description="Upcoming data expiry based on retention policies"
				>
					{complianceCalendar.length === 0 ? (
						<p className="muted">No active retention schedules.</p>
					) : (
						<div className="admin-bar-list">
							{complianceCalendar.map(({ policy, daysRemaining }) => (
								<div key={policy.id} className="admin-bar-item">
									<span className="admin-bar-label">
										{policy.name} ({categoryLabel(policy.dataCategory)})
									</span>
									<div className="admin-bar-track">
										<div
											className="admin-bar-fill"
											style={{
												width: `${Math.max(0, Math.min(100, ((policy.retainDays - Math.max(0, daysRemaining)) / policy.retainDays) * 100))}%`,
											}}
										/>
									</div>
									<span className="admin-bar-value">
										{daysRemaining > 0
											? `${daysRemaining}d remaining`
											: "Expired"}
									</span>
								</div>
							))}
						</div>
					)}
				</AdminPanel>

				<AdminPanel
					title="Legal hold management"
					description={`${legalHoldPolicies.length} policies under legal hold`}
				>
					{legalHoldPolicies.length === 0 ? (
						<p className="muted">No policies under legal hold.</p>
					) : (
						<div className="admin-bar-list">
							{legalHoldPolicies.map((p) => (
								<div key={p.id} className="admin-bar-item">
									<span className="admin-bar-label">
										<span className="admin-sev admin-sev-warning">!</span>{" "}
										{p.name} — {categoryLabel(p.dataCategory)}
									</span>
									<button
										type="button"
										className="ghost-btn"
										disabled={working}
										onClick={() => void toggleHold(p)}
									>
										Release hold
									</button>
								</div>
							))}
						</div>
					)}
				</AdminPanel>
			</div>

			<AdminPanel
				title="Automation"
				description="Scheduled data lifecycle jobs"
			>
				<div className="admin-bar-list">
					<div className="admin-bar-item">
						<span className="admin-bar-label">
							<strong>Auto-archive</strong> — automatically archive data past retention period
						</span>
						<span className="admin-chip admin-chip-restricted">planned</span>
					</div>
					<div className="admin-bar-item">
						<span className="admin-bar-label">
							<strong>Auto-delete</strong> — permanently remove expired archived data
						</span>
						<span className="admin-chip admin-chip-restricted">planned</span>
					</div>
					<div className="admin-bar-item">
						<span className="admin-bar-label">
							<strong>Auto-anonymize</strong> — strip PII from expired records
						</span>
						<span className="admin-chip admin-chip-restricted">planned</span>
					</div>
				</div>
				<p className="muted" style={{ marginTop: "0.75rem" }}>
					Scheduled automation jobs will run according to policy definitions.
					Configuration available in a future release.
				</p>
			</AdminPanel>
		</AdminShell>
	);
}
