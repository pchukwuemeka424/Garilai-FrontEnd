import type { UniversityRecord } from "@/lib/admin-api";

/** Static-export-safe university detail URL. */
export function universityDetailHref(
	uni: Pick<UniversityRecord, "slug" | "id" | "catalogueId"> | string,
): string {
	const slug =
		typeof uni === "string"
			? uni.trim()
			: (uni.slug || uni.catalogueId || uni.id).trim();
	return `/super-admin/universities/detail?slug=${encodeURIComponent(slug)}`;
}
