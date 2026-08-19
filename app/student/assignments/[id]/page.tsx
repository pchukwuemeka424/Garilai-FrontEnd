import { StudentPortal } from "@/components/portal/PortalShell";
import Inner from "@/components/portal/pages/StudentAssignmentDetailPage";

export const metadata = {
	title: "Assignment",
	description: "Assignment brief, draft, and score.",
};

export default function Page() {
	return (
		<StudentPortal>
			<Inner />
		</StudentPortal>
	);
}
