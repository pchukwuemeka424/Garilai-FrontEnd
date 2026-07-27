"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminPanel, AdminShell, AdminStatCard, formatAdminDate } from "@/components/admin/AdminShell";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { useAdminUserQuery, matchesAdminUserQuery } from "@/hooks/useAdminUserQuery";
import {
	createAdminInventorySystem,
	deleteAdminInventorySystem,
	fetchAdminInventory,
	updateAdminInventorySystem,
} from "@/lib/admin-api";
import type { AiSystemRecord, AiSystemStats } from "@/lib/admin-governance";

const CATEGORIES = ["llm", "search", "analysis", "generation", "classification", "other"] as const;

const DEPLOYMENTS = ["cloud", "on_premise", "hybrid"] as const;

const RISK_TIERS = ["high", "medium", "low", "minimal"] as const;

const SYSTEM_STATUSES = ["active", "retired", "restricted", "under_review"] as const;

const DPIA_STATUSES = ["required", "completed", "in_progress", "not_required", "overdue"] as const;

const STATUS_LABELS: Record<string, string> = {
	active: "Active",
	retired: "Retired",
	restricted: "Restricted",
	under_review: "Under review",
};

const DPIA_LABELS: Record<string, string> = {
	required: "Required",
	completed: "Completed",
	in_progress: "In progress",
	not_required: "Not required",
	overdue: "Overdue",
};

const emptyForm = {
	name: "",
	vendor: "",
	purpose: "",
	category: "llm",
	deployment: "cloud",
	riskTier: "medium",
	status: "active",
	dataClasses: "",
	facultiesAllowed: "",
	rolesAllowed: "",
	ownerName: "",
	dpiaRequired: false,
	dpiaStatus: "not_required",
	notes: "",
};

function exportInventoryCsv(systems: AiSystemRecord[]) {
	const headers = [
		"ID", "Name", "Vendor", "Purpose", "Category", "Deployment",
		"Risk Tier", "Status", "DPIA Status", "Owner",
		"Data Classes", "Faculties Allowed", "Roles Allowed",
		"Last Reviewed", "Notes", "Created",
	];
	const rows = systems.map((s) => [
		s.id, s.name, s.vendor, s.purpose, s.category, s.deployment,
		s.riskTier, s.status, s.dpiaStatus, s.ownerName,
		(s.dataClasses ?? []).join("; "),
		(s.facultiesAllowed ?? []).join("; "),
		(s.rolesAllowed ?? []).join("; "),
		s.lastReviewedAt ?? "", s.notes, s.createdAt,
	]);
	const csv = [headers, ...rows]
		.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
		.join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `ai-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
	link.click();
	URL.revokeObjectURL(url);
}

export function AdminInventoryDashboard() {
	const { ready } = useAdminGuard();
	const [systems, setSystems] = useState<AiSystemRecord[]>([]);
	const [stats, setStats] = useState<AiSystemStats | null>(null);
	const [statusFilter, setStatusFilter] = useState("");
	const [riskTierFilter, setRiskTierFilter] = useState("");
	const [search, setSearch] = useAdminUserQuery();
	const [form, setForm] = useState(emptyForm);
	const [loading, setLoading] = useState(true);
	const [working, setWorking] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			const data = await fetchAdminInventory({
				status: statusFilter || undefined,
				riskTier: riskTierFilter || undefined,
			});
			setSystems(data.systems);
			setStats(data.stats);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [statusFilter, riskTierFilter]);

	useEffect(() => {
		if (ready) void load();
	}, [load, ready]);

	const filtered = useMemo(() => {
		return systems.filter((s) =>
			matchesAdminUserQuery(search, [
				s.name, s.vendor, s.ownerName, s.category, s.riskTier, s.id,
			]),
		);
	}, [systems, search]);

	const riskDistribution = useMemo(() => {
		const dist: Record<string, number> = { high: 0, medium: 0, low: 0, minimal: 0 };
		for (const s of systems) {
			if (dist[s.riskTier] !== undefined) dist[s.riskTier]++;
		}
		return dist;
	}, [systems]);

	const onCreate = async () => {
		if (!form.name.trim()) {
			setError("System name is required.");
			return;
		}
		setWorking(true);
		setError(null);
		try {
			const toArr = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
			await createAdminInventorySystem({
				...form,
				dataClasses: toArr(form.dataClasses),
				facultiesAllowed: toArr(form.facultiesAllowed),
				rolesAllowed: toArr(form.rolesAllowed),
			});
			setForm(emptyForm);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onEdit = async (system: AiSystemRecord) => {
		const notes = window.prompt("Notes", system.notes)?.trim();
		if (notes === null || notes === undefined) return;
		setWorking(true);
		setError(null);
		try {
			await updateAdminInventorySystem(system.id, { notes });
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onUpdateStatus = async (system: AiSystemRecord) => {
		const status = window.prompt(
			"Status (active, retired, restricted, under_review)",
			system.status,
		)?.trim();
		if (!status || !SYSTEM_STATUSES.includes(status as typeof SYSTEM_STATUSES[number])) return;
		setWorking(true);
		setError(null);
		try {
			await updateAdminInventorySystem(system.id, { status });
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onDelete = async (system: AiSystemRecord) => {
		if (!window.confirm(`Delete system "${system.name}"?`)) return;
		setWorking(true);
		setError(null);
		try {
			await deleteAdminInventorySystem(system.id);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const dpiaChipClass = (status: string) => {
		if (status === "completed") return "admin-chip admin-chip-status-closed";
		if (status === "overdue") return "admin-chip admin-chip-status-open";
		if (status === "in_progress") return "admin-chip admin-chip-status-investigating";
		if (status === "required") return "admin-chip admin-chip-status-escalated";
		return "admin-chip";
	};

	return (
		<AdminShell
			title="AI system inventory"
			subtitle="Register, classify, and track all AI systems used across the institution"
			breadcrumb="Admin · Governance"
			actions={
				<>
					<button type="button" className="ghost-btn" onClick={() => exportInventoryCsv(filtered)}>
						Export CSV
					</button>
					<button type="button" className="ghost-btn" onClick={() => void load()}>
						Refresh
					</button>
				</>
			}
		>
			{loading && <p className="muted">Loading inventory…</p>}
			{error && <div className="banner banner-error">{error}</div>}

			{stats && (
				<section className="admin-stats">
					<AdminStatCard label="Total" value={stats.total} />
					<AdminStatCard label="Active" value={stats.active} accent="success" />
					<AdminStatCard label="High risk" value={stats.highRisk} accent="danger" />
					<AdminStatCard label="Restricted" value={stats.restricted} accent="warning" />
					<AdminStatCard label="DPIA pending" value={stats.dpiaPending} accent="warning" />
					<AdminStatCard label="DPIA overdue" value={stats.dpiaOverdue} accent="danger" />
				</section>
			)}

			<AdminPanel title="Risk tier distribution" description="Breakdown of AI systems by risk classification">
				<div className="admin-table-scroll">
					<table className="admin-simple-table">
						<thead>
							<tr>
								<th>Risk tier</th>
								<th>Count</th>
								<th>Distribution</th>
							</tr>
						</thead>
						<tbody>
							{RISK_TIERS.map((tier) => {
								const count = riskDistribution[tier] ?? 0;
								const pct = systems.length > 0 ? Math.round((count / systems.length) * 100) : 0;
								return (
									<tr key={tier}>
										<td>
											<span className={`admin-sev admin-sev-${tier === "minimal" ? "low" : tier}`}>
												{tier}
											</span>
										</td>
										<td>{count}</td>
										<td>
											<span className="muted">{pct}%</span>
											<div
												style={{
													height: 6,
													borderRadius: 3,
													background: "var(--border-color, #e2e8f0)",
													marginTop: 4,
												}}
											>
												<div
													style={{
														height: "100%",
														width: `${pct}%`,
														borderRadius: 3,
														background:
															tier === "high"
																? "var(--danger, #ef4444)"
																: tier === "medium"
																	? "var(--warning, #f59e0b)"
																	: "var(--success, #22c55e)",
													}}
												/>
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</AdminPanel>

			<div className="admin-gov-grid">
				<AdminPanel title="Register system" description="Add an AI system to the institutional inventory">
					<div className="admin-form-grid">
						<label>
							Name
							<input
								className="topic-input"
								value={form.name}
								onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
							/>
						</label>
						<label>
							Vendor
							<input
								className="topic-input"
								value={form.vendor}
								onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
							/>
						</label>
						<label className="admin-form-span">
							Purpose
							<input
								className="topic-input"
								value={form.purpose}
								onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
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
									<option key={c} value={c}>{c}</option>
								))}
							</select>
						</label>
						<label>
							Deployment
							<select
								className="topic-input"
								value={form.deployment}
								onChange={(e) => setForm((f) => ({ ...f, deployment: e.target.value }))}
							>
								{DEPLOYMENTS.map((d) => (
									<option key={d} value={d}>
										{d.replace(/_/g, " ")}
									</option>
								))}
							</select>
						</label>
						<label>
							Risk tier
							<select
								className="topic-input"
								value={form.riskTier}
								onChange={(e) => setForm((f) => ({ ...f, riskTier: e.target.value }))}
							>
								{RISK_TIERS.map((t) => (
									<option key={t} value={t}>{t}</option>
								))}
							</select>
						</label>
						<label>
							Status
							<select
								className="topic-input"
								value={form.status}
								onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
							>
								{SYSTEM_STATUSES.map((s) => (
									<option key={s} value={s}>
										{STATUS_LABELS[s] ?? s}
									</option>
								))}
							</select>
						</label>
						<label>
							Owner
							<input
								className="topic-input"
								value={form.ownerName}
								onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
							/>
						</label>
						<label className="admin-form-span">
							Data classes
							<input
								className="topic-input"
								value={form.dataClasses}
								onChange={(e) => setForm((f) => ({ ...f, dataClasses: e.target.value }))}
								placeholder="Comma-separated, e.g. personal, academic, research"
							/>
						</label>
						<label className="admin-form-span">
							Faculties allowed
							<input
								className="topic-input"
								value={form.facultiesAllowed}
								onChange={(e) => setForm((f) => ({ ...f, facultiesAllowed: e.target.value }))}
								placeholder="Comma-separated faculty names (empty = all)"
							/>
						</label>
						<label className="admin-form-span">
							Roles allowed
							<input
								className="topic-input"
								value={form.rolesAllowed}
								onChange={(e) => setForm((f) => ({ ...f, rolesAllowed: e.target.value }))}
								placeholder="Comma-separated roles (empty = all)"
							/>
						</label>
						<label>
							DPIA required
							<select
								className="topic-input"
								value={form.dpiaRequired ? "yes" : "no"}
								onChange={(e) =>
									setForm((f) => ({
										...f,
										dpiaRequired: e.target.value === "yes",
										dpiaStatus: e.target.value === "yes" ? "required" : "not_required",
									}))
								}
							>
								<option value="no">No</option>
								<option value="yes">Yes</option>
							</select>
						</label>
						<label>
							DPIA status
							<select
								className="topic-input"
								value={form.dpiaStatus}
								onChange={(e) => setForm((f) => ({ ...f, dpiaStatus: e.target.value }))}
							>
								{DPIA_STATUSES.map((s) => (
									<option key={s} value={s}>
										{DPIA_LABELS[s] ?? s}
									</option>
								))}
							</select>
						</label>
						<label className="admin-form-span">
							Notes
							<textarea
								className="topic-input"
								rows={2}
								value={form.notes}
								onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
							/>
						</label>
					</div>
					<button type="button" className="primary-btn" disabled={working} onClick={() => void onCreate()}>
						Register system
					</button>
				</AdminPanel>

				<AdminPanel title="Filters" description="Narrow the inventory view">
					<div className="admin-filters admin-form-grid">
						<label>
							Search
							<input
								className="topic-input"
								placeholder="Name, vendor, owner…"
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
								{SYSTEM_STATUSES.map((s) => (
									<option key={s} value={s}>
										{STATUS_LABELS[s] ?? s}
									</option>
								))}
							</select>
						</label>
						<label>
							Risk tier
							<select
								className="topic-input"
								value={riskTierFilter}
								onChange={(e) => setRiskTierFilter(e.target.value)}
							>
								<option value="">All</option>
								{RISK_TIERS.map((t) => (
									<option key={t} value={t}>{t}</option>
								))}
							</select>
						</label>
					</div>
				</AdminPanel>
			</div>

			<AdminPanel
				title="AI systems"
				description={`${filtered.length} of ${systems.length} systems`}
			>
				<div className="admin-table-scroll">
					<table className="admin-simple-table">
						<thead>
							<tr>
								<th>Name</th>
								<th>Vendor</th>
								<th>Category</th>
								<th>Risk tier</th>
								<th>Status</th>
								<th>DPIA</th>
								<th>Owner</th>
								<th>Last reviewed</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{filtered.length === 0 ? (
								<tr>
									<td colSpan={9} className="muted">
										No systems in this view.
									</td>
								</tr>
							) : (
								filtered.map((system) => (
									<tr key={system.id}>
										<td>
											<strong>{system.name}</strong>
											{system.purpose && (
												<p className="muted">{system.purpose.slice(0, 80)}</p>
											)}
										</td>
										<td>{system.vendor || "—"}</td>
										<td>{system.category}</td>
										<td>
											<span
												className={`admin-sev admin-sev-${
													system.riskTier === "minimal" ? "low" : system.riskTier
												}`}
											>
												{system.riskTier}
											</span>
										</td>
										<td>
											<span className={`admin-chip admin-chip-status-${system.status === "active" ? "closed" : system.status === "restricted" ? "open" : system.status}`}>
												{STATUS_LABELS[system.status] ?? system.status}
											</span>
										</td>
										<td>
											<span className={dpiaChipClass(system.dpiaStatus)}>
												{DPIA_LABELS[system.dpiaStatus] ?? system.dpiaStatus}
											</span>
										</td>
										<td>{system.ownerName || "—"}</td>
										<td>{formatAdminDate(system.lastReviewedAt)}</td>
										<td className="admin-row-actions">
											<button
												type="button"
												className="ghost-btn"
												disabled={working}
												onClick={() => void onEdit(system)}
											>
												Edit
											</button>
											<button
												type="button"
												className="ghost-btn"
												disabled={working}
												onClick={() => void onUpdateStatus(system)}
											>
												Update status
											</button>
											<button
												type="button"
												className="ghost-btn"
												disabled={working}
												onClick={() => void onDelete(system)}
											>
												Delete
											</button>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</AdminPanel>
		</AdminShell>
	);
}
