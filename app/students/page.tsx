import { LecturerPortal } from "@/components/portal/PortalShell";
import Inner from "@/components/portal/pages/StudentsListPage";

export const metadata = {
	title: "Students",
	description: "Supervisees and their progress.",
};

export default function Page() {
	return (
		<LecturerPortal>
			<Inner />
		</LecturerPortal>
	);
}
