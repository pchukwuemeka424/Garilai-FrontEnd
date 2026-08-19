"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import { AdminPanel, AdminShell, AdminStatCard, formatAdminDate, formatAdminRelative } from "@/components/admin/AdminShell";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { createAdminIncident, fetchAdminIncidents, updateAdminIncident } from "@/lib/admin-api";
import type { GovernanceIncidentRecord, IncidentStats } from "@/lib/admin-governance";

const KINDS = [
	"policy_breach",
	"sensitive_data",
	"unauthorized_use",
	"model_failure",
	"third_party",
	"academic_misconduct",
	"data_breach",
	"system_abuse",
	"unauthorized_access",
	"other",
] as const;

const STATUSES = [
	{ value: "", label: "All" },
	{ value: "new", label: "New" },
	{ value: "assigned", label: "Assigned" },
	{ value: "under_investigation", label: "Under Investigation" },
	{ value: "contained", label: "Contained" },
	{ value: "waiting_for_response", label: "Waiting for Response" },
	{ value: "resolved", label: "Resolved" },
	{ value: "closed", label: "Closed" },
] as const;

const STATUS_LABELS: Record<string, string> = {
	new: "New",
	assigned: "Assigned",
	under_investigation: "Under Investigation",
	contained: "Contained",
	waiting_for_response: "Waiting for Response",
	resolved: "Resolved",
	closed: "Closed",
};

const SLA_TARGETS: Record<string, number> = {
	critical: 4,
	high: 24,
	medium: 72,
	low: 168,
};

const emptyForm = {
	title: "",
	description: "",
	kind: "policy_breach",
	severity: "medium",
	faculty: "",
	department: "",
	reportedByName: "",
	userInvolvedName: "",
	assigneeName: "",
	impactSummary: "",
	evidence: "",
};

function slaStatus(incident: GovernanceIncidentRecord): { label: string; overdue: boolean } {
	if (incident.status === "resolved" || incident.status === "closed") return { label: "Complete", overdue: false };
	const target = SLA_TARGETS[incident.severity] ?? 72;
	const hoursOpen = (Date.now() - new Date(incident.detectedAt).getTime()) / 3_600_000;
	if (hoursOpen > target) return { label: `${Math.floor(hoursOpen - target)}h overdue`, overdue: true };
	return { label: `${Math.floor(target - hoursOpen)}h remaining`, overdue: false };
}

function exportIncidentsCsv(incidents: GovernanceIncidentRecord[]) {
	const headers = ["ID", "Title", "Category", "Severity", "Status", "Reported By", "User Involved", "Faculty", "Department", "Assignee", "Detected", "Resolved"];
	const rows = incidents.map((i) => [
		i.id, i.title, i.kind, i.severity, i.status,
		i.reportedByName || i.reportedByEmail, i.userInvolvedName,
		i.faculty ?? "", i.department ?? "", i.assigneeName,
		i.detectedAt, i.resolvedAt ?? "",
	]);
	const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `garil-incidents-${new Date().toISOString().slice(0, 10)}.csv`;
	link.click();
	URL.revokeObjectURL(url);
}

export function AdminIncidentsDashboard() {
	const { ready } = useAdminGuard();
	const [incidents, setIncidents] = useState<GovernanceIncidentRecord[]>([]);
	const [stats, setStats] = useState<IncidentStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [working, setWorking] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [severityFilter, setSeverityFilter] = useState("");
	const [showCreate, setShowCreate] = useState(false);
	const [form, setForm] = useState(emptyForm);
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			const data = await fetchAdminIncidents({ status: statusFilter || undefined, severity: severityFilter || undefined });
			setIncidents(data.incidents);
			setStats(data.stats);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [statusFilter, severityFilter]);

	useEffect(() => {
		if (ready) void load();
	}, [load, ready]);

	const filtered = useMemo(() => {
		const q = search.toLowerCase();
		return incidents.filter((i) => {
			if (q && !i.title.toLowerCase().includes(q) && !i.userInvolvedName.toLowerCase().includes(q) && !i.reportedByName.toLowerCase().includes(q) && !(i.faculty ?? "").toLowerCase().includes(q)) return false;
			return true;
		});
	}, [incidents, search]);

	const slaOverdue = useMemo(() => filtered.filter((i) => slaStatus(i).overdue).length, [filtered]);

	const onCreate = async () => {
		if (!form.title.trim()) { setError("Title is required."); return; }
		setWorking(true);
		setError(null);
		try {
			await createAdminIncident({ ...form, evidence: form.evidence.trim() || undefined });
			setForm(emptyForm);
			setShowCreate(false);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const patch = async (id: string, input: Record<string, unknown>) => {
		setWorking(true);
		setError(null);
		try {
			await updateAdminIncident(id, input);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const addComment = async (item: GovernanceIncidentRecord) => {
		const note = window.prompt("Add investigation comment:")?.trim();
		if (!note) return;
		await patch(item.id, { timelineNote: note });
	};

	const uploadEvidence = async (item: GovernanceIncidentRecord) => {
		const note = window.prompt("Evidence description:")?.trim();
		if (!note) return;
		await patch(item.id, { evidence: [...(item.evidence ?? []), note], timelineNote: `Evidence: ${note}` });
	};

	const assignInvestigator = async (item: GovernanceIncidentRecord) => {
		const name = window.prompt("Lead investigator:", item.assigneeName)?.trim();
		if (!name) return;
		await patch(item.id, { assigneeName: name, status: item.status === "new" ? "assigned" : item.status, timelineNote: `Assigned: ${name}` });
	};

	const updateStatus = async (item: GovernanceIncidentRecord, newStatus: string) => {
		const notes = newStatus === "resolved" || newStatus === "closed" ? (window.prompt("Resolution notes:") ?? "") : "";
		await patch(item.id, { status: newStatus, ...(notes ? { rootCause: notes, timelineNote: `Status → ${newStatus}: ${notes}` } : { timelineNote: `Status → ${newStatus}` }) });
	};

	const addContainment = async (item: GovernanceIncidentRecord) => {
		const action = window.prompt("Containment action taken:", item.containmentActions)?.trim();
		if (!action) return;
		await patch(item.id, { containmentActions: action, timelineNote: `Containment: ${action}` });
	};

	const addRootCause = async (item: GovernanceIncidentRecord) => {
		const cause = window.prompt("Root cause analysis:", item.rootCause)?.trim();
		if (!cause) return;
		await patch(item.id, { rootCause: cause, timelineNote: `Root cause: ${cause}` });
	};

	const addLessons = async (item: GovernanceIncidentRecord) => {
		const lessons = window.prompt("Lessons learned:", item.lessonsLearned)?.trim();
		if (!lessons) return;
		await patch(item.id, { lessonsLearned: lessons });
	};

	return (
		<AdminShell
			title="Incident Management"
			subtitle="Record, investigate, and resolve incidents with a full history of actions and comments"
			breadcrumb="Admin · Accountability"
			actions={
				<div className="admin-actions-row">
					<button type="button" className="ghost-btn" onClick={() => setShowCreate(!showCreate)}>{showCreate ? "Cancel" : "Open Incident"}</button>
					<button type="button" className="ghost-btn" onClick={() => exportIncidentsCsv(filtered)}>Export CSV</button>
					<button type="button" className="ghost-btn" onClick={() => void load()}>Refresh</button>
				</div>
			}
		>
			{error && <div className="banner banner-error">{error}</div>}

			{stats && (
				<section className="admin-stats">
					<AdminStatCard label="Active" value={stats.active} accent="warning" />
					<AdminStatCard label="New" value={stats.new ?? stats.open ?? 0} accent="danger" />
					<AdminStatCard label="Under Investigation" value={stats.investigating} accent="primary" />
					<AdminStatCard label="Critical" value={stats.critical} accent="danger" />
					<AdminStatCard label="High" value={stats.high} accent="warning" />
					<AdminStatCard label="SLA Overdue" value={slaOverdue} accent={slaOverdue > 0 ? "danger" : "success"} />
				</section>
			)}

			{showCreate && (
				<AdminPanel title="Open New Incident" description="Creates a governance incident with audit trail">
					<div className="admin-form-grid">
						<label>Title *<input className="topic-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></label>
						<label>Category<select className="topic-input" value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}>{KINDS.map((k) => <option key={k} value={k}>{k.replace(/_/g, " ")}</option>)}</select></label>
						<label>Severity<select className="topic-input" value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}>{["low", "medium", "high", "critical"].map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
						<label>Faculty<input className="topic-input" value={form.faculty} onChange={(e) => setForm((f) => ({ ...f, faculty: e.target.value }))} /></label>
						<label>Department<input className="topic-input" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} /></label>
						<label>Reported By<input className="topic-input" value={form.reportedByName} onChange={(e) => setForm((f) => ({ ...f, reportedByName: e.target.value }))} /></label>
						<label>User Involved<input className="topic-input" value={form.userInvolvedName} onChange={(e) => setForm((f) => ({ ...f, userInvolvedName: e.target.value }))} /></label>
						<label>Assign Investigator<input className="topic-input" value={form.assigneeName} onChange={(e) => setForm((f) => ({ ...f, assigneeName: e.target.value }))} /></label>
						<label className="admin-form-span">Impact Summary<input className="topic-input" value={form.impactSummary} onChange={(e) => setForm((f) => ({ ...f, impactSummary: e.target.value }))} /></label>
						<label className="admin-form-span">Description<textarea className="topic-input" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></label>
						<label className="admin-form-span">Initial Evidence<textarea className="topic-input" rows={2} value={form.evidence} onChange={(e) => setForm((f) => ({ ...f, evidence: e.target.value }))} placeholder="Links, descriptions, notes" /></label>
					</div>
					<button type="button" className="primary-btn" disabled={working} onClick={() => void onCreate()}>Open Incident</button>
				</AdminPanel>
			)}

			<div className="admin-gov-grid">
				<AdminPanel title="Filters">
					<div className="admin-form-grid">
						<label>Search<input className="topic-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title, user, faculty…" /></label>
						<label>Status<select className="topic-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>{STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
						<label>Severity<select className="topic-input" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}><option value="">All</option>{["low", "medium", "high", "critical"].map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
					</div>
				</AdminPanel>

				<AdminPanel title="SLA Targets" description="Maximum hours to resolution by severity">
					<div className="admin-sla-grid">
						{Object.entries(SLA_TARGETS).map(([sev, hours]) => (
							<div key={sev} className="admin-sla-item">
								<span className={`admin-sev admin-sev-${sev}`}>{sev}</span>
								<span className="admin-sla-hours">{hours}h</span>
							</div>
						))}
					</div>
				</AdminPanel>
			</div>

			<AdminPanel title="Incident cases" description={`${filtered.length} incidents — open a case to see comments, actions, and resolution`}>
				{loading ? <p className="muted">Loading…</p> : (
					<div className="admin-table-scroll">
						<table className="admin-simple-table">
							<thead>
								<tr>
									<th>ID</th>
									<th>Severity</th>
									<th>Category</th>
									<th>Title</th>
									<th>Reported By</th>
									<th>User Involved</th>
									<th>Status</th>
									<th>SLA</th>
									<th>Assignee</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{filtered.length === 0 ? (
									<tr><td colSpan={10} className="muted">No incidents match filters.</td></tr>
								) : (
									filtered.map((item) => {
										const sla = slaStatus(item);
										return (
											<Fragment key={item.id}>
												<tr className={item.severity === "critical" || sla.overdue ? "admin-row-flagged" : undefined}>
													<td><button type="button" className="admin-link-btn" onClick={() => setExpandedId((id) => id === item.id ? null : item.id)}>{item.id.slice(-8)}</button></td>
													<td><span className={`admin-sev admin-sev-${item.severity}`}>{item.severity}</span></td>
													<td>{item.kind.replace(/_/g, " ")}</td>
													<td><strong>{item.title}</strong></td>
													<td>{item.reportedByName || item.reportedByEmail || "—"}</td>
													<td>{item.userInvolvedName || "—"}</td>
													<td><span className="admin-chip">{STATUS_LABELS[item.status] ?? item.status}</span></td>
													<td><span className={sla.overdue ? "admin-sla-overdue" : "muted"}>{sla.label}</span></td>
													<td>{item.assigneeName || "—"}</td>
													<td>
														<div className="admin-row-actions">
															<button type="button" className="ghost-btn" disabled={working} onClick={() => void assignInvestigator(item)}>Assign</button>
															<button type="button" className="ghost-btn" disabled={working} onClick={() => void addComment(item)}>Comment</button>
															{item.status !== "resolved" && item.status !== "closed" && (
																<select className="topic-input admin-action-select" value="" disabled={working} onChange={(e) => { if (e.target.value) void updateStatus(item, e.target.value); e.target.value = ""; }}>
																	<option value="">Status…</option>
																	<option value="assigned">Assigned</option>
																	<option value="under_investigation">Investigate</option>
																	<option value="contained">Contained</option>
																	<option value="resolved">Resolved</option>
																	<option value="closed">Closed</option>
																</select>
															)}
														</div>
													</td>
												</tr>
												{expandedId === item.id && (
													<tr>
														<td colSpan={10} className="admin-audit-detail">
															<div className="admin-detail-grid">
																<div><strong>Description:</strong> {item.description || "—"}</div>
																<div><strong>Impact:</strong> {item.impactSummary || "—"}</div>
																<div><strong>Faculty:</strong> {item.faculty ?? "—"} · <strong>Department:</strong> {item.department ?? "—"}</div>
																<div><strong>Detected:</strong> {formatAdminDate(item.detectedAt)} · <strong>Resolved:</strong> {item.resolvedAt ? formatAdminDate(item.resolvedAt) : "—"}</div>
																<div><strong>Containment:</strong> {item.containmentActions || "—"}</div>
																<div><strong>Root Cause:</strong> {item.rootCause || "—"}</div>
																<div><strong>Lessons Learned:</strong> {item.lessonsLearned || "—"}</div>
																<div><strong>Evidence:</strong> {item.evidence?.length ? item.evidence.join(" · ") : "None"}</div>
															</div>
															{item.timeline?.length > 0 && (
																<div className="admin-timeline">
																	<h4>Investigation Timeline</h4>
																	{item.timeline.map((entry, i) => (
																		<div key={i} className="admin-timeline-entry">
																			<span className="admin-timeline-dot" aria-hidden />
																			<span className="admin-timeline-time">{formatAdminRelative(entry.at)}</span>
																			<span className="admin-timeline-actor">{entry.actorName}</span>
																			<span className="admin-timeline-action">{entry.action}</span>
																			{entry.note && <span className="admin-timeline-note">{entry.note}</span>}
																		</div>
																	))}
																</div>
															)}
															<div className="admin-row-actions" style={{ marginTop: "0.75rem" }}>
																<button type="button" className="ghost-btn" disabled={working} onClick={() => void uploadEvidence(item)}>Add Evidence</button>
																<button type="button" className="ghost-btn" disabled={working} onClick={() => void addContainment(item)}>Containment</button>
																<button type="button" className="ghost-btn" disabled={working} onClick={() => void addRootCause(item)}>Root Cause</button>
																<button type="button" className="ghost-btn" disabled={working} onClick={() => void addLessons(item)}>Lessons</button>
															</div>
														</td>
													</tr>
												)}
											</Fragment>
										);
									})
								)}
							</tbody>
						</table>
					</div>
				)}
			</AdminPanel>
		</AdminShell>
	);
}
