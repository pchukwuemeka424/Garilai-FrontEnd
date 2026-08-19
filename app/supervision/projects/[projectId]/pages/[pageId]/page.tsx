import { LecturerPortal } from "@/components/portal/PortalShell";
import Inner from "@/components/portal/pages/LecturerPageReviewPage";

export const metadata = {
	title: "Review",
	description: "Annotate and approve a student page.",
};

export default function Page() {
	return (
		<LecturerPortal fullHeight>
			<Inner />
		</LecturerPortal>
	);
}
