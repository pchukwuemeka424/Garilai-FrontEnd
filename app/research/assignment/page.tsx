import { Suspense } from "react";
import type { Metadata } from "next";

import { AssignmentBriefPage } from "@/components/research/AssignmentBriefPage";

export const metadata: Metadata = {
	title: "Assignment",
	description: "Enter your assignment topic, then generate a cited coursework assignment.",
};

export default function LecturerAssignmentPage() {
	return (
		<Suspense fallback={null}>
			<AssignmentBriefPage variant="lecturer" />
		</Suspense>
	);
}
