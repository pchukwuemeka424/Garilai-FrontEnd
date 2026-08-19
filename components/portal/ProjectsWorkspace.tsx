"use client";

import { Suspense } from "react";

import { LecturerPortal, StudentPortal } from "@/components/portal/PortalShell";
import NewProjectInner from "@/components/portal/pages/NewProjectPage";
import ProjectsListInner from "@/components/portal/pages/ProjectsListPage";
import StudentProjectsInner from "@/components/portal/pages/StudentProjectsPage";

export function ProjectsListPage({ variant }: { variant?: "lecturer" | "student" }) {
	if (variant === "student") {
		return (
			<StudentPortal>
				<StudentProjectsInner />
			</StudentPortal>
		);
	}
	return (
		<LecturerPortal>
			<ProjectsListInner />
		</LecturerPortal>
	);
}

export function NewProjectPage({ variant: _variant }: { variant?: "lecturer" | "student" }) {
	return (
		<StudentPortal>
			<Suspense fallback={null}>
				<NewProjectInner />
			</Suspense>
		</StudentPortal>
	);
}
