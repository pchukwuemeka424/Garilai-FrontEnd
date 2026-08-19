"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AdminPanel, AdminShell, AdminStatCard, formatAdminDate, formatAdminRelative } from "@/components/admin/AdminShell";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { fetchGovernanceDashboard } from "@/lib/admin-api";
import type { GovernanceAlertRecord, GovernanceDashboard, GovernanceIncidentRecord, AuditLogRecord } from "@/lib/admin-governance";

function SeverityBadge({ severity }: { severity: string }) {
	return <span className={`admin-sev admin-sev-${severity}`}>{severity}</span>;
}

function StatusChip({ status }: { status: string }) {
	return <span className={`admin-chip admin-chip-status-${status}`}>{status}</span>;
}

function HealthIndicator({ status, label }: { status: string; label: string }) {
	const color = status === "operational" || status === "healthy" ? "success" : status === "degraded" ? "warning" : "danger";
	return (
		<div className="admin-health-indicator">
			<span className={`admin-health-dot admin-health-dot-${color}`} aria-hidden />
			<span className="admin-health-label">{label}</span>
			<span className={`admin-health-status admin-health-status-${color}`}>{status}</span>
		</div>
	);
}

export function AdminGovernanceDashboard() {
	const { ready } = useAdminGuard();
	const [dashboard, setDashboard] = useState<GovernanceDashboard | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			const data = await fetchGovernanceDashboard();
			setDashboard(data);
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
		if (!ready) return;
		const interval = setInterval(() => void load(), 60_000);
		return () => clearInterval(interval);
	}, [load, ready]);

	if (loading) {
		return (
			<AdminShell title="Governance Dashboard" subtitle="Loading governance overview…" breadcrumb="Admin · Overview">
				<p className="muted">Loading governance data…</p>
			</AdminShell>
		);
	}

	if (!dashboard) {
		return (
			<AdminShell title="Governance Dashboard" subtitle="Real-time overview of AI use" breadcrumb="Admin · Overview">
				{error && <div className="banner banner-error">{error}</div>}
				<p className="muted">Unable to load governance dashboard.</p>
			</AdminShell>
		);
	}

	const health =
		dashboard.alerts.critical > 0 || dashboard.incidents.critical > 0 ? "degraded" : "operational";

	return (
		<AdminShell
			title="Governance Dashboard"
			subtitle="Real-time overview of AI use, alerts, adoption, and platform health"
			breadcrumb="Admin · Overview"
			actions={
				<button type="button" className="ghost-btn" onClick={() => void load()}>
					Refresh
				</button>
			}
		>
			{error && <div className="banner banner-error">{error}</div>}

			<section className="admin-stats">
				<AdminStatCard label="Active users" value={dashboard.platform.activeUsers} accent="success" hint="Last 7 days" />
				<AdminStatCard label="Open alerts" value={dashboard.alerts.active} accent={dashboard.alerts.active > 0 ? "danger" : "success"} hint={`${dashboard.alerts.critical} critical`} />
				<AdminStatCard label="Open incidents" value={dashboard.incidents.active} accent={dashboard.incidents.active > 0 ? "warning" : "success"} hint={`${dashboard.incidents.critical} critical`} />
				<AdminStatCard label="AI sessions" value={dashboard.aiUsage.totals.sessions} accent="primary" />
				<AdminStatCard label="Tokens used" value={dashboard.tokens.totalTokensUsed.toLocaleString()} hint={`Est. ${dashboard.tokens.estimatedCost}`} />
				<AdminStatCard label="Policies" value={dashboard.policies.total} hint={`${dashboard.policies.blocked} blocked`} />
			</section>

			<div className="admin-gov-grid admin-gov-grid-3">
				<AdminPanel title="Platform health">
					<div className="admin-health-list">
						<HealthIndicator status={health} label="Governance posture" />
						<HealthIndicator status="operational" label="API services" />
						<HealthIndicator status="operational" label="AI gateway" />
						<HealthIndicator status="operational" label="Database" />
					</div>
				</AdminPanel>
				<AdminPanel title="Adoption snapshot">
					<div className="admin-usage-summary">
						<div className="admin-usage-item">
							<span className="admin-usage-value">{dashboard.aiUsage.totals.activeUsers.toLocaleString()}</span>
							<span className="admin-usage-label">Active accounts</span>
						</div>
						<div className="admin-usage-item">
							<span className="admin-usage-value">{dashboard.aiUsage.totals.papers.toLocaleString()}</span>
							<span className="admin-usage-label">Research outputs</span>
						</div>
						<div className="admin-usage-item">
							<span className="admin-usage-value">{dashboard.contributions.verified}</span>
							<span className="admin-usage-label">Verified AI statements</span>
						</div>
					</div>
				</AdminPanel>
				<AdminPanel title="Token health" description="Institutional consumption">
					<p>
						<strong>{dashboard.tokens.totalTokensUsed.toLocaleString()}</strong> tokens used ·{" "}
						{dashboard.tokens.lecturersWithQuota} lecturers · {dashboard.tokens.studentsWithQuota} students
					</p>
					<Link className="ghost-btn" href="/admin/tokens">
						Open token tracking
					</Link>
				</AdminPanel>
			</div>

			<div className="admin-gov-grid">
				<AdminPanel title="Active alerts" description={`${dashboard.alerts.active} requiring attention`}>
					{dashboard.activeAlerts.length === 0 ? (
						<p className="muted">No active alerts.</p>
					) : (
						<div className="admin-table-scroll">
							<table className="admin-simple-table">
								<thead>
									<tr>
										<th>Severity</th>
										<th>Kind</th>
										<th>Title</th>
										<th>User</th>
										<th>Status</th>
										<th>When</th>
									</tr>
								</thead>
								<tbody>
									{dashboard.activeAlerts.slice(0, 6).map((alert: GovernanceAlertRecord) => (
										<tr key={alert.id}>
											<td><SeverityBadge severity={alert.severity} /></td>
											<td>{alert.kind.replace(/_/g, " ")}</td>
											<td><strong>{alert.title}</strong></td>
											<td>{alert.actorName || "—"}</td>
											<td><StatusChip status={alert.status} /></td>
											<td>{formatAdminRelative(alert.createdAt)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</AdminPanel>

				<AdminPanel title="Active incidents" description={`${dashboard.incidents.active} in progress`}>
					{dashboard.activeIncidents.length === 0 ? (
						<p className="muted">No active incidents.</p>
					) : (
						<div className="admin-table-scroll">
							<table className="admin-simple-table">
								<thead>
									<tr>
										<th>Severity</th>
										<th>Title</th>
										<th>Status</th>
										<th>Assignee</th>
										<th>When</th>
									</tr>
								</thead>
								<tbody>
									{dashboard.activeIncidents.slice(0, 6).map((inc: GovernanceIncidentRecord) => (
										<tr key={inc.id}>
											<td><SeverityBadge severity={inc.severity} /></td>
											<td><strong>{inc.title}</strong></td>
											<td><StatusChip status={inc.status} /></td>
											<td>{inc.assigneeName || "—"}</td>
											<td>{formatAdminRelative(inc.detectedAt)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</AdminPanel>
			</div>

			<div className="admin-gov-grid">
				<AdminPanel title="Adoption by faculty">
					{dashboard.aiUsage.byFaculty.length === 0 ? (
						<p className="muted">No faculty usage yet.</p>
					) : (
						<div className="admin-bar-list">
							{dashboard.aiUsage.byFaculty.slice(0, 8).map((f) => (
								<div key={f.key} className="admin-bar-item">
									<span className="admin-bar-label">{f.label}</span>
									<div className="admin-bar-track">
										<div className="admin-bar-fill" style={{ width: `${Math.min(100, f.intensity)}%` }} />
									</div>
									<span className="admin-bar-value">{f.activeUsers} active</span>
								</div>
							))}
						</div>
					)}
				</AdminPanel>

				<AdminPanel title="Recent flagged audit events">
					{dashboard.recentFlags.length === 0 ? (
						<p className="muted">No flagged events.</p>
					) : (
						<div className="admin-table-scroll">
							<table className="admin-simple-table">
								<thead>
									<tr>
										<th>Severity</th>
										<th>Summary</th>
										<th>Actor</th>
										<th>When</th>
									</tr>
								</thead>
								<tbody>
									{dashboard.recentFlags.slice(0, 6).map((log: AuditLogRecord) => (
										<tr key={log.id}>
											<td><SeverityBadge severity={log.severity} /></td>
											<td>{log.summary}</td>
											<td>{log.actorName || log.actorEmail || "—"}</td>
											<td>{formatAdminRelative(log.createdAt)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</AdminPanel>
			</div>

			<AdminPanel title="Recent governance reports">
				{dashboard.recentReports.length === 0 ? (
					<p className="muted">No reports generated yet.</p>
				) : (
					<div className="admin-table-scroll">
						<table className="admin-simple-table">
							<thead>
								<tr>
									<th>Title</th>
									<th>Audience</th>
									<th>Status</th>
									<th>Generated</th>
								</tr>
							</thead>
							<tbody>
								{dashboard.recentReports.slice(0, 5).map((report) => (
									<tr key={report.id}>
										<td><strong>{report.title}</strong></td>
										<td>{report.audience.replace(/_/g, " ")}</td>
										<td><StatusChip status={report.status} /></td>
										<td>{formatAdminDate(report.createdAt)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</AdminPanel>
		</AdminShell>
	);
}
