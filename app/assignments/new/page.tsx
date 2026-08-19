import { LecturerPortal } from "@/components/portal/PortalShell";
import Inner from "@/components/portal/pages/AssignmentBriefNewPage";

export const metadata = {
	title: "New assignment brief",
	description: "Create a coursework brief and rubric.",
};

export default function Page() {
	return (
		<LecturerPortal>
			<Inner />
		</LecturerPortal>
	);
}
