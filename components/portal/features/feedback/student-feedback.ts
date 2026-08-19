export type Project = {
  _id: string;
  title: string;
  supervisor?: { id: string; name: string; email: string } | null;
};

export type ProjectPage = {
  _id: string;
  title: string;
  order?: number;
  reviewStatus?: "none" | "approved" | "needs_revision";
  reviewRemark?: string;
  reviewAnnotatedHtml?: string;
  reviewedAt?: string;
};

export type ProjectDetail = Project & { pages?: ProjectPage[] };

export type Chapter = {
  _id: string;
  number: number;
  title: string;
  status: string;
  rejectionReason?: string;
  reviewAnnotatedHtml?: string;
  approvedAt?: string;
  updatedAt?: string;
};

export type SupervisorComment = {
  key: string;
  projectId: string;
  projectTitle: string;
  pageId?: string;
  chapterId?: string;
  chapterTitle: string;
  status: "approved" | "needs_revision";
  remark: string;
  annotatedHtml?: string;
  reviewedAt?: string;
  supervisorName?: string;
};

export type ProjectFeedbackGroup = {
  projectId: string;
  projectTitle: string;
  supervisorName?: string;
  comments: SupervisorComment[];
};

export type StatusFilter = "all" | "needs_revision" | "approved";

export function normalizeTitle(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

export function formatDate(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelative(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(value);
}

export function feedbackDetailHref(comment: SupervisorComment) {
  return `/student/feedback/${comment.projectId}/${comment.key}`;
}

export function editorHref(comment: SupervisorComment) {
  return comment.pageId
    ? `/student/projects/${comment.projectId}/pages/${comment.pageId}`
    : `/student/projects/${comment.projectId}`;
}

export function buildSupervisorComments(
  project: ProjectDetail,
  chapters: Chapter[],
): SupervisorComment[] {
  const comments: SupervisorComment[] = [];
  const pages = [...(project.pages || [])].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );
  const coveredChapterIds = new Set<string>();

  for (const page of pages) {
    const status = page.reviewStatus;
    if (status !== "approved" && status !== "needs_revision") continue;

    const matched = chapters.find(
      (c) =>
        normalizeTitle(c.title || "") === normalizeTitle(page.title || ""),
    );
    if (matched) coveredChapterIds.add(matched._id);

    const remark =
      page.reviewRemark?.trim() || matched?.rejectionReason?.trim() || "";

    comments.push({
      key: `page-${page._id}`,
      projectId: project._id,
      projectTitle: project.title,
      pageId: page._id,
      chapterId: matched?._id,
      chapterTitle: page.title.trim() || "Untitled chapter",
      status,
      remark,
      annotatedHtml:
        page.reviewAnnotatedHtml?.trim() ||
        matched?.reviewAnnotatedHtml?.trim() ||
        undefined,
      reviewedAt:
        page.reviewedAt ||
        matched?.approvedAt ||
        matched?.updatedAt ||
        undefined,
      supervisorName: project.supervisor?.name,
    });
  }

  for (const chapter of chapters) {
    if (coveredChapterIds.has(chapter._id)) continue;
    const reason = chapter.rejectionReason?.trim() || "";
    const isNeedsRevision =
      chapter.status === "needs_revision" || chapter.status === "rejected";
    const isApproved =
      chapter.status === "approved" || chapter.status === "locked";

    if (isNeedsRevision && reason) {
      comments.push({
        key: `chapter-${chapter._id}`,
        projectId: project._id,
        projectTitle: project.title,
        chapterId: chapter._id,
        chapterTitle: chapter.title.trim() || `Chapter ${chapter.number}`,
        status: "needs_revision",
        remark: reason,
        annotatedHtml: chapter.reviewAnnotatedHtml?.trim() || undefined,
        reviewedAt: chapter.updatedAt,
        supervisorName: project.supervisor?.name,
      });
      continue;
    }

    if (isApproved && reason) {
      comments.push({
        key: `chapter-${chapter._id}`,
        projectId: project._id,
        projectTitle: project.title,
        chapterId: chapter._id,
        chapterTitle: chapter.title.trim() || `Chapter ${chapter.number}`,
        status: "approved",
        remark: reason,
        annotatedHtml: chapter.reviewAnnotatedHtml?.trim() || undefined,
        reviewedAt: chapter.approvedAt || chapter.updatedAt,
        supervisorName: project.supervisor?.name,
      });
    }
  }

  return comments.sort(
    (a, b) =>
      new Date(b.reviewedAt || 0).getTime() -
      new Date(a.reviewedAt || 0).getTime(),
  );
}

export function findCommentByKey(
  comments: SupervisorComment[],
  key: string,
): SupervisorComment | undefined {
  return comments.find((c) => c.key === key);
}
