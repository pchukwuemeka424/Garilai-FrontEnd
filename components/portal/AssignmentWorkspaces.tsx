"use client";

import { LecturerPortal, StudentPortal } from "@/components/portal/PortalShell";
import AssignmentBriefDetailInner from "@/components/portal/pages/AssignmentBriefDetailPage";
import AssignmentBriefEditInner from "@/components/portal/pages/AssignmentBriefEditPage";
import AssignmentBriefNewInner from "@/components/portal/pages/AssignmentBriefNewPage";
import AssignmentBriefsInner from "@/components/portal/pages/AssignmentBriefsPage";
import StudentAssignmentDetailInner from "@/components/portal/pages/StudentAssignmentDetailPage";
import StudentAssignmentsInner from "@/components/portal/pages/StudentAssignmentsPage";

export function AssignmentBriefsPage() {
	return (
		<LecturerPortal>
			<AssignmentBriefsInner />
		</LecturerPortal>
	);
}

export function AssignmentBriefNewPage() {
	return (
		<LecturerPortal>
			<AssignmentBriefNewInner />
		</LecturerPortal>
	);
}

export function AssignmentBriefDetailPage() {
	return (
		<LecturerPortal>
			<AssignmentBriefDetailInner />
		</LecturerPortal>
	);
}

export function AssignmentBriefEditPage() {
	return (
		<LecturerPortal>
			<AssignmentBriefEditInner />
		</LecturerPortal>
	);
}

export function StudentAssignmentsPage() {
	return (
		<StudentPortal>
			<StudentAssignmentsInner />
		</StudentPortal>
	);
}

export function StudentAssignmentDetailPage() {
	return (
		<StudentPortal>
			<StudentAssignmentDetailInner />
		</StudentPortal>
	);
}
