import { Suspense } from "react";

import { ResearchGeneratePage } from "@/components/research/ResearchGeneratePage";

export const metadata = {
	title: "Generate research",
	description: "Configure citation style and generate a full research document.",
};

export default function LecturerResearchGeneratePage() {
	return (
		<Suspense fallback={null}>
			<ResearchGeneratePage variant="lecturer" />
		</Suspense>
	);
}
