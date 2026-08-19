import { ReviewsPage } from "@/components/portal/LecturerWorkspaces";

export const metadata = {
	title: "Reviews",
	description: "Read and refine saved papers and research drafts.",
};

export default function Page() {
	return <ReviewsPage variant="lecturer" />;
}
