"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  FolderKanban,
  Mail,
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

type ProjectPage = {
  _id: string;
  title: string;
  content?: string;
  order?: number;
  reviewStatus?: string;
  reviewRemark?: string;
};

type SupervisorProject = {
  _id: string;
  title: string;
  projectType: string;
  progressPercent?: number;
  topicStatus?: string;
  stage?: string;
  abstract?: string;
  topic?: string;
  updatedAt?: string;
  studentId: string;
  student: StudentInfo | null;
  pages?: ProjectPage[];
};

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

function topicTone(status?: string) {
  if (status === "approved") return { label: "Topic approved", tone: "ok" as const };
  if (status === "submitted") return { label: "Topic pending", tone: "topic" as const };
  if (status === "draft") return { label: "Topic draft", tone: "mid" as const };
  return null;
}

function pageTone(status?: string) {
  if (status === "approved") return { label: "Approved", tone: "ok" as const };
  if (status === "needs_revision") return { label: "Needs rewrite", tone: "review" as const };
  if (status === "submitted" || status === "in_review") {
    return { label: "In review", tone: "review" as const };
  }
  return { label: "Draft", tone: "mid" as const };
}

function progressTone(value: number) {
  if (value < 20) return "bg-[#dc2626]";
  if (value < 50) return "bg-[#d97706]";
  return "bg-[#059669]";
}

export default function SupervisorStudentDetailPage() {
  const params = useParams<{ id: string }>();
  const studentId = params.id;
  const [projects, setProjects] = useState<SupervisorProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const list = (await apiFetch(
          "/api/v1/projects",
        )) as SupervisorProject[];
        const mine = list.filter(
          (p) =>
            String(p.studentId) === studentId || p.student?.id === studentId,
        );

        const detailed = await Promise.all(
          mine.map(async (summary) => {
            try {
              return (await apiFetch(
                `/api/v1/projects/${summary._id}`,
              )) as SupervisorProject;
            } catch {
              return summary;
            }
          }),
        );
        if (cancelled) return;
        setProjects(detailed);
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
  }, [studentId]);

  const student = useMemo(
    () =>
      projects[0]?.student ||
      (projects[0]
        ? {
            id: String(projects[0].studentId),
            name: "Student",
            email: "",
          }
        : null),
    [projects],
  );

  const avgProgress = useMemo(() => {
    if (projects.length === 0) return 0;
    return Math.round(
      projects.reduce((sum, p) => sum + (p.progressPercent ?? 0), 0) /
        projects.length,
    );
  }, [projects]);

  const pageCount = useMemo(
    () => projects.reduce((sum, p) => sum + (p.pages?.length || 0), 0),
    [projects],
  );

  const lastActivity = useMemo(() => {
    const dates = projects.map((p) => p.updatedAt).filter(Boolean);
    if (dates.length === 0) return undefined;
    return dates.sort(
      (a, b) => new Date(b || 0).getTime() - new Date(a || 0).getTime(),
    )[0];
  }, [projects]);

  const primary = projects[0];

  if (loading) return <LoadingPage label="Loading student…" />;

  if (!student || projects.length === 0) {
    return (
      <div className="portal-students">
        <Link href="/students" className="portal-students-back">
          <ArrowLeft className="size-4" />
          Students
        </Link>
        <section className="portal-students-panel">
          <div className="portal-students-empty">
            <span className="portal-students-empty-icon" aria-hidden>
              <FolderKanban className="size-6" strokeWidth={1.75} />
            </span>
            <h2>Student not found</h2>
            <p>This person is not on your supervision roster.</p>
            <Button asChild className="mt-2">
              <Link href="/students">Back to students</Link>
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="portal-students">
      <Link href="/students" className="portal-students-back">
        <ArrowLeft className="size-4" />
        Students
      </Link>

      <header className="portal-students-hero">
        <div className="portal-student-identity">
          <Avatar
            name={student.name}
            className="size-14 bg-[#0D0B61] text-base text-white"
          />
          <div className="min-w-0">
            <p className="portal-students-kicker">Supervision</p>
            <h1 className="portal-students-title">{student.name}</h1>
            {student.email ? (
              <p className="portal-student-email">
                <Mail className="size-3.5" />
                {student.email}
              </p>
            ) : (
              <p className="portal-students-lead">No email on file.</p>
            )}
          </div>
        </div>
        <div className="portal-students-hero-actions">
          {student.email ? (
            <Button asChild variant="outline">
              <a href={`mailto:${student.email}`}>
                <Mail className="size-4" />
                Email
              </a>
            </Button>
          ) : null}
          {primary ? (
            <Button asChild>
              <Link href={`/supervision/projects/${primary._id}`}>
                Open project
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      {error ? (
        <p className="portal-students-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="portal-students-kpis is-profile" aria-label="Student snapshot">
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--violet">
            <FolderKanban className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">{projects.length}</p>
            <p className="portal-students-kpi-label">Projects</p>
          </div>
        </article>
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--navy">
            <FileText className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">{pageCount}</p>
            <p className="portal-students-kpi-label">Pages</p>
          </div>
        </article>
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--green">
            <CheckCircle2 className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">{avgProgress}%</p>
            <p className="portal-students-kpi-label">Average progress</p>
          </div>
        </article>
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--amber">
            <Clock3 className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value portal-students-kpi-value--sm">
              {formatRelative(lastActivity)}
            </p>
            <p className="portal-students-kpi-label">Last activity</p>
          </div>
        </article>
      </section>

      <div className="portal-student-progress">
        <div className="portal-student-progress-meta">
          <span>Overall progress</span>
          <span>{avgProgress}%</span>
        </div>
        <Progress
          value={avgProgress}
          className="h-1.5 bg-[#e8ecf3]"
          indicatorClassName={progressTone(avgProgress)}
        />
      </div>

      {projects.map((project) => {
        const pages = [...(project.pages || [])].sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0),
        );
        const progress = project.progressPercent ?? 0;
        const topic = topicTone(project.topicStatus);
        return (
          <section key={project._id} className="portal-students-panel">
            <div className="portal-student-project-head">
              <div className="min-w-0">
                <p className="portal-students-kicker">Project</p>
                <h2 className="portal-student-project-title">{project.title}</h2>
                <p className="portal-student-project-meta">
                  {projectTypeLabel(project.projectType)}
                  {project.stage ? ` · ${project.stage}` : ""}
                  {" · Updated "}
                  {formatRelative(project.updatedAt)}
                </p>
                <div className="portal-student-project-pills">
                  {topic ? (
                    <span className={cn("portal-students-status", `is-${topic.tone}`)}>
                      {topic.label}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="portal-student-project-side">
                <div className="portal-students-progress">
                  <Progress
                    value={progress}
                    className="h-1.5 flex-1 bg-[#e8ecf3]"
                    indicatorClassName={progressTone(progress)}
                  />
                  <span>{progress}%</span>
                </div>
                <Button asChild size="sm">
                  <Link href={`/supervision/projects/${project._id}`}>
                    Open
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </div>

            {(project.topic || project.abstract) && (
              <div className="portal-student-brief">
                {project.topic ? (
                  <p>
                    <strong>Topic</strong>
                    {project.topic}
                  </p>
                ) : null}
                {project.abstract ? (
                  <p className="portal-student-abstract">{project.abstract}</p>
                ) : null}
              </div>
            )}

            {pages.length === 0 ? (
              <div className="portal-students-empty">
                <h2>No pages yet</h2>
                <p>This project has no writing pages to review.</p>
              </div>
            ) : (
              <div className="portal-students-table-wrap">
                <table className="portal-students-table is-pages">
                  <thead>
                    <tr>
                      <th className="portal-student-col-num">#</th>
                      <th>Page</th>
                      <th>Status</th>
                      <th>
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pages.map((page, index) => {
                      const href = `/supervision/projects/${project._id}/pages/${page._id}`;
                      const status = pageTone(page.reviewStatus);
                      return (
                        <tr key={page._id}>
                          <td className="portal-student-col-num">{index + 1}</td>
                          <td>
                            <p className="portal-students-work-title">
                              {page.title}
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
                          <td className="portal-students-action">
                            <Button asChild size="sm">
                              <Link href={href}>
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
        );
      })}
    </div>
  );
}
