"use client";

import { Fragment, useCallback, useEffect, useState } from "react";

import { AdminSelect } from "@/components/admin/AdminSelect";
import {
	AdminPanel,
	AdminStatCard,
	formatAdminDate,
	formatAdminRelative,
	SuperAdminShell,
} from "@/components/admin/SuperAdminShell";
import { useSuperAdminGuard } from "@/hooks/useAdminGuard";
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

export function SuperAdminActivitiesDashboard() {
	const { ready } = useSuperAdminGuard();
	const [logs, setLogs] = useState<AuditLogRecord[]>([]);
	const [stats, setStats] = useState<AuditAlertStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [working, setWorking] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [categoryFilter, setCategoryFilter] = useState("");
	const [severityFilter, setSeverityFilter] = useState("");
	const [flaggedOnly, setFlaggedOnly] = useState(false);
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			const data = await fetchAdminAuditLogs({
				limit: 250,
				flagged: flaggedOnly || undefined,
				category: categoryFilter || undefined,
				severity: severityFilter || undefined,
				q: search.trim() || undefined,
			});
			setLogs(data.logs);
			setStats(data.stats);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [flaggedOnly, categoryFilter, severityFilter, search]);

	useEffect(() => {
		if (ready) void load();
	}, [load, ready]);

	const onFlag = async (log: AuditLogRecord) => {
		const reason = window.prompt("Flag reason:")?.trim();
		if (!reason) return;
		setWorking(true);
		try {
			await flagAdminAuditLog(log.id, reason, "high");
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	return (
		<SuperAdminShell
			title="Platform activities"
			subtitle="Cross-university admin actions, auth events, and system activity"
			breadcrumb="Platform"
			actions={
				<button type="button" className="ghost-btn" onClick={() => void load()}>
					Refresh
				</button>
			}
		>
			{error && <p className="error-text">{error}</p>}

			<section className="admin-stats">
				<AdminStatCard label="Events loaded" value={logs.length} />
				<AdminStatCard label="Total (scope)" value={stats?.total ?? 0} />
				<AdminStatCard
					label="Flagged"
					value={stats?.flagged ?? 0}
					accent={(stats?.flagged ?? 0) > 0 ? "danger" : undefined}
				/>
				<AdminStatCard label="High / critical" value={(stats?.high ?? 0) + (stats?.critical ?? 0)} />
			</section>

			<AdminPanel
				title="Activity feed"
				actions={
					<div className="admin-actions-row">
						<input
							className="topic-input"
							placeholder="Search activities…"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") void load();
							}}
							style={{ minWidth: 180 }}
						/>
						<AdminSelect
							compact
							value={categoryFilter}
							onChange={setCategoryFilter}
							placeholder="All categories"
							clearable
							aria-label="Filter by category"
							searchThreshold={99}
							options={CATEGORIES.map((c) => ({ value: c, label: c }))}
						/>
						<AdminSelect
							compact
							value={severityFilter}
							onChange={setSeverityFilter}
							placeholder="All severities"
							clearable
							aria-label="Filter by severity"
							searchThreshold={99}
							options={SEVERITIES.map((s) => ({ value: s, label: s }))}
						/>
						<label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
							<input
								type="checkbox"
								checked={flaggedOnly}
								onChange={(e) => setFlaggedOnly(e.target.checked)}
							/>
							Flagged only
						</label>
						<button type="button" className="ghost-btn" onClick={() => void load()}>
							Apply
						</button>
					</div>
				}
			>
				{loading ? (
					<p className="muted">Loading…</p>
				) : logs.length === 0 ? (
					<p className="muted">No activities match these filters.</p>
				) : (
					<table className="admin-table">
						<thead>
							<tr>
								<th>When</th>
								<th>Category</th>
								<th>Action</th>
								<th>Actor</th>
								<th>Summary</th>
								<th>Severity</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{logs.map((log) => (
								<Fragment key={log.id}>
									<tr>
										<td title={formatAdminDate(log.createdAt)}>
											{formatAdminRelative(log.createdAt)}
										</td>
										<td>
											<span className="admin-chip">{log.category}</span>
										</td>
										<td>
											<code>{log.action}</code>
										</td>
										<td>
											{log.actorName ?? log.actorEmail ?? "—"}
											{log.actorRole ? (
												<div className="muted">{log.actorRole}</div>
											) : null}
										</td>
										<td>{log.summary}</td>
										<td>
											<span className={`pill status-${log.severity}`}>{log.severity}</span>
											{log.flagged ? (
												<span className="admin-chip" style={{ marginLeft: 4 }}>
													flagged
												</span>
											) : null}
										</td>
										<td>
											<div className="admin-row-actions">
												<button
													type="button"
													className="ghost-btn"
													onClick={() =>
														setExpandedId((id) => (id === log.id ? null : log.id))
													}
												>
													{expandedId === log.id ? "Hide" : "Details"}
												</button>
												{!log.flagged && (
													<button
														type="button"
														className="ghost-btn"
														disabled={working}
														onClick={() => void onFlag(log)}
													>
														Flag
													</button>
												)}
											</div>
										</td>
									</tr>
									{expandedId === log.id && (
										<tr>
											<td colSpan={7}>
												<pre
													style={{
														whiteSpace: "pre-wrap",
														fontSize: "0.85rem",
														margin: 0,
													}}
												>
													{JSON.stringify(
														{
															id: log.id,
															targetType: log.targetType,
															targetId: log.targetId,
															faculty: log.faculty,
															department: log.department,
															ip: log.ip,
															flagReason: log.flagReason,
															details: log.details,
														},
														null,
														2,
													)}
												</pre>
											</td>
										</tr>
									)}
								</Fragment>
							))}
						</tbody>
					</table>
				)}
			</AdminPanel>
		</SuperAdminShell>
	);
}
