import { redirect } from "next/navigation";

type Props = {
	params: Promise<{ projectId: string }>;
};

export default async function Page({ params }: Props) {
	const { projectId } = await params;
	redirect(`/supervision/projects/${projectId}`);
}
