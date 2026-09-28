"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { AulaLayout } from "@/components/AulaLayout";
import { GarilApp } from "@/components/GarilApp";
import { toEditorHtml } from "@/components/portal/editor/document-editor";
import { ResearchAiUseNoticeModal } from "@/components/research/ResearchAiUseNotice";
import { ResearchCitationStyleModal } from "@/components/research/ResearchCitationStyleModal";
import { ResearchNotebookAssetsPreview } from "@/components/research/ResearchNotebookAssetsPreview";
import { ResearchNotebookLibraryPicker } from "@/components/research/ResearchNotebookLibraryPicker";
import { ResearchNotebookLoadingModal } from "@/components/research/ResearchNotebookLoadingModal";
import { htmlHasText } from "@/components/research/ResearchDocEditor";
import { ScopeBriefRichEditor } from "@/components/research/ScopeBriefRichEditor";
import { StudentLayout } from "@/components/StudentLayout";
import { studentHasResearchTokens } from "@/components/StudentTokenQuota";
import { assignmentInstructionsToText } from "@/lib/portal/assignment-instructions";
import {
	IconChevronLeft,
	IconFileText,
	IconBrain,
	IconSparkles,
	IconStickyNote,
	IconTarget,
	IconUpload,
} from "@/components/ui/ButtonIcon";
import { useAuth } from "@/hooks/useAuth";
import { saveChatCitationStyle } from "@/lib/chat-research-citations";
import { DEFAULT_CITATION_STYLE, type CitationStyle } from "@/lib/citation-styles";
import { createDocument, readFileAsDataUrl } from "@/lib/research-assets-api";
import { fetchResearchSourceContextFromApi } from "@/lib/research-api";
import { getDisciplineLabel, resolveDisciplineId } from "@/lib/research-disciplines";
import { researchGeneratingPagePath } from "@/lib/research-generate-routes";
import {
	getGenerateResearchLabel,
	getScopeDocumentLabel,
	ideaToEditableDocument,
	type ResearchIdea,
	type ResearchScope,
} from "@/lib/research-ideas";
import {
	loadNotebookBriefPrefill,
	type NotebookBriefDatasetPreview,
	type NotebookBriefImagePreview,
} from "@/lib/research-notebook-brief-html";
import { stageOutlinePageContext } from "@/lib/research-outline-context";
import { researchOutlinePagePath } from "@/lib/research-outline-routes";
import { loadSavedOutline, saveResearchOutline } from "@/lib/research-outline-storage";
import { stagePendingResearchPaper } from "@/lib/research-paper-pending";
import { hasAcceptedResearchAiNotice } from "@/lib/research-ai-notice";
import { stagePaperSources } from "@/lib/research-paper-sources";
import {
	formatScopeBrief,
	getScopeBriefCopy,
	parseResearchQuestions,
	resolveBriefIdeaType,
	topicPlaceholderFor,
	type ScopeBriefField,
} from "@/lib/research-scope-brief";
import { getScopeProfile } from "@/lib/research-scope-profiles";
import { findSectionAgent, sectionAgentKicker } from "@/lib/research-section-agents";
import { loadResearchWizardDraft } from "@/lib/research-wizard-draft";

const BRIEF_UPLOAD_ACCEPT =
	".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown";
const BRIEF_UPLOAD_MAX_BYTES = 12 * 1024 * 1024;

type BriefUpload = {
	id: string;
	fileName: string;
	sizeLabel: string;
};

function fieldValueReady(field: ScopeBriefField, values: Record<string, string>): boolean {
	if (!field.required) return true;
	const value = values[field.id] ?? "";
	if (field.kind === "textarea") {
		return htmlHasText(value) || Boolean(assignmentInstructionsToText(value));
	}
	return Boolean(value.trim());
}

function plainFromRich(value: string): string {
	return assignmentInstructionsToText(value) || value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function isAllowedBriefFile(file: File): boolean {
	const name = file.name.toLowerCase();
	const mime = (file.type || "").toLowerCase();
	if (file.size <= 0 || file.size > BRIEF_UPLOAD_MAX_BYTES) return false;
	if (name.endsWith(".pdf") || mime === "application/pdf") return true;
	if (
		name.endsWith(".docx") ||
		mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	) {
		return true;
	}
	if (name.endsWith(".txt") || name.endsWith(".md") || mime.startsWith("text/")) return true;
	return false;
}

function formatBriefSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === "string") resolve(reader.result);
			else reject(new Error("Could not read file."));
		};
		reader.onerror = () => reject(new Error("Could not read file."));
		reader.readAsText(file);
	});
}

function plainTextFromSourceContext(ctx: string): string {
	const trimmed = ctx.trim();
	if (!trimmed) return "";
	const documentMatch = trimmed.match(/DOCUMENT:\s*[^\n]*\n([\s\S]*)/i);
	if (documentMatch?.[1]?.trim()) return documentMatch[1].trim();
	return trimmed.replace(/^[\s\S]*?\n\n/, "").trim() || trimmed;
}

function titleFromFileName(fileName: string): string {
	return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 500);
}

export function ResearchScopeBriefPage({
	scope,
	variant = "lecturer",
}: {
	scope: ResearchScope;
	variant?: "lecturer" | "student";
}) {
	const { user } = useAuth();
	const router = useRouter();
	const searchParams = useSearchParams();
	const isStudent = variant === "student";
	const hasTokens = studentHasResearchTokens(user?.tokenQuota, user?.role);
	const copy = getScopeBriefCopy(scope);
	const profile = getScopeProfile(scope);
	const documentLabel = getScopeDocumentLabel(scope);

	/** Refine / regenerate still mounts the workspace via `?generate=1`. Fresh generates use `/research/generating`. */
	const [workspaceMode, setWorkspaceMode] = useState(() => searchParams.get("generate") === "1");
	const [aiNoticeOpen, setAiNoticeOpen] = useState(false);

	useEffect(() => {
		if (searchParams.get("generate") === "1") setWorkspaceMode(true);
	}, [searchParams]);

	useEffect(() => {
		setAiNoticeOpen(!hasAcceptedResearchAiNotice());
	}, []);

	const discipline = useMemo(() => {
		const fromQuery = searchParams.get("discipline")?.trim() ?? "";
		if (fromQuery) return fromQuery;
		if (!user?.id) return "";
		const fromWizard = loadResearchWizardDraft(variant, user.id)?.discipline ?? "";
		if (fromWizard) return fromWizard;
		return (
			resolveDisciplineId(user.department) ||
			resolveDisciplineId(user.programme) ||
			""
		);
	}, [searchParams, user?.id, user?.department, user?.programme, variant]);

	const [topic, setTopic] = useState("");
	const [instructions, setInstructions] = useState("");
	const [briefHtml, setBriefHtml] = useState("");
	const [briefUpload, setBriefUpload] = useState<BriefUpload | null>(null);
	const [uploadingBrief, setUploadingBrief] = useState(false);
	const [briefDragOver, setBriefDragOver] = useState(false);
	const briefFileInputRef = useRef<HTMLInputElement>(null);
	const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
	const [notebookTitles, setNotebookTitles] = useState<Record<string, string>>({});
	const notebookTitlesRef = useRef<Record<string, string>>({});
	const [loadingNotebookPrefill, setLoadingNotebookPrefill] = useState(false);
	const [loadingNotebookTitle, setLoadingNotebookTitle] = useState("");
	const [notebookDatasets, setNotebookDatasets] = useState<NotebookBriefDatasetPreview[]>([]);
	const [notebookImages, setNotebookImages] = useState<NotebookBriefImagePreview[]>([]);
	const notebookPrefillSeqRef = useRef(0);
	const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
		const initial: Record<string, string> = {};
		for (const field of copy.fields) {
			if (field.kind === "select" && field.options?.[0]) initial[field.id] = field.options[0].id;
			else initial[field.id] = "";
		}
		return initial;
	});
	const [touched, setTouched] = useState(false);
	const [showCitationStyleModal, setShowCitationStyleModal] = useState(false);
	const [submitting, setSubmitting] = useState<"paper" | "outline" | null>(null);
	const [submitError, setSubmitError] = useState<string | null>(null);

	const backHref = isStudent ? "/student/research" : "/research";
	const disciplineLabel = discipline ? getDisciplineLabel(discipline) : "";
	const generateLabel = getGenerateResearchLabel(scope);
	const showOutlineButton = scope !== "assignment";
	const requiredFieldsReady = copy.fields.every((field) => fieldValueReady(field, fieldValues));
	const instructionsPlain = plainFromRich(instructions);
	const notesReady =
		copy.showNotes === false ||
		!copy.notesRequired ||
		htmlHasText(instructions) ||
		Boolean(instructionsPlain);
	const allowNotebookLibrary = scope !== "assignment";
	const firstNotebookTitle = selectedProjectIds
		.map((id) => notebookTitles[id]?.trim())
		.find(Boolean);
	const isComposer = copy.fields.length === 0 && copy.showNotes === false;
	/** Rich formatting (bullets, headings, images) on every generate composer. */
	const useRichBrief = isComposer;
	/** PDF/Word brief upload remains assignment-only. */
	const allowBriefUpload = scope === "assignment" && isComposer;
	const briefPlain = useRichBrief ? assignmentInstructionsToText(briefHtml) : "";
	const hasTypedBrief = useRichBrief && (htmlHasText(briefHtml) || Boolean(briefPlain));
	const hasUploadedBrief = allowBriefUpload && Boolean(briefUpload);
	const topicReady = useRichBrief
		? hasTypedBrief || hasUploadedBrief || (allowNotebookLibrary && selectedProjectIds.length > 0)
		: htmlHasText(topic) ||
			Boolean(plainFromRich(topic)) ||
			(allowNotebookLibrary && selectedProjectIds.length > 0);
	const canGenerate = topicReady && notesReady && requiredFieldsReady;
	const showError = touched && !canGenerate;
	const topicPlaceholder = topicPlaceholderFor(scope, discipline);
	const busy = Boolean(submitting) || uploadingBrief;

	if (workspaceMode) {
		return isStudent ? (
			<StudentLayout>
				<GarilApp layout="student" />
			</StudentLayout>
		) : (
			<GarilApp />
		);
	}

	const setField = (id: string, value: string) => {
		setFieldValues((prev) => ({ ...prev, [id]: value }));
	};

	const selectedSources = () => ({
		// Uploaded assignment brief + notebook figure files (images) for generation/visuals.
		documentIds: [
			...(briefUpload ? [briefUpload.id] : []),
			...notebookImages.map((image) => image.id),
		].filter((id, index, all) => Boolean(id) && all.indexOf(id) === index),
		// Notebook datasets explicitly, in addition to full folder via projectIds.
		datasetIds: notebookDatasets
			.map((dataset) => dataset.id)
			.filter((id, index, all) => Boolean(id) && all.indexOf(id) === index),
		questionnaireIds: [] as string[],
		noteIds: [] as string[],
		// Whole research notebook folder (notes, files, data, surveys, lab).
		projectIds: allowNotebookLibrary ? [...selectedProjectIds] : [],
	});

	const buildIdea = (): { idea: ResearchIdea; trimmedTopic: string; brief: string } | null => {
		if (!discipline || !canGenerate) return null;
		const briefFromRich = useRichBrief ? briefPlain : "";
		const typedTopic = (
			useRichBrief
				? briefFromRich.split(/\n/).map((line) => line.trim()).find(Boolean) ||
					(briefUpload ? titleFromFileName(briefUpload.fileName) : "") ||
					""
				: plainFromRich(topic).split(/\n/).map((line) => line.trim()).find(Boolean) || ""
		).slice(0, 500);
		const hasTypedTopic = Boolean(typedTopic.trim());
		const notebookDirective =
			selectedProjectIds.length > 0
				? hasTypedTopic
					? `The user topic/title is the study focus. Use the selected research notebook library${
							firstNotebookTitle ? ` (“${firstNotebookTitle}”)` : ""
						} as primary evidence and source material (notes, datasets, files, figures, surveys, lab work) to generate that topic. Do not replace the user topic with a different study, and do not ignore the notebook.`
					: `Use the selected research notebook library as primary source material${
							firstNotebookTitle ? ` (“${firstNotebookTitle}”)` : ""
						}. Ground claims, methods, and findings in notebook notes, datasets, files, figures, and lab work.`
				: "";
		const trimmedTopic = typedTopic || firstNotebookTitle || copy.fallbackTopic;
		const plainFieldValues: Record<string, string> = {};
		for (const field of copy.fields) {
			const raw = fieldValues[field.id] ?? "";
			plainFieldValues[field.id] =
				field.kind === "textarea" ? plainFromRich(raw) : raw;
		}
		const brief = useRichBrief
			? [notebookDirective, briefFromRich].filter(Boolean).join("\n\n")
			: [
					notebookDirective,
					formatScopeBrief(scope, plainFieldValues, instructionsPlain),
				]
					.filter(Boolean)
					.join("\n\n");
		const questions = parseResearchQuestions(plainFieldValues.questions);
		const idea: ResearchIdea = {
			id: `${scope}-${discipline}`,
			title: trimmedTopic,
			rationale:
				brief ||
				(briefUpload
					? `Draft a cited ${documentLabel} from the uploaded assignment brief “${briefUpload.fileName}”.`
					: `Draft a cited ${documentLabel} on “${trimmedTopic}”.`),
			approach: copy.ideaApproach,
			type: resolveBriefIdeaType(scope, fieldValues),
			feasibility: "medium",
			...(questions.length ? { researchQuestions: questions } : {}),
		};
		return { idea, trimmedTopic, brief };
	};

	const clearBriefUpload = () => {
		setBriefUpload(null);
		setSubmitError(null);
		if (briefFileInputRef.current) briefFileInputRef.current.value = "";
	};

	const handleBriefFile = async (file: File | null | undefined) => {
		if (!allowBriefUpload || !file || busy) return;
		if (!isAllowedBriefFile(file)) {
			setSubmitError(
				file.size > BRIEF_UPLOAD_MAX_BYTES
					? "Assignment briefs must be 12 MB or smaller."
					: "Upload a PDF, Word (.docx), or text (.txt / .md) brief.",
			);
			return;
		}

		setUploadingBrief(true);
		setSubmitError(null);
		try {
			const name = file.name.toLowerCase();
			const isPlainText = name.endsWith(".txt") || name.endsWith(".md") || (file.type || "").startsWith("text/");
			let extracted = "";

			if (isPlainText) {
				extracted = (await readFileAsText(file)).trim();
			}

			const fileData = await readFileAsDataUrl(file);
			const document = await createDocument({
				title: titleFromFileName(file.name) || "Assignment brief",
				fileName: file.name,
				fileMime: file.type || "application/octet-stream",
				fileData,
				sizeLabel: formatBriefSize(file.size),
			});

			if (!extracted) {
				const sourceContext = await fetchResearchSourceContextFromApi({
					documentIds: [document.id],
					datasetIds: [],
					noteIds: [],
					questionnaireIds: [],
					projectIds: [],
				});
				extracted = plainTextFromSourceContext(sourceContext);
			}

			if (extracted) {
				const nextHtml = toEditorHtml(extracted);
				setBriefHtml((prev) => (htmlHasText(prev) ? `${prev}${nextHtml}` : nextHtml));
			} else {
				setSubmitError(
					"Uploaded. Text could not be previewed in the editor — you can still Generate from the file, or paste the brief manually.",
				);
			}
			setBriefUpload({
				id: document.id,
				fileName: document.fileName || file.name,
				sizeLabel: document.sizeLabel || formatBriefSize(file.size),
			});
		} catch (error) {
			setSubmitError(error instanceof Error ? error.message : "Could not upload assignment brief.");
		} finally {
			setUploadingBrief(false);
			if (briefFileInputRef.current) briefFileInputRef.current.value = "";
		}
	};

	const validateReady = (): boolean => {
		setTouched(true);
		if (!discipline) {
			setSubmitError("Select a department on Research Assistant before generating.");
			return false;
		}
		if (!canGenerate) return false;
		if (!hasTokens) {
			setSubmitError("Research token limit reached.");
			return false;
		}
		if (!hasAcceptedResearchAiNotice()) {
			setAiNoticeOpen(true);
			setSubmitError(null);
			return false;
		}
		return true;
	};

	const handleGenerateClick = () => {
		if (!validateReady()) return;
		setShowCitationStyleModal(true);
	};

	const handleGenerateOutline = () => {
		if (!showOutlineButton || !validateReady()) return;
		setSubmitting("outline");
		setSubmitError(null);

		try {
			const built = buildIdea();
			if (!built) {
				setSubmitting(null);
				return;
			}
			const { idea, trimmedTopic, brief } = built;
			const sources = selectedSources();
			stagePaperSources(sources);
			if (!loadSavedOutline(idea, discipline, trimmedTopic, scope)) {
				saveResearchOutline({
					idea,
					discipline,
					topic: trimmedTopic,
					scope,
					outline: ideaToEditableDocument(idea, trimmedTopic, discipline, scope),
					sources,
					assignmentInstructions: brief || undefined,
				});
			}
			const key = stageOutlinePageContext({
				idea,
				discipline,
				topic: trimmedTopic,
				scope,
				sources,
				returnTo: backHref,
				assignmentInstructions: brief || undefined,
			});
			router.push(researchOutlinePagePath(key, isStudent ? "student" : "lecturer"));
		} catch (error) {
			setSubmitting(null);
			setSubmitError(error instanceof Error ? error.message : "Could not start outline generation.");
		}
	};

	const confirmGenerate = async (style: CitationStyle) => {
		if (!discipline || !canGenerate) return;
		const chosenStyle = style || DEFAULT_CITATION_STYLE;
		saveChatCitationStyle(chosenStyle);
		setShowCitationStyleModal(false);
		setSubmitting("paper");
		setSubmitError(null);

		try {
			const built = buildIdea();
			if (!built) {
				setSubmitting(null);
				return;
			}
			const { idea, trimmedTopic, brief } = built;
			const sources = selectedSources();
			stagePaperSources(sources);
			const key = stageOutlinePageContext({
				idea,
				discipline,
				topic: trimmedTopic,
				scope,
				citationStyle: chosenStyle,
				sources,
				returnTo: backHref,
				assignmentInstructions: brief || undefined,
			});
			stagePendingResearchPaper({
				key,
				citationStyle: chosenStyle,
				projectName: trimmedTopic,
			});
			router.push(
				researchGeneratingPagePath(
					key,
					isStudent ? "student" : "lecturer",
					trimmedTopic,
					chosenStyle,
				),
			);
		} catch (error) {
			setSubmitting(null);
			setSubmitError(error instanceof Error ? error.message : `Could not start ${documentLabel} generation.`);
		}
	};

	const alerts = (
		<>
			{showError ? <p className="assign-alert">{copy.generateError}</p> : null}
			{submitError ? (
				<p className="assign-alert" role="alert">
					{submitError}
				</p>
			) : null}
			{!hasTokens ? <p className="assign-alert">Research token limit reached.</p> : null}
		</>
	);

	const handleNotebookTitle = (notebook: { id: string; title: string }) => {
		const trimmed = notebook.title.trim().slice(0, 500);
		if (trimmed) {
			notebookTitlesRef.current = { ...notebookTitlesRef.current, [notebook.id]: trimmed };
			setNotebookTitles(notebookTitlesRef.current);
		}
	};

	const loadNotebookAssets = async (ids: string[]) => {
		if (!ids.length) {
			setNotebookDatasets([]);
			setNotebookImages([]);
			setLoadingNotebookTitle("");
			return;
		}

		const seq = ++notebookPrefillSeqRef.current;
		const title =
			ids.map((id) => notebookTitlesRef.current[id]?.trim()).find(Boolean) ||
			"Selected notebook";
		setLoadingNotebookTitle(title);
		setLoadingNotebookPrefill(true);
		setSubmitError(null);
		try {
			const prefill = await loadNotebookBriefPrefill(ids);
			if (seq !== notebookPrefillSeqRef.current) return;

			setNotebookDatasets(prefill.datasets);
			setNotebookImages(prefill.images);
			if (prefill.title?.trim()) setLoadingNotebookTitle(prefill.title.trim());
		} catch (error) {
			if (seq !== notebookPrefillSeqRef.current) return;
			setNotebookDatasets([]);
			setNotebookImages([]);
			setSubmitError(
				error instanceof Error ? error.message : "Could not load notebook assets.",
			);
		} finally {
			if (seq === notebookPrefillSeqRef.current) {
				setLoadingNotebookPrefill(false);
			}
		}
	};

	const handleNotebookSelection = (ids: string[]) => {
		setSelectedProjectIds(ids);
		if (!ids.length) {
			setNotebookDatasets([]);
			setNotebookImages([]);
			return;
		}
		void loadNotebookAssets(ids);
	};

	const libraryPicker = allowNotebookLibrary ? (
		<ResearchNotebookLibraryPicker
			selectedIds={selectedProjectIds}
			onChange={handleNotebookSelection}
			onUseTitle={handleNotebookTitle}
			variant={variant}
			compact={isComposer}
			disabled={busy}
		/>
	) : null;

	const notebookAssets = allowNotebookLibrary ? (
		<ResearchNotebookAssetsPreview
			datasets={notebookDatasets}
			images={notebookImages}
			loading={loadingNotebookPrefill && selectedProjectIds.length > 0}
		/>
	) : null;

	const notebookGenerateNote =
		allowNotebookLibrary && selectedProjectIds.length > 0 ? (
			<p className="assign-notebook-generate-note" role="status">
				Generate will use {selectedProjectIds.length === 1 ? "notebook" : "notebooks"}{" "}
				<strong>
					{selectedProjectIds
						.map((id) => notebookTitles[id]?.trim() || "Untitled notebook")
						.join(", ")}
				</strong>
				{notebookDatasets.length || notebookImages.length
					? ` · ${notebookDatasets.length} dataset${notebookDatasets.length === 1 ? "" : "s"} · ${notebookImages.length} image${notebookImages.length === 1 ? "" : "s"}`
					: ""}{" "}
				as primary source material.
			</p>
		) : null;

	const outlineButton = showOutlineButton ? (
		<button
			type="button"
			className={isComposer ? "assign-composer-send assign-composer-send-secondary" : "assign-btn assign-btn-ghost"}
			onClick={handleGenerateOutline}
			disabled={busy || !hasTokens}
			title={!hasTokens ? "Research token limit reached" : "Generate a research outline from this topic"}
		>
			<IconFileText size={16} />
			{submitting === "outline" ? "Preparing…" : "Generate Outline"}
		</button>
	) : null;

	const generateButton = (
		<button
			type="button"
			className={isComposer ? "assign-composer-send" : "assign-btn assign-btn-primary"}
			onClick={handleGenerateClick}
			disabled={busy || !hasTokens}
			title={!hasTokens ? "Research token limit reached" : isComposer ? `${generateLabel} (⌘ Enter)` : undefined}
		>
			{isComposer ? <IconBrain size={16} /> : <IconSparkles size={16} />}
			{submitting === "paper" ? "Preparing…" : generateLabel}
		</button>
	);

	const page = (
		<div
			className={`assign-page${isComposer ? " assign-page-composer" : ""} research-page`}
		>
			<button type="button" className="assign-back" onClick={() => router.push(backHref)}>
				<IconChevronLeft size={16} />
				Research Assistant
			</button>

			<header className="assign-hero">
				<div className="assign-hero-copy">
					<p className="assign-kicker">
						{sectionAgentKicker(copy.kicker, findSectionAgent(scope, searchParams.get("section")))}
					</p>
					<h1 className="assign-title">{copy.title}</h1>
					<p className="assign-lead">{copy.lead}</p>
					<div className="assign-meta">
						{disciplineLabel ? (
							<span className="assign-chip assign-chip-field">{disciplineLabel}</span>
						) : (
							<span className="assign-chip">Department not set</span>
						)}
						<span className="assign-chip">
							{profile.wordTarget.min.toLocaleString()}–{profile.wordTarget.max.toLocaleString()} words
						</span>
						<span className="assign-chip">{profile.minDistinctCites}+ cited sources</span>
					</div>
				</div>
				<div className="assign-hero-mark" aria-hidden>
					<IconStickyNote size={28} />
				</div>
			</header>

			{isComposer ? (
				<div className="assign-composer">
					<div className="assign-composer-head">
						<label className="assign-composer-label" htmlFor={useRichBrief ? undefined : `${scope}-topic`}>
							{copy.topicTitle}
						</label>
						{copy.topicHelp ? <p className="assign-card-help">{copy.topicHelp}</p> : null}
					</div>
					<div
						className={`assign-composer-field${useRichBrief ? " assign-composer-field-rich" : ""}${briefDragOver ? " is-brief-over" : ""}`}
						onDragEnter={
							allowBriefUpload
								? (event) => {
										event.preventDefault();
										event.stopPropagation();
										if (!busy) setBriefDragOver(true);
									}
								: undefined
						}
						onDragOver={
							allowBriefUpload
								? (event) => {
										event.preventDefault();
										event.stopPropagation();
										if (!busy) setBriefDragOver(true);
									}
								: undefined
						}
						onDragLeave={
							allowBriefUpload
								? (event) => {
										event.preventDefault();
										event.stopPropagation();
										setBriefDragOver(false);
									}
								: undefined
						}
						onDrop={
							allowBriefUpload
								? (event) => {
										event.preventDefault();
										event.stopPropagation();
										setBriefDragOver(false);
										const file = event.dataTransfer.files?.[0];
										void handleBriefFile(file);
									}
								: undefined
						}
					>
						{useRichBrief ? (
							<ScopeBriefRichEditor
								value={briefHtml}
								onChange={setBriefHtml}
								placeholder={topicPlaceholder}
								ariaLabel={copy.topicTitle}
								disabled={busy}
							/>
						) : (
							<textarea
								id={`${scope}-topic`}
								className="assign-composer-input"
								rows={5}
								maxLength={500}
								placeholder={topicPlaceholder}
								value={topic}
								onChange={(event) => setTopic(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
										event.preventDefault();
										handleGenerateClick();
									}
								}}
							/>
						)}
						{allowBriefUpload ? (
							<input
								ref={briefFileInputRef}
								type="file"
								accept={BRIEF_UPLOAD_ACCEPT}
								hidden
								onChange={(event) => {
									const file = event.target.files?.[0];
									void handleBriefFile(file);
								}}
							/>
						) : null}
						<div className="assign-composer-bar">
							{allowBriefUpload ? (
								<div className="assign-composer-bar-start">
									<button
										type="button"
										className={`assign-composer-upload${briefUpload ? " has-file" : ""}`}
										disabled={busy}
										onClick={() => briefFileInputRef.current?.click()}
										title={
											briefUpload
												? `${briefUpload.fileName} · click to replace`
												: "Upload PDF, Word, or text — enough to generate without typing"
										}
									>
										{briefUpload ? <IconFileText size={15} /> : <IconUpload size={15} />}
										<span>
											{uploadingBrief
												? "Uploading…"
												: briefUpload
													? briefUpload.fileName
													: "Upload brief"}
										</span>
									</button>
									{briefUpload ? (
										<button
											type="button"
											className="assign-composer-upload-clear"
											onClick={clearBriefUpload}
											disabled={busy}
											aria-label="Remove uploaded brief"
											title="Remove uploaded brief"
										>
											×
										</button>
									) : null}
									<span className="assign-composer-or-hint">
										{hasTypedBrief && hasUploadedBrief
											? "Using editor + upload"
											: hasUploadedBrief
												? "Ready from upload"
												: hasTypedBrief
													? "Ready from editor"
													: "Type or upload"}
									</span>
								</div>
							) : useRichBrief ? (
								<p className="assign-composer-or-hint">
									{loadingNotebookPrefill
										? "Loading notebook notes…"
										: "Bullets, headings, lists, tables, images · scroll for longer briefs"}
								</p>
							) : (
								<p className="assign-count">{topic.length} / 500</p>
							)}
							<div className="assign-composer-actions">
								{outlineButton}
								{generateButton}
							</div>
						</div>
					</div>
					{notebookAssets}
					{libraryPicker}
					{notebookGenerateNote}
					{alerts}
				</div>
			) : (
			<div className="assign-layout">
				<div className="assign-main">
					<section className="assign-card">
						<div className="assign-card-head">
							<span className="assign-card-icon" aria-hidden>
								<IconTarget size={16} />
							</span>
							<div>
								<h2 className="assign-card-title">{copy.topicTitle}</h2>
								<p className="assign-card-help">{copy.topicHelp}</p>
							</div>
						</div>
						<div className="assign-input-wrap assign-input-wrap-rich">
							<ScopeBriefRichEditor
								value={topic}
								onChange={setTopic}
								placeholder={topicPlaceholder}
								ariaLabel={copy.topicTitle}
								disabled={busy}
							/>
						</div>
						{notebookAssets}
					</section>

					{copy.fields.map((field) => (
						<section key={field.id} className="assign-card">
							<div className="assign-card-head">
								<span className="assign-card-icon" aria-hidden>
									<IconFileText size={16} />
								</span>
								<div>
									<h2 className="assign-card-title">{field.label}</h2>
									{field.help ? <p className="assign-card-help">{field.help}</p> : null}
								</div>
							</div>
							{field.kind === "select" ? (
								<select
									id={`${scope}-${field.id}`}
									className="assign-input"
									value={fieldValues[field.id] ?? ""}
									onChange={(event) => setField(field.id, event.target.value)}
								>
									{(field.options ?? []).map((option) => (
										<option key={option.id} value={option.id}>
											{option.label}
										</option>
									))}
								</select>
							) : field.kind === "textarea" ? (
								<ScopeBriefRichEditor
									value={fieldValues[field.id] ?? ""}
									onChange={(html) => setField(field.id, html)}
									placeholder={field.placeholder}
									ariaLabel={field.label}
									disabled={busy}
								/>
							) : (
								<input
									id={`${scope}-${field.id}`}
									className="assign-input"
									type="text"
									maxLength={field.maxLength ?? 200}
									placeholder={field.placeholder}
									value={fieldValues[field.id] ?? ""}
									onChange={(event) => setField(field.id, event.target.value)}
								/>
							)}
						</section>
					))}

					{copy.showNotes !== false ? (
						<section className="assign-card">
							<div className="assign-card-head">
								<span className="assign-card-icon" aria-hidden>
									<IconFileText size={16} />
								</span>
								<div>
									<h2 className="assign-card-title">{copy.notesTitle}</h2>
									<p className="assign-card-help">{copy.notesHelp}</p>
								</div>
							</div>
							<ScopeBriefRichEditor
								value={instructions}
								onChange={setInstructions}
								placeholder={copy.notesPlaceholder}
								ariaLabel={copy.notesTitle}
								disabled={busy}
							/>
						</section>
					) : null}

					{libraryPicker}
					{notebookGenerateNote}
					{alerts}
				</div>
			</div>
			)}

			{isComposer ? null : (
			<footer className="assign-actions">
				<button
					type="button"
					className="assign-btn assign-btn-ghost"
					onClick={() => router.push(backHref)}
				>
					<IconChevronLeft size={16} />
					Back
				</button>
				<div className="assign-composer-actions">
					{outlineButton}
					{generateButton}
				</div>
			</footer>
			)}

			<ResearchAiUseNoticeModal
				open={aiNoticeOpen}
				onAccept={() => setAiNoticeOpen(false)}
				onDecline={() => {
					setAiNoticeOpen(false);
					router.replace(isStudent ? "/student/dashboard" : "/dashboard");
				}}
			/>

			<ResearchNotebookLoadingModal
				open={loadingNotebookPrefill}
				notebookTitle={loadingNotebookTitle}
			/>

			<ResearchCitationStyleModal
				open={showCitationStyleModal}
				onClose={() => setShowCitationStyleModal(false)}
				onConfirm={(style) => void confirmGenerate(style)}
				projectTitle={
					(useRichBrief
						? briefPlain.split(/\n/).map((line) => line.trim()).find(Boolean) ||
							(briefUpload ? titleFromFileName(briefUpload.fileName) : "")
						: plainFromRich(topic).split(/\n/).map((line) => line.trim()).find(Boolean) || "") ||
						copy.fallbackTopic
				}
				variant={isStudent ? "student" : "lecturer"}
				note={`Citations and the References list will use your chosen style throughout the generated ${documentLabel}.`}
				confirmLabel={generateLabel}
			/>
		</div>
	);

	return isStudent ? <StudentLayout>{page}</StudentLayout> : <AulaLayout showRightPanel={false} hideTopBar>{page}</AulaLayout>;
}
