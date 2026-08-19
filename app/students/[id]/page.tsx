import { LecturerPortal } from "@/components/portal/PortalShell";
import Inner from "@/components/portal/pages/StudentDetailPage";

export const metadata = {
	title: "Student",
	description: "Projects for one supervisee.",
};

export default function Page() {
	return (
		<LecturerPortal>
			<Inner />
		</LecturerPortal>
	);
}
