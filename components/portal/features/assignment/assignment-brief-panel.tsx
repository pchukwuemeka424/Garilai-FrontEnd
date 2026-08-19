"use client";

import { CheckSquare, FileText, Target } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/portal/ui/card";
import { AssignmentInstructions } from "@/components/portal/features/assignment/assignment-instructions";
import { assignmentInstructionsToText } from "@/lib/portal/assignment-instructions";
import { cn } from "@/lib/portal/cn";

export type AssignmentBriefView = {
  _id?: string;
  title?: string;
  instructions?: string;
  requiredItems?: string[];
  wordCountMin?: number | null;
  wordCountMax?: number | null;
  maxScore?: number;
  rubric?: Array<{ name: string; maxMarks: number }>;
  dueAt?: string | null;
  allowLateSubmission?: boolean;
  courseName?: string;
  courseYear?: string;
  status?: string;
};

function wordCountLabel(brief: AssignmentBriefView) {
  const min =
    typeof brief.wordCountMin === "number" ? brief.wordCountMin : null;
  const max =
    typeof brief.wordCountMax === "number" ? brief.wordCountMax : null;
  if (min != null && max != null) return `${min.toLocaleString()}–${max.toLocaleString()} words`;
  if (min != null) return `At least ${min.toLocaleString()} words`;
  if (max != null) return `Up to ${max.toLocaleString()} words`;
  return null;
}

export function formatWordCountTarget(brief: AssignmentBriefView | null | undefined) {
  if (!brief) return null;
  return wordCountLabel(brief);
}

type Props = {
  brief: AssignmentBriefView;
  className?: string;
  compact?: boolean;
  /** Hide the card title row (e.g. when shown inside a titled modal). */
  hideHeader?: boolean;
  /** Current draft word count for target comparison */
  currentWordCount?: number;
};

export function AssignmentBriefPanel({
  brief,
  className,
  compact,
  hideHeader,
  currentWordCount,
}: Props) {
  const target = wordCountLabel(brief);
  const items = (brief.requiredItems || []).filter((i) => i.trim());
  const rubric = brief.rubric || [];
  const maxScore =
    typeof brief.maxScore === "number" && brief.maxScore > 0
      ? brief.maxScore
      : 100;

  const wordHint =
    typeof currentWordCount === "number" && target
      ? (() => {
          const min =
            typeof brief.wordCountMin === "number" ? brief.wordCountMin : null;
          const max =
            typeof brief.wordCountMax === "number" ? brief.wordCountMax : null;
          let status: "ok" | "low" | "high" = "ok";
          if (min != null && currentWordCount < min) status = "low";
          if (max != null && currentWordCount > max) status = "high";
          return { status, current: currentWordCount };
        })()
      : null;

  return (
    <Card className={cn("rounded-xl shadow-sm", className)}>
      {!hideHeader ? (
        <CardHeader className={compact ? "pb-3" : undefined}>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4 text-accent" />
            Assignment brief
          </CardTitle>
          <CardDescription>
            {brief.title || "Lecturer instructions and requirements"}
          </CardDescription>
        </CardHeader>
      ) : brief.title ? (
        <CardHeader className="pb-2 pt-0">
          <CardDescription className="text-sm font-semibold text-foreground">
            {brief.title}
          </CardDescription>
        </CardHeader>
      ) : null}
      <CardContent className="space-y-4">
        {(brief.courseName || brief.courseYear) && (
          <p className="text-sm text-foreground/60">
            {[brief.courseName, brief.courseYear].filter(Boolean).join(" · ")}
          </p>
        )}

        {assignmentInstructionsToText(brief.instructions || "") ? (
          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wide text-foreground/45">
              Instructions
            </p>
            <div className="rounded-xl border border-border bg-muted/20 px-3.5 py-3">
              <AssignmentInstructions value={brief.instructions || ""} />
            </div>
          </div>
        ) : null}

        {items.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-foreground/45">
              <CheckSquare className="size-3.5" />
              Must include
            </p>
            <ul className="space-y-1.5">
              {items.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-sm text-foreground/75"
                >
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-3 text-sm">
          {target && (
            <div className="rounded-lg border border-border bg-background px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-foreground/45">
                Word count
              </p>
              <p className="mt-0.5 font-semibold">{target}</p>
              {wordHint && (
                <p
                  className={cn(
                    "mt-0.5 text-xs",
                    wordHint.status === "ok" && "text-emerald-700",
                    wordHint.status === "low" && "text-amber-700",
                    wordHint.status === "high" && "text-danger",
                  )}
                >
                  Yours: {wordHint.current.toLocaleString()}
                  {wordHint.status === "low"
                    ? " (below min)"
                    : wordHint.status === "high"
                      ? " (above max)"
                      : " (on target)"}
                </p>
              )}
            </div>
          )}
          <div className="rounded-lg border border-border bg-background px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-foreground/45">
              Total marks
            </p>
            <p className="mt-0.5 font-semibold">{maxScore}</p>
          </div>
          {brief.dueAt && (
            <div className="rounded-lg border border-border bg-background px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-foreground/45">
                Due
              </p>
              <p className="mt-0.5 font-semibold">
                {new Date(brief.dueAt).toLocaleString()}
              </p>
              {brief.allowLateSubmission === false && (
                <p className="mt-0.5 text-xs text-amber-700">Late not allowed</p>
              )}
            </div>
          )}
        </div>

        {rubric.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-foreground/45">
              <Target className="size-3.5" />
              Grading criteria
            </p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {rubric.map((row) => (
                <li
                  key={row.name}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm"
                >
                  <span className="text-foreground/80">{row.name}</span>
                  <span className="shrink-0 font-semibold text-foreground/55">
                    {row.maxMarks} marks
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
