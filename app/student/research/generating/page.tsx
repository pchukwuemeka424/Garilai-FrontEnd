import { Suspense } from "react";
import type { Metadata } from "next";

import { ResearchLiveGeneratePage } from "@/components/research/ResearchLiveGeneratePage";

export const metadata: Metadata = {
	title: "Generating research",
	description: "Live progress while your research document is generated.",
};

export default function StudentResearchGeneratingPage() {
	return (
		<Suspense fallback={null}>
			<ResearchLiveGeneratePage variant="student" />
		</Suspense>
	);
}
