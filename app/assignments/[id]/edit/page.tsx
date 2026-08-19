import { LecturerPortal } from "@/components/portal/PortalShell";
import Inner from "@/components/portal/pages/AssignmentBriefEditPage";

export const metadata = {
	title: "Edit assignment brief",
	description: "Update a coursework brief.",
};

export default function Page() {
	return (
		<LecturerPortal>
			<Inner />
		</LecturerPortal>
	);
}
