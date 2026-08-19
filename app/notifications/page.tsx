import { NotificationsPage } from "@/components/portal/LecturerWorkspaces";

export const metadata = {
	title: "Notifications",
	description: "Alerts from student submissions and project activity.",
};

export default function Page() {
	return <NotificationsPage variant="lecturer" />;
}
