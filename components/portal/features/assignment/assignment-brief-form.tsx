"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
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

  const yearSelect = (
    <Select
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

  const actions = (
    <div className={wide ? "portal-brief-actions" : "flex flex-wrap gap-2"}>
      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : null}
        {briefId ? "Save changes" : "Create brief"}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={(e) => void onSubmit(e, "published")}
      >
        {briefId ? "Save & publish" : "Create & publish"}
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
      <form className="portal-brief-form" onSubmit={(e) => void onSubmit(e)}>
        {error && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="portal-brief-grid">
          <div className="portal-brief-col">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Brief</CardTitle>
                <CardDescription>
                  Title and instructions students will see when they open this
                  assignment.
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
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">Instructions</span>
                  <textarea
                    value={form.instructions}
                    onChange={(e) => update("instructions", e.target.value)}
                    rows={14}
                    maxLength={50_000}
                    placeholder="Describe what students should write, format, citation style, and any constraints."
                    className="portal-brief-textarea"
                  />
                </label>
              </CardContent>
            </Card>
            {requiredItemsCard}
          </div>

          <div className="portal-brief-col">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Course & schedule</CardTitle>
                <CardDescription>
                  Who this brief is for, and when it is due.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold">Due date</span>
                  <Input
                    type="datetime-local"
                    value={form.dueAt}
                    onChange={(e) => update("dueAt", e.target.value)}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
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
              </CardContent>
            </Card>
            {gradingCard}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Visibility</CardTitle>
                <CardDescription>
                  Published briefs appear when students create an assignment and
                  select you as lecturer.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <label className="block space-y-1.5">
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
          </div>
        </div>
        {actions}
      </form>
    );
  }

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
