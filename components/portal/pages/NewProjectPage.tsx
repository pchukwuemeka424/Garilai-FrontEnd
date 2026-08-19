"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Info,
} from "lucide-react";
import { Button } from "@/components/portal/ui/button";
import { Input } from "@/components/portal/ui/input";
import { Select } from "@/components/portal/ui/select";
import { apiFetch } from "@/lib/portal-api";
import {
  PROJECT_TYPES,
  projectAdvisorLabel,
  projectAdvisorNoun,
  projectCreationGuidance,
  projectCreationSetupBlurb,
  projectCreationSubmitCta,
  projectCreationSubmitPending,
  projectCreationVerbLabel,
  projectTitleFieldLabel,
  type ProjectType,
} from "@/lib/portal/project-types";
import { COURSE_YEAR_OPTIONS } from "@/lib/portal/course-years";
import { assignmentInstructionsToText } from "@/lib/portal/assignment-instructions";
import { cn } from "@/lib/portal/cn";

type Supervisor = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type SupervisorsResponse = {
  university: {
    id: string;
    name: string;
    slug?: string;
    country?: string;
  };
  supervisors: Supervisor[];
};

type PublishedBrief = {
  _id: string;
  title: string;
  courseName?: string;
  courseYear?: string;
  maxScore?: number;
  instructions?: string;
  wordCountMin?: number | null;
  wordCountMax?: number | null;
  dueAt?: string | null;
};

const INSTRUCTIONS_PREVIEW_CHARS = 180;

function briefWordCountLabel(brief: PublishedBrief) {
  const min =
    typeof brief.wordCountMin === "number" ? brief.wordCountMin : null;
  const max =
    typeof brief.wordCountMax === "number" ? brief.wordCountMax : null;
  if (min != null && max != null) {
    return `${min.toLocaleString()}–${max.toLocaleString()} words`;
  }
  if (min != null) return `At least ${min.toLocaleString()} words`;
  if (max != null) return `Up to ${max.toLocaleString()} words`;
  return null;
}

function formatBriefDueDate(dueAt?: string | null) {
  if (!dueAt) return null;
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const fieldControlClass =
  "h-11 rounded-xl border-[#e8ecf3] bg-white text-[#0f172a] shadow-sm placeholder:text-[#94a3b8] focus:border-[#5B5CE2]/40 focus:ring-2 focus:ring-[#5B5CE2]/10";

function FieldSelect({
  className,
  ...props
}: React.ComponentProps<typeof Select>) {
  return (
    <div className="relative">
      <Select className={cn(fieldControlClass, "pr-10", className)} {...props} />
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]"
      />
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[13px] font-medium text-[#334155]">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="mt-1.5 block text-xs leading-relaxed text-[#94a3b8]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export default function NewProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromAssignments = searchParams.get("from") === "assignments";
  const [title, setTitle] = useState("");
  const [studentMatNo, setStudentMatNo] = useState("");
  const [courseYear, setCourseYear] = useState("");
  const [courseName, setCourseName] = useState("");
  const [projectType, setProjectType] = useState<ProjectType | "">(
    fromAssignments ? "assignment" : "",
  );
  const [supervisorId, setSupervisorId] = useState("");
  const [assignmentBriefId, setAssignmentBriefId] = useState("");
  const [briefs, setBriefs] = useState<PublishedBrief[]>([]);
  const [loadingBriefs, setLoadingBriefs] = useState(false);
  const [expandedBriefId, setExpandedBriefId] = useState<string | null>(null);
  const [universityName, setUniversityName] = useState("");
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isAssignment = projectType === "assignment";
  const backHref =
    fromAssignments || isAssignment
      ? "/student/assignments"
      : "/student/projects";
  const backLabel =
    fromAssignments || isAssignment
      ? "Back to assignments"
      : "Back to projects";

  useEffect(() => {
    apiFetch("/api/v1/supervisors")
      .then((data) => {
        const payload = data as SupervisorsResponse;
        setUniversityName(payload.university.name);
        setSupervisors(payload.supervisors);
      })
      .catch((err) =>
        setError(
          err instanceof Error
            ? err.message
            : "Could not load lecturers/supervisors for your university",
        ),
      )
      .finally(() => setLoadingSupervisors(false));
  }, []);

  useEffect(() => {
    if (!isAssignment || !supervisorId || !courseYear.trim()) {
      setBriefs([]);
      setAssignmentBriefId("");
      setExpandedBriefId(null);
      setLoadingBriefs(false);
      return;
    }
    let cancelled = false;
    setLoadingBriefs(true);
    setAssignmentBriefId("");
    setExpandedBriefId(null);
    const params = new URLSearchParams({
      lecturerId: supervisorId,
      courseYear: courseYear.trim(),
    });
    apiFetch(`/api/v1/assignment-briefs?${params.toString()}`)
      .then((data) => {
        if (cancelled) return;
        setBriefs(data as PublishedBrief[]);
      })
      .catch(() => {
        if (!cancelled) setBriefs([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingBriefs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAssignment, supervisorId, courseYear]);

  function onSelectBrief(briefId: string) {
    setAssignmentBriefId(briefId);
    const brief = briefs.find((b) => b._id === briefId);
    if (!brief) return;
    if (brief.courseName?.trim()) {
      setCourseName(brief.courseName.trim());
    }
    if (brief.title?.trim()) {
      setTitle(brief.title.trim());
    }
  }

  const briefsRequireSelection = isAssignment && briefs.length > 0;

  const selected = useMemo(
    () => PROJECT_TYPES.find((t) => t.value === projectType),
    [projectType],
  );

  const guidance = projectCreationGuidance(projectType);
  const titleFieldLabel = projectTitleFieldLabel(projectType);
  const advisorNoun = projectAdvisorNoun(projectType);
  const advisorLabel = projectAdvisorLabel(projectType);
  const advisorPlural = `${advisorNoun}s`;

  function selectProjectType(next: ProjectType) {
    const wasAssignment = projectType === "assignment";
    const willBeAssignment = next === "assignment";
    setProjectType(next);
    setError(null);
    if (wasAssignment !== willBeAssignment) {
      setSupervisorId("");
      setAssignmentBriefId("");
      setCourseYear("");
      setCourseName("");
      setStudentMatNo("");
      setBriefs([]);
      setExpandedBriefId(null);
      if (willBeAssignment) setTitle("");
    }
  }

  function validateAssignmentDetails(): string | null {
    if (title.trim().length < 3) {
      return `Enter ${titleFieldLabel.toLowerCase()} (at least 3 characters)`;
    }
    if (studentMatNo.trim().length < 2) {
      return "Enter your Mat No / Student No (at least 2 characters)";
    }
    if (courseName.trim().length < 2) {
      return "Enter the course name (at least 2 characters)";
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!projectType) {
      setError("Select a project type");
      return;
    }

    if (isAssignment) {
      if (!supervisorId) {
        setError("Select a lecturer from your university");
        return;
      }
      if (courseYear.trim().length < 1) {
        setError("Select the year / level");
        return;
      }
      if (briefs.length > 0 && !assignmentBriefId) {
        setError("Select one of the published assignments from your lecturer");
        return;
      }
      const detailsError = validateAssignmentDetails();
      if (detailsError) {
        setError(detailsError);
        return;
      }
    } else {
      if (title.trim().length < 3) {
        setError(
          `Enter ${titleFieldLabel.toLowerCase()} (at least 3 characters)`,
        );
        return;
      }
      if (!supervisorId) {
        setError(`Select a ${advisorNoun} from your university`);
        return;
      }
    }

    setLoading(true);
    try {
      const project = (await apiFetch("/api/v1/projects", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          projectType,
          supervisorId,
          topic: title.trim(),
          ...(isAssignment
            ? {
                studentMatNo: studentMatNo.trim(),
                courseYear: courseYear.trim(),
                courseName: courseName.trim(),
                ...(assignmentBriefId ? { assignmentBriefId } : {}),
              }
            : {}),
        }),
      })) as { _id: string };
      router.push(
        isAssignment
          ? `/student/assignments/${project._id}`
          : `/student/projects/${project._id}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    Boolean(projectType) &&
    !loading &&
    !loadingSupervisors &&
    Boolean(supervisorId) &&
    (!isAssignment ||
      (!loadingBriefs &&
        courseYear.trim().length > 0 &&
        (!briefsRequireSelection || Boolean(assignmentBriefId))));

  function renderBriefList() {
    if (!courseYear.trim()) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[#d8dce8] bg-white px-5 py-12 text-center">
          <span className="grid size-11 place-items-center rounded-xl bg-[#EEF0FF] text-[#5B5CE2]">
            <ClipboardList className="size-5" strokeWidth={1.75} />
          </span>
          <p className="mt-3 text-sm font-semibold text-[#0f172a]">
            Select lecturer and year
          </p>
          <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-[#94a3b8]">
            Published briefs from your lecturer will appear here.
          </p>
        </div>
      );
    }

    if (loadingBriefs) {
      return (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-[#e8ecf3] bg-white px-5 py-12 text-sm text-[#94a3b8]">
          Loading published assignments…
        </div>
      );
    }

    if (briefs.length === 0) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[#d8dce8] bg-white px-5 py-12 text-center">
          <span className="grid size-11 place-items-center rounded-xl bg-[#f8fafc] text-[#94a3b8]">
            <ClipboardList className="size-5" strokeWidth={1.75} />
          </span>
          <p className="mt-3 text-sm font-semibold text-[#0f172a]">
            No briefs for {courseYear.trim()}
          </p>
          <p className="mt-1 max-w-[18rem] text-xs leading-relaxed text-[#94a3b8]">
            You can continue without a brief, or ask your lecturer to publish
            one.
          </p>
        </div>
      );
    }

    return (
      <ul
        className="divide-y divide-[#eef1f6] overflow-hidden rounded-xl border border-[#e8ecf3] bg-white"
        role="listbox"
        aria-label="Published assignments"
      >
        {briefs.map((brief) => {
          const isSelected = assignmentBriefId === brief._id;
          const instructions = assignmentInstructionsToText(
            brief.instructions || "",
          );
          const expanded = expandedBriefId === brief._id;
          const needsExpand =
            instructions.length > INSTRUCTIONS_PREVIEW_CHARS;
          const preview =
            !expanded && needsExpand
              ? `${instructions.slice(0, INSTRUCTIONS_PREVIEW_CHARS).trimEnd()}…`
              : instructions;
          const due = formatBriefDueDate(brief.dueAt);
          const wordsLabel = briefWordCountLabel(brief);

          return (
            <li key={brief._id} role="option" aria-selected={isSelected}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelectBrief(brief._id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectBrief(brief._id);
                  }
                }}
                className={cn(
                  "cursor-pointer px-4 py-3.5 text-left transition",
                  isSelected
                    ? "bg-[#EEF0FF]"
                    : "bg-white hover:bg-[#f8fafc]",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl",
                      isSelected
                        ? "bg-[#5B5CE2] text-white"
                        : "bg-[#EEF0FF] text-[#5B5CE2]",
                    )}
                  >
                    <ClipboardList className="size-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-bold leading-snug text-[#0f172a]">
                        {brief.title}
                      </p>
                      <span
                        className={cn(
                          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border",
                          isSelected
                            ? "border-[#5B5CE2] bg-[#5B5CE2] text-white"
                            : "border-[#e8ecf3] bg-white",
                        )}
                      >
                        {isSelected ? <Check className="size-3" /> : null}
                      </span>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#64748b]">
                      {brief.courseName?.trim() ? (
                        <span>{brief.courseName.trim()}</span>
                      ) : null}
                      {due ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="size-3" />
                          Due {due}
                        </span>
                      ) : null}
                      {wordsLabel ? <span>{wordsLabel}</span> : null}
                      {typeof brief.maxScore === "number" ? (
                        <span>{brief.maxScore} marks</span>
                      ) : null}
                    </p>
                    {instructions ? (
                      <div className="mt-2">
                        <p className="line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-[#64748b]">
                          {expanded ? instructions : preview}
                        </p>
                        {needsExpand && (
                          <button
                            type="button"
                            className="mt-1 text-xs font-semibold text-[#5B5CE2] hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedBriefId(expanded ? null : brief._id);
                            }}
                          >
                            {expanded ? "Show less" : "Show more"}
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#64748b] no-underline hover:text-[#5B5CE2] hover:no-underline"
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">
              {projectCreationVerbLabel(projectType)}{" "}
              {selected?.label.toLowerCase() ?? "project"}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#64748b]">
              {projectCreationSetupBlurb(projectType)}
            </p>
          </div>
        </div>
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-[#e8ecf3] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <div className="grid grid-cols-1 divide-y divide-[#eef1f6] md:grid-cols-2 md:divide-x md:divide-y-0">
            <div className="min-w-0 space-y-5 p-5 sm:p-6">
              <div>
                <h2 className="text-base font-bold tracking-tight text-[#0f172a]">
                  Details
                </h2>
                <p className="mt-0.5 text-sm text-[#94a3b8]">
                  {isAssignment
                    ? "Type, lecturer, year, and your student details."
                    : "Type, supervisor, and working title."}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Type"
                  hint={
                    selected?.description ||
                    "Assignment, dissertation, thesis, or another type."
                  }
                >
                  <FieldSelect
                    value={projectType}
                    onChange={(e) => {
                      const next = e.target.value as ProjectType;
                      if (next) selectProjectType(next);
                    }}
                    required
                    aria-label="Project type"
                  >
                    <option value="" disabled>
                      Select type…
                    </option>
                    {PROJECT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </FieldSelect>
                </Field>

                <Field
                  label={advisorLabel}
                  hint={
                    universityName
                      ? universityName
                      : "From your registered university"
                  }
                >
                  <FieldSelect
                    value={supervisorId}
                    onChange={(e) => {
                      setSupervisorId(e.target.value);
                      setAssignmentBriefId("");
                      if (isAssignment) setCourseYear("");
                    }}
                    required
                    disabled={loadingSupervisors || supervisors.length === 0}
                  >
                    <option value="" disabled>
                      {loadingSupervisors
                        ? `Loading ${advisorPlural}…`
                        : supervisors.length === 0
                          ? `No ${advisorPlural} available`
                          : `Select ${advisorNoun}…`}
                    </option>
                    {supervisors.map((supervisor) => (
                      <option key={supervisor.id} value={supervisor.id}>
                        {supervisor.name} · {supervisor.email}
                      </option>
                    ))}
                  </FieldSelect>
                </Field>
              </div>

              {!loadingSupervisors && supervisors.length === 0 ? (
                <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
                  <CircleHelp className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <p className="text-xs leading-relaxed text-[#475569]">
                    No {advisorPlural} are registered for{" "}
                    {universityName || "your university"} yet. Ask a{" "}
                    {advisorNoun} to register with the same university, then
                    refresh this page.
                  </p>
                </div>
              ) : null}

              {isAssignment ? (
                <Field label="Year / level">
                  <FieldSelect
                    value={courseYear}
                    onChange={(e) => setCourseYear(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select year…
                    </option>
                    {COURSE_YEAR_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </FieldSelect>
                </Field>
              ) : null}

              <div className="border-t border-[#eef1f6] pt-5">
                <Field label={titleFieldLabel}>
                  <Input
                    className={fieldControlClass}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      isAssignment
                        ? "e.g. Week 4 lab report — software testing"
                        : "e.g. AI-assisted thesis supervision in higher education"
                    }
                    required
                    minLength={3}
                  />
                </Field>
              </div>

              {isAssignment ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Mat No / Student No">
                    <Input
                      className={fieldControlClass}
                      value={studentMatNo}
                      onChange={(e) => setStudentMatNo(e.target.value)}
                      placeholder="e.g. CSC/2021/0123"
                      required
                      minLength={2}
                      maxLength={64}
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Course name">
                    <Input
                      className={fieldControlClass}
                      value={courseName}
                      onChange={(e) => setCourseName(e.target.value)}
                      placeholder="e.g. Software Engineering"
                      required
                      minLength={2}
                      maxLength={200}
                      autoComplete="off"
                    />
                  </Field>
                </div>
              ) : null}
            </div>

            <div className="flex min-h-[22rem] min-w-0 flex-col gap-4 bg-[#f8fafc] p-5 sm:p-6">
              {isAssignment ? (
                <>
                  <div>
                    <h2 className="text-base font-bold tracking-tight text-[#0f172a]">
                      Published brief
                      {briefsRequireSelection ? (
                        <span className="ml-1 font-medium text-red-500">*</span>
                      ) : null}
                    </h2>
                    <p className="mt-0.5 text-sm text-[#94a3b8]">
                      {courseYear.trim()
                        ? `Briefs for ${courseYear.trim()}.`
                        : "Choose a lecturer and year to load briefs."}
                    </p>
                  </div>
                  {renderBriefList()}
                </>
              ) : selected && guidance ? (
                <div className="flex flex-1 flex-col">
                  <h2 className="text-base font-bold tracking-tight text-[#0f172a]">
                    {selected.label}
                  </h2>
                  <p className="mt-0.5 text-sm text-[#94a3b8]">
                    {selected.description}
                  </p>
                  <div className="mt-4 flex flex-1 gap-3 rounded-xl border border-[#e8ecf3] bg-white px-4 py-4">
                    <Info className="mt-0.5 size-4 shrink-0 text-[#5B5CE2]" />
                    <p className="text-sm leading-relaxed text-[#475569]">
                      {guidance.tip}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <span className="grid size-11 place-items-center rounded-xl bg-[#EEF0FF] text-[#5B5CE2]">
                    <Info className="size-5" strokeWidth={1.75} />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-[#0f172a]">
                    Select a type
                  </p>
                  <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-[#94a3b8]">
                    Structure and supervision details will appear here.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eef1f6] bg-[#f8fafc] px-5 py-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              className="rounded-full border-[#e8ecf3] bg-white text-[#334155]"
              asChild
            >
              <Link href={backHref}>Cancel</Link>
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="rounded-full border-0 bg-[#5B5CE2] shadow-[0_8px_18px_rgba(91,92,226,0.28)] hover:bg-[#4F48D0]"
            >
              {loading
                ? projectCreationSubmitPending(projectType)
                : projectCreationSubmitCta(projectType)}
              {!loading && <ArrowRight className="size-4" />}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
