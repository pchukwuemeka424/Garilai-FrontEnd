"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CircleHelp,
  Download,
  History,
  Lightbulb,
  Mail,
  MessageSquare,
  PenLine,
  Plus,
  RefreshCw,
  Send,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/portal/ui/button";
import { Badge } from "@/components/portal/ui/badge";
import { Input } from "@/components/portal/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/portal/ui/card";
import { EmptyState } from "@/components/portal/feedback/empty-state";
import { LoadingPage } from "@/components/portal/feedback/loading-page";
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

  // Fall back to page review mirror when chapter title was renamed after review.
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

function statusBadgeClass(status: TimelineStatus) {
  switch (status) {
    case "Approved":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15";
    case "Rejected":
      return "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20";
    case "In review":
      return "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20";
    case "In progress":
      return "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/15";
    default:
      return "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/10";
  }
}

function statusLabel(status: TimelineStatus) {
  switch (status) {
    case "Approved":
      return "Approved";
    case "Rejected":
      return "Rejected";
    case "In review":
      return "Pending Review";
    case "In progress":
      return "In Progress";
    default:
      return "Not Started";
  }
}

function pipelineNodeClass(status: TimelineStatus) {
  switch (status) {
    case "Approved":
      return "bg-emerald-500 text-white ring-4 ring-emerald-100";
    case "Rejected":
      return "bg-red-500 text-white ring-4 ring-red-100";
    case "In review":
      return "bg-amber-500 text-white ring-4 ring-amber-100";
    case "In progress":
      return "bg-primary text-white ring-4 ring-primary/15";
    default:
      return "bg-slate-200 text-slate-600 ring-4 ring-slate-100";
  }
}

function pipelineConnectorClass(status: TimelineStatus) {
  switch (status) {
    case "Approved":
      return "bg-emerald-400";
    case "Rejected":
      return "bg-red-400";
    case "In review":
      return "bg-amber-400";
    case "In progress":
      return "bg-primary";
    default:
      return "bg-slate-200";
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

/** Prefer needs-revision → in progress → in review → first with content → first chapter. */
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
        html?: string;
        filename?: string;
      };
      const blob = new Blob([pack.html || ""], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = pack.filename || `${project?.title || "thesis"}.html`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Thesis package downloaded");
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
    return <LoadingPage label="Opening project…" />;
  }

  if (!project) {
    return (
      <EmptyState
        title="Project not found"
        description={error || "This project could not be loaded."}
        action="Back to projects"
        href="/student/projects"
      />
    );
  }

  const projectStatus =
    progressPct >= 100
      ? {
          label: "Completed",
          className: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
          dot: "bg-emerald-500",
        }
      : project.topicStatus === "draft" && progressPct === 0
        ? {
            label: "Draft",
            className: "bg-slate-100 text-slate-600 ring-slate-500/10",
            dot: "bg-slate-400",
          }
        : {
            label: "Active",
            className: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
            dot: "bg-emerald-500",
          };

  const typeLabel = projectTypeLabel(project.projectType);
  const howItWorksTeaser = projectHowItWorksTeaser(project.projectType);
  const howItWorksSteps = projectHowItWorksSteps(project.projectType);
  const singlePage = isSinglePageProjectType(project.projectType);
  const unitLabelPlural = singlePage ? "pages" : "chapters";
  const unitNoun = projectWritingUnitNoun(project.projectType);
  // Seed empty "Assignment" page ≠ uploaded; any non-empty writing counts as uploaded.
  const hasWritingContent = pages.some(
    (p) => countWordsFromHtml(String(p.content || "")) > 0,
  );
  const uploadLabel = singlePage
    ? hasWritingContent
      ? `Reupload ${unitNoun}`
      : `Upload ${unitNoun}`
    : "Upload file";
  const uploadActionTitle = singlePage
    ? hasWritingContent
      ? `Reupload ${unitNoun}`
      : `Upload ${unitNoun}`
    : "Import .docx / .pdf";
  const uploadActionBody = singlePage
    ? hasWritingContent
      ? "Replace the writing page with a new Word/PDF"
      : "Load an offline draft onto one page"
    : "Split an offline draft into chapters";

  return (
    <div className="space-y-5">
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

      <Link
        href={
          singlePage
            ? "/student/assignments"
            : "/student/projects"
        }
        className="inline-flex items-center gap-2 text-sm font-semibold text-foreground/55 hover:text-blue-600"
      >
        <ArrowLeft className="size-4" />
        {singlePage ? "Back to assignments" : "Back to all projects"}
      </Link>

      <Card className="overflow-hidden rounded-xl shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem] sm:leading-tight">
                  {project.title}
                </h1>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
                    projectStatus.className,
                  )}
                >
                  <span
                    className={cn("size-1.5 shrink-0 rounded-full", projectStatus.dot)}
                    aria-hidden
                  />
                  {projectStatus.label}
                </span>
              </div>

              <p className="text-sm font-semibold text-blue-600">{typeLabel}</p>

              {singlePage && project.studentMatNo?.trim() ? (
                <p className="text-sm text-foreground/55">
                  Mat No / Student No:{" "}
                  <span className="font-semibold text-foreground/80">
                    {project.studentMatNo.trim()}
                  </span>
                </p>
              ) : null}

              {singlePage && project.courseYear?.trim() ? (
                <p className="text-sm text-foreground/55">
                  Year:{" "}
                  <span className="font-semibold text-foreground/80">
                    {project.courseYear.trim()}
                  </span>
                </p>
              ) : null}

              {singlePage && project.courseName?.trim() ? (
                <p className="text-sm text-foreground/55">
                  Course:{" "}
                  <span className="font-semibold text-foreground/80">
                    {project.courseName.trim()}
                  </span>
                </p>
              ) : null}

              {singlePage && typeof project.score === "number" ? (
                <div className="rounded-xl border border-emerald-600/15 bg-emerald-50/80 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-800/70">
                    Lecturer score
                  </p>
                  <p className="mt-1 font-display text-3xl font-bold tracking-tight text-emerald-800">
                    {project.score}
                    <span className="text-lg font-semibold text-emerald-700/70">
                      /
                      {typeof project.assignmentBrief?.maxScore === "number"
                        ? project.assignmentBrief.maxScore
                        : 100}
                    </span>
                  </p>
                  {project.criterionScores &&
                  project.criterionScores.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-sm text-emerald-900/75">
                      {project.criterionScores.map((c) => (
                        <li key={c.name} className="flex justify-between gap-3">
                          <span>{c.name}</span>
                          <span className="font-semibold">
                            {c.score}/{c.maxMarks}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {project.scoreNote?.trim() ? (
                    <p className="mt-1.5 text-sm text-emerald-900/70">
                      {project.scoreNote.trim()}
                    </p>
                  ) : null}
                  {project.scoredAt ? (
                    <p className="mt-1 text-xs text-emerald-800/50">
                      Scored {formatDate(project.scoredAt)}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-foreground/55">
                {project.supervisor?.name && (
                  <>
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="size-3.5 shrink-0 text-foreground/40" />
                      <span className="font-medium text-foreground/70">
                        {project.supervisor.name}
                      </span>
                    </span>
                    <span
                      className="hidden h-3 w-px bg-border sm:block"
                      aria-hidden
                    />
                  </>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="size-3.5 shrink-0 text-foreground/40" />
                  Started {formatDate(project.createdAt)}
                </span>
                <span
                  className="hidden h-3 w-px bg-border sm:block"
                  aria-hidden
                />
                <span className="inline-flex items-center gap-1.5">
                  <RefreshCw className="size-3.5 shrink-0 text-foreground/40" />
                  {formatRelative(project.updatedAt)}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void exportPackage()}
              >
                <Download className="size-4" />
                Export
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-4" />
                {importing ? "Analysing…" : uploadLabel}
              </Button>
              {project.topicStatus === "draft" ? (
                <Button
                  type="button"
                  disabled={topicBusy}
                  onClick={() => void submitTopic()}
                >
                  <Send className="size-4" />
                  {topicBusy ? "Submitting…" : "Submit topic"}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="border-t border-border bg-slate-50/70 px-5 py-4 sm:px-6">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-foreground/70">
                Overall progress
              </span>
              <span className="font-bold tabular-nums text-blue-600">
                {progressPct}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-foreground/50">
              {approvedCount} of {pages.length || "—"} {unitLabelPlural} approved
            </p>
          </div>
        </CardContent>
      </Card>

      {project.projectType === "assignment" && project.assignmentBrief ? (
        <AssignmentBriefPanel brief={project.assignmentBrief} />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: singlePage ? "Open writing page" : "Write by chapter",
            body: continueTarget
              ? `Continue “${continueTarget.title}”`
              : singlePage
                ? "Open the full-page editor"
                : "Open the full-page editor",
            icon: PenLine,
            className: "bg-blue-50 text-blue-600",
            onClick: continueWriting,
          },
          {
            title: uploadActionTitle,
            body: uploadActionBody,
            icon: Upload,
            className: "bg-emerald-50 text-emerald-600",
            onClick: () => fileInputRef.current?.click(),
          },
          ...(singlePage
            ? []
            : [
                {
                  title: "Create chapter",
                  body: "Add a new section and start writing",
                  icon: Plus,
                  className: "bg-violet-50 text-violet-600",
                  onClick: openCreateChapter,
                },
              ]),
          {
            title: "How it works",
            body: howItWorksTeaser,
            icon: Lightbulb,
            className: "bg-amber-50 text-amber-600",
            onClick: () => setShowHowItWorks((v) => !v),
          },
        ].map((action) => (
          <button
            key={action.title}
            type="button"
            onClick={action.onClick}
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-blue-600/30 hover:shadow-md"
          >
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-lg",
                action.className,
              )}
            >
              <action.icon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{action.title}</span>
                <ArrowRight className="size-4 shrink-0 text-foreground/30" />
              </span>
              <span className="mt-0.5 block text-xs text-foreground/55">
                {action.body}
              </span>
            </span>
          </button>
        ))}
      </div>

      {showHowItWorks && (
        <Card className="rounded-xl">
          <CardContent className="grid gap-3 p-5 sm:grid-cols-3">
            {howItWorksSteps.map((step) => (
              <div key={step.title}>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="mt-1 text-xs text-foreground/55">{step.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {message && (
        <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {showAddForm && (
        <form
          id="create-chapter-form"
          onSubmit={(e) => void addPage(e)}
          className="rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <p className="text-sm font-semibold">
            {singlePage ? "Create writing page" : "Create chapter"}
          </p>
          <p className="mt-1 text-xs text-foreground/55">
            After creating, you’ll open the full-page editor automatically.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <Input
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
            />
            <div className="flex shrink-0 gap-2">
              <Button
                type="submit"
                disabled={adding || !newPageTitle.trim()}
              >
                <Plus className="size-4" />
                {adding
                  ? "Creating…"
                  : singlePage
                    ? "Create page"
                    : "Create chapter"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={adding}
                onClick={() => {
                  setShowAddForm(false);
                  setNewPageTitle("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </form>
      )}

      <Card className="rounded-xl shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border pb-4">
          <div>
            <CardTitle className="text-base">
              {singlePage ? "Writing page" : "Chapters"}
            </CardTitle>
            <CardDescription className="mt-0.5">
              {singlePage
                ? `${approvedCount} of ${pages.length} completed · one document surface`
                : `${approvedCount} of ${pages.length} completed · sequential writing pipeline`}
            </CardDescription>
          </div>
          {!singlePage && (
            <Button
              type="button"
              size="sm"
              onClick={openCreateChapter}
            >
              <Plus className="size-3.5" />
              Create chapter
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          {pages.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
              <CircleHelp className="mx-auto size-5 text-foreground/35" />
              <p className="mt-2 text-sm font-semibold">
                {singlePage ? "No writing page yet" : "No chapters yet"}
              </p>
              <p className="mt-1 text-xs text-foreground/55">
                {singlePage
                  ? "Import a Word/PDF draft, or create a page to open the editor."
                  : "Create a chapter to open the full-width writing page."}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-3.5" />
                  Import document
                </Button>
                {!singlePage && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={openCreateChapter}
                  >
                    <Plus className="size-3.5" />
                    Create chapter
                  </Button>
                )}
                {singlePage && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNewPageTitle("Assignment");
                      setShowAddForm(true);
                    }}
                  >
                    <Plus className="size-3.5" />
                    Create writing page
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <ol className="relative" aria-label="Chapter pipeline">
              {pageStatuses.map(({ page, status, commentCount }, index) => {
                const isLast = index === pageStatuses.length - 1;
                return (
                  <li key={page._id} className="relative flex gap-3 sm:gap-4">
                    {/* Pipeline rail */}
                    <div className="flex w-9 shrink-0 flex-col items-center sm:w-10">
                      <span
                        className={cn(
                          "relative z-10 grid size-8 place-items-center rounded-full text-xs font-bold sm:size-9 sm:text-[13px]",
                          pipelineNodeClass(status),
                        )}
                        aria-hidden
                      >
                        {status === "Approved" ? (
                          <Check className="size-4 stroke-[3]" />
                        ) : status === "Rejected" ? (
                          <X className="size-4 stroke-[3]" />
                        ) : (
                          index + 1
                        )}
                      </span>
                      {!isLast && (
                        <span
                          className={cn(
                            "mt-1 w-0.5 flex-1 min-h-4",
                            pipelineConnectorClass(status),
                          )}
                          aria-hidden
                        />
                      )}
                    </div>

                    <Link
                      href={chapterHref(page._id)}
                      className={cn(
                        "group min-w-0 flex-1 rounded-xl border border-border bg-white px-3.5 py-3 shadow-sm transition",
                        "hover:border-primary/35 hover:shadow-md",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        !isLast && "mb-3 sm:mb-4",
                      )}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block text-[11px] font-semibold uppercase tracking-wide text-foreground/40">
                            Stage {index + 1}
                          </span>
                          <span className="mt-0.5 block text-sm font-semibold text-foreground group-hover:text-primary">
                            {page.title}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold",
                            statusBadgeClass(status),
                          )}
                        >
                          {statusLabel(status)}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs text-foreground/50">
                        {chapterHint(page.title)}
                      </span>
                      {commentCount > 0 && (
                        <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                          <MessageSquare className="size-3" />
                          {commentCount}{" "}
                          {commentCount === 1 ? "comment" : "comments"}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <History className="size-5 text-foreground/70" />
            <div>
              <CardTitle className="text-base">Version History</CardTitle>
              <CardDescription>
                Snapshots created when you submit a chapter
              </CardDescription>
            </div>
          </div>
          {versions.length > 0 && (
            <Badge variant="neutral">{versions.length} versions</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {versions.length === 0 ? (
            <p className="text-sm text-foreground/55">No versions yet</p>
          ) : (
            <>
              <ul className="space-y-2">
                {versions.slice(0, 8).map((v) => (
                  <li
                    key={v._id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-sm"
                  >
                    <span className="font-semibold">
                      Version {v.versionNumber}
                    </span>
                    <span className="text-xs text-foreground/55">
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
              {versions.length >= 2 && (
                <div className="space-y-3 border-t border-border pt-4">
                  <p className="text-sm font-semibold">Compare versions</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      className="h-11 flex-1 rounded-lg border border-border bg-card px-3 text-sm"
                      value={compareA}
                      onChange={(e) => setCompareA(e.target.value)}
                    >
                      <option value="">Version A</option>
                      {versions.map((v) => (
                        <option key={v._id} value={v._id}>
                          v{v.versionNumber}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-11 flex-1 rounded-lg border border-border bg-card px-3 text-sm"
                      value={compareB}
                      onChange={(e) => setCompareB(e.target.value)}
                    >
                      <option value="">Version B</option>
                      {versions.map((v) => (
                        <option key={v._id} value={v._id}>
                          v{v.versionNumber}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void runCompare()}
                    >
                      Compare
                    </Button>
                  </div>
                  {compareText && (
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-xs text-foreground/70">
                      {compareText}
                    </pre>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
