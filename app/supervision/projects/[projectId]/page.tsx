import { LecturerPortal } from "@/components/portal/PortalShell";
import Inner from "@/components/portal/pages/LecturerProjectDetailPage";

export const metadata = {
	title: "Project",
	description: "Supervised project overview.",
};

export default function Page() {
	return (
		<LecturerPortal>
			<Inner />
		</LecturerPortal>
	);
}
