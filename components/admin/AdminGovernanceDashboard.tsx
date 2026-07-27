"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminPanel, AdminShell, AdminStatCard, formatAdminDate, formatAdminRelative } from "@/components/admin/AdminShell";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { fetchGovernanceDashboard } from "@/lib/admin-api";
import type { GovernanceAlertRecord, GovernanceDashboard, GovernanceIncidentRecord, GovernanceRiskRecord, AuditLogRecord, ApprovalRequestRecord } from "@/lib/admin-governance";

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

function GovernanceScoreRing({ score, label }: { score: number; label: string }) {
	const pct = Math.min(100, Math.max(0, score));
	const color = pct >= 80 ? "var(--admin-success)" : pct >= 60 ? "var(--admin-warning)" : "var(--admin-danger)";
	return (
		<div className="admin-score-ring">
			<svg viewBox="0 0 36 36" className="admin-score-ring-svg">
				<path
					d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
					fill="none"
					stroke="var(--admin-border)"
					strokeWidth="3"
				/>
				<path
					d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
					fill="none"
					stroke={color}
					strokeWidth="3"
					strokeDasharray={`${pct}, 100`}
					strokeLinecap="round"
				/>
			</svg>
			<div className="admin-score-ring-inner">
				<span className="admin-score-ring-value">{pct}%</span>
				<span className="admin-score-ring-label">{label}</span>
			</div>
		</div>
	);
}

function RiskHeatmapMini({ risks }: { risks: GovernanceRiskRecord[] }) {
	const grid = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0));
	for (const r of risks) {
		const li = Math.min(4, Math.max(0, (r.likelihood ?? 1) - 1));
		const im = Math.min(4, Math.max(0, (r.impact ?? 1) - 1));
		grid[4 - im][li]++;
	}
	return (
		<div className="admin-heatmap-mini">
			{grid.map((row, ri) => (
				<div key={ri} className="admin-heatmap-row">
					{row.map((count, ci) => {
						const intensity = count === 0 ? "" : count <= 2 ? "low" : count <= 5 ? "mid" : "high";
						return (
							<div key={ci} className={`admin-heatmap-cell ${intensity ? `admin-heatmap-${intensity}` : ""}`} title={`${count} risks`}>
								{count > 0 ? count : ""}
							</div>
						);
					})}
				</div>
			))}
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

	const complianceScore = useMemo(() => {
		if (!dashboard?.compliance) return 0;
		return dashboard.compliance.score ?? 0;
	}, [dashboard]);

	const riskPosture = useMemo(() => {
		if (!dashboard?.risks) return "unknown";
		const { highInherent } = dashboard.risks;
		if (highInherent > 5) return "critical";
		if (highInherent > 2) return "elevated";
		return "acceptable";
	}, [dashboard]);

	if (loading) {
		return (
			<AdminShell title="Governance Dashboard" subtitle="Loading governance overview…" breadcrumb="Admin · Governance">
				<p className="muted">Loading governance data…</p>
			</AdminShell>
		);
	}

	if (!dashboard) {
		return (
			<AdminShell title="Governance Dashboard" subtitle="Real-time governance overview" breadcrumb="Admin · Governance">
				{error && <div className="banner banner-error">{error}</div>}
				<p className="muted">Unable to load governance dashboard.</p>
			</AdminShell>
		);
	}

	return (
		<AdminShell
			title="Governance Dashboard"
			subtitle="Real-time institutional AI governance overview"
			breadcrumb="Admin · Governance"
			actions={
				<button type="button" className="ghost-btn" onClick={() => void load()}>
					Refresh
				</button>
			}
		>
			{error && <div className="banner banner-error">{error}</div>}

			<section className="admin-stats">
				<AdminStatCard label="Total Users" value={dashboard.platform.userCount} hint="Registered accounts" />
				<AdminStatCard label="Active Users" value={dashboard.platform.activeUsers} accent="success" hint="Active in last 7d" />
				<AdminStatCard label="Active Sessions" value={dashboard.platform.activeSessions} accent="primary" />
				<AdminStatCard label="Open Alerts" value={dashboard.alerts.active} accent={dashboard.alerts.active > 0 ? "danger" : "success"} hint={`${dashboard.alerts.critical} critical`} />
				<AdminStatCard label="Open Incidents" value={dashboard.incidents.active} accent={dashboard.incidents.active > 0 ? "warning" : "success"} hint={`${dashboard.incidents.critical} critical`} />
				<AdminStatCard label="Policy Violations" value={dashboard.audit.flagged} accent={dashboard.audit.flagged > 0 ? "warning" : "success"} />
				<AdminStatCard label="Pending Approvals" value={dashboard.approvals.pending} accent="primary" />
				<AdminStatCard label="High Risks" value={dashboard.risks.highInherent} accent={dashboard.risks.highInherent > 0 ? "danger" : "success"} />
			</section>

			<div className="admin-gov-grid admin-gov-grid-3">
				<AdminPanel title="Platform Health">
					<div className="admin-health-list">
						<HealthIndicator status="operational" label="API Services" />
						<HealthIndicator status="operational" label="AI Gateway" />
						<HealthIndicator status="operational" label="Database" />
						<HealthIndicator status="operational" label="WebSocket" />
					</div>
				</AdminPanel>

				<AdminPanel title="Compliance Posture">
					<GovernanceScoreRing score={complianceScore} label="Compliance" />
					<div className="admin-compliance-summary">
						<p><strong>{dashboard.compliance.compliant}</strong> compliant / <strong>{dashboard.compliance.total}</strong> total controls</p>
						<p className="muted">{dashboard.compliance.criticalGaps} critical gaps</p>
					</div>
				</AdminPanel>

				<AdminPanel title="Risk Posture">
					<div className={`admin-risk-posture admin-risk-posture-${riskPosture}`}>
						<span className="admin-risk-posture-label">{riskPosture.toUpperCase()}</span>
					</div>
					<RiskHeatmapMini risks={dashboard.topRisks} />
					<p className="muted">{dashboard.risks.open} open · {dashboard.risks.mitigating} mitigating · avg score {dashboard.risks.avgInherent.toFixed(1)}</p>
				</AdminPanel>
			</div>

			<div className="admin-gov-grid">
				<AdminPanel title="Active Alerts" description={`${dashboard.alerts.active} requiring attention`}>
					{dashboard.activeAlerts.length === 0 ? (
						<p className="muted">No active alerts.</p>
					) : (
						<div className="admin-table-scroll">
							<table className="admin-simple-table">
								<thead>
									<tr>
										<th>Severity</th>
										<th>Category</th>
										<th>Title</th>
										<th>User</th>
										<th>Status</th>
										<th>Date</th>
									</tr>
								</thead>
								<tbody>
									{dashboard.activeAlerts.slice(0, 5).map((alert: GovernanceAlertRecord) => (
										<tr key={alert.id}>
											<td><SeverityBadge severity={alert.severity} /></td>
											<td>{alert.kind}</td>
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

				<AdminPanel title="Active Incidents" description={`${dashboard.incidents.active} under investigation`}>
					{dashboard.activeIncidents.length === 0 ? (
						<p className="muted">No active incidents.</p>
					) : (
						<div className="admin-table-scroll">
							<table className="admin-simple-table">
								<thead>
									<tr>
										<th>Severity</th>
										<th>Title</th>
										<th>Category</th>
										<th>Status</th>
										<th>Assignee</th>
										<th>Date</th>
									</tr>
								</thead>
								<tbody>
									{dashboard.activeIncidents.slice(0, 5).map((inc: GovernanceIncidentRecord) => (
										<tr key={inc.id}>
											<td><SeverityBadge severity={inc.severity} /></td>
											<td><strong>{inc.title}</strong></td>
											<td>{inc.kind}</td>
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
				<AdminPanel title="Pending Approvals" description={`${dashboard.approvals.pending} awaiting review`}>
					{dashboard.pendingApprovals.length === 0 ? (
						<p className="muted">No pending approvals.</p>
					) : (
						<div className="admin-table-scroll">
							<table className="admin-simple-table">
								<thead>
									<tr>
										<th>Title</th>
										<th>Kind</th>
										<th>Requester</th>
										<th>Faculty</th>
										<th>Submitted</th>
									</tr>
								</thead>
								<tbody>
									{dashboard.pendingApprovals.slice(0, 5).map((req: ApprovalRequestRecord) => (
										<tr key={req.id}>
											<td><strong>{req.title}</strong></td>
											<td>{req.kind}</td>
											<td>{req.requesterName || "—"}</td>
											<td>{req.faculty || "—"}</td>
											<td>{formatAdminRelative(req.createdAt)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</AdminPanel>

				<AdminPanel title="Recent Flagged Audit Events" description="Flagged for investigation">
					{dashboard.recentFlags.length === 0 ? (
						<p className="muted">No flagged events.</p>
					) : (
						<div className="admin-table-scroll">
							<table className="admin-simple-table">
								<thead>
									<tr>
										<th>Severity</th>
										<th>Category</th>
										<th>Summary</th>
										<th>Actor</th>
										<th>Date</th>
									</tr>
								</thead>
								<tbody>
									{dashboard.recentFlags.slice(0, 5).map((log: AuditLogRecord) => (
										<tr key={log.id}>
											<td><SeverityBadge severity={log.severity} /></td>
											<td>{log.category}</td>
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

			<div className="admin-gov-grid admin-gov-grid-3">
				<AdminPanel title="AI Usage Summary">
					<div className="admin-usage-summary">
						<div className="admin-usage-item">
							<span className="admin-usage-value">{dashboard.aiUsage.totals.sessions.toLocaleString()}</span>
							<span className="admin-usage-label">AI Sessions</span>
						</div>
						<div className="admin-usage-item">
							<span className="admin-usage-value">{dashboard.aiUsage.totals.tokensUsed.toLocaleString()}</span>
							<span className="admin-usage-label">Tokens Used</span>
						</div>
						<div className="admin-usage-item">
							<span className="admin-usage-value">{dashboard.aiUsage.totals.papers.toLocaleString()}</span>
							<span className="admin-usage-label">Papers Generated</span>
						</div>
						<div className="admin-usage-item">
							<span className="admin-usage-value">{dashboard.aiUsage.totals.projects.toLocaleString()}</span>
							<span className="admin-usage-label">Research Projects</span>
						</div>
					</div>
				</AdminPanel>

				<AdminPanel title="Top Faculties by Usage">
					{dashboard.aiUsage.byFaculty.length === 0 ? (
						<p className="muted">No faculty data.</p>
					) : (
						<div className="admin-bar-list">
							{dashboard.aiUsage.byFaculty.slice(0, 5).map((f) => (
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

				<AdminPanel title="Feature Usage">
					{dashboard.aiUsage.byFeature.length === 0 ? (
						<p className="muted">No feature data.</p>
					) : (
						<div className="admin-bar-list">
							{dashboard.aiUsage.byFeature.slice(0, 6).map((f) => (
								<div key={f.feature} className="admin-bar-item">
									<span className="admin-bar-label">{f.label}</span>
									<div className="admin-bar-track">
										<div className="admin-bar-fill" style={{ width: `${Math.min(100, (f.count / Math.max(1, dashboard.aiUsage.byFeature[0]?.count ?? 1)) * 100)}%` }} />
									</div>
									<span className="admin-bar-value">{f.count.toLocaleString()}</span>
								</div>
							))}
						</div>
					)}
				</AdminPanel>
			</div>

			<div className="admin-gov-grid">
				<AdminPanel title="High-Risk AI Systems" description="Systems requiring DPIA or elevated monitoring">
					{dashboard.highRiskSystems.length === 0 ? (
						<p className="muted">No high-risk systems.</p>
					) : (
						<div className="admin-table-scroll">
							<table className="admin-simple-table">
								<thead>
									<tr>
										<th>System</th>
										<th>Vendor</th>
										<th>Risk Tier</th>
										<th>DPIA Status</th>
										<th>Status</th>
									</tr>
								</thead>
								<tbody>
									{dashboard.highRiskSystems.map((sys) => (
										<tr key={sys.id}>
											<td><strong>{sys.name}</strong></td>
											<td>{sys.vendor}</td>
											<td><SeverityBadge severity={sys.riskTier} /></td>
											<td>{sys.dpiaStatus}</td>
											<td><StatusChip status={sys.status} /></td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</AdminPanel>

				<AdminPanel title="Recent Reports">
					{dashboard.recentReports.length === 0 ? (
						<p className="muted">No recent reports.</p>
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
											<td>{report.audience}</td>
											<td><StatusChip status={report.status} /></td>
											<td>{formatAdminDate(report.createdAt)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</AdminPanel>
			</div>

			<AdminPanel title="Governance Metrics Summary">
				<div className="admin-stats admin-stats-compact">
					<AdminStatCard label="Policies" value={dashboard.policies.total} hint={`${dashboard.policies.blocked} blocked`} />
					<AdminStatCard label="Audit Events (24h)" value={dashboard.audit.last24h} />
					<AdminStatCard label="Token Consumption" value={dashboard.aiUsage.totals.tokensUsed.toLocaleString()} />
					<AdminStatCard label="AI Disclosures" value={dashboard.contributions.total} hint={`${dashboard.contributions.pendingVerification} pending`} />
					<AdminStatCard label="Provenance Records" value={dashboard.provenance.total} hint={`${dashboard.provenance.underReview} under review`} />
					<AdminStatCard label="Privacy Rules" value={dashboard.privacy.total} hint={`${dashboard.privacy.enabled} active`} />
					<AdminStatCard label="Retention Policies" value={dashboard.retention.policies} hint={`${dashboard.retention.legalHolds} legal holds`} />
					<AdminStatCard label="Inventory Systems" value={dashboard.inventory.total} hint={`${dashboard.inventory.highRisk} high-risk`} />
				</div>
			</AdminPanel>
		</AdminShell>
	);
}
