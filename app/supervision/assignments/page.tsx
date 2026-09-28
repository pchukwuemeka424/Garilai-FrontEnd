import { LecturerPortal } from "@/components/portal/PortalShell";
import Inner from "@/components/portal/pages/AssignmentManagePage";

export const metadata = {
	title: "Manage assignments",
	description: "Create, edit, and delete assignment briefs.",
};

export default function Page() {
	return (
		<LecturerPortal>
			<Inner />
		</LecturerPortal>
	);
}
