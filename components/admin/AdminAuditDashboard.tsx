"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import { AdminPanel, AdminShell, AdminStatCard, formatAdminDate, formatAdminRelative } from "@/components/admin/AdminShell";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { fetchAdminAuditLogs, flagAdminAuditLog } from "@/lib/admin-api";
import type { AuditAlertStats, AuditLogRecord } from "@/lib/admin-governance";

const CATEGORIES = [
	"auth",
	"admin",
	"ai_use",
	"policy",
	"approval",
	"data",
	"security",
	"system",
	"report",
] as const;

const SEVERITIES = ["low", "medium", "high", "critical"] as const;

function exportAuditCsv(logs: AuditLogRecord[]) {
	const headers = [
		"ID", "Timestamp", "Category", "Severity", "Action", "Summary",
		"Actor Email", "Actor Name", "Actor Role", "Target Type", "Target ID",
		"Faculty", "Department", "IP", "Session ID", "Flagged", "Flag Reason", "Hash",
	];
	const rows = logs.map((l) => [
		l.id, l.createdAt, l.category, l.severity, l.action, l.summary,
		l.actorEmail ?? "", l.actorName ?? "", l.actorRole ?? "",
		l.targetType ?? "", l.targetId ?? "", l.faculty ?? "", l.department ?? "",
		l.ip ?? "", l.sessionId ?? "", l.flagged ? "Yes" : "No",
		l.flagReason ?? "", l.immutableHash ?? "",
	]);
	const csv = [headers, ...rows]
		.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
		.join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `garil-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
	link.click();
	URL.revokeObjectURL(url);
}

function HashChainBadge({ hash, prevHash }: { hash: string | null; prevHash?: string | null }) {
	if (!hash) return <span className="muted">—</span>;
	return (
		<span className="admin-hash-chain" title={`Hash: ${hash}${prevHash ? `\nPrev: ${prevHash}` : ""}`}>
			<span className="admin-hash-chain-icon" aria-hidden>⛓</span>
			<code className="admin-hash">{hash.slice(0, 12)}…</code>
		</span>
	);
}

export function AdminAuditDashboard() {
	const { ready } = useAdminGuard();
	const [logs, setLogs] = useState<AuditLogRecord[]>([]);
	const [stats, setStats] = useState<AuditAlertStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [working, setWorking] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [categoryFilter, setCategoryFilter] = useState("");
	const [severityFilter, setSeverityFilter] = useState("");
	const [flaggedOnly, setFlaggedOnly] = useState(false);
	const [limit, setLimit] = useState(200);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [liveMode, setLiveMode] = useState(false);

	const load = useCallback(async () => {
		setError(null);
		try {
			const data = await fetchAdminAuditLogs({
				limit,
				flagged: flaggedOnly || undefined,
				category: categoryFilter || undefined,
				severity: severityFilter || undefined,
				q: search || undefined,
			});
			setLogs(data.logs);
			setStats(data.stats);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [limit, flaggedOnly, categoryFilter, severityFilter, search]);

	useEffect(() => {
		if (ready) void load();
	}, [load, ready]);

	useEffect(() => {
		if (!liveMode || !ready) return;
		const interval = setInterval(() => void load(), 5_000);
		return () => clearInterval(interval);
	}, [liveMode, load, ready]);

	const filtered = useMemo(() => {
		if (!search.trim()) return logs;
		const q = search.toLowerCase();
		return logs.filter(
			(l) =>
				l.summary.toLowerCase().includes(q) ||
				l.action.toLowerCase().includes(q) ||
				(l.actorEmail ?? "").toLowerCase().includes(q) ||
				(l.actorName ?? "").toLowerCase().includes(q) ||
				l.id.toLowerCase().includes(q),
		);
	}, [logs, search]);

	const hashIntegrity = useMemo(() => {
		const withHash = logs.filter((l) => l.immutableHash);
		if (withHash.length === 0) return { verified: 0, total: 0, status: "no_data" as const };
		return { verified: withHash.length, total: logs.length, status: "verified" as const };
	}, [logs]);

	const onFlag = async (log: AuditLogRecord) => {
		const reason = window.prompt("Reason for flagging this entry:")?.trim();
		if (!reason) return;
		const severity = window.prompt("Severity (low, medium, high, critical):", "high")?.trim();
		if (!severity || !["low", "medium", "high", "critical"].includes(severity)) return;
		setWorking(true);
		setError(null);
		try {
			await flagAdminAuditLog(log.id, reason, severity);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const categoryStats = useMemo(() => {
		const counts: Record<string, number> = {};
		for (const l of logs) {
			counts[l.category] = (counts[l.category] ?? 0) + 1;
		}
		return counts;
	}, [logs]);

	return (
		<AdminShell
			title="Immutable Audit Log"
			subtitle="Searchable, filterable, tamper-resistant record of governance and administrative actions"
			breadcrumb="Admin · Accountability"
			actions={
				<div className="admin-actions-row">
					<button
						type="button"
						className={`ghost-btn ${liveMode ? "admin-live-active" : ""}`}
						onClick={() => setLiveMode(!liveMode)}
					>
						{liveMode ? "● Live" : "○ Live"}
					</button>
					<button type="button" className="ghost-btn" onClick={() => exportAuditCsv(filtered)}>
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
					<AdminStatCard label="Total Entries" value={stats.total} />
					<AdminStatCard label="Last 24h" value={stats.last24h} accent="primary" />
					<AdminStatCard label="Flagged" value={stats.flagged} accent={stats.flagged > 0 ? "warning" : "success"} />
					<AdminStatCard label="Critical" value={stats.critical} accent={stats.critical > 0 ? "danger" : "success"} />
					<AdminStatCard label="High Severity" value={stats.high} accent={stats.high > 0 ? "warning" : "success"} />
					<AdminStatCard
						label="Hash Integrity"
						value={hashIntegrity.status === "verified" ? `${hashIntegrity.verified}/${hashIntegrity.total}` : "N/A"}
						accent={hashIntegrity.status === "verified" ? "success" : undefined}
						hint="Chain-verified entries"
					/>
				</section>
			)}

			<div className="admin-gov-grid">
				<AdminPanel title="Filters & Search" description="Full-text search, filter by category, severity, flagged status">
					<div className="admin-form-grid">
						<label className="admin-form-span">
							Search
							<input
								className="topic-input"
								placeholder="Search by action, summary, email, name, ID…"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
							/>
						</label>
						<label>
							Category
							<select className="topic-input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
								<option value="">All categories</option>
								{CATEGORIES.map((c) => (
									<option key={c} value={c}>{c} ({categoryStats[c] ?? 0})</option>
								))}
							</select>
						</label>
						<label>
							Severity
							<select className="topic-input" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
								<option value="">All severities</option>
								{SEVERITIES.map((s) => (
									<option key={s} value={s}>{s}</option>
								))}
							</select>
						</label>
						<label>
							Limit
							<select className="topic-input" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
								{[50, 100, 200, 500, 1000].map((n) => (
									<option key={n} value={n}>{n} entries</option>
								))}
							</select>
						</label>
						<label className="admin-checkbox-label">
							<input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
							Flagged only
						</label>
					</div>
				</AdminPanel>

				<AdminPanel title="Category Breakdown" description="Distribution by event type">
					<div className="admin-bar-list">
						{Object.entries(categoryStats)
							.sort(([, a], [, b]) => b - a)
							.slice(0, 8)
							.map(([cat, count]) => (
								<div key={cat} className="admin-bar-item">
									<span className="admin-bar-label">{cat}</span>
									<div className="admin-bar-track">
										<div className="admin-bar-fill" style={{ width: `${(count / Math.max(1, logs.length)) * 100}%` }} />
									</div>
									<span className="admin-bar-value">{count}</span>
								</div>
							))}
					</div>
				</AdminPanel>
			</div>

			<AdminPanel
				title="Audit Events"
				description={`${filtered.length.toLocaleString()} entries${liveMode ? " · Auto-refreshing every 5s" : ""}`}
			>
				{loading ? (
					<p className="muted">Loading audit log…</p>
				) : (
					<div className="admin-table-scroll">
						<table className="admin-simple-table">
							<thead>
								<tr>
									<th>Time</th>
									<th>Severity</th>
									<th>Category</th>
									<th>Action</th>
									<th>Summary</th>
									<th>Actor</th>
									<th>Faculty</th>
									<th>Hash</th>
									<th>Flagged</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{filtered.length === 0 ? (
									<tr>
										<td colSpan={10} className="muted">No audit entries match filters.</td>
									</tr>
								) : (
									filtered.map((log) => (
										<Fragment key={log.id}>
											<tr
												className={log.flagged ? "admin-row-flagged" : undefined}
												onClick={() => setExpandedId((id) => (id === log.id ? null : log.id))}
												style={{ cursor: "pointer" }}
											>
												<td title={formatAdminDate(log.createdAt)}>{formatAdminRelative(log.createdAt)}</td>
												<td><span className={`admin-sev admin-sev-${log.severity}`}>{log.severity}</span></td>
												<td>{log.category}</td>
												<td><code>{log.action}</code></td>
												<td className="admin-cell-truncate">{log.summary}</td>
												<td>
													{log.actorName || log.actorEmail || "System"}
													{log.actorRole ? <p className="muted">{log.actorRole}</p> : null}
												</td>
												<td>{log.faculty ?? "—"}</td>
												<td><HashChainBadge hash={log.immutableHash} /></td>
												<td>
													{log.flagged ? (
														<span className="admin-chip admin-chip-danger" title={log.flagReason ?? ""}>Flagged</span>
													) : (
														<span className="muted">—</span>
													)}
												</td>
												<td>
													{!log.flagged && (
														<button type="button" className="ghost-btn" disabled={working} onClick={(e) => { e.stopPropagation(); void onFlag(log); }}>
															Flag
														</button>
													)}
												</td>
											</tr>
											{expandedId === log.id && (
												<tr key={`${log.id}-detail`}>
													<td colSpan={10} className="admin-audit-detail">
														<div className="admin-detail-grid">
															<div><strong>Entry ID:</strong> <code>{log.id}</code></div>
															<div><strong>Timestamp:</strong> {formatAdminDate(log.createdAt)}</div>
															<div><strong>IP Address:</strong> {log.ip ?? "—"}</div>
															<div><strong>User Agent:</strong> {log.userAgent ?? "—"}</div>
															<div><strong>Session ID:</strong> {log.sessionId ?? "—"}</div>
															<div><strong>Target:</strong> {log.targetType ?? "—"} / {log.targetId ?? "—"}</div>
															<div><strong>Department:</strong> {log.department ?? "—"}</div>
															<div><strong>Alert Sent:</strong> {log.alertSent ? "Yes" : "No"}</div>
															{log.immutableHash && <div><strong>Full Hash:</strong> <code className="admin-hash-full">{log.immutableHash}</code></div>}
															{log.flagReason && <div><strong>Flag Reason:</strong> {log.flagReason}</div>}
															{log.beforeValue && <div><strong>Before:</strong> <code>{log.beforeValue}</code></div>}
															{log.afterValue && <div><strong>After:</strong> <code>{log.afterValue}</code></div>}
															{log.details != null && <div className="admin-form-span"><strong>Details:</strong> <pre className="admin-json">{String(JSON.stringify(log.details, null, 2))}</pre></div>}
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
