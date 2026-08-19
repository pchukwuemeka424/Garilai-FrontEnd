import { AnalyticsPage } from "@/components/portal/LecturerWorkspaces";

export const metadata = {
	title: "Analytics",
	description: "A snapshot of research activity in this workspace.",
};

export default function Page() {
	return <AnalyticsPage variant="lecturer" />;
}
