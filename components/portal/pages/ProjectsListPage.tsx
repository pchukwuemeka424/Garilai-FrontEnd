"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Inbox,
  LayoutGrid,
  Rows3,
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
  topic?: string;
  status?: string;
  updatedAt?: string;
  studentId: string;
  student: StudentInfo | null;
};

type FilterKey =
  | "all"
  | "topic_pending"
  | "on_track"
  | "at_risk"
  | "approved_topic";

type ViewMode = "grid" | "list";

const VIEW_STORAGE_KEY = "sv-projects-view";

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

function formatStage(stage?: string) {
  if (!stage) return null;
  return stage.replace(/_/g, " ");
}

function projectStatus(project: SupervisorProject) {
  const progress = project.progressPercent ?? 0;
  if (project.topicStatus === "submitted") {
    return { label: "Topic pending", tone: "topic" as const };
  }
  if (progress < 20) {
    return { label: "At risk", tone: "risk" as const };
  }
  if (project.topicStatus === "approved" && progress >= 50) {
    return { label: "On track", tone: "ok" as const };
  }
  if (project.topicStatus === "approved") {
    return { label: "Topic approved", tone: "ok" as const };
  }
  if (project.topicStatus === "draft") {
    return { label: "Topic draft", tone: "mid" as const };
  }
  if (progress >= 50) {
    return { label: "On track", tone: "ok" as const };
  }
  return { label: "In progress", tone: "mid" as const };
}

function progressTone(value: number) {
  if (value < 20) return "bg-[#dc2626]";
  if (value < 50) return "bg-[#d97706]";
  return "bg-[#059669]";
}

function typeTone(type: string) {
  switch (type) {
    case "dissertation":
      return "navy";
    case "thesis":
      return "violet";
    case "research":
      return "blue";
    case "publication":
      return "rose";
    case "capstone":
      return "amber";
    case "assignment":
      return "slate";
    default:
      return "teal";
  }
}

export default function SupervisorProjectsPage() {
  const [projects, setProjects] = useState<SupervisorProject[]>([]);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [view, setView] = useState<ViewMode>("grid");
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
        const [list, reviews] = await Promise.all([
          apiFetch("/api/v1/projects") as Promise<SupervisorProject[]>,
          apiFetch("/api/v1/supervisor/reviews").catch(() => []) as Promise<
            unknown[]
          >,
        ]);
        if (!cancelled) {
          setProjects(Array.isArray(list) ? list : []);
          setPendingReviewCount(Array.isArray(reviews) ? reviews.length : 0);
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
    const topicPending = projects.filter(
      (p) => p.topicStatus === "submitted",
    ).length;
    const topicApproved = projects.filter(
      (p) => p.topicStatus === "approved",
    ).length;
    const atRisk = projects.filter((p) => (p.progressPercent ?? 0) < 20).length;
    const onTrack = projects.filter(
      (p) => (p.progressPercent ?? 0) >= 50,
    ).length;
    return {
      total: projects.length,
      topicPending,
      topicApproved,
      atRisk,
      onTrack,
    };
  }, [projects]);

  const filtered = useMemo(() => {
    let list = [...projects];

    if (filter === "topic_pending") {
      list = list.filter((p) => p.topicStatus === "submitted");
    } else if (filter === "approved_topic") {
      list = list.filter((p) => p.topicStatus === "approved");
    } else if (filter === "at_risk") {
      list = list.filter((p) => (p.progressPercent ?? 0) < 20);
    } else if (filter === "on_track") {
      list = list.filter((p) => (p.progressPercent ?? 0) >= 50);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const hay = [
          p.title,
          p.topic || "",
          p.student?.name || "",
          p.student?.email || "",
          projectTypeLabel(p.projectType),
        ]
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
  }, [projects, filter, query]);

  const filters: { id: FilterKey; label: string; count: number }[] = [
    { id: "all", label: "All", count: stats.total },
    { id: "topic_pending", label: "Topics", count: stats.topicPending },
    { id: "approved_topic", label: "Approved", count: stats.topicApproved },
    { id: "at_risk", label: "At risk", count: stats.atRisk },
    { id: "on_track", label: "On track", count: stats.onTrack },
  ];

  const kpis: {
    id: FilterKey;
    label: string;
    value: number;
    caption: string;
    icon: "folder" | "clock" | "alert" | "check";
  }[] = [
    {
      id: "all",
      label: "Assigned",
      value: stats.total,
      caption: "Research folders under your supervision",
      icon: "folder",
    },
    {
      id: "topic_pending",
      label: "Topic pending",
      value: stats.topicPending,
      caption: "Awaiting topic approval",
      icon: "clock",
    },
    {
      id: "at_risk",
      label: "At risk",
      value: stats.atRisk,
      caption: "Below 20% completion",
      icon: "alert",
    },
    {
      id: "on_track",
      label: "On track",
      value: stats.onTrack,
      caption: "50% or further along",
      icon: "check",
    },
  ];

  function renderProjectCard(project: SupervisorProject) {
    const progress = project.progressPercent ?? 0;
    const student = project.student;
    const status = projectStatus(project);
    const stage = formatStage(project.stage);
    const href = `/supervision/projects/${project._id}`;

    return (
      <article
        key={project._id}
        className={cn("sv-projects-card", `is-${status.tone}`)}
      >
        <Link href={href} className="sv-projects-card-body">
          <div className="sv-projects-card-top">
            <span
              className={cn(
                "sv-projects-type",
                `is-${typeTone(project.projectType)}`,
              )}
            >
              {projectTypeLabel(project.projectType)}
            </span>
            <span className={cn("sv-projects-status", `is-${status.tone}`)}>
              {status.label}
            </span>
          </div>
          <h2 className="sv-projects-card-title">{project.title}</h2>
          <p className="sv-projects-card-topic">
            {project.topic || "No topic submitted yet"}
            {stage ? ` · ${stage}` : ""}
          </p>
        </Link>

        <div className="sv-projects-card-meta">
          {student ? (
            <Link href={`/students/${student.id}`} className="sv-projects-student">
              <Avatar
                name={student.name}
                className="size-9 bg-[#ececf8] text-[#0D0B61]"
              />
              <span>
                <span className="sv-projects-student-name">{student.name}</span>
                <span className="sv-projects-student-email">
                  {student.email || "No email"}
                </span>
              </span>
            </Link>
          ) : (
            <span className="sv-projects-student is-empty">No student</span>
          )}

          <div className="sv-projects-progress">
            <Progress
              value={progress}
              className="h-1.5 flex-1 bg-[#e8ecf3]"
              indicatorClassName={progressTone(progress)}
            />
            <span>{progress}%</span>
          </div>
        </div>

        <footer className="sv-projects-card-foot">
          <span>Updated {formatRelative(project.updatedAt)}</span>
          <Link href={href} className="sv-projects-open">
            Open
            <ArrowRight className="size-3.5" />
          </Link>
        </footer>
      </article>
    );
  }

  function renderProjectRow(project: SupervisorProject) {
    const progress = project.progressPercent ?? 0;
    const student = project.student;
    const status = projectStatus(project);
    const stage = formatStage(project.stage);
    const href = `/supervision/projects/${project._id}`;

    return (
      <article
        key={project._id}
        className={cn("sv-projects-row", `is-${status.tone}`)}
      >
        <Link href={href} className="sv-projects-row-main">
          <span
            className={cn(
              "sv-projects-type",
              `is-${typeTone(project.projectType)}`,
            )}
          >
            {projectTypeLabel(project.projectType)}
          </span>
          <h2>{project.title}</h2>
          <p>
            {project.topic || "No topic submitted yet"}
            {stage ? ` · ${stage}` : ""}
          </p>
        </Link>

        {student ? (
          <Link href={`/students/${student.id}`} className="sv-projects-student">
            <Avatar
              name={student.name}
              className="size-9 bg-[#ececf8] text-[#0D0B61]"
            />
            <span>
              <span className="sv-projects-student-name">{student.name}</span>
              <span className="sv-projects-student-email">
                {student.email || "No email"}
              </span>
            </span>
          </Link>
        ) : (
          <span className="sv-projects-student is-empty">No student</span>
        )}

        <div className="sv-projects-progress">
          <Progress
            value={progress}
            className="h-1.5 flex-1 bg-[#e8ecf3]"
            indicatorClassName={progressTone(progress)}
          />
          <span>{progress}%</span>
        </div>

        <span className="sv-projects-activity">
          {formatRelative(project.updatedAt)}
        </span>

        <Link href={href} className="sv-projects-open">
          Open
          <ArrowRight className="size-3.5" />
        </Link>
      </article>
    );
  }

  if (loading) {
    return (
      <div className="sv-projects" aria-busy="true">
        <div className="sv-projects-hero">
          <div className="sv-projects-hero-copy">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="mt-3 h-8 w-64 rounded-md" />
            <Skeleton className="mt-2 h-4 w-80 max-w-full rounded-md" />
          </div>
        </div>
        <div className="sv-projects-kpis">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-[6.5rem] rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-[22rem] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="sv-projects">
      <header className="sv-projects-hero">
        <div className="sv-projects-hero-copy">
          <div className="sv-projects-meta">
            <span className="sv-projects-badge">
              <span className="sv-projects-live" aria-hidden />
              Supervision portfolio
            </span>
            <span className="sv-projects-meta-count">
              {stats.total} assigned
            </span>
          </div>
          <h1>Research projects</h1>
          <p>
            Review theses, dissertations, and chapter progress assigned to you.
            Open a folder to approve topics and mark pages.
          </p>
        </div>
        <div className="sv-projects-hero-actions">
          <Button asChild variant="outline">
            <Link href="/students">
              <Users className="size-4" />
              Students
            </Link>
          </Button>
          <Button asChild>
            <Link href="/reviews">
              <Inbox className="size-4" />
              Reviews
              {pendingReviewCount > 0 ? (
                <span className="portal-students-count">
                  {pendingReviewCount}
                </span>
              ) : null}
            </Link>
          </Button>
        </div>
      </header>

      {error ? (
        <p className="sv-projects-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="sv-projects-kpis" aria-label="Projects snapshot">
        {kpis.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "sv-projects-kpi",
              `is-${item.icon}`,
              filter === item.id && "is-active",
            )}
            onClick={() => setFilter(item.id)}
            aria-pressed={filter === item.id}
          >
            <div className="sv-projects-kpi-top">
              <span>{item.label}</span>
              <span className="sv-projects-kpi-icon" aria-hidden>
                {item.icon === "folder" ? (
                  <FolderKanban className="size-4" strokeWidth={1.75} />
                ) : null}
                {item.icon === "clock" ? (
                  <Clock3 className="size-4" strokeWidth={1.75} />
                ) : null}
                {item.icon === "alert" ? (
                  <AlertTriangle className="size-4" strokeWidth={1.75} />
                ) : null}
                {item.icon === "check" ? (
                  <CheckCircle2 className="size-4" strokeWidth={1.75} />
                ) : null}
              </span>
            </div>
            <p className="sv-projects-kpi-value">{item.value}</p>
            <p className="sv-projects-kpi-caption">{item.caption}</p>
          </button>
        ))}
      </section>

      {stats.topicPending > 0 && filter !== "topic_pending" ? (
        <button
          type="button"
          className="sv-projects-attention"
          onClick={() => setFilter("topic_pending")}
        >
          <Clock3 className="size-4" strokeWidth={1.75} />
          <span>
            {stats.topicPending === 1
              ? "1 topic is waiting for approval"
              : `${stats.topicPending} topics are waiting for approval`}
          </span>
          <span className="sv-projects-attention-cta">
            Review
            <ArrowRight className="size-3.5" />
          </span>
        </button>
      ) : null}

      <section className="sv-projects-board">
        <div className="sv-projects-toolbar">
          <div
            className="sv-projects-filters"
            role="tablist"
            aria-label="Filter projects"
          >
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                onClick={() => setFilter(item.id)}
                className={cn(
                  "sv-projects-filter",
                  filter === item.id && "is-active",
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
                placeholder="Search title, student, or topic"
                aria-label="Search projects"
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

        {filtered.length === 0 ? (
          <div className="sv-projects-empty">
            <span className="sv-projects-empty-icon" aria-hidden>
              <FolderKanban className="size-6" strokeWidth={1.75} />
            </span>
            <h2>
              {projects.length === 0
                ? "No projects assigned yet"
                : "No matching projects"}
            </h2>
            <p>
              {projects.length === 0
                ? "Projects appear here when students select you as lecturer and create a research folder."
                : "Try another filter or search term."}
            </p>
            {projects.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFilter("all");
                  setQuery("");
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : view === "grid" ? (
          <div className="sv-projects-grid">{filtered.map(renderProjectCard)}</div>
        ) : (
          <div className="sv-projects-list">
            <div className="sv-projects-list-head" aria-hidden>
              <span>Project</span>
              <span>Student</span>
              <span>Progress</span>
              <span>Activity</span>
              <span />
            </div>
            {filtered.map(renderProjectRow)}
          </div>
        )}
      </section>
    </div>
  );
}
