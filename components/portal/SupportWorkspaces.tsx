"use client";

import { StudentPortal } from "@/components/portal/PortalShell";
import FeedbackInner from "@/components/portal/pages/FeedbackPage";
import StudentNotificationsInner from "@/components/portal/pages/StudentNotificationsPage";

export function FeedbackPage({ variant: _variant }: { variant?: "lecturer" | "student" }) {
	return (
		<StudentPortal>
			<FeedbackInner />
		</StudentPortal>
	);
}

export function NotificationsPage({ variant: _variant }: { variant?: "lecturer" | "student" }) {
	return (
		<StudentPortal>
			<StudentNotificationsInner />
		</StudentPortal>
	);
}
