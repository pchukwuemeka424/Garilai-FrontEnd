import { NotificationsPage } from "@/components/portal/SupportWorkspaces";

export const metadata = {
	title: "Notifications",
	description: "Updates from your research workspace.",
};

export default function Page() {
	return <NotificationsPage variant="student" />;
}
