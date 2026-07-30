import { apiUrl } from "@/lib/api";

export type WorldUniversity = {
	id: string;
	label: string;
};

const COUNTRY_API_NAMES: Record<string, string> = {
	GB: "United Kingdom",
	US: "United States",
	GH: "Ghana",
	KE: "Kenya",
	ZA: "South Africa",
	CA: "Canada",
	IN: "India",
};

type HipolabsUniversity = {
	name?: string;
	domains?: string[];
};

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
}

function toUniversity(entry: HipolabsUniversity, countryCode: string): WorldUniversity | null {
	const name = entry.name?.trim();
	if (!name) return null;
	const domain = entry.domains?.[0]?.trim().toLowerCase();
	const id = domain
		? `${countryCode.toLowerCase()}-${slugify(domain)}`
		: `${countryCode.toLowerCase()}-${slugify(name)}`;
	return { id, label: name };
}

async function fetchFromHipolabs(countryCode: string): Promise<WorldUniversity[]> {
	const apiCountry = COUNTRY_API_NAMES[countryCode.toUpperCase()];
	if (!apiCountry) {
		throw new Error("Unsupported country for university catalogue.");
	}

	const res = await fetch(
		`http://universities.hipolabs.com/search?country=${encodeURIComponent(apiCountry)}`,
	);
	if (!res.ok) {
		throw new Error(`Could not load universities for ${apiCountry}.`);
	}

	const data = (await res.json()) as HipolabsUniversity[];
	if (!Array.isArray(data)) {
		throw new Error(`Unexpected university catalogue response for ${apiCountry}.`);
	}

	const seen = new Set<string>();
	const universities: WorldUniversity[] = [];
	for (const entry of data) {
		const university = toUniversity(entry, countryCode);
		if (!university || seen.has(university.id)) continue;
		seen.add(university.id);
		universities.push(university);
	}

	universities.sort((a, b) => a.label.localeCompare(b.label));
	return universities;
}

/** Fetch universities for a country via the backend catalogue proxy, with Hipolabs fallback. */
export async function fetchUniversitiesByCountry(countryCode: string): Promise<WorldUniversity[]> {
	const cataloguePath = `/api/auth/universities/catalogue?country=${encodeURIComponent(countryCode)}`;

	// Prefer the local API in split-dev even when NEXT_PUBLIC_FEYNMAN_BACKEND points at production.
	const candidates: string[] = [];
	if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
		const host = window.location.hostname;
		if (host === "localhost" || host === "127.0.0.1") {
			candidates.push(`http://127.0.0.1:3141${cataloguePath}`);
		}
	}
	candidates.push(apiUrl(cataloguePath));

	for (const url of candidates) {
		try {
			const res = await fetch(url);
			if (!res.ok) continue;
			const data = (await res.json()) as { universities: WorldUniversity[] };
			if (Array.isArray(data.universities) && data.universities.length > 0) {
				return data.universities;
			}
		} catch {
			// Try next candidate.
		}
	}

	return fetchFromHipolabs(countryCode);
}
