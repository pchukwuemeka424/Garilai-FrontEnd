"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import { AdminPanel, AdminShell, AdminStatCard, formatAdminDate } from "@/components/admin/AdminShell";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { useAdminUserQuery, matchesAdminUserQuery } from "@/hooks/useAdminUserQuery";
import { createAdminApproval, fetchAdminApprovals, reviewAdminApproval } from "@/lib/admin-api";
import type { ApprovalRequestRecord, ApprovalStats } from "@/lib/admin-governance";

const KINDS = ["tool", "dataset", "use_case", "model", "integration"] as const;

const STATUSES = ["pending", "under_review", "approved", "rejected", "withdrawn"] as const;

const STATUS_LABELS: Record<string, string> = {
	pending: "Pending",
	under_review: "Under review",
	approved: "Approved",
	rejected: "Rejected",
	withdrawn: "Withdrawn",
};

const emptyForm = {
	title: "",
	description: "",
	kind: "tool",
	justification: "",
	riskNotes: "",
};

function exportApprovalsCsv(approvals: ApprovalRequestRecord[]) {
	const headers = [
		"ID", "Title", "Kind", "Status", "Requester", "Email",
		"Faculty", "Department", "Justification", "Risk Notes",
		"Reviewer", "Review Notes", "Decided At", "Created",
	];
	const rows = approvals.map((a) => [
		a.id, a.title, a.kind, a.status,
		a.requesterName ?? "", a.requesterEmail ?? "",
		a.faculty ?? "", a.department ?? "",
		a.justification, a.riskNotes,
		a.reviewerName ?? "", a.reviewNotes,
		a.decidedAt ?? "", a.createdAt,
	]);
	const csv = [headers, ...rows]
		.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
		.join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `approval-requests-${new Date().toISOString().slice(0, 10)}.csv`;
	link.click();
	URL.revokeObjectURL(url);
}

export function AdminApprovalsDashboard() {
	const { ready } = useAdminGuard();
	const [approvals, setApprovals] = useState<ApprovalRequestRecord[]>([]);
	const [stats, setStats] = useState<ApprovalStats | null>(null);
	const [statusFilter, setStatusFilter] = useState("");
	const [kindFilter, setKindFilter] = useState("");
	const [search, setSearch] = useAdminUserQuery();
	const [form, setForm] = useState(emptyForm);
	const [loading, setLoading] = useState(true);
	const [working, setWorking] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		try {
			const data = await fetchAdminApprovals({
				status: statusFilter || undefined,
				kind: kindFilter || undefined,
			});
			setApprovals(data.approvals);
			setStats(data.stats);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [statusFilter, kindFilter]);

	useEffect(() => {
		if (ready) void load();
	}, [load, ready]);

	const filtered = useMemo(() => {
		return approvals.filter((a) =>
			matchesAdminUserQuery(search, [
				a.title, a.requesterName, a.requesterEmail, a.kind,
				a.faculty, a.department, a.id,
			]),
		);
	}, [approvals, search]);

	const onCreate = async () => {
		if (!form.title.trim()) {
			setError("Title is required.");
			return;
		}
		setWorking(true);
		setError(null);
		try {
			await createAdminApproval({
				title: form.title,
				description: form.description || undefined,
				kind: form.kind,
				justification: form.justification || undefined,
				riskNotes: form.riskNotes || undefined,
			});
			setForm(emptyForm);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onReview = async (approval: ApprovalRequestRecord, decision: "approved" | "rejected") => {
		const notes = window.prompt(
			`${decision === "approved" ? "Approval" : "Rejection"} notes`,
		)?.trim();
		if (notes === null || notes === undefined) return;
		setWorking(true);
		setError(null);
		try {
			await reviewAdminApproval(approval.id, {
				status: decision,
				reviewNotes: notes || undefined,
			});
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onMarkUnderReview = async (approval: ApprovalRequestRecord) => {
		setWorking(true);
		setError(null);
		try {
			await reviewAdminApproval(approval.id, { status: "under_review" });
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const statusChipClass = (status: string) => {
		if (status === "approved") return "admin-chip admin-chip-status-closed";
		if (status === "rejected") return "admin-chip admin-chip-status-open";
		if (status === "under_review") return "admin-chip admin-chip-status-investigating";
		if (status === "pending") return "admin-chip admin-chip-status-escalated";
		return "admin-chip";
	};

	const isPending = (status: string) => status === "pending" || status === "under_review";

	return (
		<AdminShell
			title="Approval requests"
			subtitle="Review, approve, or reject requests for AI tools, datasets, and use cases"
			breadcrumb="Admin · Governance"
			actions={
				<>
					<button type="button" className="ghost-btn" onClick={() => exportApprovalsCsv(filtered)}>
						Export CSV
					</button>
					<button type="button" className="ghost-btn" onClick={() => void load()}>
						Refresh
					</button>
				</>
			}
		>
			{loading && <p className="muted">Loading approvals…</p>}
			{error && <div className="banner banner-error">{error}</div>}

			{stats && (
				<section className="admin-stats">
					<AdminStatCard label="Total" value={stats.total} />
					<AdminStatCard label="Pending" value={stats.pending} accent="warning" />
					<AdminStatCard label="Under review" value={stats.underReview} accent="primary" />
					<AdminStatCard label="Approved" value={stats.approved} accent="success" />
					<AdminStatCard label="Rejected" value={stats.rejected} accent="danger" />
				</section>
			)}

			<div className="admin-gov-grid">
				<AdminPanel title="Submit request" description="Create a new approval request for an AI resource">
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
							Kind
							<select
								className="topic-input"
								value={form.kind}
								onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
							>
								{KINDS.map((k) => (
									<option key={k} value={k}>
										{k.replace(/_/g, " ")}
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
						<label className="admin-form-span">
							Justification
							<textarea
								className="topic-input"
								rows={2}
								value={form.justification}
								onChange={(e) => setForm((f) => ({ ...f, justification: e.target.value }))}
								placeholder="Why is this resource needed?"
							/>
						</label>
						<label className="admin-form-span">
							Risk notes
							<textarea
								className="topic-input"
								rows={2}
								value={form.riskNotes}
								onChange={(e) => setForm((f) => ({ ...f, riskNotes: e.target.value }))}
								placeholder="Known risks or concerns"
							/>
						</label>
					</div>
					<button type="button" className="primary-btn" disabled={working} onClick={() => void onCreate()}>
						Submit request
					</button>
				</AdminPanel>

				<AdminPanel title="Filters" description="Narrow the request queue">
					<div className="admin-filters admin-form-grid">
						<label>
							Search
							<input
								className="topic-input"
								placeholder="Title, requester, ID…"
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
									<option key={s} value={s}>
										{STATUS_LABELS[s] ?? s}
									</option>
								))}
							</select>
						</label>
						<label>
							Kind
							<select
								className="topic-input"
								value={kindFilter}
								onChange={(e) => setKindFilter(e.target.value)}
							>
								<option value="">All</option>
								{KINDS.map((k) => (
									<option key={k} value={k}>
										{k.replace(/_/g, " ")}
									</option>
								))}
							</select>
						</label>
					</div>
				</AdminPanel>
			</div>

			<AdminPanel
				title="Request queue"
				description={`${filtered.length} of ${approvals.length} requests`}
			>
				<div className="admin-table-scroll">
					<table className="admin-simple-table">
						<thead>
							<tr>
								<th>Title</th>
								<th>Kind</th>
								<th>Status</th>
								<th>Requester</th>
								<th>Faculty</th>
								<th>Justification</th>
								<th>Submitted</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{filtered.length === 0 ? (
								<tr>
									<td colSpan={8} className="muted">
										No requests in this view.
									</td>
								</tr>
							) : (
								filtered.map((approval) => (
									<Fragment key={approval.id}>
										<tr>
											<td>
												<button
													type="button"
													className="admin-link-btn"
													onClick={() =>
														setExpandedId((id) =>
															id === approval.id ? null : approval.id,
														)
													}
												>
													{approval.title}
												</button>
											</td>
											<td>{approval.kind.replace(/_/g, " ")}</td>
											<td>
												<span className={statusChipClass(approval.status)}>
													{STATUS_LABELS[approval.status] ?? approval.status}
												</span>
											</td>
											<td>
												{approval.requesterName || "—"}
												{approval.requesterEmail && (
													<p className="muted">{approval.requesterEmail}</p>
												)}
											</td>
											<td>{approval.faculty ?? "—"}</td>
											<td>
												<span title={approval.justification}>
													{approval.justification
														? approval.justification.length > 60
															? `${approval.justification.slice(0, 60)}…`
															: approval.justification
														: "—"}
												</span>
											</td>
											<td>{formatAdminDate(approval.createdAt)}</td>
											<td className="admin-row-actions">
												{approval.status === "pending" && (
													<button
														type="button"
														className="ghost-btn"
														disabled={working}
														onClick={() => void onMarkUnderReview(approval)}
													>
														Review
													</button>
												)}
												{isPending(approval.status) && (
													<>
														<button
															type="button"
															className="ghost-btn"
															disabled={working}
															onClick={() => void onReview(approval, "approved")}
														>
															Approve
														</button>
														<button
															type="button"
															className="ghost-btn"
															disabled={working}
															onClick={() => void onReview(approval, "rejected")}
														>
															Reject
														</button>
													</>
												)}
											</td>
										</tr>
										{expandedId === approval.id && (
											<tr>
												<td colSpan={8}>
													<div style={{ padding: "0.5rem 0" }}>
														<strong>Description</strong>
														<p>{approval.description || "No description."}</p>

														{approval.riskNotes && (
															<>
																<strong>Risk notes</strong>
																<p className="muted">{approval.riskNotes}</p>
															</>
														)}

														<strong style={{ display: "block", marginTop: "0.75rem" }}>
															Workflow timeline
														</strong>
														<div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
															<span className={`admin-chip ${approval.createdAt ? "admin-chip-status-closed" : ""}`}>
																Submitted {formatAdminDate(approval.createdAt)}
															</span>
															{(approval.status === "under_review" ||
																approval.status === "approved" ||
																approval.status === "rejected") && (
																<span className="admin-chip admin-chip-status-investigating">
																	Under review
																	{approval.reviewerName ? ` by ${approval.reviewerName}` : ""}
																</span>
															)}
															{approval.status === "approved" && (
																<span className="admin-chip admin-chip-status-closed">
																	Approved {formatAdminDate(approval.decidedAt)}
																</span>
															)}
															{approval.status === "rejected" && (
																<span className="admin-chip admin-chip-status-open">
																	Rejected {formatAdminDate(approval.decidedAt)}
																</span>
															)}
															{approval.status === "withdrawn" && (
																<span className="admin-chip">
																	Withdrawn
																</span>
															)}
														</div>

														{approval.reviewNotes && (
															<>
																<strong style={{ display: "block", marginTop: "0.75rem" }}>
																	Review notes
																</strong>
																<p className="muted">{approval.reviewNotes}</p>
															</>
														)}
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
			</AdminPanel>
		</AdminShell>
	);
}
