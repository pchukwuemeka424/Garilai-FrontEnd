"use client";

import { StudentPortal } from "@/components/portal/PortalShell";
import FeedbackInner from "@/components/portal/pages/FeedbackPage";

export function FeedbackPage({ variant: _variant }: { variant?: "lecturer" | "student" }) {
	return (
		<StudentPortal>
			<FeedbackInner />
		</StudentPortal>
	);
}
