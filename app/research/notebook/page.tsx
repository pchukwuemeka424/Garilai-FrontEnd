import { NotebookListPage } from "@/components/research-notebook/NotebookApp";

export const metadata = {
	title: "Research Notebook",
	description: "Capture notes, datasets, figures, and lab work.",
};

export default function LecturerNotebookPage() {
	return <NotebookListPage variant="lecturer" />;
}
