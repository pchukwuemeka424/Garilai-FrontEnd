import { NotebookDetailPage } from "@/components/research-notebook/NotebookApp";

export default async function StudentNotebookDetailPage({
	params,
}: {
	params: Promise<{ projectId: string }>;
}) {
	const { projectId } = await params;
	return <NotebookDetailPage variant="student" projectId={projectId} />;
}
