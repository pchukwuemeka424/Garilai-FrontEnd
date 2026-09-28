"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, FileSearch } from "lucide-react";
import { Skeleton } from "@/components/portal/ui/skeleton";
import { Button } from "@/components/portal/ui/button";
import {
  AssignmentBriefForm,
  briefToForm,
  type BriefFormValues,
} from "@/components/portal/features/assignment/assignment-brief-form";
import { apiFetch } from "@/lib/portal-api";
import { cn } from "@/lib/portal/cn";

function safeReturnHref(value: string | null, fallback: string) {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return fallback;
}

function EditBriefSkeleton() {
  return (
    <div className="sv-brief" aria-busy="true">
      <Skeleton className="h-4 w-28 rounded-md" />
      <div className="sv-brief-hero">
        <div className="sv-brief-hero-copy space-y-3">
          <Skeleton className="h-5 w-40 rounded-md" />
          <Skeleton className="h-8 w-64 rounded-md" />
          <Skeleton className="h-4 w-80 max-w-full rounded-md" />
        </div>
      </div>
      <div className="sv-brief-dock">
        <Skeleton className="h-4 w-64 max-w-full rounded-md" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-32 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-24 rounded-full" />
        </div>
      </div>
      <div className="sv-brief-readiness">
        <Skeleton className="h-[4.25rem] rounded-2xl" />
        <Skeleton className="h-[4.25rem] rounded-2xl" />
        <Skeleton className="h-[4.25rem] rounded-2xl" />
      </div>
      <div className="sv-brief-layout">
        <Skeleton className="min-h-[28rem] rounded-2xl" />
        <Skeleton className="min-h-[22rem] rounded-2xl" />
      </div>
    </div>
  );
}

function EditAssignmentBriefInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const detailHref = `/assignments/${params.id}`;
  const returnHref = safeReturnHref(searchParams.get("return"), detailHref);
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

  if (loading) return <EditBriefSkeleton />;

  if (!initial) {
    return (
      <div className="sv-brief">
        <Link href={returnHref} className="sv-brief-back">
          <ArrowLeft className="size-4" />
          Assignments
        </Link>
        <div className="sv-brief-empty">
          <span className="sv-projects-empty-icon" aria-hidden>
            <FileSearch className="size-6" strokeWidth={1.75} />
          </span>
          <h2>Brief not found</h2>
          <p>
            {error ||
              "This assignment brief could not be loaded. It may have been deleted, or you may not have access."}
          </p>
          <Button asChild>
            <Link href={returnHref}>Back to assignments</Link>
          </Button>
        </div>
      </div>
    );
  }

  const published = initial.status === "published";

  return (
    <div className="sv-brief">
      <Link href={returnHref} className="sv-brief-back">
        <ArrowLeft className="size-4" />
        Assignments
      </Link>

      <header className="sv-brief-hero">
        <div className="sv-brief-hero-copy">
          <div className="sv-brief-meta">
            <span className="sv-brief-badge">Supervision</span>
            <span
              className={cn("sv-brief-pill", published ? "is-ok" : "is-mid")}
            >
              {published ? "Published" : "Draft"}
            </span>
            <span className="sv-brief-meta-count">
              {published
                ? "Visible to students"
                : "Hidden until you publish"}
            </span>
          </div>
          <h1>Edit assignment</h1>
          <p>{title}</p>
        </div>
      </header>

      {error ? (
        <p className="sv-brief-error" role="alert">
          {error}
        </p>
      ) : null}

      <AssignmentBriefForm
        initial={initial}
        briefId={params.id}
        returnHref={returnHref}
        layout="wide"
      />
    </div>
  );
}

export default function EditAssignmentBriefPage() {
  return (
    <Suspense fallback={<EditBriefSkeleton />}>
      <EditAssignmentBriefInner />
    </Suspense>
  );
}
