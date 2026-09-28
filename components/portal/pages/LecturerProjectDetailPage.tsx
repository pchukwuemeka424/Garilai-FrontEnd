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
  Percent,
  UserRound,
  type LucideIcon,
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

function formatStage(stage?: string) {
  if (!stage) return null;
  return stage.replace(/_/g, " ");
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
  return { label: "No topic", tone: "mid" as const };
}

function pageTone(status?: string): {
  label: string;
  tone: "ok" | "review" | "mid";
  Icon: LucideIcon;
} {
  if (status === "approved") {
    return { label: "Approved", tone: "ok", Icon: CheckCircle2 };
  }
  if (status === "needs_revision") {
    return { label: "Needs rewrite", tone: "review", Icon: AlertCircle };
  }
  if (
    status === "pending_review" ||
    status === "submitted" ||
    status === "in_review"
  ) {
    return { label: "Pending review", tone: "review", Icon: Clock3 };
  }
  return { label: "Draft", tone: "mid", Icon: FileText };
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

function progressTone(value: number) {
  if (value < 20) return "bg-[#dc2626]";
  if (value < 50) return "bg-[#d97706]";
  return "bg-[#059669]";
}

function friendlyProjectError(message: string | null) {
  if (!message) return null;
  const lower = message.toLowerCase();
  if (
    lower.includes("cast to objectid") ||
    lower.includes("objectid failed") ||
    lower === "project not found" ||
    lower.includes("not found")
  ) {
    return "This project is not assigned to you, or it may have been removed.";
  }
  return message;
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
      (p) =>
        p.reviewStatus === "pending_review" ||
        p.reviewStatus === "submitted" ||
        p.reviewStatus === "in_review",
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

  if (loading) {
    return (
      <div className="sv-project" aria-busy="true">
        <Skeleton className="h-4 w-28 rounded-md" />
        <Skeleton className="h-[10rem] rounded-2xl" />
        <div className="sv-project-kpis">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-[6.5rem] rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-[5.5rem] rounded-2xl" />
        <div className="sv-project-grid">
          <Skeleton className="h-[16rem] rounded-2xl" />
          <Skeleton className="h-[16rem] rounded-2xl" />
        </div>
        <Skeleton className="h-[18rem] rounded-2xl" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="sv-project">
        <Link href="/supervision/projects" className="sv-project-back">
          <ArrowLeft className="size-4" />
          Projects
        </Link>
        <section className="sv-project-panel">
          <div className="sv-projects-empty">
            <span className="sv-projects-empty-icon" aria-hidden>
              <FolderKanban className="size-6" strokeWidth={1.75} />
            </span>
            <h2>Project not found</h2>
            <p>
              {friendlyProjectError(error) ||
                "This project is not assigned to you, or it may have been removed."}
            </p>
            <Button asChild>
              <Link href="/supervision/projects">Back to projects</Link>
            </Button>
          </div>
        </section>
      </div>
    );
  }

  const student = project.student;
  const topicPending = project.topicStatus === "submitted";
  const topic = topicTone(project.topicStatus);
  const stage = formatStage(project.stage);
  const progress = project.progressPercent ?? 0;
  const firstPage = pages[0];
  const firstPageHref = firstPage
    ? `/supervision/projects/${project._id}/pages/${firstPage._id}`
    : null;
  const nextAction =
    pages.find(
      (p) =>
        p.reviewStatus === "pending_review" ||
        p.reviewStatus === "submitted" ||
        p.reviewStatus === "in_review" ||
        p.reviewStatus === "needs_revision",
    ) || firstPage;
  const nextActionHref = nextAction
    ? `/supervision/projects/${project._id}/pages/${nextAction._id}`
    : null;

  const pagesHint =
    pageStats.pending > 0
      ? `${pageStats.pending} pending review`
      : pageStats.needsRewrite > 0
        ? `${pageStats.needsRewrite} need rewrite`
        : pageStats.approved > 0
          ? `${pageStats.approved} approved`
          : "No reviews yet";

  const kpis = [
    {
      label: "Pages",
      value: pageStats.total,
      caption: "Writing sections in this folder",
      icon: "pages" as const,
      Icon: FileText,
    },
    {
      label: "Approved",
      value: pageStats.approved,
      caption: "Pages cleared for the next stage",
      icon: "check" as const,
      Icon: CheckCircle2,
    },
    {
      label: "In review",
      value: pageStats.pending + pageStats.needsRewrite,
      caption:
        pageStats.needsRewrite > 0
          ? `${pageStats.needsRewrite} need rewrite`
          : "Awaiting supervisor action",
      icon: "clock" as const,
      Icon: Clock3,
    },
    {
      label: "Progress",
      value: `${progress}%`,
      caption: stage ? `Stage · ${stage}` : "Folder completion",
      icon: "progress" as const,
      Icon: Percent,
    },
  ];

  return (
    <div className="sv-project">
      <Link href="/supervision/projects" className="sv-project-back">
        <ArrowLeft className="size-4" />
        Back to projects
      </Link>

      <header className={cn("sv-project-hero", `is-${topic.tone}`)}>
        <div className="sv-project-hero-main">
          <div className="sv-project-meta">
            <span className="sv-projects-badge">
              <span className="sv-projects-live" aria-hidden />
              Supervision folder
            </span>
            <span
              className={cn(
                "sv-projects-type",
                `is-${typeTone(project.projectType)}`,
              )}
            >
              {projectTypeLabel(project.projectType)}
            </span>
            <span className={cn("sv-projects-status", `is-${topic.tone}`)}>
              {topic.label}
            </span>
            {project.status ? (
              <span className="sv-projects-status is-mid">{project.status}</span>
            ) : null}
          </div>

          <h1>{project.title}</h1>
          <p className="sv-project-lead">
            {project.topic || "No topic submitted yet"}
            {stage ? ` · ${stage}` : ""}
            {" · Updated "}
            {formatRelative(project.updatedAt)}
          </p>

          {student ? (
            <Link
              href={`/students/${student.id}`}
              className="sv-project-student-chip"
            >
              <Avatar
                name={student.name}
                className="size-9 bg-[#ececf8] text-[#0D0B61]"
              />
              <span className="min-w-0">
                <span className="sv-projects-student-name">{student.name}</span>
                <span className="sv-projects-student-email">
                  {student.email || "No email on file"}
                </span>
              </span>
            </Link>
          ) : null}
        </div>

        <div className="sv-projects-hero-actions">
          {student?.email ? (
            <Button asChild variant="outline">
              <a href={`mailto:${student.email}`}>
                <Mail className="size-4" />
                Email
              </a>
            </Button>
          ) : null}
          {nextActionHref ? (
            <Button asChild>
              <Link href={nextActionHref}>
                {pageStats.pending > 0 || pageStats.needsRewrite > 0
                  ? "Continue review"
                  : "Open first page"}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : firstPageHref ? (
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
        <p className="sv-projects-error" role="alert">
          {error}
        </p>
      ) : null}
      {approveError ? (
        <p className="sv-projects-error" role="alert">
          {approveError}
        </p>
      ) : null}

      {topicPending ? (
        <div className="sv-projects-attention" role="status">
          <Clock3 className="size-4 shrink-0" strokeWidth={1.75} />
          <span>
            Topic is waiting for your approval before writing continues.
          </span>
          <button
            type="button"
            className="sv-projects-attention-cta"
            disabled={approving}
            onClick={() => void approveTopic()}
          >
            {approving ? "Approving…" : "Approve topic"}
            {!approving ? <ArrowRight className="size-3.5" /> : null}
          </button>
        </div>
      ) : null}

      <section className="sv-project-kpis" aria-label="Project snapshot">
        {kpis.map((item) => (
          <article
            key={item.label}
            className={cn("sv-project-kpi", `is-${item.icon}`)}
          >
            <div className="sv-projects-kpi-top">
              <span>{item.label}</span>
              <span className="sv-projects-kpi-icon" aria-hidden>
                <item.Icon className="size-4" strokeWidth={1.75} />
              </span>
            </div>
            <p className="sv-projects-kpi-value">{item.value}</p>
            <p className="sv-projects-kpi-caption">{item.caption}</p>
          </article>
        ))}
      </section>

      <section className="sv-project-progress-card" aria-label="Progress">
        <div className="sv-project-progress-meta">
          <div>
            <p className="sv-project-section-kicker">Completion</p>
            <h2>Folder progress</h2>
          </div>
          <span className="sv-project-progress-value">{progress}%</span>
        </div>
        <Progress
          value={progress}
          className="h-2 bg-[#e8ecf3]"
          indicatorClassName={progressTone(progress)}
        />
        <p className="sv-project-progress-hint">
          {pageStats.approved} of {pageStats.total || 0} pages approved
          {stage ? ` · Current stage: ${stage}` : ""}
        </p>
      </section>

      <div className="sv-project-grid">
        <section className="sv-project-panel">
          <div className="sv-project-panel-head">
            <div className="min-w-0">
              <p className="sv-project-section-kicker">Brief</p>
              <h2>Research topic</h2>
              <p className="sv-project-section-meta">
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
            <div className="sv-project-brief">
              {project.topic ? (
                <div className="sv-project-brief-block">
                  <span>Topic</span>
                  <p>{project.topic}</p>
                </div>
              ) : null}
              {project.abstract ? (
                <div className="sv-project-brief-block">
                  <span>Abstract</span>
                  <p>{project.abstract}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="sv-projects-empty is-compact">
              <h2>No topic submitted yet</h2>
              <p>The student has not submitted a topic or abstract.</p>
            </div>
          )}
        </section>

        <aside className="sv-project-panel sv-project-aside">
          <div className="sv-project-panel-head">
            <div className="min-w-0">
              <p className="sv-project-section-kicker">Supervisee</p>
              <h2>Student</h2>
            </div>
          </div>

          {student ? (
            <div className="sv-project-aside-body">
              <div className="sv-project-aside-person">
                <Avatar
                  name={student.name}
                  className="size-12 bg-[#0D0B61] text-base text-white"
                />
                <div className="min-w-0">
                  <p className="sv-project-aside-name">{student.name}</p>
                  <p className="sv-project-aside-email">
                    {student.email || "No email on file"}
                  </p>
                </div>
              </div>
              <div className="sv-project-aside-actions">
                {student.email ? (
                  <Button asChild variant="outline" className="w-full">
                    <a href={`mailto:${student.email}`}>
                      <Mail className="size-4" />
                      Email student
                    </a>
                  </Button>
                ) : null}
                <Button asChild variant="secondary" className="w-full">
                  <Link href={`/students/${student.id}`}>
                    <UserRound className="size-4" />
                    View student profile
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="sv-projects-empty is-compact">
              <h2>No student linked</h2>
              <p>This folder is not connected to a student profile.</p>
            </div>
          )}
        </aside>
      </div>

      <section className="sv-project-panel">
        <div className="sv-project-panel-head">
          <div className="min-w-0">
            <p className="sv-project-section-kicker">Manuscript</p>
            <h2>Writing pages</h2>
            <p className="sv-project-section-meta">
              Open a page to review writing, leave remarks, or approve.
            </p>
          </div>
          <p className="sv-projects-activity">{pagesHint}</p>
        </div>

        {pages.length === 0 ? (
          <div className="sv-projects-empty">
            <span className="sv-projects-empty-icon" aria-hidden>
              <FileText className="size-6" strokeWidth={1.75} />
            </span>
            <h2>No pages yet</h2>
            <p>This project has no writing pages to review.</p>
          </div>
        ) : (
          <div className="sv-project-pages">
            <div className="sv-project-pages-head" aria-hidden>
              <span>#</span>
              <span>Page</span>
              <span>Status</span>
              <span />
            </div>
            {pages.map((page, index) => {
              const href = `/supervision/projects/${project._id}/pages/${page._id}`;
              const status = pageTone(page.reviewStatus);
              return (
                <article
                  key={page._id}
                  className={cn("sv-project-page", `is-${status.tone}`)}
                >
                  <span className="sv-project-page-num">{index + 1}</span>
                  <Link href={href} className="sv-project-page-copy">
                    <h3>{page.title}</h3>
                    {page.reviewRemark ? (
                      <p>{page.reviewRemark}</p>
                    ) : (
                      <p>Open to review content and leave feedback.</p>
                    )}
                  </Link>
                  <span
                    className={cn(
                      "sv-project-page-status",
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
                  <Link href={href} className="sv-projects-open">
                    Open
                    <ArrowRight className="size-3.5" />
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
