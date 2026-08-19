"use client";

import type { ReactNode } from "react";

import { AulaLayout } from "@/components/AulaLayout";
import { StudentLayout } from "@/components/StudentLayout";

export function LecturerPortal({
	children,
	fullHeight = false,
}: {
	children: ReactNode;
	fullHeight?: boolean;
}) {
	return (
		<AulaLayout showRightPanel={false} fullHeight={fullHeight}>
			<div className="portal-workspace">{children}</div>
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
