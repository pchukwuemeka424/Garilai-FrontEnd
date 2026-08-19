"use client";

import { LecturerPortal } from "@/components/portal/PortalShell";
import AnalyticsInner from "@/components/portal/pages/AnalyticsPage";
import NotificationsInner from "@/components/portal/pages/NotificationsPage";
import ReviewsDeskInner from "@/components/portal/pages/ReviewsDeskPage";

export function ReviewsPage({ variant: _variant }: { variant?: "lecturer" | "student" }) {
	return (
		<LecturerPortal>
			<ReviewsDeskInner />
		</LecturerPortal>
	);
}

export function AnalyticsPage({ variant: _variant }: { variant?: "lecturer" | "student" }) {
	return (
		<LecturerPortal>
			<AnalyticsInner />
		</LecturerPortal>
	);
}

export function NotificationsPage({ variant: _variant }: { variant?: "lecturer" | "student" }) {
	return (
		<LecturerPortal>
			<NotificationsInner audience="lecturer" />
		</LecturerPortal>
	);
}
