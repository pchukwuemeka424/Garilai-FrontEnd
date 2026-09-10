"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  LayoutGrid,
  Layers,
  List,
  Plus,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/portal/ui/button";
import { apiFetch } from "@/lib/portal-api";
import { cn } from "@/lib/portal/cn";

type BriefRow = {
  _id: string;
  title: string;
  status: "draft" | "published";
  maxScore?: number;
  courseName?: string;
  courseYear?: string;
  dueAt?: string | null;
  updatedAt?: string;
  requiredItems?: string[];
  rubric?: unknown[];
  submissionCount?: number;
};

type FilterKey = "all" | "published" | "draft" | "upcoming" | "overdue";
type ViewMode = "list" | "grid";

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

function dueTone(days: number | null) {
  if (days == null) return "muted" as const;
  if (days < 0) return "risk" as const;
  if (days <= 3) return "soon" as const;
  if (days <= 7) return "soon" as const;
  return "ok" as const;
}

function dueLabel(days: number | null) {
  if (days == null) return "No due date";
  if (days < 0) return `Overdue ${Math.abs(days)}d`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due in 1 day";
  return `Due in ${days} days`;
}

function formatDueDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

const DUE_TEXT: Record<ReturnType<typeof dueTone>, string> = {
  muted: "text-[#64748b]",
  risk: "text-[#be123c]",
  soon: "text-[#c2410c]",
  ok: "text-[#0f172a]",
};

const DUE_CHIP: Record<ReturnType<typeof dueTone>, string> = {
  muted: "bg-[#475569] text-white",
  risk: "bg-[#e11d48] text-white",
  soon: "bg-[#ea580c] text-white",
  ok: "bg-[#059669] text-white",
};

const TAB_STYLES: Record<
  FilterKey,
  {
    icon: LucideIcon;
    idle: string;
    active: string;
    countIdle: string;
    countActive: string;
  }
> = {
  all: {
    icon: Layers,
    idle: "bg-[#0D0B61] text-white opacity-80 hover:opacity-100",
    active: "bg-[#0D0B61] text-white",
    countIdle: "bg-white/20 text-white",
    countActive: "bg-white text-[#0D0B61]",
  },
  published: {
    icon: CheckCircle2,
    idle: "bg-[#059669] text-white opacity-80 hover:opacity-100",
    active: "bg-[#059669] text-white",
    countIdle: "bg-white/20 text-white",
    countActive: "bg-white text-[#047857]",
  },
  draft: {
    icon: FileText,
    idle: "bg-[#475569] text-white opacity-80 hover:opacity-100",
    active: "bg-[#475569] text-white",
    countIdle: "bg-white/20 text-white",
    countActive: "bg-white text-[#334155]",
  },
  upcoming: {
    icon: CalendarDays,
    idle: "bg-[#ea580c] text-white opacity-80 hover:opacity-100",
    active: "bg-[#ea580c] text-white",
    countIdle: "bg-white/20 text-white",
    countActive: "bg-white text-[#c2410c]",
  },
  overdue: {
    icon: AlertTriangle,
    idle: "bg-[#e11d48] text-white opacity-80 hover:opacity-100",
    active: "bg-[#e11d48] text-white",
    countIdle: "bg-white/20 text-white",
    countActive: "bg-white text-[#be123c]",
  },
};

function CreateAssignmentButton({
  size = "default",
  className,
}: {
  size?: "default" | "sm";
  className?: string;
}) {
  return (
    <Button asChild size={size} variant="success" className={className}>
      <Link href="/assignments/new">
        <Plus className="size-4" strokeWidth={2.25} />
        Create Assignment
      </Link>
    </Button>
  );
}

function AssignmentsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading assignments">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-[#e8ecf3]" />
          <div className="h-8 w-48 rounded-lg bg-[#e8ecf3]" />
          <div className="h-4 w-80 max-w-full rounded bg-[#eef1f6]" />
        </div>
        <div className="h-10 w-44 rounded-full bg-[#e8ecf3]" />
      </div>
      <div className="h-12 rounded-2xl bg-[#f1f5f9]" />
      <div className="space-y-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-28 rounded-2xl border border-[#e8ecf3] bg-white" />
        ))}
      </div>
    </div>
  );
}

export default function SupervisorAssignmentsPage() {
  const [briefs, setBriefs] = useState<BriefRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const list = (await apiFetch(
          "/api/v1/assignment-briefs",
        )) as BriefRow[];
        if (!cancelled) setBriefs(Array.isArray(list) ? list : []);
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
    const published = briefs.filter((b) => b.status === "published").length;
    const draft = briefs.filter((b) => b.status === "draft").length;
    const upcoming = briefs.filter((b) => {
      if (b.status === "draft") return false;
      const days = daysUntil(b.dueAt);
      return days != null && days >= 0;
    }).length;
    const overdue = briefs.filter((b) => {
      if (b.status === "draft") return false;
      const days = daysUntil(b.dueAt);
      return days != null && days < 0;
    }).length;
    return {
      total: briefs.length,
      published,
      draft,
      upcoming,
      overdue,
    };
  }, [briefs]);

  const filtered = useMemo(() => {
    let list = [...briefs];

    if (filter === "published") {
      list = list.filter((b) => b.status === "published");
    } else if (filter === "draft") {
      list = list.filter((b) => b.status === "draft");
    } else if (filter === "upcoming") {
      list = list.filter((b) => {
        if (b.status === "draft") return false;
        const days = daysUntil(b.dueAt);
        return days != null && days >= 0;
      });
    } else if (filter === "overdue") {
      list = list.filter((b) => {
        if (b.status === "draft") return false;
        const days = daysUntil(b.dueAt);
        return days != null && days < 0;
      });
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((b) => {
        const hay = [b.title, b.courseName || "", b.courseYear || "", b.status]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    return list.sort((a, b) => {
      const aDays = daysUntil(a.dueAt);
      const bDays = daysUntil(b.dueAt);
      if (aDays == null && bDays == null) {
        return a.title.localeCompare(b.title);
      }
      if (aDays == null) return 1;
      if (bDays == null) return -1;
      return aDays - bDays;
    });
  }, [briefs, filter, query]);

  const filters: { id: FilterKey; label: string; count: number }[] = [
    { id: "all", label: "All", count: stats.total },
    { id: "published", label: "Published", count: stats.published },
    { id: "draft", label: "Draft", count: stats.draft },
    { id: "upcoming", label: "Upcoming", count: stats.upcoming },
    { id: "overdue", label: "Overdue", count: stats.overdue },
  ];

  if (loading) return <AssignmentsSkeleton />;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0D0B61]">
            Supervision
          </p>
          <h1 className="mt-1 text-[1.75rem] font-bold tracking-tight text-[#0f172a]">
            Assignments
          </h1>
          <p className="mt-1.5 max-w-xl text-[0.9rem] leading-relaxed text-[#64748b]">
            Write briefs, publish them to students, and open each assignment to
            score submissions.
          </p>
        </div>
        <CreateAssignmentButton className="shrink-0 self-start" />
      </header>

      {error ? (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-[#e8ecf3] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-3 border-b border-[#eef1f6] bg-[#f8fafc] px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div
            className="flex flex-wrap gap-1.5"
            role="tablist"
            aria-label="Filter assignments"
          >
            {filters.map((item) => {
              const style = TAB_STYLES[item.id];
              const Icon = style.icon;
              const selected = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setFilter(item.id)}
                  className={cn(
                    "inline-flex h-9 appearance-none items-center gap-1.5 rounded-full border-0 bg-clip-padding px-3.5 text-xs font-semibold shadow-none outline-none transition focus-visible:ring-2 focus-visible:ring-white/70",
                    selected ? style.active : style.idle,
                  )}
                >
                  <Icon className="size-3.5" strokeWidth={2.25} />
                  {item.label}
                  <span
                    className={cn(
                      "min-w-4 rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums",
                      selected ? style.countActive : style.countIdle,
                    )}
                  >
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex h-9 min-w-[12rem] flex-1 items-center gap-2 rounded-full border border-[#e2e8f0] bg-white px-3 text-[#94a3b8] md:max-w-xs">
              <Search className="size-3.5 shrink-0" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title or course"
                aria-label="Search assignments"
                className="w-full border-0 bg-transparent text-xs text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
              />
            </label>
            <div className="inline-flex h-9 items-center gap-0.5 rounded-full bg-[#ececf8] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "grid size-8 place-items-center rounded-full transition",
                  viewMode === "list"
                    ? "bg-[#0D0B61] text-white"
                    : "bg-transparent text-[#64748b] hover:bg-[#0D0B61]/10 hover:text-[#0D0B61]",
                )}
                aria-label="List view"
                aria-pressed={viewMode === "list"}
              >
                <List className="size-3.5" strokeWidth={2.25} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "grid size-8 place-items-center rounded-full transition",
                  viewMode === "grid"
                    ? "bg-[#2563eb] text-white"
                    : "bg-transparent text-[#64748b] hover:bg-[#2563eb]/10 hover:text-[#2563eb]",
                )}
                aria-label="Grid view"
                aria-pressed={viewMode === "grid"}
              >
                <LayoutGrid className="size-3.5" strokeWidth={2.25} />
              </button>
            </div>
          </div>
        </div>

        {stats.total === 0 ? (
          <div className="px-6 py-16 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#ececf8] text-[#0D0B61]">
              <ClipboardList className="size-6" strokeWidth={1.75} />
            </span>
            <h2 className="mt-4 text-base font-bold text-[#0f172a]">
              No assignment briefs yet
            </h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-[#64748b]">
              Create a brief with instructions and grading criteria. Publish it
              so students can select it.
            </p>
            <CreateAssignmentButton className="mt-5" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <h2 className="text-base font-bold text-[#0f172a]">No matches</h2>
            <p className="mt-1 text-sm text-[#64748b]">
              Try another filter or search term.
            </p>
            <Button
              type="button"
              variant="slate"
              className="mt-4"
              onClick={() => {
                setFilter("all");
                setQuery("");
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : viewMode === "list" ? (
          <ul className="divide-y divide-[#eef1f6]">
            {filtered.map((brief) => (
              <AssignmentListRow key={brief._id} brief={brief} />
            ))}
          </ul>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((brief) => (
              <AssignmentGridCard key={brief._id} brief={brief} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AssignmentListRow({ brief }: { brief: BriefRow }) {
  const days = daysUntil(brief.dueAt);
  const tone = dueTone(days);
  const published = brief.status === "published";
  const submissions = brief.submissionCount ?? 0;
  const dueDate = formatDueDate(brief.dueAt);
  const marks = typeof brief.maxScore === "number" ? brief.maxScore : 100;
  const courseLine = [brief.courseName || "No course set", brief.courseYear]
    .filter(Boolean)
    .join(" · ");
  const criteria = Array.isArray(brief.rubric) ? brief.rubric.length : 0;

  return (
    <li className="px-4 py-3.5 transition hover:bg-[#f8fafc] sm:px-5">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.7fr)_minmax(9rem,1fr)_minmax(7.5rem,0.8fr)_auto] md:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl",
              published
                ? "bg-[#ecfdf5] text-[#047857]"
                : "bg-[#ececf8] text-[#0D0B61]",
            )}
          >
            {published ? (
              <ClipboardList className="size-5" strokeWidth={1.75} />
            ) : (
              <FileText className="size-5" strokeWidth={1.75} />
            )}
          </span>
          <div className="min-w-0">
            <Link
              href={`/assignments/${brief._id}`}
              className="block truncate font-bold text-[#0f172a] hover:text-[#0D0B61]"
            >
              {brief.title}
            </Link>
            <p className="mt-0.5 truncate text-sm text-[#64748b]">
              {courseLine} · {marks} marks
              {criteria > 0 ? ` · ${criteria} criteria` : ""}
            </p>
            <span
              className={cn(
                "mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white",
                published ? "bg-[#059669]" : "bg-[#475569]",
              )}
            >
              {published ? "Published" : "Draft"}
            </span>
          </div>
        </div>

        <div className="text-sm">
          <p className={cn("inline-flex items-center gap-1.5 font-semibold", DUE_TEXT[tone])}>
            <CalendarDays className="size-3.5 shrink-0 text-[#94a3b8]" />
            {dueDate || "No due date"}
          </p>
          <p className="mt-0.5 text-xs font-semibold">
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5",
                DUE_CHIP[tone],
              )}
            >
              {dueLabel(days)}
            </span>
          </p>
        </div>

        <div className="text-sm">
          <p className="inline-flex items-center gap-1.5 font-semibold text-[#0f172a]">
            <Users className="size-3.5 shrink-0 text-[#94a3b8]" />
            {submissions} {submissions === 1 ? "submission" : "submissions"}
          </p>
        </div>

        <div className="flex justify-end">
          <Button asChild size="sm" variant="info" className="w-full md:w-auto">
            <Link href={`/assignments/${brief._id}`}>
              Open
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </li>
  );
}

function AssignmentGridCard({ brief }: { brief: BriefRow }) {
  const days = daysUntil(brief.dueAt);
  const tone = dueTone(days);
  const published = brief.status === "published";
  const submissions = brief.submissionCount ?? 0;
  const dueDate = formatDueDate(brief.dueAt);
  const marks = typeof brief.maxScore === "number" ? brief.maxScore : 100;
  const courseLine = [brief.courseName || "No course set", brief.courseYear]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="flex flex-col rounded-2xl border border-[#e8ecf3] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-[#c7cbd9] hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "grid size-11 place-items-center rounded-xl",
            published
              ? "bg-[#ecfdf5] text-[#047857]"
              : "bg-[#ececf8] text-[#0D0B61]",
          )}
        >
          {published ? (
            <ClipboardList className="size-5" strokeWidth={1.75} />
          ) : (
            <FileText className="size-5" strokeWidth={1.75} />
          )}
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white",
            published ? "bg-[#059669]" : "bg-[#475569]",
          )}
        >
          {published ? "Published" : "Draft"}
        </span>
      </div>
      <Link
        href={`/assignments/${brief._id}`}
        className="mt-3 line-clamp-2 font-bold text-[#0f172a] hover:text-[#0D0B61]"
      >
        {brief.title}
      </Link>
      <p className="mt-1 line-clamp-2 text-sm text-[#64748b]">
        {courseLine} · {marks} marks
      </p>
      <p
        className={cn(
          "mt-3 inline-flex items-center gap-1.5 text-xs font-semibold",
          DUE_TEXT[tone],
        )}
      >
        <CalendarDays className="size-3.5 text-[#94a3b8]" />
        {dueDate ? `${dueLabel(days)} · ${dueDate}` : dueLabel(days)}
      </p>
      <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0f172a]">
        <Users className="size-3.5 text-[#94a3b8]" />
        {submissions} {submissions === 1 ? "submission" : "submissions"}
      </p>
      <div className="mt-4">
        <Button asChild size="sm" variant="info" className="w-full">
          <Link href={`/assignments/${brief._id}`}>
            Open
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </article>
  );
}
