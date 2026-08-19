import { LecturerPortal } from "@/components/portal/PortalShell";
import Inner from "@/components/portal/pages/ChapterReviewPage";

export const metadata = {
	title: "Chapter review",
	description: "Review a submitted chapter.",
};

export default function Page() {
	return (
		<LecturerPortal fullHeight>
			<Inner />
		</LecturerPortal>
	);
}
