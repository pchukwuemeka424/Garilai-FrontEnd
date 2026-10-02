import { Suspense } from "react";

import { ResearchAssistant } from "@/components/ResearchAssistant";
import { StudentLayout } from "@/components/StudentLayout";

export default function StudentResearchPage() {
	return (
		<StudentLayout>
			<Suspense fallback={<p className="stu-loading">Loading research…</p>}>
				<ResearchAssistant variant="student" withLayout={false} />
			</Suspense>
		</StudentLayout>
	);
}
