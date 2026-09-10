import { Suspense } from "react";

import { SavedResearchEffortPage } from "@/components/research/SavedResearchEffortPage";

export const metadata = {
	title: "Effort report",
	description: "View the effort and attribution report for a saved research paper.",
};

export default function StudentSavedResearchEffortPage() {
	return (
		<Suspense fallback={null}>
			<SavedResearchEffortPage variant="student" />
		</Suspense>
	);
}
