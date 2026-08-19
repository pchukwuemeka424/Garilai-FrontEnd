"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Award,
  BookOpen,
  CheckCircle2,
  FileText,
  FlaskConical,
  FolderKanban,
  FolderOpen,
  LayoutGrid,
  List,
  MoreVertical,
  Newspaper,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/portal/ui/button";
import { Skeleton } from "@/components/portal/ui/skeleton";
import { ConfirmModal } from "@/components/portal/ui/confirm-modal";
import { LoadingPage } from "@/components/portal/feedback/loading-page";
import { apiFetch } from "@/lib/portal-api";
import {
  PROJECT_TYPES,
  projectAdvisorNoun,
  projectTypeLabel,
} from "@/lib/portal/project-types";
import { cn } from "@/lib/portal/cn";

type Project = {
  _id: string;
  title: string;
  projectType: string;
  topic?: string;
  progressPercent?: number;
  status?: string;
  topicStatus?: "draft" | "submitted" | "approved" | string;
  updatedAt?: string;
  createdAt?: string;
  supervisor?: { id: string; name: string; email: string } | null;
};

type Chapter = {
  _id: string;
  status: string;
};

type ViewMode = "list" | "grid";
type StatusFilter = "all" | "active" | "draft" | "revision" | "completed";

const TYPE_META: Record<
  string,
  { icon: LucideIcon; iconClass: string; accent: string }
> = {
  dissertation: {
    icon: Award,
    iconClass: "bg-[#eff6ff] text-[#2563eb]",
    accent: "from-[#2563eb] to-[#1d4ed8]",
  },
  thesis: {
    icon: BookOpen,
    iconClass: "bg-[#ecfdf5] text-[#059669]",
    accent: "from-[#059669] to-[#047857]",
  },
  research: {
    icon: FlaskConical,
    iconClass: "bg-[#fff7ed] text-[#ea580c]",
    accent: "from-[#ea580c] to-[#c2410c]",
  },
  project: {
    icon: FolderKanban,
    iconClass: "bg-[#f5f3ff] text-[#7c3aed]",
    accent: "from-[#7c3aed] to-[#6d28d9]",
  },
  capstone: {
    icon: Award,
    iconClass: "bg-[#fffbeb] text-[#d97706]",
    accent: "from-[#d97706] to-[#b45309]",
  },
  publication: {
    icon: Newspaper,
    iconClass: "bg-[#f1f5f9] text-[#475569]",
    accent: "from-[#475569] to-[#334155]",
  },
};

function projectBucket(
  project: Project,
): "active" | "completed" | "archived" | "revision" | "draft" {
  const pct = project.progressPercent ?? 0;
  if (project.status === "archived") return "archived";
  if (pct >= 100 || project.status === "completed") return "completed";
  if (project.status === "needs_revision") return "revision";
  if (pct === 0 && (project.topicStatus === "draft" || !project.topicStatus)) {
    return "draft";
  }
  return "active";
}

function statusMeta(project: Project): {
  label: string;
  tone: "done" | "revision" | "progress" | "idle" | "archived";
} {
  const bucket = projectBucket(project);
  if (bucket === "completed") return { label: "Completed", tone: "done" };
  if (bucket === "archived") return { label: "Archived", tone: "archived" };
  if (bucket === "revision") return { label: "Needs revision", tone: "revision" };
  if (bucket === "draft") return { label: "Draft", tone: "idle" };
  return { label: "In progress", tone: "progress" };
}

const STATUS_STYLES: Record<ReturnType<typeof statusMeta>["tone"], string> = {
  done: "bg-emerald-50 text-emerald-700",
  revision: "bg-red-50 text-red-700",
  progress: "bg-blue-50 text-blue-700",
  idle: "bg-slate-100 text-slate-600",
  archived: "bg-slate-100 text-slate-500",
};

function progressTone(pct: number, project: Project) {
  if (project.status === "needs_revision") return "bg-amber-500";
  if (pct >= 100 || project.status === "completed") return "bg-emerald-500";
  if (pct >= 50) return "bg-[#0D0B61]";
  if (pct > 0) return "bg-[#2563eb]";
  return "bg-slate-200";
}

function formatStartDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ProjectsHeroArt() {
  return (
    <svg
      viewBox="0 0 160 88"
      className="h-[4.5rem] w-[8.5rem] shrink-0"
      aria-hidden
    >
      <rect x="78" y="46" width="54" height="34" rx="6" fill="#EEF0FF" />
      <rect x="86" y="38" width="38" height="8" rx="3" fill="#C7CBFF" />
      <path d="M92 54h26M92 62h18" stroke="#5B5CE2" strokeWidth="2" strokeLinecap="round" />
      <circle cx="36" cy="70" r="16" fill="#E8FBF3" />
      <path d="M36 70c0-14 8-26 8-26s8 12 8 26" fill="#34D399" />
      <path d="M36 70c0-12-8-22-8-22s-2 10 8 22" fill="#10B981" />
      <rect x="33" y="68" width="6" height="14" rx="2" fill="#0F766E" />
      <rect x="18" y="80" width="36" height="6" rx="3" fill="#D1FAE5" />
    </svg>
  );
}

function EmptyFolderArt() {
  return (
    <svg viewBox="0 0 88 72" className="mx-auto h-16 w-20" aria-hidden>
      <path
        d="M8 22c0-4 3-7 7-7h16l6 7h36c4 0 7 3 7 7v30c0 4-3 7-7 7H15c-4 0-7-3-7-7V22Z"
        fill="#EEF0FF"
      />
      <path
        d="M8 32h72v27c0 4-3 7-7 7H15c-4 0-7-3-7-7V32Z"
        fill="#5B5CE2"
        opacity="0.18"
      />
      <rect x="28" y="40" width="32" height="4" rx="2" fill="#5B5CE2" opacity="0.45" />
    </svg>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  iconClass,
  active,
  onClick,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  iconClass: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={hint}
      onClick={onClick}
      className={cn(
        "flex h-[4.35rem] w-full min-w-0 items-center gap-3 rounded-2xl border border-white bg-white px-3.5 text-left shadow-[0_10px_28px_rgba(15,23,42,0.06)] outline-none transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(91,92,226,0.12)] focus-visible:ring-2 focus-visible:ring-[#5B5CE2]/30",
        active && "ring-2 ring-[#5B5CE2]/30",
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl",
          iconClass,
        )}
      >
        <Icon className="size-[18px]" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1 leading-none">
        <span className="block truncate text-[10px] font-bold uppercase tracking-[0.06em] text-[#94a3b8]">
          {label}
        </span>
        <span className="mt-1.5 block text-[1.35rem] font-bold tabular-nums tracking-tight text-[#0f172a]">
          {value}
        </span>
      </span>
      <span className="hidden shrink-0 text-[11px] font-medium text-[#94a3b8] xl:block">
        {hint}
      </span>
    </button>
  );
}

export default function StudentProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [chapterStats, setChapterStats] = useState<
    Record<string, { approved: number; total: number }>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const list = (await apiFetch("/api/v1/projects")) as Project[];
        if (cancelled) return;
        setProjects(list);

        const statsEntries = await Promise.all(
          list.map(async (project) => {
            try {
              const chapters = (await apiFetch(
                `/api/v1/projects/${project._id}/chapters`,
              ).catch(() => [])) as Chapter[];
              const approved = chapters.filter(
                (c) => c.status === "approved" || c.status === "locked",
              ).length;
              return [
                project._id,
                { approved, total: Math.max(chapters.length, 0) },
              ] as const;
            } catch {
              return [project._id, { approved: 0, total: 0 }] as const;
            }
          }),
        );
        if (cancelled) return;
        setChapterStats(Object.fromEntries(statsEntries));
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load projects",
          );
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

  useEffect(() => {
    function onDocClick() {
      setMenuOpenId(null);
    }
    if (menuOpenId) document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [menuOpenId]);

  /** Research projects only — coursework lives under Assignments. */
  const researchProjects = useMemo(
    () => projects.filter((p) => p.projectType !== "assignment"),
    [projects],
  );

  const summary = useMemo(() => {
    let active = 0;
    let drafts = 0;
    let revision = 0;
    let completed = 0;
    for (const project of researchProjects) {
      const bucket = projectBucket(project);
      if (bucket === "completed") completed += 1;
      else if (bucket === "revision") revision += 1;
      else if (bucket === "draft") drafts += 1;
      else if (bucket === "active") active += 1;
    }
    return {
      total: researchProjects.length,
      active,
      drafts,
      revision,
      completed,
    };
  }, [researchProjects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return researchProjects.filter((p) => {
      if (typeFilter !== "all" && p.projectType !== typeFilter) return false;
      const bucket = projectBucket(p);
      if (statusFilter === "active" && bucket !== "active" && bucket !== "revision") {
        return false;
      }
      if (statusFilter === "draft" && bucket !== "draft") return false;
      if (statusFilter === "revision" && bucket !== "revision") return false;
      if (statusFilter === "completed" && bucket !== "completed") return false;
      if (!q) return true;
      const hay = [
        p.title,
        p.topic,
        projectTypeLabel(p.projectType),
        p.supervisor?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [researchProjects, typeFilter, statusFilter, query]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/projects/${pendingDelete._id}`, {
        method: "DELETE",
      });
      setProjects((prev) => prev.filter((p) => p._id !== pendingDelete._id));
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete project");
    } finally {
      setDeleting(false);
    }
  }

  function chapterCopy(project: Project) {
    const stats = chapterStats[project._id];
    const pct = project.progressPercent ?? 0;
    const approved = stats?.approved ?? 0;
    const total =
      stats?.total && stats.total > 0
        ? stats.total
        : pct > 0
          ? Math.max(Math.round(100 / Math.max(pct, 1)), approved)
          : 0;
    return total > 0
      ? `${approved} of ${total} chapters approved`
      : "No chapters yet";
  }

  if (loading) return <LoadingPage label="Loading projects…" />;

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] font-bold tracking-tight text-[#0f172a] md:text-[2rem]">
            My projects
          </h1>
          <p className="mt-1.5 max-w-xl text-[15px] leading-relaxed text-[#64748b]">
            Dissertations, theses, and research folders. Coursework lives under{" "}
            <Link
              href="/student/assignments"
              className="font-semibold text-[#5B5CE2] hover:underline"
            >
              Assignments
            </Link>
            .
          </p>
        </div>
        <ProjectsHeroArt />
      </div>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}
      >
        <KpiCard
          label="Total"
          value={summary.total}
          hint="All time"
          icon={FolderKanban}
          iconClass="bg-[#EEF0FF] text-[#5B5CE2]"
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
        />
        <KpiCard
          label="Active"
          value={summary.active}
          hint="In progress"
          icon={FileText}
          iconClass="bg-[#E6FBF6] text-[#0D9488]"
          active={statusFilter === "active"}
          onClick={() => setStatusFilter("active")}
        />
        <KpiCard
          label="Drafts"
          value={summary.drafts}
          hint="Not submitted"
          icon={Pencil}
          iconClass="bg-[#F3E8FF] text-[#7C3AED]"
          active={statusFilter === "draft"}
          onClick={() => setStatusFilter("draft")}
        />
        <KpiCard
          label="Revision"
          value={summary.revision}
          hint="Needs work"
          icon={AlertCircle}
          iconClass="bg-[#FFF1E8] text-[#EA580C]"
          active={statusFilter === "revision"}
          onClick={() => setStatusFilter("revision")}
        />
        <KpiCard
          label="Done"
          value={summary.completed}
          hint="Completed"
          icon={CheckCircle2}
          iconClass="bg-[#E8FBF3] text-[#059669]"
          active={statusFilter === "completed"}
          onClick={() => setStatusFilter("completed")}
        />
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#0f172a]">
              Project list
            </h2>
            <p className="mt-0.5 text-sm text-[#94a3b8]">
              Open a project to continue writing chapters and track approval.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["all", "All"],
                ["active", "Active"],
                ["draft", "Drafts"],
                ["revision", "Revision"],
                ["completed", "Done"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={cn(
                  "h-9 rounded-full px-3.5 text-xs font-semibold transition",
                  statusFilter === value
                    ? "bg-[#5B5CE2] text-white shadow-[0_6px_16px_rgba(91,92,226,0.28)]"
                    : "border border-[#e8ecf3] bg-white text-[#64748b] hover:border-[#c7cbff] hover:text-[#5B5CE2]",
                )}
              >
                {label}
              </button>
            ))}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by type"
              className="h-9 rounded-full border border-[#e8ecf3] bg-white px-3 text-xs font-semibold text-[#64748b] shadow-sm outline-none focus:border-[#5B5CE2]/40 focus:ring-2 focus:ring-[#5B5CE2]/10"
            >
              <option value="all">All types</option>
              {PROJECT_TYPES.filter((t) => t.value !== "assignment").map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <div className="relative min-w-[200px] flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#94a3b8]" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects…"
                aria-label="Search projects"
                className="h-9 w-full rounded-full border border-[#e8ecf3] bg-white py-2 pl-9 pr-3 text-xs shadow-sm outline-none placeholder:text-[#94a3b8] focus:border-[#5B5CE2]/40 focus:ring-2 focus:ring-[#5B5CE2]/10"
              />
            </div>
            <div className="inline-flex h-9 items-center gap-0.5 rounded-full border border-[#e8ecf3] bg-white p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "grid size-8 place-items-center rounded-full transition",
                  viewMode === "list"
                    ? "bg-[#5B5CE2] text-white"
                    : "text-[#94a3b8] hover:text-[#5B5CE2]",
                )}
                aria-label="List view"
                aria-pressed={viewMode === "list"}
              >
                <List className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "grid size-8 place-items-center rounded-full transition",
                  viewMode === "grid"
                    ? "bg-[#5B5CE2] text-white"
                    : "text-[#94a3b8] hover:text-[#5B5CE2]",
                )}
                aria-label="Grid view"
                aria-pressed={viewMode === "grid"}
              >
                <LayoutGrid className="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        {researchProjects.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-[#d8dce8] bg-white px-6 py-14 text-center shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <EmptyFolderArt />
            <h3 className="mt-4 text-base font-bold text-[#0f172a]">
              {projects.some((p) => p.projectType === "assignment")
                ? "No research projects yet"
                : "No projects yet"}
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-[#94a3b8]">
              {projects.some((p) => p.projectType === "assignment") ? (
                <>
                  Your coursework is listed under{" "}
                  <Link
                    href="/student/assignments"
                    className="font-semibold text-[#5B5CE2] hover:underline"
                  >
                    Assignments
                  </Link>
                  . Use Projects for dissertations, theses, and other research
                  work.
                </>
              ) : (
                <>
                  Create your first research project, choose a supervisor, then
                  start writing chapters.
                </>
              )}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {projects.some((p) => p.projectType === "assignment") ? (
                <Button asChild variant="outline" className="rounded-full">
                  <Link href="/student/assignments">View assignments</Link>
                </Button>
              ) : null}
              <Button
                asChild
                className="rounded-full border-0 bg-[#5B5CE2] shadow-[0_8px_18px_rgba(91,92,226,0.3)] hover:bg-[#4F48D0]"
              >
                <Link href="/student/projects/new">
                  <Plus className="size-4" />
                  New project
                </Link>
              </Button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-[#d8dce8] bg-white px-6 py-10 text-center shadow-sm">
            <p className="font-semibold text-[#0f172a]">No matching projects</p>
            <p className="mt-1 text-sm text-[#94a3b8]">
              Try another search term or clear the filters.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 rounded-xl"
              onClick={() => {
                setQuery("");
                setTypeFilter("all");
                setStatusFilter("all");
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : viewMode === "list" ? (
          <div className="overflow-hidden rounded-2xl border border-[#e8ecf3] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
            <div className="hidden border-b border-[#eef1f6] bg-[#f8fafc] px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-[#94a3b8] lg:grid lg:grid-cols-[minmax(0,1.7fr)_130px_minmax(0,1fr)_180px_120px] lg:gap-4">
              <span>Project</span>
              <span>Type</span>
              <span>Supervisor</span>
              <span>Progress</span>
              <span className="text-right">Action</span>
            </div>
            <ul className="divide-y divide-[#eef1f6]">
              {filtered.map((project) => {
                const meta = TYPE_META[project.projectType] || {
                  icon: FileText,
                  iconClass: "bg-[#eff6ff] text-[#2563eb]",
                  accent: "from-[#2563eb] to-[#1d4ed8]",
                };
                const Icon = meta.icon;
                const badge = statusMeta(project);
                const pct = project.progressPercent ?? 0;
                const needsRevision = project.status === "needs_revision";

                return (
                  <li
                    key={project._id}
                    className={cn(
                      "px-4 py-4 transition hover:bg-[#f8fafc] sm:px-5",
                      needsRevision && "bg-amber-50/40",
                    )}
                  >
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_130px_minmax(0,1fr)_180px_120px] lg:items-center lg:gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className={cn(
                            "mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl",
                            meta.iconClass,
                          )}
                        >
                          <Icon className="size-5" strokeWidth={1.75} />
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/student/projects/${project._id}`}
                            className="block truncate font-bold text-[#0f172a] hover:text-[#2563eb]"
                          >
                            {project.title}
                          </Link>
                          <p className="mt-0.5 truncate text-sm text-[#64748b]">
                            {project.topic || "No topic set yet"}
                            {" · "}
                            Started {formatStartDate(project.createdAt)}
                          </p>
                          <span
                            className={cn(
                              "mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                              STATUS_STYLES[badge.tone],
                            )}
                          >
                            {badge.label}
                          </span>
                        </div>
                      </div>

                      <div className="text-sm">
                        <p className="font-medium text-[#94a3b8] lg:hidden">
                          Type
                        </p>
                        <p className="font-semibold text-[#0f172a]">
                          {projectTypeLabel(project.projectType)}
                        </p>
                      </div>

                      <div className="text-sm">
                        <p className="font-medium text-[#94a3b8] lg:hidden">
                          Supervisor
                        </p>
                        <p className="inline-flex items-center gap-1.5 font-semibold text-[#0f172a]">
                          <UserRound className="size-3.5 text-[#94a3b8]" />
                          <span className="truncate">
                            {project.supervisor?.name ||
                              `No ${projectAdvisorNoun(project.projectType)}`}
                          </span>
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-[#94a3b8] lg:hidden">
                          Progress
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef1f6]">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                progressTone(pct, project),
                              )}
                              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                            />
                          </div>
                          <span
                            className={cn(
                              "w-9 text-right text-sm font-bold tabular-nums",
                              pct >= 100
                                ? "text-emerald-700"
                                : needsRevision
                                  ? "text-amber-800"
                                  : "text-[#0f172a]",
                            )}
                          >
                            {pct}%
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-[#94a3b8]">
                          {chapterStats[project._id] ? (
                            chapterCopy(project)
                          ) : (
                            <Skeleton className="h-3 w-28" />
                          )}
                        </p>
                      </div>

                      <div className="flex items-center justify-end gap-1">
                        <Button asChild className="h-9">
                          <Link href={`/student/projects/${project._id}`}>
                            Open
                          </Link>
                        </Button>
                        <div className="relative">
                          <button
                            type="button"
                            className="grid size-9 place-items-center rounded-full text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#0D0B61]"
                            aria-label={`Options for ${project.title}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId((id) =>
                                id === project._id ? null : project._id,
                              );
                            }}
                          >
                            <MoreVertical className="size-4" />
                          </button>
                          {menuOpenId === project._id ? (
                            <div className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-xl border border-[#e8ecf3] bg-white py-1 shadow-lg">
                              <Link
                                href={`/student/projects/${project._id}`}
                                className="flex items-center gap-2 px-3 py-2 text-sm text-[#0D0B61] hover:bg-[#f8fafc]"
                                onClick={() => setMenuOpenId(null)}
                              >
                                <FolderOpen className="size-3.5" />
                                Open editor
                              </Link>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                onClick={() => {
                                  setMenuOpenId(null);
                                  setPendingDelete(project);
                                }}
                              >
                                <Trash2 className="size-3.5" />
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((project) => {
              const meta = TYPE_META[project.projectType] || {
                icon: FileText,
                iconClass: "bg-[#eff6ff] text-[#2563eb]",
                accent: "from-[#2563eb] to-[#1d4ed8]",
              };
              const Icon = meta.icon;
              const badge = statusMeta(project);
              const pct = project.progressPercent ?? 0;
              const needsRevision = project.status === "needs_revision";

              return (
                <article
                  key={project._id}
                  className={cn(
                    "overflow-hidden rounded-2xl border border-[#e8ecf3] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-md",
                    needsRevision && "border-amber-200",
                  )}
                >
                  <div className={cn("h-1.5 bg-gradient-to-r", meta.accent)} />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          "grid size-11 place-items-center rounded-xl",
                          meta.iconClass,
                        )}
                      >
                        <Icon className="size-5" strokeWidth={1.75} />
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                          STATUS_STYLES[badge.tone],
                        )}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <Link
                      href={`/student/projects/${project._id}`}
                      className="mt-3 block font-bold text-[#0f172a] hover:text-[#2563eb]"
                    >
                      {project.title}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-sm text-[#64748b]">
                      {project.topic || "No topic set yet"}
                    </p>
                    <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0f172a]">
                      <UserRound className="size-3.5 text-[#94a3b8]" />
                      {project.supervisor?.name ||
                        `No ${projectAdvisorNoun(project.projectType)}`}
                    </p>
                    <div className="mt-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef1f6]">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              progressTone(pct, project),
                            )}
                            style={{
                              width: `${Math.min(100, Math.max(0, pct))}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-bold tabular-nums text-[#0f172a]">
                          {pct}%
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#94a3b8]">
                        {chapterCopy(project)}
                      </p>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button asChild size="sm" className="min-w-0 flex-1">
                        <Link href={`/student/projects/${project._id}`}>
                          Open
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        aria-label={`Delete ${project.title}`}
                        onClick={() => setPendingDelete(project)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Delete project?"
        description={
          pendingDelete
            ? `“${pendingDelete.title}” and all its chapters will be removed. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete project"
        loading={deleting}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
