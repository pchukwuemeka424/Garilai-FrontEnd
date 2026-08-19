"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Inbox,
  Search,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/portal/ui/avatar";
import { Button } from "@/components/portal/ui/button";
import { Progress } from "@/components/portal/ui/progress";
import { LoadingPage } from "@/components/portal/feedback/loading-page";
import { apiFetch } from "@/lib/portal-api";
import { projectTypeLabel } from "@/lib/portal/project-types";
import { cn } from "@/lib/portal/cn";

type StudentInfo = {
  id: string;
  name: string;
  email: string;
};

type SupervisorProject = {
  _id: string;
  title: string;
  projectType: string;
  progressPercent?: number;
  topicStatus?: string;
  stage?: string;
  updatedAt?: string;
  studentId: string;
  student: StudentInfo | null;
};

type PendingReview = {
  _id: string;
  student: StudentInfo | null;
};

type Supervisee = {
  student: StudentInfo;
  projects: SupervisorProject[];
  avgProgress: number;
  lastActivity?: string;
  pendingCount: number;
  topicPending: number;
};

type FilterKey = "all" | "at_risk" | "on_track" | "topic_pending" | "in_review";

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

function rowStatus(row: Supervisee) {
  if (row.pendingCount > 0) {
    return {
      label: row.pendingCount === 1 ? "1 in review" : `${row.pendingCount} in review`,
      tone: "review" as const,
    };
  }
  if (row.topicPending > 0) {
    return { label: "Topic pending", tone: "topic" as const };
  }
  if (row.avgProgress < 20) {
    return { label: "At risk", tone: "risk" as const };
  }
  if (row.avgProgress >= 50) {
    return { label: "On track", tone: "ok" as const };
  }
  return { label: "In progress", tone: "mid" as const };
}

export default function SupervisorStudentsPage() {
  const [projects, setProjects] = useState<SupervisorProject[]>([]);
  const [pending, setPending] = useState<PendingReview[]>([]);
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
        const [list, reviews] = await Promise.all([
          apiFetch("/api/v1/projects") as Promise<SupervisorProject[]>,
          apiFetch("/api/v1/supervisor/reviews").catch(
            () => [],
          ) as Promise<PendingReview[]>,
        ]);
        if (!cancelled) {
          setProjects(list);
          setPending(reviews);
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

  const pendingByStudent = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of pending) {
      const id = item.student?.id;
      if (!id) continue;
      map.set(id, (map.get(id) || 0) + 1);
    }
    return map;
  }, [pending]);

  const supervisees = useMemo(() => {
    const byStudent = new Map<string, Supervisee>();
    for (const project of projects) {
      const student =
        project.student ||
        ({
          id: String(project.studentId),
          name: "Student",
          email: "",
        } satisfies StudentInfo);
      const existing = byStudent.get(student.id);
      if (existing) {
        existing.projects.push(project);
      } else {
        byStudent.set(student.id, {
          student,
          projects: [project],
          avgProgress: 0,
          lastActivity: project.updatedAt,
          pendingCount: 0,
          topicPending: 0,
        });
      }
    }

    return [...byStudent.values()]
      .map((row) => {
        const avgProgress =
          row.projects.length === 0
            ? 0
            : Math.round(
                row.projects.reduce(
                  (sum, p) => sum + (p.progressPercent ?? 0),
                  0,
                ) / row.projects.length,
              );
        const lastActivity = row.projects
          .map((p) => p.updatedAt)
          .filter(Boolean)
          .sort(
            (a, b) =>
              new Date(b || 0).getTime() - new Date(a || 0).getTime(),
          )[0];
        const topicPending = row.projects.filter(
          (p) => p.topicStatus === "submitted",
        ).length;
        return {
          ...row,
          avgProgress,
          lastActivity,
          pendingCount: pendingByStudent.get(row.student.id) || 0,
          topicPending,
        };
      })
      .sort((a, b) => a.student.name.localeCompare(b.student.name));
  }, [projects, pendingByStudent]);

  const stats = useMemo(() => {
    const atRisk = supervisees.filter((s) => s.avgProgress < 20).length;
    const onTrack = supervisees.filter((s) => s.avgProgress >= 50).length;
    const topicPending = supervisees.filter((s) => s.topicPending > 0).length;
    const inReview = supervisees.filter((s) => s.pendingCount > 0).length;
    return {
      total: supervisees.length,
      atRisk,
      onTrack,
      topicPending,
      inReview,
      projects: projects.length,
      waiting: pending.length,
    };
  }, [supervisees, projects.length, pending.length]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return supervisees.filter((row) => {
      if (filter === "at_risk" && row.avgProgress >= 20) return false;
      if (filter === "on_track" && row.avgProgress < 50) return false;
      if (filter === "topic_pending" && row.topicPending === 0) return false;
      if (filter === "in_review" && row.pendingCount === 0) return false;
      if (!q) return true;
      const hay = [
        row.student.name,
        row.student.email,
        ...row.projects.map((p) => p.title),
        ...row.projects.map((p) => projectTypeLabel(p.projectType)),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [supervisees, filter, query]);

  const filters: { id: FilterKey; label: string; count: number }[] = [
    { id: "all", label: "All", count: stats.total },
    { id: "in_review", label: "In review", count: stats.inReview },
    { id: "topic_pending", label: "Topics", count: stats.topicPending },
    { id: "at_risk", label: "At risk", count: stats.atRisk },
    { id: "on_track", label: "On track", count: stats.onTrack },
  ];

  if (loading) return <LoadingPage label="Loading supervisees…" />;

  return (
    <div className="portal-students">
      <header className="portal-students-hero">
        <div>
          <p className="portal-students-kicker">Supervision</p>
          <h1 className="portal-students-title">Students</h1>
          <p className="portal-students-lead">
            People assigned to you — progress, pending topics, and chapters
            waiting for review.
          </p>
        </div>
        <div className="portal-students-hero-actions">
          {stats.waiting > 0 ? (
            <Button asChild>
              <Link href="/reviews">
                <Inbox className="size-4" />
                Review queue
                <span className="portal-students-count">{stats.waiting}</span>
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href="/reviews">Review desk</Link>
            </Button>
          )}
        </div>
      </header>

      {error ? (
        <p className="portal-students-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="portal-students-kpis" aria-label="Cohort snapshot">
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--navy">
            <Users className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">{stats.total}</p>
            <p className="portal-students-kpi-label">Supervisees</p>
          </div>
        </article>
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--violet">
            <FolderKanban className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">{stats.projects}</p>
            <p className="portal-students-kpi-label">Projects</p>
          </div>
        </article>
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--amber">
            <Clock3 className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">{stats.waiting}</p>
            <p className="portal-students-kpi-label">Waiting on you</p>
          </div>
        </article>
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--rose">
            <AlertTriangle className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">{stats.atRisk}</p>
            <p className="portal-students-kpi-label">At risk</p>
          </div>
        </article>
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--green">
            <CheckCircle2 className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">{stats.onTrack}</p>
            <p className="portal-students-kpi-label">On track</p>
          </div>
        </article>
      </section>

      <section className="portal-students-panel">
        <div className="portal-students-toolbar">
          <div className="portal-students-filters" role="tablist" aria-label="Filter students">
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
              placeholder="Search name, email, or project"
              aria-label="Search students"
            />
          </label>
        </div>

        {stats.total === 0 ? (
          <div className="portal-students-empty">
            <span className="portal-students-empty-icon" aria-hidden>
              <Users className="size-6" strokeWidth={1.75} />
            </span>
            <h2>No supervisees yet</h2>
            <p>
              Students appear here when they create a project or assignment and
              select you as lecturer.
            </p>
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
                  <th>Student</th>
                  <th>Primary work</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Activity</th>
                  <th>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const primary = row.projects[0];
                  const status = rowStatus(row);
                  return (
                    <tr key={row.student.id}>
                      <td>
                        <Link
                          href={`/students/${row.student.id}`}
                          className="portal-students-person"
                        >
                          <Avatar
                            name={row.student.name}
                            className="size-10 bg-[#ececf8] text-[#0D0B61]"
                          />
                          <span>
                            <span className="portal-students-name">
                              {row.student.name}
                            </span>
                            <span className="portal-students-email">
                              {row.student.email || "No email on file"}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <p className="portal-students-work-title">
                          {primary?.title || "No project yet"}
                        </p>
                        <p className="portal-students-work-meta">
                          {primary
                            ? projectTypeLabel(primary.projectType)
                            : "—"}
                          {row.projects.length > 1
                            ? ` · ${row.projects.length} projects`
                            : ""}
                        </p>
                      </td>
                      <td>
                        <span
                          className={cn(
                            "portal-students-status",
                            `is-${status.tone}`,
                          )}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td>
                        <div className="portal-students-progress">
                          <Progress
                            value={row.avgProgress}
                            className="h-1.5 flex-1 bg-[#e8ecf3]"
                            indicatorClassName={
                              row.avgProgress < 20
                                ? "bg-[#dc2626]"
                                : row.avgProgress < 50
                                  ? "bg-[#d97706]"
                                  : "bg-[#059669]"
                            }
                          />
                          <span>{row.avgProgress}%</span>
                        </div>
                      </td>
                      <td className="portal-students-activity">
                        {formatRelative(row.lastActivity)}
                      </td>
                      <td className="portal-students-action">
                        <Button asChild size="sm">
                          <Link href={`/students/${row.student.id}`}>
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
