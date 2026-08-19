"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  MessageSquareText,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/portal/ui/button";
import { Input } from "@/components/portal/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/portal/ui/card";
import { EmptyState } from "@/components/portal/feedback/empty-state";
import { LoadingPage } from "@/components/portal/feedback/loading-page";
import { apiFetch, apiUpload } from "@/lib/portal-api";
import {
  DocumentEditor,
  countWordsFromHtml,
} from "@/components/portal/editor/document-editor";
import { ProjectChapterPanel } from "@/components/portal/features/chapters/project-chapter-panel";
import { countRemarkComments } from "@/components/portal/features/chapters/chapter-timeline";
import { RemarkHtml } from "@/components/portal/editor/remark-html";
import {
  isSinglePageProjectType,
  projectAdvisorLabel,
  projectAdvisorNoun,
  projectWritingUnitLabel,
  projectWritingUnitNoun,
  projectWritingUnitTitleLabel,
} from "@/lib/portal/project-types";
import { AssignmentBriefPanel } from "@/components/portal/features/assignment/assignment-brief-panel";
import type { AssignmentBriefView } from "@/components/portal/features/assignment/assignment-brief-panel";
import { cn } from "@/lib/portal/cn";

const AUTO_SAVE_MS = 1500;

type ProjectPage = {
  _id: string;
  title: string;
  content?: string;
  order?: number;
  reviewStatus?: "none" | "approved" | "needs_revision";
  reviewRemark?: string;
  reviewAnnotatedHtml?: string;
};

type Project = {
  _id: string;
  title: string;
  projectType?: string;
  pages?: ProjectPage[];
  score?: number | null;
  scoreNote?: string;
  scoredAt?: string | null;
  criterionScores?: Array<{ name: string; score: number; maxMarks: number }>;
  assignmentBrief?: AssignmentBriefView | null;
};

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export default function StudentChapterEditorPage() {
  const params = useParams<{ id: string; pageId: string }>();
  const router = useRouter();
  const projectId = params.id;
  const pageId = params.pageId;

  const [project, setProject] = useState<Project | null>(null);
  const [pages, setPages] = useState<ProjectPage[]>([]);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Submit-only workflow hint (never blocks the editor). */
  const [submitHint, setSubmitHint] = useState<string | null>(null);
  /** True while pending review or approved — editor + save locked. */
  const [editorLocked, setEditorLocked] = useState(false);
  /** Chapter rejection reason when the page mirror has no remark yet. */
  const [chapterFeedback, setChapterFeedback] = useState<string | null>(null);
  const [reuploading, setReuploading] = useState(false);
  const [briefModalOpen, setBriefModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);

  const lastSavedRef = useRef({ title: "", content: "" });
  const draftRef = useRef({ title: "", content: "" });
  const saveInFlightRef = useRef(false);
  const skipAutoSaveRef = useRef(true);
  const readyRef = useRef(false);
  const reuploadInputRef = useRef<HTMLInputElement>(null);

  const activePage = useMemo(
    () => pages.find((p) => p._id === pageId) ?? null,
    [pages, pageId],
  );

  const pageIndex = useMemo(
    () => pages.findIndex((p) => p._id === pageId),
    [pages, pageId],
  );

  const prevPage = pageIndex > 0 ? pages[pageIndex - 1] : null;
  const nextPage =
    pageIndex >= 0 && pageIndex < pages.length - 1
      ? pages[pageIndex + 1]
      : null;

  draftRef.current = { title: draftTitle, content: draftContent };

  const unitNoun = projectWritingUnitNoun(project?.projectType);
  const unitLabel = projectWritingUnitLabel(project?.projectType);
  const unitTitleLabel = projectWritingUnitTitleLabel(project?.projectType);
  const singlePage = isSinglePageProjectType(project?.projectType);
  const advisorNoun = projectAdvisorNoun(project?.projectType);
  const advisorLabel = projectAdvisorLabel(project?.projectType);
  // Empty seed page / blank editor → Upload; typed or imported content → Reupload.
  const hasWritingContent = countWordsFromHtml(draftContent) > 0;
  const uploadButtonLabel = hasWritingContent
    ? `Reupload ${unitNoun}`
    : `Upload ${unitNoun}`;

  function applyProject(data: Project, opts?: { resetDraft?: boolean }) {
    const nextPages = [...(data.pages || [])].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
    setProject(data);
    setPages(nextPages);
    if (opts?.resetDraft === false) return;
    const selected = nextPages.find((p) => p._id === pageId) ?? null;
    const title = selected?.title || "";
    const content = selected?.content || "";
    setDraftTitle(title);
    setDraftContent(content);
    lastSavedRef.current = { title, content };
    draftRef.current = { title, content };
    setSaveStatus("idle");
  }

  const load = useCallback(async () => {
    const data = (await apiFetch(
      `/api/v1/projects/${projectId}`,
    )) as Project;
    applyProject(data);
  }, [projectId, pageId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setChapterFeedback(null);
    setEditorLocked(false);
    setSubmitHint(null);
    setError(null);
    setMessage(null);
    // Clear previous chapter immediately so its pending lock cannot stick.
    setDraftTitle("");
    setDraftContent("");
    lastSavedRef.current = { title: "", content: "" };
    draftRef.current = { title: "", content: "" };
    skipAutoSaveRef.current = true;
    readyRef.current = false;
    apiFetch(`/api/v1/projects/${projectId}`)
      .then((data) => {
        if (cancelled) return;
        const loaded = data as Project;
        applyProject(loaded);
        const exists = loaded.pages?.some((p) => p._id === pageId);
        if (!exists) {
          setError(
            `${projectWritingUnitLabel(loaded.projectType)} not found in this project`,
          );
        }
        readyRef.current = true;
        // Allow TipTap initial sync before treating edits as dirty
        window.setTimeout(() => {
          if (!cancelled) skipAutoSaveRef.current = false;
        }, 400);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, pageId]);

  const savePage = useCallback(
    async (opts?: { manual?: boolean }) => {
      if (!activePage || saveInFlightRef.current) return false;
      if (editorLocked) {
        if (opts?.manual) {
          setError(
            `This ${unitNoun} cannot be edited while it is pending ${advisorNoun} review.`,
          );
        }
        return false;
      }

      const title = draftRef.current.title.trim();
      const content = draftRef.current.content;
      if (!title) {
        if (opts?.manual) setError(`${unitTitleLabel} is required`);
        return false;
      }

      const last = lastSavedRef.current;
      if (title === last.title.trim() && content === last.content) {
        if (opts?.manual) setSaveStatus("saved");
        return true;
      }

      saveInFlightRef.current = true;
      setSaveStatus("saving");
      if (opts?.manual) {
        setMessage(null);
        setError(null);
      }

      try {
        const updated = (await apiFetch(
          `/api/v1/projects/${projectId}/pages/${activePage._id}`,
          {
            method: "PUT",
            body: JSON.stringify({ title, content }),
          },
        )) as Project;
        lastSavedRef.current = { title, content };
        applyProject(updated, { resetDraft: false });
        setSaveStatus("saved");
        if (opts?.manual) setMessage("Saved");
        return true;
      } catch (err) {
        setSaveStatus("error");
        setError(err instanceof Error ? err.message : "Save failed");
        return false;
      } finally {
        saveInFlightRef.current = false;
      }
    },
    [activePage, projectId, pageId, editorLocked, unitNoun, unitTitleLabel, advisorNoun],
  );

  // Debounced auto-save while editing
  useEffect(() => {
    if (loading || !readyRef.current || skipAutoSaveRef.current) return;
    if (!activePage || editorLocked) return;

    const title = draftTitle.trim();
    const last = lastSavedRef.current;
    if (!title) return;
    if (title === last.title.trim() && draftContent === last.content) {
      setSaveStatus((s) => (s === "saving" ? s : "saved"));
      return;
    }

    setSaveStatus("dirty");
    const timer = window.setTimeout(() => {
      void savePage();
    }, AUTO_SAVE_MS);

    return () => window.clearTimeout(timer);
  }, [draftTitle, draftContent, loading, activePage, savePage, editorLocked]);

  // Flush pending edits when leaving the chapter / tab
  useEffect(() => {
    function flushIfDirty() {
      if (skipAutoSaveRef.current || editorLocked) return;
      const title = draftRef.current.title.trim();
      const last = lastSavedRef.current;
      if (
        !title ||
        (title === last.title.trim() &&
          draftRef.current.content === last.content)
      ) {
        return;
      }
      void savePage();
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") flushIfDirty();
    }

    window.addEventListener("beforeunload", flushIfDirty);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      flushIfDirty();
      window.removeEventListener("beforeunload", flushIfDirty);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [savePage, editorLocked]);

  useEffect(() => {
    if (!briefModalOpen && !feedbackModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (feedbackModalOpen) setFeedbackModalOpen(false);
      else if (briefModalOpen) setBriefModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [briefModalOpen, feedbackModalOpen]);

  async function deletePage() {
    if (!activePage || editorLocked) return;
    if (!window.confirm(`Delete “${activePage.title}”?`)) return;
    skipAutoSaveRef.current = true;
    setSaveStatus("saving");
    setMessage(null);
    setError(null);
    try {
      await apiFetch(`/api/v1/projects/${projectId}/pages/${activePage._id}`, {
        method: "DELETE",
      });
      router.push(`/student/projects/${projectId}`);
    } catch (err) {
      skipAutoSaveRef.current = false;
      setSaveStatus("error");
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function onReuploadDocument(file: File) {
    if (!singlePage || editorLocked) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".docx") && !lower.endsWith(".pdf")) {
      setError("Please upload a .docx Word document or PDF");
      return;
    }
    const ok = window.confirm(
      `Replace the content on this ${unitNoun} with the uploaded document? Unsaved edits will be lost.`,
    );
    if (!ok) {
      if (reuploadInputRef.current) reuploadInputRef.current.value = "";
      return;
    }

    skipAutoSaveRef.current = true;
    setReuploading(true);
    setMessage(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", "replace");
      const result = (await apiUpload(
        `/api/v1/projects/${projectId}/import-document`,
        formData,
      )) as {
        project: Project;
        import: { fileName: string };
      };
      const nextPages = [...(result.project.pages || [])].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0),
      );
      const nextPage = nextPages[0];
      if (nextPage && nextPage._id !== pageId) {
        setMessage(
          `Reuploaded “${result.import.fileName}”. Opening updated ${unitNoun}…`,
        );
        router.replace(
          `/student/projects/${projectId}/pages/${nextPage._id}`,
        );
        return;
      }
      applyProject(result.project);
      skipAutoSaveRef.current = false;
      setMessage(`Reuploaded “${result.import.fileName}” onto this ${unitNoun}.`);
    } catch (err) {
      skipAutoSaveRef.current = false;
      setError(err instanceof Error ? err.message : "Reupload failed");
    } finally {
      setReuploading(false);
      if (reuploadInputRef.current) reuploadInputRef.current.value = "";
    }
  }

  const saving = saveStatus === "saving";
  const saveLabel =
    saveStatus === "saving"
      ? "Saving…"
      : saveStatus === "dirty"
        ? "Unsaved"
        : saveStatus === "saved"
          ? "Saved"
          : saveStatus === "error"
            ? "Retry save"
            : `Save ${unitNoun}`;

  if (loading) return <LoadingPage label={`Opening ${unitNoun}…`} />;

  if (!project || !activePage) {
    return (
      <EmptyState
        title={`${unitLabel} not found`}
        description={error || `This ${unitNoun} could not be loaded.`}
        action="Back to project"
        href={`/student/projects/${projectId}`}
      />
    );
  }

  const feedbackRemark =
    activePage.reviewRemark?.trim() || chapterFeedback?.trim() || "";
  const feedbackAnnotated = activePage.reviewAnnotatedHtml?.trim() || "";
  const reviewStatus = activePage.reviewStatus;
  const feedbackApproved = reviewStatus === "approved";
  const feedbackNeedsWork =
    reviewStatus === "needs_revision" || Boolean(feedbackAnnotated);
  const hasFeedbackContent =
    Boolean(feedbackRemark) ||
    Boolean(feedbackAnnotated) ||
    (reviewStatus != null && reviewStatus !== "none") ||
    (singlePage && typeof project.score === "number");
  const feedbackCount = Math.max(countRemarkComments(feedbackRemark), 0);
  const feedbackBadgeCount =
    feedbackCount > 0
      ? feedbackCount
      : hasFeedbackContent
        ? 1
        : 0;

  return (
    <div className="space-y-5">
      {singlePage && (
        <input
          ref={reuploadInputRef}
          type="file"
          accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onReuploadDocument(file);
          }}
        />
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link
            href={`/student/projects/${projectId}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-foreground/55 hover:text-blue-600"
          >
            <ArrowLeft className="size-4" />
            Back to project
          </Link>
          <p className="mt-2 truncate text-xs font-semibold uppercase tracking-wide text-foreground/45">
            {project.title}
          </p>
          <h1 className="mt-1 truncate text-2xl font-bold tracking-tight">
            {activePage.title}
          </h1>
          {singlePage && typeof project.score === "number" ? (
            <div className="mt-3 inline-flex flex-col gap-0.5 rounded-xl border border-emerald-600/15 bg-emerald-50/80 px-3.5 py-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-800/70">
                Lecturer score
              </span>
              <span className="text-xl font-bold tracking-tight text-emerald-800">
                {project.score}
                <span className="text-sm font-semibold text-emerald-700/70">
                  /
                  {typeof project.assignmentBrief?.maxScore === "number"
                    ? project.assignmentBrief.maxScore
                    : 100}
                </span>
              </span>
              {project.scoreNote?.trim() ? (
                <span className="max-w-md text-xs text-emerald-900/70">
                  {project.scoreNote.trim()}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {project.projectType === "assignment" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setBriefModalOpen(true)}
            >
              <FileText className="size-4" />
              Assignment brief
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="relative"
            onClick={() => setFeedbackModalOpen(true)}
          >
            <MessageSquareText className="size-4" />
            Feedback note
            {feedbackBadgeCount > 0 ? (
              <span
                className={cn(
                  "ml-1 inline-flex min-w-5 items-center justify-center rounded-full",
                  "bg-danger px-1.5 py-0.5 text-[10px] font-bold leading-none text-white",
                )}
                aria-label={`${feedbackBadgeCount} feedback note${feedbackBadgeCount === 1 ? "" : "s"}`}
              >
                {feedbackBadgeCount > 99 ? "99+" : feedbackBadgeCount}
              </span>
            ) : null}
          </Button>
          {prevPage && (
            <Link href={`/student/projects/${projectId}/pages/${prevPage._id}`}>
              <Button type="button" variant="outline">
                <ChevronLeft className="size-4" />
                Previous
              </Button>
            </Link>
          )}
          {nextPage && (
            <Link href={`/student/projects/${projectId}/pages/${nextPage._id}`}>
              <Button type="button" variant="outline">
                Next
                <ChevronRight className="size-4" />
              </Button>
            </Link>
          )}
          {singlePage && (
            <Button
              type="button"
              variant="outline"
              disabled={reuploading || editorLocked || saving}
              onClick={() => reuploadInputRef.current?.click()}
            >
              {reuploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {reuploading
                ? hasWritingContent
                  ? "Reuploading…"
                  : "Uploading…"
                : uploadButtonLabel}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={saving || editorLocked || reuploading}
            onClick={() => void deletePage()}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
          <Button
            type="button"
            disabled={saving || editorLocked || reuploading}
            onClick={() => void savePage({ manual: true })}
          >
            {saveStatus === "saving" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : saveStatus === "saved" ? (
              <Check className="size-4" />
            ) : (
              <Save className="size-4" />
            )}
            {saveLabel}
          </Button>
          <ProjectChapterPanel
            key={pageId}
            projectId={projectId}
            pageId={pageId}
            pageOrder={activePage.order ?? pageIndex}
            pageTitle={draftTitle}
            pageHtml={draftContent}
            projectType={project.projectType}
            reviewRemark={activePage.reviewRemark}
            onGateChange={(gate) => {
              setEditorLocked(gate.locked);
              setSubmitHint(
                !gate.canSubmit && gate.reason ? gate.reason : null,
              );
            }}
            onFeedbackChange={(remark) => {
              setChapterFeedback(remark);
            }}
            onMessage={(msg) => {
              setMessage(msg);
              setError(null);
              void load();
            }}
            onError={(msg) => {
              setError(msg);
              setMessage(null);
            }}
            onRefresh={() => {
              void load();
            }}
          />
        </div>
      </div>

      <p
        className={cn(
          "text-xs font-medium",
          saveStatus === "error"
            ? "text-danger"
            : saveStatus === "dirty"
              ? "text-amber-600"
              : "text-foreground/45",
        )}
        aria-live="polite"
      >
        {editorLocked
          ? `This ${unitNoun} is locked pending a ${advisorNoun} decision`
          : saveStatus === "saving"
            ? "Auto-saving…"
            : null}
        {!editorLocked && saveStatus === "dirty" && "Unsaved changes — auto-saves shortly"}
        {!editorLocked && saveStatus === "saved" && "All changes saved"}
        {!editorLocked && saveStatus === "error" && "Auto-save failed — try Save again"}
        {!editorLocked && saveStatus === "idle" && "Changes auto-save as you write"}
      </p>

      {message && (
        <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {submitHint && !editorLocked && (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
          <p className="font-semibold text-foreground/80">Submit unavailable</p>
          <p className="mt-1 text-foreground/75">{submitHint}</p>
        </div>
      )}

      <Card className="w-full rounded-xl shadow-sm">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-base">{unitLabel} editor</CardTitle>
          <CardDescription>
            {editorLocked
              ? `This ${unitNoun} is read-only while awaiting ${advisorNoun} review or after approval`
              : "Writes auto-save as you type — then submit for review when ready"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <label className="block max-w-2xl space-y-1.5">
            <span className="text-sm font-semibold">{unitTitleLabel}</span>
            <Input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              maxLength={200}
              disabled={editorLocked}
              readOnly={editorLocked}
            />
          </label>

          <DocumentEditor
            key={`${activePage._id}-${editorLocked ? "locked" : "edit"}`}
            value={draftContent}
            onChange={editorLocked ? () => undefined : setDraftContent}
            placeholder={
              editorLocked
                ? `Editing is unavailable while this ${unitNoun} awaits ${advisorNoun} review`
                : `Write “${draftTitle || `this ${unitNoun}`}” here…`
            }
            projectId={projectId}
            className="w-full"
            fullWidth
            readOnly={editorLocked}
          />
          <p className="text-xs text-foreground/45">
            {countWordsFromHtml(draftContent).toLocaleString()} words
            {(() => {
              const brief = project.assignmentBrief;
              if (!brief) return null;
              const min =
                typeof brief.wordCountMin === "number"
                  ? brief.wordCountMin
                  : null;
              const max =
                typeof brief.wordCountMax === "number"
                  ? brief.wordCountMax
                  : null;
              if (min == null && max == null) return null;
              const target =
                min != null && max != null
                  ? ` · target ${min.toLocaleString()}–${max.toLocaleString()}`
                  : min != null
                    ? ` · min ${min.toLocaleString()}`
                    : ` · max ${max!.toLocaleString()}`;
              return target;
            })()}
            {editorLocked
              ? " · locked"
              : saveStatus === "dirty" || saveStatus === "saving"
                ? " · editing…"
                : saveStatus === "saved"
                  ? " · saved"
                  : ""}
          </p>
        </CardContent>
      </Card>

      {project.projectType === "assignment" && briefModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assignment-brief-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Close dialog"
            onClick={() => setBriefModalOpen(false)}
          />
          <div className="relative flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2
                id="assignment-brief-modal-title"
                className="text-sm font-bold text-foreground"
              >
                Assignment brief
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                aria-label="Close"
                onClick={() => setBriefModalOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {project.assignmentBrief ? (
                <AssignmentBriefPanel
                  brief={project.assignmentBrief}
                  className="border-0 shadow-none"
                  hideHeader
                  currentWordCount={countWordsFromHtml(draftContent)}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
                  <FileText className="mx-auto size-8 text-foreground/35" />
                  <p className="mt-3 text-sm font-semibold text-foreground/80">
                    No assignment brief attached
                  </p>
                  <p className="mt-1 text-sm text-foreground/55">
                    Your lecturer has not attached a brief to this project yet.
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end border-t border-border px-4 py-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBriefModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {feedbackModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-note-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Close dialog"
            onClick={() => setFeedbackModalOpen(false)}
          />
          <div className="relative flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2
                id="feedback-note-modal-title"
                className="text-sm font-bold text-foreground"
              >
                Feedback note
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                aria-label="Close"
                onClick={() => setFeedbackModalOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              {!hasFeedbackContent ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
                  <MessageSquareText className="mx-auto size-8 text-foreground/35" />
                  <p className="mt-3 text-sm font-semibold text-foreground/80">
                    No feedback notes yet
                  </p>
                  <p className="mt-1 text-sm text-foreground/55">
                    {advisorLabel} comments will appear here after a review.
                  </p>
                </div>
              ) : (
                <>
                  {singlePage && typeof project.score === "number" ? (
                    <div className="rounded-xl border border-emerald-600/20 bg-emerald-50 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800/70">
                        Lecturer score
                      </p>
                      <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-800">
                        {project.score}
                        <span className="text-sm font-semibold text-emerald-700/70">
                          /
                          {typeof project.assignmentBrief?.maxScore === "number"
                            ? project.assignmentBrief.maxScore
                            : 100}
                        </span>
                      </p>
                      {project.scoreNote?.trim() ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-900/80">
                          {project.scoreNote.trim()}
                        </p>
                      ) : null}
                      {project.criterionScores &&
                      project.criterionScores.length > 0 ? (
                        <ul className="mt-3 divide-y divide-emerald-600/15 rounded-lg border border-emerald-600/15 bg-white/60">
                          {project.criterionScores.map((row) => (
                            <li
                              key={row.name}
                              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                            >
                              <span className="text-emerald-950/80">
                                {row.name}
                              </span>
                              <span className="shrink-0 font-semibold text-emerald-900/70">
                                {row.score}/{row.maxMarks}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}

                  {(reviewStatus && reviewStatus !== "none") ||
                  feedbackRemark ? (
                    <div
                      className={cn(
                        "rounded-xl border px-4 py-3 text-sm",
                        feedbackApproved
                          ? "border-success/30 bg-success/10"
                          : "border-amber-500/30 bg-amber-50",
                      )}
                    >
                      <p
                        className={cn(
                          "font-semibold",
                          feedbackApproved ? "text-success" : "text-amber-950",
                        )}
                      >
                        {feedbackApproved
                          ? `${advisorLabel} approved this ${unitNoun}`
                          : reviewStatus === "needs_revision"
                            ? `Needs revision — ${advisorNoun} comments`
                            : `${advisorLabel} feedback`}
                      </p>
                      {feedbackRemark ? (
                        <RemarkHtml
                          html={feedbackRemark}
                          className="mt-2 text-sm text-foreground/80"
                        />
                      ) : (
                        <p className="mt-2 text-foreground/55">
                          No written remarks were left with this review.
                        </p>
                      )}
                    </div>
                  ) : null}

                  {feedbackNeedsWork &&
                  feedbackAnnotated &&
                  !feedbackApproved ? (
                    <div className="rounded-xl border border-border bg-background px-4 py-3 text-sm">
                      <p className="font-semibold text-foreground">
                        Where to work — highlighted passages
                      </p>
                      <p className="mt-1 text-xs text-foreground/55">
                        Yellow = Weaknesses · Orange = Needs citation. Use these
                        marks while you revise in the editor.
                      </p>
                      <div
                        className="review-highlight-content mt-3 max-h-[360px] overflow-y-auto rounded-xl border border-border bg-muted/20 px-4 py-3 text-foreground"
                        dangerouslySetInnerHTML={{ __html: feedbackAnnotated }}
                      />
                    </div>
                  ) : null}
                </>
              )}
            </div>
            <div className="flex justify-end border-t border-border px-4 py-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFeedbackModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
