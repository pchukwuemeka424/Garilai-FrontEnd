"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import {
	AdminPanel,
	AdminShell,
	AdminStatCard,
	formatAdminDate,
	formatAdminRelative,
} from "@/components/admin/AdminShell";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import {
	createAdminContribution,
	fetchAdminContributions,
	updateAdminContribution,
} from "@/lib/admin-api";
import type {
	AiContributionStatementRecord,
	ContributionStats,
} from "@/lib/admin-governance";

const OUTPUT_TYPES = ["paper", "outline", "draft", "idea", "note", "dataset", "other"] as const;

type VerifiedFilter = "all" | "yes" | "no";
type DisclosureFilter = "all" | "yes" | "no";

const emptyForm = {
	outputRef: "",
	outputTitle: "",
	outputType: "paper" as string,
	ownerName: "",
	ownerEmail: "",
	faculty: "",
	department: "",
	programme: "",
	contributionSummary: "",
	toolsUsed: "",
	modelNames: "",
	humanEdited: true,
	disclosureComplete: false,
	aiAssisted: true,
};

function displayText(value: string | null | undefined, fallback = "Not provided") {
	const trimmed = (value ?? "").trim();
	if (!trimmed || trimmed === "--" || trimmed === "—") return fallback;
	return trimmed;
}

function disclosureLabel(complete: boolean) {
	return complete ? "Complete" : "Incomplete";
}

function verificationLabel(verified: boolean) {
	return verified ? "Verified" : "Not verified";
}

function hasDiscrepancy(row: AiContributionStatementRecord) {
	return row.aiAssisted && !row.disclosureComplete;
}

function exportCsv(rows: AiContributionStatementRecord[]) {
	const headers = [
		"ID",
		"Output Title",
		"Output Type",
		"Owner",
		"Email",
		"Faculty",
		"AI Assisted",
		"Tools Used",
		"Models",
		"Disclosure Complete",
		"Verified",
		"Verified By",
		"Verified At",
		"Generated At",
		"Status",
	];
	const lines = rows.map((r) =>
		[
			r.id,
			r.outputTitle,
			r.outputType,
			r.ownerName,
			r.ownerEmail,
			r.faculty ?? "",
			r.aiAssisted ? "Yes" : "No",
			(r.toolsUsed ?? []).join("; "),
			(r.modelNames ?? []).join("; "),
			r.disclosureComplete ? "Yes" : "No",
			r.verified ? "Yes" : "No",
			r.verifiedByName || "",
			r.verifiedAt ?? "",
			r.generatedAt,
			verificationLabel(r.verified),
		]
			.map((c) => `"${String(c).replace(/"/g, '""')}"`)
			.join(","),
	);
	const csv = [headers.join(","), ...lines].join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `ai-contributions-${new Date().toISOString().slice(0, 10)}.csv`;
	a.click();
	URL.revokeObjectURL(url);
}

export function AdminContributionsDashboard() {
	const { ready } = useAdminGuard();
	const [statements, setStatements] = useState<AiContributionStatementRecord[]>([]);
	const [stats, setStats] = useState<ContributionStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [working, setWorking] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [verifiedFilter, setVerifiedFilter] = useState<VerifiedFilter>("all");
	const [disclosureFilter, setDisclosureFilter] = useState<DisclosureFilter>("all");
	const [typeFilter, setTypeFilter] = useState("");
	const [search, setSearch] = useState("");

	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [bulkIds, setBulkIds] = useState<Set<string>>(new Set());
	const [showForm, setShowForm] = useState(false);
	const [form, setForm] = useState(emptyForm);

	const load = useCallback(async () => {
		setError(null);
		try {
			const data = await fetchAdminContributions({
				verified:
					verifiedFilter === "yes" ? true : verifiedFilter === "no" ? false : undefined,
				disclosureComplete:
					disclosureFilter === "yes"
						? true
						: disclosureFilter === "no"
							? false
							: undefined,
				outputType: typeFilter || undefined,
			});
			setStatements(data.statements);
			setStats(data.stats);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [verifiedFilter, disclosureFilter, typeFilter]);

	useEffect(() => {
		if (ready) void load();
	}, [load, ready]);

	const filtered = useMemo(() => {
		if (!search.trim()) return statements;
		const q = search.toLowerCase();
		return statements.filter(
			(r) =>
				r.outputTitle.toLowerCase().includes(q) ||
				r.ownerName.toLowerCase().includes(q) ||
				r.ownerEmail.toLowerCase().includes(q) ||
				(r.faculty ?? "").toLowerCase().includes(q),
		);
	}, [statements, search]);

	const toggleBulk = (id: string) => {
		setBulkIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const toggleAllBulk = () => {
		if (bulkIds.size === filtered.length) {
			setBulkIds(new Set());
		} else {
			setBulkIds(new Set(filtered.map((r) => r.id)));
		}
	};

	const bulkVerify = async (verified: boolean) => {
		if (bulkIds.size === 0) return;
		const notes = verified
			? (window.prompt("Verification notes for bulk action (optional):") ?? "")
			: "";
		setWorking(true);
		setError(null);
		try {
			for (const id of bulkIds) {
				await updateAdminContribution(id, {
					verified,
					disclosureComplete: verified ? true : undefined,
					verificationNotes: notes || undefined,
				});
			}
			setBulkIds(new Set());
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const verify = async (id: string, verified: boolean) => {
		const notes = verified
			? (window.prompt("Verification notes (optional):") ?? "")
			: "";
		setWorking(true);
		try {
			await updateAdminContribution(id, {
				verified,
				disclosureComplete: verified ? true : undefined,
				verificationNotes: notes || undefined,
			});
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const flagForReview = async (id: string) => {
		const reason = window.prompt("Flag reason:") ?? "";
		if (!reason) return;
		setWorking(true);
		try {
			await updateAdminContribution(id, {
				verified: false,
				verificationNotes: `FLAGGED: ${reason}`,
			});
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const markIncomplete = async (id: string) => {
		setWorking(true);
		try {
			await updateAdminContribution(id, {
				disclosureComplete: false,
				verified: false,
			});
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const onCreate = async () => {
		if (!form.outputTitle.trim()) {
			setError("Output title is required.");
			return;
		}
		setWorking(true);
		setError(null);
		try {
			await createAdminContribution({
				...form,
				toolsUsed: form.toolsUsed
					.split(",")
					.map((t) => t.trim())
					.filter(Boolean),
				modelNames: form.modelNames
					.split(",")
					.map((m) => m.trim())
					.filter(Boolean),
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

	const discrepancies = useMemo(
		() => statements.filter(hasDiscrepancy),
		[statements],
	);

	return (
		<AdminShell
			title="AI Contribution Statements"
			subtitle="Check that researchers disclosed how GARIL AI helped their work — without opening the research itself"
			breadcrumb="Admin · Research Integrity"
			actions={
				<>
					<button
						type="button"
						className="ghost-btn"
						disabled={!statements.length}
						onClick={() => exportCsv(filtered)}
					>
						Export CSV
					</button>
					<button
						type="button"
						className="ghost-btn"
						onClick={() => setShowForm((v) => !v)}
					>
						{showForm ? "Hide form" : "New statement"}
					</button>
					<button type="button" className="ghost-btn" onClick={() => void load()}>
						Refresh
					</button>
				</>
			}
		>
			{loading && <p className="muted">Loading contribution statements…</p>}
			{error && <div className="banner banner-error">{error}</div>}

			<AdminPanel title="What this page is for">
				<p className="muted" style={{ margin: 0 }}>
					When a student or researcher uses GARIL AI on a paper, thesis, or assignment, the
					platform can record an <strong>AI contribution statement</strong> — a short disclosure
					of what AI helped with (search, outlining, editing, etc.). You review those statements
					here to confirm disclosure is complete, then mark them verified for academic integrity.
					This does not show the research content itself.
				</p>
				<ul className="muted" style={{ margin: "0.75rem 0 0", paddingLeft: "1.25rem" }}>
					<li>
						<strong>Disclosure</strong> — did the author fill in how AI was used?
						(Complete / Incomplete)
					</li>
					<li>
						<strong>Verification</strong> — did an admin confirm that disclosure looks valid?
						(Verified / Not verified)
					</li>
					<li>
						<strong>Needs attention</strong> — AI was used but disclosure is still incomplete
					</li>
				</ul>
			</AdminPanel>

			{stats && (
				<section className="admin-stats">
					<AdminStatCard label="Total statements" value={stats.total} accent="primary" hint="All recorded disclosures" />
					<AdminStatCard
						label="Needs attention"
						value={stats.incomplete}
						accent={stats.incomplete > 0 ? "danger" : "success"}
						hint="AI used · disclosure incomplete"
					/>
					<AdminStatCard
						label="Awaiting verification"
						value={stats.pendingVerification}
						accent={stats.pendingVerification > 0 ? "warning" : "success"}
						hint="Not yet marked verified by admin"
					/>
					<AdminStatCard label="Verified" value={stats.verified} accent="success" hint="Admin-confirmed" />
					<AdminStatCard label="AI-assisted outputs" value={stats.aiAssisted} hint="Declared AI use" />
					<AdminStatCard label="Human-edited" value={stats.humanEdited} hint="Author edited after AI" />
				</section>
			)}

			{discrepancies.length > 0 && (
				<AdminPanel
					title="Needs attention"
					description={`${discrepancies.length} statement(s) used AI but the disclosure form is still incomplete`}
				>
					<div className="admin-bar-list">
						{discrepancies.slice(0, 5).map((r) => (
							<div key={r.id} className="admin-bar-item">
								<span className="admin-bar-label">
									<span className="admin-sev admin-sev-warning">!</span>{" "}
									{displayText(r.outputTitle, "Untitled output")} —{" "}
									{displayText(r.ownerName, "Unknown author")}
								</span>
								<button
									type="button"
									className="ghost-btn"
									onClick={() => setExpandedId(r.id)}
								>
									Review
								</button>
							</div>
						))}
					</div>
				</AdminPanel>
			)}

			{showForm && (
				<AdminPanel
					title="Record contribution statement"
					description="Capture AI disclosure metadata for a research output"
				>
					<div className="admin-form-grid">
						<label>
							Output title
							<input
								className="topic-input"
								value={form.outputTitle}
								onChange={(e) =>
									setForm((f) => ({ ...f, outputTitle: e.target.value }))
								}
							/>
						</label>
						<label>
							Output reference
							<input
								className="topic-input"
								value={form.outputRef}
								onChange={(e) =>
									setForm((f) => ({ ...f, outputRef: e.target.value }))
								}
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
							Department
							<input
								className="topic-input"
								value={form.department}
								onChange={(e) =>
									setForm((f) => ({ ...f, department: e.target.value }))
								}
							/>
						</label>
						<label>
							Programme
							<input
								className="topic-input"
								value={form.programme}
								onChange={(e) =>
									setForm((f) => ({ ...f, programme: e.target.value }))
								}
							/>
						</label>
						<label>
							AI models used
							<input
								className="topic-input"
								placeholder="comma-separated"
								value={form.modelNames}
								onChange={(e) =>
									setForm((f) => ({ ...f, modelNames: e.target.value }))
								}
							/>
						</label>
						<label>
							Tools used
							<input
								className="topic-input"
								placeholder="comma-separated"
								value={form.toolsUsed}
								onChange={(e) =>
									setForm((f) => ({ ...f, toolsUsed: e.target.value }))
								}
							/>
						</label>
						<label className="admin-form-span">
							Contribution summary
							<input
								className="topic-input"
								value={form.contributionSummary}
								onChange={(e) =>
									setForm((f) => ({
										...f,
										contributionSummary: e.target.value,
									}))
								}
							/>
						</label>
					</div>
					<label className="admin-checkbox-label">
						<input
							type="checkbox"
							checked={form.aiAssisted}
							onChange={(e) =>
								setForm((f) => ({ ...f, aiAssisted: e.target.checked }))
							}
						/>
						AI assisted
					</label>
					<label className="admin-checkbox-label">
						<input
							type="checkbox"
							checked={form.humanEdited}
							onChange={(e) =>
								setForm((f) => ({ ...f, humanEdited: e.target.checked }))
							}
						/>
						Human edited
					</label>
					<label className="admin-checkbox-label">
						<input
							type="checkbox"
							checked={form.disclosureComplete}
							onChange={(e) =>
								setForm((f) => ({
									...f,
									disclosureComplete: e.target.checked,
								}))
							}
						/>
						Disclosure complete
					</label>
					<div className="admin-actions-row">
						<button
							type="button"
							className="primary-btn"
							disabled={working}
							onClick={() => void onCreate()}
						>
							Save statement
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
						Verified
						<select
							className="topic-input"
							value={verifiedFilter}
							onChange={(e) =>
								setVerifiedFilter(e.target.value as VerifiedFilter)
							}
						>
							<option value="all">All</option>
							<option value="yes">Yes</option>
							<option value="no">No</option>
						</select>
					</label>
					<label>
						Disclosure complete
						<select
							className="topic-input"
							value={disclosureFilter}
							onChange={(e) =>
								setDisclosureFilter(e.target.value as DisclosureFilter)
							}
						>
							<option value="all">All</option>
							<option value="yes">Yes</option>
							<option value="no">No</option>
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
							placeholder="Title, owner, email, faculty…"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</label>
				</div>
			</AdminPanel>

			{bulkIds.size > 0 && (
				<AdminPanel>
					<div className="admin-actions-row">
						<span className="muted">{bulkIds.size} selected</span>
						<button
							type="button"
							className="primary-btn"
							disabled={working}
							onClick={() => void bulkVerify(true)}
						>
							Bulk verify
						</button>
						<button
							type="button"
							className="ghost-btn"
							disabled={working}
							onClick={() => void bulkVerify(false)}
						>
							Bulk reject
						</button>
						<button
							type="button"
							className="ghost-btn"
							onClick={() => setBulkIds(new Set())}
						>
							Clear selection
						</button>
					</div>
				</AdminPanel>
			)}

			<AdminPanel
				title="Contribution statements"
				description={`${filtered.length.toLocaleString()} of ${statements.length.toLocaleString()} statements · open Details to review, then Verify when disclosure looks complete`}
			>
				<div className="admin-table-scroll">
					<table className="admin-simple-table">
						<thead>
							<tr>
								<th>
									<input
										type="checkbox"
										checked={
											filtered.length > 0 &&
											bulkIds.size === filtered.length
										}
										onChange={toggleAllBulk}
										aria-label="Select all statements"
									/>
								</th>
								<th>Research output</th>
								<th>Type</th>
								<th>Author</th>
								<th>Faculty</th>
								<th>Used AI?</th>
								<th>AI tools</th>
								<th>Disclosure</th>
								<th>Admin check</th>
								<th>Recorded</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{filtered.length === 0 ? (
								<tr>
									<td colSpan={11} className="muted">
										No contribution statements yet. They appear when researchers
										generate AI disclosures, or when you create one with “New statement”.
									</td>
								</tr>
							) : (
								filtered.map((row) => (
									<Fragment key={row.id}>
										<tr
											className={
												hasDiscrepancy(row)
													? "admin-row-flagged"
													: undefined
											}
										>
											<td>
												<input
													type="checkbox"
													checked={bulkIds.has(row.id)}
													onChange={() => toggleBulk(row.id)}
													aria-label={`Select ${displayText(row.outputTitle)}`}
												/>
											</td>
											<td>
												<strong>{displayText(row.outputTitle, "Untitled output")}</strong>
												{hasDiscrepancy(row) && (
													<span
														className="admin-sev admin-sev-warning"
														title="Used AI but disclosure is still incomplete"
														style={{ marginLeft: "0.35rem" }}
													>
														!
													</span>
												)}
												{row.ownerEmail ? (
													<p className="muted">{row.ownerEmail}</p>
												) : null}
											</td>
											<td>{displayText(row.outputType)}</td>
											<td>{displayText(row.ownerName, "Unknown author")}</td>
											<td>{displayText(row.faculty)}</td>
											<td>{row.aiAssisted ? "Yes" : "No"}</td>
											<td>{(row.toolsUsed ?? []).join(", ") || "Not listed"}</td>
											<td>
												<span
													className={`admin-chip ${
														row.disclosureComplete
															? "admin-chip-status-active"
															: "admin-chip-danger"
													}`}
												>
													{disclosureLabel(row.disclosureComplete)}
												</span>
											</td>
											<td>
												<span
													className={`admin-chip ${
														row.verified
															? "admin-chip-status-active"
															: "admin-chip-status-inactive"
													}`}
												>
													{verificationLabel(row.verified)}
												</span>
											</td>
											<td>{formatAdminDate(row.generatedAt)}</td>
											<td className="admin-row-actions">
												<button
													type="button"
													className="ghost-btn"
													onClick={() =>
														setExpandedId(
															expandedId === row.id ? null : row.id,
														)
													}
												>
													{expandedId === row.id ? "Collapse" : "Details"}
												</button>
												{!row.verified && (
													<button
														type="button"
														className="ghost-btn"
														disabled={working}
														onClick={() => void verify(row.id, true)}
													>
														Verify
													</button>
												)}
												{row.verified && (
													<button
														type="button"
														className="ghost-btn"
														disabled={working}
														onClick={() => void verify(row.id, false)}
													>
														Unverify
													</button>
												)}
											</td>
										</tr>
										{expandedId === row.id && (
											<tr>
												<td colSpan={11}>
													<div className="admin-detail-grid">
														<div>
															<strong>What AI contributed</strong>
															<p>
																{displayText(
																	row.contributionSummary,
																	"No summary provided yet — ask the author to complete disclosure",
																)}
															</p>
														</div>
														<div>
															<strong>AI models named</strong>
															<p>
																{(row.modelNames ?? []).join(", ") ||
																	"None listed"}
															</p>
														</div>
														<div>
															<strong>Verification notes</strong>
															<p>
																{displayText(
																	row.verificationNotes,
																	"No admin notes yet",
																)}
															</p>
														</div>
														<div>
															<strong>Verified by</strong>
															<p>
																{displayText(row.verifiedByName, "Not verified yet")}
																{row.verifiedAt && (
																	<>
																		{" "}
																		· {formatAdminRelative(row.verifiedAt)}
																	</>
																)}
															</p>
														</div>
														<div>
															<strong>Human edited after AI?</strong>
															<p>{row.humanEdited ? "Yes" : "No / not stated"}</p>
														</div>
														<div>
															<strong>Internal reference</strong>
															<p className="admin-hash">
																{displayText(row.outputRef, "No reference")}
															</p>
														</div>
													</div>
													<div className="admin-actions-row" style={{ marginTop: "0.75rem" }}>
														<button
															type="button"
															className="primary-btn"
															disabled={working}
															onClick={() => void verify(row.id, !row.verified)}
														>
															{row.verified ? "Unverify" : "Mark verified"}
														</button>
														<button
															type="button"
															className="ghost-btn"
															disabled={working}
															onClick={() => void flagForReview(row.id)}
														>
															Add review note
														</button>
														<button
															type="button"
															className="ghost-btn"
															disabled={working}
															onClick={() => void markIncomplete(row.id)}
														>
															Mark disclosure incomplete
														</button>
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
