"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { AdminInput } from "@/components/admin/AdminInput";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
	AdminTokenEditModal,
	formatTokenCount,
	tokenUsagePercent,
} from "@/components/admin/AdminTokenEditModal";
import {
	AdminPanel,
	AdminStatCard,
	SuperAdminShell,
} from "@/components/admin/SuperAdminShell";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useSuperAdminGuard } from "@/hooks/useAdminGuard";
import type { AdminTokenRecord, TokenAdminStats } from "@/lib/admin";
import {
	bulkAdminResetTokens,
	bulkUpdateAdminUniversityTokenDefaults,
	fetchAdminTokens,
	fetchAdminUniversities,
	type UniversityRecord,
} from "@/lib/admin-api";
import { REGISTER_COUNTRIES } from "@/lib/countries";
import { universityDetailHref } from "@/lib/admin-university-href";
import {
	LECTURER_TOKEN_ALLOWANCE,
	STUDENT_TOKEN_ALLOWANCE,
} from "@/lib/student-tokens";

type DefaultsScope = "all" | "country" | "university";

function parseOrNull(raw: string): number | null {
	const t = raw.trim();
	if (!t) return null;
	const n = Number.parseInt(t, 10);
	if (!Number.isFinite(n) || n < 0) throw new Error("Enter valid token amounts.");
	return n;
}

export function SuperAdminTokensDashboard() {
	const { ready } = useSuperAdminGuard();
	const [records, setRecords] = useState<AdminTokenRecord[]>([]);
	const [stats, setStats] = useState<TokenAdminStats | null>(null);
	const [universities, setUniversities] = useState<UniversityRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [working, setWorking] = useState(false);
	const [editingUser, setEditingUser] = useState<AdminTokenRecord | null>(null);
	const [search, setSearch] = useState("");
	const [universityFilter, setUniversityFilter] = useState("");
	const [roleFilter, setRoleFilter] = useState("");

	const [defaultsScope, setDefaultsScope] = useState<DefaultsScope>("all");
	const [defaultsCountry, setDefaultsCountry] = useState("NG");
	const [defaultsUniId, setDefaultsUniId] = useState("");
	const [studentDefault, setStudentDefault] = useState("");
	const [lecturerDefault, setLecturerDefault] = useState("");
	const [confirmSave, setConfirmSave] = useState(false);

	const load = useCallback(async () => {
		setError(null);
		try {
			const [tokenData, uniList] = await Promise.all([
				fetchAdminTokens(),
				fetchAdminUniversities(),
			]);
			setRecords(tokenData.users);
			setStats(tokenData.stats);
			setUniversities(uniList);
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
		if (defaultsScope !== "university") return;
		const uni = universities.find((u) => u.id === defaultsUniId);
		if (!uni) {
			setStudentDefault("");
			setLecturerDefault("");
			return;
		}
		setStudentDefault(
			uni.defaultStudentTokens != null ? String(uni.defaultStudentTokens) : "",
		);
		setLecturerDefault(
			uni.defaultLecturerTokens != null ? String(uni.defaultLecturerTokens) : "",
		);
	}, [defaultsScope, defaultsUniId, universities]);

	const uniNameById = useMemo(
		() => new Map(universities.map((u) => [u.id, u.name])),
		[universities],
	);

	const countriesInUse = useMemo(() => {
		const codes = new Set(
			universities.map((u) => (u.country ?? "NG").toUpperCase()).filter(Boolean),
		);
		const known = REGISTER_COUNTRIES.filter((c) => codes.has(c.code));
		const extras = [...codes]
			.filter((code) => !REGISTER_COUNTRIES.some((c) => c.code === code))
			.sort()
			.map((code) => ({ code, label: code }));
		return [...known, ...extras];
	}, [universities]);

	const targetUniversities = useMemo(() => {
		if (defaultsScope === "all") return universities;
		if (defaultsScope === "country") {
			return universities.filter(
				(u) => (u.country ?? "NG").toUpperCase() === defaultsCountry.toUpperCase(),
			);
		}
		return universities.filter((u) => u.id === defaultsUniId);
	}, [universities, defaultsScope, defaultsCountry, defaultsUniId]);

	const filtered = useMemo(() => {
		const q = search.toLowerCase();
		return records.filter((r) => {
			if (!r.tokenQuota) return false;
			if (universityFilter && r.universityId !== universityFilter) return false;
			if (roleFilter && r.role !== roleFilter) return false;
			if (
				q &&
				!r.name.toLowerCase().includes(q) &&
				!r.email.toLowerCase().includes(q) &&
				!(r.institution ?? "").toLowerCase().includes(q)
			) {
				return false;
			}
			return true;
		});
	}, [records, search, universityFilter, roleFilter]);

	const canSave =
		!working &&
		(defaultsScope === "all" ||
			(defaultsScope === "country" && Boolean(defaultsCountry)) ||
			(defaultsScope === "university" && Boolean(defaultsUniId)));

	const scopeLabel = useMemo(() => {
		if (defaultsScope === "all") return `all ${universities.length} universities`;
		if (defaultsScope === "country") {
			const label =
				REGISTER_COUNTRIES.find((c) => c.code === defaultsCountry)?.label ?? defaultsCountry;
			return `all ${targetUniversities.length} universities in ${label}`;
		}
		const uni = universities.find((u) => u.id === defaultsUniId);
		return uni?.name ?? "the selected university";
	}, [defaultsScope, universities, defaultsCountry, defaultsUniId, targetUniversities.length]);

	const requestSave = (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setSuccess(null);
		try {
			parseOrNull(studentDefault);
			parseOrNull(lecturerDefault);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			return;
		}
		if (defaultsScope === "university" && !defaultsUniId) {
			setError("Select a university first.");
			return;
		}
		if (defaultsScope !== "university" && targetUniversities.length === 0) {
			setError("No universities match this scope.");
			return;
		}
		setConfirmSave(true);
	};

	const confirmSaveDefaults = async () => {
		setWorking(true);
		setError(null);
		setSuccess(null);
		try {
			const result = await bulkUpdateAdminUniversityTokenDefaults({
				scope: defaultsScope,
				country: defaultsScope === "country" ? defaultsCountry : undefined,
				universityId: defaultsScope === "university" ? defaultsUniId : undefined,
				defaultStudentTokens: parseOrNull(studentDefault),
				defaultLecturerTokens: parseOrNull(lecturerDefault),
			});
			setConfirmSave(false);
			setSuccess(
				`Applied token defaults to ${result.updated} universit${result.updated === 1 ? "y" : "ies"}. Users without a personal override pick this up immediately.`,
			);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	const resetAllVisible = async () => {
		const ids = filtered.map((r) => r.id);
		if (ids.length === 0) return;
		if (!window.confirm(`Reset tokens used to 0 for ${ids.length} users?`)) return;
		setWorking(true);
		setError(null);
		setSuccess(null);
		try {
			await bulkAdminResetTokens(ids);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setWorking(false);
		}
	};

	return (
		<SuperAdminShell
			title="Token management"
			subtitle="Platform-wide quotas, usage, and university defaults"
			breadcrumb="Platform"
			actions={
				<div className="admin-actions-row">
					<button type="button" className="ghost-btn" disabled={working} onClick={() => void load()}>
						Refresh
					</button>
					<button
						type="button"
						className="ghost-btn"
						disabled={working || filtered.length === 0}
						onClick={() => void resetAllVisible()}
					>
						Reset filtered usage
					</button>
				</div>
			}
		>
			{error && <p className="error-text">{error}</p>}
			{success && <p className="muted">{success}</p>}

			<section className="admin-stats">
				<AdminStatCard label="Accounts tracked" value={stats?.userCount ?? 0} />
				<AdminStatCard label="Students" value={stats?.studentsWithQuota ?? 0} />
				<AdminStatCard label="Lecturers" value={stats?.lecturersWithQuota ?? 0} />
				<AdminStatCard
					label="Tokens used"
					value={formatTokenCount(stats?.totalTokensUsed ?? 0)}
				/>
			</section>

			<AdminPanel
				title="Default token allowances"
				description={`Allocate once for every university, a whole country, or a single campus. Platform fallbacks: students ${STUDENT_TOKEN_ALLOWANCE.toLocaleString()}, lecturers ${LECTURER_TOKEN_ALLOWANCE.toLocaleString()}. Leave blank to clear university defaults and use platform amounts.`}
			>
				<form className="admin-form-grid" onSubmit={requestSave}>
					<AdminSelect
						id="token-defaults-scope"
						label="Apply to"
						value={defaultsScope}
						onChange={(value) => setDefaultsScope(value as DefaultsScope)}
						disabled={working}
						searchThreshold={99}
						options={[
							{ value: "all", label: "All universities" },
							{ value: "country", label: "All universities in a country" },
							{ value: "university", label: "One university" },
						]}
					/>
					{defaultsScope === "country" ? (
						<AdminSelect
							id="token-defaults-country"
							label="Country"
							value={defaultsCountry}
							onChange={setDefaultsCountry}
							disabled={working}
							searchThreshold={0}
							options={countriesInUse.map((c) => ({
								value: c.code,
								label: c.label,
								hint: `${universities.filter((u) => (u.country ?? "NG").toUpperCase() === c.code).length} onboarded`,
							}))}
						/>
					) : null}
					{defaultsScope === "university" ? (
						<AdminSelect
							id="token-defaults-uni"
							label="University"
							span
							value={defaultsUniId}
							onChange={setDefaultsUniId}
							placeholder="Select university…"
							searchPlaceholder="Search universities…"
							searchThreshold={0}
							disabled={working}
							options={universities.map((uni) => ({
								value: uni.id,
								label: uni.name,
								hint: `${(uni.country ?? "NG").toUpperCase()} · ${uni.status}`,
							}))}
						/>
					) : null}
					<AdminInput
						label="Default student tokens"
						type="number"
						min={0}
						value={studentDefault}
						onChange={(e) => setStudentDefault(e.target.value)}
						placeholder={String(STUDENT_TOKEN_ALLOWANCE)}
						hint="Students without a personal override"
						disabled={working}
					/>
					<AdminInput
						label="Default lecturer tokens"
						type="number"
						min={0}
						value={lecturerDefault}
						onChange={(e) => setLecturerDefault(e.target.value)}
						placeholder={String(LECTURER_TOKEN_ALLOWANCE)}
						hint="Lecturers and researchers without a personal override"
						disabled={working}
					/>
					<div className="admin-form-span">
						<p className="muted" style={{ marginBottom: "0.75rem" }}>
							Will update <strong>{targetUniversities.length}</strong> universit
							{targetUniversities.length === 1 ? "y" : "ies"} ({scopeLabel}).
						</p>
						<button type="submit" className="primary-btn" disabled={!canSave}>
							{working ? "Saving…" : "Save defaults"}
						</button>
						{defaultsScope === "university" && defaultsUniId ? (
							<Link
								href={universityDetailHref(
									universities.find((u) => u.id === defaultsUniId) ?? defaultsUniId,
								)}
								className="ghost-btn"
								style={{ marginLeft: "0.5rem" }}
							>
								Open university
							</Link>
						) : null}
					</div>
				</form>
			</AdminPanel>

			<AdminPanel
				title="User token usage"
				actions={
					<div className="admin-actions-row">
						<input
							className="topic-input"
							placeholder="Search name or email…"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							style={{ minWidth: 180 }}
						/>
						<AdminSelect
							compact
							value={universityFilter}
							onChange={setUniversityFilter}
							placeholder="All universities"
							clearable
							aria-label="Filter by university"
							searchThreshold={0}
							options={universities.map((uni) => ({ value: uni.id, label: uni.name }))}
						/>
						<AdminSelect
							compact
							value={roleFilter}
							onChange={setRoleFilter}
							placeholder="All roles"
							clearable
							aria-label="Filter by role"
							searchThreshold={99}
							options={[
								{ value: "student", label: "Student" },
								{ value: "lecturer", label: "Lecturer" },
								{ value: "researcher", label: "Researcher" },
							]}
						/>
					</div>
				}
			>
				{loading ? (
					<p className="muted">Loading…</p>
				) : filtered.length === 0 ? (
					<p className="muted">No token-quota users match these filters.</p>
				) : (
					<table className="admin-table">
						<thead>
							<tr>
								<th>User</th>
								<th>Role</th>
								<th>University</th>
								<th>Used</th>
								<th>Allowance</th>
								<th>Usage</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{filtered.map((row) => {
								const q = row.tokenQuota!;
								const pct = tokenUsagePercent(q.used, q.allowance);
								return (
									<tr key={row.id}>
										<td>
											<strong>{row.name}</strong>
											<div className="muted">{row.email}</div>
										</td>
										<td>{row.role}</td>
										<td>
											{row.universityId
												? uniNameById.get(row.universityId) ?? row.institution ?? "—"
												: row.institution ?? "—"}
										</td>
										<td className="dash-mono">{formatTokenCount(q.used)}</td>
										<td className="dash-mono">
											{formatTokenCount(q.allowance)}
											{row.tokenAllowance ? (
												<span className="muted"> (custom)</span>
											) : null}
										</td>
										<td>{pct}%</td>
										<td>
											<button
												type="button"
												className="ghost-btn"
												onClick={() => setEditingUser(row)}
											>
												Manage
											</button>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				)}
			</AdminPanel>

			<ConfirmDialog
				open={confirmSave}
				title="Apply token defaults?"
				description={`This will set student and lecturer default allowances on ${scopeLabel}. Users with a personal override keep their custom amount; everyone else uses these defaults immediately.`}
				confirmLabel={working ? "Saving…" : "Apply defaults"}
				cancelLabel="Cancel"
				loading={working}
				onConfirm={() => void confirmSaveDefaults()}
				onCancel={() => {
					if (!working) setConfirmSave(false);
				}}
			/>

			{editingUser && (
				<AdminTokenEditModal
					user={editingUser}
					onClose={() => setEditingUser(null)}
					onSaved={load}
				/>
			)}
		</SuperAdminShell>
	);
}
