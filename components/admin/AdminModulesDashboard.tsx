"use client";

import { useCallback, useEffect, useState } from "react";

import { AdminPanel, AdminShell } from "@/components/admin/AdminShell";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { useAuth } from "@/hooks/useAuth";
import { fetchAdminModules, updateAdminModules } from "@/lib/admin-api";
import {
	DEFAULT_UNIVERSITY_FEATURES,
	UNIVERSITY_FEATURE_KEYS,
	UNIVERSITY_FEATURE_LABELS,
	normalizeUniversityFeatures,
	type UniversityFeatureKey,
	type UniversityFeatures,
} from "@/lib/university-features";

export function AdminModulesDashboard() {
	const { ready } = useAdminGuard();
	const { user } = useAuth();
	const [features, setFeatures] = useState<UniversityFeatures>({ ...DEFAULT_UNIVERSITY_FEATURES });
	const [universityName, setUniversityName] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [savedAt, setSavedAt] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const modules = await fetchAdminModules(user?.universityId ?? undefined);
			setFeatures(normalizeUniversityFeatures(modules.features));
			setUniversityName(modules.name);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setLoading(false);
		}
	}, [user?.universityId]);

	useEffect(() => {
		if (ready) void load();
	}, [ready, load]);

	const toggle = async (key: UniversityFeatureKey) => {
		const next = { ...features, [key]: !features[key] };
		setFeatures(next);
		setSaving(true);
		setError(null);
		setSavedAt(null);
		try {
			const modules = await updateAdminModules({ features: next });
			setFeatures(normalizeUniversityFeatures(modules.features));
			setSavedAt(new Date().toISOString());
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			await load();
		} finally {
			setSaving(false);
		}
	};

	if (!ready || loading) {
		return (
			<AdminShell title="Product modules" subtitle="Loading…" breadcrumb="Academic products">
				<p className="muted">Loading…</p>
			</AdminShell>
		);
	}

	return (
		<AdminShell
			title="Product modules"
			subtitle={universityName ? `Modules for ${universityName}` : "Enable or disable product surfaces"}
			breadcrumb="Academic products · Modules"
		>
			{error && <p className="error-text">{error}</p>}
			{savedAt && <p className="muted">Saved.</p>}

			<AdminPanel
				title="Institutional modules"
				description="Disabled modules are hidden from student and lecturer navigation and blocked at the API. Governance consoles stay available."
			>
				<ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
					{UNIVERSITY_FEATURE_KEYS.map((key) => {
						const meta = UNIVERSITY_FEATURE_LABELS[key];
						return (
							<li
								key={key}
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									gap: "1rem",
									padding: "0.85rem 0",
									borderBottom: "1px solid var(--border, #e5e5e5)",
								}}
							>
								<div>
									<strong>{meta.label}</strong>
									<p className="muted" style={{ margin: "0.2rem 0 0" }}>
										{meta.description}
									</p>
								</div>
								<label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
									<span className="muted">{features[key] ? "On" : "Off"}</span>
									<input
										type="checkbox"
										checked={features[key]}
										disabled={saving}
										onChange={() => void toggle(key)}
									/>
								</label>
							</li>
						);
					})}
				</ul>
			</AdminPanel>
		</AdminShell>
	);
}
