"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  FolderKanban,
  History,
  Lightbulb,
  MessageSquare,
  PenLine,
  Plus,
  RefreshCw,
  Send,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { countWordsFromHtml } from "@/components/portal/editor/document-editor";
import { apiFetch, apiUpload } from "@/lib/portal-api";
import {
  mapChapterStatus,
  countRemarkComments,
} from "@/components/portal/features/chapters/chapter-timeline";
import type { TimelineStatus } from "@/components/portal/features/chapters/chapter-status-chip";
import {
  isSinglePageProjectType,
  projectHowItWorksSteps,
  projectHowItWorksTeaser,
  projectTypeLabel,
  projectWritingUnitNoun,
  type ProjectType,
} from "@/lib/portal/project-types";
import { AssignmentBriefPanel } from "@/components/portal/features/assignment/assignment-brief-panel";
import type { AssignmentBriefView } from "@/components/portal/features/assignment/assignment-brief-panel";
import { cn } from "@/lib/portal/cn";

type ProjectPage = {
  _id: string;
  title: string;
  content?: string;
  order?: number;
  reviewStatus?: "none" | "approved" | "needs_revision";
  reviewRemark?: string;
};

type CriterionScore = {
  name: string;
  score: number;
  maxMarks: number;
};

type Project = {
  _id: string;
  title: string;
  projectType: ProjectType;
  topic?: string;
  studentMatNo?: string;
  courseYear?: string;
  courseName?: string;
  progressPercent?: number;
  topicStatus?: "draft" | "submitted" | "approved";
  createdAt?: string;
  updatedAt?: string;
  pages?: ProjectPage[];
  supervisor?: { id: string; name: string; email: string } | null;
  score?: number | null;
  scoreNote?: string;
  scoredAt?: string | null;
  criterionScores?: CriterionScore[];
  assignmentBrief?: AssignmentBriefView | null;
  assignmentBriefId?: string | null;
};

type ImportResult = {
  project: Project;
  import: {
    method: "ai" | "heuristic";
    sectionCount: number;
    fileName: string;
    mode: string;
    singlePage?: boolean;
  };
};

type VersionRow = {
  _id: string;
  versionNumber: number;
  submittedAt?: string;
  wordCount?: number;
  chapterId: string;
};

type ApiChapter = {
  _id: string;
  number: number;
  title: string;
  status: string;
  rejectionReason?: string;
};

function normalizeTitle(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function statusForPage(
  page: ProjectPage,
  chapters: ApiChapter[],
): { status: TimelineStatus; commentCount: number } {
  const key = normalizeTitle(page.title || "");
  const matched = chapters.find((c) => normalizeTitle(c.title || "") === key);

  if (matched) {
    const status = mapChapterStatus(matched.status);
    const remark =
      matched.rejectionReason?.trim() || page.reviewRemark?.trim() || "";
    return {
      status,
      commentCount:
        status === "Rejected" ? Math.max(countRemarkComments(remark), 1) : 0,
    };
  }

  if (page.reviewStatus === "approved") {
    return { status: "Approved", commentCount: 0 };
  }
  if (page.reviewStatus === "needs_revision") {
    return {
      status: "Rejected",
      commentCount: Math.max(countRemarkComments(page.reviewRemark), 1),
    };
  }
  if (String(page.content || "").trim().length > 0) {
    return { status: "In progress", commentCount: 0 };
  }
  return { status: "Not started", commentCount: 0 };
}

function statusTone(status: TimelineStatus) {
  switch (status) {
    case "Approved":
      return "approved";
    case "Rejected":
      return "revision";
    case "In review":
      return "review";
    case "In progress":
      return "progress";
    default:
      return "idle";
  }
}

function statusLabel(status: TimelineStatus) {
  switch (status) {
    case "Approved":
      return "Approved";
    case "Rejected":
      return "Needs revision";
    case "In review":
      return "Pending review";
    case "In progress":
      return "In progress";
    default:
      return "Not started";
  }
}

function formatRelative(value?: string) {
  if (!value) return "Recently";
  const days = Math.floor(
    (Date.now() - new Date(value).getTime()) / 86_400_000,
  );
  if (days <= 0) return "Updated today";
  if (days === 1) return "Updated 1 day ago";
  if (days < 30) return `Updated ${days} days ago`;
  return `Updated ${new Date(value).toLocaleDateString()}`;
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatToday() {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

const CHAPTER_HINTS: Record<string, string> = {
  abstract: "Concise overview of the study",
  introduction: "Background, problem, and objectives",
  literature: "Related work and research gap",
  methodology: "Design, sampling, and analysis",
  methods: "Methods and materials",
  results: "Findings and interpretation",
  findings: "Present and analyse findings",
  discussion: "Implications and contribution",
  conclusion: "Summary and recommendations",
  references: "Citation list",
};

function chapterHint(title: string) {
  const key = title.toLowerCase();
  for (const [k, hint] of Object.entries(CHAPTER_HINTS)) {
    if (key.includes(k)) return hint;
  }
  return "Open to write or revise this chapter";
}

function pickContinueChapter(
  pageStatuses: Array<{
    page: ProjectPage;
    status: TimelineStatus;
  }>,
): ProjectPage | null {
  if (pageStatuses.length === 0) return null;

  const byStatus = (wanted: TimelineStatus) =>
    pageStatuses.find((p) => p.status === wanted)?.page ?? null;

  return (
    byStatus("Rejected") ||
    byStatus("In progress") ||
    byStatus("In review") ||
    pageStatuses.find(
      (p) => String(p.page.content || "").trim().length > 0,
    )?.page ||
    pageStatuses[0]?.page ||
    null
  );
}

function topicStatusLabel(status?: Project["topicStatus"]) {
  switch (status) {
    case "approved":
      return "Approved";
    case "submitted":
      return "Awaiting approval";
    default:
      return "Draft";
  }
}

export default function ProjectOverviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.id;
  const pageFromQuery = searchParams.get("page");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [pages, setPages] = useState<ProjectPage[]>([]);
  const [chapters, setChapters] = useState<ApiChapter[]>([]);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [topicBusy, setTopicBusy] = useState(false);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [compareText, setCompareText] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [todayLabel, setTodayLabel] = useState("");

  useEffect(() => {
    setTodayLabel(formatToday());
  }, []);

  function chapterHref(pageId: string) {
    return `/student/projects/${projectId}/pages/${pageId}`;
  }

  function applyProject(data: Project) {
    const nextPages = [...(data.pages || [])].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
    setProject(data);
    setPages(nextPages);
  }

  const loadChapters = useCallback(async () => {
    try {
      const list = (await apiFetch(
        `/api/v1/projects/${projectId}/chapters`,
      ).catch(() => [])) as ApiChapter[];
      setChapters(list);
    } catch {
      setChapters([]);
    }
  }, [projectId]);

  useEffect(() => {
    if (pageFromQuery) {
      router.replace(chapterHref(pageFromQuery));
      return;
    }
    apiFetch(`/api/v1/projects/${projectId}`)
      .then((data) => applyProject(data as Project))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    void loadChapters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, pageFromQuery]);

  const loadVersions = useCallback(async () => {
    try {
      const chapterList = (await apiFetch(
        `/api/v1/projects/${projectId}/chapters`,
      )) as Array<{ _id: string }>;
      const all: VersionRow[] = [];
      for (const ch of chapterList) {
        const rows = (await apiFetch(
          `/api/v1/chapters/${ch._id}/versions`,
        )) as VersionRow[];
        all.push(...rows);
      }
      all.sort(
        (a, b) =>
          new Date(b.submittedAt || 0).getTime() -
          new Date(a.submittedAt || 0).getTime(),
      );
      setVersions(all);
    } catch {
      // optional
    }
  }, [projectId]);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  const pageStatuses = useMemo(
    () =>
      pages.map((page) => ({
        page,
        ...statusForPage(page, chapters),
      })),
    [pages, chapters],
  );

  const approvedCount = pageStatuses.filter((p) => p.status === "Approved").length;
  const revisionCount = pageStatuses.filter((p) => p.status === "Rejected").length;
  const progressPct = project?.progressPercent ?? 0;
  const continueTarget = useMemo(
    () => pickContinueChapter(pageStatuses),
    [pageStatuses],
  );

  function openCreateChapter() {
    setShowAddForm(true);
    setError(null);
    setMessage(null);
    requestAnimationFrame(() => {
      document
        .getElementById("create-chapter-form")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function continueWriting() {
    if (continueTarget?._id) {
      router.push(chapterHref(continueTarget._id));
      return;
    }
    openCreateChapter();
  }

  async function addPage(e: React.FormEvent) {
    e.preventDefault();
    const title = newPageTitle.trim();
    if (!title) {
      setError("Enter a chapter title");
      return;
    }
    setAdding(true);
    setMessage(null);
    setError(null);
    try {
      const previousIds = new Set(pages.map((p) => p._id));
      const updated = (await apiFetch(`/api/v1/projects/${projectId}/pages`, {
        method: "POST",
        body: JSON.stringify({ title }),
      })) as Project;
      const created = [...(updated.pages || [])].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0),
      );
      const newest =
        created.find((p) => !previousIds.has(p._id)) ||
        created.find(
          (p) => normalizeTitle(p.title || "") === normalizeTitle(title),
        ) ||
        created[created.length - 1];
      applyProject(updated);
      setNewPageTitle("");
      setShowAddForm(false);
      void loadChapters();
      setMessage(
        newest?._id
          ? `Added “${title}”. Open it from the chapters list when you’re ready.`
          : `Added “${title}”`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add chapter");
    } finally {
      setAdding(false);
    }
  }

  async function onUploadDocument(file: File) {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".docx") && !lower.endsWith(".pdf")) {
      setError("Please upload a .docx Word document or PDF");
      return;
    }

    const singlePage = isSinglePageProjectType(project?.projectType);
    let mode: "append" | "replace" = "append";
    if (pages.length > 0) {
      if (singlePage) {
        const ok = window.confirm(
          "Replace the content on your writing page with this uploaded document?",
        );
        if (!ok) {
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }
        mode = "replace";
      } else {
        const replace = window.confirm(
          `You already have ${pages.length} chapter(s).\n\nOK = replace them with sections from the uploaded file\nCancel = append new sections after existing chapters`,
        );
        mode = replace ? "replace" : "append";
      }
    }

    setImporting(true);
    setMessage(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);
      const result = (await apiUpload(
        `/api/v1/projects/${projectId}/import-document`,
        formData,
      )) as ImportResult;

      applyProject(result.project);
      void loadChapters();
      if (result.import.singlePage || singlePage) {
        setMessage(
          `Imported “${result.import.fileName}” onto your writing page. Open it when you’re ready.`,
        );
      } else {
        const how =
          result.import.method === "ai"
            ? "AI analysis"
            : "document heading detection";
        setMessage(
          `Imported ${result.import.sectionCount} section(s) from “${result.import.fileName}” via ${how}. Open a chapter when you’re ready.`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function submitTopic() {
    setTopicBusy(true);
    setMessage(null);
    setError(null);
    try {
      const updated = (await apiFetch(
        `/api/v1/projects/${projectId}/topic/submit`,
        { method: "POST" },
      )) as Project;
      setProject((prev) =>
        prev
          ? { ...prev, topicStatus: updated.topicStatus || "submitted" }
          : prev,
      );
      setMessage("Topic submitted for approval");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Topic submit failed");
    } finally {
      setTopicBusy(false);
    }
  }

  async function exportPackage() {
    setMessage(null);
    setError(null);
    try {
      const pack = (await apiFetch(`/api/v1/projects/${projectId}/export`)) as {
        title?: string;
        projectType?: string;
        abstract?: string;
        pages?: Array<{ title?: string; content?: string }>;
        filename?: string;
      };
      const { downloadProjectDocx } = await import("@/lib/portal-project-docx");
      const filename = await downloadProjectDocx({
        title: pack.title || project?.title || "project",
        projectType: pack.projectType || project?.projectType,
        abstract: pack.abstract,
        pages: (pack.pages || pages).map((page) => ({
          title: page.title || "Untitled",
          content: page.content || "",
        })),
        filename: pack.filename,
      });
      setMessage(`Downloaded “${filename}”`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  async function runCompare() {
    if (!compareA || !compareB) {
      setError("Select two versions to compare");
      return;
    }
    setError(null);
    try {
      const [a, b] = await Promise.all([
        apiFetch(`/api/v1/versions/${compareA}`) as Promise<{
          version: { versionNumber: number; richTextJson?: { html?: string } };
        }>,
        apiFetch(`/api/v1/versions/${compareB}`) as Promise<{
          version: { versionNumber: number; richTextJson?: { html?: string } };
        }>,
      ]);
      const strip = (html?: string) =>
        (html || "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      const textA = strip(a.version.richTextJson?.html);
      const textB = strip(b.version.richTextJson?.html);
      setCompareText(
        `Version ${a.version.versionNumber} (${textA.length} chars)\n---\n${textA.slice(0, 1200)}\n\n==== vs ====\n\nVersion ${b.version.versionNumber} (${textB.length} chars)\n---\n${textB.slice(0, 1200)}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compare failed");
    }
  }

  if (loading || pageFromQuery) {
    return (
      <div className="stu-prd" aria-busy="true">
        <header className="stu-prd-intro">
          <div className="stu-prd-intro-copy">
            <Link href="/student/projects" className="stu-prd-back">
              <ArrowLeft size={14} />
              Back to projects
            </Link>
            <p className="stu-prd-eyebrow">{todayLabel || "Project"}</p>
            <h1>Project</h1>
            <p>Loading chapters, progress, and supervisor details…</p>
          </div>
        </header>
        <div className="stu-prd-skeleton-strip" aria-hidden />
        <div className="stu-prd-panel">
          <div className="stu-prd-skeleton-block" aria-hidden />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="stu-prd">
        <header className="stu-prd-intro">
          <div className="stu-prd-intro-copy">
            <Link href="/student/projects" className="stu-prd-back">
              <ArrowLeft size={14} />
              Back to projects
            </Link>
            <p className="stu-prd-eyebrow">{todayLabel || "Project"}</p>
            <h1>Project not found</h1>
            <p>{error || "This project could not be loaded."}</p>
          </div>
        </header>
        <div className="stu-prd-empty">
          <span className="stu-prd-empty-icon" aria-hidden>
            <FolderKanban size={22} />
          </span>
          <h3>Unable to open this project</h3>
          <p>It may have been removed, or you may not have access.</p>
          <Link href="/student/projects" className="stu-prd-btn stu-prd-btn-primary">
            View projects
          </Link>
        </div>
      </div>
    );
  }

  const projectStatus =
    progressPct >= 100
      ? { label: "Completed", tone: "approved" as const }
      : revisionCount > 0
        ? { label: "Needs revision", tone: "revision" as const }
        : project.topicStatus === "draft" && progressPct === 0
          ? { label: "Draft", tone: "idle" as const }
          : { label: "Active", tone: "progress" as const };

  const typeLabel = projectTypeLabel(project.projectType);
  const howItWorksTeaser = projectHowItWorksTeaser(project.projectType);
  const howItWorksSteps = projectHowItWorksSteps(project.projectType);
  const singlePage = isSinglePageProjectType(project.projectType);
  const unitLabelPlural = singlePage ? "pages" : "chapters";
  const unitNoun = projectWritingUnitNoun(project.projectType);
  const hasWritingContent = pages.some(
    (p) => countWordsFromHtml(String(p.content || "")) > 0,
  );
  const uploadLabel = singlePage
    ? hasWritingContent
      ? `Reupload ${unitNoun}`
      : `Upload ${unitNoun}`
    : importing
      ? "Importing…"
      : "Import document";
  const backHref = singlePage ? "/student/assignments" : "/student/projects";
  const backLabel = singlePage ? "Back to assignments" : "Back to projects";
  const continueLabel = continueTarget
    ? singlePage
      ? "Continue writing"
      : `Continue “${continueTarget.title}”`
    : singlePage
      ? "Open writing page"
      : "Start writing";
  const subtitle =
    project.topic?.trim() ||
    project.courseName?.trim() ||
    (singlePage
      ? "Review the brief, write your submission, and track feedback."
      : "Write chapters, submit for review, and track supervisor feedback.");

  return (
    <div className="stu-prd">
      <input
        ref={fileInputRef}
        type="file"
        accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onUploadDocument(file);
        }}
      />

      <header className="stu-prd-intro">
        <div className="stu-prd-intro-copy">
          <Link href={backHref} className="stu-prd-back">
            <ArrowLeft size={14} />
            {backLabel}
          </Link>
          <p className="stu-prd-eyebrow">
            {typeLabel}
            {todayLabel ? ` · ${todayLabel}` : ""}
          </p>
          <h1>{project.title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="stu-prd-intro-actions">
          <button
            type="button"
            className="stu-prd-btn stu-prd-btn-ghost"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={15} />
            {uploadLabel}
          </button>
          <button
            type="button"
            className="stu-prd-btn stu-prd-btn-ghost"
            onClick={() => void exportPackage()}
          >
            <Download size={15} />
            Export
          </button>
          {project.topicStatus === "draft" ? (
            <button
              type="button"
              className="stu-prd-btn stu-prd-btn-ghost"
              disabled={topicBusy}
              onClick={() => void submitTopic()}
            >
              <Send size={15} />
              {topicBusy ? "Submitting…" : "Submit topic"}
            </button>
          ) : null}
          <button
            type="button"
            className="stu-prd-btn stu-prd-btn-primary"
            onClick={continueWriting}
          >
            <PenLine size={15} />
            {continueLabel}
            <ArrowRight size={14} />
          </button>
        </div>
      </header>

      <section className="stu-prd-metrics" aria-label="Project overview">
        <div className="stu-prd-metric">
          <span className="stu-prd-metric-label">Status</span>
          <strong className="stu-prd-metric-value">
            <span className={cn("stu-prd-badge", `tone-${projectStatus.tone}`)}>
              {projectStatus.label}
            </span>
          </strong>
          <span className="stu-prd-metric-hint">{formatRelative(project.updatedAt)}</span>
        </div>
        <div className="stu-prd-metric">
          <span className="stu-prd-metric-label">Progress</span>
          <strong className="stu-prd-metric-value">
            {progressPct}
            <em>%</em>
          </strong>
          <span className="stu-prd-metric-hint">
            {approvedCount} of {pages.length} {unitLabelPlural} approved
          </span>
          <div className="stu-prd-progress" aria-hidden>
            <span style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }} />
          </div>
        </div>
        <div className="stu-prd-metric">
          <span className="stu-prd-metric-label">Supervisor</span>
          <strong className="stu-prd-metric-value stu-prd-metric-text">
            <UserRound size={14} aria-hidden />
            {project.supervisor?.name || "Not assigned"}
          </strong>
          <span className="stu-prd-metric-hint">
            {project.supervisor?.email || "Awaiting assignment"}
          </span>
        </div>
        <div className="stu-prd-metric">
          <span className="stu-prd-metric-label">Topic</span>
          <strong className="stu-prd-metric-value">
            <span
              className={cn(
                "stu-prd-badge",
                project.topicStatus === "approved"
                  ? "tone-approved"
                  : project.topicStatus === "submitted"
                    ? "tone-review"
                    : "tone-idle",
              )}
            >
              {topicStatusLabel(project.topicStatus)}
            </span>
          </strong>
          <span className="stu-prd-metric-hint">
            Started {formatDate(project.createdAt)}
          </span>
        </div>
      </section>

      {singlePage && project.assignmentBrief ? (
        <AssignmentBriefPanel brief={project.assignmentBrief} />
      ) : null}

      {singlePage && typeof project.score === "number" ? (
        <section className="stu-prd-score" aria-label="Lecturer score">
          <div>
            <p className="stu-prd-score-label">Lecturer score</p>
            <p className="stu-prd-score-value">
              {project.score}
              <span>
                /
                {typeof project.assignmentBrief?.maxScore === "number"
                  ? project.assignmentBrief.maxScore
                  : 100}
              </span>
            </p>
            {project.scoreNote?.trim() ? (
              <p className="stu-prd-score-note">{project.scoreNote.trim()}</p>
            ) : null}
            {project.scoredAt ? (
              <p className="stu-prd-score-meta">
                Scored {formatDate(project.scoredAt)}
              </p>
            ) : null}
          </div>
          {project.criterionScores && project.criterionScores.length > 0 ? (
            <ul className="stu-prd-criteria">
              {project.criterionScores.map((c) => (
                <li key={c.name}>
                  <span>{c.name}</span>
                  <strong>
                    {c.score}/{c.maxMarks}
                  </strong>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {message ? (
        <p className="stu-prd-flash is-ok" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="stu-prd-flash is-err" role="alert">
          {error}
        </p>
      ) : null}

      {showAddForm ? (
        <form
          id="create-chapter-form"
          onSubmit={(e) => void addPage(e)}
          className="stu-prd-create"
        >
          <div>
            <h2>{singlePage ? "Create writing page" : "Create chapter"}</h2>
            <p>
              Give it a clear title, then open the editor when you are ready to
              write.
            </p>
          </div>
          <div className="stu-prd-create-row">
            <input
              autoFocus
              value={newPageTitle}
              onChange={(e) => setNewPageTitle(e.target.value)}
              placeholder={
                singlePage
                  ? "Page title (e.g. Assignment)"
                  : "Chapter title (e.g. Literature Review)"
              }
              maxLength={200}
              disabled={adding}
              className="stu-prd-input"
            />
            <button
              type="submit"
              className="stu-prd-btn stu-prd-btn-primary"
              disabled={adding || !newPageTitle.trim()}
            >
              <Plus size={15} />
              {adding
                ? "Creating…"
                : singlePage
                  ? "Create page"
                  : "Create chapter"}
            </button>
            <button
              type="button"
              className="stu-prd-btn stu-prd-btn-ghost"
              disabled={adding}
              onClick={() => {
                setShowAddForm(false);
                setNewPageTitle("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <section
        className="stu-prd-panel"
        aria-labelledby="stu-prd-chapters-heading"
      >
        <div className="stu-prd-panel-head">
          <div>
            <h2 id="stu-prd-chapters-heading">
              {singlePage ? "Writing page" : "Chapters"}
            </h2>
            <p>
              {pages.length === 0
                ? singlePage
                  ? "Create or import a page to begin writing."
                  : "Add chapters to build your writing pipeline."
                : `${approvedCount} of ${pages.length} approved${
                    revisionCount > 0
                      ? ` · ${revisionCount} need${revisionCount === 1 ? "s" : ""} revision`
                      : ""
                  }`}
            </p>
          </div>
          {!singlePage ? (
            <div className="stu-prd-panel-actions">
              <button
                type="button"
                className="stu-prd-btn stu-prd-btn-ghost stu-prd-btn-sm"
                onClick={openCreateChapter}
              >
                <Plus size={14} />
                Add chapter
              </button>
            </div>
          ) : null}
        </div>

        <div className="stu-prd-panel-body">
          {pages.length === 0 ? (
            <div className="stu-prd-empty stu-prd-empty-inset">
              <span className="stu-prd-empty-icon" aria-hidden>
                <CircleHelp size={22} />
              </span>
              <h3>{singlePage ? "No writing page yet" : "No chapters yet"}</h3>
              <p>
                {singlePage
                  ? "Import a Word/PDF draft, or create a page to open the editor."
                  : "Create a chapter or import a document to split into sections."}
              </p>
              <div className="stu-prd-empty-actions">
                <button
                  type="button"
                  className="stu-prd-btn stu-prd-btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={15} />
                  Import document
                </button>
                {!singlePage ? (
                  <button
                    type="button"
                    className="stu-prd-btn stu-prd-btn-ghost"
                    onClick={openCreateChapter}
                  >
                    <Plus size={15} />
                    Create chapter
                  </button>
                ) : (
                  <button
                    type="button"
                    className="stu-prd-btn stu-prd-btn-ghost"
                    onClick={() => {
                      setNewPageTitle("Assignment");
                      setShowAddForm(true);
                    }}
                  >
                    <Plus size={15} />
                    Create writing page
                  </button>
                )}
              </div>
            </div>
          ) : (
            <ol className="stu-prd-chapters" aria-label="Chapter pipeline">
              {pageStatuses.map(({ page, status, commentCount }, index) => {
                const isContinue = continueTarget?._id === page._id;
                return (
                  <li key={page._id}>
                    <Link
                      href={chapterHref(page._id)}
                      className={cn(
                        "stu-prd-chapter",
                        isContinue && "is-next",
                      )}
                    >
                      <span
                        className={cn(
                          "stu-prd-chapter-index",
                          `tone-${statusTone(status)}`,
                        )}
                        aria-hidden
                      >
                        {status === "Approved" ? (
                          <Check size={14} strokeWidth={3} />
                        ) : status === "Rejected" ? (
                          <X size={14} strokeWidth={3} />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <span className="stu-prd-chapter-copy">
                        <span className="stu-prd-chapter-meta">
                          Stage {index + 1}
                          {isContinue ? " · Continue here" : ""}
                        </span>
                        <strong>{page.title}</strong>
                        <em>{chapterHint(page.title)}</em>
                        {commentCount > 0 ? (
                          <span className="stu-prd-chapter-notes">
                            <MessageSquare size={12} />
                            {commentCount}{" "}
                            {commentCount === 1 ? "comment" : "comments"}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={cn(
                          "stu-prd-badge",
                          `tone-${statusTone(status)}`,
                        )}
                      >
                        {statusLabel(status)}
                      </span>
                      <ArrowRight
                        size={16}
                        className="stu-prd-chapter-arrow"
                        aria-hidden
                      />
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>

      <section className="stu-prd-tools" aria-label="Project tools">
        <button
          type="button"
          className={cn("stu-prd-tool-toggle", showHowItWorks && "is-open")}
          aria-expanded={showHowItWorks}
          onClick={() => setShowHowItWorks((v) => !v)}
        >
          <span className="stu-prd-tool-toggle-main">
            <Lightbulb size={16} aria-hidden />
            <span>
              <strong>How it works</strong>
              <em>{howItWorksTeaser}</em>
            </span>
          </span>
          <ChevronDown size={16} aria-hidden />
        </button>
        {showHowItWorks ? (
          <div className="stu-prd-howto">
            {howItWorksSteps.map((step, index) => (
              <div key={step.title} className="stu-prd-howto-step">
                <span aria-hidden>{index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          className={cn("stu-prd-tool-toggle", showVersions && "is-open")}
          aria-expanded={showVersions}
          onClick={() => setShowVersions((v) => !v)}
        >
          <span className="stu-prd-tool-toggle-main">
            <History size={16} aria-hidden />
            <span>
              <strong>Version history</strong>
              <em>
                {versions.length === 0
                  ? "Snapshots appear when you submit a chapter"
                  : `${versions.length} version${versions.length === 1 ? "" : "s"} saved`}
              </em>
            </span>
          </span>
          <ChevronDown size={16} aria-hidden />
        </button>
        {showVersions ? (
          <div className="stu-prd-versions">
            {versions.length === 0 ? (
              <p className="stu-prd-muted">No versions yet.</p>
            ) : (
              <>
                <ul>
                  {versions.slice(0, 8).map((v) => (
                    <li key={v._id}>
                      <strong>Version {v.versionNumber}</strong>
                      <span>
                        {v.submittedAt
                          ? new Date(v.submittedAt).toLocaleString()
                          : "—"}
                        {typeof v.wordCount === "number"
                          ? ` · ${v.wordCount} words`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                {versions.length >= 2 ? (
                  <div className="stu-prd-compare">
                    <p>Compare versions</p>
                    <div className="stu-prd-compare-row">
                      <select
                        className="stu-prd-select"
                        value={compareA}
                        onChange={(e) => setCompareA(e.target.value)}
                        aria-label="Version A"
                      >
                        <option value="">Version A</option>
                        {versions.map((v) => (
                          <option key={v._id} value={v._id}>
                            v{v.versionNumber}
                          </option>
                        ))}
                      </select>
                      <select
                        className="stu-prd-select"
                        value={compareB}
                        onChange={(e) => setCompareB(e.target.value)}
                        aria-label="Version B"
                      >
                        <option value="">Version B</option>
                        {versions.map((v) => (
                          <option key={v._id} value={v._id}>
                            v{v.versionNumber}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="stu-prd-btn stu-prd-btn-ghost stu-prd-btn-sm"
                        onClick={() => void runCompare()}
                      >
                        Compare
                      </button>
                    </div>
                    {compareText ? (
                      <pre className="stu-prd-compare-out">{compareText}</pre>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </section>

      <div className="stu-prd-meta-foot">
        <span>
          <Calendar size={13} aria-hidden />
          Started {formatDate(project.createdAt)}
        </span>
        <span>
          <RefreshCw size={13} aria-hidden />
          {formatRelative(project.updatedAt)}
        </span>
      </div>
    </div>
  );
}
