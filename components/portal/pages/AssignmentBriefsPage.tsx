"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/portal/ui/button";
import { LoadingPage } from "@/components/portal/feedback/loading-page";
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

type FilterKey = "all" | "published" | "draft" | "upcoming" | "overdue";

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

function dueTone(days: number | null) {
  if (days == null) return "mid" as const;
  if (days < 0) return "risk" as const;
  if (days <= 3) return "review" as const;
  if (days <= 7) return "topic" as const;
  return "ok" as const;
}

function dueLabel(days: number | null) {
  if (days == null) return "No due date";
  if (days < 0) return `Overdue ${Math.abs(days)}d`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due in 1 day";
  return `Due in ${days} days`;
}

function formatDueDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export default function SupervisorAssignmentsPage() {
  const [briefs, setBriefs] = useState<BriefRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const list = (await apiFetch(
          "/api/v1/assignment-briefs",
        )) as BriefRow[];
        if (!cancelled) setBriefs(Array.isArray(list) ? list : []);
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
    const upcoming = briefs.filter((b) => {
      if (b.status === "draft") return false;
      const days = daysUntil(b.dueAt);
      return days != null && days >= 0;
    }).length;
    const overdue = briefs.filter((b) => {
      if (b.status === "draft") return false;
      const days = daysUntil(b.dueAt);
      return days != null && days < 0;
    }).length;
    return {
      total: briefs.length,
      published,
      draft,
      upcoming,
      overdue,
    };
  }, [briefs]);

  const filtered = useMemo(() => {
    let list = [...briefs];

    if (filter === "published") {
      list = list.filter((b) => b.status === "published");
    } else if (filter === "draft") {
      list = list.filter((b) => b.status === "draft");
    } else if (filter === "upcoming") {
      list = list.filter((b) => {
        if (b.status === "draft") return false;
        const days = daysUntil(b.dueAt);
        return days != null && days >= 0;
      });
    } else if (filter === "overdue") {
      list = list.filter((b) => {
        if (b.status === "draft") return false;
        const days = daysUntil(b.dueAt);
        return days != null && days < 0;
      });
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((b) => {
        const hay = [
          b.title,
          b.courseName || "",
          b.courseYear || "",
          b.status,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    return list.sort((a, b) => {
      const aDays = daysUntil(a.dueAt);
      const bDays = daysUntil(b.dueAt);
      if (aDays == null && bDays == null) {
        return a.title.localeCompare(b.title);
      }
      if (aDays == null) return 1;
      if (bDays == null) return -1;
      return aDays - bDays;
    });
  }, [briefs, filter, query]);

  const filters: { id: FilterKey; label: string; count: number }[] = [
    { id: "all", label: "All", count: stats.total },
    { id: "published", label: "Published", count: stats.published },
    { id: "draft", label: "Draft", count: stats.draft },
    { id: "upcoming", label: "Upcoming", count: stats.upcoming },
    { id: "overdue", label: "Overdue", count: stats.overdue },
  ];

  if (loading) return <LoadingPage label="Loading assignments…" />;

  return (
    <div className="portal-students">
      <header className="portal-students-hero">
        <div className="min-w-0">
          <p className="portal-students-kicker">Supervision</p>
          <h1 className="portal-students-title">Assignments</h1>
          <p className="portal-students-lead">
            Publish briefs, track due dates, and open each assignment to score
            student submissions.
          </p>
        </div>
        <div className="portal-students-hero-actions">
          <Button asChild>
            <Link href="/assignments/new">
              <Plus className="size-4" />
              New Assignment
            </Link>
          </Button>
        </div>
      </header>

      {error ? (
        <p className="portal-students-error" role="alert">
          {error}
        </p>
      ) : null}

      <section
        className="portal-students-kpis is-profile"
        aria-label="Assignments snapshot"
      >
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--navy">
            <ClipboardList className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">{stats.total}</p>
            <p className="portal-students-kpi-label">Assignments</p>
          </div>
        </article>
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--green">
            <CheckCircle2 className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">{stats.published}</p>
            <p className="portal-students-kpi-label">Published</p>
          </div>
        </article>
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--violet">
            <FileText className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">{stats.draft}</p>
            <p className="portal-students-kpi-label">Draft</p>
          </div>
        </article>
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--amber">
            <CalendarDays className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">{stats.upcoming}</p>
            <p className="portal-students-kpi-label">Upcoming due</p>
          </div>
        </article>
      </section>

      <section className="portal-students-panel">
        <div className="portal-students-toolbar">
          <div
            className="portal-students-filters"
            role="tablist"
            aria-label="Filter assignments"
          >
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                onClick={() => setFilter(item.id)}
                className={cn(
                  "portal-students-filter",
                  filter === item.id && "is-active",
                )}
              >
                {item.label}
                <span>{item.count}</span>
              </button>
            ))}
          </div>
          <label className="portal-students-search">
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

        {stats.total === 0 ? (
          <div className="portal-students-empty">
            <span className="portal-students-empty-icon" aria-hidden>
              <ClipboardList className="size-6" strokeWidth={1.75} />
            </span>
            <h2>No assignment briefs yet</h2>
            <p>
              Create a brief with instructions and grading criteria. Publish it
              so students can select it.
            </p>
            <Button asChild className="mt-2">
              <Link href="/assignments/new">
                <Plus className="size-4" />
                New Assignment
              </Link>
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="portal-students-empty">
            <h2>No matches</h2>
            <p>Try another filter or search term.</p>
            <Button
              type="button"
              variant="outline"
              className="mt-2"
              onClick={() => {
                setFilter("all");
                setQuery("");
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="portal-students-table-wrap">
            <table className="portal-students-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Course</th>
                  <th>Status</th>
                  <th>Due</th>
                  <th>Submissions</th>
                  <th>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((brief) => {
                  const days = daysUntil(brief.dueAt);
                  const published = brief.status === "published";
                  const submissions = brief.submissionCount ?? 0;
                  return (
                    <tr key={brief._id}>
                      <td>
                        <p className="portal-students-work-title">
                          {brief.title}
                        </p>
                        <p className="portal-students-work-meta">
                          {typeof brief.maxScore === "number"
                            ? `${brief.maxScore} marks`
                            : "100 marks"}
                        </p>
                      </td>
                      <td>
                        <p className="portal-students-work-title">
                          {brief.courseName || "No course set"}
                        </p>
                        {brief.courseYear ? (
                          <p className="portal-students-work-meta">
                            {brief.courseYear}
                          </p>
                        ) : null}
                      </td>
                      <td>
                        <span
                          className={cn(
                            "portal-students-status",
                            published ? "is-ok" : "is-mid",
                          )}
                        >
                          {published ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={cn(
                            "portal-students-status",
                            `is-${dueTone(days)}`,
                          )}
                        >
                          {dueLabel(days)}
                        </span>
                        {brief.dueAt ? (
                          <p className="portal-students-work-meta">
                            {formatDueDate(brief.dueAt)}
                          </p>
                        ) : null}
                      </td>
                      <td className="portal-students-activity">
                        {submissions}{" "}
                        {submissions === 1 ? "submission" : "submissions"}
                      </td>
                      <td className="portal-students-action">
                        <Button asChild size="sm">
                          <Link href={`/assignments/${brief._id}`}>
                            Open
                            <ArrowRight className="size-3.5" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
