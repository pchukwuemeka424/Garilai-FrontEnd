import { StudentAssistant } from "@/components/StudentAssistant";
import { StudentLayout } from "@/components/StudentLayout";

export const metadata = {
	title: "Student Assistant",
	description: "Writing workspace for projects, assignments, supervisor feedback, and notifications.",
};

export default function StudentAssistantPage() {
	return (
		<StudentLayout>
			<StudentAssistant />
		</StudentLayout>
	);
}
