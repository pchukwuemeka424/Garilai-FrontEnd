import { StudentPortal } from "@/components/portal/PortalShell";
import Inner from "@/components/portal/pages/FeedbackDetailPage";

export const metadata = {
	title: "Feedback",
	description: "Supervisor comment on your draft.",
};

export default function Page() {
	return (
		<StudentPortal>
			<Inner />
		</StudentPortal>
	);
}
