"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminPanel, AdminShell, AdminStatCard, formatAdminDate } from "@/components/admin/AdminShell";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { useAdminUserQuery, matchesAdminUserQuery } from "@/hooks/useAdminUserQuery";
import { createAdminRisk, deleteAdminRisk, fetchAdminRisks, updateAdminRisk } from "@/lib/admin-api";
import type { GovernanceRiskRecord, RiskStats } from "@/lib/admin-governance";

const CATEGORIES = [
	"ai_bias",
	"data_breach",
	"model_failure",
	"compliance_gap",
	"security",
	"operational",
	"reputational",
	"ethical",
] as const;

const STATUSES = ["open", "mitigating", "accepted", "closed"] as const;

const emptyForm = {
	title: "",
	description: "",
	category: "ai_bias",
	likelihood: 3,
	impact: 3,
	faculty: "",
	department: "",
	ownerName: "",
	controls: "",
	treatmentPlan: "",
};

function severityFromScore(score: number): string {
	if (score >= 20) return "critical";
	if (score >= 12) return "high";
	if (score >= 6) return "medium";
	return "low";
}

function exportRisksCsv(risks: GovernanceRiskRecord[]) {
	const headers = [
		"ID", "Title", "Category", "Status", "Likelihood", "Impact",
		"Inherent Score", "Owner", "Faculty", "Department", "Controls",
		"Treatment Plan", "Review Due", "Created",
	];
	const rows = risks.map((r) => [
		r.id, r.title, r.category, r.status,
		String(r.likelihood), String(r.impact), String(r.inherentScore),
		r.ownerName, r.faculty ?? "", r.department ?? "",
		r.controls, r.treatmentPlan,
		r.reviewDueAt ?? "", r.createdAt,
	]);
	const csv = [headers, ...rows]
		.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
		.join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `risk-register-${new Date().toISOString().slice(0, 10)}.csv`;
	link.click();
	URL.revokeObjectURL(url);
}

export function AdminRisksDashboard() {
	const { ready } = useAdminGuard();
	const [risks, setRisks] = useState<GovernanceRiskRecord[]>([]);
	const [stats, setStats] = useState<RiskStats | null>(null);
	const [statusFilter, setStatusFilter] = useState("");
	const [categoryFilter, setCategoryFilter] = useState("");
	const [search, setSearch] = useAdminUserQuery();
	const [form, setForm] = useState(emptyForm);
	const [loading, setLoading] = useState(true);
	const [working, setWorking] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			const data = await fetchAdminRisks({
				status: statusFilter || undefined,
				category: categoryFilter || undefined,
			});
			setRisks(data.risks);
			setStats(data.stats);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [statusFilter, categoryFilter]);

	useEffect(() => {
		if (ready) void load();
	}, [load, ready]);

	const filtered = useMemo(() => {
		return risks.filter((r) =>
			matchesAdminUserQuery(search, [
				r.title, r.ownerName, r.category, r.faculty, r.department, r.id,
			]),
		);
	}, [risks, search]);

	const heatmapCells = useMemo(() => {
		const grid: Record<string, GovernanceRiskRecord[]> = {};
		for (let l = 1; l <= 5; l++) {
			for (let i = 1; i <= 5; i++) {
				grid[`${l}-${i}`] = [];
			}
		}
		for (const r of risks) {
			const key = `${r.likelihood}-${r.impact}`;
			if (grid[key]) grid[key].push(r);
		}
		return grid;
	}, [risks]);

	const onCreate = async () => {
		if (!form.title.trim()) {
			setError("Title is required.");
			return;
		}
		setWorking(true);
		setError(null);
		try {
			await createAdminRisk({
				...form,
				likelihood: Number(form.likelihood),
				impact: Number(form.impact),
				faculty: form.faculty || undefined,
				department: form.department || undefined,
			});
			setForm(emptyForm);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onEditStatus = async (risk: GovernanceRiskRecord) => {
		const status = window.prompt(
			"Status (open, mitigating, accepted, closed)",
			risk.status,
		)?.trim();
		if (!status || !STATUSES.includes(status as typeof STATUSES[number])) return;
		setWorking(true);
		setError(null);
		try {
			await updateAdminRisk(risk.id, { status });
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onEditTreatment = async (risk: GovernanceRiskRecord) => {
		const plan = window.prompt("Treatment plan", risk.treatmentPlan)?.trim();
		if (plan === null || plan === undefined) return;
		setWorking(true);
		setError(null);
		try {
			await updateAdminRisk(risk.id, { treatmentPlan: plan });
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onDelete = async (risk: GovernanceRiskRecord) => {
		if (!window.confirm(`Delete risk "${risk.title}"?`)) return;
		setWorking(true);
		setError(null);
		try {
			await deleteAdminRisk(risk.id);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	return (
		<AdminShell
			title="Risk register"
			subtitle="Institutional AI risk identification, scoring, and treatment tracking"
			breadcrumb="Admin · Governance"
			actions={
				<>
					<button type="button" className="ghost-btn" onClick={() => exportRisksCsv(filtered)}>
						Export CSV
					</button>
					<button type="button" className="ghost-btn" onClick={() => void load()}>
						Refresh
					</button>
				</>
			}
		>
			{loading && <p className="muted">Loading risks…</p>}
			{error && <div className="banner banner-error">{error}</div>}

			{stats && (
				<section className="admin-stats">
					<AdminStatCard label="Total" value={stats.total} />
					<AdminStatCard label="Open" value={stats.open} accent="danger" />
					<AdminStatCard label="Mitigating" value={stats.mitigating} accent="warning" />
					<AdminStatCard label="Accepted" value={stats.accepted} accent="primary" />
					<AdminStatCard label="Closed" value={stats.closed} accent="success" />
					<AdminStatCard label="High inherent" value={stats.highInherent} accent="danger" />
					<AdminStatCard
						label="Avg inherent"
						value={stats.avgInherent.toFixed(1)}
						accent={stats.avgInherent >= 15 ? "danger" : stats.avgInherent >= 8 ? "warning" : "success"}
					/>
				</section>
			)}

			<AdminPanel title="Risk heatmap" description="Distribution of risks by likelihood × impact (5 × 5)">
				<div className="admin-table-scroll">
					<table className="admin-simple-table" style={{ tableLayout: "fixed" }}>
						<thead>
							<tr>
								<th style={{ width: 100 }}>L \ I</th>
								{[1, 2, 3, 4, 5].map((i) => (
									<th key={i} style={{ textAlign: "center" }}>Impact {i}</th>
								))}
							</tr>
						</thead>
						<tbody>
							{[5, 4, 3, 2, 1].map((l) => (
								<tr key={l}>
									<td><strong>Likelihood {l}</strong></td>
									{[1, 2, 3, 4, 5].map((i) => {
										const key = `${l}-${i}`;
										const count = heatmapCells[key]?.length ?? 0;
										const score = l * i;
										const sev = severityFromScore(score);
										return (
											<td
												key={key}
												style={{ textAlign: "center" }}
												title={heatmapCells[key]?.map((r) => r.title).join(", ") || "No risks"}
											>
												{count > 0 ? (
													<span className={`admin-sev admin-sev-${sev}`}>
														{count}
													</span>
												) : (
													<span className="muted">—</span>
												)}
											</td>
										);
									})}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</AdminPanel>

			<div className="admin-gov-grid">
				<AdminPanel title="Register risk" description="Add a new risk entry to the institutional register">
					<div className="admin-form-grid">
						<label>
							Title
							<input
								className="topic-input"
								value={form.title}
								onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
							/>
						</label>
						<label>
							Category
							<select
								className="topic-input"
								value={form.category}
								onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
							>
								{CATEGORIES.map((c) => (
									<option key={c} value={c}>
										{c.replace(/_/g, " ")}
									</option>
								))}
							</select>
						</label>
						<label className="admin-form-span">
							Description
							<textarea
								className="topic-input"
								rows={2}
								value={form.description}
								onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
							/>
						</label>
						<label>
							Likelihood (1–5)
							<select
								className="topic-input"
								value={form.likelihood}
								onChange={(e) => setForm((f) => ({ ...f, likelihood: Number(e.target.value) }))}
							>
								{[1, 2, 3, 4, 5].map((n) => (
									<option key={n} value={n}>{n}</option>
								))}
							</select>
						</label>
						<label>
							Impact (1–5)
							<select
								className="topic-input"
								value={form.impact}
								onChange={(e) => setForm((f) => ({ ...f, impact: Number(e.target.value) }))}
							>
								{[1, 2, 3, 4, 5].map((n) => (
									<option key={n} value={n}>{n}</option>
								))}
							</select>
						</label>
						<label>
							Faculty
							<input
								className="topic-input"
								value={form.faculty}
								onChange={(e) => setForm((f) => ({ ...f, faculty: e.target.value }))}
							/>
						</label>
						<label>
							Department
							<input
								className="topic-input"
								value={form.department}
								onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
							/>
						</label>
						<label>
							Owner name
							<input
								className="topic-input"
								value={form.ownerName}
								onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
							/>
						</label>
						<label className="admin-form-span">
							Controls
							<textarea
								className="topic-input"
								rows={2}
								value={form.controls}
								onChange={(e) => setForm((f) => ({ ...f, controls: e.target.value }))}
								placeholder="Existing controls or mitigations"
							/>
						</label>
						<label className="admin-form-span">
							Treatment plan
							<textarea
								className="topic-input"
								rows={2}
								value={form.treatmentPlan}
								onChange={(e) => setForm((f) => ({ ...f, treatmentPlan: e.target.value }))}
								placeholder="Planned mitigations or acceptance rationale"
							/>
						</label>
					</div>
					<button type="button" className="primary-btn" disabled={working} onClick={() => void onCreate()}>
						Register risk
					</button>
				</AdminPanel>

				<AdminPanel title="Filters" description="Narrow the risk register view">
					<div className="admin-filters admin-form-grid">
						<label>
							Search
							<input
								className="topic-input"
								placeholder="Title, owner, ID…"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
							/>
						</label>
						<label>
							Status
							<select
								className="topic-input"
								value={statusFilter}
								onChange={(e) => setStatusFilter(e.target.value)}
							>
								<option value="">All</option>
								{STATUSES.map((s) => (
									<option key={s} value={s}>{s}</option>
								))}
							</select>
						</label>
						<label>
							Category
							<select
								className="topic-input"
								value={categoryFilter}
								onChange={(e) => setCategoryFilter(e.target.value)}
							>
								<option value="">All</option>
								{CATEGORIES.map((c) => (
									<option key={c} value={c}>
										{c.replace(/_/g, " ")}
									</option>
								))}
							</select>
						</label>
					</div>
				</AdminPanel>
			</div>

			<AdminPanel
				title="Risk register"
				description={`${filtered.length} of ${risks.length} risks`}
			>
				<div className="admin-table-scroll">
					<table className="admin-simple-table">
						<thead>
							<tr>
								<th>Title</th>
								<th>Category</th>
								<th>Status</th>
								<th>Likelihood</th>
								<th>Impact</th>
								<th>Score</th>
								<th>Owner</th>
								<th>Faculty</th>
								<th>Review due</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{filtered.length === 0 ? (
								<tr>
									<td colSpan={10} className="muted">
										No risks in this view.
									</td>
								</tr>
							) : (
								filtered.map((risk) => {
									const sev = severityFromScore(risk.inherentScore);
									return (
										<tr key={risk.id}>
											<td>
												<strong>{risk.title}</strong>
												<p className="muted">{risk.description?.slice(0, 80)}</p>
											</td>
											<td>{risk.category.replace(/_/g, " ")}</td>
											<td>
												<span className={`admin-chip admin-chip-status-${risk.status}`}>
													{risk.status}
												</span>
											</td>
											<td>{risk.likelihood}</td>
											<td>{risk.impact}</td>
											<td>
												<span className={`admin-sev admin-sev-${sev}`}>
													{risk.inherentScore}
												</span>
											</td>
											<td>{risk.ownerName || "—"}</td>
											<td>{risk.faculty ?? "—"}</td>
											<td>{formatAdminDate(risk.reviewDueAt)}</td>
											<td className="admin-row-actions">
												<button
													type="button"
													className="ghost-btn"
													disabled={working}
													onClick={() => void onEditStatus(risk)}
												>
													Edit status
												</button>
												<button
													type="button"
													className="ghost-btn"
													disabled={working}
													onClick={() => void onEditTreatment(risk)}
												>
													Treatment
												</button>
												<button
													type="button"
													className="ghost-btn"
													disabled={working}
													onClick={() => void onDelete(risk)}
												>
													Delete
												</button>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</AdminPanel>
		</AdminShell>
	);
}
