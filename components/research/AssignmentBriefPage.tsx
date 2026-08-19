"use client";

import { ResearchScopeBriefPage } from "@/components/research/ResearchScopeBriefPage";

export function AssignmentBriefPage({ variant = "lecturer" }: { variant?: "lecturer" | "student" }) {
	return <ResearchScopeBriefPage scope="assignment" variant={variant} />;
}
