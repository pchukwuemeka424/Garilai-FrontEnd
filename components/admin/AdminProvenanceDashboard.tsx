"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
	AdminPanel,
	AdminShell,
	AdminStatCard,
	formatAdminDate,
} from "@/components/admin/AdminShell";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import {
	createAdminProvenance,
	fetchAdminProvenance,
	updateAdminProvenance,
} from "@/lib/admin-api";
import type {
	ProvenanceEvent,
	ProvenanceStats,
	ResearchProvenanceRecord,
} from "@/lib/admin-governance";

const OUTPUT_TYPES = ["thesis", "paper", "assignment", "report", "other"] as const;
const STATUSES = ["available", "under_review", "cleared", "escalated"] as const;

const emptyForm = {
	outputRef: "",
	outputTitle: "",
	outputType: "paper" as string,
	ownerName: "",
	ownerEmail: "",
	faculty: "",
	department: "",
	eventAction: "ai_generate",
	eventTool: "GARIL AI",
	eventModel: "",
	eventSummary: "",
};

function statusAccent(status: string | null | undefined) {
	if (status === "cleared") return "permitted";
	if (status === "escalated") return "blocked";
	if (status === "under_review") return "restricted";
	return "restricted";
}

function statusLabel(status: string | null | undefined) {
	return (status ?? "available").replace(/_/g, " ");
}

function safeEvents(row: ResearchProvenanceRecord) {
	return Array.isArray(row.events) ? row.events : [];
}

function exportProvenanceCsv(rows: ResearchProvenanceRecord[]) {
	const headers = [
		"ID",
		"Output Title",
		"Output Type",
		"Owner",
		"Faculty",
		"Status",
		"Events",
		"Privacy Redacted",
		"Reviewed By",
		"Created At",
	];
	const lines = rows.map((r) =>
		[
			r.id,
			r.outputTitle,
			r.outputType,
			r.ownerName,
			r.faculty ?? "",
			r.status ?? "available",
			String(safeEvents(r).length),
			r.privacyRedacted ? "Yes" : "No",
			r.reviewedByName || "",
			r.createdAt,
		]
			.map((c) => `"${String(c).replace(/"/g, '""')}"`)
			.join(","),
	);
	const csv = [headers.join(","), ...lines].join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `provenance-${new Date().toISOString().slice(0, 10)}.csv`;
	a.click();
	URL.revokeObjectURL(url);
}

function exportProvenanceReport(row: ResearchProvenanceRecord) {
	const body = [
		"Research Provenance Report",
		"==========================",
		`Record ID: ${row.id}`,
		`Output: ${row.outputTitle} (${row.outputType})`,
		`Reference: ${row.outputRef}`,
		`Owner: ${row.ownerName} <${row.ownerEmail}>`,
		`Faculty: ${row.faculty || "—"}`,
		`Department: ${row.department || "—"}`,
		`Status: ${statusLabel(row.status)}`,
		`Privacy redacted: ${row.privacyRedacted ? "Yes" : "No"}`,
		`Reviewed by: ${row.reviewedByName || "—"}`,
		`Reviewed at: ${row.reviewedAt || "—"}`,
		`Review notes: ${row.reviewNotes || "—"}`,
		`Access granted to: ${(row.accessGrantedTo ?? []).join(", ") || "—"}`,
		"",
		"Provenance Chain",
		"-----------------",
		...safeEvents(row).map(
			(e, i) =>
				`${i + 1}. [${e.at}] ${e.action ?? "event"} · ${e.agentOrTool || "—"} · model: ${e.model || "—"}\n   ${e.summary || "No summary"}${e.humanEdited ? " [human edited]" : ""}`,
		),
	].join("\n");
	const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `provenance-report-${row.id.slice(0, 8)}.txt`;
	a.click();
	URL.revokeObjectURL(url);
}

function ProvenanceTimeline({ events }: { events: ProvenanceEvent[] }) {
	if (!events.length) {
		return <p className="muted">No provenance events recorded for this output.</p>;
	}

	return (
		<div className="admin-audit-detail" style={{ position: "relative", paddingLeft: "1.5rem" }}>
			<div
				style={{
					position: "absolute",
					left: "0.65rem",
					top: "0.5rem",
					bottom: "0.5rem",
					width: "2px",
					background: "var(--border-color, #e2e8f0)",
				}}
			/>
			{events.map((event, idx) => (
				<div
					key={`${event.at}-${idx}`}
					style={{ position: "relative", paddingBottom: "1rem" }}
				>
					<div
						style={{
							position: "absolute",
							left: "-1.15rem",
							top: "0.35rem",
							width: "10px",
							height: "10px",
							borderRadius: "50%",
							background: event.humanEdited
								? "var(--accent-success, #22c55e)"
								: "var(--accent-primary, #3b82f6)",
							border: "2px solid var(--bg-card, #fff)",
						}}
					/>
					<p>
						<strong>{(event.action ?? "event").replace(/_/g, " ")}</strong>
						{event.agentOrTool && (
							<span className="muted"> · {event.agentOrTool}</span>
						)}
						{event.model && (
							<span className="muted"> · {event.model}</span>
						)}
						{event.humanEdited && (
							<span className="admin-chip admin-chip-permitted" style={{ marginLeft: "0.5rem" }}>
								human edited
							</span>
						)}
					</p>
					<p className="muted">
						{formatAdminDate(event.at)}
						{event.summary && ` — ${event.summary}`}
					</p>
				</div>
			))}
		</div>
	);
}

export function AdminProvenanceDashboard() {
	const { ready } = useAdminGuard();
	const [records, setRecords] = useState<ResearchProvenanceRecord[]>([]);
	const [stats, setStats] = useState<ProvenanceStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [working, setWorking] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [statusFilter, setStatusFilter] = useState("");
	const [typeFilter, setTypeFilter] = useState("");
	const [search, setSearch] = useState("");
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [showForm, setShowForm] = useState(false);
	const [form, setForm] = useState(emptyForm);

	const load = useCallback(async () => {
		setError(null);
		try {
			const data = await fetchAdminProvenance({
				status: statusFilter || undefined,
				outputType: typeFilter || undefined,
			});
			setRecords(data.records);
			setStats(data.stats);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [statusFilter, typeFilter]);

	useEffect(() => {
		if (ready) void load();
	}, [load, ready]);

	const filtered = useMemo(() => {
		if (!search.trim()) return records;
		const q = search.toLowerCase();
		return records.filter(
			(r) =>
				r.outputTitle.toLowerCase().includes(q) ||
				r.ownerName.toLowerCase().includes(q) ||
				(r.faculty ?? "").toLowerCase().includes(q),
		);
	}, [records, search]);

	const expanded = useMemo(
		() => (expandedId ? records.find((r) => r.id === expandedId) ?? null : null),
		[expandedId, records],
	);

	const review = async (id: string, status: string) => {
		const notes = window.prompt("Review notes:") ?? "";
		setWorking(true);
		try {
			await updateAdminProvenance(id, { status, reviewNotes: notes });
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const addReviewer = async (id: string) => {
		const email = window.prompt("Add reviewer email:");
		if (!email) return;
		const record = records.find((r) => r.id === id);
		if (!record) return;
		setWorking(true);
		try {
			await updateAdminProvenance(id, {
				accessGrantedTo: [...record.accessGrantedTo, email],
			});
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onCreate = async () => {
		if (!form.outputRef.trim()) {
			setError("Output reference is required.");
			return;
		}
		setWorking(true);
		setError(null);
		try {
			await createAdminProvenance({
				outputRef: form.outputRef,
				outputTitle: form.outputTitle.trim() || "Research output",
				outputType: form.outputType,
				ownerName: form.ownerName,
				ownerEmail: form.ownerEmail,
				faculty: form.faculty,
				department: form.department,
				events: [
					{
						action: form.eventAction,
						agentOrTool: form.eventTool,
						model: form.eventModel,
						summary: form.eventSummary || "Initial provenance event",
						humanEdited: false,
					},
				],
			});
			setForm(emptyForm);
			setShowForm(false);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	return (
		<AdminShell
			title="Research Provenance & Transparency"
			subtitle="Track AI-assisted research process chains for integrity and accountability"
			breadcrumb="Admin · Research integrity"
			actions={
				<>
					<button
						type="button"
						className="ghost-btn"
						disabled={!records.length}
						onClick={() => exportProvenanceCsv(filtered)}
					>
						Export CSV
					</button>
					<button
						type="button"
						className="ghost-btn"
						onClick={() => setShowForm((v) => !v)}
					>
						{showForm ? "Hide form" : "New record"}
					</button>
					<button type="button" className="ghost-btn" onClick={() => void load()}>
						Refresh
					</button>
				</>
			}
		>
			{loading && <p className="muted">Loading provenance records…</p>}
			{error && <div className="banner banner-error">{error}</div>}

			{stats && (
				<section className="admin-stats">
					<AdminStatCard label="Total" value={stats.total} accent="primary" />
					<AdminStatCard
						label="Under review"
						value={stats.underReview}
						accent="warning"
					/>
					<AdminStatCard label="Cleared" value={stats.cleared} accent="success" />
					<AdminStatCard
						label="Escalated"
						value={stats.escalated}
						accent={stats.escalated > 0 ? "danger" : undefined}
					/>
					<AdminStatCard label="Available" value={stats.available} accent="primary" />
				</section>
			)}

			{showForm && (
				<AdminPanel
					title="Register provenance"
					description="Record process metadata for a research output"
				>
					<div className="admin-form-grid">
						<label>
							Output reference
							<input
								className="topic-input"
								value={form.outputRef}
								onChange={(e) =>
									setForm((f) => ({ ...f, outputRef: e.target.value }))
								}
								placeholder="Record id — not the research title"
							/>
						</label>
						<label>
							Output type
							<select
								className="topic-input"
								value={form.outputType}
								onChange={(e) =>
									setForm((f) => ({ ...f, outputType: e.target.value }))
								}
							>
								{OUTPUT_TYPES.map((t) => (
									<option key={t} value={t}>
										{t}
									</option>
								))}
							</select>
						</label>
						<label>
							Owner name
							<input
								className="topic-input"
								value={form.ownerName}
								onChange={(e) =>
									setForm((f) => ({ ...f, ownerName: e.target.value }))
								}
							/>
						</label>
						<label>
							Owner email
							<input
								className="topic-input"
								value={form.ownerEmail}
								onChange={(e) =>
									setForm((f) => ({ ...f, ownerEmail: e.target.value }))
								}
							/>
						</label>
						<label>
							Faculty
							<input
								className="topic-input"
								value={form.faculty}
								onChange={(e) =>
									setForm((f) => ({ ...f, faculty: e.target.value }))
								}
							/>
						</label>
						<label>
							Tool / agent
							<input
								className="topic-input"
								value={form.eventTool}
								onChange={(e) =>
									setForm((f) => ({ ...f, eventTool: e.target.value }))
								}
							/>
						</label>
						<label>
							AI model
							<input
								className="topic-input"
								value={form.eventModel}
								onChange={(e) =>
									setForm((f) => ({ ...f, eventModel: e.target.value }))
								}
							/>
						</label>
						<label className="admin-form-span">
							Event summary
							<input
								className="topic-input"
								value={form.eventSummary}
								onChange={(e) =>
									setForm((f) => ({ ...f, eventSummary: e.target.value }))
								}
							/>
						</label>
					</div>
					<div className="admin-actions-row">
						<button
							type="button"
							className="primary-btn"
							disabled={working}
							onClick={() => void onCreate()}
						>
							Save provenance
						</button>
						<button
							type="button"
							className="ghost-btn"
							onClick={() => {
								setShowForm(false);
								setForm(emptyForm);
							}}
						>
							Cancel
						</button>
					</div>
				</AdminPanel>
			)}

			<AdminPanel title="Filters">
				<div className="admin-form-grid">
					<label>
						Status
						<select
							className="topic-input"
							value={statusFilter}
							onChange={(e) => setStatusFilter(e.target.value)}
						>
							<option value="">All</option>
							{STATUSES.map((s) => (
								<option key={s} value={s}>
									{s.replace(/_/g, " ")}
								</option>
							))}
						</select>
					</label>
					<label>
						Output type
						<select
							className="topic-input"
							value={typeFilter}
							onChange={(e) => setTypeFilter(e.target.value)}
						>
							<option value="">All types</option>
							{OUTPUT_TYPES.map((t) => (
								<option key={t} value={t}>
									{t}
								</option>
							))}
						</select>
					</label>
					<label>
						Search
						<input
							className="topic-input"
							placeholder="Title, owner, faculty…"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</label>
				</div>
			</AdminPanel>

			<div className="admin-gov-grid">
				<AdminPanel
					title="Provenance records"
					description={`${filtered.length.toLocaleString()} of ${records.length.toLocaleString()} records`}
				>
					<div className="admin-table-scroll">
						<table className="admin-simple-table">
							<thead>
								<tr>
									<th>Output title</th>
									<th>Type</th>
									<th>Owner</th>
									<th>Faculty</th>
									<th>Status</th>
									<th>Events</th>
									<th>Privacy</th>
									<th>Reviewed by</th>
									<th>Created</th>
									<th />
								</tr>
							</thead>
							<tbody>
								{filtered.length === 0 ? (
									<tr>
										<td colSpan={10} className="muted">
											No provenance records found.
										</td>
									</tr>
								) : (
									filtered.map((row) => (
										<tr
											key={row.id}
											className={
												expandedId === row.id
													? "admin-row-selected"
													: undefined
											}
										>
											<td>
												<strong>{row.outputTitle}</strong>
												{row.titleEncrypted !== false && (
													<span className="admin-chip admin-chip-restricted">encrypted title</span>
												)}
											</td>
											<td>{row.outputType}</td>
											<td>{row.ownerName || "—"}</td>
											<td>{row.faculty || "—"}</td>
											<td>
												<span
													className={`admin-chip admin-chip-${statusAccent(row.status)}`}
												>
													{statusLabel(row.status)}
												</span>
											</td>
											<td>{safeEvents(row).length}</td>
											<td>
												{row.privacyRedacted ? (
													<span className="admin-chip admin-chip-restricted">
														redacted
													</span>
												) : (
													"—"
												)}
											</td>
											<td>{row.reviewedByName || "—"}</td>
											<td>{formatAdminDate(row.createdAt)}</td>
											<td className="admin-row-actions">
												<button
													type="button"
													className="ghost-btn"
													onClick={() =>
														setExpandedId(
															expandedId === row.id
																? null
																: row.id,
														)
													}
												>
													{expandedId === row.id
														? "Close"
														: "Timeline"}
												</button>
												<button
													type="button"
													className="ghost-btn"
													onClick={() =>
														exportProvenanceReport(row)
													}
												>
													Export
												</button>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</AdminPanel>

				<AdminPanel
					title={
						expanded
							? `Provenance: ${expanded.outputTitle}`
							: "Provenance chain viewer"
					}
					description={
						expanded
							? `${safeEvents(expanded).length} events · ${statusLabel(expanded.status)}`
							: "Select a record to view its provenance timeline"
					}
				>
					{!expanded && <p className="muted">No record selected.</p>}
					{expanded && (
						<>
							<div className="admin-detail-grid">
								<div>
									<strong>Reference</strong>
									<p className="admin-hash">{expanded.outputRef || "—"}</p>
								</div>
								<div>
									<strong>Owner</strong>
									<p>
										{expanded.ownerName || "—"} ·{" "}
										{expanded.ownerEmail || "—"}
									</p>
								</div>
								<div>
									<strong>Privacy</strong>
									<p>
										{expanded.privacyRedacted
											? "Content redacted for privacy"
											: "Full content available"}
									</p>
								</div>
								<div>
									<strong>Hash verification</strong>
									<span className="admin-chip admin-chip-restricted">
										placeholder
									</span>
								</div>
							</div>

							<h3 style={{ margin: "1rem 0 0.5rem" }}>Event timeline</h3>
							<ProvenanceTimeline events={safeEvents(expanded)} />

							{expanded.reviewNotes && (
								<p className="muted" style={{ marginTop: "0.5rem" }}>
									Review notes: {expanded.reviewNotes}
								</p>
							)}

							<div style={{ marginTop: "1rem" }}>
								<strong>Access management</strong>
								<p className="muted">
									Granted to:{" "}
									{expanded.accessGrantedTo.length > 0
										? expanded.accessGrantedTo.join(", ")
										: "No reviewers assigned"}
								</p>
								<button
									type="button"
									className="ghost-btn"
									disabled={working}
									onClick={() => void addReviewer(expanded.id)}
								>
									Add reviewer
								</button>
							</div>

							<div className="admin-actions-row" style={{ marginTop: "1rem" }}>
								<button
									type="button"
									className="ghost-btn"
									disabled={working}
									onClick={() =>
										void review(expanded.id, "under_review")
									}
								>
									Start review
								</button>
								<button
									type="button"
									className="primary-btn"
									disabled={working}
									onClick={() => void review(expanded.id, "cleared")}
								>
									Clear
								</button>
								<button
									type="button"
									className="ghost-btn"
									disabled={working}
									onClick={() =>
										void review(expanded.id, "escalated")
									}
								>
									Escalate
								</button>
								<button
									type="button"
									className="ghost-btn"
									onClick={() => exportProvenanceReport(expanded)}
								>
									Export report
								</button>
							</div>
						</>
					)}
				</AdminPanel>
			</div>
		</AdminShell>
	);
}
