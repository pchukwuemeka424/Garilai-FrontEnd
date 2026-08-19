"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/portal/ui/badge";
import { EmptyState } from "@/components/portal/feedback/empty-state";
import { LoadingPage } from "@/components/portal/feedback/loading-page";
import { apiFetch } from "@/lib/portal-api";

type PendingReview = {
  _id: string;
  title: string;
  number: number;
  status: string;
  projectTitle: string;
  student: { id: string; name: string; email: string } | null;
};

export default function SupervisorReviewsPage() {
  const [pending, setPending] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const list = (await apiFetch(
          "/api/v1/supervisor/reviews",
        )) as PendingReview[];
        if (!cancelled) setPending(list);
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

  if (loading) return <LoadingPage label="Loading review queue…" />;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">
          Lecturer · Reviews
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold">Pending reviews</h1>
        <p className="mt-1 text-foreground/60">
          Open a submission to approve, request revision, or comment.
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {pending.length === 0 ? (
        <EmptyState
          title="No pending reviews"
          description="Chapter submissions from research supervisees appear here. Coursework submissions are under Assignments."
          action="Open assignments"
          href="/assignments"
        />
      ) : (
        <ul className="space-y-3">
          {pending.map((item) => (
            <li key={item._id}>
              <Link
                href={`/reviews/${item._id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-4 transition hover:border-accent/40 hover:bg-accent/5"
              >
                <div>
                  <p className="font-semibold">
                    Ch.{item.number} · {item.title}
                  </p>
                  <p className="text-sm text-foreground/55">
                    {item.student?.name || "Student"} · {item.projectTitle}
                  </p>
                </div>
                <Badge variant="warning">{item.status}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
