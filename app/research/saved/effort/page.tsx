import { Suspense } from "react";

import { SavedResearchEffortPage } from "@/components/research/SavedResearchEffortPage";

export const metadata = {
	title: "Effort report",
	description: "View the effort and attribution report for a saved research paper.",
};

export default function LecturerSavedResearchEffortPage() {
	return (
		<Suspense fallback={null}>
			<SavedResearchEffortPage variant="lecturer" />
		</Suspense>
	);
}
