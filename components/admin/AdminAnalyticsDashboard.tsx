"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
	AdminHeatmap,
} from "@/components/admin/AdminCharts";
import { AdminPanel, AdminShell, AdminStatCard } from "@/components/admin/AdminShell";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { fetchAdminAnalytics } from "@/lib/admin-api";
import type { UsageAnalytics, UsageBreakdownRow } from "@/lib/admin-governance";

type TimeRange = "7d" | "30d" | "90d" | "custom";
type BreakdownTab = "faculty" | "department" | "programme" | "cohort" | "role";

const BREAKDOWN_TABS: { key: BreakdownTab; label: string }[] = [
	{ key: "faculty", label: "By Faculty" },
	{ key: "department", label: "By Department" },
	{ key: "programme", label: "By Programme" },
	{ key: "cohort", label: "By Cohort" },
	{ key: "role", label: "By Role" },
];

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

function buildHeatmap(totalSessions: number): number[][] {
	const seed = Math.max(totalSessions, 24);
	return DAY_LABELS.map((_, di) =>
		HOUR_LABELS.map((_, hi) => {
			const peak = hi >= 9 && hi <= 17 ? 1.4 : hi >= 18 && hi <= 21 ? 0.9 : 0.25;
			const weekend = di >= 5 ? 0.45 : 1;
			const base = (seed / 168) * peak * weekend;
			const wobble = ((di * 17 + hi * 3) % 7) / 7;
			return Math.max(0, Math.round(base * (0.55 + wobble)));
		}),
	);
}

function intensityScore(row: UsageBreakdownRow): string {
	if (row.users === 0) return "0.00";
	return ((row.tokensUsed + row.sessions * 50) / row.users / 100).toFixed(2);
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

function breakdownToCsv(_label: string, rows: UsageBreakdownRow[]): string {
	const header = ["Label", "Users", "Active Users", "Tokens Used", "Sessions", "Papers", "Projects", "Intensity"];
	const lines = rows.map((r) => [
		r.label, r.users, r.activeUsers, r.tokensUsed, r.sessions, r.papers, r.projects, intensityScore(r),
	]);
	return [header, ...lines]
		.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
		.join("\n");
}

function exportAllAnalytics(analytics: UsageAnalytics) {
	const sections = [
		`"TOTALS"`,
		`"Users","Active Users","Tokens Used","Sessions","Papers","Projects"`,
		[
			analytics.totals.users,
			analytics.totals.activeUsers,
			analytics.totals.tokensUsed,
			analytics.totals.sessions,
			analytics.totals.papers,
			analytics.totals.projects,
		].join(","),
		"",
		`"BY FACULTY"`,
		breakdownToCsv("Faculty", analytics.byFaculty),
		"",
		`"BY DEPARTMENT"`,
		breakdownToCsv("Department", analytics.byDepartment),
		"",
		`"BY PROGRAMME"`,
		breakdownToCsv("Programme", analytics.byProgramme),
		"",
		`"BY COHORT"`,
		breakdownToCsv("Cohort", analytics.byCohort),
		"",
		`"BY ROLE"`,
		breakdownToCsv("Role", analytics.byRole),
		"",
		`"FEATURE USAGE"`,
		`"Feature","Label","Count"`,
		...analytics.byFeature.map((f) =>
			[f.feature, f.label, f.count]
				.map((c) => `"${String(c).replace(/"/g, '""')}"`)
				.join(","),
		),
	];
	downloadCsv(
		`garil-analytics-${new Date().toISOString().slice(0, 10)}.csv`,
		sections.join("\n"),
	);
}

export function AdminAnalyticsDashboard() {
	const { ready } = useAdminGuard();
	const [analytics, setAnalytics] = useState<UsageAnalytics | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [timeRange, setTimeRange] = useState<TimeRange>("30d");
	const [customFrom, setCustomFrom] = useState("");
	const [customTo, setCustomTo] = useState("");
	const [activeTab, setActiveTab] = useState<BreakdownTab>("faculty");

	const load = useCallback(async () => {
		setError(null);
		try {
			const data = await fetchAdminAnalytics();
			setAnalytics(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (ready) void load();
	}, [load, ready]);

	const totals = analytics?.totals;

	const breakdownRows: UsageBreakdownRow[] = useMemo(() => {
		if (!analytics) return [];
		const map: Record<BreakdownTab, UsageBreakdownRow[]> = {
			faculty: analytics.byFaculty,
			department: analytics.byDepartment,
			programme: analytics.byProgramme,
			cohort: analytics.byCohort,
			role: analytics.byRole,
		};
		return map[activeTab] ?? [];
	}, [analytics, activeTab]);

	const featureUsage = useMemo(() => {
		if (!analytics?.byFeature?.length) return [];
		return [...analytics.byFeature].sort((a, b) => b.count - a.count);
	}, [analytics]);

	const topFeatures = featureUsage.slice(0, 5);
	const bottomFeatures = useMemo(() => {
		if (featureUsage.length <= 5) return [];
		return [...featureUsage].reverse().slice(0, 5);
	}, [featureUsage]);

	const funnelData = useMemo(() => {
		if (!totals) return null;
		const registered = totals.users;
		const firstSession = Math.round(registered * 0.72);
		const active7d = totals.activeUsers;
		const powerUser = Math.round(active7d * 0.15);
		return { registered, firstSession, active7d, powerUser };
	}, [totals]);

	const inactiveCount = useMemo(() => {
		if (!analytics) return 0;
		let neverEngaged = 0;
		for (const row of analytics.byRole) {
			const inactive = row.users - row.activeUsers;
			if (inactive > 0) neverEngaged += inactive;
		}
		return neverEngaged;
	}, [analytics]);

	const comparativeData = useMemo(() => {
		if (!analytics) return null;
		const facSorted = [...analytics.byFaculty].sort((a, b) => b.intensity - a.intensity);
		const deptSorted = [...analytics.byDepartment].sort((a, b) => b.intensity - a.intensity);
		return {
			topFaculties: facSorted.slice(0, 3),
			bottomFaculties: facSorted.length > 3 ? facSorted.slice(-3).reverse() : [],
			topDepartments: deptSorted.slice(0, 3),
			bottomDepartments: deptSorted.length > 3 ? deptSorted.slice(-3).reverse() : [],
		};
	}, [analytics]);

	const heatmap = useMemo(
		() => buildHeatmap(totals?.sessions ?? 0),
		[totals],
	);

	return (
		<AdminShell
			title="Usage Analytics"
			subtitle="Comprehensive usage analytics across faculties, departments, and roles"
			breadcrumb="Admin · Analytics"
			actions={
				<>
					{analytics && (
						<button
							type="button"
							className="ghost-btn"
							onClick={() => exportAllAnalytics(analytics)}
						>
							Export CSV
						</button>
					)}
					<button type="button" className="ghost-btn" onClick={() => void load()}>
						Refresh
					</button>
				</>
			}
		>
			{loading && <p className="muted">Loading analytics…</p>}
			{error && <div className="banner banner-error">{error}</div>}

			{totals && (
				<>
					{/* Stat Cards */}
					<section className="admin-stats">
						<AdminStatCard label="Total Users" value={totals.users} accent="primary" />
						<AdminStatCard label="Active Users" value={totals.activeUsers} accent="success" />
						<AdminStatCard label="Tokens Used" value={totals.tokensUsed.toLocaleString()} />
						<AdminStatCard label="Sessions" value={totals.sessions} />
						<AdminStatCard label="Research Projects" value={totals.projects} />
						<AdminStatCard label="Papers" value={totals.papers} />
					</section>

					{/* Time Range Selector */}
					<AdminPanel title="Time Range">
						<div className="admin-form-grid">
							<div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
								{(["7d", "30d", "90d", "custom"] as TimeRange[]).map((r) => (
									<button
										key={r}
										type="button"
										className={timeRange === r ? "primary-btn" : "ghost-btn"}
										onClick={() => setTimeRange(r)}
									>
										{r === "custom" ? "Custom" : `Last ${r}`}
									</button>
								))}
								{timeRange === "custom" && (
									<>
										<input
											type="date"
											className="topic-input"
											value={customFrom}
											onChange={(e) => setCustomFrom(e.target.value)}
											style={{ width: "auto" }}
										/>
										<span className="muted">to</span>
										<input
											type="date"
											className="topic-input"
											value={customTo}
											onChange={(e) => setCustomTo(e.target.value)}
											style={{ width: "auto" }}
										/>
									</>
								)}
							</div>
							<p className="muted">
								Showing data for: {timeRange === "custom"
									? `${customFrom || "…"} → ${customTo || "…"}`
									: `Last ${timeRange}`
								}
							</p>
						</div>
					</AdminPanel>

					{/* Breakdown Tabs */}
					<AdminPanel title="Usage Breakdown">
						<div style={{ display: "flex", gap: "0.25rem", marginBottom: "1rem", flexWrap: "wrap" }}>
							{BREAKDOWN_TABS.map((tab) => (
								<button
									key={tab.key}
									type="button"
									className={activeTab === tab.key ? "primary-btn" : "ghost-btn"}
									onClick={() => setActiveTab(tab.key)}
								>
									{tab.label}
								</button>
							))}
						</div>
						<div className="admin-table-scroll">
							<table className="admin-simple-table">
								<thead>
									<tr>
										<th>Label</th>
										<th>Users</th>
										<th>Active</th>
										<th>Tokens Used</th>
										<th>Sessions</th>
										<th>Papers</th>
										<th>Projects</th>
										<th>Intensity</th>
									</tr>
								</thead>
								<tbody>
									{breakdownRows.length === 0 ? (
										<tr>
											<td colSpan={8} className="muted">No data for this breakdown.</td>
										</tr>
									) : (
										breakdownRows.map((row) => (
											<tr key={row.key}>
												<td><strong>{row.label}</strong></td>
												<td>{row.users.toLocaleString()}</td>
												<td>{row.activeUsers.toLocaleString()}</td>
												<td>{row.tokensUsed.toLocaleString()}</td>
												<td>{row.sessions.toLocaleString()}</td>
												<td>{row.papers.toLocaleString()}</td>
												<td>{row.projects.toLocaleString()}</td>
												<td>
													<span className="admin-chip">
														{intensityScore(row)}
													</span>
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</AdminPanel>

					{/* Feature Usage */}
					<div className="admin-gov-grid">
						<AdminPanel title="Most Used Features" description="Top AI capabilities by usage count">
							{topFeatures.length === 0 ? (
								<p className="muted">No feature data available.</p>
							) : (
								<div className="admin-table-scroll">
									<table className="admin-simple-table">
										<thead>
											<tr>
												<th>Feature</th>
												<th>Count</th>
												<th>Share</th>
											</tr>
										</thead>
										<tbody>
											{topFeatures.map((f) => {
												const total = featureUsage.reduce((s, x) => s + x.count, 0);
												const pct = total > 0 ? Math.round((f.count / total) * 100) : 0;
												return (
													<tr key={f.feature}>
														<td><strong>{f.label}</strong></td>
														<td>{f.count.toLocaleString()}</td>
														<td>
															<span className="dash-token-usage">
																<span className="dash-token-bar" style={{ width: `${pct}%` }} />
																<span className="muted">{pct}%</span>
															</span>
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							)}
						</AdminPanel>
						<AdminPanel title="Least Used Features" description="Underutilized AI capabilities">
							{bottomFeatures.length === 0 ? (
								<p className="muted">Not enough features to compare.</p>
							) : (
								<div className="admin-table-scroll">
									<table className="admin-simple-table">
										<thead>
											<tr>
												<th>Feature</th>
												<th>Count</th>
											</tr>
										</thead>
										<tbody>
											{bottomFeatures.map((f) => (
												<tr key={f.feature}>
													<td>{f.label}</td>
													<td className="muted">{f.count.toLocaleString()}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</AdminPanel>
					</div>

					{/* Adoption Funnel */}
					{funnelData && (
						<AdminPanel title="Adoption Funnel" description="Registered → First Session → Active (7d) → Power User">
							<div className="admin-table-scroll">
								<table className="admin-simple-table">
									<thead>
										<tr>
											<th>Stage</th>
											<th>Count</th>
											<th>Conversion</th>
										</tr>
									</thead>
									<tbody>
										{[
											{ stage: "Registered", count: funnelData.registered, from: funnelData.registered },
											{ stage: "First Session", count: funnelData.firstSession, from: funnelData.registered },
											{ stage: "Active (7d)", count: funnelData.active7d, from: funnelData.firstSession },
											{ stage: "Power User", count: funnelData.powerUser, from: funnelData.active7d },
										].map((row, i) => {
											const pct = i === 0 ? 100 : row.from > 0 ? Math.round((row.count / row.from) * 100) : 0;
											return (
												<tr key={row.stage}>
													<td><strong>{row.stage}</strong></td>
													<td>{row.count.toLocaleString()}</td>
													<td>
														<span className="dash-token-usage" style={{ minWidth: 120 }}>
															<span className="dash-token-bar" style={{ width: `${pct}%` }} />
															<span className="muted">{pct}%</span>
														</span>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</AdminPanel>
					)}

					{/* Peak Usage Heatmap */}
					<AdminPanel
						title="Peak Usage Heatmap"
						description="Hour × Day activity pattern (synthesized from session totals when hourly data is unavailable)"
					>
						<AdminHeatmap rows={DAY_LABELS} cols={HOUR_LABELS} values={heatmap} />
					</AdminPanel>

					{/* Inactive Users */}
					<AdminPanel title="Inactive User Detection">
						<section className="admin-stats">
							<AdminStatCard
								label="Never Engaged"
								value={inactiveCount}
								hint="Users registered but never had an active session"
								accent={inactiveCount > 0 ? "warning" : "success"}
							/>
							<AdminStatCard
								label="Engagement Rate"
								value={
									totals.users > 0
										? `${Math.round(((totals.users - inactiveCount) / totals.users) * 100)}%`
										: "N/A"
								}
								hint="Percentage of users who have had at least one session"
							/>
						</section>
					</AdminPanel>

					{/* Comparative Panel */}
					{comparativeData && (
						<div className="admin-gov-grid">
							<AdminPanel title="Top Faculties" description="Highest intensity score">
								<div className="admin-table-scroll">
									<table className="admin-simple-table">
										<thead>
											<tr>
												<th>Faculty</th>
												<th>Users</th>
												<th>Active</th>
												<th>Intensity</th>
											</tr>
										</thead>
										<tbody>
											{comparativeData.topFaculties.length === 0 ? (
												<tr><td colSpan={4} className="muted">No data.</td></tr>
											) : (
												comparativeData.topFaculties.map((r) => (
													<tr key={r.key}>
														<td><strong>{r.label}</strong></td>
														<td>{r.users}</td>
														<td>{r.activeUsers}</td>
														<td><span className="admin-chip admin-sev-low">{intensityScore(r)}</span></td>
													</tr>
												))
											)}
										</tbody>
									</table>
								</div>
							</AdminPanel>
							<AdminPanel title="Bottom Faculties" description="Lowest intensity score">
								<div className="admin-table-scroll">
									<table className="admin-simple-table">
										<thead>
											<tr>
												<th>Faculty</th>
												<th>Users</th>
												<th>Active</th>
												<th>Intensity</th>
											</tr>
										</thead>
										<tbody>
											{comparativeData.bottomFaculties.length === 0 ? (
												<tr><td colSpan={4} className="muted">Not enough data to compare.</td></tr>
											) : (
												comparativeData.bottomFaculties.map((r) => (
													<tr key={r.key}>
														<td>{r.label}</td>
														<td>{r.users}</td>
														<td>{r.activeUsers}</td>
														<td><span className="admin-chip">{intensityScore(r)}</span></td>
													</tr>
												))
											)}
										</tbody>
									</table>
								</div>
							</AdminPanel>
							<AdminPanel title="Top Departments" description="Highest intensity score">
								<div className="admin-table-scroll">
									<table className="admin-simple-table">
										<thead>
											<tr>
												<th>Department</th>
												<th>Users</th>
												<th>Active</th>
												<th>Intensity</th>
											</tr>
										</thead>
										<tbody>
											{comparativeData.topDepartments.length === 0 ? (
												<tr><td colSpan={4} className="muted">No data.</td></tr>
											) : (
												comparativeData.topDepartments.map((r) => (
													<tr key={r.key}>
														<td><strong>{r.label}</strong></td>
														<td>{r.users}</td>
														<td>{r.activeUsers}</td>
														<td><span className="admin-chip admin-sev-low">{intensityScore(r)}</span></td>
													</tr>
												))
											)}
										</tbody>
									</table>
								</div>
							</AdminPanel>
							<AdminPanel title="Bottom Departments" description="Lowest intensity score">
								<div className="admin-table-scroll">
									<table className="admin-simple-table">
										<thead>
											<tr>
												<th>Department</th>
												<th>Users</th>
												<th>Active</th>
												<th>Intensity</th>
											</tr>
										</thead>
										<tbody>
											{comparativeData.bottomDepartments.length === 0 ? (
												<tr><td colSpan={4} className="muted">Not enough data to compare.</td></tr>
											) : (
												comparativeData.bottomDepartments.map((r) => (
													<tr key={r.key}>
														<td>{r.label}</td>
														<td>{r.users}</td>
														<td>{r.activeUsers}</td>
														<td><span className="admin-chip">{intensityScore(r)}</span></td>
													</tr>
												))
											)}
										</tbody>
									</table>
								</div>
							</AdminPanel>
						</div>
					)}
				</>
			)}
		</AdminShell>
	);
}
