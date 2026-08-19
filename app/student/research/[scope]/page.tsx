import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { ResearchScopeBriefPage } from "@/components/research/ResearchScopeBriefPage";
import {
	canonicalResearchScopeSlug,
	isResearchWorkspaceSlug,
	slugToScope,
} from "@/lib/research-generate-routes";
import { getScopeLabel } from "@/lib/research-ideas";

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { scope: slug } = await params;
	const scope = slugToScope(slug);
	if (!scope) return { title: "Research workspace" };
	const label = getScopeLabel(scope);
	return {
		title: label,
		description: `Prepare and generate a cited ${label.toLowerCase()} with the ${label.toLowerCase()} agent.`,
	};
}

export default async function StudentResearchWorkspacePage({ params, searchParams }: Props) {
	const { scope: slug } = await params;
	if (!isResearchWorkspaceSlug(slug)) notFound();
	const scope = slugToScope(slug);
	if (!scope) notFound();

	const query = toQuery(await searchParams);
	if (scope === "faculty" || scope === "report" || scope === "proposal") {
		redirect(`/student/research${query}`);
	}

	const canonical = canonicalResearchScopeSlug(slug);
	if (canonical && slug !== canonical) {
		redirect(`/student/research/${canonical}${query}`);
	}

	return (
		<Suspense fallback={null}>
			<ResearchScopeBriefPage scope={scope} variant="student" />
		</Suspense>
	);
}
