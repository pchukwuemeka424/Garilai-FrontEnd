"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/portal/ui/button";
import { apiFetch } from "@/lib/portal-api";
import { countWordsFromHtml } from "@/components/portal/editor/document-editor";
import {
  projectAdvisorNoun,
  projectWritingUnitNoun,
} from "@/lib/portal/project-types";

const MAX_CHAPTER_NUMBER = 20;

type ApiChapter = {
  _id: string;
  number: number;
  title: string;
  status: string;
  locked?: boolean;
  rejectionReason?: string;
  currentVersionId?: string;
};

export type ChapterGate = {
  /** True while pending review or after approval — editor + submit stay locked. */
  locked: boolean;
  reason: string | null;
  canSubmit: boolean;
};

type Props = {
  projectId: string;
  /** Current writing page id — remount/gate sync key. */
  pageId?: string;
  /** 0-based page order; used to pick a free chapter number when title is new. */
  pageOrder?: number;
  pageTitle?: string;
  pageHtml?: string;
  /** Drives "chapter" vs "assignment" action labels. */
  projectType?: string | null;
  /** Supervisor remark mirrored onto the writing page (if any). */
  reviewRemark?: string;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
  onRefresh?: () => void;
  onGateChange?: (gate: ChapterGate) => void;
  /** Notifies the parent when supervisor feedback text is available. */
  onFeedbackChange?: (remark: string | null) => void;
};

function normalizeTitle(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function isRejectedStatus(status: string) {
  return status === "rejected" || status === "needs_revision";
}

function isPendingReviewStatus(status: string) {
  return status === "submitted" || status === "under_review";
}

function isApprovedStatus(status: string) {
  return status === "approved" || status === "locked";
}

/** Next free chapter number (1–20), preferring page order when free. */
function resolveChapterNumber(
  chapters: ApiChapter[],
  pageOrder: number | undefined,
): number | null {
  const used = new Set(chapters.map((c) => c.number));
  const preferred =
    pageOrder != null && pageOrder >= 0 ? pageOrder + 1 : null;
  if (
    preferred != null &&
    preferred >= 1 &&
    preferred <= MAX_CHAPTER_NUMBER &&
    !used.has(preferred)
  ) {
    return preferred;
  }
  for (let n = 1; n <= MAX_CHAPTER_NUMBER; n++) {
    if (!used.has(n)) return n;
  }
  return null;
}

/**
 * Gate applies only to the chapter matched by this page's title.
 * Other chapters' pending/approved state must not block this page.
 */
function resolveGate(
  studentTitle: string,
  chapters: ApiChapter[],
  assignableNumber: number | null,
  unitNoun: string,
  advisorNoun: string,
): ChapterGate {
  const title = studentTitle.trim();
  if (!title) {
    return { locked: false, reason: null, canSubmit: false };
  }

  // Strict title match only — never inherit another chapter's review lock.
  const existing = chapters.find(
    (c) => normalizeTitle(c.title) === normalizeTitle(title),
  );

  if (existing) {
    if (isApprovedStatus(existing.status)) {
      return {
        locked: true,
        reason: `This ${unitNoun} has been approved and is now locked.`,
        canSubmit: false,
      };
    }
    if (isPendingReviewStatus(existing.status)) {
      return {
        locked: true,
        reason: `This ${unitNoun} is pending ${advisorNoun} review. Editing and submission are unavailable until a decision is made.`,
        canSubmit: false,
      };
    }
    return { locked: false, reason: null, canSubmit: true };
  }

  if (assignableNumber == null) {
    return {
      locked: false,
      reason: `All ${unitNoun} slots are in use. Rename this page to match an existing draft ${unitNoun}, or remove an unused ${unitNoun}.`,
      canSubmit: false,
    };
  }
  return { locked: false, reason: null, canSubmit: true };
}

export function ProjectChapterPanel({
  projectId,
  pageId,
  pageOrder,
  pageTitle,
  pageHtml,
  projectType,
  reviewRemark,
  onMessage,
  onError,
  onRefresh,
  onGateChange,
  onFeedbackChange,
}: Props) {
  const unitNoun = projectWritingUnitNoun(projectType);
  const advisorNoun = projectAdvisorNoun(projectType);
  const [chapters, setChapters] = useState<ApiChapter[]>([]);
  const [busy, setBusy] = useState(false);

  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const onRefreshRef = useRef(onRefresh);
  const onGateChangeRef = useRef(onGateChange);
  const onFeedbackChangeRef = useRef(onFeedbackChange);
  onMessageRef.current = onMessage;
  onErrorRef.current = onError;
  onRefreshRef.current = onRefresh;
  onGateChangeRef.current = onGateChange;
  onFeedbackChangeRef.current = onFeedbackChange;

  const load = useCallback(async () => {
    try {
      const data = (await apiFetch(
        `/api/v1/projects/${projectId}/chapters`,
      )) as ApiChapter[];
      setChapters(data);
    } catch (err) {
      onErrorRef.current?.(
        err instanceof Error ? err.message : `Could not load ${unitNoun}s`,
      );
    }
  }, [projectId, unitNoun]);

  useEffect(() => {
    void load();
  }, [load]);

  // Re-fetch when switching pages so status stays accurate.
  useEffect(() => {
    if (!pageId) return;
    void load();
  }, [pageId, load]);

  const studentTitle = (pageTitle || "").trim();
  const assignableNumber = useMemo(
    () => resolveChapterNumber(chapters, pageOrder),
    [chapters, pageOrder],
  );

  const matchedChapter = useMemo(
    () =>
      chapters.find(
        (c) => normalizeTitle(c.title) === normalizeTitle(studentTitle),
      ) ?? null,
    [chapters, studentTitle],
  );

  const gate = useMemo(
    () =>
      resolveGate(
        studentTitle,
        chapters,
        assignableNumber,
        unitNoun,
        advisorNoun,
      ),
    [studentTitle, chapters, assignableNumber, unitNoun, advisorNoun],
  );

  const isResubmit = Boolean(
    matchedChapter && isRejectedStatus(matchedChapter.status),
  );

  const feedbackText =
    reviewRemark?.trim() || matchedChapter?.rejectionReason?.trim() || "";

  // Always push gate to parent when page or gate changes (avoid stale lock).
  useEffect(() => {
    onGateChangeRef.current?.(gate);
  }, [gate, pageId, studentTitle]);

  useEffect(() => {
    onFeedbackChangeRef.current?.(feedbackText || null);
  }, [feedbackText, pageId]);

  async function submitCurrentPage() {
    const html = (pageHtml || "").trim();
    if (!html) {
      onErrorRef.current?.(
        `Save and write ${unitNoun} content before submitting`,
      );
      return;
    }
    if (!studentTitle) {
      onErrorRef.current?.(`Set a ${unitNoun} title before submitting`);
      return;
    }
    if (!gate.canSubmit) {
      onErrorRef.current?.(
        gate.reason || `This ${unitNoun} cannot be submitted yet`,
      );
      return;
    }

    let chapterNumber: number;
    if (matchedChapter) {
      chapterNumber = matchedChapter.number;
    } else if (assignableNumber != null) {
      chapterNumber = assignableNumber;
    } else {
      onErrorRef.current?.(`All ${unitNoun} slots are in use`);
      return;
    }

    setBusy(true);
    try {
      await apiFetch(`/api/v1/projects/${projectId}/chapters/submit-from-page`, {
        method: "POST",
        body: JSON.stringify({
          chapterNumber,
          title: studentTitle,
          html,
          wordCount: countWordsFromHtml(html),
        }),
      });
      onMessageRef.current?.(
        isResubmit
          ? `“${studentTitle}” re-submitted for review`
          : `“${studentTitle}” submitted for review`,
      );
      await load();
      onRefreshRef.current?.();
    } catch (err) {
      onErrorRef.current?.(
        err instanceof Error ? err.message : "Submit failed",
      );
    } finally {
      setBusy(false);
    }
  }

  const submitLabel = busy
    ? isResubmit
      ? "Re-submitting…"
      : "Submitting…"
    : isResubmit
      ? "Re Submit"
      : `Submit ${unitNoun}`;

  return (
    <Button
      type="button"
      disabled={busy || !studentTitle || !gate.canSubmit}
      title={
        !gate.canSubmit && gate.reason
          ? gate.reason
          : isResubmit
            ? `Re-submit this ${unitNoun} for ${advisorNoun} review`
            : `Submit this ${unitNoun} for ${advisorNoun} review`
      }
      onClick={() => void submitCurrentPage()}
    >
      <Send className="size-4" />
      {submitLabel}
    </Button>
  );
}
