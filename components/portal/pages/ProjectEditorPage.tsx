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
import { apiFetch, apiUpload } from "@/lib/portal-api";
import {
  DocumentEditor,
  countWordsFromHtml,
} from "@/components/portal/editor/document-editor";
import { ProjectChapterPanel } from "@/components/portal/features/chapters/project-chapter-panel";
import { countRemarkComments } from "@/components/portal/features/chapters/chapter-timeline";
import { RemarkHtml } from "@/components/portal/editor/remark-html";
import { AnnotatedHtmlWithComments } from "@/components/portal/editor/AnnotatedHtmlWithComments";
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
import {
  formatTrailDate,
  sortTrailChronological,
  trailEventLabel,
  type ReviewTrailEvent,
} from "@/lib/portal/review-trail";
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
  reviewTrail?: ReviewTrailEvent[];
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

  if (loading) {
    return (
      <div className="stu-ped" aria-busy="true">
        <header className="stu-ped-intro">
          <div className="stu-ped-intro-copy">
            <Link
              href={`/student/projects/${projectId}`}
              className="stu-ped-back"
            >
              <ArrowLeft size={14} />
              Back to project
            </Link>
            <p className="stu-ped-eyebrow">Writing workspace</p>
            <h1>Opening editor…</h1>
            <p>Loading your draft and review status.</p>
          </div>
        </header>
        <div className="stu-ped-skeleton-strip" aria-hidden />
        <div className="stu-ped-panel">
          <div className="stu-ped-skeleton-block" aria-hidden />
        </div>
      </div>
    );
  }

  if (!project || !activePage) {
    return (
      <div className="stu-ped">
        <header className="stu-ped-intro">
          <div className="stu-ped-intro-copy">
            <Link
              href={`/student/projects/${projectId}`}
              className="stu-ped-back"
            >
              <ArrowLeft size={14} />
              Back to project
            </Link>
            <p className="stu-ped-eyebrow">Writing workspace</p>
            <h1>{unitLabel} not found</h1>
            <p>{error || `This ${unitNoun} could not be loaded.`}</p>
          </div>
        </header>
        <div className="stu-ped-empty">
          <span className="stu-ped-empty-icon" aria-hidden>
            <FileText size={22} />
          </span>
          <h3>Unable to open this {unitNoun}</h3>
          <p>Return to the project workspace and try again.</p>
          <Link
            href={`/student/projects/${projectId}`}
            className="stu-ped-btn stu-ped-btn-primary"
          >
            Back to project
          </Link>
        </div>
      </div>
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
  const previousRounds = sortTrailChronological(activePage.reviewTrail).filter(
    (event) => event.type === "rewrite_requested" || event.type === "approved",
  );
  const isAssignment = project.projectType === "assignment";
  const backHref = isAssignment
    ? `/student/assignments/${projectId}`
    : `/student/projects/${projectId}`;
  const backLabel = isAssignment ? "Back to assignment" : "Back to project";
  const maxScore =
    typeof project.assignmentBrief?.maxScore === "number"
      ? project.assignmentBrief.maxScore
      : 100;
  const wordCount = countWordsFromHtml(draftContent);
  const wordTarget = (() => {
    const brief = project.assignmentBrief;
    if (!brief) return null;
    const min =
      typeof brief.wordCountMin === "number" ? brief.wordCountMin : null;
    const max =
      typeof brief.wordCountMax === "number" ? brief.wordCountMax : null;
    if (min == null && max == null) return null;
    if (min != null && max != null) {
      return ` · target ${min.toLocaleString()}–${max.toLocaleString()}`;
    }
    if (min != null) return ` · min ${min.toLocaleString()}`;
    return ` · max ${max!.toLocaleString()}`;
  })();

  const saveStatusClass =
    editorLocked
      ? "is-locked"
      : saveStatus === "error"
        ? "is-error"
        : saveStatus === "dirty"
          ? "is-dirty"
          : "";

  return (
    <div className="stu-ped">
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

      <header className="stu-ped-intro">
        <div className="stu-ped-intro-copy">
          <Link href={backHref} className="stu-ped-back">
            <ArrowLeft size={14} />
            {backLabel}
          </Link>
          <p className="stu-ped-eyebrow">{project.title}</p>
          <h1>{activePage.title}</h1>
          <p>
            {editorLocked
              ? `This ${unitNoun} is read-only while awaiting ${advisorNoun} review or after approval.`
              : `Write and refine this ${unitNoun}. Changes auto-save, then submit when ready.`}
          </p>
          {singlePage && typeof project.score === "number" ? (
            <div className="stu-ped-score-chip">
              <span>Lecturer score</span>
              <strong>
                {project.score}
                <em>/{maxScore}</em>
              </strong>
              {project.scoreNote?.trim() ? (
                <p>{project.scoreNote.trim()}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="stu-ped-toolbar">
          {isAssignment ? (
            <button
              type="button"
              className="stu-ped-btn stu-ped-btn-ghost"
              onClick={() => setBriefModalOpen(true)}
            >
              <FileText size={15} />
              Assignment brief
            </button>
          ) : null}
          <button
            type="button"
            className="stu-ped-btn stu-ped-btn-ghost"
            onClick={() => setFeedbackModalOpen(true)}
          >
            <MessageSquareText size={15} />
            Feedback note
            {feedbackBadgeCount > 0 ? (
              <span
                className="stu-ped-feedback-count"
                aria-label={`${feedbackBadgeCount} feedback note${feedbackBadgeCount === 1 ? "" : "s"}`}
              >
                {feedbackBadgeCount > 99 ? "99+" : feedbackBadgeCount}
              </span>
            ) : null}
          </button>
          {prevPage ? (
            <Link
              href={`/student/projects/${projectId}/pages/${prevPage._id}`}
              className="stu-ped-btn stu-ped-btn-ghost"
            >
              <ChevronLeft size={15} />
              Previous
            </Link>
          ) : null}
          {nextPage ? (
            <Link
              href={`/student/projects/${projectId}/pages/${nextPage._id}`}
              className="stu-ped-btn stu-ped-btn-ghost"
            >
              Next
              <ChevronRight size={15} />
            </Link>
          ) : null}
          {singlePage ? (
            <button
              type="button"
              className="stu-ped-btn stu-ped-btn-ghost"
              disabled={reuploading || editorLocked || saving}
              onClick={() => reuploadInputRef.current?.click()}
            >
              {reuploading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Upload size={15} />
              )}
              {reuploading
                ? hasWritingContent
                  ? "Reuploading…"
                  : "Uploading…"
                : uploadButtonLabel}
            </button>
          ) : null}
          <button
            type="button"
            className="stu-ped-btn stu-ped-btn-danger"
            disabled={saving || editorLocked || reuploading}
            onClick={() => void deletePage()}
          >
            <Trash2 size={15} />
            Delete
          </button>
          <button
            type="button"
            className="stu-ped-btn stu-ped-btn-ghost"
            disabled={saving || editorLocked || reuploading}
            onClick={() => void savePage({ manual: true })}
          >
            {saveStatus === "saving" ? (
              <Loader2 size={15} className="animate-spin" />
            ) : saveStatus === "saved" ? (
              <Check size={15} />
            ) : (
              <Save size={15} />
            )}
            {saveLabel}
          </button>
          <div className="stu-ped-submit-wrap">
            <ProjectChapterPanel
              key={pageId}
              projectId={projectId}
              pageId={pageId}
              pageOrder={activePage.order ?? pageIndex}
              pageTitle={draftTitle}
              pageHtml={draftContent}
              projectType={project.projectType}
              reviewRemark={activePage.reviewRemark}
              className="stu-ped-submit"
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
      </header>

      <p
        className={cn("stu-ped-status", saveStatusClass)}
        aria-live="polite"
      >
        {editorLocked
          ? `This ${unitNoun} is locked pending a ${advisorNoun} decision`
          : saveStatus === "saving"
            ? "Auto-saving…"
            : null}
        {!editorLocked &&
          saveStatus === "dirty" &&
          "Unsaved changes — auto-saves shortly"}
        {!editorLocked && saveStatus === "saved" && "All changes saved"}
        {!editorLocked &&
          saveStatus === "error" &&
          "Auto-save failed — try Save again"}
        {!editorLocked &&
          saveStatus === "idle" &&
          "Changes auto-save as you write"}
      </p>

      {message ? <p className="stu-ped-banner stu-ped-banner-ok">{message}</p> : null}
      {error ? <p className="stu-ped-banner stu-ped-banner-err">{error}</p> : null}

      {submitHint && !editorLocked ? (
        <div className="stu-ped-banner stu-ped-banner-hint">
          <strong>Submit unavailable</strong>
          <span>{submitHint}</span>
        </div>
      ) : null}

      <section className="stu-ped-panel" aria-labelledby="stu-ped-editor-heading">
        <div className="stu-ped-panel-head">
          <h2 id="stu-ped-editor-heading">{unitLabel} editor</h2>
          <p>
            {editorLocked
              ? `This ${unitNoun} is read-only while awaiting ${advisorNoun} review or after approval`
              : "Writes auto-save as you type — then submit for review when ready"}
          </p>
        </div>
        <div className="stu-ped-panel-body">
          <label className="stu-ped-field">
            <span className="stu-ped-label">{unitTitleLabel}</span>
            <input
              className="stu-ped-input"
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
            className="stu-ped-editor"
            fullWidth
            readOnly={editorLocked}
          />
          <p className="stu-ped-meta">
            {wordCount.toLocaleString()} words
            {wordTarget}
            {editorLocked
              ? " · locked"
              : saveStatus === "dirty" || saveStatus === "saving"
                ? " · editing…"
                : saveStatus === "saved"
                  ? " · saved"
                  : ""}
          </p>
        </div>
      </section>

      {isAssignment && briefModalOpen ? (
        <div
          className="stu-ped-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assignment-brief-modal-title"
        >
          <button
            type="button"
            className="stu-ped-modal-backdrop"
            aria-label="Close dialog"
            onClick={() => setBriefModalOpen(false)}
          />
          <div className="stu-ped-modal-card">
            <div className="stu-ped-modal-head">
              <h2 id="assignment-brief-modal-title">Assignment brief</h2>
              <button
                type="button"
                className="stu-ped-btn stu-ped-btn-ghost stu-ped-btn-sm"
                aria-label="Close"
                onClick={() => setBriefModalOpen(false)}
              >
                <X size={14} />
              </button>
            </div>
            <div className="stu-ped-modal-body">
              {project.assignmentBrief ? (
                <AssignmentBriefPanel
                  brief={project.assignmentBrief}
                  className="stu-ped-brief-panel"
                  hideHeader
                  currentWordCount={wordCount}
                />
              ) : (
                <div className="stu-ped-empty">
                  <span className="stu-ped-empty-icon" aria-hidden>
                    <FileText size={22} />
                  </span>
                  <h3>No assignment brief attached</h3>
                  <p>
                    Your lecturer has not attached a brief to this project yet.
                  </p>
                </div>
              )}
            </div>
            <div className="stu-ped-modal-foot">
              <button
                type="button"
                className="stu-ped-btn stu-ped-btn-ghost"
                onClick={() => setBriefModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {feedbackModalOpen ? (
        <div
          className="stu-ped-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-note-modal-title"
        >
          <button
            type="button"
            className="stu-ped-modal-backdrop"
            aria-label="Close dialog"
            onClick={() => setFeedbackModalOpen(false)}
          />
          <div className="stu-ped-modal-card">
            <div className="stu-ped-modal-head">
              <h2 id="feedback-note-modal-title">Feedback note</h2>
              <button
                type="button"
                className="stu-ped-btn stu-ped-btn-ghost stu-ped-btn-sm"
                aria-label="Close"
                onClick={() => setFeedbackModalOpen(false)}
              >
                <X size={14} />
              </button>
            </div>
            <div className="stu-ped-modal-body">
              {!hasFeedbackContent ? (
                <div className="stu-ped-empty">
                  <span className="stu-ped-empty-icon" aria-hidden>
                    <MessageSquareText size={22} />
                  </span>
                  <h3>No feedback notes yet</h3>
                  <p>
                    {advisorLabel} comments will appear here after a review.
                  </p>
                </div>
              ) : (
                <>
                  {singlePage && typeof project.score === "number" ? (
                    <div className="stu-ped-score-card">
                      <p className="stu-ped-score-card-label">Lecturer score</p>
                      <p className="stu-ped-score-card-value">
                        {project.score}
                        <span>/{maxScore}</span>
                      </p>
                      {project.scoreNote?.trim() ? (
                        <p className="stu-ped-score-card-note">
                          {project.scoreNote.trim()}
                        </p>
                      ) : null}
                      {project.criterionScores &&
                      project.criterionScores.length > 0 ? (
                        <ul className="stu-ped-criteria">
                          {project.criterionScores.map((row) => (
                            <li key={row.name}>
                              <span>{row.name}</span>
                              <strong>
                                {row.score}/{row.maxMarks}
                              </strong>
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
                        "stu-ped-remark",
                        feedbackApproved ? "is-approved" : "is-revision",
                      )}
                    >
                      <p className="stu-ped-remark-label">
                        {feedbackApproved
                          ? `${advisorLabel} approved this ${unitNoun}`
                          : reviewStatus === "needs_revision"
                            ? `Needs revision — ${advisorNoun} comments`
                            : `${advisorLabel} feedback`}
                      </p>
                      {feedbackRemark ? (
                        <RemarkHtml
                          html={feedbackRemark}
                          className="stu-ped-remark-body"
                        />
                      ) : (
                        <p className="stu-ped-remark-body">
                          No written remarks were left with this review.
                        </p>
                      )}
                      {previousRounds.length > 1 ? (
                        <ol className="stu-ped-remark-trail">
                          {previousRounds.map((event, index) => (
                            <li
                              key={
                                event._id ||
                                `${event.type}-${event.at}-${index}`
                              }
                            >
                              {trailEventLabel(event.type)} ·{" "}
                              {formatTrailDate(event.at) || "Date unknown"}
                            </li>
                          ))}
                        </ol>
                      ) : null}
                    </div>
                  ) : null}

                  {feedbackNeedsWork &&
                  feedbackAnnotated &&
                  !feedbackApproved ? (
                    <div className="stu-ped-annotated">
                      <p>Where to work — highlighted passages</p>
                      <p>
                        Yellow = Weaknesses · Orange = Needs citation. Comments
                        appear in the right margin.
                      </p>
                      <AnnotatedHtmlWithComments
                        html={feedbackAnnotated}
                        bodyClassName="stu-ped-annotated-body"
                      />
                    </div>
                  ) : null}
                </>
              )}
            </div>
            <div className="stu-ped-modal-foot">
              <button
                type="button"
                className="stu-ped-btn stu-ped-btn-ghost"
                onClick={() => setFeedbackModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
