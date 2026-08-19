import { redirect } from "next/navigation";

type Props = {
	params: Promise<{ projectId: string; pageId: string }>;
};

export default async function Page({ params }: Props) {
	const { projectId, pageId } = await params;
	redirect(`/supervision/projects/${projectId}/pages/${pageId}`);
}
