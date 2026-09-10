"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminDataTable, type AdminTableColumn } from "@/components/admin/AdminDataTable";
import { AdminPanel, AdminShell, AdminStatCard, formatAdminRelative } from "@/components/admin/AdminShell";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
	AdminPanel as SuperPanel,
	AdminStatCard as SuperStat,
	SuperAdminShell,
	formatAdminRelative as superRelative,
} from "@/components/admin/SuperAdminShell";
import { useAdminGuard, useSuperAdminGuard } from "@/hooks/useAdminGuard";
import { useAdminTable } from "@/hooks/useAdminTable";
import {
	fetchAdminPortalBriefs,
	fetchAdminPortalProjects,
	fetchAdminPortalSummary,
	fetchAdminUniversities,
	updateAdminPortalBrief,
	updateAdminPortalProject,
	type AdminPortalBriefRecord,
	type AdminPortalProjectRecord,
	type AdminPortalSummary,
	type UniversityRecord,
} from "@/lib/admin-api";

const PROJECT_STATUSES = ["active", "paused", "completed", "archived"] as const;

type Props = { variant: "admin" | "super" };
type TabId = "submissions" | "briefs";

export function AdminAssessmentDashboard({ variant }: Props) {
	const adminGuard = useAdminGuard();
	const superGuard = useSuperAdminGuard();
	const ready = variant === "super" ? superGuard.ready : adminGuard.ready;

	const [tab, setTab] = useState<TabId>("submissions");
	const [projects, setProjects] = useState<AdminPortalProjectRecord[]>([]);
	const [briefs, setBriefs] = useState<AdminPortalBriefRecord[]>([]);
	const [summary, setSummary] = useState<AdminPortalSummary | null>(null);
	const [universities, setUniversities] = useState<UniversityRecord[]>([]);
	const [universityId, setUniversityId] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(true);
	const [working, setWorking] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const uniFilter = variant === "super" ? universityId || undefined : undefined;
			const [projectRows, briefRows, summaryRow, uniRows] = await Promise.all([
				fetchAdminPortalProjects({
					family: "assignment",
					status:
						tab === "submissions" && statusFilter && PROJECT_STATUSES.includes(statusFilter as (typeof PROJECT_STATUSES)[number])
							? statusFilter
							: undefined,
					universityId: uniFilter,
					search: search || undefined,
				}),
				fetchAdminPortalBriefs({
					universityId: uniFilter,
					status:
						tab === "briefs" && (statusFilter === "draft" || statusFilter === "published")
							? statusFilter
							: undefined,
					search: search || undefined,
				}),
				fetchAdminPortalSummary(),
				variant === "super" ? fetchAdminUniversities() : Promise.resolve([]),
			]);
			setProjects(projectRows);
			setBriefs(briefRows);
			setSummary(summaryRow);
			if (variant === "super") setUniversities(uniRows);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [variant, universityId, statusFilter, search, tab]);

	useEffect(() => {
		if (ready) void load();
	}, [ready, load]);

	const projectTable = useAdminTable(projects, { resetDeps: [search, statusFilter, universityId, tab] });
	const briefTable = useAdminTable(briefs, { resetDeps: [search, statusFilter, universityId, tab] });

	const relative = variant === "super" ? superRelative : formatAdminRelative;

	const projectColumns: AdminTableColumn<AdminPortalProjectRecord>[] = useMemo(
		() => [
			{ key: "title", header: "Submission", cell: (row) => row.title },
			{ key: "student", header: "Student", cell: (row) => row.student.name },
			{ key: "courseName", header: "Course", cell: (row) => row.courseName || "—" },
			{
				key: "score",
				header: "Score",
				cell: (row) => (row.score == null ? "—" : String(row.score)),
			},
			{
				key: "status",
				header: "Status",
				cell: (row) => (
					<AdminSelect
						compact
						aria-label="Status"
						value={row.status}
						disabled={working}
						onChange={(value) => {
							void (async () => {
								setWorking(true);
								setError(null);
								try {
									const updated = await updateAdminPortalProject(row.id, { status: value });
									setProjects((prev) => prev.map((p) => (p.id === row.id ? updated : p)));
								} catch (err) {
									setError(err instanceof Error ? err.message : String(err));
								} finally {
									setWorking(false);
								}
							})();
						}}
						options={PROJECT_STATUSES.map((s) => ({ value: s, label: s }))}
					/>
				),
			},
			{ key: "updatedAt", header: "Updated", cell: (row) => relative(row.updatedAt) },
		],
		[working, relative],
	);

	const briefColumns: AdminTableColumn<AdminPortalBriefRecord>[] = useMemo(
		() => [
			{ key: "title", header: "Brief", cell: (row) => row.title },
			{ key: "lecturer", header: "Lecturer", cell: (row) => row.lecturer.name },
			{ key: "courseName", header: "Course", cell: (row) => row.courseName || "—" },
			{ key: "submissionCount", header: "Submissions", cell: (row) => row.submissionCount },
			{ key: "status", header: "Status", cell: (row) => row.status },
			{
				key: "actions",
				header: "Actions",
				cell: (row) => (
					<div className="admin-actions-row">
						<button
							type="button"
							className="ghost-btn"
							disabled={working}
							onClick={() => {
								void (async () => {
									setWorking(true);
									setError(null);
									try {
										const nextStatus = row.status === "draft" ? "published" : "draft";
										const result = await updateAdminPortalBrief(row.id, { status: nextStatus });
										if (result.brief) {
											setBriefs((prev) => prev.map((b) => (b.id === row.id ? result.brief! : b)));
										}
									} catch (err) {
										setError(err instanceof Error ? err.message : String(err));
									} finally {
										setWorking(false);
									}
								})();
							}}
						>
							{row.status === "draft" ? "Publish" : "Unpublish"}
						</button>
						<button
							type="button"
							className="ghost-btn admin-btn-danger"
							disabled={working}
							onClick={() => {
								void (async () => {
									setWorking(true);
									setError(null);
									try {
										await updateAdminPortalBrief(row.id, { archive: true });
										setBriefs((prev) => prev.filter((b) => b.id !== row.id));
									} catch (err) {
										setError(err instanceof Error ? err.message : String(err));
									} finally {
										setWorking(false);
									}
								})();
							}}
						>
							Archive
						</button>
					</div>
				),
			},
		],
		[working],
	);

	const Shell = variant === "super" ? SuperAdminShell : AdminShell;
	const Panel = variant === "super" ? SuperPanel : AdminPanel;
	const Stat = variant === "super" ? SuperStat : AdminStatCard;

	if (!ready) {
		return (
			<Shell title="Student Assessment" subtitle="Loading…" breadcrumb="Academic products">
				<p className="muted">Loading…</p>
			</Shell>
		);
	}

	return (
		<Shell
			title="Student Assessment"
			subtitle="Oversee assignment briefs and submissions (metadata only)"
			breadcrumb={
				variant === "super" ? "Platform · Student Assessment" : "Academic products · Student Assessment"
			}
		>
			{error && <p className="error-text">{error}</p>}

			<section className="admin-stats">
				<Stat label="Assignment submissions" value={summary?.assignmentProjects ?? projects.length} />
				<Stat label="Published briefs" value={summary?.publishedBriefs ?? "—"} />
				<Stat label="Draft briefs" value={summary?.draftBriefs ?? "—"} />
			</section>

			<div className="admin-actions-row" style={{ marginBottom: "1rem", gap: "0.5rem" }}>
				<button
					type="button"
					className={tab === "submissions" ? "primary-btn" : "ghost-btn"}
					onClick={() => {
						setStatusFilter("");
						setTab("submissions");
					}}
				>
					Submissions
				</button>
				<button
					type="button"
					className={tab === "briefs" ? "primary-btn" : "ghost-btn"}
					onClick={() => {
						setStatusFilter("");
						setTab("briefs");
					}}
				>
					Briefs
				</button>
			</div>

			{tab === "submissions" ? (
				<Panel title="Submissions" description="Assignment text is not shown in this console.">
					<div className="admin-form-grid" style={{ marginBottom: "1rem" }}>
						{variant === "super" && (
							<AdminSelect
								label="University"
								value={universityId}
								onChange={setUniversityId}
								clearable
								options={universities.map((u) => ({ value: u.id, label: u.name }))}
								placeholder="All universities"
							/>
						)}
						<AdminSelect
							label="Status"
							value={statusFilter}
							onChange={setStatusFilter}
							clearable
							options={PROJECT_STATUSES.map((s) => ({ value: s, label: s }))}
							placeholder="All statuses"
						/>
					</div>
					<AdminDataTable
						columns={projectColumns}
						data={projectTable.pageItems}
						rowKey={(row) => row.id}
						loading={loading}
						search={search}
						onSearchChange={setSearch}
						searchPlaceholder="Search title or course…"
						pagination={projectTable.pagination}
						emptyMessage="No assignment submissions found."
						hasActiveFilters={Boolean(search || statusFilter || universityId)}
					/>
				</Panel>
			) : (
				<Panel title="Assignment briefs">
					<div className="admin-form-grid" style={{ marginBottom: "1rem" }}>
						{variant === "super" && (
							<AdminSelect
								label="University"
								value={universityId}
								onChange={setUniversityId}
								clearable
								options={universities.map((u) => ({ value: u.id, label: u.name }))}
								placeholder="All universities"
							/>
						)}
						<AdminSelect
							label="Brief status"
							value={statusFilter}
							onChange={setStatusFilter}
							clearable
							options={[
								{ value: "draft", label: "Draft" },
								{ value: "published", label: "Published" },
							]}
							placeholder="All"
						/>
					</div>
					<AdminDataTable
						columns={briefColumns}
						data={briefTable.pageItems}
						rowKey={(row) => row.id}
						loading={loading}
						search={search}
						onSearchChange={setSearch}
						searchPlaceholder="Search title or course…"
						pagination={briefTable.pagination}
						emptyMessage="No assignment briefs found."
						hasActiveFilters={Boolean(search || statusFilter || universityId)}
					/>
				</Panel>
			)}
		</Shell>
	);
}
