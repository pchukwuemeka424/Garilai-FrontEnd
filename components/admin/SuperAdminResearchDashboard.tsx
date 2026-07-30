"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { AdminDataTable, type AdminTableColumn } from "@/components/admin/AdminDataTable";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
	AdminPanel,
	AdminStatCard,
	formatAdminDate,
	formatAdminRelative,
	SuperAdminShell,
} from "@/components/admin/SuperAdminShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAdminTable } from "@/hooks/useAdminTable";
import { useSuperAdminGuard } from "@/hooks/useAdminGuard";
import {
	bulkDeleteAdminResearchNotebooks,
	bulkDeleteAdminResearchPapers,
	bulkDeleteAdminResearchUploads,
	deleteAdminResearchNotebook,
	deleteAdminResearchPaper,
	deleteAdminResearchUpload,
	fetchAdminResearchNotebook,
	fetchAdminResearchNotebooks,
	fetchAdminResearchPaper,
	fetchAdminResearchPapers,
	fetchAdminResearchStats,
	fetchAdminResearchUploads,
	fetchAdminUniversities,
	type AdminResearchNotebookDetail,
	type AdminResearchNotebookRecord,
	type AdminResearchPaperDetail,
	type AdminResearchPaperRecord,
	type AdminResearchStats,
	type AdminResearchUploadKind,
	type AdminResearchUploadRecord,
	type UniversityRecord,
} from "@/lib/admin-api";

type TabId = "papers" | "notebooks" | "uploads";

type PendingDelete =
	| { type: "paper"; id: string; label: string }
	| { type: "notebook"; id: string; label: string }
	| { type: "upload"; id: string; kind: AdminResearchUploadKind; label: string }
	| { type: "bulk-papers"; ids: string[] }
	| { type: "bulk-notebooks"; ids: string[] }
	| { type: "bulk-uploads"; items: Array<{ id: string; kind: AdminResearchUploadKind }> };

function formatBytes(n: number): string {
	if (!n || n <= 0) return "—";
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function OwnerCell({
	name,
	email,
}: {
	name: string;
	email: string;
}) {
	return (
		<div>
			<div>{name}</div>
			<div className="muted" style={{ fontSize: "0.8rem" }}>
				{email}
			</div>
		</div>
	);
}

function ResearchDetailModal({
	title,
	subtitle,
	loading,
	error,
	onClose,
	onDelete,
	children,
}: {
	title: string;
	subtitle?: string;
	loading: boolean;
	error: string | null;
	onClose: () => void;
	onDelete?: () => void;
	children: ReactNode;
}) {
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	if (!mounted) return null;

	return createPortal(
		<div className="modal-backdrop confirm-dialog-backdrop" role="presentation" onClick={onClose}>
			<div
				className="modal dash-modal admin-console-modal"
				role="dialog"
				aria-modal="true"
				onClick={(e) => e.stopPropagation()}
			>
				<header className="modal-header">
					<div>
						<h3>{title}</h3>
						{subtitle && (
							<p className="muted" style={{ margin: "0.25rem 0 0" }}>
								{subtitle}
							</p>
						)}
					</div>
					<button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
						×
					</button>
				</header>
				{loading ? (
					<p className="muted">Loading…</p>
				) : error ? (
					<p className="error-text">{error}</p>
				) : (
					<>
						{children}
						{onDelete && (
							<footer className="admin-actions-row" style={{ marginTop: "1.25rem", justifyContent: "flex-end" }}>
								<button type="button" className="ghost-btn" onClick={onClose}>
									Close
								</button>
								<button type="button" className="danger-btn" onClick={onDelete}>
									Delete
								</button>
							</footer>
						)}
					</>
				)}
			</div>
		</div>,
		document.body,
	);
}

export function SuperAdminResearchDashboard() {
	const { ready } = useSuperAdminGuard();
	const [tab, setTab] = useState<TabId>("papers");
	const [stats, setStats] = useState<AdminResearchStats | null>(null);
	const [universities, setUniversities] = useState<UniversityRecord[]>([]);
	const [papers, setPapers] = useState<AdminResearchPaperRecord[]>([]);
	const [notebooks, setNotebooks] = useState<AdminResearchNotebookRecord[]>([]);
	const [uploads, setUploads] = useState<AdminResearchUploadRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [working, setWorking] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [universityFilter, setUniversityFilter] = useState("");
	const [uploadKindFilter, setUploadKindFilter] = useState<"" | AdminResearchUploadKind>("");
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
	const [paperDetail, setPaperDetail] = useState<AdminResearchPaperDetail | null>(null);
	const [notebookDetail, setNotebookDetail] = useState<AdminResearchNotebookDetail | null>(null);
	const [detailLoading, setDetailLoading] = useState(false);
	const [detailError, setDetailError] = useState<string | null>(null);
	const [viewingPaperId, setViewingPaperId] = useState<string | null>(null);
	const [viewingNotebookId, setViewingNotebookId] = useState<string | null>(null);

	const uniNameById = useMemo(
		() => new Map(universities.map((u) => [u.id, u.name])),
		[universities],
	);

	const load = useCallback(async () => {
		setError(null);
		try {
			const uniId = universityFilter || undefined;
			const [statsData, uniList, paperList, notebookList, uploadList] = await Promise.all([
				fetchAdminResearchStats(uniId),
				fetchAdminUniversities(),
				fetchAdminResearchPapers({ universityId: uniId }),
				fetchAdminResearchNotebooks({ universityId: uniId }),
				fetchAdminResearchUploads({
					universityId: uniId,
					kind: uploadKindFilter || "all",
				}),
			]);
			setStats(statsData);
			setUniversities(uniList);
			setPapers(paperList);
			setNotebooks(notebookList);
			setUploads(uploadList);
			setSelectedIds(new Set());
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [universityFilter, uploadKindFilter]);

	useEffect(() => {
		if (ready) void load();
	}, [load, ready]);

	useEffect(() => {
		setSelectedIds(new Set());
		setSearch("");
	}, [tab]);

	const openPaper = async (id: string) => {
		setViewingPaperId(id);
		setPaperDetail(null);
		setDetailLoading(true);
		setDetailError(null);
		try {
			setPaperDetail(await fetchAdminResearchPaper(id));
		} catch (err) {
			setDetailError(err instanceof Error ? err.message : String(err));
		} finally {
			setDetailLoading(false);
		}
	};

	const openNotebook = async (id: string) => {
		setViewingNotebookId(id);
		setNotebookDetail(null);
		setDetailLoading(true);
		setDetailError(null);
		try {
			setNotebookDetail(await fetchAdminResearchNotebook(id));
		} catch (err) {
			setDetailError(err instanceof Error ? err.message : String(err));
		} finally {
			setDetailLoading(false);
		}
	};

	const confirmDelete = async () => {
		if (!pendingDelete) return;
		setWorking(true);
		setError(null);
		try {
			switch (pendingDelete.type) {
				case "paper":
					await deleteAdminResearchPaper(pendingDelete.id);
					setViewingPaperId(null);
					setPaperDetail(null);
					break;
				case "notebook":
					await deleteAdminResearchNotebook(pendingDelete.id);
					setViewingNotebookId(null);
					setNotebookDetail(null);
					break;
				case "upload":
					await deleteAdminResearchUpload(pendingDelete.kind, pendingDelete.id);
					break;
				case "bulk-papers":
					await bulkDeleteAdminResearchPapers(pendingDelete.ids);
					break;
				case "bulk-notebooks":
					await bulkDeleteAdminResearchNotebooks(pendingDelete.ids);
					break;
				case "bulk-uploads":
					await bulkDeleteAdminResearchUploads(pendingDelete.items);
					break;
			}
			setPendingDelete(null);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setPendingDelete(null);
		} finally {
			setWorking(false);
		}
	};

	const filteredPapers = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return papers;
		return papers.filter(
			(p) =>
				p.title.toLowerCase().includes(q) ||
				p.topic.toLowerCase().includes(q) ||
				p.owner.name.toLowerCase().includes(q) ||
				p.owner.email.toLowerCase().includes(q),
		);
	}, [papers, search]);

	const filteredNotebooks = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return notebooks;
		return notebooks.filter(
			(n) =>
				n.title.toLowerCase().includes(q) ||
				n.description.toLowerCase().includes(q) ||
				n.owner.name.toLowerCase().includes(q) ||
				n.owner.email.toLowerCase().includes(q) ||
				n.projectType.toLowerCase().includes(q),
		);
	}, [notebooks, search]);

	const filteredUploads = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return uploads;
		return uploads.filter(
			(u) =>
				u.title.toLowerCase().includes(q) ||
				u.fileName.toLowerCase().includes(q) ||
				u.owner.name.toLowerCase().includes(q) ||
				u.owner.email.toLowerCase().includes(q) ||
				(u.projectTitle ?? "").toLowerCase().includes(q),
		);
	}, [uploads, search]);

	const paperTable = useAdminTable(filteredPapers, { resetDeps: [search, universityFilter] });
	const notebookTable = useAdminTable(filteredNotebooks, { resetDeps: [search, universityFilter] });
	const uploadTable = useAdminTable(filteredUploads, {
		resetDeps: [search, universityFilter, uploadKindFilter],
	});

	const toggleId = (id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const visibleKeys =
		tab === "papers"
			? paperTable.pageItems.map((r) => r.id)
			: tab === "notebooks"
				? notebookTable.pageItems.map((r) => r.id)
				: uploadTable.pageItems.map((r) => `${r.kind}:${r.id}`);

	const allVisibleSelected =
		visibleKeys.length > 0 && visibleKeys.every((id) => selectedIds.has(id));

	const toggleAllVisible = () => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (allVisibleSelected) {
				for (const id of visibleKeys) next.delete(id);
			} else {
				for (const id of visibleKeys) next.add(id);
			}
			return next;
		});
	};

	const paperColumns: AdminTableColumn<AdminResearchPaperRecord>[] = [
		{
			key: "title",
			header: "Paper",
			cell: (row) => (
				<div>
					<button type="button" className="admin-link-btn" onClick={() => void openPaper(row.id)}>
						{row.title}
					</button>
					<div className="muted" style={{ fontSize: "0.8rem" }}>
						{row.topic}
					</div>
				</div>
			),
		},
		{
			key: "owner",
			header: "Owner",
			cell: (row) => <OwnerCell name={row.owner.name} email={row.owner.email} />,
		},
		{
			key: "university",
			header: "University",
			cell: (row) =>
				row.owner.universityId
					? (uniNameById.get(row.owner.universityId) ?? row.owner.institution ?? "—")
					: (row.owner.institution ?? "—"),
		},
		{
			key: "edited",
			header: "Edited",
			cell: (row) => (row.humanEdited ? "Yes" : "No"),
		},
		{
			key: "size",
			header: "Size",
			cell: (row) => formatBytes(row.contentLength),
		},
		{
			key: "updated",
			header: "Updated",
			cell: (row) => formatAdminRelative(row.updatedAt),
		},
		{
			key: "actions",
			header: "",
			align: "right",
			cell: (row) => (
				<div className="admin-actions-row" style={{ justifyContent: "flex-end" }}>
					<button type="button" className="ghost-btn" onClick={() => void openPaper(row.id)}>
						View
					</button>
					<button
						type="button"
						className="ghost-btn"
						onClick={() =>
							setPendingDelete({ type: "paper", id: row.id, label: row.title })
						}
					>
						Delete
					</button>
				</div>
			),
		},
	];

	const notebookColumns: AdminTableColumn<AdminResearchNotebookRecord>[] = [
		{
			key: "title",
			header: "Notebook",
			cell: (row) => (
				<div>
					<button type="button" className="admin-link-btn" onClick={() => void openNotebook(row.id)}>
						{row.title}
					</button>
					<div className="muted" style={{ fontSize: "0.8rem" }}>
						{row.projectType.replace(/_/g, " ")} · {row.status.replace(/_/g, " ")}
					</div>
				</div>
			),
		},
		{
			key: "owner",
			header: "Owner",
			cell: (row) => <OwnerCell name={row.owner.name} email={row.owner.email} />,
		},
		{
			key: "university",
			header: "University",
			cell: (row) =>
				row.owner.universityId
					? (uniNameById.get(row.owner.universityId) ?? row.owner.institution ?? "—")
					: (row.owner.institution ?? "—"),
		},
		{
			key: "sync",
			header: "Notebook",
			cell: (row) =>
				row.hasNotebook
					? `${row.pageCount} pages · ${formatBytes(row.notebookBytes)}`
					: "Not synced",
		},
		{
			key: "assets",
			header: "Uploads",
			cell: (row) => `${row.documentCount} docs · ${row.datasetCount} datasets`,
		},
		{
			key: "updated",
			header: "Updated",
			cell: (row) => formatAdminRelative(row.updatedAt),
		},
		{
			key: "actions",
			header: "",
			align: "right",
			cell: (row) => (
				<div className="admin-actions-row" style={{ justifyContent: "flex-end" }}>
					<button type="button" className="ghost-btn" onClick={() => void openNotebook(row.id)}>
						View
					</button>
					<button
						type="button"
						className="ghost-btn"
						onClick={() =>
							setPendingDelete({ type: "notebook", id: row.id, label: row.title })
						}
					>
						Delete
					</button>
				</div>
			),
		},
	];

	const uploadColumns: AdminTableColumn<AdminResearchUploadRecord>[] = [
		{
			key: "title",
			header: "Upload",
			cell: (row) => (
				<div>
					<div>{row.title}</div>
					<div className="muted" style={{ fontSize: "0.8rem" }}>
						{row.kind} · {row.fileName || "no file name"}
					</div>
				</div>
			),
		},
		{
			key: "owner",
			header: "Owner",
			cell: (row) => <OwnerCell name={row.owner.name} email={row.owner.email} />,
		},
		{
			key: "project",
			header: "Project",
			cell: (row) => row.projectTitle ?? "—",
		},
		{
			key: "storage",
			header: "Storage",
			cell: (row) => (
				<span>
					{row.storage}
					{row.sizeLabel ? ` · ${row.sizeLabel}` : ""}
					{!row.hasFile ? " · empty" : ""}
				</span>
			),
		},
		{
			key: "updated",
			header: "Updated",
			cell: (row) => formatAdminRelative(row.updatedAt),
		},
		{
			key: "actions",
			header: "",
			align: "right",
			cell: (row) => (
				<button
					type="button"
					className="ghost-btn"
					onClick={() =>
						setPendingDelete({
							type: "upload",
							id: row.id,
							kind: row.kind,
							label: row.title,
						})
					}
				>
					Delete
				</button>
			),
		},
	];

	const deleteDescription = (() => {
		if (!pendingDelete) return "";
		switch (pendingDelete.type) {
			case "paper":
				return `Permanently delete the research paper “${pendingDelete.label}”? This cannot be undone.`;
			case "notebook":
				return `Permanently delete the notebook “${pendingDelete.label}” and its linked documents, datasets, notes, and references? File storage will also be cleared.`;
			case "upload":
				return `Permanently delete the uploaded ${pendingDelete.kind} “${pendingDelete.label}”?`;
			case "bulk-papers":
				return `Permanently delete ${pendingDelete.ids.length} research papers?`;
			case "bulk-notebooks":
				return `Permanently delete ${pendingDelete.ids.length} notebooks and their linked uploads?`;
			case "bulk-uploads":
				return `Permanently delete ${pendingDelete.items.length} uploaded items?`;
		}
	})();

	return (
		<SuperAdminShell
			title="Research content"
			subtitle="Manage papers, research notebooks, and uploaded files across the platform"
			breadcrumb="Platform"
			actions={
				<button type="button" className="ghost-btn" disabled={working} onClick={() => void load()}>
					Refresh
				</button>
			}
		>
			{error && <p className="error-text">{error}</p>}

			<section className="admin-stats">
				<AdminStatCard label="Papers" value={stats?.papers ?? 0} />
				<AdminStatCard label="Notebooks" value={stats?.notebooks ?? 0} />
				<AdminStatCard
					label="Synced notebooks"
					value={stats?.notebooksWithSync ?? 0}
				/>
				<AdminStatCard label="Uploads" value={stats?.uploads ?? 0} />
			</section>

			<div className="admin-actions-row" style={{ marginBottom: "1rem", gap: "0.5rem", flexWrap: "wrap" }}>
				{(
					[
						["papers", "Research papers"],
						["notebooks", "Notebooks"],
						["uploads", "Uploads"],
					] as const
				).map(([id, label]) => (
					<button
						key={id}
						type="button"
						className={tab === id ? "primary-btn" : "ghost-btn"}
						onClick={() => setTab(id)}
					>
						{label}
					</button>
				))}
			</div>

			<AdminPanel
				title={
					tab === "papers"
						? "Saved research papers"
						: tab === "notebooks"
							? "Research notebooks"
							: "Uploaded documents & datasets"
				}
				description={
					tab === "papers"
						? "AI-generated and edited papers saved by users."
						: tab === "notebooks"
							? "Research projects and CanvAtlas notebook snapshots."
							: "Files attached to research projects (documents and datasets)."
				}
			>
				<div className="admin-actions-row" style={{ marginBottom: "0.75rem", gap: "0.5rem", flexWrap: "wrap" }}>
					<AdminSelect
						compact
						value={universityFilter}
						onChange={setUniversityFilter}
						placeholder="All universities"
						searchPlaceholder="Search universities…"
						searchThreshold={0}
						options={[
							{ value: "", label: "All universities" },
							...universities.map((u) => ({ value: u.id, label: u.name })),
						]}
					/>
					{tab === "uploads" && (
						<AdminSelect
							compact
							value={uploadKindFilter}
							onChange={(v) => setUploadKindFilter(v as "" | AdminResearchUploadKind)}
							options={[
								{ value: "", label: "All uploads" },
								{ value: "document", label: "Documents" },
								{ value: "dataset", label: "Datasets" },
							]}
						/>
					)}
				</div>

				{tab === "papers" && (
					<AdminDataTable
						columns={paperColumns}
						data={paperTable.pageItems}
						rowKey={(row) => row.id}
						loading={loading}
						emptyMessage="No research papers found."
						emptyFilteredMessage="No papers match your filters."
						hasActiveFilters={Boolean(search || universityFilter)}
						search={search}
						onSearchChange={setSearch}
						searchPlaceholder="Search papers, topics, owners…"
						pagination={paperTable.pagination}
						selectable={{
							selectedIds,
							onToggle: toggleId,
							onToggleAll: toggleAllVisible,
							allVisibleSelected,
						}}
						bulkBar={
							selectedIds.size > 0 ? (
								<>
									<span>{selectedIds.size} selected</span>
									<button
										type="button"
										className="ghost-btn"
										disabled={working}
										onClick={() =>
											setPendingDelete({
												type: "bulk-papers",
												ids: Array.from(selectedIds),
											})
										}
									>
										Delete selected
									</button>
								</>
							) : null
						}
					/>
				)}

				{tab === "notebooks" && (
					<AdminDataTable
						columns={notebookColumns}
						data={notebookTable.pageItems}
						rowKey={(row) => row.id}
						loading={loading}
						emptyMessage="No research notebooks found."
						emptyFilteredMessage="No notebooks match your filters."
						hasActiveFilters={Boolean(search || universityFilter)}
						search={search}
						onSearchChange={setSearch}
						searchPlaceholder="Search notebooks, owners…"
						pagination={notebookTable.pagination}
						selectable={{
							selectedIds,
							onToggle: toggleId,
							onToggleAll: toggleAllVisible,
							allVisibleSelected,
						}}
						bulkBar={
							selectedIds.size > 0 ? (
								<>
									<span>{selectedIds.size} selected</span>
									<button
										type="button"
										className="ghost-btn"
										disabled={working}
										onClick={() =>
											setPendingDelete({
												type: "bulk-notebooks",
												ids: Array.from(selectedIds),
											})
										}
									>
										Delete selected
									</button>
								</>
							) : null
						}
					/>
				)}

				{tab === "uploads" && (
					<AdminDataTable
						columns={uploadColumns}
						data={uploadTable.pageItems}
						rowKey={(row) => `${row.kind}:${row.id}`}
						loading={loading}
						emptyMessage="No uploads found."
						emptyFilteredMessage="No uploads match your filters."
						hasActiveFilters={Boolean(search || universityFilter || uploadKindFilter)}
						search={search}
						onSearchChange={setSearch}
						searchPlaceholder="Search uploads, owners, projects…"
						pagination={uploadTable.pagination}
						selectable={{
							selectedIds,
							onToggle: toggleId,
							onToggleAll: toggleAllVisible,
							allVisibleSelected,
						}}
						bulkBar={
							selectedIds.size > 0 ? (
								<>
									<span>{selectedIds.size} selected</span>
									<button
										type="button"
										className="ghost-btn"
										disabled={working}
										onClick={() => {
											const items = Array.from(selectedIds)
												.map((key) => {
													const [kind, id] = key.split(":");
													if (
														(kind !== "document" && kind !== "dataset") ||
														!id
													) {
														return null;
													}
													return { id, kind };
												})
												.filter(
													(
														item,
													): item is {
														id: string;
														kind: AdminResearchUploadKind;
													} => Boolean(item),
												);
											setPendingDelete({ type: "bulk-uploads", items });
										}}
									>
										Delete selected
									</button>
								</>
							) : null
						}
					/>
				)}
			</AdminPanel>

			{viewingPaperId && (
				<ResearchDetailModal
					title={paperDetail?.title ?? "Research paper"}
					subtitle={
						paperDetail
							? `${paperDetail.owner.name} · ${formatAdminDate(paperDetail.updatedAt)}`
							: undefined
					}
					loading={detailLoading}
					error={detailError}
					onClose={() => {
						setViewingPaperId(null);
						setPaperDetail(null);
					}}
					onDelete={
						paperDetail
							? () =>
									setPendingDelete({
										type: "paper",
										id: paperDetail.id,
										label: paperDetail.title,
									})
							: undefined
					}
				>
					{paperDetail && (
						<div className="dash-form">
							<p className="muted" style={{ marginTop: 0 }}>
								Topic: {paperDetail.topic}
								{paperDetail.humanEdited ? " · Human edited" : ""}
								{paperDetail.tokenUsage != null
									? ` · ${paperDetail.tokenUsage.toLocaleString()} tokens`
									: ""}
							</p>
							<pre
								style={{
									whiteSpace: "pre-wrap",
									maxHeight: 360,
									overflow: "auto",
									fontSize: "0.85rem",
									background: "var(--surface-muted, rgba(0,0,0,0.04))",
									padding: "0.75rem",
									borderRadius: 8,
								}}
							>
								{paperDetail.content}
							</pre>
						</div>
					)}
				</ResearchDetailModal>
			)}

			{viewingNotebookId && (
				<ResearchDetailModal
					title={notebookDetail?.title ?? "Research notebook"}
					subtitle={
						notebookDetail
							? `${notebookDetail.owner.name} · ${notebookDetail.status.replace(/_/g, " ")}`
							: undefined
					}
					loading={detailLoading}
					error={detailError}
					onClose={() => {
						setViewingNotebookId(null);
						setNotebookDetail(null);
					}}
					onDelete={
						notebookDetail
							? () =>
									setPendingDelete({
										type: "notebook",
										id: notebookDetail.id,
										label: notebookDetail.title,
									})
							: undefined
					}
				>
					{notebookDetail && (
						<div className="dash-form">
							{notebookDetail.description && (
								<p style={{ marginTop: 0 }}>{notebookDetail.description}</p>
							)}
							<section className="admin-stats" style={{ marginBottom: "1rem" }}>
								<div>
									<p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
										Pages
									</p>
									<strong>{notebookDetail.pageCount}</strong>
								</div>
								<div>
									<p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
										Drafts
									</p>
									<strong>{notebookDetail.draftCount}</strong>
								</div>
								<div>
									<p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
										Docs / datasets
									</p>
									<strong>
										{notebookDetail.documentCount} / {notebookDetail.datasetCount}
									</strong>
								</div>
								<div>
									<p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
										Snapshot
									</p>
									<strong>
										{notebookDetail.hasNotebook
											? formatBytes(notebookDetail.notebookBytes)
											: "None"}
									</strong>
								</div>
							</section>
							{notebookDetail.notebookSummary?.pages.length ? (
								<>
									<p className="muted" style={{ marginBottom: "0.35rem" }}>
										Pages in synced notebook
									</p>
									<ul style={{ marginTop: 0, paddingLeft: "1.1rem" }}>
										{notebookDetail.notebookSummary.pages.map((p) => (
											<li key={p.id}>{p.title}</li>
										))}
									</ul>
								</>
							) : (
								<p className="muted">No synced notebook pages.</p>
							)}
							{notebookDetail.sections.length > 0 && (
								<>
									<p className="muted" style={{ marginBottom: "0.35rem" }}>
										Project sections
									</p>
									<ul style={{ marginTop: 0, paddingLeft: "1.1rem" }}>
										{notebookDetail.sections.map((s) => (
											<li key={s.id}>
												{s.title}{" "}
												<span className="muted">
													({formatBytes(s.contentLength)})
												</span>
											</li>
										))}
									</ul>
								</>
							)}
						</div>
					)}
				</ResearchDetailModal>
			)}

			<ConfirmDialog
				open={Boolean(pendingDelete)}
				title="Confirm deletion"
				description={deleteDescription}
				confirmLabel="Delete"
				loading={working}
				onConfirm={() => void confirmDelete()}
				onCancel={() => setPendingDelete(null)}
			/>
		</SuperAdminShell>
	);
}
