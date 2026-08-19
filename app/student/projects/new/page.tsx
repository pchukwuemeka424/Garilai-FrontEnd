import { NewProjectPage } from "@/components/portal/ProjectsWorkspace";

export const metadata = {
	title: "New project",
	description: "Create a research folder for your study.",
};

export default function Page() {
	return <NewProjectPage variant="student" />;
}
