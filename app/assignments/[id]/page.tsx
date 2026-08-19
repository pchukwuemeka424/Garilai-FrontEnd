import { LecturerPortal } from "@/components/portal/PortalShell";
import Inner from "@/components/portal/pages/AssignmentBriefDetailPage";

export const metadata = {
	title: "Assignment brief",
	description: "Brief details and student submissions.",
};

export default function Page() {
	return (
		<LecturerPortal>
			<Inner />
		</LecturerPortal>
	);
}
