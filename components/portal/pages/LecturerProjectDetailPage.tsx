"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  FolderKanban,
  Loader2,
  Mail,
  UserRound,
  type LucideIcon,
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
  status?: string;
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
  if (status === "approved") {
    return { label: "Topic approved", tone: "ok" as const };
  }
  if (status === "submitted") {
    return { label: "Topic pending", tone: "topic" as const };
  }
  if (status === "draft") {
    return { label: "Topic draft", tone: "mid" as const };
  }
  return null;
}

function pageTone(status?: string): {
  label: string;
  tone: "ok" | "review";
  Icon: LucideIcon;
} {
  if (status === "approved") {
    return { label: "Approved", tone: "ok", Icon: CheckCircle2 };
  }
  if (status === "needs_revision") {
    return { label: "Needs rewrite", tone: "review", Icon: AlertCircle };
  }
  return { label: "Pending review", tone: "review", Icon: Clock3 };
}

function progressTone(value: number) {
  if (value < 20) return "bg-[#dc2626]";
  if (value < 50) return "bg-[#d97706]";
  return "bg-[#059669]";
}

export default function SupervisorProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [project, setProject] = useState<SupervisorProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = (await apiFetch(
          `/api/v1/projects/${projectId}`,
        )) as SupervisorProject;
        if (!cancelled) setProject(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
          setProject(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const pages = useMemo(
    () =>
      [...(project?.pages || [])].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0),
      ),
    [project?.pages],
  );

  const pageStats = useMemo(() => {
    const approved = pages.filter((p) => p.reviewStatus === "approved").length;
    const needsRewrite = pages.filter(
      (p) => p.reviewStatus === "needs_revision",
    ).length;
    const pending = pages.filter(
      (p) => p.reviewStatus === "pending_review",
    ).length;
    return { approved, needsRewrite, pending, total: pages.length };
  }, [pages]);

  async function approveTopic() {
    if (!project) return;
    setApproving(true);
    setApproveError(null);
    try {
      await apiFetch(`/api/v1/projects/${project._id}/topic/approve`, {
        method: "POST",
      });
      setProject((prev) =>
        prev ? { ...prev, topicStatus: "approved" } : prev,
      );
    } catch (err) {
      setApproveError(
        err instanceof Error ? err.message : "Could not approve topic",
      );
    } finally {
      setApproving(false);
    }
  }

  if (loading) return <LoadingPage label="Loading project…" />;

  if (!project) {
    return (
      <div className="portal-students">
        <Link href="/supervision/projects" className="portal-students-back">
          <ArrowLeft className="size-4" />
          Projects
        </Link>
        <section className="portal-students-panel">
          <div className="portal-students-empty">
            <span className="portal-students-empty-icon" aria-hidden>
              <FolderKanban className="size-6" strokeWidth={1.75} />
            </span>
            <h2>Project not found</h2>
            <p>
              {error ||
                "This project is not assigned to you, or it may have been removed."}
            </p>
            <Button asChild className="mt-2">
              <Link href="/supervision/projects">Back to projects</Link>
            </Button>
          </div>
        </section>
      </div>
    );
  }

  const progress = project.progressPercent ?? 0;
  const student = project.student;
  const topicPending = project.topicStatus === "submitted";
  const topic = topicTone(project.topicStatus);
  const firstPage = pages[0];
  const firstPageHref = firstPage
    ? `/supervision/projects/${project._id}/pages/${firstPage._id}`
    : null;
  const pagesHint =
    pageStats.pending > 0
      ? `${pageStats.pending} pending review`
      : pageStats.needsRewrite > 0
        ? `${pageStats.needsRewrite} need rewrite`
        : pageStats.approved > 0
          ? `${pageStats.approved} approved`
          : "No reviews yet";

  return (
    <div className="portal-students">
      <Link href="/supervision/projects" className="portal-students-back">
        <ArrowLeft className="size-4" />
        Projects
      </Link>

      <header className="portal-students-hero">
        <div className="portal-student-identity">
          <Avatar
            name={student?.name || project.title}
            className="size-14 bg-[#0D0B61] text-base text-white"
          />
          <div className="min-w-0">
            <p className="portal-students-kicker">Supervision</p>
            <h1 className="portal-students-title">{project.title}</h1>
            <p className="portal-students-lead">
              {student?.name || "No student"}
              {student?.email ? ` · ${student.email}` : ""}
              {" · "}
              {projectTypeLabel(project.projectType)}
              {project.topic ? ` · ${project.topic}` : ""}
              {project.stage ? ` · ${project.stage}` : ""}
            </p>
            <div className="portal-student-project-pills">
              {topic ? (
                <span className={cn("portal-students-status", `is-${topic.tone}`)}>
                  {topic.label}
                </span>
              ) : null}
              {project.status ? (
                <span className="portal-students-status is-mid">
                  {project.status}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="portal-students-hero-actions">
          {student?.email ? (
            <Button asChild variant="outline">
              <a href={`mailto:${student.email}`}>
                <Mail className="size-4" />
                Email
              </a>
            </Button>
          ) : null}
          {student ? (
            <Button asChild variant="outline">
              <Link href={`/students/${student.id}`}>
                <UserRound className="size-4" />
                Student
              </Link>
            </Button>
          ) : null}
          {firstPageHref ? (
            <Button asChild>
              <Link href={firstPageHref}>
                Open first page
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
      {approveError ? (
        <p className="portal-students-error" role="alert">
          {approveError}
        </p>
      ) : null}

      <section
        className="portal-students-kpis is-profile"
        aria-label="Project snapshot"
      >
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--navy">
            <FileText className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">{pageStats.total}</p>
            <p className="portal-students-kpi-label">Pages</p>
          </div>
        </article>
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--green">
            <CheckCircle2 className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">{pageStats.approved}</p>
            <p className="portal-students-kpi-label">Approved</p>
          </div>
        </article>
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--amber">
            <Clock3 className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">{pageStats.pending}</p>
            <p className="portal-students-kpi-label">Pending</p>
          </div>
        </article>
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--violet">
            <FolderKanban className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">{progress}%</p>
            <p className="portal-students-kpi-label">Progress</p>
          </div>
        </article>
      </section>

      <div className="portal-student-progress">
        <div className="portal-student-progress-meta">
          <span>Approval progress</span>
          <span>{progress}%</span>
        </div>
        <Progress
          value={progress}
          className="h-1.5 bg-[#e8ecf3]"
          indicatorClassName={progressTone(progress)}
        />
      </div>

      <section className="portal-students-panel">
        <div className="portal-student-project-head">
          <div className="min-w-0">
            <p className="portal-students-kicker">Topic</p>
            <h2 className="portal-student-project-title">Research topic</h2>
            <p className="portal-student-project-meta">
              Status: {project.topicStatus || "draft"}
              {" · Updated "}
              {formatRelative(project.updatedAt)}
            </p>
          </div>
          {topicPending ? (
            <Button disabled={approving} onClick={() => void approveTopic()}>
              {approving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Approving…
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Approve topic
                </>
              )}
            </Button>
          ) : null}
        </div>

        {project.topic || project.abstract ? (
          <div className="portal-student-brief">
            {project.topic ? (
              <p>
                <strong>Topic</strong>
                {project.topic}
              </p>
            ) : null}
            {project.abstract ? (
              <p className="portal-student-brief-copy">{project.abstract}</p>
            ) : null}
          </div>
        ) : (
          <div className="portal-students-empty">
            <h2>No topic submitted yet</h2>
            <p>The student has not submitted a topic or abstract.</p>
          </div>
        )}
      </section>

      <section className="portal-students-panel">
        <div className="portal-student-project-head">
          <div className="min-w-0">
            <p className="portal-students-kicker">Pages</p>
            <h2 className="portal-student-project-title">Writing pages</h2>
            <p className="portal-student-project-meta">
              Open a page to review writing, leave remarks, or approve.
            </p>
          </div>
          <p className="portal-students-activity">{pagesHint}</p>
        </div>

        {pages.length === 0 ? (
          <div className="portal-students-empty">
            <span className="portal-students-empty-icon" aria-hidden>
              <FileText className="size-6" strokeWidth={1.75} />
            </span>
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
                        <p className="portal-students-work-title">{page.title}</p>
                      </td>
                      <td>
                        <span
                          className={cn(
                            "portal-students-status",
                            `is-${status.tone}`,
                          )}
                        >
                          <status.Icon
                            className="size-3"
                            strokeWidth={2.25}
                            aria-hidden
                          />
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
    </div>
  );
}
