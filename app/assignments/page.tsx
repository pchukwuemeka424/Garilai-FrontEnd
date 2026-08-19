import { LecturerPortal } from "@/components/portal/PortalShell";
import Inner from "@/components/portal/pages/AssignmentBriefsPage";

export const metadata = {
	title: "Assignments",
	description: "Publish briefs and mark submissions.",
};

export default function Page() {
	return (
		<LecturerPortal>
			<Inner />
		</LecturerPortal>
	);
}
