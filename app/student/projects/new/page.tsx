import { NewProjectPage } from "@/components/portal/ProjectsWorkspace";

export const metadata = {
	title: "Create project",
	description: "Set up an assignment or research folder with clear writing instructions.",
};

export default function Page() {
	return <NewProjectPage variant="student" />;
}
