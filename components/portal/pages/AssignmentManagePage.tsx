"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/portal/ui/button";
import { ConfirmModal } from "@/components/portal/ui/confirm-modal";
import { Skeleton } from "@/components/portal/ui/skeleton";
import { apiFetch } from "@/lib/portal-api";
import { cn } from "@/lib/portal/cn";

type BriefRow = {
  _id: string;
  title: string;
  status: "draft" | "published";
  maxScore?: number;
  courseName?: string;
  courseYear?: string;
  dueAt?: string | null;
  updatedAt?: string;
  rubric?: unknown[];
  submissionCount?: number;
};

type StatusFilter = "all" | "published" | "draft";

const MANAGE_RETURN = "/supervision/assignments";
const NEW_HREF = `/assignments/new?return=${encodeURIComponent(MANAGE_RETURN)}`;

function formatDueDate(value?: string | null) {
  if (!value) return "No due date";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "No due date";
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function formatRelative(value?: string) {
  if (!value) return "—";
  const ms = Date.now() - new Date(value).getTime();
  if (Number.isNaN(ms)) return "—";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

function courseLine(brief: BriefRow) {
  return [brief.courseName || "No course set", brief.courseYear]
    .filter(Boolean)
    .join(" · ");
}

function marksLabel(brief: BriefRow) {
  const marks = typeof brief.maxScore === "number" ? brief.maxScore : 100;
  const criteria = Array.isArray(brief.rubric) ? brief.rubric.length : 0;
  return criteria > 0 ? `${marks} marks · ${criteria} criteria` : `${marks} marks`;
}

function editHref(id: string) {
  return `/assignments/${id}/edit?return=${encodeURIComponent(MANAGE_RETURN)}`;
}

export default function AssignmentManagePage() {
  const [briefs, setBriefs] = useState<BriefRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = (await apiFetch("/api/v1/assignment-briefs")) as BriefRow[];
      setBriefs(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const published = briefs.filter((b) => b.status === "published").length;
    const draft = briefs.filter((b) => b.status === "draft").length;
    return { all: briefs.length, published, draft };
  }, [briefs]);

  const filters = useMemo(
    () =>
      [
        { id: "all" as const, label: "All", count: stats.all },
        { id: "published" as const, label: "Published", count: stats.published },
        { id: "draft" as const, label: "Drafts", count: stats.draft },
      ] as const,
    [stats],
  );

  const filtered = useMemo(() => {
    let list = [...briefs];
    if (statusFilter !== "all") {
      list = list.filter((b) => b.status === statusFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((b) => {
        const hay = [b.title, b.courseName || "", b.courseYear || "", b.status]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return list.sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [briefs, query, statusFilter]);

  const confirmBrief = confirmId
    ? briefs.find((b) => b._id === confirmId) ?? null
    : null;

  async function onDelete() {
    if (!confirmId) return;
    setBusy(true);
    setError(null);
    setDeletingId(confirmId);
    try {
      await apiFetch(`/api/v1/assignment-briefs/${confirmId}`, {
        method: "DELETE",
      });
      setBriefs((prev) => prev.filter((b) => b._id !== confirmId));
      setConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setBusy(false);
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="sv-projects sv-assignments" aria-busy="true">
        <Skeleton className="h-[22rem] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="sv-projects sv-assignments">
      <Link href="/supervision" className="sv-brief-back">
        <ArrowLeft className="size-4" />
        Supervision
      </Link>

      {error ? (
        <p className="sv-projects-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="sv-assignments-header">
        <div className="sv-assignments-header-copy">
          <h1>Manage assignments</h1>
          <p>
            Create, edit, or delete assignment briefs. Published briefs are
            visible to your students.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={NEW_HREF}>
            <Plus className="size-4" />
            New assignment
          </Link>
        </Button>
      </div>

      <section className="sv-projects-board">
        <div className="sv-projects-toolbar">
          <div
            className="sv-projects-filters"
            role="tablist"
            aria-label="Filter assignments"
          >
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={statusFilter === item.id}
                onClick={() => setStatusFilter(item.id)}
                className={cn(
                  "sv-projects-filter",
                  statusFilter === item.id && "is-active",
                )}
              >
                {item.label}
                <span>{item.count}</span>
              </button>
            ))}
          </div>

          <div className="sv-projects-tools">
            <label className="sv-projects-search">
              <Search className="size-4" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title or course"
                aria-label="Search assignments"
              />
            </label>
          </div>
        </div>

        {briefs.length === 0 ? (
          <div className="sv-projects-empty">
            <span className="sv-projects-empty-icon" aria-hidden>
              <ClipboardList className="size-6" strokeWidth={1.75} />
            </span>
            <h2>No assignment briefs yet</h2>
            <p>
              Create a brief with instructions, deadline, and grading criteria.
              Students will see it once you publish.
            </p>
            <Button asChild>
              <Link href={NEW_HREF}>
                <Plus className="size-4" />
                New assignment
              </Link>
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="sv-projects-empty">
            <span className="sv-projects-empty-icon" aria-hidden>
              <Search className="size-6" strokeWidth={1.75} />
            </span>
            <h2>No matching assignments</h2>
            <p>Try another search or status filter.</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQuery("");
                setStatusFilter("all");
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="sv-assignments-manage-list">
            <div className="sv-assignments-manage-head" aria-hidden>
              <span>Assignment</span>
              <span>Due</span>
              <span>Updated</span>
              <span>Actions</span>
            </div>
            {filtered.map((brief) => {
              const published = brief.status === "published";
              const submissions = brief.submissionCount ?? 0;
              const isDeleting = deletingId === brief._id;

              return (
                <article
                  key={brief._id}
                  className={cn(
                    "sv-assignments-manage-row",
                    published ? "is-ok" : "is-mid",
                  )}
                >
                  <div className="sv-projects-row-main">
                    <span
                      className={cn(
                        "sv-projects-type",
                        published ? "is-teal" : "is-slate",
                      )}
                    >
                      {published ? "Published" : "Draft"}
                    </span>
                    <h2>{brief.title}</h2>
                    <p>
                      {courseLine(brief)} · {marksLabel(brief)} ·{" "}
                      <Users
                        className="inline size-3.5 align-[-0.1em]"
                        strokeWidth={1.75}
                      />{" "}
                      {submissions}{" "}
                      {submissions === 1 ? "submission" : "submissions"}
                    </p>
                  </div>

                  <div className="sv-assignments-due">
                    <CalendarDays className="size-3.5" strokeWidth={1.75} />
                    <span>{formatDueDate(brief.dueAt)}</span>
                  </div>

                  <p className="sv-assignments-manage-updated">
                    {formatRelative(brief.updatedAt)}
                  </p>

                  <div className="sv-assignments-manage-actions">
                    <Button asChild size="sm" variant="outline">
                      <Link href={editHref(brief._id)}>
                        <Pencil className="size-3.5" />
                        Edit
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="dangerSoft"
                      disabled={isDeleting}
                      onClick={() => setConfirmId(brief._id)}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmModal
        open={Boolean(confirmBrief)}
        title="Delete assignment?"
        description={
          confirmBrief
            ? `“${confirmBrief.title}” will be removed. Students will no longer see this brief. This cannot be undone.`
            : "This assignment will be removed."
        }
        confirmLabel="Delete assignment"
        loading={busy}
        onConfirm={() => {
          void onDelete();
        }}
        onCancel={() => {
          if (!busy) setConfirmId(null);
        }}
      />
    </div>
  );
}
