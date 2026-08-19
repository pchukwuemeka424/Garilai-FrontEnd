"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  FileText,
  Pencil,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Avatar } from "@/components/portal/ui/avatar";
import { Button } from "@/components/portal/ui/button";
import { ConfirmModal } from "@/components/portal/ui/confirm-modal";
import { LoadingPage } from "@/components/portal/feedback/loading-page";
import {
  briefToForm,
  type BriefFormValues,
} from "@/components/portal/features/assignment/assignment-brief-form";
import {
  AssignmentBriefPanel,
  type AssignmentBriefView,
} from "@/components/portal/features/assignment/assignment-brief-panel";
import { apiFetch } from "@/lib/portal-api";
import { exportSubmissionsToExcel } from "@/lib/portal/submissions-xlsx";
import { cn } from "@/lib/portal/cn";

type SubmissionRow = {
  _id: string;
  title: string;
  studentId: string;
  student: { id: string; name: string; email: string } | null;
  studentMatNo: string;
  courseName: string;
  courseYear: string;
  status: "draft" | "submitted";
  reviewStatus?: string;
  score: number | null;
  maxScore: number;
  pageId: string | null;
  reviewHref: string | null;
  updatedAt?: string;
};

type FilterKey = "all" | "submitted" | "draft" | "to_score";

function formatDue(dueAt: string) {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

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

function wordCountSummary(form: BriefFormValues) {
  const min = form.wordCountMin.trim() ? Number(form.wordCountMin) : null;
  const max = form.wordCountMax.trim() ? Number(form.wordCountMax) : null;
  if (min != null && Number.isFinite(min) && max != null && Number.isFinite(max)) {
    return `${min.toLocaleString()}–${max.toLocaleString()}`;
  }
  if (min != null && Number.isFinite(min)) return `≥ ${min.toLocaleString()}`;
  if (max != null && Number.isFinite(max)) return `≤ ${max.toLocaleString()}`;
  return "Not set";
}

function formToBriefView(
  form: BriefFormValues,
  title: string,
): AssignmentBriefView {
  const min = form.wordCountMin.trim() ? Number(form.wordCountMin) : null;
  const max = form.wordCountMax.trim() ? Number(form.wordCountMax) : null;
  return {
    title,
    instructions: form.instructions,
    requiredItems: form.requiredItems,
    wordCountMin: min != null && Number.isFinite(min) ? min : null,
    wordCountMax: max != null && Number.isFinite(max) ? max : null,
    maxScore: Number(form.maxScore) || 100,
    rubric: form.rubric
      .filter((row) => row.name.trim())
      .map((row) => ({
        name: row.name.trim(),
        maxMarks: Number(row.maxMarks) || 0,
      })),
    dueAt: form.dueAt.trim() ? new Date(form.dueAt).toISOString() : null,
    allowLateSubmission: form.allowLateSubmission,
    courseName: form.courseName,
    courseYear: form.courseYear,
    status: form.status,
  };
}

function submissionTone(row: SubmissionRow) {
  if (typeof row.score === "number") {
    return { label: "Scored", tone: "ok" as const };
  }
  if (row.reviewStatus === "needs_revision") {
    return { label: "Needs rewrite", tone: "review" as const };
  }
  if (row.reviewStatus === "approved") {
    return { label: "Approved", tone: "ok" as const };
  }
  if (row.status === "submitted") {
    return { label: "Submitted", tone: "review" as const };
  }
  return { label: "Draft", tone: "mid" as const };
}

export default function AssignmentBriefDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const editHref = `/assignments/${params.id}/edit`;
  const [initial, setInitial] = useState<BriefFormValues | null>(null);
  const [briefTitle, setBriefTitle] = useState("Assignment");
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [briefModalOpen, setBriefModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [brief, list] = await Promise.all([
          apiFetch(`/api/v1/assignment-briefs/${params.id}`) as Promise<
            Record<string, unknown>
          >,
          apiFetch(
            `/api/v1/assignment-briefs/${params.id}/submissions`,
          ).catch(() => []) as Promise<SubmissionRow[]>,
        ]);
        if (!cancelled) {
          setInitial(briefToForm(brief));
          setBriefTitle(String(brief.title || "Assignment"));
          setSubmissions(list);
        }
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
  }, [params.id]);

  useEffect(() => {
    if (!briefModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBriefModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [briefModalOpen]);

  const stats = useMemo(() => {
    if (!initial) return null;
    const submitted = submissions.filter((s) => s.status === "submitted").length;
    const scored = submissions.filter((s) => typeof s.score === "number").length;
    const toScore = submissions.filter(
      (s) => s.status === "submitted" && typeof s.score !== "number",
    ).length;
    const drafts = submissions.filter((s) => s.status !== "submitted").length;
    const dueLabel = formatDue(initial.dueAt);
    const courseLabel =
      [initial.courseName, initial.courseYear].filter(Boolean).join(" · ") ||
      null;
    const requiredItems = initial.requiredItems.map((i) => i.trim()).filter(Boolean);
    const rubric = initial.rubric.filter((r) => r.name.trim());
    return {
      submitted,
      scored,
      toScore,
      drafts,
      dueLabel,
      courseLabel,
      requiredItems,
      rubric,
      requiredCount: requiredItems.length,
      maxScore: Number(initial.maxScore) || 100,
      wordCount: wordCountSummary(initial),
      published: initial.status === "published",
      allowLate: initial.allowLateSubmission,
      instructions: initial.instructions.trim(),
    };
  }, [initial, submissions]);

  const filtered = useMemo(() => {
    let list = [...submissions];
    if (filter === "submitted") {
      list = list.filter((s) => s.status === "submitted");
    } else if (filter === "draft") {
      list = list.filter((s) => s.status !== "submitted");
    } else if (filter === "to_score") {
      list = list.filter(
        (s) => s.status === "submitted" && typeof s.score !== "number",
      );
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((row) => {
        const hay = [
          row.student?.name || "",
          row.student?.email || "",
          row.studentMatNo || "",
          row.title || "",
          row.courseName || "",
          row.courseYear || "",
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
  }, [submissions, filter, query]);

  async function onDelete() {
    setDeleting(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/assignment-briefs/${params.id}`, {
        method: "DELETE",
      });
      router.push("/assignments");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  function onExportExcel() {
    if (submissions.length === 0) return;
    setExporting(true);
    setError(null);
    try {
      exportSubmissionsToExcel({
        assignmentTitle: briefTitle,
        assignmentId: params.id,
        rows: submissions.map((row) => ({
          studentName: row.student?.name || "Student",
          email: row.student?.email || "",
          matNo: row.studentMatNo || "",
          projectTitle: row.title || "",
          courseName: row.courseName || "",
          courseYear: row.courseYear || "",
          status: row.status === "submitted" ? "Submitted" : "Draft",
          reviewStatus: row.reviewStatus
            ? row.reviewStatus.replace(/_/g, " ")
            : "",
          score: typeof row.score === "number" ? row.score : "",
          maxScore: row.maxScore ?? "",
          updatedAt: row.updatedAt
            ? new Date(row.updatedAt).toLocaleString()
            : "",
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export");
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <LoadingPage label="Loading brief…" />;

  if (!initial || !stats) {
    return (
      <div className="portal-students">
        <Link href="/assignments" className="portal-students-back">
          <ArrowLeft className="size-4" />
          Back to assignments
        </Link>
        <section className="portal-students-panel">
          <div className="portal-students-empty">
            <span className="portal-students-empty-icon" aria-hidden>
              <ClipboardList className="size-6" strokeWidth={1.75} />
            </span>
            <h2>Brief not found</h2>
            <p>{error || "This assignment brief could not be loaded."}</p>
            <Button asChild className="mt-2">
              <Link href="/assignments">Back to assignments</Link>
            </Button>
          </div>
        </section>
      </div>
    );
  }

  const filters: { id: FilterKey; label: string; count: number }[] = [
    { id: "all", label: "All", count: submissions.length },
    { id: "submitted", label: "Submitted", count: stats.submitted },
    { id: "to_score", label: "To score", count: stats.toScore },
    { id: "draft", label: "Draft", count: stats.drafts },
  ];

  const hasBriefBody =
    Boolean(stats.instructions) ||
    stats.requiredItems.length > 0 ||
    stats.rubric.length > 0;

  return (
    <div className="portal-students">
      <Link href="/assignments" className="portal-students-back">
        <ArrowLeft className="size-4" />
        Back to assignments
      </Link>

      <header className="portal-students-hero">
        <div className="min-w-0">
          <p className="portal-students-kicker">Supervision</p>
          <h1 className="portal-students-title">{briefTitle}</h1>
          <p className="portal-students-lead">
            {stats.courseLabel || "No course set"}
            {" · "}
            {stats.maxScore} marks
            {stats.dueLabel ? ` · Due ${stats.dueLabel}` : ""}
          </p>
          <div className="portal-student-project-pills">
            <span
              className={cn(
                "portal-students-status",
                stats.published ? "is-ok" : "is-mid",
              )}
            >
              {stats.published ? "Published" : "Draft"}
            </span>
            {stats.allowLate ? (
              <span className="portal-students-status is-topic">Late allowed</span>
            ) : stats.dueLabel ? (
              <span className="portal-students-status is-risk">No late work</span>
            ) : null}
          </div>
        </div>
        <div className="portal-students-hero-actions">
          <Button
            type="button"
            variant="outline"
            onClick={() => setBriefModalOpen(true)}
          >
            <FileText className="size-4" />
            Assignment Brief
          </Button>
          <Button asChild variant="outline">
            <Link href={editHref}>
              <Pencil className="size-4" />
              Edit
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={deleting}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
          <Button
            type="button"
            disabled={submissions.length === 0 || exporting}
            title={
              submissions.length === 0
                ? "No submissions to export"
                : "Download student data and scores as Excel"
            }
            onClick={onExportExcel}
          >
            <Download className="size-4" />
            {exporting ? "Exporting…" : "Export to Excel"}
          </Button>
        </div>
      </header>

      {error ? (
        <p className="portal-students-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="portal-students-kpis" aria-label="Assignment snapshot">
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--navy">
            <Users className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">{submissions.length}</p>
            <p className="portal-students-kpi-label">Submissions</p>
          </div>
        </article>
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--violet">
            <ClipboardList className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">{stats.submitted}</p>
            <p className="portal-students-kpi-label">Submitted</p>
          </div>
        </article>
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--amber">
            <Clock3 className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">{stats.toScore}</p>
            <p className="portal-students-kpi-label">To score</p>
          </div>
        </article>
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--green">
            <CheckCircle2 className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value">{stats.scored}</p>
            <p className="portal-students-kpi-label">Scored</p>
          </div>
        </article>
        <article className="portal-students-kpi">
          <span className="portal-students-kpi-icon portal-students-kpi-icon--rose">
            <Calendar className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="portal-students-kpi-value portal-students-kpi-value--sm">
              {stats.dueLabel || "No due date"}
            </p>
            <p className="portal-students-kpi-label">Deadline</p>
          </div>
        </article>
      </section>

      <section className="portal-students-panel">
        <div className="portal-students-toolbar">
          <div
            className="portal-students-filters"
            role="tablist"
            aria-label="Filter submissions"
          >
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
              placeholder="Search student, mat no, or title"
              aria-label="Search submissions"
            />
          </label>
        </div>

        {submissions.length === 0 ? (
          <div className="portal-students-empty">
            <span className="portal-students-empty-icon" aria-hidden>
              <Users className="size-6" strokeWidth={1.75} />
            </span>
            <h2>No submissions yet</h2>
            <p>
              Published briefs appear when students select them while creating
              an assignment.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="portal-students-empty">
            <h2>No matches</h2>
            <p>Try another filter or search term.</p>
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
          </div>
        ) : (
          <div className="portal-students-table-wrap">
            <table className="portal-students-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Work</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Activity</th>
                  <th>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const status = submissionTone(row);
                  const studentName = row.student?.name || "Student";
                  const studentId = row.student?.id || row.studentId;
                  const person = (
                    <>
                      <Avatar
                        name={studentName}
                        className="size-10 bg-[#ececf8] text-[#0D0B61]"
                      />
                      <span>
                        <span className="portal-students-name">{studentName}</span>
                        <span className="portal-students-email">
                          {row.student?.email ||
                            row.studentMatNo ||
                            "No email on file"}
                        </span>
                      </span>
                    </>
                  );
                  return (
                    <tr key={row._id}>
                      <td>
                        {studentId ? (
                          <Link
                            href={`/students/${studentId}`}
                            className="portal-students-person"
                          >
                            {person}
                          </Link>
                        ) : (
                          <span className="portal-students-person">{person}</span>
                        )}
                      </td>
                      <td>
                        <p className="portal-students-work-title">
                          {row.title || "Untitled"}
                        </p>
                        <p className="portal-students-work-meta">
                          {row.studentMatNo || "No mat no"}
                          {row.courseName ? ` · ${row.courseName}` : ""}
                          {row.courseYear ? ` · ${row.courseYear}` : ""}
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
                      <td>
                        <p className="portal-students-work-title">
                          {typeof row.score === "number"
                            ? `${row.score}/${row.maxScore}`
                            : "—"}
                        </p>
                      </td>
                      <td className="portal-students-activity">
                        {formatRelative(row.updatedAt)}
                      </td>
                      <td className="portal-students-action">
                        {row.reviewHref ? (
                          <Button asChild size="sm">
                            <Link href={row.reviewHref.replace(/^\/projects(?=\/|$)/, "/supervision/projects")}>
                              Open
                              <ArrowRight className="size-3.5" />
                            </Link>
                          </Button>
                        ) : (
                          <span className="portal-students-email">No page</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {briefModalOpen ? (
        <div
          className="portal-review-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assignment-brief-modal-title"
        >
          <button
            type="button"
            className="portal-review-modal-scrim"
            aria-label="Close dialog"
            onClick={() => setBriefModalOpen(false)}
          />
          <div className="portal-review-modal-panel">
            <div className="portal-review-modal-head">
              <div className="min-w-0">
                <h2 id="assignment-brief-modal-title">Assignment brief</h2>
                <p>
                  Word count {stats.wordCount}
                  {" · "}
                  {stats.requiredCount} required item
                  {stats.requiredCount === 1 ? "" : "s"}
                  {stats.rubric.length > 0
                    ? ` · ${stats.rubric.length} criteria`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={editHref}>
                    <Pencil className="size-3.5" />
                    Edit brief
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Close"
                  onClick={() => setBriefModalOpen(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
            <div className="portal-review-modal-body">
              {!hasBriefBody ? (
                <div className="portal-students-empty">
                  <h2>No instructions yet</h2>
                  <p>
                    Add requirements, word count, and grading criteria in Edit.
                  </p>
                </div>
              ) : (
                <AssignmentBriefPanel
                  brief={formToBriefView(initial, briefTitle)}
                  hideHeader
                  className="border-0 shadow-none"
                />
              )}
            </div>
            <div className="portal-review-modal-foot">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBriefModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={confirmDelete}
        title="Delete this assignment brief?"
        description="Students already linked keep their copy reference. This cannot be undone."
        confirmLabel="Delete brief"
        loading={deleting}
        onConfirm={() => void onDelete()}
        onCancel={() => {
          if (!deleting) setConfirmDelete(false);
        }}
      />
    </div>
  );
}
