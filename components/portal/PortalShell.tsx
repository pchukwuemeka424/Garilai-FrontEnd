"use client";

import type { ReactNode } from "react";

import { AulaLayout } from "@/components/AulaLayout";
import { useFeatureAiNoticeGate } from "@/components/legal/useFeatureAiNoticeGate";
import { StudentLayout } from "@/components/StudentLayout";
import { SUPERVISION_AI_NOTICE } from "@/lib/feature-ai-notice";

export function LecturerPortal({
	children,
	fullHeight = false,
}: {
	children: ReactNode;
	fullHeight?: boolean;
}) {
	const { aiNoticeModal } = useFeatureAiNoticeGate(SUPERVISION_AI_NOTICE, "/dashboard");

	return (
		<AulaLayout showRightPanel={false} fullHeight={fullHeight}>
			<div className="portal-workspace">{children}</div>
			{aiNoticeModal}
		</AulaLayout>
	);
}

export function StudentPortal({ children }: { children: ReactNode }) {
	return (
		<StudentLayout>
			<div className="portal-workspace">{children}</div>
		</StudentLayout>
	);
}
