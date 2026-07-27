"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminPanel, AdminShell, AdminStatCard } from "@/components/admin/AdminShell";
import {
	AdminTokenEditModal,
	formatTokenCount,
	tokenUsagePercent,
} from "@/components/admin/AdminTokenEditModal";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import {
	bulkAdminResetTokens,
	fetchAdminTokens,
	fetchAdminUsers,
	updateAdminTokens,
} from "@/lib/admin-api";
import type { AdminTokenRecord, TokenAdminStats } from "@/lib/admin";
import type { UserRecord } from "@/lib/dashboard";

const COST_PER_1K = 0.002;

function estimateCost(tokens: number): number {
	return Math.round((tokens / 1000) * COST_PER_1K * 100) / 100;
}

function downloadCsv(filename: string, csvContent: string) {
	const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

function exportTokenReport(records: AdminTokenRecord[]) {
	const header = [
		"Name", "Email", "Role", "Faculty", "Department", "Programme",
		"Tokens Used", "Allowance", "Remaining", "Usage %", "Est. Cost",
	];
	const rows = records.map((r) => [
		r.name,
		r.email,
		r.role,
		r.faculty ?? "",
		r.department ?? "",
		r.programme ?? "",
		r.tokenQuota?.used ?? 0,
		r.tokenQuota?.allowance ?? 0,
		r.tokenQuota?.remaining ?? 0,
		r.tokenQuota ? tokenUsagePercent(r.tokenQuota.used, r.tokenQuota.allowance) : 0,
		r.tokenQuota ? estimateCost(r.tokenQuota.used).toFixed(2) : "0.00",
	]);
	const csv = [header, ...rows]
		.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
		.join("\n");
	downloadCsv(`garil-token-report-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}

type ThresholdLevel = "75" | "90" | "100";

export function AdminTokensDashboard() {
	const { ready } = useAdminGuard();
	const [records, setRecords] = useState<AdminTokenRecord[]>([]);
	const [stats, setStats] = useState<TokenAdminStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [working, setWorking] = useState(false);
	const [editingUser, setEditingUser] = useState<AdminTokenRecord | null>(null);

	const [search, setSearch] = useState("");
	const [facultyFilter, setFacultyFilter] = useState("");
	const [departmentFilter, setDepartmentFilter] = useState("");
	const [roleFilter, setRoleFilter] = useState("");
	const [statusFilter, setStatusFilter] = useState<"all" | "over75" | "over90" | "over100">("all");
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [bulkQuota, setBulkQuota] = useState("");

	const loadTokens = useCallback(async () => {
		setError(null);
		try {
			const [tokenData, users] = await Promise.all([
				fetchAdminTokens(),
				fetchAdminUsers().catch(() => [] as UserRecord[]),
			]);
			const orgById = new Map(
				users.map((u) => [u.id, { faculty: u.faculty, department: u.department, programme: u.programme }]),
			);
			const enriched = tokenData.users.map((row) => {
				const org = orgById.get(row.id);
				return {
					...row,
					faculty: row.faculty ?? org?.faculty ?? null,
					department: row.department ?? org?.department ?? null,
					programme: row.programme ?? org?.programme ?? null,
				};
			});
			setRecords(enriched);
			setStats(tokenData.stats);
			setSelected(new Set());
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (ready) void loadTokens();
	}, [loadTokens, ready]);

	const totalTokens = stats?.totalTokensUsed ?? 0;
	const quotaUsers = records.filter((r) => r.tokenQuota !== null);
	const totalAllowance = quotaUsers.reduce((s, r) => s + (r.tokenQuota?.allowance ?? 0), 0);
	const avgPerUser = quotaUsers.length > 0 ? Math.round(totalTokens / quotaUsers.length) : 0;
	const utilization = totalAllowance > 0 ? Math.round((totalTokens / totalAllowance) * 100) : 0;

	const usersOver75 = quotaUsers.filter((r) => tokenUsagePercent(r.tokenQuota!.used, r.tokenQuota!.allowance) >= 75);
	const usersOver90 = quotaUsers.filter((r) => tokenUsagePercent(r.tokenQuota!.used, r.tokenQuota!.allowance) >= 90);
	const usersOver100 = quotaUsers.filter((r) => r.tokenQuota!.used >= r.tokenQuota!.allowance);

	const anomalyThreshold = avgPerUser * 2;
	const anomalyUsers = useMemo(
		() => quotaUsers.filter((r) => (r.tokenQuota?.used ?? 0) > anomalyThreshold),
		[quotaUsers, anomalyThreshold],
	);

	const faculties = useMemo(
		() => [...new Set(records.map((r) => r.faculty).filter(Boolean) as string[])].sort(),
		[records],
	);
	const departments = useMemo(
		() => [...new Set(records.map((r) => r.department).filter(Boolean) as string[])].sort(),
		[records],
	);

	const query = search.trim().toLowerCase();
	const filtered = useMemo(() => {
		return records.filter((r) => {
			if (facultyFilter && (r.faculty ?? "") !== facultyFilter) return false;
			if (departmentFilter && (r.department ?? "") !== departmentFilter) return false;
			if (roleFilter && r.role !== roleFilter) return false;
			if (statusFilter === "over75" && r.tokenQuota && tokenUsagePercent(r.tokenQuota.used, r.tokenQuota.allowance) < 75) return false;
			if (statusFilter === "over90" && r.tokenQuota && tokenUsagePercent(r.tokenQuota.used, r.tokenQuota.allowance) < 90) return false;
			if (statusFilter === "over100" && r.tokenQuota && r.tokenQuota.used < r.tokenQuota.allowance) return false;
			if (query) {
				return (
					r.name.toLowerCase().includes(query) ||
					r.email.toLowerCase().includes(query) ||
					(r.faculty?.toLowerCase().includes(query) ?? false) ||
					(r.department?.toLowerCase().includes(query) ?? false)
				);
			}
			return true;
		});
	}, [records, facultyFilter, departmentFilter, roleFilter, statusFilter, query]);

	const topConsumers = useMemo(() => {
		return [...quotaUsers]
			.sort((a, b) => (b.tokenQuota?.used ?? 0) - (a.tokenQuota?.used ?? 0))
			.slice(0, 10);
	}, [quotaUsers]);

	const budgetByFaculty = useMemo(() => {
		const map = new Map<string, { used: number; allowance: number }>();
		for (const r of quotaUsers) {
			const key = r.faculty?.trim() || "Unassigned";
			const entry = map.get(key) ?? { used: 0, allowance: 0 };
			entry.used += r.tokenQuota?.used ?? 0;
			entry.allowance += r.tokenQuota?.allowance ?? 0;
			map.set(key, entry);
		}
		return [...map.entries()]
			.map(([name, data]) => ({ name, ...data }))
			.sort((a, b) => b.used - a.used);
	}, [quotaUsers]);

	const budgetByDepartment = useMemo(() => {
		const map = new Map<string, { used: number; allowance: number }>();
		for (const r of quotaUsers) {
			const key = r.department?.trim() || "Unassigned";
			const entry = map.get(key) ?? { used: 0, allowance: 0 };
			entry.used += r.tokenQuota?.used ?? 0;
			entry.allowance += r.tokenQuota?.allowance ?? 0;
			map.set(key, entry);
		}
		return [...map.entries()]
			.map(([name, data]) => ({ name, ...data }))
			.sort((a, b) => b.used - a.used);
	}, [quotaUsers]);

	const monthlyRate = stats?.monthlyTokensApprox ?? totalTokens;
	const forecastMonths = useMemo(() => {
		const rate = monthlyRate || 1;
		return Array.from({ length: 6 }, (_, i) => {
			const d = new Date();
			d.setMonth(d.getMonth() + i);
			return {
				month: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
				projected: Math.round(rate * (1 + i * 0.05)),
				cost: estimateCost(Math.round(rate * (1 + i * 0.05))),
			};
		});
	}, [monthlyRate]);

	const toggleAll = () => {
		if (filtered.length > 0 && filtered.every((r) => selected.has(r.id))) {
			setSelected((prev) => {
				const next = new Set(prev);
				for (const r of filtered) next.delete(r.id);
				return next;
			});
		} else {
			setSelected((prev) => {
				const next = new Set(prev);
				for (const r of filtered) next.add(r.id);
				return next;
			});
		}
	};

	const toggleOne = (id: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const bulkReset = async () => {
		const ids = Array.from(selected).filter((id) => records.find((r) => r.id === id)?.tokenQuota);
		if (ids.length === 0) return;
		if (!window.confirm(`Reset tokens to 0 for ${ids.length} user(s)?`)) return;
		setWorking(true);
		setError(null);
		try {
			await bulkAdminResetTokens(ids);
			await loadTokens();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const bulkSetQuota = async () => {
		const parsed = Number.parseInt(bulkQuota, 10);
		if (!Number.isFinite(parsed) || parsed < 0) return;
		const ids = Array.from(selected).filter((id) => records.find((r) => r.id === id)?.tokenQuota);
		if (ids.length === 0) return;
		if (!window.confirm(`Set quota to ${formatTokenCount(parsed)} for ${ids.length} user(s)?`)) return;
		setWorking(true);
		setError(null);
		try {
			for (const id of ids) {
				await updateAdminTokens(id, { tokensUsed: parsed });
			}
			await loadTokens();
			setBulkQuota("");
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const thresholdUsers = (level: ThresholdLevel) => {
		if (level === "100") return usersOver100;
		if (level === "90") return usersOver90;
		return usersOver75;
	};

	return (
		<AdminShell
			title="Token Usage"
			subtitle="Token quotas, consumption, anomaly detection, and budget forecasting"
			breadcrumb="Admin · Tokens"
			actions={
				<>
					<button type="button" className="ghost-btn" onClick={() => exportTokenReport(records)}>
						Export CSV
					</button>
					<button type="button" className="ghost-btn" onClick={() => void loadTokens()}>
						Refresh
					</button>
				</>
			}
		>
			{loading && <p className="muted">Loading token data…</p>}
			{error && <div className="banner banner-error">{error}</div>}

			{/* Stat Cards */}
			<section className="admin-stats">
				<AdminStatCard label="Total Tokens Used" value={formatTokenCount(totalTokens)} accent="primary" />
				<AdminStatCard label="Avg per User" value={formatTokenCount(avgPerUser)} />
				<AdminStatCard label="Total Quota Allowance" value={formatTokenCount(totalAllowance)} />
				<AdminStatCard label="Quota Utilization" value={`${utilization}%`} accent={utilization > 85 ? "danger" : utilization > 60 ? "warning" : "success"} />
				<AdminStatCard label="Users Over 75%" value={usersOver75.length} accent={usersOver75.length > 0 ? "warning" : undefined} />
				<AdminStatCard label="Users Over 90%" value={usersOver90.length} accent={usersOver90.length > 0 ? "danger" : undefined} />
			</section>

			{/* Token Budget Allocation */}
			<div className="admin-gov-grid">
				<AdminPanel title="Budget by Faculty" description="Token allocation and usage per faculty">
					<div className="admin-table-scroll">
						<table className="admin-simple-table">
							<thead>
								<tr>
									<th>Faculty</th>
									<th>Used</th>
									<th>Allowance</th>
									<th>Utilization</th>
								</tr>
							</thead>
							<tbody>
								{budgetByFaculty.length === 0 ? (
									<tr><td colSpan={4} className="muted">No data.</td></tr>
								) : (
									budgetByFaculty.map((row) => {
										const pct = row.allowance > 0 ? Math.round((row.used / row.allowance) * 100) : 0;
										return (
											<tr key={row.name}>
												<td><strong>{row.name}</strong></td>
												<td>{formatTokenCount(row.used)}</td>
												<td>{formatTokenCount(row.allowance)}</td>
												<td>
													<span className="dash-token-usage">
														<span className="dash-token-bar" style={{ width: `${Math.min(pct, 100)}%` }} />
														<span className={pct >= 90 ? "admin-sev-high" : "muted"}>{pct}%</span>
													</span>
												</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>
				</AdminPanel>
				<AdminPanel title="Budget by Department" description="Token allocation and usage per department">
					<div className="admin-table-scroll">
						<table className="admin-simple-table">
							<thead>
								<tr>
									<th>Department</th>
									<th>Used</th>
									<th>Allowance</th>
									<th>Utilization</th>
								</tr>
							</thead>
							<tbody>
								{budgetByDepartment.length === 0 ? (
									<tr><td colSpan={4} className="muted">No data.</td></tr>
								) : (
									budgetByDepartment.slice(0, 15).map((row) => {
										const pct = row.allowance > 0 ? Math.round((row.used / row.allowance) * 100) : 0;
										return (
											<tr key={row.name}>
												<td><strong>{row.name}</strong></td>
												<td>{formatTokenCount(row.used)}</td>
												<td>{formatTokenCount(row.allowance)}</td>
												<td>
													<span className="dash-token-usage">
														<span className="dash-token-bar" style={{ width: `${Math.min(pct, 100)}%` }} />
														<span className={pct >= 90 ? "admin-sev-high" : "muted"}>{pct}%</span>
													</span>
												</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>
				</AdminPanel>
			</div>

			{/* Threshold Alerts */}
			<AdminPanel title="Threshold Alerts" description="Users exceeding quota thresholds">
				<div className="admin-gov-grid">
					{(["75", "90", "100"] as ThresholdLevel[]).map((level) => {
						const users = thresholdUsers(level);
						return (
							<div key={level}>
								<h3 style={{ marginBottom: "0.5rem" }}>
									<span className={`admin-chip ${level === "100" ? "admin-sev-critical" : level === "90" ? "admin-sev-high" : "admin-sev-medium"}`}>
										≥{level}%
									</span>
									{" "}{users.length} user(s)
								</h3>
								{users.length > 0 && (
									<div className="admin-table-scroll">
										<table className="admin-simple-table">
											<thead>
												<tr>
													<th>User</th>
													<th>Used</th>
													<th>Allowance</th>
													<th>%</th>
												</tr>
											</thead>
											<tbody>
												{users.slice(0, 5).map((r) => (
													<tr key={r.id}>
														<td>{r.name}<p className="muted">{r.email}</p></td>
														<td>{formatTokenCount(r.tokenQuota!.used)}</td>
														<td>{formatTokenCount(r.tokenQuota!.allowance)}</td>
														<td>
															<span className={`admin-chip ${tokenUsagePercent(r.tokenQuota!.used, r.tokenQuota!.allowance) >= 100 ? "admin-sev-critical" : "admin-sev-high"}`}>
																{tokenUsagePercent(r.tokenQuota!.used, r.tokenQuota!.allowance)}%
															</span>
														</td>
													</tr>
												))}
												{users.length > 5 && (
													<tr><td colSpan={4} className="muted">…and {users.length - 5} more</td></tr>
												)}
											</tbody>
										</table>
									</div>
								)}
							</div>
						);
					})}
				</div>
			</AdminPanel>

			{/* Top Consumers */}
			<AdminPanel title="Top 10 Consumers" description="Leaderboard by token usage">
				<div className="admin-table-scroll">
					<table className="admin-simple-table">
						<thead>
							<tr>
								<th>#</th>
								<th>User</th>
								<th>Role</th>
								<th>Faculty</th>
								<th>Tokens Used</th>
								<th>Usage</th>
								<th>Est. Cost</th>
							</tr>
						</thead>
						<tbody>
							{topConsumers.length === 0 ? (
								<tr><td colSpan={7} className="muted">No data.</td></tr>
							) : (
								topConsumers.map((r, i) => (
									<tr key={r.id}>
										<td><strong>{i + 1}</strong></td>
										<td>{r.name}<p className="muted">{r.email}</p></td>
										<td>{r.role}</td>
										<td>{r.faculty ?? "—"}</td>
										<td>{formatTokenCount(r.tokenQuota!.used)}</td>
										<td>
											<span className="dash-token-usage">
												<span className="dash-token-bar" style={{ width: `${tokenUsagePercent(r.tokenQuota!.used, r.tokenQuota!.allowance)}%` }} />
												<span className="muted">{tokenUsagePercent(r.tokenQuota!.used, r.tokenQuota!.allowance)}%</span>
											</span>
										</td>
										<td>${estimateCost(r.tokenQuota!.used).toFixed(2)}</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</AdminPanel>

			{/* Anomaly Detection */}
			<AdminPanel
				title="Anomaly Detection"
				description={`Users with usage >2× the average (${formatTokenCount(avgPerUser)} tokens). Threshold: ${formatTokenCount(anomalyThreshold)}`}
			>
				{anomalyUsers.length === 0 ? (
					<p className="muted">No anomalies detected. All users are within normal ranges.</p>
				) : (
					<div className="admin-table-scroll">
						<table className="admin-simple-table">
							<thead>
								<tr>
									<th>User</th>
									<th>Role</th>
									<th>Tokens Used</th>
									<th>× Avg</th>
								</tr>
							</thead>
							<tbody>
								{anomalyUsers.map((r) => {
									const multiple = avgPerUser > 0 ? ((r.tokenQuota?.used ?? 0) / avgPerUser).toFixed(1) : "—";
									return (
										<tr key={r.id} className="admin-row-flagged">
											<td>{r.name}<p className="muted">{r.email}</p></td>
											<td>{r.role}</td>
											<td>{formatTokenCount(r.tokenQuota?.used ?? 0)}</td>
											<td><span className="admin-chip admin-sev-high">{multiple}×</span></td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</AdminPanel>

			{/* Token Type Breakdown (placeholder) */}
			<AdminPanel title="Token Type Breakdown" description="Input vs output token split (conceptual)">
				<section className="admin-stats">
					<AdminStatCard label="Input Tokens (est.)" value={formatTokenCount(Math.round(totalTokens * 0.35))} hint="~35% of total" />
					<AdminStatCard label="Output Tokens (est.)" value={formatTokenCount(Math.round(totalTokens * 0.65))} hint="~65% of total" />
				</section>
				<p className="muted">Token type breakdown is estimated. Exact input/output split requires per-request logging.</p>
			</AdminPanel>

			{/* Forecasting */}
			<AdminPanel title="Monthly Spend Forecast" description="Projected monthly spend based on current rate">
				<div className="admin-table-scroll">
					<table className="admin-simple-table">
						<thead>
							<tr>
								<th>Month</th>
								<th>Projected Tokens</th>
								<th>Projected Cost</th>
							</tr>
						</thead>
						<tbody>
							{forecastMonths.map((row) => (
								<tr key={row.month}>
									<td><strong>{row.month}</strong></td>
									<td>{formatTokenCount(row.projected)}</td>
									<td>${row.cost.toFixed(2)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</AdminPanel>

			{/* Quota Management */}
			<AdminPanel
				title="Quota Management"
				description={`${filtered.length} user(s) · Search and filter, then manage quotas individually or in bulk`}
			>
				{/* Filters */}
				<div className="admin-form-grid" style={{ marginBottom: "1rem" }}>
					<label>
						Search
						<input
							className="topic-input"
							placeholder="Name, email, faculty…"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</label>
					<label>
						Faculty
						<select className="topic-input" value={facultyFilter} onChange={(e) => setFacultyFilter(e.target.value)}>
							<option value="">All</option>
							{faculties.map((f) => <option key={f} value={f}>{f}</option>)}
						</select>
					</label>
					<label>
						Department
						<select className="topic-input" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
							<option value="">All</option>
							{departments.map((d) => <option key={d} value={d}>{d}</option>)}
						</select>
					</label>
					<label>
						Role
						<select className="topic-input" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
							<option value="">All</option>
							<option value="student">Student</option>
							<option value="lecturer">Lecturer</option>
							<option value="researcher">Researcher</option>
							<option value="admin">Admin</option>
						</select>
					</label>
					<label>
						Status
						<select className="topic-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
							<option value="all">All</option>
							<option value="over75">Over 75%</option>
							<option value="over90">Over 90%</option>
							<option value="over100">Over 100%</option>
						</select>
					</label>
				</div>

				{/* Bulk Actions */}
				{selected.size > 0 && (
					<div className="admin-form-grid" style={{ marginBottom: "1rem", padding: "0.75rem", border: "1px solid var(--border)", borderRadius: "0.5rem" }}>
						<p><strong>{selected.size}</strong> user(s) selected</p>
						<div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
							<button type="button" className="ghost-btn" disabled={working} onClick={() => void bulkReset()}>
								{working ? "Resetting…" : "Bulk Reset to 0"}
							</button>
							<input
								type="number"
								className="topic-input"
								placeholder="Set tokens used…"
								value={bulkQuota}
								onChange={(e) => setBulkQuota(e.target.value)}
								min={0}
								style={{ width: 160 }}
							/>
							<button type="button" className="ghost-btn" disabled={working || !bulkQuota} onClick={() => void bulkSetQuota()}>
								Apply
							</button>
							<button type="button" className="ghost-btn" onClick={() => setSelected(new Set())}>
								Clear Selection
							</button>
						</div>
					</div>
				)}

				{/* User Table */}
				<div className="admin-table-scroll">
					<table className="admin-simple-table">
						<thead>
							<tr>
								<th>
									<input
										type="checkbox"
										checked={filtered.length > 0 && filtered.every((r) => selected.has(r.id))}
										onChange={toggleAll}
										aria-label="Select all"
									/>
								</th>
								<th>User</th>
								<th>Role</th>
								<th>Faculty</th>
								<th>Dept</th>
								<th>Used</th>
								<th>Allowance</th>
								<th>Usage %</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{filtered.length === 0 ? (
								<tr><td colSpan={9} className="muted">No users match this filter.</td></tr>
							) : (
								filtered.slice(0, 50).map((r) => {
									const pct = r.tokenQuota ? tokenUsagePercent(r.tokenQuota.used, r.tokenQuota.allowance) : 0;
									return (
										<tr key={r.id} className={pct >= 90 ? "admin-row-flagged" : undefined}>
											<td>
												<input
													type="checkbox"
													checked={selected.has(r.id)}
													onChange={() => toggleOne(r.id)}
													aria-label={`Select ${r.name}`}
												/>
											</td>
											<td>{r.name}<p className="muted">{r.email}</p></td>
											<td>{r.role}</td>
											<td>{r.faculty ?? "—"}</td>
											<td>{r.department ?? "—"}</td>
											<td>{r.tokenQuota ? formatTokenCount(r.tokenQuota.used) : "—"}</td>
											<td>{r.tokenQuota ? formatTokenCount(r.tokenQuota.allowance) : "—"}</td>
											<td>
												{r.tokenQuota ? (
													<span className="dash-token-usage">
														<span className="dash-token-bar" style={{ width: `${Math.min(pct, 100)}%` }} />
														<span className={pct >= 90 ? "admin-sev-high" : "muted"}>{pct}%</span>
													</span>
												) : (
													<span className="muted">No quota</span>
												)}
											</td>
											<td>
												{r.tokenQuota ? (
													<button type="button" className="ghost-btn" onClick={() => setEditingUser(r)}>
														Edit
													</button>
												) : "—"}
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
					{filtered.length > 50 && (
						<p className="muted" style={{ padding: "0.5rem" }}>Showing first 50 of {filtered.length} results. Use filters to narrow.</p>
					)}
				</div>
			</AdminPanel>

			{editingUser && (
				<AdminTokenEditModal
					user={editingUser}
					onClose={() => setEditingUser(null)}
					onSaved={loadTokens}
				/>
			)}
		</AdminShell>
	);
}
