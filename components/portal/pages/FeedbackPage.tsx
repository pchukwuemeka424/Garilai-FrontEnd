"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FolderOpen,
  MessageSquareText,
  Search,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/portal/ui/button";
import { LoadingPage } from "@/components/portal/feedback/loading-page";
import {
  buildSupervisorComments,
  feedbackDetailHref,
  formatRelative,
  type Project,
  type ProjectDetail,
  type ProjectFeedbackGroup,
  type Chapter,
  type StatusFilter,
} from "@/components/portal/features/feedback/student-feedback";
import { apiFetch } from "@/lib/portal-api";
import { cn } from "@/lib/portal/cn";
import { stripRemarkHtml } from "@/lib/portal/remark-html";

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  iconClass,
  cardClass,
}: {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  iconClass: string;
  cardClass: string;
}) {
  return (
    <div className={cn("rounded-2xl p-4 text-white shadow-sm", cardClass)}>
      <span
        className={cn(
          "grid size-10 place-items-center rounded-xl bg-white shadow-sm",
          iconClass,
        )}
      >
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <p className="mt-3 text-xs font-medium text-white/85">{label}</p>
      <p className="mt-1 text-[1.75rem] font-bold tabular-nums leading-none tracking-tight text-white">
        {value}
      </p>
      <p className="mt-1.5 text-[11px] leading-snug text-white/75">{hint}</p>
    </div>
  );
}

export default function StudentFeedbackPage() {
  const [groups, setGroups] = useState<ProjectFeedbackGroup[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const projectList = (await apiFetch(
          "/api/v1/projects",
        )) as Project[];
        if (cancelled) return;

        const details = await Promise.all(
          projectList.map(async (project) => {
            const [detail, chapters] = await Promise.all([
              apiFetch(
                `/api/v1/projects/${project._id}`,
              ) as Promise<ProjectDetail>,
              apiFetch(
                `/api/v1/projects/${project._id}/chapters`,
              ).catch(() => []) as Promise<Chapter[]>,
            ]);
            return { detail, chapters };
          }),
        );
        if (cancelled) return;

        const nextGroups: ProjectFeedbackGroup[] = [];
        for (const { detail, chapters } of details) {
          const comments = buildSupervisorComments(detail, chapters);
          if (comments.length === 0) continue;
          nextGroups.push({
            projectId: detail._id,
            projectTitle: detail.title,
            supervisorName: detail.supervisor?.name,
            comments,
          });
        }

        setGroups(nextGroups);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load feedback",
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

  const statusCounts = useMemo(() => {
    let approved = 0;
    let needsRevision = 0;
    for (const group of groups) {
      for (const comment of group.comments) {
        if (comment.status === "approved") approved += 1;
        else needsRevision += 1;
      }
    }
    return {
      total: approved + needsRevision,
      approved,
      needsRevision,
    };
  }, [groups]);

  const flatComments = useMemo(() => {
    return groups.flatMap((group) =>
      group.comments.map((comment) => ({
        ...comment,
        projectTitle: group.projectTitle,
        supervisorName: group.supervisorName,
      })),
    );
  }, [groups]);

  const filteredComments = useMemo(() => {
    const q = query.trim().toLowerCase();
    return flatComments.filter((comment) => {
      if (projectFilter !== "all" && comment.projectId !== projectFilter) {
        return false;
      }
      if (statusFilter !== "all" && comment.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const hay = [
        comment.chapterTitle,
        comment.projectTitle,
        stripRemarkHtml(comment.remark),
        comment.supervisorName,
        comment.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [flatComments, projectFilter, statusFilter, query]);

  if (loading) return <LoadingPage label="Loading feedback…" />;

  const filters: { id: StatusFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: statusCounts.total },
    {
      id: "needs_revision",
      label: "Revision",
      count: statusCounts.needsRevision,
    },
    { id: "approved", label: "Approved", count: statusCounts.approved },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] font-bold tracking-tight text-[#0f172a] md:text-[2rem]">
            Feedback
          </h1>
          <p className="mt-1.5 max-w-xl text-[15px] text-[#64748b]">
            Lecturer remarks — open a row to read the full review.
          </p>
        </div>
        <Button asChild variant="outline" className="shadow-sm">
          <Link href="/student/projects">
            <FolderOpen className="size-4" />
            View projects
          </Link>
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Total remarks"
          value={statusCounts.total}
          hint="Across all projects"
          icon={MessageSquareText}
          iconClass="text-[#2563eb]"
          cardClass="bg-[#2563eb]"
        />
        <KpiCard
          label="Approved"
          value={statusCounts.approved}
          hint="Chapters cleared"
          icon={CheckCircle2}
          iconClass="text-[#059669]"
          cardClass="bg-[#059669]"
        />
        <KpiCard
          label="Needs revision"
          value={statusCounts.needsRevision}
          hint="Action required"
          icon={AlertCircle}
          iconClass="text-[#dc2626]"
          cardClass="bg-[#dc2626]"
        />
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {/* Feedback list */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#0f172a]">
              Lecturer remarks
            </h2>
            <p className="mt-0.5 text-sm text-[#94a3b8]">
              {statusCounts.total === 0
                ? "No remarks yet"
                : `${filteredComments.length} of ${statusCounts.total} shown`}
            </p>
          </div>

          {statusCounts.total > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {groups.length > 1 ? (
                <select
                  id="feedback-project-filter"
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="h-9 rounded-xl border border-[#e8ecf3] bg-white px-3 text-xs font-semibold text-[#64748b] shadow-sm outline-none focus:border-[#2563eb]/40"
                >
                  <option value="all">All projects</option>
                  {groups.map((group) => (
                    <option key={group.projectId} value={group.projectId}>
                      {group.projectTitle}
                    </option>
                  ))}
                </select>
              ) : null}
              <div className="inline-flex h-9 items-center rounded-xl border border-[#e8ecf3] bg-white p-0.5 shadow-sm">
                {filters.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setStatusFilter(filter.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
                      statusFilter === filter.id
                        ? "bg-[#0D0B61] text-white"
                        : "text-[#94a3b8] hover:text-[#64748b]",
                    )}
                  >
                    {filter.label}
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                        statusFilter === filter.id
                          ? "bg-white/20 text-white"
                          : "bg-[#f1f5f9] text-[#94a3b8]",
                      )}
                    >
                      {filter.count}
                    </span>
                  </button>
                ))}
              </div>
              <div className="relative min-w-[200px] flex-1 sm:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#94a3b8]" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search feedback…"
                  className="h-9 w-full rounded-xl border border-[#e8ecf3] bg-white py-2 pl-9 pr-3 text-xs shadow-sm outline-none placeholder:text-[#94a3b8] focus:border-[#2563eb]/40 focus:ring-2 focus:ring-[#2563eb]/10"
                />
              </div>
            </div>
          ) : null}
        </div>

        {statusCounts.total === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e8ecf3] bg-white px-6 py-12 text-center shadow-sm">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eff6ff] text-[#2563eb]">
              <MessageSquareText className="size-6" strokeWidth={1.75} />
            </span>
            <h3 className="mt-4 text-base font-bold text-[#0f172a]">
              No lecturer comments yet
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-[#94a3b8]">
              When your lecturer approves work or requests revisions, those
              remarks will appear here.
            </p>
            <Button
              asChild
              className="mt-5"
            >
              <Link href="/student/projects">
                <FolderOpen className="size-4" />
                Open projects
              </Link>
            </Button>
          </div>
        ) : filteredComments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e8ecf3] bg-white px-6 py-10 text-center shadow-sm">
            <p className="font-semibold text-[#0f172a]">
              No remarks match this filter
            </p>
            <p className="mt-1 text-sm text-[#94a3b8]">
              Try another status, project, or search term.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 rounded-xl"
              onClick={() => {
                setStatusFilter("all");
                setProjectFilter("all");
                setQuery("");
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#e8ecf3] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
            <div className="hidden border-b border-[#eef1f6] bg-[#f8fafc] px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-[#94a3b8] lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_120px_110px_120px] lg:gap-4">
              <span>Item</span>
              <span>Remark</span>
              <span>Status</span>
              <span>When</span>
              <span className="text-right">Action</span>
            </div>
            <ul className="divide-y divide-[#eef1f6]">
              {filteredComments.map((comment) => {
                const relative = formatRelative(comment.reviewedAt);
                const approved = comment.status === "approved";
                const preview =
                  stripRemarkHtml(comment.remark) ||
                  (approved
                    ? "Approved with no written remark."
                    : "Revision requested with no written remark.");

                return (
                  <li
                    key={comment.key}
                    className="px-4 py-4 transition hover:bg-[#f8fafc] sm:px-5"
                  >
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_120px_110px_120px] lg:items-center lg:gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className={cn(
                            "mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl",
                            approved
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-red-50 text-red-600",
                          )}
                        >
                          {approved ? (
                            <CheckCircle2
                              className="size-5"
                              strokeWidth={1.75}
                            />
                          ) : (
                            <AlertCircle
                              className="size-5"
                              strokeWidth={1.75}
                            />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-[#0f172a]">
                            {comment.chapterTitle}
                          </p>
                          <p className="mt-0.5 truncate text-sm text-[#64748b]">
                            {comment.projectTitle}
                          </p>
                          {comment.supervisorName ? (
                            <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#94a3b8]">
                              <UserRound className="size-3" />
                              {comment.supervisorName}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <p className="line-clamp-2 text-sm text-[#64748b]">
                        {preview}
                      </p>

                      <div>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                            approved
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-700",
                          )}
                        >
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              approved ? "bg-emerald-500" : "bg-red-500",
                            )}
                          />
                          {approved ? "Approved" : "Needs revision"}
                        </span>
                      </div>

                      <p className="inline-flex items-center gap-1.5 text-sm font-medium text-[#64748b]">
                        <Clock3 className="size-3.5 text-[#94a3b8]" />
                        {relative || "—"}
                      </p>

                      <div className="flex justify-end">
                        <Button
                          asChild
                          className="h-9 w-full lg:w-auto"
                        >
                          <Link href={feedbackDetailHref(comment)}>
                            Open →
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
