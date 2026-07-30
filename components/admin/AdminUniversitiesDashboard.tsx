"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminInput } from "@/components/admin/AdminInput";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
	AdminPanel,
	AdminStatCard,
	formatAdminDate,
	SuperAdminShell,
} from "@/components/admin/SuperAdminShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useSuperAdminGuard } from "@/hooks/useAdminGuard";
import {
	deleteAdminUniversity,
	fetchAdminUniversities,
	onboardAdminUniversity,
	updateAdminUniversity,
	type UniversityRecord,
} from "@/lib/admin-api";
import { REGISTER_COUNTRIES } from "@/lib/countries";
import { universityDetailHref } from "@/lib/admin-university-href";
import { NIGERIA_UNIVERSITY_GROUPS, NIGERIA_UNIVERSITIES } from "@/lib/nigeria-universities";
import {
	fetchUniversitiesByCountry,
	type WorldUniversity,
} from "@/lib/world-universities-api";

export function AdminUniversitiesDashboard() {
	const { ready } = useSuperAdminGuard();
	const [universities, setUniversities] = useState<UniversityRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [country, setCountry] = useState("NG");
	const [catalogue, setCatalogue] = useState<WorldUniversity[]>([]);
	const [catalogueLoading, setCatalogueLoading] = useState(false);
	const [catalogueId, setCatalogueId] = useState("");
	const [saving, setSaving] = useState(false);
	const [search, setSearch] = useState("");
	const [offboardTarget, setOffboardTarget] = useState<UniversityRecord | null>(null);
	const [offboarding, setOffboarding] = useState(false);

	const load = useCallback(async () => {
		setError(null);
		try {
			setUniversities(await fetchAdminUniversities());
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (ready) void load();
	}, [load, ready]);

	useEffect(() => {
		let cancelled = false;
		async function loadCatalogue() {
			setCatalogueLoading(true);
			setCatalogueId("");
			try {
				if (country === "NG") {
					const list = NIGERIA_UNIVERSITIES.map((u) => ({ id: u.id, label: u.label }));
					if (!cancelled) setCatalogue(list);
				} else {
					const list = await fetchUniversitiesByCountry(country);
					if (!cancelled) setCatalogue(list);
				}
			} catch (err) {
				if (!cancelled) {
					setCatalogue([]);
					setError(err instanceof Error ? err.message : String(err));
				}
			} finally {
				if (!cancelled) setCatalogueLoading(false);
			}
		}
		void loadCatalogue();
		return () => {
			cancelled = true;
		};
	}, [country]);

	const onboardedIds = useMemo(
		() => new Set(universities.map((u) => u.catalogueId)),
		[universities],
	);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return universities;
		return universities.filter(
			(u) =>
				u.name.toLowerCase().includes(q) ||
				u.catalogueId.toLowerCase().includes(q) ||
				(u.country ?? "").toLowerCase().includes(q),
		);
	}, [universities, search]);

	const activeCount = universities.filter((u) => u.status === "active").length;

	const institutionGroups = useMemo(() => {
		if (country === "NG") {
			return NIGERIA_UNIVERSITY_GROUPS.map((group) => ({
				id: group.id,
				label: group.label,
				options: group.universities.map((uni) => ({
					value: uni.id,
					label: uni.label,
					disabled: onboardedIds.has(uni.id),
					hint: onboardedIds.has(uni.id) ? "Already onboarded" : undefined,
				})),
			}));
		}
		return undefined;
	}, [country, onboardedIds]);

	const institutionOptions = useMemo(() => {
		if (country === "NG") return undefined;
		return catalogue.map((uni) => ({
			value: uni.id,
			label: uni.label,
			disabled: onboardedIds.has(uni.id),
			hint: onboardedIds.has(uni.id) ? "Already onboarded" : undefined,
		}));
	}, [country, catalogue, onboardedIds]);

	const handleOnboard = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!catalogueId) return;
		const label =
			catalogue.find((u) => u.id === catalogueId)?.label ??
			NIGERIA_UNIVERSITIES.find((u) => u.id === catalogueId)?.label ??
			catalogueId;
		setSaving(true);
		setError(null);
		try {
			await onboardAdminUniversity({
				catalogueId,
				name: label,
				country,
				status: "active",
			});
			setCatalogueId("");
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	const toggleStatus = async (uni: UniversityRecord) => {
		setError(null);
		try {
			await updateAdminUniversity(uni.id, {
				status: uni.status === "active" ? "inactive" : "active",
			});
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	};

	const confirmOffboard = async () => {
		if (!offboardTarget) return;
		setOffboarding(true);
		setError(null);
		try {
			await deleteAdminUniversity(offboardTarget.id, offboardTarget.name);
			setOffboardTarget(null);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setOffboarding(false);
		}
	};

	return (
		<SuperAdminShell
			title="Universities"
			subtitle="Onboard institutions so their lecturers and students can sign in."
			breadcrumb="Platform"
		>
			{error && <p className="error-text">{error}</p>}

			<section className="admin-stats">
				<AdminStatCard label="Onboarded" value={universities.length} />
				<AdminStatCard label="Active" value={activeCount} />
				<AdminStatCard label="Inactive" value={universities.length - activeCount} />
			</section>

			<AdminPanel title="Onboard a university">
				<form className="admin-form-grid" onSubmit={handleOnboard}>
					<AdminSelect
						id="onboard-country"
						label="Country"
						value={country}
						onChange={setCountry}
						disabled={saving}
						searchThreshold={0}
						options={REGISTER_COUNTRIES.map((c) => ({
							value: c.code,
							label: c.label,
						}))}
					/>
					<AdminSelect
						id="onboard-institution"
						label="Institution"
						span
						value={catalogueId}
						onChange={setCatalogueId}
						required
						disabled={saving || catalogueLoading}
						placeholder={catalogueLoading ? "Loading catalogue…" : "Select from catalogue…"}
						searchPlaceholder="Search institutions…"
						searchThreshold={0}
						groups={institutionGroups}
						options={institutionOptions}
					/>
					<div className="admin-form-span">
						<button type="submit" className="primary-btn" disabled={saving || !catalogueId}>
							{saving ? "Onboarding…" : "Onboard & activate"}
						</button>
					</div>
				</form>
			</AdminPanel>

			<AdminPanel
				title="Onboarded universities"
				actions={
					<AdminInput
						compact
						type="search"
						placeholder="Search name, catalogue, country…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						aria-label="Search universities"
						className="admin-panel-search"
					/>
				}
			>
				{loading ? (
					<p className="muted">Loading…</p>
				) : filtered.length === 0 ? (
					<p className="muted">No universities onboarded yet.</p>
				) : (
					<table className="admin-table">
						<thead>
							<tr>
								<th>Name</th>
								<th>Country</th>
								<th>Status</th>
								<th>Users</th>
								<th>Admins</th>
								<th>Onboarded</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{filtered.map((uni) => (
								<tr key={uni.id}>
									<td>
										<strong>
											<Link href={universityDetailHref(uni)}>{uni.name}</Link>
										</strong>
										<div className="muted">{uni.catalogueId}</div>
									</td>
									<td>{(uni.country ?? "NG").toUpperCase()}</td>
									<td>
										<span className={`pill status-${uni.status}`}>{uni.status}</span>
									</td>
									<td>{uni.userCount}</td>
									<td>{uni.adminCount}</td>
									<td>{uni.onboardedAt ? formatAdminDate(uni.onboardedAt) : "—"}</td>
									<td>
										<div className="admin-row-actions">
											<Link className="ghost-btn" href={universityDetailHref(uni)}>
												Open
											</Link>
											<button
												type="button"
												className="ghost-btn"
												onClick={() => void toggleStatus(uni)}
											>
												{uni.status === "active" ? "Deactivate" : "Activate"}
											</button>
											<button
												type="button"
												className="ghost-btn admin-btn-danger"
												onClick={() => setOffboardTarget(uni)}
											>
												Offboard
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</AdminPanel>

			<ConfirmDialog
				open={Boolean(offboardTarget)}
				title={`Offboard ${offboardTarget?.name ?? "university"}?`}
				description={
					offboardTarget
						? `${offboardTarget.name} will be deactivated and all affiliated users will be suspended. If no users remain, the university record will be removed.`
						: ""
				}
				confirmLabel="Offboard"
				cancelLabel="Keep university"
				loading={offboarding}
				onConfirm={() => void confirmOffboard()}
				onCancel={() => {
					if (!offboarding) setOffboardTarget(null);
				}}
			/>
		</SuperAdminShell>
	);
}
