import { ProjectsListPage } from "@/components/portal/ProjectsWorkspace";

export const metadata = {
	title: "Projects",
	description: "Create and track research folders, theses, and dissertations.",
};

export default function Page() {
	return <ProjectsListPage variant="lecturer" />;
}
