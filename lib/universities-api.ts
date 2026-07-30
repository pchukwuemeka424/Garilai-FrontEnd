import { apiUrl } from "@/lib/api";

export type OnboardedUniversity = {
	catalogueId: string;
	name: string;
	country?: string;
};

export async function fetchOnboardedUniversities(
	country?: string,
): Promise<OnboardedUniversity[]> {
	const query = country ? `?country=${encodeURIComponent(country)}` : "";
	const candidates: string[] = [];

	// Prefer local API in split-dev even when NEXT_PUBLIC_FEYNMAN_BACKEND points at production.
	if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
		const host = window.location.hostname;
		if (host === "localhost" || host === "127.0.0.1") {
			candidates.push(`http://127.0.0.1:3141/api/auth/universities${query}`);
		}
	}
	candidates.push(apiUrl(`/api/auth/universities${query}`));

	let lastError: Error | null = null;
	for (const url of candidates) {
		try {
			const res = await fetch(url);
			if (!res.ok) {
				const data = (await res.json().catch(() => null)) as { error?: string } | null;
				lastError = new Error(data?.error ?? "Could not load institutions.");
				continue;
			}
			const data = (await res.json()) as { universities: OnboardedUniversity[] };
			return data.universities ?? [];
		} catch (err) {
			lastError = err instanceof Error ? err : new Error(String(err));
		}
	}

	throw lastError ?? new Error("Could not load institutions.");
}
