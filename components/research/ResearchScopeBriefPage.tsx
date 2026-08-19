"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AulaLayout } from "@/components/AulaLayout";
import { GarilApp } from "@/components/GarilApp";
import { ResearchCitationStyleModal } from "@/components/research/ResearchCitationStyleModal";
import { ResearchNotebookLibraryPicker } from "@/components/research/ResearchNotebookLibraryPicker";
import { StudentLayout } from "@/components/StudentLayout";
import { studentHasResearchTokens } from "@/components/StudentTokenQuota";
import {
	IconChevronLeft,
	IconEdit,
	IconFileText,
	IconBrain,
	IconSparkles,
	IconStickyNote,
	IconTarget,
} from "@/components/ui/ButtonIcon";
import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_CITATION_STYLE, type CitationStyle } from "@/lib/citation-styles";
import { getDisciplineLabel } from "@/lib/research-disciplines";
import { researchPaperWorkspacePath } from "@/lib/research-generate-routes";
import {
	getGenerateResearchLabel,
	getScopeDocumentLabel,
	ideaToEditableDocument,
	type ResearchIdea,
	type ResearchScope,
} from "@/lib/research-ideas";
import { stageOutlinePageContext } from "@/lib/research-outline-context";
import { researchOutlinePagePath } from "@/lib/research-outline-routes";
import { loadSavedOutline, saveResearchOutline } from "@/lib/research-outline-storage";
import { stagePendingResearchPaper } from "@/lib/research-paper-pending";
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

function fieldValueReady(field: ScopeBriefField, values: Record<string, string>): boolean {
	if (!field.required) return true;
	return Boolean(values[field.id]?.trim());
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

	const [workspaceMode, setWorkspaceMode] = useState(() => searchParams.get("generate") === "1");

	useEffect(() => {
		if (searchParams.get("generate") === "1") setWorkspaceMode(true);
	}, [searchParams]);

	const discipline = useMemo(() => {
		const fromQuery = searchParams.get("discipline")?.trim() ?? "";
		if (fromQuery) return fromQuery;
		if (!user?.id) return "";
		return loadResearchWizardDraft(variant, user.id)?.discipline ?? "";
	}, [searchParams, user?.id, variant]);

	const [topic, setTopic] = useState("");
	const [instructions, setInstructions] = useState("");
	const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
	const [notebookTitles, setNotebookTitles] = useState<Record<string, string>>({});
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
	const notesReady = copy.showNotes === false || !copy.notesRequired || Boolean(instructions.trim());
	const allowNotebookLibrary = scope !== "assignment";
	const firstNotebookTitle = selectedProjectIds
		.map((id) => notebookTitles[id]?.trim())
		.find(Boolean);
	const topicReady = Boolean(topic.trim()) || (allowNotebookLibrary && selectedProjectIds.length > 0);
	const canGenerate = topicReady && notesReady && requiredFieldsReady;
	const showError = touched && !canGenerate;
	const topicPlaceholder = topicPlaceholderFor(scope, discipline);
	const isComposer = copy.fields.length === 0 && copy.showNotes === false;
	const busy = Boolean(submitting);

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
		documentIds: [] as string[],
		datasetIds: [] as string[],
		questionnaireIds: [] as string[],
		noteIds: [] as string[],
		projectIds: allowNotebookLibrary ? [...selectedProjectIds] : [],
	});

	const buildIdea = (): { idea: ResearchIdea; trimmedTopic: string; brief: string } | null => {
		if (!discipline || !canGenerate) return null;
		const trimmedTopic = topic.trim() || firstNotebookTitle || copy.fallbackTopic;
		const brief = formatScopeBrief(scope, fieldValues, instructions);
		const questions = parseResearchQuestions(fieldValues.questions);
		const idea: ResearchIdea = {
			id: `${scope}-${discipline}`,
			title: trimmedTopic,
			rationale: brief || `Draft a cited ${documentLabel} on “${trimmedTopic}”.`,
			approach: copy.ideaApproach,
			type: resolveBriefIdeaType(scope, fieldValues),
			feasibility: "medium",
			...(questions.length ? { researchQuestions: questions } : {}),
		};
		return { idea, trimmedTopic, brief };
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
				sources,
				returnTo: backHref,
				assignmentInstructions: brief || undefined,
			});
			stagePendingResearchPaper({
				key,
				citationStyle: style || DEFAULT_CITATION_STYLE,
				projectName: trimmedTopic,
			});
			router.push(
				researchPaperWorkspacePath(trimmedTopic, isStudent ? "student" : "lecturer", key, scope),
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
			setNotebookTitles((prev) => ({ ...prev, [notebook.id]: trimmed }));
			if (!topic.trim()) setTopic(trimmed);
		}
	};

	const libraryPicker = allowNotebookLibrary ? (
		<ResearchNotebookLibraryPicker
			selectedIds={selectedProjectIds}
			onChange={(ids) => setSelectedProjectIds(ids)}
			onUseTitle={handleNotebookTitle}
			variant={variant}
			compact={isComposer}
			disabled={busy}
		/>
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
			className={`assign-page${isComposer ? " assign-page-composer" : ""}${isStudent ? " research-page research-page-student" : " research-page"}`}
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
						<label className="assign-composer-label" htmlFor={`${scope}-topic`}>
							{copy.topicTitle}
						</label>
						{copy.topicHelp ? <p className="assign-card-help">{copy.topicHelp}</p> : null}
					</div>
					<div className="assign-composer-field">
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
						<div className="assign-composer-bar">
							<p className="assign-count">{topic.length} / 500</p>
							<div className="assign-composer-actions">
								{outlineButton}
								{generateButton}
							</div>
						</div>
					</div>
					{libraryPicker}
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
						<div className="assign-input-wrap">
							<span className="assign-input-icon" aria-hidden>
								<IconEdit size={16} />
							</span>
							<textarea
								id={`${scope}-topic`}
								className="assign-input assign-input-topic"
								rows={3}
								maxLength={500}
								placeholder={topicPlaceholder}
								value={topic}
								onChange={(event) => setTopic(event.target.value)}
							/>
						</div>
						<p className="assign-count">{topic.length} / 500</p>
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
								<>
									<textarea
										id={`${scope}-${field.id}`}
										className="assign-input"
										rows={field.rows ?? 5}
										maxLength={field.maxLength ?? 1500}
										placeholder={field.placeholder}
										value={fieldValues[field.id] ?? ""}
										onChange={(event) => setField(field.id, event.target.value)}
									/>
									<p className="assign-count">
										{(fieldValues[field.id] ?? "").length} / {field.maxLength ?? 1500}
									</p>
								</>
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
							<textarea
								id={`${scope}-instructions`}
								className="assign-input"
								rows={8}
								maxLength={4000}
								placeholder={copy.notesPlaceholder}
								value={instructions}
								onChange={(event) => setInstructions(event.target.value)}
							/>
							<p className="assign-count">{instructions.length} / 4000</p>
						</section>
					) : null}

					{libraryPicker}
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

			<ResearchCitationStyleModal
				open={showCitationStyleModal}
				onClose={() => setShowCitationStyleModal(false)}
				onConfirm={(style) => void confirmGenerate(style)}
				projectTitle={topic.trim() || copy.fallbackTopic}
				variant={isStudent ? "student" : "lecturer"}
				note={`Citations and the References list will use your chosen style throughout the generated ${documentLabel}.`}
				confirmLabel={generateLabel}
			/>
		</div>
	);

	return isStudent ? <StudentLayout>{page}</StudentLayout> : <AulaLayout showRightPanel={false}>{page}</AulaLayout>;
}
