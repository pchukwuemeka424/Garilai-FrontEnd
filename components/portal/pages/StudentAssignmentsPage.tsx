"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock3,
  LayoutGrid,
  List,
  Plus,
  Search,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/portal/ui/button";
import { LoadingPage } from "@/components/portal/feedback/loading-page";
import { apiFetch } from "@/lib/portal-api";
import type { AssignmentBriefView } from "@/components/portal/features/assignment/assignment-brief-panel";
import { cn } from "@/lib/portal/cn";

type ProjectPage = {
  _id: string;
  content?: string;
  order?: number;
  reviewStatus?: "none" | "approved" | "needs_revision" | string;
};

type AssignmentRow = {
  _id: string;
  title: string;
  projectType: string;
  score?: number | null;
  updatedAt?: string;
  createdAt?: string;
  supervisor?: { id: string; name: string; email: string } | null;
  assignmentBrief?: AssignmentBriefView | null;
  pages?: ProjectPage[];
};

type StatusMeta = {
  label: string;
  tone: "graded" | "approved" | "revision" | "submitted" | "progress" | "idle";
};

type StatusFilter = "all" | "dueSoon" | "active" | "revision" | "graded";
type ViewMode = "list" | "grid";

function primaryPage(pages: ProjectPage[] | undefined) {
  if (!Array.isArray(pages) || pages.length === 0) return null;
  return [...pages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0] ?? null;
}

function assignmentStatus(row: AssignmentRow): StatusMeta {
  if (typeof row.score === "number") {
    return { label: "Graded", tone: "graded" };
  }
  const page = primaryPage(row.pages);
  if (page?.reviewStatus === "approved") {
    return { label: "Approved", tone: "approved" };
  }
  if (page?.reviewStatus === "needs_revision") {
    return { label: "Needs revision", tone: "revision" };
  }
  if (page?.reviewStatus && page.reviewStatus !== "none") {
    return { label: "Submitted", tone: "submitted" };
  }
  if (String(page?.content || "").trim()) {
    return { label: "In progress", tone: "progress" };
  }
  return { label: "Not started", tone: "idle" };
}

function dueLabel(dueAt?: string | null) {
  if (!dueAt) return null;
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function dueTimestamp(dueAt?: string | null) {
  if (!dueAt) return Number.POSITIVE_INFINITY;
  const t = new Date(dueAt).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

function isOverdue(dueAt?: string | null, status?: StatusMeta) {
  if (!dueAt) return false;
  if (status?.label === "Graded" || status?.label === "Approved") return false;
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return false;
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end.getTime() < Date.now();
}

function isDueSoon(dueAt?: string | null, status?: StatusMeta) {
  if (!dueAt) return false;
  if (status?.label === "Graded" || status?.label === "Approved") return false;
  const t = new Date(dueAt).getTime();
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  return t >= now && t - now <= week;
}

function statusProgress(status: StatusMeta, row: AssignmentRow, maxScore: number) {
  if (status.tone === "graded") {
    const score = typeof row.score === "number" ? row.score : 0;
    return Math.min(100, Math.round((score / Math.max(maxScore, 1)) * 100));
  }
  if (status.tone === "approved") return 100;
  if (status.tone === "submitted") return 75;
  if (status.tone === "revision") return 55;
  if (status.tone === "progress") return 35;
  return 8;
}

const STATUS_STYLES: Record<StatusMeta["tone"], string> = {
  graded: "bg-emerald-50 text-emerald-700",
  approved: "bg-emerald-50 text-emerald-700",
  revision: "bg-[#FFF1E8] text-[#C2410C]",
  submitted: "bg-[#EEF0FF] text-[#5B5CE2]",
  progress: "bg-[#E6F4FF] text-[#2563eb]",
  idle: "bg-slate-100 text-slate-600",
};

const STATUS_ACCENT: Record<StatusMeta["tone"], string> = {
  graded: "from-[#059669] to-[#047857]",
  approved: "from-[#059669] to-[#047857]",
  revision: "from-[#EA580C] to-[#C2410C]",
  submitted: "from-[#5B5CE2] to-[#4F48D0]",
  progress: "from-[#2563eb] to-[#1d4ed8]",
  idle: "from-[#94a3b8] to-[#64748b]",
};

function progressTone(status: StatusMeta, overdue: boolean) {
  if (overdue) return "bg-amber-500";
  if (status.tone === "graded" || status.tone === "approved") return "bg-emerald-500";
  if (status.tone === "revision") return "bg-[#EA580C]";
  if (status.tone === "submitted") return "bg-[#5B5CE2]";
  if (status.tone === "progress") return "bg-[#2563eb]";
  return "bg-slate-300";
}

function EmptyClipboardArt() {
  return (
    <svg viewBox="0 0 88 72" className="mx-auto h-16 w-20" aria-hidden>
      <rect x="22" y="14" width="44" height="50" rx="8" fill="#EEF0FF" />
      <rect x="32" y="8" width="24" height="12" rx="4" fill="#5B5CE2" opacity="0.35" />
      <rect x="32" y="32" width="24" height="4" rx="2" fill="#5B5CE2" opacity="0.45" />
      <rect x="32" y="42" width="18" height="4" rx="2" fill="#5B5CE2" opacity="0.28" />
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
          "grid size-9 shrink-0 place-items-center rounded-xl",
          iconClass,
        )}
      >
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1 leading-none">
        <span className="block text-[10px] font-bold uppercase tracking-[0.05em] text-[#94a3b8]">
          {label}
        </span>
        <span className="mt-1.5 block text-[1.25rem] font-bold tabular-nums tracking-tight text-[#0f172a]">
          {value}
        </span>
      </span>
    </button>
  );
}

export default function StudentAssignmentsPage() {
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const list = (await apiFetch("/api/v1/projects")) as AssignmentRow[];
        if (cancelled) return;
        setRows(
          (Array.isArray(list) ? list : []).filter(
            (p) => p.projectType === "assignment",
          ),
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load assignments",
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

  const summary = useMemo(() => {
    let dueSoon = 0;
    let graded = 0;
    let inProgress = 0;
    let needsRevision = 0;
    for (const row of rows) {
      const status = assignmentStatus(row);
      if (status.label === "Graded") graded += 1;
      if (status.label === "In progress" || status.label === "Submitted") {
        inProgress += 1;
      }
      if (status.label === "Needs revision") needsRevision += 1;
      if (isDueSoon(row.assignmentBrief?.dueAt, status)) dueSoon += 1;
    }
    return {
      total: rows.length,
      dueSoon,
      graded,
      inProgress,
      needsRevision,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((row) => {
        const status = assignmentStatus(row);
        if (statusFilter === "graded" && status.label !== "Graded") return false;
        if (statusFilter === "revision" && status.label !== "Needs revision") {
          return false;
        }
        if (statusFilter === "dueSoon" && !isDueSoon(row.assignmentBrief?.dueAt, status)) {
          return false;
        }
        if (
          statusFilter === "active" &&
          status.label !== "In progress" &&
          status.label !== "Submitted"
        ) {
          return false;
        }
        if (!q) return true;
        const brief = row.assignmentBrief;
        const hay = [
          brief?.title,
          row.title,
          brief?.courseName,
          brief?.courseYear,
          row.supervisor?.name,
          status.label,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        const statusA = assignmentStatus(a);
        const statusB = assignmentStatus(b);
        const overdueA = isOverdue(a.assignmentBrief?.dueAt, statusA) ? 0 : 1;
        const overdueB = isOverdue(b.assignmentBrief?.dueAt, statusB) ? 0 : 1;
        if (overdueA !== overdueB) return overdueA - overdueB;
        return dueTimestamp(a.assignmentBrief?.dueAt) - dueTimestamp(b.assignmentBrief?.dueAt);
      });
  }, [rows, query, statusFilter]);

  if (loading) return <LoadingPage label="Loading assignments…" />;

  return (
    <div className="space-y-7">
      <p className="max-w-2xl text-[15px] leading-relaxed text-[#64748b]">
        Coursework from your lecturers — open a brief, write the submission, and
        track feedback and marks.
      </p>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}
      >
        <KpiCard
          label="Total"
          value={summary.total}
          hint="All briefs"
          icon={ClipboardList}
          iconClass="bg-[#EEF0FF] text-[#5B5CE2]"
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
        />
        <KpiCard
          label="Due"
          value={summary.dueSoon}
          hint="Next 7 days"
          icon={Calendar}
          iconClass="bg-[#FFF1E8] text-[#EA580C]"
          active={statusFilter === "dueSoon"}
          onClick={() => setStatusFilter("dueSoon")}
        />
        <KpiCard
          label="Active"
          value={summary.inProgress}
          hint="Drafting"
          icon={Clock3}
          iconClass="bg-[#E6F4FF] text-[#2563eb]"
          active={statusFilter === "active"}
          onClick={() => setStatusFilter("active")}
        />
        <KpiCard
          label="Revision"
          value={summary.needsRevision}
          hint="Returned"
          icon={AlertCircle}
          iconClass="bg-[#FEE2E2] text-[#DC2626]"
          active={statusFilter === "revision"}
          onClick={() => setStatusFilter("revision")}
        />
        <KpiCard
          label="Graded"
          value={summary.graded}
          hint="Complete"
          icon={CheckCircle2}
          iconClass="bg-[#E8FBF3] text-[#059669]"
          active={statusFilter === "graded"}
          onClick={() => setStatusFilter("graded")}
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
              Assignment list
            </h2>
            <p className="mt-0.5 text-sm text-[#94a3b8]">
              Sorted by deadline. Open an item for the brief, draft, and feedback.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["all", "All"],
                ["dueSoon", "Due soon"],
                ["active", "Active"],
                ["revision", "Revision"],
                ["graded", "Graded"],
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
            <div className="relative min-w-[200px] flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#94a3b8]" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search assignments…"
                aria-label="Search assignments"
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

        {rows.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-[#d8dce8] bg-white px-6 py-14 text-center shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <EmptyClipboardArt />
            <h3 className="mt-4 text-base font-bold text-[#0f172a]">
              No assignments yet
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-[#94a3b8]">
              Start an assignment and select a published brief from your lecturer.
            </p>
            <Button
              asChild
              className="mt-5 rounded-full border-0 bg-[#5B5CE2] shadow-[0_8px_18px_rgba(91,92,226,0.3)] hover:bg-[#4F48D0]"
            >
              <Link href="/student/projects/new?from=assignments">
                <Plus className="size-4" />
                Start assignment
              </Link>
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-[#d8dce8] bg-white px-6 py-10 text-center shadow-sm">
            <p className="font-semibold text-[#0f172a]">No matching assignments</p>
            <p className="mt-1 text-sm text-[#94a3b8]">
              Try another search term or clear the status filter.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 rounded-full"
              onClick={() => {
                setQuery("");
                setStatusFilter("all");
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : viewMode === "list" ? (
          <div className="overflow-hidden rounded-2xl border border-[#e8ecf3] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
            <div className="hidden border-b border-[#eef1f6] bg-[#f8fafc] px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-[#94a3b8] lg:grid lg:grid-cols-[minmax(0,1.8fr)_150px_minmax(0,1fr)_160px_110px] lg:gap-4">
              <span>Assignment</span>
              <span>Due</span>
              <span>Lecturer</span>
              <span>Progress</span>
              <span className="text-right">Action</span>
            </div>
            <ul className="divide-y divide-[#eef1f6]">
              {filtered.map((row) => {
                const brief = row.assignmentBrief;
                const status = assignmentStatus(row);
                const due = dueLabel(brief?.dueAt);
                const overdue = isOverdue(brief?.dueAt, status);
                const soon = isDueSoon(brief?.dueAt, status);
                const maxScore =
                  typeof brief?.maxScore === "number" ? brief.maxScore : 100;
                const pct = statusProgress(status, row, maxScore);
                const courseLine = [brief?.courseName, brief?.courseYear]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <li
                    key={row._id}
                    className={cn(
                      "px-4 py-4 transition hover:bg-[#f8fafc] sm:px-5",
                      overdue && "bg-amber-50/50",
                    )}
                  >
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_150px_minmax(0,1fr)_160px_110px] lg:items-center lg:gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl bg-[#EEF0FF] text-[#5B5CE2]">
                          <ClipboardList className="size-5" strokeWidth={1.75} />
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/student/assignments/${row._id}`}
                            className="block truncate font-bold text-[#0f172a] hover:text-[#5B5CE2]"
                          >
                            {brief?.title || row.title}
                          </Link>
                          <p className="mt-0.5 truncate text-sm text-[#64748b]">
                            {courseLine || "Coursework assignment"}
                            {" · "}
                            {maxScore} marks
                          </p>
                          <span
                            className={cn(
                              "mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                              STATUS_STYLES[status.tone],
                            )}
                          >
                            {status.label}
                          </span>
                        </div>
                      </div>

                      <div className="text-sm">
                        <p className="font-medium text-[#94a3b8] lg:hidden">Due</p>
                        <p
                          className={cn(
                            "inline-flex items-center gap-1.5 font-semibold",
                            overdue
                              ? "text-amber-800"
                              : soon
                                ? "text-[#EA580C]"
                                : "text-[#0f172a]",
                          )}
                        >
                          <Calendar className="size-3.5 text-[#94a3b8]" />
                          {due
                            ? overdue
                              ? `Overdue · ${due}`
                              : soon
                                ? `Soon · ${due}`
                                : due
                            : "No due date"}
                        </p>
                      </div>

                      <div className="text-sm">
                        <p className="font-medium text-[#94a3b8] lg:hidden">
                          Lecturer
                        </p>
                        <p className="inline-flex items-center gap-1.5 font-semibold text-[#0f172a]">
                          <UserRound className="size-3.5 text-[#94a3b8]" />
                          <span className="truncate">
                            {row.supervisor?.name || "No lecturer"}
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
                                progressTone(status, overdue),
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          {typeof row.score === "number" ? (
                            <span className="shrink-0 text-sm font-bold tabular-nums text-emerald-700">
                              {row.score}
                              <span className="font-semibold text-[#94a3b8]">
                                /{maxScore}
                              </span>
                            </span>
                          ) : (
                            <span className="w-9 text-right text-sm font-bold tabular-nums text-[#0f172a]">
                              {pct}%
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button asChild className="h-9 w-full lg:w-auto">
                          <Link href={`/student/assignments/${row._id}`}>Open</Link>
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((row) => {
              const brief = row.assignmentBrief;
              const status = assignmentStatus(row);
              const due = dueLabel(brief?.dueAt);
              const overdue = isOverdue(brief?.dueAt, status);
              const soon = isDueSoon(brief?.dueAt, status);
              const maxScore =
                typeof brief?.maxScore === "number" ? brief.maxScore : 100;
              const pct = statusProgress(status, row, maxScore);
              const courseLine = [brief?.courseName, brief?.courseYear]
                .filter(Boolean)
                .join(" · ");

              return (
                <article
                  key={row._id}
                  className={cn(
                    "overflow-hidden rounded-2xl border border-[#e8ecf3] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-md",
                    overdue && "border-amber-200",
                  )}
                >
                  <div className={cn("h-1.5 bg-gradient-to-r", STATUS_ACCENT[status.tone])} />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="grid size-11 place-items-center rounded-xl bg-[#EEF0FF] text-[#5B5CE2]">
                        <ClipboardList className="size-5" strokeWidth={1.75} />
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                          STATUS_STYLES[status.tone],
                        )}
                      >
                        {status.label}
                      </span>
                    </div>
                    <Link
                      href={`/student/assignments/${row._id}`}
                      className="mt-3 block font-bold text-[#0f172a] hover:text-[#5B5CE2]"
                    >
                      {brief?.title || row.title}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-sm text-[#64748b]">
                      {courseLine || "Coursework assignment"} · {maxScore} marks
                    </p>
                    <p
                      className={cn(
                        "mt-3 inline-flex items-center gap-1.5 text-xs font-semibold",
                        overdue
                          ? "text-amber-800"
                          : soon
                            ? "text-[#EA580C]"
                            : "text-[#0f172a]",
                      )}
                    >
                      <Calendar className="size-3.5 text-[#94a3b8]" />
                      {due
                        ? overdue
                          ? `Overdue · ${due}`
                          : soon
                            ? `Due soon · ${due}`
                            : due
                        : "No due date"}
                    </p>
                    <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0f172a]">
                      <UserRound className="size-3.5 text-[#94a3b8]" />
                      {row.supervisor?.name || "No lecturer"}
                    </p>
                    <div className="mt-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef1f6]">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              progressTone(status, overdue),
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {typeof row.score === "number" ? (
                          <span className="text-sm font-bold tabular-nums text-emerald-700">
                            {row.score}/{maxScore}
                          </span>
                        ) : (
                          <span className="text-sm font-bold tabular-nums text-[#0f172a]">
                            {pct}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-4">
                      <Button asChild size="sm" className="w-full">
                        <Link href={`/student/assignments/${row._id}`}>
                          Open assignment
                        </Link>
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
