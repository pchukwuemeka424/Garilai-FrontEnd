"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminPanel, AdminShell, AdminStatCard, formatAdminDate } from "@/components/admin/AdminShell";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { useAdminUserQuery, matchesAdminUserQuery } from "@/hooks/useAdminUserQuery";
import {
	createAdminCompliance,
	deleteAdminCompliance,
	fetchAdminCompliance,
	updateAdminCompliance,
} from "@/lib/admin-api";
import type { ComplianceControlRecord, ComplianceStats } from "@/lib/admin-governance";

const FRAMEWORKS = ["NDPR", "EU AI Act", "ISO 42001", "Nigeria AI Act"] as const;

const CONTROL_STATUSES = ["compliant", "gap", "in_progress", "not_started"] as const;

const PRIORITIES = ["critical", "high", "medium", "low"] as const;

const STATUS_LABELS: Record<string, string> = {
	compliant: "Compliant",
	gap: "Gap",
	in_progress: "In progress",
	not_started: "Not started",
};

const emptyForm = {
	code: "",
	title: "",
	description: "",
	framework: "NDPR",
	domain: "",
	status: "not_started",
	evidence: "",
	ownerName: "",
	priority: "medium",
	nextReviewAt: "",
};

function exportComplianceCsv(controls: ComplianceControlRecord[]) {
	const headers = [
		"ID", "Code", "Title", "Framework", "Domain", "Status",
		"Priority", "Owner", "Evidence", "Last Assessed", "Next Review", "Created",
	];
	const rows = controls.map((c) => [
		c.id, c.code, c.title, c.framework, c.domain, c.status,
		c.priority, c.ownerName, c.evidence,
		c.lastAssessedAt ?? "", c.nextReviewAt ?? "", c.createdAt,
	]);
	const csv = [headers, ...rows]
		.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
		.join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `compliance-controls-${new Date().toISOString().slice(0, 10)}.csv`;
	link.click();
	URL.revokeObjectURL(url);
}

export function AdminComplianceDashboard() {
	const { ready } = useAdminGuard();
	const [controls, setControls] = useState<ComplianceControlRecord[]>([]);
	const [stats, setStats] = useState<ComplianceStats | null>(null);
	const [frameworkFilter, setFrameworkFilter] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [search, setSearch] = useAdminUserQuery();
	const [form, setForm] = useState(emptyForm);
	const [loading, setLoading] = useState(true);
	const [working, setWorking] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			const data = await fetchAdminCompliance({
				framework: frameworkFilter || undefined,
				status: statusFilter || undefined,
			});
			setControls(data.controls);
			setStats(data.stats);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [frameworkFilter, statusFilter]);

	useEffect(() => {
		if (ready) void load();
	}, [load, ready]);

	const filtered = useMemo(() => {
		return controls.filter((c) =>
			matchesAdminUserQuery(search, [
				c.code, c.title, c.ownerName, c.domain, c.framework, c.id,
			]),
		);
	}, [controls, search]);

	const onCreate = async () => {
		if (!form.code.trim() || !form.title.trim()) {
			setError("Code and title are required.");
			return;
		}
		setWorking(true);
		setError(null);
		try {
			await createAdminCompliance({
				...form,
				nextReviewAt: form.nextReviewAt || undefined,
			});
			setForm(emptyForm);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onUpdateStatus = async (control: ComplianceControlRecord) => {
		const status = window.prompt(
			"Status (compliant, gap, in_progress, not_started)",
			control.status,
		)?.trim();
		if (!status || !CONTROL_STATUSES.includes(status as typeof CONTROL_STATUSES[number])) return;
		setWorking(true);
		setError(null);
		try {
			await updateAdminCompliance(control.id, { status });
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onEdit = async (control: ComplianceControlRecord) => {
		const evidence = window.prompt("Evidence notes", control.evidence)?.trim();
		if (evidence === null || evidence === undefined) return;
		setWorking(true);
		setError(null);
		try {
			await updateAdminCompliance(control.id, { evidence });
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onDelete = async (control: ComplianceControlRecord) => {
		if (!window.confirm(`Delete control "${control.code} — ${control.title}"?`)) return;
		setWorking(true);
		setError(null);
		try {
			await deleteAdminCompliance(control.id);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const statusChipClass = (status: string) => {
		if (status === "compliant") return "admin-chip admin-chip-status-closed";
		if (status === "gap") return "admin-chip admin-chip-status-open";
		if (status === "in_progress") return "admin-chip admin-chip-status-investigating";
		return "admin-chip";
	};

	return (
		<AdminShell
			title="Compliance controls"
			subtitle="Map, assess, and track compliance across regulatory frameworks"
			breadcrumb="Admin · Governance"
			actions={
				<>
					<button type="button" className="ghost-btn" onClick={() => exportComplianceCsv(filtered)}>
						Export CSV
					</button>
					<button type="button" className="ghost-btn" onClick={() => void load()}>
						Refresh
					</button>
				</>
			}
		>
			{loading && <p className="muted">Loading compliance controls…</p>}
			{error && <div className="banner banner-error">{error}</div>}

			{stats && (
				<section className="admin-stats">
					<AdminStatCard label="Total" value={stats.total} />
					<AdminStatCard label="Compliant" value={stats.compliant} accent="success" />
					<AdminStatCard label="Gaps" value={stats.gap} accent="danger" />
					<AdminStatCard label="In progress" value={stats.inProgress} accent="warning" />
					<AdminStatCard label="Not started" value={stats.notStarted} />
					<AdminStatCard label="Critical gaps" value={stats.criticalGaps} accent="danger" />
					<AdminStatCard
						label="Score"
						value={`${stats.score}%`}
						accent={stats.score >= 80 ? "success" : stats.score >= 50 ? "warning" : "danger"}
					/>
				</section>
			)}

			{stats?.byFramework && Object.keys(stats.byFramework).length > 0 && (
				<AdminPanel title="Framework compliance" description="Per-framework compliance score breakdown">
					<div className="admin-table-scroll">
						<table className="admin-simple-table">
							<thead>
								<tr>
									<th>Framework</th>
									<th>Total</th>
									<th>Compliant</th>
									<th>Gaps</th>
									<th>Score</th>
								</tr>
							</thead>
							<tbody>
								{Object.entries(stats.byFramework).map(([fw, data]) => {
									const pct = data.total > 0 ? Math.round((data.compliant / data.total) * 100) : 0;
									return (
										<tr key={fw}>
											<td><strong>{fw}</strong></td>
											<td>{data.total}</td>
											<td>{data.compliant}</td>
											<td>{data.gap}</td>
											<td>
												<span
													className={`admin-sev admin-sev-${
														pct >= 80 ? "low" : pct >= 50 ? "medium" : "critical"
													}`}
												>
													{pct}%
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

			<AdminPanel title="Framework filter" description="View controls by regulatory framework">
				<div className="admin-filters admin-filter-wrap">
					<button
						type="button"
						className={`ghost-btn${frameworkFilter === "" ? " admin-filter-active" : ""}`}
						onClick={() => setFrameworkFilter("")}
					>
						All
					</button>
					{FRAMEWORKS.map((fw) => (
						<button
							key={fw}
							type="button"
							className={`ghost-btn${frameworkFilter === fw ? " admin-filter-active" : ""}`}
							onClick={() => setFrameworkFilter(fw)}
						>
							{fw}
						</button>
					))}
				</div>
			</AdminPanel>

			<div className="admin-gov-grid">
				<AdminPanel title="Add control" description="Map a new compliance control to a framework">
					<div className="admin-form-grid">
						<label>
							Code
							<input
								className="topic-input"
								value={form.code}
								onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
								placeholder="e.g. NDPR-3.1"
							/>
						</label>
						<label>
							Title
							<input
								className="topic-input"
								value={form.title}
								onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
							/>
						</label>
						<label>
							Framework
							<select
								className="topic-input"
								value={form.framework}
								onChange={(e) => setForm((f) => ({ ...f, framework: e.target.value }))}
							>
								{FRAMEWORKS.map((fw) => (
									<option key={fw} value={fw}>{fw}</option>
								))}
							</select>
						</label>
						<label>
							Domain
							<input
								className="topic-input"
								value={form.domain}
								onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
								placeholder="e.g. Data Protection"
							/>
						</label>
						<label>
							Status
							<select
								className="topic-input"
								value={form.status}
								onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
							>
								{CONTROL_STATUSES.map((s) => (
									<option key={s} value={s}>
										{STATUS_LABELS[s] ?? s}
									</option>
								))}
							</select>
						</label>
						<label>
							Priority
							<select
								className="topic-input"
								value={form.priority}
								onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
							>
								{PRIORITIES.map((p) => (
									<option key={p} value={p}>{p}</option>
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
						<label>
							Next review
							<input
								className="topic-input"
								type="date"
								value={form.nextReviewAt}
								onChange={(e) => setForm((f) => ({ ...f, nextReviewAt: e.target.value }))}
							/>
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
						<label className="admin-form-span">
							Evidence
							<textarea
								className="topic-input"
								rows={2}
								value={form.evidence}
								onChange={(e) => setForm((f) => ({ ...f, evidence: e.target.value }))}
								placeholder="Links, documents, or assessment notes"
							/>
						</label>
					</div>
					<button type="button" className="primary-btn" disabled={working} onClick={() => void onCreate()}>
						Add control
					</button>
				</AdminPanel>

				<AdminPanel title="Filters" description="Search and filter controls">
					<div className="admin-filters admin-form-grid">
						<label>
							Search
							<input
								className="topic-input"
								placeholder="Code, title, owner…"
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
								{CONTROL_STATUSES.map((s) => (
									<option key={s} value={s}>
										{STATUS_LABELS[s] ?? s}
									</option>
								))}
							</select>
						</label>
					</div>
				</AdminPanel>
			</div>

			<AdminPanel
				title="Controls"
				description={`${filtered.length} of ${controls.length} controls`}
			>
				<div className="admin-table-scroll">
					<table className="admin-simple-table">
						<thead>
							<tr>
								<th>Code</th>
								<th>Title</th>
								<th>Framework</th>
								<th>Domain</th>
								<th>Status</th>
								<th>Priority</th>
								<th>Owner</th>
								<th>Last assessed</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{filtered.length === 0 ? (
								<tr>
									<td colSpan={9} className="muted">
										No controls in this view.
									</td>
								</tr>
							) : (
								filtered.map((control) => (
									<tr key={control.id}>
										<td><code>{control.code}</code></td>
										<td>
											<strong>{control.title}</strong>
											{control.description && (
												<p className="muted">{control.description.slice(0, 80)}</p>
											)}
										</td>
										<td>{control.framework}</td>
										<td>{control.domain || "—"}</td>
										<td>
											<span className={statusChipClass(control.status)}>
												{STATUS_LABELS[control.status] ?? control.status}
											</span>
										</td>
										<td>
											<span className={`admin-sev admin-sev-${control.priority === "critical" ? "critical" : control.priority}`}>
												{control.priority}
											</span>
										</td>
										<td>{control.ownerName || "—"}</td>
										<td>{formatAdminDate(control.lastAssessedAt)}</td>
										<td className="admin-row-actions">
											<button
												type="button"
												className="ghost-btn"
												disabled={working}
												onClick={() => void onUpdateStatus(control)}
											>
												Update status
											</button>
											<button
												type="button"
												className="ghost-btn"
												disabled={working}
												onClick={() => void onEdit(control)}
											>
												Edit evidence
											</button>
											<button
												type="button"
												className="ghost-btn"
												disabled={working}
												onClick={() => void onDelete(control)}
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
