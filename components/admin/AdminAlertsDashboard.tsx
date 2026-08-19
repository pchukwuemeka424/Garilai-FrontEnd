"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import { AdminPanel, AdminShell, AdminStatCard, formatAdminDate, formatAdminRelative } from "@/components/admin/AdminShell";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { createAdminAlert, fetchAdminAlerts, updateAdminAlert } from "@/lib/admin-api";
import type { AlertStats, GovernanceAlertRecord } from "@/lib/admin-governance";

const ALERT_KINDS = [
	"sensitive_data",
	"policy_violation",
	"excessive_token_usage",
	"unusual_login",
	"multiple_failed_logins",
	"suspicious_ai_prompt",
	"restricted_content",
	"excessive_document_generation",
	"abnormal_user_activity",
	"data_retention_warning",
	"policy_breach",
	"high_risk_activity",
	"unusual_usage",
	"privacy",
	"security",
	"other",
] as const;

const STATUSES = ["open", "acknowledged", "investigating", "escalated", "resolved", "closed"] as const;
const SEVERITIES = ["low", "medium", "high", "critical"] as const;

const emptyForm = {
	title: "",
	summary: "",
	kind: "policy_violation",
	severity: "high",
	faculty: "",
	actorName: "",
	assigneeName: "",
};

function isOpenLike(status: string): boolean {
	return ["open", "acknowledged", "investigating", "escalated"].includes(status);
}

function exportAlertsCsv(alerts: GovernanceAlertRecord[]) {
	const headers = ["ID", "Title", "Category", "Severity", "Status", "User", "Faculty", "Assignee", "Created", "Acknowledged", "Resolved"];
	const rows = alerts.map((a) => [
		a.id, a.title, a.kind, a.severity, a.status,
		a.actorName ?? a.actorEmail ?? "", a.faculty ?? "", a.assigneeName ?? "",
		a.createdAt, a.acknowledgedAt ?? "", a.resolvedAt ?? "",
	]);
	const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `garil-alerts-${new Date().toISOString().slice(0, 10)}.csv`;
	link.click();
	URL.revokeObjectURL(url);
}

export function AdminAlertsDashboard() {
	const { ready } = useAdminGuard();
	const [alerts, setAlerts] = useState<GovernanceAlertRecord[]>([]);
	const [stats, setStats] = useState<AlertStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [working, setWorking] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [kindFilter, setKindFilter] = useState("");
	const [severityFilter, setSeverityFilter] = useState("");
	const [facultyFilter, setFacultyFilter] = useState("");
	const [showCreate, setShowCreate] = useState(false);
	const [form, setForm] = useState(emptyForm);
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			const data = await fetchAdminAlerts({
				status: statusFilter || undefined,
				severity: severityFilter || undefined,
				kind: kindFilter || undefined,
			});
			setAlerts(data.alerts);
			setStats(data.stats);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [statusFilter, severityFilter, kindFilter]);

	useEffect(() => {
		if (ready) void load();
	}, [load, ready]);

	const faculties = useMemo(
		() => [...new Set(alerts.map((a) => a.faculty).filter(Boolean) as string[])].sort(),
		[alerts],
	);

	const filtered = useMemo(() => {
		const q = search.toLowerCase();
		return alerts.filter((a) => {
			if (facultyFilter && (a.faculty ?? "") !== facultyFilter) return false;
			if (q && !a.title.toLowerCase().includes(q) && !a.summary.toLowerCase().includes(q) && !(a.actorName ?? "").toLowerCase().includes(q) && !(a.actorEmail ?? "").toLowerCase().includes(q)) return false;
			return true;
		});
	}, [alerts, facultyFilter, search]);

	const escalationMetrics = useMemo(() => {
		const escalated = alerts.filter((a) => a.status === "escalated").length;
		const unacknowledged = alerts.filter((a) => a.status === "open").length;
		const avgResponseTime = "—";
		return { escalated, unacknowledged, avgResponseTime };
	}, [alerts]);

	const kindDistribution = useMemo(() => {
		const counts: Record<string, number> = {};
		for (const a of alerts) counts[a.kind] = (counts[a.kind] ?? 0) + 1;
		return Object.entries(counts).sort(([, a], [, b]) => b - a);
	}, [alerts]);

	const onCreate = async () => {
		if (!form.title.trim() || !form.summary.trim()) {
			setError("Title and description are required.");
			return;
		}
		setWorking(true);
		setError(null);
		try {
			await createAdminAlert({
				title: form.title,
				summary: form.summary,
				kind: form.kind,
				severity: form.severity,
				faculty: form.faculty || undefined,
				actorName: form.actorName || undefined,
				assigneeName: form.assigneeName || undefined,
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

	const advance = async (id: string, status: string, extra?: Record<string, string>) => {
		setWorking(true);
		setError(null);
		try {
			await updateAdminAlert(id, { status, ...extra });
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onAssign = async (alert: GovernanceAlertRecord) => {
		const name = window.prompt("Assign administrator:", alert.assigneeName ?? "")?.trim();
		if (!name) return;
		await advance(alert.id, alert.status, { assigneeName: name });
	};

	const onResolve = async (id: string) => {
		const notes = window.prompt("Resolution notes:")?.trim() ?? "";
		await advance(id, "resolved", { responseNotes: notes });
	};

	const onConvertToIncident = async (alert: GovernanceAlertRecord) => {
		window.open(`/admin/incidents?from_alert=${alert.id}&title=${encodeURIComponent(alert.title)}`, "_self");
	};

	return (
		<AdminShell
			title="Governance Alerts"
			subtitle="High-risk activity such as sensitive-data exposure or policy breaches, with context to investigate"
			breadcrumb="Admin · Accountability"
			actions={
				<div className="admin-actions-row">
					<button type="button" className="ghost-btn" onClick={() => setShowCreate(!showCreate)}>
						{showCreate ? "Cancel" : "Create Alert"}
					</button>
					<button type="button" className="ghost-btn" onClick={() => exportAlertsCsv(filtered)}>
						Export CSV
					</button>
					<button type="button" className="ghost-btn" onClick={() => void load()}>
						Refresh
					</button>
				</div>
			}
		>
			{error && <div className="banner banner-error">{error}</div>}

			{stats && (
				<section className="admin-stats">
					<AdminStatCard label="Active" value={stats.active} accent={stats.active > 0 ? "danger" : "success"} />
					<AdminStatCard label="Open" value={stats.open} accent="warning" />
					<AdminStatCard label="Acknowledged" value={stats.acknowledged} />
					<AdminStatCard label="Investigating" value={stats.investigating} accent="primary" />
					<AdminStatCard label="Escalated" value={escalationMetrics.escalated} accent="danger" />
					<AdminStatCard label="Critical" value={stats.critical} accent="danger" />
					<AdminStatCard label="High" value={stats.high} accent="warning" />
					<AdminStatCard label="Last 24h" value={stats.last24h} accent="primary" />
				</section>
			)}

			{showCreate && (
				<AdminPanel title="Create Alert" description="Manually trigger a governance alert for investigation">
					<div className="admin-form-grid">
						<label>
							Title *
							<input className="topic-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
						</label>
						<label>
							Category
							<select className="topic-input" value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}>
								{ALERT_KINDS.map((k) => <option key={k} value={k}>{k.replace(/_/g, " ")}</option>)}
							</select>
						</label>
						<label className="admin-form-span">
							Description *
							<textarea className="topic-input" rows={2} value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} />
						</label>
						<label>
							Severity
							<select className="topic-input" value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}>
								{SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
							</select>
						</label>
						<label>
							Faculty
							<input className="topic-input" value={form.faculty} onChange={(e) => setForm((f) => ({ ...f, faculty: e.target.value }))} />
						</label>
						<label>
							Affected User
							<input className="topic-input" value={form.actorName} onChange={(e) => setForm((f) => ({ ...f, actorName: e.target.value }))} placeholder="User name" />
						</label>
						<label>
							Assign To
							<input className="topic-input" value={form.assigneeName} onChange={(e) => setForm((f) => ({ ...f, assigneeName: e.target.value }))} placeholder="Administrator name" />
						</label>
					</div>
					<button type="button" className="primary-btn" disabled={working} onClick={() => void onCreate()}>Create Alert</button>
				</AdminPanel>
			)}

			<div className="admin-gov-grid">
				<AdminPanel title="Filters">
					<div className="admin-form-grid">
						<label>
							Search
							<input className="topic-input" placeholder="Title, user, description…" value={search} onChange={(e) => setSearch(e.target.value)} />
						</label>
						<label>
							Status
							<select className="topic-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
								<option value="">All</option>
								{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
							</select>
						</label>
						<label>
							Category
							<select className="topic-input" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
								<option value="">All</option>
								{ALERT_KINDS.map((k) => <option key={k} value={k}>{k.replace(/_/g, " ")}</option>)}
							</select>
						</label>
						<label>
							Severity
							<select className="topic-input" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
								<option value="">All</option>
								{SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
							</select>
						</label>
						<label>
							Faculty
							<select className="topic-input" value={facultyFilter} onChange={(e) => setFacultyFilter(e.target.value)}>
								<option value="">All</option>
								{faculties.map((f) => <option key={f} value={f}>{f}</option>)}
							</select>
						</label>
					</div>
				</AdminPanel>

				<AdminPanel title="Alert Distribution" description="By category">
					<div className="admin-bar-list">
						{kindDistribution.slice(0, 6).map(([kind, count]) => (
							<div key={kind} className="admin-bar-item">
								<span className="admin-bar-label">{kind.replace(/_/g, " ")}</span>
								<div className="admin-bar-track">
									<div className="admin-bar-fill" style={{ width: `${(count / Math.max(1, alerts.length)) * 100}%` }} />
								</div>
								<span className="admin-bar-value">{count}</span>
							</div>
						))}
					</div>
				</AdminPanel>
			</div>

			<AdminPanel title="Alert Queue" description={`${filtered.length} alerts · Acknowledge → Investigate → Escalate → Resolve → Close`}>
				{loading ? (
					<p className="muted">Loading alerts…</p>
				) : (
					<div className="admin-table-scroll">
						<table className="admin-simple-table">
							<thead>
								<tr>
									<th>ID</th>
									<th>Severity</th>
									<th>Category</th>
									<th>Title</th>
									<th>User</th>
									<th>Faculty</th>
									<th>Status</th>
									<th>Assigned</th>
									<th>Time</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{filtered.length === 0 ? (
									<tr><td colSpan={10} className="muted">No alerts match filters.</td></tr>
								) : (
									filtered.map((alert) => (
										<Fragment key={alert.id}>
											<tr className={alert.severity === "critical" ? "admin-row-flagged" : undefined}>
												<td><code className="admin-hash" title={alert.id}>{alert.id.slice(0, 8)}…</code></td>
												<td><span className={`admin-sev admin-sev-${alert.severity}`}>{alert.severity}</span></td>
												<td>{alert.kind.replace(/_/g, " ")}</td>
												<td>
													<button type="button" className="admin-link-btn" onClick={() => setExpandedId((id) => id === alert.id ? null : alert.id)}>
														{alert.title}
													</button>
												</td>
												<td>{alert.actorName || alert.actorEmail || "—"}</td>
												<td>{alert.faculty ?? "—"}</td>
												<td><span className={`admin-chip admin-chip-status-${alert.status}`}>{alert.status}</span></td>
												<td>{alert.assigneeName || "—"}</td>
												<td title={formatAdminDate(alert.createdAt)}>{formatAdminRelative(alert.createdAt)}</td>
												<td>
													<div className="admin-row-actions">
														{alert.status === "open" && (
															<button type="button" className="ghost-btn" disabled={working} onClick={() => void advance(alert.id, "acknowledged")}>Ack</button>
														)}
														{isOpenLike(alert.status) && alert.status !== "investigating" && (
															<button type="button" className="ghost-btn" disabled={working} onClick={() => void advance(alert.id, "investigating")}>Investigate</button>
														)}
														{isOpenLike(alert.status) && alert.status !== "escalated" && (
															<button type="button" className="ghost-btn" disabled={working} onClick={() => void advance(alert.id, "escalated")}>Escalate</button>
														)}
														<button type="button" className="ghost-btn" disabled={working} onClick={() => void onAssign(alert)}>Assign</button>
														{isOpenLike(alert.status) && (
															<>
																<button type="button" className="ghost-btn" disabled={working} onClick={() => void onResolve(alert.id)}>Resolve</button>
																<button type="button" className="ghost-btn" disabled={working} onClick={() => void onConvertToIncident(alert)}>→ Incident</button>
															</>
														)}
													</div>
												</td>
											</tr>
											{expandedId === alert.id && (
												<tr key={`${alert.id}-detail`}>
													<td colSpan={10} className="admin-audit-detail">
														<div className="admin-detail-grid">
															<div><strong>Summary:</strong> {alert.summary}</div>
															<div><strong>Actor:</strong> {alert.actorName ?? "—"} ({alert.actorEmail ?? "—"}) — {alert.actorRole ?? "—"}</div>
															<div><strong>Acknowledged:</strong> {alert.acknowledgedAt ? formatAdminDate(alert.acknowledgedAt) : "Not yet"}</div>
															<div><strong>Resolved:</strong> {alert.resolvedAt ? formatAdminDate(alert.resolvedAt) : "Not yet"}</div>
															<div><strong>Response Notes:</strong> {alert.responseNotes || "—"}</div>
															<div><strong>Notification Sent:</strong> {alert.notificationSent ? "Yes" : "No"}</div>
															{alert.linkedAuditId && <div><strong>Linked Audit:</strong> <code>{alert.linkedAuditId}</code></div>}
															{alert.linkedIncidentId && <div><strong>Linked Incident:</strong> <code>{alert.linkedIncidentId}</code></div>}
														</div>
													</td>
												</tr>
											)}
										</Fragment>
									))
								)}
							</tbody>
						</table>
					</div>
				)}
			</AdminPanel>
		</AdminShell>
	);
}
