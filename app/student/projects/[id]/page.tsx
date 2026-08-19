import { Suspense } from "react";
import { StudentPortal } from "@/components/portal/PortalShell";
import Inner from "@/components/portal/pages/StudentProjectDetailPage";

export const metadata = {
	title: "Project",
	description: "Project overview, pages, and review status.",
};

export default function Page() {
	return (
		<StudentPortal>
			<Suspense fallback={null}><Inner /></Suspense>
		</StudentPortal>
	);
}
