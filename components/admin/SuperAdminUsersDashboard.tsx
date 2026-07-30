"use client";

import { useCallback, useEffect, useState } from "react";

import { PlatformUsersPanel } from "@/components/admin/PlatformUsersPanel";
import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { useSuperAdminGuard } from "@/hooks/useAdminGuard";
import { fetchAdminUniversities, type UniversityRecord } from "@/lib/admin-api";

export function SuperAdminUsersDashboard() {
	const { ready } = useSuperAdminGuard();
	const [universities, setUniversities] = useState<UniversityRecord[]>([]);
	const [error, setError] = useState<string | null>(null);

	const loadUnis = useCallback(async () => {
		try {
			setUniversities(await fetchAdminUniversities());
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}, []);

	useEffect(() => {
		if (ready) void loadUnis();
	}, [loadUnis, ready]);

	return (
		<SuperAdminShell
			title="All users"
			subtitle="Create, suspend, and delete accounts across every onboarded university."
			breadcrumb="Platform"
		>
			{error && <p className="error-text">{error}</p>}
			<PlatformUsersPanel ready={ready} universities={universities} title="Platform users" />
		</SuperAdminShell>
	);
}
