"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AssignmentBriefForm } from "@/components/portal/features/assignment/assignment-brief-form";

function NewAssignmentBriefInner() {
  const searchParams = useSearchParams();
  const returnParam = searchParams.get("return");
  const returnHref =
    returnParam && returnParam.startsWith("/") && !returnParam.startsWith("//")
      ? returnParam
      : "/supervision/assignments";

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
            <span className="sv-brief-meta-count">Drafts stay private until you publish</span>
          </div>
          <h1>Create assignment</h1>
          <p>
            Write the brief students will follow — title, instructions, and
            deadline.
          </p>
        </div>
      </header>

      <AssignmentBriefForm layout="wide" returnHref={returnHref} />
    </div>
  );
}

export default function NewAssignmentBriefPage() {
  return (
    <Suspense fallback={<div className="sv-brief" aria-busy="true" />}>
      <NewAssignmentBriefInner />
    </Suspense>
  );
}
