"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FolderKanban,
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

export default function SupervisorProjectsPage() {
  const [projects, setProjects] = useState<SupervisorProject[]>([]);
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
          "/api/v1/projects",
        )) as SupervisorProject[];
        if (!cancelled) setProjects(list);
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
    const atRisk = projects.filter(
      (p) => (p.progressPercent ?? 0) < 20,
    ).length;
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

  if (loading) return <LoadingPage label="Loading projects…" />;

  return (
    <div className="portal-students">
      <header className="portal-students-hero">
        <div>
          <p className="portal-students-kicker">Supervision</p>
          <h1 className="portal-students-title">Projects</h1>
          <p className="portal-students-lead">
            Research work assigned to you — open a project to review pages,
            topics, and progress.
          </p>
        </div>
        <div className="portal-students-hero-actions">
          <Button asChild variant="outline">
            <Link href="/students">
              <Users className="size-4" />
              Students
            </Link>
          </Button>
        </div>
      </header>

      {error ? (
        <p className="portal-students-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="portal-students-kpis is-profile" aria-label="Projects snapshot">
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--violet">
            <FolderKanban className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">{stats.total}</p>
            <p className="portal-students-kpi-label">Projects</p>
          </div>
        </article>
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--amber">
            <Clock3 className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">{stats.topicPending}</p>
            <p className="portal-students-kpi-label">Topic pending</p>
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
          <div className="portal-students-filters" role="tablist" aria-label="Filter projects">
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
              placeholder="Search title, student, or topic"
              aria-label="Search projects"
            />
          </label>
        </div>

        {filtered.length === 0 ? (
          <div className="portal-students-empty">
            <span className="portal-students-empty-icon" aria-hidden>
              <FolderKanban className="size-6" strokeWidth={1.75} />
            </span>
            <h2>
              {projects.length === 0
                ? "No projects yet"
                : "No matching projects"}
            </h2>
            <p>
              {projects.length === 0
                ? "Projects appear here when students select you as lecturer."
                : "Try another filter or search term."}
            </p>
            {projects.length > 0 ? (
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
            ) : null}
          </div>
        ) : (
          <div className="portal-students-table-wrap">
            <table className="portal-students-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Activity</th>
                  <th>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((project) => {
                  const progress = project.progressPercent ?? 0;
                  const student = project.student;
                  const status = projectStatus(project);
                  return (
                    <tr key={project._id}>
                      <td>
                        <p className="portal-students-work-title">
                          {project.title}
                        </p>
                        <p className="portal-students-work-meta">
                          {projectTypeLabel(project.projectType)}
                          {project.stage ? ` · ${project.stage}` : ""}
                          {project.topic ? ` · ${project.topic}` : ""}
                        </p>
                      </td>
                      <td>
                        {student ? (
                          <Link
                            href={`/students/${student.id}`}
                            className="portal-students-person"
                          >
                            <Avatar
                              name={student.name}
                              className="size-9 bg-[#ececf8] text-[#0D0B61]"
                            />
                            <span>
                              <span className="portal-students-name">
                                {student.name}
                              </span>
                              <span className="portal-students-email">
                                {student.email || "No email"}
                              </span>
                            </span>
                          </Link>
                        ) : (
                          <span className="portal-students-email">
                            No student
                          </span>
                        )}
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
                            value={progress}
                            className="h-1.5 flex-1 bg-[#e8ecf3]"
                            indicatorClassName={progressTone(progress)}
                          />
                          <span>{progress}%</span>
                        </div>
                      </td>
                      <td className="portal-students-activity">
                        {formatRelative(project.updatedAt)}
                      </td>
                      <td className="portal-students-action">
                        <Button asChild size="sm">
                          <Link href={`/supervision/projects/${project._id}`}>
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
