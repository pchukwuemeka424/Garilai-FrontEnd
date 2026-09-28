"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Eye,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/portal/ui/button";
import { Input } from "@/components/portal/ui/input";
import { Select } from "@/components/portal/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/portal/ui/card";
import { apiFetch } from "@/lib/portal-api";
import { assignmentInstructionsToText } from "@/lib/portal/assignment-instructions";
import { COURSE_YEAR_OPTIONS } from "@/lib/portal/course-years";
import { cn } from "@/lib/portal/cn";

export type BriefFormValues = {
  title: string;
  instructions: string;
  requiredItems: string[];
  wordCountMin: string;
  wordCountMax: string;
  maxScore: string;
  rubric: Array<{ name: string; maxMarks: string }>;
  dueAt: string;
  allowLateSubmission: boolean;
  courseName: string;
  courseYear: string;
  status: "draft" | "published";
};

export const EMPTY_BRIEF_FORM: BriefFormValues = {
  title: "",
  instructions: "",
  requiredItems: [""],
  wordCountMin: "",
  wordCountMax: "",
  maxScore: "100",
  rubric: [],
  dueAt: "",
  allowLateSubmission: true,
  courseName: "",
  courseYear: "",
  status: "draft",
};

const REQUIRED_ITEM_SUGGESTIONS = [
  "Abstract",
  "Introduction",
  "Literature review",
  "Methodology",
  "Discussion",
  "Conclusion",
  "References",
] as const;

const RUBRIC_SUGGESTIONS = [
  { name: "Content and argument", maxMarks: "40" },
  { name: "Structure and organisation", maxMarks: "20" },
  { name: "Use of sources", maxMarks: "25" },
  { name: "Writing and presentation", maxMarks: "15" },
] as const;

export function briefToForm(brief: Record<string, unknown>): BriefFormValues {
  const rubric = Array.isArray(brief.rubric)
    ? (brief.rubric as Array<{ name?: string; maxMarks?: number }>).map(
        (r) => ({
          name: String(r.name || ""),
          maxMarks: String(r.maxMarks ?? ""),
        }),
      )
    : [];
  const items = Array.isArray(brief.requiredItems)
    ? (brief.requiredItems as string[]).map(String)
    : [];
  let dueAt = "";
  if (brief.dueAt) {
    const d = new Date(String(brief.dueAt));
    if (!Number.isNaN(d.getTime())) {
      // datetime-local expects local YYYY-MM-DDTHH:mm
      const pad = (n: number) => String(n).padStart(2, "0");
      dueAt = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }
  return {
    title: String(brief.title || ""),
    instructions: assignmentInstructionsToText(String(brief.instructions || "")),
    requiredItems: items.length > 0 ? items : [""],
    wordCountMin:
      typeof brief.wordCountMin === "number" ? String(brief.wordCountMin) : "",
    wordCountMax:
      typeof brief.wordCountMax === "number" ? String(brief.wordCountMax) : "",
    maxScore:
      typeof brief.maxScore === "number" ? String(brief.maxScore) : "100",
    rubric,
    dueAt,
    allowLateSubmission: brief.allowLateSubmission !== false,
    courseName: String(brief.courseName || ""),
    courseYear: String(brief.courseYear || ""),
    status: brief.status === "published" ? "published" : "draft",
  };
}

function toPayload(form: BriefFormValues) {
  const requiredItems = form.requiredItems
    .map((i) => i.trim())
    .filter(Boolean);
  const rubric = form.rubric
    .filter((r) => r.name.trim())
    .map((r) => ({
      name: r.name.trim(),
      maxMarks: Number(r.maxMarks) || 0,
    }));
  const maxScore = Number(form.maxScore) || 100;
  const wordCountMin =
    form.wordCountMin.trim() === "" ? null : Number(form.wordCountMin);
  const wordCountMax =
    form.wordCountMax.trim() === "" ? null : Number(form.wordCountMax);

  return {
    title: form.title.trim(),
    instructions: form.instructions.trim(),
    requiredItems,
    wordCountMin: Number.isFinite(wordCountMin as number)
      ? wordCountMin
      : null,
    wordCountMax: Number.isFinite(wordCountMax as number)
      ? wordCountMax
      : null,
    maxScore,
    rubric,
    dueAt: form.dueAt.trim()
      ? new Date(form.dueAt).toISOString()
      : null,
    allowLateSubmission: form.allowLateSubmission,
    courseName: form.courseName.trim(),
    courseYear: form.courseYear.trim(),
    status: form.status,
  };
}

function countWords(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function formatDuePreview(value: string) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function wordRangePreview(min: string, max: string) {
  if (min && max) return `${min}–${max} words`;
  if (min) return `At least ${min} words`;
  if (max) return `Up to ${max} words`;
  return "Not set";
}

function Field({
  label,
  hint,
  required,
  htmlFor,
  extra,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  htmlFor?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="sv-brief-field">
      <div className="sv-brief-label-row">
        <label htmlFor={htmlFor} className="sv-brief-label">
          {label}
          {required ? <span className="sv-brief-req">Required</span> : null}
        </label>
        {extra}
      </div>
      {hint ? <p className="sv-brief-hint">{hint}</p> : null}
      {children}
    </div>
  );
}

function Section({
  step,
  title,
  description,
  children,
}: {
  step: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="sv-brief-section">
      <header className="sv-brief-section-head">
        <span className="sv-brief-step" aria-hidden>
          {step}
        </span>
        <div className="min-w-0">
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

type Props = {
  initial?: BriefFormValues;
  briefId?: string;
  /** Where to go after save or cancel (defaults to assignments list). */
  returnHref?: string;
  /** Full-width two-column workspace (used by /assignments/new). */
  layout?: "stack" | "wide";
};

export function AssignmentBriefForm({
  initial,
  briefId,
  returnHref = "/assignments",
  layout = "stack",
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<BriefFormValues>(
    initial || EMPTY_BRIEF_FORM,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof BriefFormValues>(
    key: K,
    value: BriefFormValues[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent, statusOverride?: "draft" | "published") {
    e.preventDefault();
    setError(null);
    if (form.title.trim().length < 3) {
      setError("Enter a title (at least 3 characters)");
      return;
    }
    const payload = toPayload({
      ...form,
      status: statusOverride || form.status,
    });
    if (payload.rubric.length > 0) {
      const total = payload.rubric.reduce((s, r) => s + r.maxMarks, 0);
      if (Math.abs(total - payload.maxScore) > 0.01) {
        setError(
          `Rubric marks (${total}) must equal total max score (${payload.maxScore})`,
        );
        return;
      }
    }
    setBusy(true);
    try {
      if (briefId) {
        await apiFetch(`/api/v1/assignment-briefs/${briefId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/v1/assignment-briefs", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      router.push(returnHref);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save brief");
    } finally {
      setBusy(false);
    }
  }

  const wide = layout === "wide";
  const titleReady = form.title.trim().length >= 3;
  const instructionWords = countWords(form.instructions);
  const maxScore = Number(form.maxScore) || 100;
  const duePreview = formatDuePreview(form.dueAt);
  const published = form.status === "published";
  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initial || EMPTY_BRIEF_FORM),
    [form, initial],
  );
  const filledRequired = useMemo(
    () => form.requiredItems.map((item) => item.trim()).filter(Boolean),
    [form.requiredItems],
  );
  const usedRequired = useMemo(
    () => new Set(filledRequired.map((item) => item.toLowerCase())),
    [filledRequired],
  );
  const usedRubric = useMemo(
    () =>
      new Set(
        form.rubric.map((row) => row.name.trim().toLowerCase()).filter(Boolean),
      ),
    [form.rubric],
  );
  const rubricTotal = useMemo(
    () =>
      form.rubric.reduce((sum, row) => sum + (Number(row.maxMarks) || 0), 0),
    [form.rubric],
  );
  const rubricFilled = form.rubric.some((row) => row.name.trim());
  const rubricAligned =
    !rubricFilled || Math.abs(rubricTotal - maxScore) < 0.01;

  const readiness = useMemo(
    () => [
      {
        id: "title",
        label: "Title",
        done: titleReady,
        caption: titleReady ? "Ready" : "Add a title",
      },
      {
        id: "brief",
        label: "Instructions",
        done: instructionWords > 0,
        caption:
          instructionWords > 0 ? `${instructionWords} words` : "Not written yet",
      },
      {
        id: "due",
        label: "Deadline",
        done: Boolean(duePreview),
        caption: duePreview ? duePreview : "Optional",
      },
    ],
    [titleReady, instructionWords, duePreview],
  );

  function setRequiredItem(index: number, value: string) {
    const next = [...form.requiredItems];
    next[index] = value;
    update("requiredItems", next);
  }

  function addRequiredItem(value = "") {
    const trimmed = value.trim();
    const next = [...form.requiredItems];
    const emptyIdx = next.findIndex((item) => !item.trim());
    if (trimmed && emptyIdx >= 0) {
      next[emptyIdx] = trimmed;
    } else {
      next.push(trimmed);
    }
    update("requiredItems", next.length > 0 ? next : [""]);
  }

  function removeRequiredItem(index: number) {
    const next = form.requiredItems.filter((_, i) => i !== index);
    update("requiredItems", next.length > 0 ? next : [""]);
  }

  function setRubricRow(
    index: number,
    patch: Partial<{ name: string; maxMarks: string }>,
  ) {
    const next = [...form.rubric];
    next[index] = { ...next[index], ...patch };
    update("rubric", next);
  }

  function addRubricRow(row?: { name: string; maxMarks: string }) {
    update("rubric", [
      ...form.rubric,
      row ?? { name: "", maxMarks: "" },
    ]);
  }

  function removeRubricRow(index: number) {
    update(
      "rubric",
      form.rubric.filter((_, i) => i !== index),
    );
  }

  const dockNote = !titleReady
    ? "Add a title of at least 3 characters to save."
    : briefId
      ? published
        ? isDirty
          ? "This brief is live. Saving will update what students see."
          : "This brief is live. Students can already select it."
        : isDirty
          ? "Saved as a draft until you publish."
          : "This brief is still private. Publish when students should see it."
      : "You can save now. Publish when students should see this brief.";

  const yearSelect = (
    <Select
      id="brief-year"
      value={form.courseYear}
      onChange={(e) => update("courseYear", e.target.value)}
    >
      <option value="">Select year…</option>
      {COURSE_YEAR_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
      {form.courseYear &&
      !COURSE_YEAR_OPTIONS.some((o) => o.value === form.courseYear) ? (
        <option value={form.courseYear}>{form.courseYear}</option>
      ) : null}
    </Select>
  );

  const actions = (
    <div className={wide ? "sv-brief-dock-actions" : "flex flex-wrap gap-2"}>
      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        {briefId ? "Save changes" : "Save as draft"}
      </Button>
      <Button
        type="button"
        variant={wide ? (briefId && published ? "outline" : "secondary") : "outline"}
        disabled={busy}
        onClick={(e) =>
          void onSubmit(e, briefId && published ? "draft" : "published")
        }
      >
        {briefId
          ? published
            ? "Unpublish"
            : "Publish"
          : "Publish to students"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={busy}
        onClick={() => router.push(returnHref)}
      >
        Cancel
      </Button>
    </div>
  );

  if (wide) {
    return (
      <form
        className="sv-brief-form"
        onSubmit={(e) => void onSubmit(e)}
        autoComplete="off"
      >
        {error ? (
          <p className="sv-brief-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="sv-brief-dock">
          <p className="sv-brief-dock-note">{dockNote}</p>
          {actions}
        </div>

        <div className="sv-brief-readiness" aria-label="Brief completeness">
          {readiness.map((item) => (
            <div
              key={item.id}
              className={cn("sv-brief-ready", item.done && "is-done")}
            >
              <span className="sv-brief-ready-mark" aria-hidden>
                {item.done ? <Check className="size-3.5" strokeWidth={2.5} /> : null}
              </span>
              <div>
                <p>{item.label}</p>
                <span>{item.caption}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="sv-brief-layout">
          <div className="sv-brief-main">
            <Section
              step="1"
              title="Assignment details"
              description="Name the brief and place it in a course so students can recognise it."
            >
              <div className="sv-brief-fields">
                <Field
                  label="Assignment title"
                  hint="Use the module code and task if you can — students see this first."
                  htmlFor="brief-title"
                  required
                  extra={
                    <span className="sv-brief-count">
                      {form.title.length}/300
                    </span>
                  }
                >
                  <Input
                    id="brief-title"
                    value={form.title}
                    onChange={(e) => update("title", e.target.value)}
                    maxLength={300}
                    placeholder="e.g. CSC 301 — Term paper on distributed systems"
                    required
                  />
                </Field>
                <div className="sv-brief-split">
                  <Field
                    label="Course"
                    hint="Optional. Helps students filter the right brief."
                    htmlFor="brief-course"
                  >
                    <Input
                      id="brief-course"
                      value={form.courseName}
                      onChange={(e) => update("courseName", e.target.value)}
                      maxLength={200}
                      placeholder="e.g. Computer Science"
                    />
                  </Field>
                  <Field
                    label="Year / level"
                    hint="Optional cohort or programme year."
                    htmlFor="brief-year"
                  >
                    {yearSelect}
                  </Field>
                </div>
              </div>
            </Section>

            <Section
              step="2"
              title="Instructions"
              description="Tell students what to write, how to structure it, and any constraints."
            >
              <Field
                label="What should students do?"
                hint="Cover the task, format, citation style, and anything that must not be missed."
                htmlFor="brief-instructions"
                extra={
                  <span className="sv-brief-count">
                    {instructionWords} {instructionWords === 1 ? "word" : "words"}
                  </span>
                }
              >
                <textarea
                  id="brief-instructions"
                  value={form.instructions}
                  onChange={(e) => update("instructions", e.target.value)}
                  rows={12}
                  maxLength={50_000}
                  placeholder="Describe the task, expected structure, citation style, and any constraints."
                  className="sv-brief-textarea"
                />
              </Field>
            </Section>

            <Section
              step="3"
              title="Required contents"
              description="Optional checklist of sections or items students should include."
            >
              <div className="sv-brief-list">
                {form.requiredItems.map((item, index) => (
                  <div key={index} className="sv-brief-list-row">
                    <span className="sv-brief-list-index" aria-hidden>
                      {index + 1}
                    </span>
                    <Input
                      value={item}
                      onChange={(e) => setRequiredItem(index, e.target.value)}
                      placeholder={`Item ${index + 1}`}
                      maxLength={300}
                      aria-label={`Required item ${index + 1}`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="sv-brief-icon-btn"
                      disabled={form.requiredItems.length <= 1 && !item.trim()}
                      onClick={() => removeRequiredItem(index)}
                      aria-label="Remove item"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="sv-brief-list-actions">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addRequiredItem()}
                >
                  <Plus className="size-4" />
                  Add item
                </Button>
              </div>
              <div className="sv-brief-chips" aria-label="Suggested sections">
                {REQUIRED_ITEM_SUGGESTIONS.map((suggestion) => {
                  const used = usedRequired.has(suggestion.toLowerCase());
                  return (
                    <button
                      key={suggestion}
                      type="button"
                      className={cn("sv-brief-chip", used && "is-used")}
                      disabled={used}
                      onClick={() => addRequiredItem(suggestion)}
                    >
                      {used ? <Check className="size-3" strokeWidth={2.5} /> : null}
                      {suggestion}
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section
              step="4"
              title="Deadline & length"
              description="Set when work is due and an optional word-count range."
            >
              <div className="sv-brief-fields">
                <div className="sv-brief-split">
                  <Field
                    label="Due date"
                    hint={
                      duePreview
                        ? `Students will see: ${duePreview}`
                        : "Leave blank if there is no fixed deadline."
                    }
                    htmlFor="brief-due"
                  >
                    <Input
                      id="brief-due"
                      type="datetime-local"
                      value={form.dueAt}
                      onChange={(e) => update("dueAt", e.target.value)}
                    />
                  </Field>
                  <div className="sv-brief-switch-card">
                    <div>
                      <p>Late submissions</p>
                      <span>
                        {form.allowLateSubmission
                          ? "Students can still submit after the due date"
                          : "Work after the due date will not be accepted"}
                      </span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-label="Allow late submissions"
                      aria-checked={form.allowLateSubmission}
                      className={cn(
                        "sv-brief-switch",
                        form.allowLateSubmission && "is-on",
                      )}
                      onClick={() =>
                        update("allowLateSubmission", !form.allowLateSubmission)
                      }
                    >
                      <span />
                    </button>
                  </div>
                </div>
                <div className="sv-brief-split">
                  <Field
                    label="Minimum words"
                    hint="Optional lower bound."
                    htmlFor="brief-min-words"
                  >
                    <Input
                      id="brief-min-words"
                      type="number"
                      min={0}
                      value={form.wordCountMin}
                      onChange={(e) => update("wordCountMin", e.target.value)}
                      placeholder="e.g. 1500"
                    />
                  </Field>
                  <Field
                    label="Maximum words"
                    hint="Optional upper bound."
                    htmlFor="brief-max-words"
                  >
                    <Input
                      id="brief-max-words"
                      type="number"
                      min={0}
                      value={form.wordCountMax}
                      onChange={(e) => update("wordCountMax", e.target.value)}
                      placeholder="e.g. 3000"
                    />
                  </Field>
                </div>
              </div>
            </Section>

            <Section
              step="5"
              title="Grading"
              description="Total marks and optional rubric criteria. If you add criteria, their marks must add up to the total."
            >
              <div className="sv-brief-fields">
                <Field
                  label="Total max score"
                  hint="The overall mark for this assignment."
                  htmlFor="brief-max-score"
                  required
                >
                  <Input
                    id="brief-max-score"
                    type="number"
                    min={1}
                    max={1000}
                    value={form.maxScore}
                    onChange={(e) => update("maxScore", e.target.value)}
                    required
                  />
                </Field>

                {rubricFilled ? (
                  <div
                    className="sv-brief-rubric-meter"
                    data-state={rubricAligned ? "ok" : "warn"}
                  >
                    <div className="sv-brief-rubric-meter-copy">
                      <p>
                        {rubricTotal} of {maxScore} marks allocated
                      </p>
                      <span>
                        {rubricAligned
                          ? "Criteria add up to the total score."
                          : `Adjust criteria so they total ${maxScore}.`}
                      </span>
                    </div>
                    <div className="sv-brief-meter" aria-hidden>
                      <span
                        style={{
                          width: `${Math.min(
                            100,
                            maxScore > 0 ? (rubricTotal / maxScore) * 100 : 0,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="sv-brief-list">
                  {form.rubric.map((row, index) => (
                    <div
                      key={index}
                      className="sv-brief-list-row is-rubric"
                    >
                      <span className="sv-brief-list-index" aria-hidden>
                        {index + 1}
                      </span>
                      <Input
                        value={row.name}
                        onChange={(e) =>
                          setRubricRow(index, { name: e.target.value })
                        }
                        placeholder="Criterion name"
                        maxLength={200}
                        aria-label={`Criterion ${index + 1} name`}
                      />
                      <Input
                        className="sv-brief-marks"
                        type="number"
                        min={0}
                        value={row.maxMarks}
                        onChange={(e) =>
                          setRubricRow(index, { maxMarks: e.target.value })
                        }
                        placeholder="Marks"
                        aria-label={`Criterion ${index + 1} marks`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="sv-brief-icon-btn"
                        onClick={() => removeRubricRow(index)}
                        aria-label="Remove criterion"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="sv-brief-list-actions">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addRubricRow()}
                  >
                    <Plus className="size-4" />
                    Add criterion
                  </Button>
                </div>
                <div className="sv-brief-chips" aria-label="Suggested criteria">
                  {RUBRIC_SUGGESTIONS.map((suggestion) => {
                    const used = usedRubric.has(suggestion.name.toLowerCase());
                    return (
                      <button
                        key={suggestion.name}
                        type="button"
                        className={cn("sv-brief-chip", used && "is-used")}
                        disabled={used}
                        onClick={() =>
                          addRubricRow({
                            name: suggestion.name,
                            maxMarks: suggestion.maxMarks,
                          })
                        }
                      >
                        {used ? (
                          <Check className="size-3" strokeWidth={2.5} />
                        ) : null}
                        {suggestion.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Section>
          </div>

          <aside className="sv-brief-aside">
            <section className="sv-brief-preview">
              <header>
                <span className="sv-brief-preview-kicker">
                  <Eye className="size-3.5" strokeWidth={2} />
                  Student view
                </span>
                <h2>How this brief will look</h2>
                <p>
                  Students see this when they select you as lecturer and open
                  the assignment.
                </p>
              </header>

              <div className="sv-brief-preview-card">
                <div className="sv-brief-preview-topline">
                  <p className="sv-brief-preview-title">
                    {form.title.trim() || "Untitled assignment"}
                  </p>
                  <span
                    className={cn(
                      "sv-brief-pill",
                      published ? "is-ok" : "is-mid",
                    )}
                  >
                    {published ? "Published" : "Draft"}
                  </span>
                </div>
                <p className="sv-brief-preview-meta">
                  {[form.courseName.trim(), form.courseYear.trim()]
                    .filter(Boolean)
                    .join(" · ") || "Course not set"}
                </p>

                <div className="sv-brief-preview-stats">
                  <div>
                    <span>Due</span>
                    <strong>{duePreview || "No deadline"}</strong>
                  </div>
                  <div>
                    <span>Marks</span>
                    <strong>{maxScore}</strong>
                  </div>
                  <div>
                    <span>Length</span>
                    <strong>
                      {wordRangePreview(form.wordCountMin, form.wordCountMax)}
                    </strong>
                  </div>
                </div>

                {form.instructions.trim() ? (
                  <p className="sv-brief-preview-body">
                    {form.instructions.trim().length > 280
                      ? `${form.instructions.trim().slice(0, 280).trim()}…`
                      : form.instructions.trim()}
                  </p>
                ) : (
                  <p className="sv-brief-preview-empty">
                    Instructions will appear here as you write them.
                  </p>
                )}

                {filledRequired.length > 0 ? (
                  <ul className="sv-brief-preview-list">
                    {filledRequired.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>

            <section className="sv-brief-note">
              <p>{published ? "Visible to students" : "Publishing"}</p>
              <span>
                {published
                  ? "Students can select this brief when they create an assignment. Unpublish to hide it without deleting."
                  : "Save as a draft while you finish the brief. Publish when students should be able to select it."}
              </span>
            </section>
          </aside>
        </div>
      </form>
    );
  }

  const requiredItemsCard = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Required contents</CardTitle>
        <CardDescription>
          Checklist of sections or items students should include.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {form.requiredItems.map((item, index) => (
          <div key={index} className="flex gap-2">
            <Input
              value={item}
              onChange={(e) => {
                const next = [...form.requiredItems];
                next[index] = e.target.value;
                update("requiredItems", next);
              }}
              placeholder={`Item ${index + 1}`}
              maxLength={300}
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={form.requiredItems.length <= 1}
              onClick={() =>
                update(
                  "requiredItems",
                  form.requiredItems.filter((_, i) => i !== index),
                )
              }
              aria-label="Remove item"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => update("requiredItems", [...form.requiredItems, ""])}
        >
          <Plus className="size-4" />
          Add item
        </Button>
      </CardContent>
    </Card>
  );

  const gradingCard = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Grading</CardTitle>
        <CardDescription>
          Total marks and optional rubric criteria (criteria marks must sum to
          total).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">Total max score</span>
          <Input
            type="number"
            min={1}
            max={1000}
            value={form.maxScore}
            onChange={(e) => update("maxScore", e.target.value)}
            required
          />
        </label>
        {form.rubric.map((row, index) => (
          <div key={index} className="flex flex-wrap gap-2">
            <Input
              className="min-w-[200px] flex-1"
              value={row.name}
              onChange={(e) => {
                const next = [...form.rubric];
                next[index] = { ...next[index], name: e.target.value };
                update("rubric", next);
              }}
              placeholder="Criterion name"
              maxLength={200}
            />
            <Input
              className="w-28"
              type="number"
              min={0}
              value={row.maxMarks}
              onChange={(e) => {
                const next = [...form.rubric];
                next[index] = { ...next[index], maxMarks: e.target.value };
                update("rubric", next);
              }}
              placeholder="Marks"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                update(
                  "rubric",
                  form.rubric.filter((_, i) => i !== index),
                )
              }
              aria-label="Remove criterion"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            update("rubric", [...form.rubric, { name: "", maxMarks: "" }])
          }
        >
          <Plus className="size-4" />
          Add criterion
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <form className="space-y-5" onSubmit={(e) => void onSubmit(e)}>
      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basics</CardTitle>
          <CardDescription>
            Title and course context students will see when they select this brief.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Title</span>
            <Input
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              maxLength={300}
              placeholder="e.g. CSC 301 — Term paper on distributed systems"
              required
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Course name</span>
              <Input
                value={form.courseName}
                onChange={(e) => update("courseName", e.target.value)}
                maxLength={200}
                placeholder="Optional"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Year / level</span>
              {yearSelect}
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Instructions</span>
            <textarea
              value={form.instructions}
              onChange={(e) => update("instructions", e.target.value)}
              rows={6}
              maxLength={50_000}
              placeholder="Describe what students should write, format, citation style, etc."
              className="box-border block w-full min-w-0 resize-y rounded-2xl border border-border bg-background px-3 py-2.5 text-sm outline-none ring-accent focus:ring-2"
            />
          </label>
        </CardContent>
      </Card>

      {requiredItemsCard}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Word count & deadline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Min words</span>
              <Input
                type="number"
                min={0}
                value={form.wordCountMin}
                onChange={(e) => update("wordCountMin", e.target.value)}
                placeholder="Optional"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Max words</span>
              <Input
                type="number"
                min={0}
                value={form.wordCountMax}
                onChange={(e) => update("wordCountMax", e.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Due date</span>
              <Input
                type="datetime-local"
                value={form.dueAt}
                onChange={(e) => update("dueAt", e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 pt-7 text-sm">
              <input
                type="checkbox"
                checked={form.allowLateSubmission}
                onChange={(e) =>
                  update("allowLateSubmission", e.target.checked)
                }
                className="size-4 rounded border-border"
              />
              Allow late submission
            </label>
          </div>
        </CardContent>
      </Card>

      {gradingCard}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visibility</CardTitle>
          <CardDescription>
            Published briefs appear when students create an assignment and select
            you as lecturer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="block max-w-xs space-y-1.5">
            <span className="text-sm font-semibold">Status</span>
            <Select
              value={form.status}
              onChange={(e) =>
                update("status", e.target.value as "draft" | "published")
              }
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </Select>
          </label>
        </CardContent>
      </Card>

      {actions}
    </form>
  );
}
