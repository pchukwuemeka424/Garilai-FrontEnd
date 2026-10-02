"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AdminPanel, AdminShell, AdminStatCard, formatAdminDate, formatAdminRelative } from "@/components/admin/AdminShell";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { fetchGovernanceDashboard } from "@/lib/admin-api";
import type {
	AuditLogRecord,
	GovernanceAlertRecord,
	GovernanceDashboard,
	GovernanceIncidentRecord,
	RoleAiPosture,
} from "@/lib/admin-governance";

function SeverityBadge({ severity }: { severity: string }) {
	return <span className={`admin-sev admin-sev-${severity}`}>{severity}</span>;
}

function StatusChip({ status }: { status: string }) {
	return <span className={`admin-chip admin-chip-status-${status}`}>{status}</span>;
}

function HealthIndicator({ status, label }: { status: string; label: string }) {
	const color =
		status === "operational" || status === "healthy"
			? "success"
			: status === "degraded" || status === "attention"
				? "warning"
				: status === "not monitored"
					? "warning"
					: "danger";
	return (
		<div className="admin-health-indicator">
			<span className={`admin-health-dot admin-health-dot-${color}`} aria-hidden />
			<span className="admin-health-label">{label}</span>
			<span className={`admin-health-status admin-health-status-${color}`}>{status}</span>
		</div>
	);
}

function PosturePanel({
	posture,
	analyticsHref,
}: {
	posture: RoleAiPosture;
	analyticsHref: string;
}) {
	return (
		<AdminPanel title={posture.label} description="AI use & integrity (no private content)">
			<div className="admin-usage-summary">
				<div className="admin-usage-item">
					<span className="admin-usage-value">{posture.activeUsers.toLocaleString()}</span>
					<span className="admin-usage-label">Active accounts</span>
				</div>
				<div className="admin-usage-item">
					<span className="admin-usage-value">{posture.tokensUsed.toLocaleString()}</span>
					<span className="admin-usage-label">Tokens used</span>
				</div>
				<div className="admin-usage-item">
					<span className="admin-usage-value">{posture.sessions.toLocaleString()}</span>
					<span className="admin-usage-label">AI sessions</span>
				</div>
				<div className="admin-usage-item">
					<span className="admin-usage-value">{posture.contributions.toLocaleString()}</span>
					<span className="admin-usage-label">AI statements</span>
				</div>
				<div className="admin-usage-item">
					<span className="admin-usage-value">{posture.provenance.toLocaleString()}</span>
					<span className="admin-usage-label">Provenance</span>
				</div>
				<div className="admin-usage-item">
					<span className="admin-usage-value">{posture.openAlerts.toLocaleString()}</span>
					<span className="admin-usage-label">Open AI alerts</span>
				</div>
			</div>
			<div className="admin-panel-actions" style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
				<Link className="ghost-btn" href={analyticsHref}>
					Usage analytics
				</Link>
				<Link className="ghost-btn" href="/admin/contributions">
					AI statements
				</Link>
				<Link className="ghost-btn" href="/admin/alerts">
					Alerts
				</Link>
			</div>
		</AdminPanel>
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
			<AdminShell title="AI Governance Hub" subtitle="Loading AI governance overview…" breadcrumb="Admin · AI Governance">
				<p className="muted">Loading AI governance data…</p>
			</AdminShell>
		);
	}

	if (!dashboard) {
		return (
			<AdminShell title="AI Governance Hub" subtitle="Institutional AI use, risk, and integrity" breadcrumb="Admin · AI Governance">
				{error && <div className="banner banner-error">{error}</div>}
				<p className="muted">Unable to load AI governance dashboard.</p>
			</AdminShell>
		);
	}

	const governanceHealth =
		dashboard.alerts.critical > 0 || dashboard.incidents.critical > 0
			? "degraded"
			: dashboard.alerts.active > 0
				? "attention"
				: "operational";

	const studentPosture: RoleAiPosture = dashboard.studentPosture ?? {
		role: "student",
		label: "Student AI posture",
		activeUsers: 0,
		tokensUsed: 0,
		sessions: 0,
		ideaSessions: 0,
		papers: 0,
		projects: 0,
		contributions: dashboard.contributions.byOwnerRole?.student ?? 0,
		provenance: dashboard.provenance.byOwnerRole?.student ?? 0,
		openAlerts: dashboard.alerts.byActorRole?.student ?? 0,
	};
	const lecturerPosture: RoleAiPosture = dashboard.lecturerPosture ?? {
		role: "lecturer",
		label: "Lecturer AI posture",
		activeUsers: 0,
		tokensUsed: 0,
		sessions: 0,
		ideaSessions: 0,
		papers: 0,
		projects: 0,
		contributions: dashboard.contributions.byOwnerRole?.lecturer ?? 0,
		provenance: dashboard.provenance.byOwnerRole?.lecturer ?? 0,
		openAlerts: dashboard.alerts.byActorRole?.lecturer ?? 0,
	};

	return (
		<AdminShell
			title="AI Governance Hub"
			subtitle="Oversee AI use across student and lecturer products — risk, integrity, and controls"
			breadcrumb="Admin · AI Governance"
			actions={
				<button type="button" className="ghost-btn" onClick={() => void load()}>
					Refresh
				</button>
			}
		>
			{error && <div className="banner banner-error">{error}</div>}

			<section className="admin-stats">
				<AdminStatCard label="Active users" value={dashboard.platform.activeUsers} accent="success" hint="Last 7 days" />
				<AdminStatCard
					label="Open AI alerts"
					value={dashboard.alerts.active}
					accent={dashboard.alerts.active > 0 ? "danger" : "success"}
					hint={`${dashboard.alerts.critical} critical`}
				/>
				<AdminStatCard
					label="Open incidents"
					value={dashboard.incidents.active}
					accent={dashboard.incidents.active > 0 ? "warning" : "success"}
					hint={`${dashboard.incidents.critical} critical`}
				/>
				<AdminStatCard label="AI sessions" value={dashboard.aiUsage.totals.sessions} accent="primary" />
				<AdminStatCard
					label="Tokens used"
					value={dashboard.tokens.totalTokensUsed.toLocaleString()}
					hint={`Est. ${dashboard.tokens.estimatedCost}`}
				/>
				<AdminStatCard label="AI policies" value={dashboard.policies.total} hint={`${dashboard.policies.blocked} blocked`} />
			</section>

			<div className="admin-gov-grid">
				<PosturePanel posture={studentPosture} analyticsHref="/admin/analytics" />
				<PosturePanel posture={lecturerPosture} analyticsHref="/admin/analytics" />
			</div>

			<div className="admin-gov-grid admin-gov-grid-3">
				<AdminPanel title="Governance posture" description="Derived from open alerts and incidents">
					<div className="admin-health-list">
						<HealthIndicator status={governanceHealth} label="AI governance posture" />
						<HealthIndicator status="not monitored" label="API services" />
						<HealthIndicator status="not monitored" label="AI gateway" />
						<HealthIndicator status="not monitored" label="Database" />
					</div>
				</AdminPanel>
				<AdminPanel title="AI integrity" description="Contribution & provenance coverage">
					<div className="admin-usage-summary">
						<div className="admin-usage-item">
							<span className="admin-usage-value">{dashboard.contributions.verified}</span>
							<span className="admin-usage-label">Verified statements</span>
						</div>
						<div className="admin-usage-item">
							<span className="admin-usage-value">{dashboard.contributions.pendingVerification}</span>
							<span className="admin-usage-label">Pending verify</span>
						</div>
						<div className="admin-usage-item">
							<span className="admin-usage-value">{dashboard.provenance.total}</span>
							<span className="admin-usage-label">Provenance records</span>
						</div>
					</div>
					<div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
						<Link className="ghost-btn" href="/admin/contributions">
							Contributions
						</Link>
						<Link className="ghost-btn" href="/admin/provenance">
							Provenance
						</Link>
					</div>
				</AdminPanel>
				<AdminPanel title="Token health" description="Institutional AI consumption">
					<p>
						<strong>{dashboard.tokens.totalTokensUsed.toLocaleString()}</strong> tokens used ·{" "}
						{dashboard.tokens.lecturersWithQuota} lecturers · {dashboard.tokens.studentsWithQuota} students
					</p>
					<Link className="ghost-btn" href="/admin/tokens">
						Open token tracking
					</Link>
				</AdminPanel>
			</div>

			{dashboard.aiUsage.byFeature.length > 0 && (
				<AdminPanel title="AI surfaces" description="Usage across research, notebook, and portal AI">
					<div className="admin-bar-list">
						{dashboard.aiUsage.byFeature.map((f) => (
							<div key={f.feature} className="admin-bar-item">
								<span className="admin-bar-label">{f.label}</span>
								<div className="admin-bar-track">
									<div
										className="admin-bar-fill"
										style={{
											width: `${Math.min(100, Math.max(4, f.count > 0 ? 12 + Math.log10(f.count + 1) * 28 : 4))}%`,
										}}
									/>
								</div>
								<span className="admin-bar-value">{f.count.toLocaleString()}</span>
							</div>
						))}
					</div>
					<Link className="ghost-btn" href="/admin/analytics" style={{ marginTop: "0.75rem" }}>
						Open usage analytics
					</Link>
				</AdminPanel>
			)}

			<div className="admin-gov-grid">
				<AdminPanel title="Active AI alerts" description={`${dashboard.alerts.active} requiring attention`}>
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
											<td>
												<SeverityBadge severity={alert.severity} />
											</td>
											<td>{alert.kind.replace(/_/g, " ")}</td>
											<td>
												<Link href={`/admin/alerts?id=${alert.id}`}>
													<strong>{alert.title}</strong>
												</Link>
											</td>
											<td>{alert.actorName || "—"}</td>
											<td>
												<StatusChip status={alert.status} />
											</td>
											<td>{formatAdminRelative(alert.createdAt)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
					<Link className="ghost-btn" href="/admin/alerts" style={{ marginTop: "0.5rem" }}>
						All alerts
					</Link>
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
											<td>
												<SeverityBadge severity={inc.severity} />
											</td>
											<td>
												<Link href={`/admin/incidents?id=${inc.id}`}>
													<strong>{inc.title}</strong>
												</Link>
											</td>
											<td>
												<StatusChip status={inc.status} />
											</td>
											<td>{inc.assigneeName || "—"}</td>
											<td>{formatAdminRelative(inc.detectedAt)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
					<Link className="ghost-btn" href="/admin/incidents" style={{ marginTop: "0.5rem" }}>
						All incidents
					</Link>
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
											<td>
												<SeverityBadge severity={log.severity} />
											</td>
											<td>
												<Link href={`/admin/audit?id=${log.id}`}>{log.summary}</Link>
											</td>
											<td>{log.actorName || log.actorEmail || "—"}</td>
											<td>{formatAdminRelative(log.createdAt)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
					<Link className="ghost-btn" href="/admin/audit" style={{ marginTop: "0.5rem" }}>
						Audit log
					</Link>
				</AdminPanel>
			</div>

			<AdminPanel title="Recent AI governance reports">
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
										<td>
											<Link href={`/admin/reports?id=${report.id}`}>
												<strong>{report.title}</strong>
											</Link>
										</td>
										<td>{report.audience.replace(/_/g, " ")}</td>
										<td>
											<StatusChip status={report.status} />
										</td>
										<td>{formatAdminDate(report.createdAt)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
				<Link className="ghost-btn" href="/admin/reports" style={{ marginTop: "0.5rem" }}>
					All reports
				</Link>
			</AdminPanel>
		</AdminShell>
	);
}
