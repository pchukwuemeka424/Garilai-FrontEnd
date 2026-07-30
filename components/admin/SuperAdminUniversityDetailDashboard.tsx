"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { PlatformUsersPanel } from "@/components/admin/PlatformUsersPanel";
import { AdminInput } from "@/components/admin/AdminInput";
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
	fetchAdminUniversity,
	updateAdminUniversity,
	type UniversityDetailRecord,
} from "@/lib/admin-api";
import { universityDetailHref } from "@/lib/admin-university-href";

type TabId = "checklist" | "admins" | "users" | "tokens";

function resolveSlug(pathname: string, searchSlug: string | null): string {
	const fromQuery = searchSlug?.trim() ?? "";
	if (fromQuery) return fromQuery;

	const parts = pathname.split("/").filter(Boolean);
	// /super-admin/universities/:slug  or  /super-admin/universities/detail
	const uniIdx = parts.indexOf("universities");
	if (uniIdx < 0) return "";
	const next = parts[uniIdx + 1] ?? "";
	if (!next || next === "detail") return "";
	return decodeURIComponent(next);
}

function SuperAdminUniversityDetailInner() {
	const { ready } = useSuperAdminGuard();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const router = useRouter();
	const slug = resolveSlug(pathname, searchParams.get("slug") ?? searchParams.get("id"));

	const [university, setUniversity] = useState<UniversityDetailRecord | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [tab, setTab] = useState<TabId>("checklist");
	const [renameValue, setRenameValue] = useState("");
	const [studentTokens, setStudentTokens] = useState("");
	const [lecturerTokens, setLecturerTokens] = useState("");
	const [offboardOpen, setOffboardOpen] = useState(false);

	const load = useCallback(async () => {
		if (!slug) {
			setLoading(false);
			setError("Missing university slug.");
			setUniversity(null);
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const uni = await fetchAdminUniversity(slug);
			setUniversity(uni);
			setRenameValue(uni.name);
			setStudentTokens(
				uni.defaultStudentTokens != null ? String(uni.defaultStudentTokens) : "",
			);
			setLecturerTokens(
				uni.defaultLecturerTokens != null ? String(uni.defaultLecturerTokens) : "",
			);
			// Prefer canonical query URL so static export / soft nav stay consistent.
			if (!searchParams.get("slug") && uni.slug) {
				router.replace(universityDetailHref(uni));
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setUniversity(null);
		} finally {
			setLoading(false);
		}
	}, [slug, router, searchParams]);

	useEffect(() => {
		if (ready) void load();
	}, [load, ready]);

	const toggleStatus = async () => {
		if (!university) return;
		setSaving(true);
		setError(null);
		try {
			const updated = await updateAdminUniversity(university.id, {
				status: university.status === "active" ? "inactive" : "active",
			});
			setUniversity((prev) => (prev ? { ...prev, ...updated } : prev));
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	const rename = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!university || !renameValue.trim()) return;
		setSaving(true);
		setError(null);
		try {
			const updated = await updateAdminUniversity(university.id, { name: renameValue.trim() });
			setUniversity((prev) => (prev ? { ...prev, ...updated } : prev));
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	const confirmOffboard = async () => {
		if (!university) return;
		setSaving(true);
		setError(null);
		try {
			const result = await deleteAdminUniversity(university.id, university.name);
			setOffboardOpen(false);
			if (result.hardDeleted) {
				router.push("/super-admin/universities");
				return;
			}
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	const saveTokenDefaults = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!university) return;
		setSaving(true);
		setError(null);
		try {
			const parseOrNull = (raw: string) => {
				const t = raw.trim();
				if (!t) return null;
				const n = Number.parseInt(t, 10);
				if (!Number.isFinite(n) || n < 0) throw new Error("Enter valid token amounts.");
				return n;
			};
			const updated = await updateAdminUniversity(university.id, {
				defaultStudentTokens: parseOrNull(studentTokens),
				defaultLecturerTokens: parseOrNull(lecturerTokens),
			});
			setUniversity((prev) => (prev ? { ...prev, ...updated } : prev));
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	if (!ready || loading) {
		return (
			<SuperAdminShell title="University" subtitle="Loading…" breadcrumb="Platform · Universities">
				<p className="muted">Loading…</p>
			</SuperAdminShell>
		);
	}

	if (!university) {
		return (
			<SuperAdminShell title="University" subtitle="Not found" breadcrumb="Platform · Universities">
				{error && <p className="error-text">{error}</p>}
				<p className="muted">University not found.</p>
				<Link href="/super-admin/universities" className="ghost-btn">
					Back to universities
				</Link>
			</SuperAdminShell>
		);
	}

	const checklist = [
		{
			id: "active",
			label: "University is active",
			done: university.status === "active",
			hint: "Activating allows lecturers and students to register and sign in.",
		},
		{
			id: "admins",
			label: "At least one university admin",
			done: university.adminCount >= 1,
			hint: "Create a faculty or governance admin for this tenant.",
		},
		{
			id: "users",
			label: "Has students or lecturers",
			done: university.studentCount + university.lecturerCount > 0,
			hint: "Users can self-register once the university is active, or be created here.",
		},
	];

	return (
		<SuperAdminShell
			title={university.name}
			subtitle={`${(university.country ?? "NG").toUpperCase()} · ${university.catalogueId}`}
			breadcrumb="Platform · Universities"
			actions={
				<div className="admin-actions-row">
					<Link href="/super-admin/universities" className="ghost-btn">
						All universities
					</Link>
					<button type="button" className="ghost-btn" disabled={saving} onClick={() => void toggleStatus()}>
						{university.status === "active" ? "Deactivate" : "Activate"}
					</button>
					<button
						type="button"
						className="ghost-btn admin-btn-danger"
						disabled={saving}
						onClick={() => setOffboardOpen(true)}
					>
						Offboard
					</button>
				</div>
			}
		>
			{error && <p className="error-text">{error}</p>}

			<section className="admin-stats">
				<AdminStatCard label="Status" value={university.status} />
				<AdminStatCard label="Users" value={university.userCount} />
				<AdminStatCard label="Admins" value={university.adminCount} />
				<AdminStatCard label="Students" value={university.studentCount} />
				<AdminStatCard label="Lecturers" value={university.lecturerCount} />
				<AdminStatCard
					label="Onboarded"
					value={university.onboardedAt ? formatAdminDate(university.onboardedAt) : "—"}
				/>
			</section>

			<AdminPanel title="Rename">
				<form className="admin-form-grid" onSubmit={rename}>
					<AdminInput
						span
						label="Display name"
						value={renameValue}
						onChange={(e) => setRenameValue(e.target.value)}
						disabled={saving}
						required
						placeholder="University display name"
					/>
					<div className="admin-form-span">
						<button type="submit" className="primary-btn" disabled={saving}>
							Save name
						</button>
					</div>
				</form>
			</AdminPanel>

			<div className="admin-actions-row" style={{ marginBottom: "1rem", gap: "0.5rem" }}>
				{(
					[
						["checklist", "Onboarding"],
						["admins", "Admins"],
						["users", "Users"],
						["tokens", "Tokens"],
					] as const
				).map(([idTab, label]) => (
					<button
						key={idTab}
						type="button"
						className={tab === idTab ? "primary-btn" : "ghost-btn"}
						onClick={() => setTab(idTab)}
					>
						{label}
					</button>
				))}
			</div>

			{tab === "checklist" && (
				<AdminPanel title="Onboarding checklist">
					<ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
						{checklist.map((item) => (
							<li
								key={item.id}
								style={{
									padding: "0.75rem 0",
									borderBottom: "1px solid var(--border, #e5e5e5)",
								}}
							>
								<strong>
									{item.done ? "✓" : "○"} {item.label}
								</strong>
								<p className="muted" style={{ margin: "0.25rem 0 0" }}>
									{item.hint}
								</p>
							</li>
						))}
					</ul>
				</AdminPanel>
			)}

			{tab === "admins" && (
				<PlatformUsersPanel
					ready={ready}
					universities={[university]}
					fixedUniversityId={university.id}
					adminsOnly
					title="University admins"
				/>
			)}

			{tab === "users" && (
				<PlatformUsersPanel
					ready={ready}
					universities={[university]}
					fixedUniversityId={university.id}
					title="University users"
				/>
			)}

			{tab === "tokens" && (
				<AdminPanel
					title="Default token allowances"
					description="Students and lecturers at this university inherit these defaults unless a personal allowance is set. Leave blank to use platform defaults (400,000 students / 1,000,000 lecturers)."
				>
					<form className="admin-form-grid" onSubmit={(e) => void saveTokenDefaults(e)}>
						<AdminInput
							label="Default student tokens"
							type="number"
							min={0}
							value={studentTokens}
							onChange={(e) => setStudentTokens(e.target.value)}
							placeholder="400000"
							disabled={saving}
						/>
						<AdminInput
							label="Default lecturer tokens"
							type="number"
							min={0}
							value={lecturerTokens}
							onChange={(e) => setLecturerTokens(e.target.value)}
							placeholder="1000000"
							disabled={saving}
						/>
						<div className="admin-form-span">
							<button type="submit" className="primary-btn" disabled={saving}>
								{saving ? "Saving…" : "Save token defaults"}
							</button>
							<Link href="/super-admin/tokens" className="ghost-btn" style={{ marginLeft: "0.5rem" }}>
								Platform token console
							</Link>
						</div>
					</form>
					<p className="muted" style={{ marginTop: "1rem" }}>
						Current: students{" "}
						{university.defaultStudentTokens?.toLocaleString() ?? "platform default"} · lecturers{" "}
						{university.defaultLecturerTokens?.toLocaleString() ?? "platform default"}
					</p>
				</AdminPanel>
			)}

			<ConfirmDialog
				open={offboardOpen}
				title={`Offboard ${university.name}?`}
				description={`${university.name} will be deactivated and all affiliated users will be suspended. If no users remain, the university record will be removed.`}
				confirmLabel="Offboard"
				cancelLabel="Keep university"
				loading={saving}
				onConfirm={() => void confirmOffboard()}
				onCancel={() => {
					if (!saving) setOffboardOpen(false);
				}}
			/>
		</SuperAdminShell>
	);
}

export function SuperAdminUniversityDetailDashboard() {
	return (
		<Suspense
			fallback={
				<SuperAdminShell title="University" subtitle="Loading…" breadcrumb="Platform · Universities">
					<p className="muted">Loading…</p>
				</SuperAdminShell>
			}
		>
			<SuperAdminUniversityDetailInner />
		</Suspense>
	);
}
