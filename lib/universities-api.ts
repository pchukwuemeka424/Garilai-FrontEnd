import { apiUrl } from "@/lib/api";

export type OnboardedUniversity = {
	catalogueId: string;
	name: string;
};

export async function fetchOnboardedUniversities(): Promise<OnboardedUniversity[]> {
	const res = await fetch(apiUrl("/api/auth/universities"));
	if (!res.ok) {
		const data = (await res.json().catch(() => null)) as { error?: string } | null;
		throw new Error(data?.error ?? "Could not load institutions.");
	}
	const data = (await res.json()) as { universities: OnboardedUniversity[] };
	return data.universities ?? [];
}
