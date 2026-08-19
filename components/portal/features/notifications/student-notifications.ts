export type NotificationItem = {
  _id: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt?: string;
};

export type NotificationsPayload = {
  items: NotificationItem[];
  unreadCount: number;
};

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/** Normalizes GET /api/v1/notifications into `{ items, unreadCount }`. */
export function parseNotificationsPayload(data: unknown): NotificationsPayload {
  if (Array.isArray(data)) {
    const items = data as NotificationItem[];
    return {
      items,
      unreadCount: items.filter((n) => !n.readAt).length,
    };
  }

  if (data && typeof data === "object") {
    const payload = data as Partial<NotificationsPayload>;
    const items = Array.isArray(payload.items)
      ? (payload.items as NotificationItem[])
      : [];
    const unreadCount =
      typeof payload.unreadCount === "number"
        ? payload.unreadCount
        : items.filter((n) => !n.readAt).length;
    return { items, unreadCount };
  }

  return { items: [], unreadCount: 0 };
}

export function isNotificationUnread(n: NotificationItem) {
  return !n.readAt;
}

/** Human label for notification `type` strings from the backend. */
export function notificationTypeLabel(type?: string) {
  switch (type) {
    case "assignment.scored":
      return "Score";
    case "page.approved":
      return "Approved";
    case "page.needs_revision":
      return "Revision";
    case "chapter.submitted":
      return "Submitted";
    case "chapter.approved":
      return "Approved";
    case "chapter.needs_revision":
      return "Revision";
    case "project.assigned":
      return "Project";
    default:
      return type?.includes(".")
        ? type.split(".").slice(-1)[0]?.replace(/_/g, " ") || "Update"
        : "Update";
  }
}

/**
 * Best student-facing destination for a notification, based on `type` + `data`.
 * Returns null when there is nothing actionable to open.
 */
export type NotificationAudience = "student" | "lecturer";

export function notificationHref(
  n: NotificationItem,
  audience: NotificationAudience = "student",
): string | null {
  const data = (n.data || {}) as Record<string, unknown>;
  const projectId = asString(data.projectId);
  const pageId = asString(data.pageId);
  const chapterId = asString(data.chapterId);

  if (audience === "lecturer") {
    switch (n.type) {
      case "chapter.submitted":
        return chapterId ? `/reviews/${chapterId}` : "/reviews";
      case "project.assigned":
        return projectId ? `/supervision/projects/${projectId}` : "/supervision/projects";
      default:
        break;
    }
    if (projectId && pageId) {
      return `/supervision/projects/${projectId}/pages/${pageId}`;
    }
    if (projectId) return `/supervision/projects/${projectId}`;
    if (chapterId) return `/reviews/${chapterId}`;
    return "/reviews";
  }

  switch (n.type) {
    case "assignment.scored":
      return projectId ? `/student/assignments/${projectId}` : null;
    case "page.approved":
    case "page.needs_revision":
      if (projectId && pageId) {
        return `/student/projects/${projectId}/pages/${pageId}`;
      }
      return projectId ? `/student/projects/${projectId}` : "/student/feedback";
    case "chapter.approved":
    case "chapter.needs_revision":
      if (projectId && chapterId) {
        return `/student/feedback/${projectId}/chapter-${chapterId}`;
      }
      if (projectId) return `/student/projects/${projectId}`;
      return "/student/feedback";
    case "chapter.submitted":
      return projectId ? `/student/projects/${projectId}` : "/student/projects";
    case "project.assigned":
      return projectId ? `/student/projects/${projectId}` : "/student/projects";
    default:
      break;
  }

  if (projectId && pageId) {
    return `/student/projects/${projectId}/pages/${pageId}`;
  }
  if (projectId) return `/student/projects/${projectId}`;
  if (chapterId) return "/student/feedback";
  return null;
}

export function formatNotificationWhen(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatNotificationRelative(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "Just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatNotificationWhen(value);
}
