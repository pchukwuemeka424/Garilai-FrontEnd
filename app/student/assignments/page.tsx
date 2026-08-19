import { StudentPortal } from "@/components/portal/PortalShell";
import Inner from "@/components/portal/pages/StudentAssignmentsPage";

export const metadata = {
	title: "Assignments",
	description: "Coursework briefs from your lecturers.",
};

export default function Page() {
	return (
		<StudentPortal>
			<Inner />
		</StudentPortal>
	);
}
