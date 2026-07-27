"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminPanel, AdminShell, AdminStatCard, formatAdminDate } from "@/components/admin/AdminShell";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import {
	exportGovernanceReportText,
	fetchAdminReport,
	fetchAdminReports,
	generateAdminReport,
} from "@/lib/admin-api";
import type { GovernanceReportAudience, GovernanceReportRecord } from "@/lib/admin-governance";

type ReportType =
	| "executive_summary"
	| "compliance_status"
	| "incident_summary"
	| "usage_statistics"
	| "policy_effectiveness"
	| "token_consumption"
	| "risk_posture";

type ReportFormat = "pdf" | "docx" | "csv";
type ReportStatus = "draft" | "review" | "approved" | "published";

type ExtendedAudience = GovernanceReportAudience | "external_auditors" | "regulatory";

const REPORT_TYPE_OPTIONS: Array<{ value: ReportType; label: string }> = [
	{ value: "executive_summary", label: "Executive Summary" },
	{ value: "compliance_status", label: "Compliance Status" },
	{ value: "incident_summary", label: "Incident Summary" },
	{ value: "usage_statistics", label: "Usage Statistics" },
	{ value: "policy_effectiveness", label: "Policy Effectiveness" },
	{ value: "token_consumption", label: "Token Consumption" },
	{ value: "risk_posture", label: "Risk Posture" },
];

const AUDIENCE_OPTIONS: Array<{ value: ExtendedAudience; label: string }> = [
	{ value: "management", label: "Management" },
	{ value: "senate", label: "Senate" },
	{ value: "both", label: "Management & Senate" },
	{ value: "external_auditors", label: "External Auditors" },
	{ value: "regulatory", label: "Regulatory Bodies" },
];

const STATUS_FLOW: ReportStatus[] = ["draft", "review", "approved", "published"];

const SCHEDULED_REPORTS = [
	{ name: "Weekly Usage Summary", frequency: "Weekly (Monday)", audience: "management", status: "active" },
	{ name: "Monthly Compliance Report", frequency: "Monthly (1st)", audience: "senate", status: "active" },
	{ name: "Quarterly Risk Posture", frequency: "Quarterly", audience: "both", status: "paused" },
];

function downloadBlob(content: string, filename: string, mime: string) {
	const blob = new Blob([content], { type: mime });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

function reportToCsv(report: GovernanceReportRecord): string {
	const rows: string[][] = [
		["Title", report.title],
		["Audience", report.audience],
		["Period start", report.periodStart],
		["Period end", report.periodEnd],
		["Status", report.status],
		["Generated", report.createdAt],
		["Prepared by", report.generatedByName ?? ""],
		[],
		["Section", "Body"],
		["Summary", report.summary],
		...report.sections.map((s) => [s.heading, s.body]),
	];
	return rows
		.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
		.join("\n");
}

function exportFullReport(report: GovernanceReportRecord) {
	const lines = [
		report.title,
		"=".repeat(report.title.length),
		"",
		`Audience: ${report.audience}`,
		`Period: ${report.periodStart.slice(0, 10)} — ${report.periodEnd.slice(0, 10)}`,
		`Status: ${report.status}`,
		`Generated: ${formatAdminDate(report.createdAt)}`,
		report.generatedByName ? `Prepared by: ${report.generatedByName}` : "",
		"",
		"SUMMARY",
		"-".repeat(40),
		report.summary,
		"",
		...report.sections.flatMap((s) => [
			s.heading.toUpperCase(),
			"-".repeat(40),
			s.body,
			"",
		]),
	];
	const stamp = report.createdAt.slice(0, 10);
	downloadBlob(lines.join("\n"), `governance-report-${report.audience}-${stamp}.txt`, "text/plain;charset=utf-8;");
}

function statusAccent(status: string): "primary" | "success" | "warning" | "danger" | undefined {
	if (status === "published") return "success";
	if (status === "approved") return "primary";
	if (status === "review") return "warning";
	return undefined;
}

function nextStatus(current: string): ReportStatus | null {
	const idx = STATUS_FLOW.indexOf(current as ReportStatus);
	if (idx < 0 || idx >= STATUS_FLOW.length - 1) return null;
	return STATUS_FLOW[idx + 1];
}

function prevStatus(current: string): ReportStatus | null {
	const idx = STATUS_FLOW.indexOf(current as ReportStatus);
	if (idx <= 0) return null;
	return STATUS_FLOW[idx - 1];
}

export function AdminReportsDashboard() {
	const { ready } = useAdminGuard();
	const [reports, setReports] = useState<GovernanceReportRecord[]>([]);
	const [selected, setSelected] = useState<GovernanceReportRecord | null>(null);
	const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
	const [loading, setLoading] = useState(true);
	const [working, setWorking] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [reportType, setReportType] = useState<ReportType>("executive_summary");
	const [format, setFormat] = useState<ReportFormat>("pdf");
	const [audience, setAudience] = useState<ExtendedAudience>("both");
	const [periodStart, setPeriodStart] = useState("");
	const [periodEnd, setPeriodEnd] = useState("");
	const [faculty, setFaculty] = useState("");
	const [department, setDepartment] = useState("");

	const load = useCallback(async () => {
		setError(null);
		try {
			const list = await fetchAdminReports();
			setReports(list);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (ready) void load();
	}, [load, ready]);

	const now = new Date();
	const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
	const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

	const totalReports = reports.length;
	const thisMonth = reports.filter((r) => new Date(r.createdAt) >= monthStart).length;
	const thisQuarter = reports.filter((r) => new Date(r.createdAt) >= quarterStart).length;

	const byAudience = useMemo(() => {
		const counts: Record<string, number> = {};
		for (const r of reports) {
			counts[r.audience] = (counts[r.audience] ?? 0) + 1;
		}
		return counts;
	}, [reports]);

	const byStatus = useMemo(() => {
		const counts: Record<string, number> = {};
		for (const r of reports) {
			counts[r.status] = (counts[r.status] ?? 0) + 1;
		}
		return counts;
	}, [reports]);

	const onGenerate = async () => {
		setWorking(true);
		setError(null);
		try {
			const apiAudience: GovernanceReportAudience =
				audience === "external_auditors" || audience === "regulatory" ? "both" : audience;
			const report = await generateAdminReport({
				audience: apiAudience,
				reportType,
				format,
				periodStart: periodStart || undefined,
				periodEnd: periodEnd || undefined,
				faculty: faculty || undefined,
				department: department || undefined,
			});
			setSelected(report);
			setExpandedSections(new Set(["summary", ...report.sections.map((s) => s.heading)]));
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onOpen = async (id: string) => {
		setWorking(true);
		setError(null);
		try {
			const report = await fetchAdminReport(id);
			setSelected(report);
			setExpandedSections(new Set(["summary", ...report.sections.map((s) => s.heading)]));
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const toggleSection = (key: string) => {
		setExpandedSections((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	};

	return (
		<AdminShell
			title="Governance Reports"
			subtitle="Generate, review, and publish governance reports for stakeholders"
			breadcrumb="Admin · Reports"
			actions={
				<button type="button" className="ghost-btn" onClick={() => void load()}>
					Refresh
				</button>
			}
		>
			{loading && <p className="muted">Loading reports…</p>}
			{error && <div className="banner banner-error">{error}</div>}

			{/* Stat Cards */}
			<section className="admin-stats">
				<AdminStatCard label="Total Reports" value={totalReports} accent="primary" />
				<AdminStatCard label="This Month" value={thisMonth} />
				<AdminStatCard label="This Quarter" value={thisQuarter} />
				<AdminStatCard label="Management" value={byAudience["management"] ?? 0} />
				<AdminStatCard label="Senate" value={byAudience["senate"] ?? 0} />
				<AdminStatCard label="Both" value={byAudience["both"] ?? 0} />
			</section>

			<div className="admin-gov-grid">
				{/* Generate Report Form */}
				<AdminPanel title="Generate Report" description="Configure report parameters and generate">
					<div className="admin-form-grid">
						<label>
							Audience
							<select
								className="topic-input"
								value={audience}
								onChange={(e) => setAudience(e.target.value as ExtendedAudience)}
							>
								{AUDIENCE_OPTIONS.map((opt) => (
									<option key={opt.value} value={opt.value}>{opt.label}</option>
								))}
							</select>
						</label>
						<label>
							Report Type
							<select
								className="topic-input"
								value={reportType}
								onChange={(e) => setReportType(e.target.value as ReportType)}
							>
								{REPORT_TYPE_OPTIONS.map((opt) => (
									<option key={opt.value} value={opt.value}>{opt.label}</option>
								))}
							</select>
						</label>
						<label>
							Format
							<select
								className="topic-input"
								value={format}
								onChange={(e) => setFormat(e.target.value as ReportFormat)}
							>
								<option value="pdf">PDF</option>
								<option value="docx">DOCX</option>
								<option value="csv">CSV</option>
							</select>
						</label>
						<label>
							Period Start
							<input
								type="date"
								className="topic-input"
								value={periodStart}
								onChange={(e) => setPeriodStart(e.target.value)}
							/>
						</label>
						<label>
							Period End
							<input
								type="date"
								className="topic-input"
								value={periodEnd}
								onChange={(e) => setPeriodEnd(e.target.value)}
							/>
						</label>
						<label>
							Faculty (optional)
							<input
								className="topic-input"
								placeholder="All faculties"
								value={faculty}
								onChange={(e) => setFaculty(e.target.value)}
							/>
						</label>
						<label>
							Department (optional)
							<input
								className="topic-input"
								placeholder="All departments"
								value={department}
								onChange={(e) => setDepartment(e.target.value)}
							/>
						</label>
					</div>
					<div style={{ marginTop: "1rem" }}>
						<button
							type="button"
							className="primary-btn"
							disabled={working}
							onClick={() => void onGenerate()}
						>
							{working ? "Generating…" : "Generate Report"}
						</button>
					</div>
				</AdminPanel>

				{/* Scheduled Reports (Placeholder) */}
				<AdminPanel title="Scheduled Reports" description="Auto-generation schedules (placeholder — configuration coming soon)">
					<div className="admin-table-scroll">
						<table className="admin-simple-table">
							<thead>
								<tr>
									<th>Report</th>
									<th>Frequency</th>
									<th>Audience</th>
									<th>Status</th>
								</tr>
							</thead>
							<tbody>
								{SCHEDULED_REPORTS.map((sr) => (
									<tr key={sr.name}>
										<td><strong>{sr.name}</strong></td>
										<td>{sr.frequency}</td>
										<td><span className="admin-chip">{sr.audience}</span></td>
										<td>
											<span className={`admin-chip ${sr.status === "active" ? "admin-sev-low" : ""}`}>
												{sr.status}
											</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<p className="muted" style={{ marginTop: "0.5rem" }}>
						Scheduled report generation will be configurable in a future release. Contact governance admins to set up recurring reports.
					</p>
				</AdminPanel>
			</div>

			{/* Comparative Periods Hint */}
			<AdminPanel title="Comparative Analysis" description="Period-over-period comparison">
				<section className="admin-stats">
					<AdminStatCard label="Current Quarter" value={thisQuarter} hint="Reports generated" />
					<AdminStatCard
						label="Previous Quarter"
						value={reports.filter((r) => {
							const d = new Date(r.createdAt);
							const pqStart = new Date(quarterStart);
							pqStart.setMonth(pqStart.getMonth() - 3);
							return d >= pqStart && d < quarterStart;
						}).length}
						hint="Reports generated"
					/>
				</section>
				<p className="muted">
					Full comparative analytics (Q2 vs Q1, YoY) will be available when historical data accumulates. Generate reports consistently to enable trend analysis.
				</p>
			</AdminPanel>

			{/* Report Listing Table */}
			<AdminPanel
				title="Report History"
				description={`${totalReports} report(s) generated`}
			>
				{reports.length === 0 ? (
					<p className="muted">No reports generated yet. Use the form above to create your first report.</p>
				) : (
					<div className="admin-table-scroll">
						<table className="admin-simple-table">
							<thead>
								<tr>
									<th>Title</th>
									<th>Audience</th>
									<th>Period</th>
									<th>Status</th>
									<th>Generated By</th>
									<th>Created</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{reports.map((report) => (
									<tr
										key={report.id}
										className={selected?.id === report.id ? "admin-row-flagged" : undefined}
									>
										<td>
											<button
												type="button"
												className="admin-link-btn"
												onClick={() => void onOpen(report.id)}
											>
												{report.title}
											</button>
										</td>
										<td><span className="admin-chip">{report.audience}</span></td>
										<td className="muted">
											{report.periodStart.slice(0, 10)} — {report.periodEnd.slice(0, 10)}
										</td>
										<td>
											<span className={`admin-chip${statusAccent(report.status) ? ` admin-sev-${report.status === "published" ? "low" : report.status === "approved" ? "medium" : "high"}` : ""}`}>
												{report.status}
											</span>
										</td>
										<td>{report.generatedByName ?? "—"}</td>
										<td className="muted">{formatAdminDate(report.createdAt)}</td>
										<td>
											<button type="button" className="ghost-btn" onClick={() => void onOpen(report.id)}>
												View
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</AdminPanel>

			{/* Report Detail View */}
			{selected && (
				<AdminPanel
					title={selected.title}
					description={`${selected.periodStart.slice(0, 10)} — ${selected.periodEnd.slice(0, 10)} · ${selected.status}`}
					actions={
						<>
							{/* Approval Workflow */}
							{prevStatus(selected.status) && (
								<button
									type="button"
									className="ghost-btn"
									onClick={() => {
										const prev = prevStatus(selected.status);
										if (prev) setSelected({ ...selected, status: prev });
									}}
								>
									← {prevStatus(selected.status)}
								</button>
							)}
							{nextStatus(selected.status) && (
								<button
									type="button"
									className="primary-btn"
									onClick={() => {
										const next = nextStatus(selected.status);
										if (next) setSelected({ ...selected, status: next });
									}}
								>
									Advance to {nextStatus(selected.status)} →
								</button>
							)}
							<button
								type="button"
								className="ghost-btn"
								onClick={() => exportGovernanceReportText(selected)}
							>
								Download Text
							</button>
							<button
								type="button"
								className="ghost-btn"
								onClick={() => exportFullReport(selected)}
							>
								Export Full Report
							</button>
							<button
								type="button"
								className="ghost-btn"
								onClick={() => {
									downloadBlob(
										reportToCsv(selected),
										`report-${selected.createdAt.slice(0, 10)}.csv`,
										"text/csv;charset=utf-8;",
									);
								}}
							>
								Export CSV
							</button>
						</>
					}
				>
					{/* Status Workflow Indicator */}
					<div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
						{STATUS_FLOW.map((s, i) => {
							const isActive = s === selected.status;
							const isPast = STATUS_FLOW.indexOf(selected.status as ReportStatus) > i;
							return (
								<span key={s} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
									<span
										className={`admin-chip${isActive ? " admin-sev-medium" : isPast ? " admin-sev-low" : ""}`}
									>
										{s}
									</span>
									{i < STATUS_FLOW.length - 1 && <span className="muted">→</span>}
								</span>
							);
						})}
					</div>

					{/* Expandable Sections */}
					<div className="admin-report-body">
						{/* Summary */}
						<section>
							<button
								type="button"
								className="admin-link-btn"
								onClick={() => toggleSection("summary")}
								style={{ fontWeight: 600, fontSize: "1.05rem" }}
							>
								{expandedSections.has("summary") ? "▾" : "▸"} Summary
							</button>
							{expandedSections.has("summary") && (
								<p style={{ marginTop: "0.5rem" }}>{selected.summary}</p>
							)}
						</section>

						{/* Report Sections */}
						{selected.sections.map((section) => (
							<section key={section.heading}>
								<button
									type="button"
									className="admin-link-btn"
									onClick={() => toggleSection(section.heading)}
									style={{ fontWeight: 600, fontSize: "1.05rem" }}
								>
									{expandedSections.has(section.heading) ? "▾" : "▸"} {section.heading}
								</button>
								{expandedSections.has(section.heading) && (
									<p style={{ marginTop: "0.5rem" }}>{section.body}</p>
								)}
							</section>
						))}

						{selected.generatedByName && (
							<p className="muted" style={{ marginTop: "1rem" }}>
								Prepared by {selected.generatedByName} · {formatAdminDate(selected.createdAt)}
							</p>
						)}
					</div>
				</AdminPanel>
			)}

			{/* By Status Breakdown */}
			{Object.keys(byStatus).length > 0 && (
				<AdminPanel title="Reports by Status">
					<section className="admin-stats">
						{STATUS_FLOW.map((s) => (
							<AdminStatCard
								key={s}
								label={s.charAt(0).toUpperCase() + s.slice(1)}
								value={byStatus[s] ?? 0}
								accent={statusAccent(s)}
							/>
						))}
					</section>
				</AdminPanel>
			)}
		</AdminShell>
	);
}
