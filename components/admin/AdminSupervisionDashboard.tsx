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
	fetchAdminPortalProjects,
	fetchAdminPortalSummary,
	fetchAdminPortalSupervisors,
	fetchAdminUniversities,
	updateAdminPortalProject,
	type AdminPortalPerson,
	type AdminPortalProjectRecord,
	type AdminPortalSummary,
	type UniversityRecord,
} from "@/lib/admin-api";

const STATUS_OPTIONS = ["active", "paused", "completed", "archived"] as const;

type Props = { variant: "admin" | "super" };

export function AdminSupervisionDashboard({ variant }: Props) {
	const adminGuard = useAdminGuard();
	const superGuard = useSuperAdminGuard();
	const ready = variant === "super" ? superGuard.ready : adminGuard.ready;

	const [projects, setProjects] = useState<AdminPortalProjectRecord[]>([]);
	const [summary, setSummary] = useState<AdminPortalSummary | null>(null);
	const [supervisors, setSupervisors] = useState<AdminPortalPerson[]>([]);
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
			const [projectRows, summaryRow, uniRows] = await Promise.all([
				fetchAdminPortalProjects({
					family: "supervision",
					status: statusFilter || undefined,
					universityId: variant === "super" ? universityId || undefined : undefined,
					search: search || undefined,
				}),
				fetchAdminPortalSummary(),
				variant === "super" ? fetchAdminUniversities() : Promise.resolve([]),
			]);
			setProjects(projectRows);
			setSummary(summaryRow);
			if (variant === "super") setUniversities(uniRows);

			const supervisorUni =
				variant === "super"
					? universityId || projectRows[0]?.universityId
					: projectRows[0]?.universityId;
			if (supervisorUni) {
				setSupervisors(await fetchAdminPortalSupervisors(supervisorUni));
			} else {
				setSupervisors([]);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [variant, universityId, statusFilter, search]);

	useEffect(() => {
		if (ready) void load();
	}, [ready, load]);

	const { pageItems, pagination } = useAdminTable(projects, { resetDeps: [search, statusFilter, universityId] });

	const patchProject = useCallback(
		async (id: string, input: Partial<{ supervisorId: string | null; status: string }>) => {
			setWorking(true);
			setError(null);
			try {
				const updated = await updateAdminPortalProject(id, input);
				setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			} finally {
				setWorking(false);
			}
		},
		[],
	);

	const relative = variant === "super" ? superRelative : formatAdminRelative;

	const columns: AdminTableColumn<AdminPortalProjectRecord>[] = useMemo(
		() => [
			{ key: "title", header: "Project", cell: (row) => row.title },
			{ key: "student", header: "Student", cell: (row) => row.student.name },
			{
				key: "supervisor",
				header: "Supervisor",
				cell: (row) =>
					variant === "super" && !universityId ? (
						<span>{row.supervisor.name}</span>
					) : (
						<AdminSelect
							compact
							aria-label="Supervisor"
							value={row.supervisor.id ?? ""}
							disabled={working}
							clearable
							onChange={(value) => void patchProject(row.id, { supervisorId: value || null })}
							options={[
								...supervisors
									.filter((s) => s.id)
									.map((s) => ({ value: s.id!, label: s.name })),
								...(row.supervisor.id && !supervisors.some((s) => s.id === row.supervisor.id)
									? [{ value: row.supervisor.id, label: row.supervisor.name }]
									: []),
							]}
							placeholder="Unassigned"
						/>
					),
			},
			{ key: "projectType", header: "Type", cell: (row) => row.projectType },
			{ key: "stage", header: "Stage", cell: (row) => row.stage },
			{ key: "progress", header: "Progress", cell: (row) => `${row.progressPercent}%` },
			{
				key: "status",
				header: "Status",
				cell: (row) => (
					<AdminSelect
						compact
						aria-label="Status"
						value={row.status}
						disabled={working}
						onChange={(value) => void patchProject(row.id, { status: value })}
						options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
					/>
				),
			},
			{ key: "updatedAt", header: "Updated", cell: (row) => relative(row.updatedAt) },
		],
		[supervisors, working, relative, patchProject, variant, universityId],
	);

	const Shell = variant === "super" ? SuperAdminShell : AdminShell;
	const Panel = variant === "super" ? SuperPanel : AdminPanel;
	const Stat = variant === "super" ? SuperStat : AdminStatCard;

	if (!ready) {
		return (
			<Shell title="Supervision AI oversight" subtitle="Loading…" breadcrumb="AI product oversight">
				<p className="muted">Loading…</p>
			</Shell>
		);
	}

	return (
		<Shell
			title="Supervision AI oversight"
			subtitle="Oversee AI-linked thesis and research projects (metadata only)"
			breadcrumb={variant === "super" ? "Platform · Supervision" : "AI product oversight · Supervision"}
		>
			{error && <p className="error-text">{error}</p>}

			<section className="admin-stats">
				<Stat label="Supervision projects" value={summary?.supervisionProjects ?? projects.length} />
				<Stat label="Active" value={summary?.activeProjects ?? "—"} />
				<Stat label="Unassigned supervisor" value={summary?.unassignedSupervisors ?? "—"} />
			</section>

			<Panel title="Projects" description="Private chapter content is not shown in this console.">
					{variant === "super" && !universityId && (
						<p className="muted" style={{ marginBottom: "0.75rem" }}>
							Select a university to assign supervisors. Status can still be updated for all rows.
						</p>
					)}
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
						options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
						placeholder="All statuses"
					/>
				</div>
				<AdminDataTable
					columns={columns}
					data={pageItems}
					rowKey={(row) => row.id}
					loading={loading}
					search={search}
					onSearchChange={setSearch}
					searchPlaceholder="Search title, course, topic…"
					pagination={pagination}
					emptyMessage="No supervision projects found."
					hasActiveFilters={Boolean(search || statusFilter || universityId)}
				/>
			</Panel>
		</Shell>
	);
}
