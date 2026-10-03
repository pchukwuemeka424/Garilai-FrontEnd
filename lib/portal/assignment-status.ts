import {
	isAwaitingNewReview,
	type ReviewTrailEvent,
} from "@/lib/portal/review-trail";

export type AssignmentStatusTone =
	| "graded"
	| "approved"
	| "revision"
	| "submitted"
	| "progress"
	| "idle";

export type AssignmentStatusMeta = {
	label: string;
	tone: AssignmentStatusTone;
};

type PageLike = {
	content?: string;
	order?: number;
	reviewStatus?: string | null;
	reviewTrail?: ReviewTrailEvent[];
};

export function primaryAssignmentPage<T extends PageLike>(
	pages: T[] | undefined,
): T | null {
	if (!Array.isArray(pages) || pages.length === 0) return null;
	return [...pages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0] ?? null;
}

/**
 * Student-facing assignment status.
 * After submit, page.reviewStatus is reset to "none" and the review trail
 * ends with type "submitted" — that must show as Assignment submitted, not Pending.
 * Untouched work is New; drafted-but-not-submitted is Pending.
 */
export function assignmentSubmissionStatus(row: {
	score?: number | null;
	pages?: PageLike[];
}): AssignmentStatusMeta {
	if (typeof row.score === "number") {
		return { label: "Graded", tone: "graded" };
	}
	const page = primaryAssignmentPage(row.pages);
	if (page?.reviewStatus === "approved") {
		return { label: "Approved", tone: "approved" };
	}
	if (page?.reviewStatus === "needs_revision") {
		return { label: "Needs revision", tone: "revision" };
	}
	if (isAwaitingNewReview(page?.reviewTrail)) {
		return { label: "Assignment submitted", tone: "submitted" };
	}
	if (page?.reviewStatus && page.reviewStatus !== "none") {
		return { label: "Assignment submitted", tone: "submitted" };
	}
	if (String(page?.content || "").trim()) {
		return { label: "Pending", tone: "progress" };
	}
	return { label: "New", tone: "idle" };
}
