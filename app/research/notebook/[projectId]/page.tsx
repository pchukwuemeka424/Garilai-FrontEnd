import { NotebookDetailPage } from "@/components/research-notebook/NotebookApp";

export const metadata = {
	title: "Research Notebook",
	description: "Capture notes, datasets, figures, and lab work.",
};

export default async function LecturerNotebookDetailPage({
	params,
}: {
	params: Promise<{ projectId: string }>;
}) {
	const { projectId } = await params;
	return <NotebookDetailPage variant="lecturer" projectId={projectId} />;
}
