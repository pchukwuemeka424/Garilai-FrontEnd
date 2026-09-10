import { redirect } from "next/navigation";

import {
	canonicalResearchScopeSlug,
	isResearchWorkspaceSlug,
	RESEARCH_GENERATE_PATH,
	slugToScope,
} from "@/lib/research-generate-routes";

type Props = {
	params: Promise<{ scope: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toQuery(sp: Record<string, string | string[] | undefined>): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(sp)) {
		if (Array.isArray(value)) {
			for (const item of value) params.append(key, item);
		} else if (value) {
			params.set(key, value);
		}
	}
	const query = params.toString();
	return query ? `?${query}` : "";
}

/** Legacy /research/{type} → dedicated /research/generate/{type}. */
export default async function LecturerLegacyResearchTypeRedirect({ params, searchParams }: Props) {
	const { scope: slug } = await params;
	const query = toQuery(await searchParams);

	if (!isResearchWorkspaceSlug(slug)) {
		redirect(`/research${query}`);
	}

	const scope = slugToScope(slug);
	if (!scope || scope === "faculty" || scope === "report" || scope === "proposal") {
		redirect(`/research${query}`);
	}

	const canonical = canonicalResearchScopeSlug(slug) || slug;
	redirect(`${RESEARCH_GENERATE_PATH.lecturer}/${canonical}${query}`);
}
