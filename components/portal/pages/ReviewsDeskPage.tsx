"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Inbox,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/portal/ui/avatar";
import { Button } from "@/components/portal/ui/button";
import { Progress } from "@/components/portal/ui/progress";
import { Skeleton } from "@/components/portal/ui/skeleton";
import { apiFetch } from "@/lib/portal-api";
import { projectTypeLabel } from "@/lib/portal/project-types";
import { cn } from "@/lib/portal/cn";
import { useAuth } from "@/hooks/useAuth";

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
  topic?: string;
  stage?: string;
  updatedAt?: string;
  studentId: string;
  student: StudentInfo | null;
};

type PendingReview = {
  _id: string;
  title: string;
  number: number;
  status: string;
  updatedAt?: string;
  projectId?: string;
  projectTitle: string;
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

type AssignmentBrief = {
  _id: string;
  title: string;
  dueAt?: string | null;
  status?: string;
  courseName?: string;
};

type DeskTab = "queue" | "attention" | "cohort";
type SortKey = "oldest" | "newest" | "chapter" | "student";
type CohortFilter = "all" | "at_risk" | "on_track" | "topic_pending";

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatRelative(value?: string) {
  if (!value) return "Recently";
  const ms = Date.now() - new Date(value).getTime();
  if (Number.isNaN(ms)) return "Recently";
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

function waitingDays(value?: string) {
  if (!value) return 0;
  const ms = Date.now() - new Date(value).getTime();
  if (Number.isNaN(ms) || ms < 0) return 0;
  return Math.floor(ms / 86_400_000);
}

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

function waitingTone(days: number) {
  if (days >= 5) return "risk" as const;
  if (days >= 2) return "review" as const;
  return "mid" as const;
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

export default function LecturerDashboard() {
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] || "Lecturer";

  const [projects, setProjects] = useState<SupervisorProject[]>([]);
  const [pending, setPending] = useState<PendingReview[]>([]);
  const [briefs, setBriefs] = useState<AssignmentBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<DeskTab>("queue");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("oldest");
  const [cohortFilter, setCohortFilter] = useState<CohortFilter>("all");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [doneTasks, setDoneTasks] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  const loadDesk = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [projectList, reviewList, briefList] = await Promise.all([
        apiFetch("/api/v1/projects") as Promise<SupervisorProject[]>,
        apiFetch("/api/v1/supervisor/reviews").catch(
          () => [],
        ) as Promise<PendingReview[]>,
        apiFetch("/api/v1/assignment-briefs").catch(
          () => [],
        ) as Promise<AssignmentBrief[]>,
      ]);
      setProjects(projectList);
      setPending(reviewList);
      setBriefs(Array.isArray(briefList) ? briefList : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load desk");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDesk();
  }, [loadDesk]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const param = new URLSearchParams(window.location.search).get("tab");
    if (param === "attention" || param === "cohort" || param === "queue") {
      setTab(param);
    }
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

  const avgProgress = useMemo(() => {
    if (projects.length === 0) return 0;
    return Math.round(
      projects.reduce((sum, p) => sum + (p.progressPercent ?? 0), 0) /
        projects.length,
    );
  }, [projects]);

  const atRiskStudents = useMemo(
    () => supervisees.filter((s) => s.avgProgress < 20),
    [supervisees],
  );

  const topicQueue = useMemo(
    () => projects.filter((p) => p.topicStatus === "submitted"),
    [projects],
  );

  const staleReviews = useMemo(
    () => pending.filter((p) => waitingDays(p.updatedAt) >= 2),
    [pending],
  );

  const attentionCount =
    atRiskStudents.length + topicQueue.length + staleReviews.length;

  const upcomingDeadlines = useMemo(() => {
    return briefs
      .filter((b) => b.dueAt && b.status !== "draft")
      .map((b) => ({
        ...b,
        days: daysUntil(b.dueAt),
      }))
      .sort((a, b) => {
        const aT = new Date(a.dueAt || 0).getTime();
        const bT = new Date(b.dueAt || 0).getTime();
        return aT - bT;
      })
      .slice(0, 5);
  }, [briefs]);

  const deskTasks = useMemo(() => {
    const tasks: {
      id: string;
      label: string;
      href: string;
      count: number;
    }[] = [];
    if (pending.length > 0) {
      tasks.push({
        id: "reviews",
        label: `Provide feedback on ${pending.length} review${pending.length === 1 ? "" : "s"}`,
        href: "/reviews",
        count: pending.length,
      });
    }
    if (topicQueue.length > 0) {
      tasks.push({
        id: "topics",
        label: `Approve ${topicQueue.length} pending topic${topicQueue.length === 1 ? "" : "s"}`,
        href: "/reviews?tab=attention",
        count: topicQueue.length,
      });
    }
    if (atRiskStudents.length > 0) {
      tasks.push({
        id: "at-risk",
        label: `Check in with ${atRiskStudents.length} at-risk student${atRiskStudents.length === 1 ? "" : "s"}`,
        href: "/students",
        count: atRiskStudents.length,
      });
    }
    if (staleReviews.length > 0) {
      tasks.push({
        id: "stale",
        label: `Clear ${staleReviews.length} aging review${staleReviews.length === 1 ? "" : "s"} (2+ days)`,
        href: "/reviews",
        count: staleReviews.length,
      });
    }
    if (tasks.length === 0) {
      tasks.push({
        id: "clear",
        label: "Desk is clear — review cohort progress",
        href: "/students",
        count: 0,
      });
    }
    return tasks.slice(0, 4);
  }, [pending.length, topicQueue.length, atRiskStudents.length, staleReviews.length]);

  const filteredPending = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...pending];
    if (q) {
      list = list.filter((item) => {
        const hay = [
          item.title,
          item.projectTitle,
          item.student?.name,
          item.student?.email,
          String(item.number),
          item.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    list.sort((a, b) => {
      if (sortKey === "chapter") return a.number - b.number;
      if (sortKey === "student") {
        return (a.student?.name || "").localeCompare(b.student?.name || "");
      }
      const aTime = new Date(a.updatedAt || 0).getTime();
      const bTime = new Date(b.updatedAt || 0).getTime();
      return sortKey === "newest" ? bTime - aTime : aTime - bTime;
    });
    return list;
  }, [pending, query, sortKey]);

  const filteredCohort = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...supervisees];
    if (cohortFilter === "at_risk") {
      list = list.filter((s) => s.avgProgress < 20);
    } else if (cohortFilter === "on_track") {
      list = list.filter((s) => s.avgProgress >= 50);
    } else if (cohortFilter === "topic_pending") {
      list = list.filter((s) => s.topicPending > 0);
    }
    if (q) {
      list = list.filter((s) => {
        const hay = [
          s.student.name,
          s.student.email,
          ...s.projects.map((p) => p.title),
          ...s.projects.map((p) => p.topic || ""),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [supervisees, query, cohortFilter]);

  async function approveTopic(projectId: string) {
    setApprovingId(projectId);
    setApproveError(null);
    try {
      await apiFetch(`/api/v1/projects/${projectId}/topic/approve`, {
        method: "POST",
      });
      setProjects((prev) =>
        prev.map((p) =>
          p._id === projectId ? { ...p, topicStatus: "approved" } : p,
        ),
      );
    } catch (err) {
      setApproveError(
        err instanceof Error ? err.message : "Could not approve topic",
      );
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <div className="portal-students portal-desk">
      <header className="portal-students-hero">
        <div>
          <p className="portal-students-kicker">Supervision</p>
          <h1 className="portal-students-title">
            {greetingForNow()}, {firstName}
          </h1>
          <p className="portal-students-lead">
            Chapters waiting on you, topics to approve, and students who need
            attention.
          </p>
        </div>
        <div className="portal-students-hero-actions">
          <Button
            variant="outline"
            disabled={loading || refreshing}
            onClick={() => void loadDesk(true)}
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            Refresh
          </Button>
          <Button asChild variant="outline">
            <Link href="/students">Students</Link>
          </Button>
        </div>
      </header>

      {error ? (
        <p className="portal-students-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="portal-students-kpis is-desk" aria-label="Desk snapshot">
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--amber">
            <Inbox className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">
              {loading ? "—" : pending.length}
            </p>
            <p className="portal-students-kpi-label">In review</p>
          </div>
        </article>
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--navy">
            <Users className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">
              {loading ? "—" : supervisees.length}
            </p>
            <p className="portal-students-kpi-label">Supervisees</p>
          </div>
        </article>
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--violet">
            <FolderKanban className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">
              {loading ? "—" : projects.length}
            </p>
            <p className="portal-students-kpi-label">Projects</p>
          </div>
        </article>
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--green">
            <CheckCircle2 className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">
              {loading ? "—" : `${avgProgress}%`}
            </p>
            <p className="portal-students-kpi-label">Avg. progress</p>
          </div>
        </article>
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--rose">
            <AlertTriangle className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">
              {loading ? "—" : attentionCount}
            </p>
            <p className="portal-students-kpi-label">Needs attention</p>
          </div>
        </article>
      </section>

      <div className="portal-desk-layout">
        <section className="portal-students-panel">
          <div className="portal-students-toolbar">
            <div className="portal-students-filters" role="tablist" aria-label="Desk views">
              {(
                [
                  ["queue", "Queue", pending.length],
                  ["attention", "Attention", attentionCount],
                  ["cohort", "Cohort", supervisees.length],
                ] as const
              ).map(([id, label, count]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => startTransition(() => setTab(id))}
                  className={cn(
                    "portal-students-filter",
                    tab === id && "is-active",
                  )}
                >
                  {label}
                  <span>{count}</span>
                </button>
              ))}
            </div>
            <div className="portal-desk-tools">
              <label className="portal-students-search">
                <Search className="size-4" aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    tab === "cohort"
                      ? "Search students or projects"
                      : "Search student, chapter, or project"
                  }
                  aria-label="Search desk"
                />
              </label>
              {tab === "queue" ? (
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="portal-desk-select"
                  aria-label="Sort reviews"
                >
                  <option value="oldest">Oldest first</option>
                  <option value="newest">Newest first</option>
                  <option value="chapter">Chapter</option>
                  <option value="student">Student</option>
                </select>
              ) : null}
              {tab === "cohort" ? (
                <select
                  value={cohortFilter}
                  onChange={(e) =>
                    setCohortFilter(e.target.value as CohortFilter)
                  }
                  className="portal-desk-select"
                  aria-label="Filter cohort"
                >
                  <option value="all">All students</option>
                  <option value="at_risk">At risk</option>
                  <option value="on_track">On track</option>
                  <option value="topic_pending">Topic pending</option>
                </select>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div className="portal-desk-skel">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ) : tab === "queue" ? (
            filteredPending.length === 0 ? (
              <div className="portal-students-empty">
                <span className="portal-students-empty-icon" aria-hidden>
                  <Inbox className="size-6" strokeWidth={1.75} />
                </span>
                <h2>
                  {pending.length === 0
                    ? "Queue is clear"
                    : "No matching reviews"}
                </h2>
                <p>
                  {pending.length === 0
                    ? "Submitted chapters appear here when they need a decision."
                    : "Try another search or sort order."}
                </p>
              </div>
            ) : (
              <div className="portal-students-table-wrap">
                <table className="portal-students-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Chapter</th>
                      <th>Waiting</th>
                      <th>
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPending.map((item) => {
                      const days = waitingDays(item.updatedAt);
                      return (
                        <tr key={item._id}>
                          <td>
                            <div className="portal-students-person">
                              <Avatar
                                name={item.student?.name || "Student"}
                                className="size-10 bg-[#ececf8] text-[#0D0B61]"
                              />
                              <span>
                                <span className="portal-students-name">
                                  {item.student?.name || "Student"}
                                </span>
                                <span className="portal-students-email">
                                  {item.projectTitle}
                                </span>
                              </span>
                            </div>
                          </td>
                          <td>
                            <p className="portal-students-work-title">
                              Ch.{item.number} · {item.title}
                            </p>
                            <p className="portal-students-work-meta">
                              Updated {formatRelative(item.updatedAt)}
                            </p>
                          </td>
                          <td>
                            <span
                              className={cn(
                                "portal-students-status",
                                `is-${waitingTone(days)}`,
                              )}
                            >
                              {days >= 2 ? `${days}d waiting` : "In review"}
                            </span>
                          </td>
                          <td className="portal-students-action">
                            <Button asChild size="sm">
                              <Link href={`/reviews/${item._id}`}>
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
            )
          ) : tab === "attention" ? (
            <div className="portal-desk-attention">
              <section>
                <div className="portal-desk-section-head">
                  <h3>
                    <Clock3 className="size-3.5" />
                    Aging reviews
                  </h3>
                  <span>Waiting 2+ days</span>
                </div>
                {staleReviews.length === 0 ? (
                  <p className="portal-desk-quiet">No aging reviews.</p>
                ) : (
                  <ul className="portal-desk-list">
                    {staleReviews.slice(0, 6).map((item) => {
                      const days = waitingDays(item.updatedAt);
                      return (
                        <li key={item._id} className="portal-desk-list-row">
                          <div className="min-w-0">
                            <p className="portal-students-work-title">
                              Ch.{item.number} · {item.title}
                            </p>
                            <p className="portal-students-work-meta">
                              {item.student?.name || "Student"} ·{" "}
                              {item.projectTitle}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "portal-students-status",
                              `is-${waitingTone(days)}`,
                            )}
                          >
                            {days}d waiting
                          </span>
                          <Button asChild size="sm">
                            <Link href={`/reviews/${item._id}`}>
                              Open
                              <ArrowRight className="size-3.5" />
                            </Link>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section>
                <div className="portal-desk-section-head">
                  <h3>
                    <CheckCircle2 className="size-3.5" />
                    Topic approvals
                  </h3>
                  <span>Pending topics</span>
                </div>
                {approveError ? (
                  <p className="portal-students-error">{approveError}</p>
                ) : null}
                {topicQueue.length === 0 ? (
                  <p className="portal-desk-quiet">No topics waiting.</p>
                ) : (
                  <ul className="portal-desk-list">
                    {topicQueue.map((project) => (
                      <li key={project._id} className="portal-desk-list-row">
                        <div className="min-w-0">
                          <p className="portal-students-work-title">
                            {project.title}
                          </p>
                          <p className="portal-students-work-meta">
                            {project.student?.name || "Student"} ·{" "}
                            {project.topic || "Untitled topic"}
                          </p>
                        </div>
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href={`/students/${project.student?.id || project.studentId}`}
                          >
                            Student
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          disabled={approvingId === project._id}
                          onClick={() => void approveTopic(project._id)}
                        >
                          {approvingId === project._id
                            ? "Approving…"
                            : "Approve"}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <div className="portal-desk-section-head">
                  <h3>
                    <AlertTriangle className="size-3.5" />
                    At-risk students
                  </h3>
                  <span>Below 20% progress</span>
                </div>
                {atRiskStudents.length === 0 ? (
                  <p className="portal-desk-quiet">No students flagged.</p>
                ) : (
                  <ul className="portal-desk-list">
                    {atRiskStudents.map(
                      ({
                        student,
                        projects: studentProjects,
                        avgProgress: avg,
                      }) => {
                        const primary = studentProjects[0];
                        return (
                          <li key={student.id} className="portal-desk-list-row">
                            <div className="portal-students-person">
                              <Avatar
                                name={student.name}
                                className="size-10 bg-[#fff1f2] text-[#be123c]"
                              />
                              <span>
                                <span className="portal-students-name">
                                  {student.name}
                                </span>
                                <span className="portal-students-email">
                                  {primary
                                    ? primary.title
                                    : student.email || "No project"}
                                </span>
                              </span>
                            </div>
                            <div className="portal-students-progress">
                              <Progress
                                value={avg}
                                className="h-1.5 flex-1 bg-[#e8ecf3]"
                                indicatorClassName="bg-[#dc2626]"
                              />
                              <span>{avg}%</span>
                            </div>
                            <Button asChild size="sm">
                              <Link href={`/students/${student.id}`}>
                                Open
                                <ArrowRight className="size-3.5" />
                              </Link>
                            </Button>
                          </li>
                        );
                      },
                    )}
                  </ul>
                )}
              </section>
            </div>
          ) : filteredCohort.length === 0 ? (
            <div className="portal-students-empty">
              <h2>
                {supervisees.length === 0
                  ? "No assigned students yet"
                  : "No matching students"}
              </h2>
              <p>
                {supervisees.length === 0
                  ? "Students appear here when they select you as lecturer."
                  : "Try another search or filter."}
              </p>
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
                    <th>
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCohort.map((row) => {
                    const primary = row.projects[0];
                    const status =
                      row.pendingCount > 0
                        ? {
                            label:
                              row.pendingCount === 1
                                ? "1 in review"
                                : `${row.pendingCount} in review`,
                            tone: "review" as const,
                          }
                        : row.topicPending > 0
                          ? { label: "Topic pending", tone: "topic" as const }
                          : row.avgProgress < 20
                            ? { label: "At risk", tone: "risk" as const }
                            : row.avgProgress >= 50
                              ? { label: "On track", tone: "ok" as const }
                              : { label: "In progress", tone: "mid" as const };
                    return (
                      <tr key={row.student.id}>
                        <td>
                          <div className="portal-students-person">
                            <Avatar
                              name={row.student.name}
                              className="size-10 bg-[#ececf8] text-[#0D0B61]"
                            />
                            <span>
                              <span className="portal-students-name">
                                {row.student.name}
                              </span>
                              <span className="portal-students-email">
                                {row.student.email || "No email"}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td>
                          <p className="portal-students-work-title">
                            {primary?.title || "No project"}
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

        <aside className="portal-desk-rail">
          <section className="portal-students-panel portal-desk-card">
            <div className="portal-desk-card-head">
              <h2>Deadlines</h2>
              <CalendarDays className="size-4" />
            </div>
            {loading ? (
              <div className="portal-desk-skel">
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ) : upcomingDeadlines.length === 0 ? (
              <p className="portal-desk-quiet">No upcoming due dates.</p>
            ) : (
              <ul className="portal-desk-deadlines">
                {upcomingDeadlines.map((item) => {
                  const due = item.dueAt ? new Date(item.dueAt) : null;
                  const month = due
                    ? due.toLocaleString(undefined, { month: "short" }).toUpperCase()
                    : "—";
                  const day = due ? String(due.getDate()).padStart(2, "0") : "—";
                  return (
                    <li key={item._id}>
                      <Link
                        href={`/assignments/${item._id}`}
                        className="portal-desk-deadline"
                      >
                        <span className="portal-desk-cal">
                          <span>{month}</span>
                          <strong>{day}</strong>
                        </span>
                        <span className="portal-desk-deadline-copy">
                          <span className="portal-students-work-title">
                            {item.title}
                          </span>
                          <span className="portal-students-work-meta">
                            {item.courseName || "Assignment"}
                          </span>
                          <span
                            className={cn(
                              "portal-students-status",
                              `is-${dueTone(item.days)}`,
                            )}
                          >
                            {dueLabel(item.days)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link href="/assignments" className="portal-desk-more">
              All assignments
            </Link>
          </section>

          <section className="portal-students-panel portal-desk-card">
            <div className="portal-desk-card-head">
              <h2>Tasks</h2>
            </div>
            <ul className="portal-desk-tasks">
              {deskTasks.map((task) => {
                const checked = Boolean(doneTasks[task.id]);
                return (
                  <li key={task.id}>
                    <label className="portal-desk-task">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setDoneTasks((prev) => ({
                            ...prev,
                            [task.id]: !prev[task.id],
                          }))
                        }
                      />
                      <span className={cn("portal-desk-task-copy", checked && "is-done")}>
                        {task.label}
                        {!checked && task.count > 0 ? (
                          <Link href={task.href} onClick={(e) => e.stopPropagation()}>
                            Open
                          </Link>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
