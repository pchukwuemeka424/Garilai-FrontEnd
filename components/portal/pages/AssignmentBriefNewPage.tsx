"use client";

import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { AssignmentBriefForm } from "@/components/portal/features/assignment/assignment-brief-form";

export default function NewAssignmentBriefPage() {
  return (
    <div className="portal-brief-page">
      <header className="portal-brief-toolbar">
        <div className="portal-brief-toolbar-copy">
          <Link href="/assignments" className="portal-brief-back">
            <ArrowLeft className="size-4" />
            Back to assignments
          </Link>
          <div className="portal-brief-title-row">
            <span className="portal-brief-icon" aria-hidden>
              <ClipboardList className="size-5" strokeWidth={1.75} />
            </span>
            <div>
              <p className="portal-brief-kicker">Lecturer · New brief</p>
              <h1 className="portal-brief-title">Create assignment</h1>
            </div>
          </div>
          <p className="portal-brief-lead">
            Write the brief students will follow — instructions, required
            sections, word count, deadline, and how you will mark the work.
          </p>
        </div>
      </header>
      <AssignmentBriefForm layout="wide" />
    </div>
  );
}
