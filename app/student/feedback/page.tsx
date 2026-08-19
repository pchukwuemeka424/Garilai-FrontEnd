import { FeedbackPage } from "@/components/portal/SupportWorkspaces";

export const metadata = {
	title: "Feedback",
	description: "Supervisor comments on your research drafts.",
};

export default function Page() {
	return <FeedbackPage variant="student" />;
}
