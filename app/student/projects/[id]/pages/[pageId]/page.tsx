import { StudentPortal } from "@/components/portal/PortalShell";
import Inner from "@/components/portal/pages/ProjectEditorPage";

export const metadata = {
	title: "Editor",
	description: "Write and submit a chapter or assignment page.",
};

export default function Page() {
	return (
		<StudentPortal>
			<Inner />
		</StudentPortal>
	);
}
