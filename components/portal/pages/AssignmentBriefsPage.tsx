"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutGrid,
  Plus,
  Rows3,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/portal/ui/button";
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
  requiredItems?: string[];
  rubric?: unknown[];
  submissionCount?: number;
};

type ViewMode = "grid" | "list";
type StatusFilter = "all" | "published" | "draft";
type Tone = "ok" | "topic" | "risk" | "mid";

const VIEW_STORAGE_KEY = "sv-assignments-view";
const PAGE_SIZE = 10;

function daysUntil(value?: string | null) {
  if (!value) return null;
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(due);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function dueLabel(days: number | null) {
  if (days == null) return "No due date";
  if (days < 0) return `Overdue ${Math.abs(days)}d`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due in 1 day";
  return `Due in ${days} days`;
}

function formatDueDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
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

function dueTone(days: number | null, status: BriefRow["status"]): Tone {
  if (status === "draft") return "mid";
  if (days == null) return "ok";
  if (days < 0) return "risk";
  if (days <= 7) return "topic";
  return "ok";
}

function briefTone(brief: BriefRow): Tone {
  return dueTone(daysUntil(brief.dueAt), brief.status);
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

export default function SupervisorAssignmentsPage() {
  const [briefs, setBriefs] = useState<BriefRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ViewMode>("list");
  const skipViewWrite = useRef(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "list" || stored === "grid") setView(stored);
  }, []);

  useEffect(() => {
    if (skipViewWrite.current) {
      skipViewWrite.current = false;
      return;
    }
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const list = (await apiFetch(
          "/api/v1/assignment-briefs",
        )) as BriefRow[];
        if (!cancelled) {
          setBriefs(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

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
      if (a.status !== b.status) {
        return a.status === "draft" ? -1 : 1;
      }
      const aDays = daysUntil(a.dueAt);
      const bDays = daysUntil(b.dueAt);
      if (aDays == null && bDays == null) {
        return a.title.localeCompare(b.title);
      }
      if (aDays == null) return 1;
      if (bDays == null) return -1;
      return aDays - bDays;
    });
  }, [briefs, query, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filtered.length);
  const pagedBriefs = useMemo(
    () => filtered.slice(pageStart, pageEnd),
    [filtered, pageStart, pageEnd],
  );
  const showPagination = filtered.length > PAGE_SIZE;

  if (loading) {
    return (
      <div className="sv-projects sv-assignments" aria-busy="true">
        <Skeleton className="h-[22rem] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="sv-projects sv-assignments">
      {error ? (
        <p className="sv-projects-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="sv-assignments-header">
        <div className="sv-assignments-header-copy">
          <h1>Assignments</h1>
          <p>
            All assignment briefs you have created. Open one to review
            submissions, or create a new brief.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/assignments/new">
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
            <div className="sv-projects-view" role="group" aria-label="Layout">
              <button
                type="button"
                className={cn(view === "grid" && "is-active")}
                onClick={() => setView("grid")}
                aria-pressed={view === "grid"}
                aria-label="Card view"
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                type="button"
                className={cn(view === "list" && "is-active")}
                onClick={() => setView("list")}
                aria-pressed={view === "list"}
                aria-label="List view"
              >
                <Rows3 className="size-4" />
              </button>
            </div>
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
              <Link href="/assignments/new">
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
          <>
            {view === "grid" ? (
              <div className="sv-projects-grid">
                {pagedBriefs.map((brief) => (
                  <AssignmentGridCard key={brief._id} brief={brief} />
                ))}
              </div>
            ) : (
              <div className="sv-assignments-list">
                <div className="sv-assignments-list-head" aria-hidden>
                  <span>Assignment</span>
                  <span>Due</span>
                  <span>Submissions</span>
                  <span />
                </div>
                {pagedBriefs.map((brief) => (
                  <AssignmentListRow key={brief._id} brief={brief} />
                ))}
              </div>
            )}

            {showPagination ? (
              <nav
                className="sv-assignments-pagination"
                aria-label="Assignments pagination"
              >
                <p className="sv-assignments-pagination-meta">
                  {pageStart + 1}–{pageEnd} of {filtered.length}
                </p>
                <div className="sv-assignments-pagination-controls">
                  <button
                    type="button"
                    className="sv-assignments-page-btn"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="size-4" />
                    Prev
                  </button>
                  <span className="sv-assignments-page-indicator">
                    Page {safePage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className="sv-assignments-page-btn"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    aria-label="Next page"
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </nav>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function AssignmentListRow({ brief }: { brief: BriefRow }) {
  const days = daysUntil(brief.dueAt);
  const tone = briefTone(brief);
  const published = brief.status === "published";
  const submissions = brief.submissionCount ?? 0;
  const dueDate = formatDueDate(brief.dueAt);
  const href = `/assignments/${brief._id}`;

  return (
    <article className={cn("sv-assignments-row", `is-${tone}`)}>
      <Link href={href} className="sv-projects-row-main">
        <span
          className={cn("sv-projects-type", published ? "is-teal" : "is-slate")}
        >
          {published ? "Published" : "Draft"}
        </span>
        <h2>{brief.title}</h2>
        <p>
          {courseLine(brief)} · {marksLabel(brief)}
        </p>
      </Link>

      <div className="sv-assignments-due">
        <span>{dueDate || "No due date"}</span>
        <span className={cn("sv-projects-status", `is-${tone}`)}>
          {published ? dueLabel(days) : "Not published"}
        </span>
      </div>

      <p className="sv-assignments-subs">
        <Users className="size-3.5" strokeWidth={1.75} />
        {submissions} {submissions === 1 ? "submission" : "submissions"}
      </p>

      <Link href={href} className="sv-projects-open">
        Open
        <ArrowRight className="size-3.5" />
      </Link>
    </article>
  );
}

function AssignmentGridCard({ brief }: { brief: BriefRow }) {
  const days = daysUntil(brief.dueAt);
  const tone = briefTone(brief);
  const published = brief.status === "published";
  const submissions = brief.submissionCount ?? 0;
  const dueDate = formatDueDate(brief.dueAt);
  const href = `/assignments/${brief._id}`;

  return (
    <article className={cn("sv-projects-card", `is-${tone}`)}>
      <Link href={href} className="sv-projects-card-body">
        <div className="sv-projects-card-top">
          <span
            className={cn("sv-projects-type", published ? "is-teal" : "is-slate")}
          >
            {brief.courseYear || "Assignment"}
          </span>
          <span
            className={cn("sv-projects-status", published ? "is-ok" : "is-mid")}
          >
            {published ? "Published" : "Draft"}
          </span>
        </div>
        <h2 className="sv-projects-card-title">{brief.title}</h2>
        <p className="sv-projects-card-topic">
          {courseLine(brief)} · {marksLabel(brief)}
        </p>
      </Link>

      <div className="sv-assignments-card-meta">
        <p className="sv-assignments-due">
          <CalendarDays className="size-3.5" strokeWidth={1.75} />
          <span>
            {dueDate ? `${dueLabel(days)} · ${dueDate}` : dueLabel(days)}
          </span>
        </p>
        <p className="sv-assignments-subs">
          <Users className="size-3.5" strokeWidth={1.75} />
          {submissions} {submissions === 1 ? "submission" : "submissions"}
        </p>
      </div>

      <footer className="sv-projects-card-foot">
        <span>Updated {formatRelative(brief.updatedAt)}</span>
        <Link href={href} className="sv-projects-open">
          Open
          <ArrowRight className="size-3.5" />
        </Link>
      </footer>
    </article>
  );
}
