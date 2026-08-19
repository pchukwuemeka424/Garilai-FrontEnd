import { StudentPortal } from "@/components/portal/PortalShell";
import Inner from "@/components/portal/pages/StudentProjectsPage";

export const metadata = {
	title: "Projects",
	description: "Create and track research folders, theses, and dissertations.",
};

export default function Page() {
	return (
		<StudentPortal>
			<Inner />
		</StudentPortal>
	);
}
