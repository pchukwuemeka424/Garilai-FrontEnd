"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EmptyState } from "@/components/portal/feedback/empty-state";
import { LoadingPage } from "@/components/portal/feedback/loading-page";
import {
  AssignmentBriefForm,
  briefToForm,
  type BriefFormValues,
} from "@/components/portal/features/assignment/assignment-brief-form";
import { apiFetch } from "@/lib/portal-api";

export default function EditAssignmentBriefPage() {
  const params = useParams<{ id: string }>();
  const detailHref = `/assignments/${params.id}`;
  const [initial, setInitial] = useState<BriefFormValues | null>(null);
  const [title, setTitle] = useState("Assignment");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const brief = (await apiFetch(
          `/api/v1/assignment-briefs/${params.id}`,
        )) as Record<string, unknown>;
        if (!cancelled) {
          setInitial(briefToForm(brief));
          setTitle(String(brief.title || "Assignment"));
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

  if (loading) return <LoadingPage label="Loading brief…" />;

  if (!initial) {
    return (
      <EmptyState
        title="Brief not found"
        description={error || "This assignment brief could not be loaded."}
        action="Assignments"
        href="/assignments"
      />
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={detailHref}
        className="inline-flex items-center gap-2 text-sm font-semibold text-foreground/60 hover:text-accent"
      >
        <ArrowLeft className="size-4" />
        Back to brief
      </Link>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
          Lecturer · Edit brief
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold">Edit assignment</h1>
        <p className="mt-1 text-foreground/60">
          Update instructions, required contents, word count, and grading for{" "}
          <span className="font-medium text-foreground/80">{title}</span>.
        </p>
      </div>
      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <AssignmentBriefForm
        initial={initial}
        briefId={params.id}
        returnHref={detailHref}
      />
    </div>
  );
}
