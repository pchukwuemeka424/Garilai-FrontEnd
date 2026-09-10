import { StudentAssistant } from "@/components/StudentAssistant";
import { StudentLayout } from "@/components/StudentLayout";

export const metadata = {
	title: "Student Assessment",
	description: "Writing workspace for projects, assignments, and supervisor feedback.",
};

export default function StudentAssistantPage() {
	return (
		<StudentLayout>
			<StudentAssistant />
		</StudentLayout>
	);
}
