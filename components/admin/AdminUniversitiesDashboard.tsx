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
	onboardAdminUniversitiesBulk,
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

function slugifyCatalogueId(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 72);
}

export function AdminUniversitiesDashboard() {
	const { ready } = useSuperAdminGuard();
	const [universities, setUniversities] = useState<UniversityRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [country, setCountry] = useState("NG");
	const [catalogue, setCatalogue] = useState<WorldUniversity[]>([]);
	const [catalogueLoading, setCatalogueLoading] = useState(false);
	const [catalogueId, setCatalogueId] = useState("");
	const [saving, setSaving] = useState(false);
	const [bulkOnboarding, setBulkOnboarding] = useState(false);
	const [confirmBulk, setConfirmBulk] = useState(false);
	const [search, setSearch] = useState("");
	const [offboardTarget, setOffboardTarget] = useState<UniversityRecord | null>(null);
	const [offboarding, setOffboarding] = useState(false);

	const [manualCountry, setManualCountry] = useState("NG");
	const [manualName, setManualName] = useState("");
	const [manualSaving, setManualSaving] = useState(false);

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

	const pendingCatalogue = useMemo(
		() => catalogue.filter((u) => !onboardedIds.has(u.id)),
		[catalogue, onboardedIds],
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
	const countryLabel =
		REGISTER_COUNTRIES.find((c) => c.code === country)?.label ?? country;

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
		setSuccess(null);
		try {
			await onboardAdminUniversity({
				catalogueId,
				name: label,
				country,
				status: "active",
			});
			setCatalogueId("");
			setSuccess(`Onboarded ${label}.`);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	const confirmBulkOnboard = async () => {
		if (pendingCatalogue.length === 0) {
			setConfirmBulk(false);
			return;
		}
		setBulkOnboarding(true);
		setError(null);
		setSuccess(null);
		try {
			const result = await onboardAdminUniversitiesBulk({
				country,
				status: "active",
				universities: pendingCatalogue.map((u) => ({
					catalogueId: u.id,
					name: u.label,
				})),
			});
			setConfirmBulk(false);
			const parts = [
				`${result.created} created`,
				result.updated > 0 ? `${result.updated} updated` : null,
				result.failed > 0 ? `${result.failed} failed` : null,
			].filter(Boolean);
			setSuccess(`Onboarded all for ${countryLabel}: ${parts.join(", ")}.`);
			if (result.failed > 0 && result.errors[0]) {
				setError(
					`Some failed (e.g. ${result.errors[0].catalogueId}: ${result.errors[0].error}).`,
				);
			}
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setBulkOnboarding(false);
		}
	};

	const handleManualAdd = async (e: React.FormEvent) => {
		e.preventDefault();
		const name = manualName.trim();
		if (name.length < 2) return;

		const slug = slugifyCatalogueId(name);
		if (!slug) {
			setError("Enter a valid university name.");
			return;
		}
		const generatedId = `${manualCountry.toLowerCase()}-manual-${slug}`;
		setManualSaving(true);
		setError(null);
		setSuccess(null);
		try {
			await onboardAdminUniversity({
				catalogueId: generatedId,
				name,
				country: manualCountry,
				status: "active",
			});
			setManualName("");
			setSuccess(`Added and activated ${name}.`);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setManualSaving(false);
		}
	};

	const toggleStatus = async (uni: UniversityRecord) => {
		setError(null);
		setSuccess(null);
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
		setSuccess(null);
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

	const busy = saving || bulkOnboarding || manualSaving || offboarding;

	return (
		<SuperAdminShell
			title="Universities"
			subtitle="Onboard institutions so their lecturers and students can sign in."
			breadcrumb="Platform"
		>
			{error && <p className="error-text">{error}</p>}
			{success && <p className="muted">{success}</p>}

			<section className="admin-stats">
				<AdminStatCard label="Onboarded" value={universities.length} />
				<AdminStatCard label="Active" value={activeCount} />
				<AdminStatCard label="Inactive" value={universities.length - activeCount} />
			</section>

			<AdminPanel title="Onboard from catalogue">
				<form className="admin-form-grid" onSubmit={handleOnboard}>
					<AdminSelect
						id="onboard-country"
						label="Country"
						value={country}
						onChange={setCountry}
						disabled={busy}
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
						disabled={busy || catalogueLoading}
						placeholder={catalogueLoading ? "Loading catalogue…" : "Select from catalogue…"}
						searchPlaceholder="Search institutions…"
						searchThreshold={0}
						groups={institutionGroups}
						options={institutionOptions}
					/>
					<div className="admin-form-span admin-row-actions">
						<button type="submit" className="primary-btn" disabled={busy || !catalogueId}>
							{saving ? "Onboarding…" : "Onboard & activate"}
						</button>
						<button
							type="button"
							className="ghost-btn"
							disabled={busy || catalogueLoading || pendingCatalogue.length === 0}
							onClick={() => setConfirmBulk(true)}
						>
							{catalogueLoading
								? "Loading catalogue…"
								: pendingCatalogue.length === 0
									? `All ${countryLabel} onboarded`
									: `Onboard all ${countryLabel} (${pendingCatalogue.length})`}
						</button>
					</div>
				</form>
			</AdminPanel>

			<AdminPanel
				title="Add university manually"
				description="Use this when the institution is missing from the catalogue."
			>
				<form className="admin-form-grid" onSubmit={handleManualAdd}>
					<AdminSelect
						id="manual-country"
						label="Country"
						value={manualCountry}
						onChange={setManualCountry}
						disabled={busy}
						searchThreshold={0}
						options={REGISTER_COUNTRIES.map((c) => ({
							value: c.code,
							label: c.label,
						}))}
					/>
					<AdminInput
						id="manual-name"
						label="University name"
						span
						value={manualName}
						onChange={(e) => setManualName(e.target.value)}
						placeholder="e.g. Example University of Technology"
						required
						minLength={2}
						disabled={busy}
					/>
					<div className="admin-form-span">
						<button
							type="submit"
							className="primary-btn"
							disabled={busy || manualName.trim().length < 2}
						>
							{manualSaving ? "Adding…" : "Add & activate"}
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
				open={confirmBulk}
				title={`Onboard all ${countryLabel} universities?`}
				description={`This will activate ${pendingCatalogue.length} institution${pendingCatalogue.length === 1 ? "" : "s"} from the ${countryLabel} catalogue that are not yet onboarded. Already onboarded universities are skipped.`}
				confirmLabel={bulkOnboarding ? "Onboarding…" : "Onboard all"}
				cancelLabel="Cancel"
				loading={bulkOnboarding}
				onConfirm={() => void confirmBulkOnboard()}
				onCancel={() => {
					if (!bulkOnboarding) setConfirmBulk(false);
				}}
			/>

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
