"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
	BarChart3,
	Check,
	ChevronLeft,
	ClipboardList,
	Download,
	FileText,
	FlaskConical,
	ImagePlus,
	Images,
	Loader2,
	Paperclip,
	Pencil,
	Plus,
	Trash2,
	Upload,
} from "lucide-react";

import { NotebookNotesEditor } from "@/components/research-notebook/NotebookNotesEditor";
import { NotebookPlot } from "@/components/research-notebook/NotebookPlot";
import { NotebookQuestionnaire } from "@/components/research-notebook/NotebookQuestionnaire";
import {
	createDataset,
	createDocument,
	deleteDataset,
	deleteDocument,
	fetchDatasetFile,
	fetchDatasets,
	fetchDocumentFile,
	fetchDocuments,
	fetchQuestionnaires,
	GRAPH_CHART_GROUPS,
	plotDataset,
	updateProject,
	downloadDataUrl,
	type GraphChartType,
	type GraphPlotResult,
	type ResearchDataset,
	type ResearchDocument,
	type ResearchProject,
} from "@/lib/research-assets-api";
import { computeNotebookEffort, downloadNotebookEffortReport } from "@/lib/research-notebook-effort";
import {
	COMPILE_NOTEBOOK_EVENT,
	emptyNotebookData,
	isImageDocument,
	newNotebookId,
	type NotebookLabEntry,
	type NotebookPage,
	type ResearchNotebookData,
} from "@/lib/research-notebook";
import type { ResearchQuestionnaire } from "@/lib/research-questionnaire";

type Tab = "materials" | "survey" | "data" | "images" | "lab";

function isImageFile(file: File): boolean {
	return file.type.startsWith("image/") && /jpeg|jpg|png|gif|webp/i.test(file.type);
}

export function NotebookWorkspace({
	project,
	notebooksHref,
	onProjectChange,
}: {
	project: ResearchProject;
	notebooksHref: string;
	onProjectChange: (next: ResearchProject) => void;
}) {
	const [tab, setTab] = useState<Tab>("materials");
	const [notebook, setNotebook] = useState<ResearchNotebookData>(
		project.notebookData ?? emptyNotebookData(),
	);
	const [pageId, setPageId] = useState<string | null>(notebook.pages[0]?.id ?? null);
	const [datasets, setDatasets] = useState<ResearchDataset[]>([]);
	const [documents, setDocuments] = useState<ResearchDocument[]>([]);
	const [questionnaires, setQuestionnaires] = useState<ResearchQuestionnaire[]>([]);
	const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
	const [datasetId, setDatasetId] = useState<string | null>(null);
	const [previewRows, setPreviewRows] = useState<string>("");
	const [plotPrompt, setPlotPrompt] = useState("");
	const [chartType, setChartType] = useState<GraphChartType>("bar");
	const [plot, setPlot] = useState<GraphPlotResult | null>(null);
	const [busy, setBusy] = useState("");
	const [error, setError] = useState("");
	const [labTitle, setLabTitle] = useState("");
	const [labBody, setLabBody] = useState("");
	const [compiling, setCompiling] = useState(false);
	const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
	const saveTimer = useRef<number | null>(null);
	const [editingTitle, setEditingTitle] = useState(false);
	const [titleDraft, setTitleDraft] = useState(project.title);
	const [renaming, setRenaming] = useState(false);
	const titleInputRef = useRef<HTMLInputElement>(null);
	const skipTitleCommit = useRef(false);

	const images = useMemo(
		() => documents.filter((d) => isImageDocument(d.fileMime)),
		[documents],
	);
	const activePage = notebook.pages.find((p) => p.id === pageId) ?? null;

	const persistNotebook = useCallback(
		async (next: ResearchNotebookData) => {
			const snapshot = computeNotebookEffort({
				notebook: next,
				questionnaires,
				datasets,
				documents,
			});
			setSaveState("saving");
			try {
				const updated = await updateProject(project.id, {
					notebookData: next,
					progress: snapshot.userEffortScore,
				});
				onProjectChange(updated);
				setSaveState("saved");
			} catch (err) {
				setSaveState("error");
				throw err;
			}
		},
		[onProjectChange, project.id, questionnaires, datasets, documents],
	);

	const scheduleSave = useCallback(
		(next: ResearchNotebookData) => {
			setNotebook(next);
			if (saveTimer.current) window.clearTimeout(saveTimer.current);
			saveTimer.current = window.setTimeout(() => {
				persistNotebook(next).catch((err: unknown) => {
					setSaveState("error");
					setError(err instanceof Error ? err.message : "Could not save notebook.");
				});
			}, 700);
		},
		[persistNotebook],
	);

	const loadAssets = useCallback(async () => {
		const [ds, docs, qs] = await Promise.all([
			fetchDatasets(project.id),
			fetchDocuments(project.id),
			fetchQuestionnaires(project.id),
		]);
		setDatasets(ds);
		setDocuments(docs);
		setQuestionnaires(qs);
		setDatasetId((current) => current ?? ds[0]?.id ?? null);
	}, [project.id]);

	useEffect(() => {
		loadAssets().catch((err: unknown) => {
			setError(err instanceof Error ? err.message : "Could not load files.");
		});
	}, [loadAssets]);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			const missing = images.filter((img) => !imageUrls[img.id]);
			if (!missing.length) return;
			const next: Record<string, string> = {};
			for (const img of missing) {
				const file = await fetchDocumentFile(img.id);
				if (file?.data) next[img.id] = file.data;
			}
			if (!cancelled && Object.keys(next).length) {
				setImageUrls((prev) => ({ ...prev, ...next }));
			}
		})().catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, [images, imageUrls]);

	useEffect(() => {
		if (notebook.pages.length > 0) return;
		const page: NotebookPage = {
			id: newNotebookId(),
			title: project.title || "Untitled document",
			html: "<p></p>",
			updatedAt: new Date().toISOString(),
		};
		const next = { ...notebook, pages: [page] };
		setNotebook(next);
		setPageId(page.id);
		void persistNotebook(next);
	}, [notebook.pages.length, persistNotebook, project.title]);

	useEffect(() => {
		return () => {
			if (saveTimer.current) window.clearTimeout(saveTimer.current);
		};
	}, []);

	useEffect(() => {
		if (editingTitle) return;
		setTitleDraft(project.title);
	}, [project.title, editingTitle]);

	useEffect(() => {
		if (!editingTitle) return;
		const t = window.setTimeout(() => {
			titleInputRef.current?.focus();
			titleInputRef.current?.select();
		}, 0);
		return () => window.clearTimeout(t);
	}, [editingTitle]);

	function startRename() {
		if (renaming) return;
		skipTitleCommit.current = false;
		setTitleDraft(project.title);
		setEditingTitle(true);
	}

	function cancelRename() {
		skipTitleCommit.current = true;
		setTitleDraft(project.title);
		setEditingTitle(false);
	}

	async function commitRename() {
		if (skipTitleCommit.current) {
			skipTitleCommit.current = false;
			return;
		}
		const next = titleDraft.trim();
		if (!next) {
			cancelRename();
			return;
		}
		if (next === project.title.trim()) {
			setEditingTitle(false);
			setTitleDraft(project.title);
			return;
		}
		setRenaming(true);
		setSaveState("saving");
		try {
			const updated = await updateProject(project.id, { title: next });
			onProjectChange(updated);
			setTitleDraft(updated.title);
			setEditingTitle(false);
			setSaveState("saved");
		} catch (err) {
			setSaveState("error");
			setError(err instanceof Error ? err.message : "Could not rename notebook.");
			setTitleDraft(project.title);
			setEditingTitle(false);
		} finally {
			setRenaming(false);
		}
	}

	function patchPages(pages: NotebookPage[]) {
		scheduleSave({ ...notebook, pages });
	}

	function addPage() {
		const page: NotebookPage = {
			id: newNotebookId(),
			title: "Untitled note",
			html: "<p></p>",
			updatedAt: new Date().toISOString(),
		};
		patchPages([page, ...notebook.pages]);
		setPageId(page.id);
	}

	function updateActivePage(patch: Partial<NotebookPage>) {
		if (!activePage) return;
		patchPages(
			notebook.pages.map((p) =>
				p.id === activePage.id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p,
			),
		);
	}

	function removePage(id: string) {
		const pages = notebook.pages.filter((p) => p.id !== id);
		patchPages(pages);
		if (pageId === id) setPageId(pages[0]?.id ?? null);
	}

	async function onUploadDataset(file: File) {
		setError("");
		setBusy("Uploading dataset…");
		try {
			const created = await createDataset({
				title: file.name.replace(/\.[^.]+$/, "") || file.name,
				description: `Uploaded ${file.name}`,
				discipline: "",
				format: file.name.split(".").pop()?.toLowerCase() || "csv",
				year: String(new Date().getFullYear()),
				license: "",
				accessUrl: "",
				sizeLabel: "",
				tagsText: "",
				visibility: "private",
				projectId: project.id,
				file,
			});
			setDatasets((prev) => [created, ...prev]);
			setDatasetId(created.id);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Upload failed.");
		} finally {
			setBusy("");
		}
	}

	async function onSelectDataset(id: string) {
		setDatasetId(id);
		setPlot(null);
		setPreviewRows("");
		try {
			const file = await fetchDatasetFile(id);
			if (!file?.data) return;
			if (!/csv|tsv|json|text|plain/i.test(file.mime) && !/\.(csv|tsv|json|txt)$/i.test(file.name)) {
				setPreviewRows("");
				return;
			}
			try {
				const raw = file.data.includes("base64,")
					? atob(file.data.split("base64,")[1] ?? "")
					: file.data;
				setPreviewRows(raw.slice(0, 4000));
			} catch {
				setPreviewRows("");
			}
		} catch {
			setPreviewRows("");
		}
	}

	async function onPlot() {
		if (!datasetId) return;
		setError("");
		setBusy("Plotting with AI…");
		try {
			const result = await plotDataset(datasetId, { chartType, prompt: plotPrompt });
			setPlot(result);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not plot dataset.");
		} finally {
			setBusy("");
		}
	}

	async function onUploadImages(files: FileList | null) {
		if (!files?.length) return;
		setError("");
		setBusy("Uploading images…");
		try {
			for (const file of Array.from(files)) {
				if (!isImageFile(file)) throw new Error("Use JPEG, PNG, GIF, or WebP images.");
				if (file.size > 8 * 1024 * 1024) throw new Error("Images must be 8 MB or smaller.");
				const data = await readFileAsDataUrl(file);
				const created = await createDocument({
					title: file.name,
					fileName: file.name,
					fileMime: file.type,
					fileData: data,
					projectId: project.id,
				});
				setDocuments((prev) => [created, ...prev]);
				setImageUrls((prev) => ({ ...prev, [created.id]: data }));
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Image upload failed.");
		} finally {
			setBusy("");
		}
	}

	function addLabEntry() {
		if (!labTitle.trim() && !labBody.trim()) return;
		const entry: NotebookLabEntry = {
			id: newNotebookId(),
			at: new Date().toISOString(),
			title: labTitle.trim() || "Lab entry",
			body: labBody.trim(),
			imageDocumentIds: [],
		};
		scheduleSave({ ...notebook, labEntries: [entry, ...notebook.labEntries] });
		setLabTitle("");
		setLabBody("");
	}

	function removeLabEntry(id: string) {
		scheduleSave({ ...notebook, labEntries: notebook.labEntries.filter((entry) => entry.id !== id) });
	}

	function attachLabImage(entryId: string, imageId: string) {
		scheduleSave({
			...notebook,
			labEntries: notebook.labEntries.map((entry) =>
				entry.id === entryId && !entry.imageDocumentIds.includes(imageId)
					? { ...entry, imageDocumentIds: [...entry.imageDocumentIds, imageId] }
					: entry,
			),
		});
	}

	const effort = useMemo(
		() =>
			computeNotebookEffort({
				notebook,
				questionnaires,
				datasets,
				documents,
			}),
		[notebook, questionnaires, datasets, documents],
	);

	useEffect(() => {
		if (effort.userEffortScore === project.progress) return;
		void persistNotebook(notebook).catch(() => undefined);
	}, [effort.userEffortScore, notebook, persistNotebook, project.progress]);

	const compileNote = useCallback(async () => {
		if (compiling) return;
		setCompiling(true);
		setError("");
		try {
			await downloadNotebookEffortReport({
				title: project.title,
				description: project.description,
				notebookId: project.id,
				effort,
			});
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Could not compile effort report.");
		} finally {
			setCompiling(false);
		}
	}, [compiling, effort, project.description, project.title]);

	useEffect(() => {
		const onCompile = () => {
			void compileNote();
		};
		window.addEventListener(COMPILE_NOTEBOOK_EVENT, onCompile);
		return () => window.removeEventListener(COMPILE_NOTEBOOK_EVENT, onCompile);
	}, [compileNote]);

	const tabs: Array<{ id: Tab; label: string; icon: ReactNode; count: number }> = [
		{ id: "materials", label: "Document", icon: <FileText className="size-3.5" />, count: effort.pages },
		{ id: "survey", label: "Survey", icon: <ClipboardList className="size-3.5" />, count: effort.questionnaires },
		{ id: "data", label: "Data", icon: <BarChart3 className="size-3.5" />, count: effort.datasets },
		{ id: "images", label: "Pictures", icon: <Images className="size-3.5" />, count: effort.pictures },
		{ id: "lab", label: "Lab work", icon: <FlaskConical className="size-3.5" />, count: effort.labEntries },
	];

	const saveLabel =
		saveState === "saving"
			? "Saving…"
			: saveState === "error"
				? "Save failed"
				: saveState === "saved"
					? "Saved"
					: "Autosave on";

	return (
		<div className="nb-studio">
			<header className="nb-studio-chrome">
				<div className="nb-studio-chrome-lead">
					<Link href={notebooksHref} className="nb-studio-back">
						<ChevronLeft className="size-4" aria-hidden />
						Notebooks
					</Link>
					<div className="nb-studio-titles">
						<p className="nb-studio-kicker">Research notebook</p>
						{editingTitle ? (
							<input
								ref={titleInputRef}
								className="nb-studio-heading-input"
								value={titleDraft}
								onChange={(e) => setTitleDraft(e.target.value)}
								onBlur={() => void commitRename()}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										e.currentTarget.blur();
									}
									if (e.key === "Escape") {
										e.preventDefault();
										cancelRename();
									}
								}}
								aria-label="Notebook title"
								maxLength={160}
								disabled={renaming}
							/>
						) : (
							<div className="nb-studio-heading-row">
								<h1 className="nb-studio-heading">
									<button
										type="button"
										className="nb-studio-heading-btn"
										onClick={startRename}
										aria-label="Rename notebook"
									>
										{project.title || "Untitled notebook"}
									</button>
								</h1>
								<button
									type="button"
									className="nb-studio-rename"
									onClick={startRename}
									aria-label="Rename notebook"
								>
									<Pencil className="size-3.5" aria-hidden />
								</button>
							</div>
						)}
					</div>
				</div>
				<div className="nb-studio-chrome-meta">
					<div className="nb-effort-compact" aria-labelledby="nb-effort-title">
						<div
							className="saved-research-effort-ring"
							style={{ ["--p" as string]: String(effort.userEffortScore) }}
							aria-label={`Overall score of user’s input: ${effort.userEffortScore} out of 100`}
						>
							<span className="saved-research-effort-ring-value">{effort.userEffortScore}</span>
							<span className="saved-research-effort-ring-max">/100</span>
						</div>
						<div className="nb-effort-copy">
							<p id="nb-effort-title" className="nb-effort-label">
								Overall score of user’s input
							</p>
							<p className="nb-effort-band">{effort.userBandLabel}</p>
							<div
								className="nb-effort-bar"
								role="progressbar"
								aria-valuemin={0}
								aria-valuemax={100}
								aria-valuenow={effort.captureScore}
								aria-label={`Capture score: ${effort.captureScore} percent`}
							>
								<span style={{ width: `${effort.captureScore}%` }} />
							</div>
							<p className="nb-effort-meta">
								Capture {effort.captureScore}% · writing {effort.writingScore}% ·{" "}
								{effort.totalWordsInserted.toLocaleString()}{" "}
								{effort.totalWordsInserted === 1 ? "word" : "words"}
							</p>
						</div>
					</div>
					<p className={`nb-save-chip nb-save-chip-${saveState}`} aria-live="polite">
						{saveState === "saving" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
						{saveState === "saved" ? <Check className="size-3.5" aria-hidden /> : null}
						{saveLabel}
					</p>
					<button type="button" className="nb-btn nb-btn-ghost" onClick={() => void compileNote()} disabled={compiling}>
						{compiling ? "Compiling…" : "Compile report"}
					</button>
				</div>
			</header>

			<nav className="nb-studio-tabs" aria-label="Notebook sections">
				<div className="nb-tabs" role="tablist">
					{tabs.map((item) => (
						<button
							key={item.id}
							type="button"
							role="tab"
							id={`nb-tab-${item.id}`}
							aria-selected={tab === item.id}
							aria-controls={`nb-panel-${item.id}`}
							className={tab === item.id ? "is-on" : ""}
							onClick={() => setTab(item.id)}
						>
							{item.icon}
							<span>{item.label}</span>
							<span className="nb-tab-count">{item.count}</span>
						</button>
					))}
				</div>
			</nav>

			<div className="nb-studio-body">
				<div className="nb-studio-stage">
					{busy || error ? (
						<div className="nb-studio-toast" role={error ? "alert" : "status"}>
							{busy ? <p className="nb-busy">{busy}</p> : null}
							{error ? (
								<p className="nb-error">
									{error}{" "}
									<button type="button" className="nb-inline-dismiss" onClick={() => setError("")}>
										Dismiss
									</button>
								</p>
							) : null}
						</div>
					) : null}

			{tab === "materials" && (
				<div className="nb-doc" role="tabpanel" id="nb-panel-materials" aria-labelledby="nb-tab-materials">
					<div className="nb-switcher">
						<p className="nb-switcher-label">Pages</p>
						<div className="nb-switcher-scroll" role="list">
							{notebook.pages.map((page) => (
								<div key={page.id} className={`nb-chip ${page.id === pageId ? "is-on" : ""}`} role="listitem">
									<button type="button" className="nb-chip-open" onClick={() => setPageId(page.id)}>
										<span>{page.title || "Untitled"}</span>
									</button>
									<button
										type="button"
										className="nb-chip-remove"
										onClick={() => removePage(page.id)}
										aria-label={`Remove ${page.title || "page"}`}
									>
										<Trash2 className="size-3.5" />
									</button>
								</div>
							))}
						</div>
						<button type="button" className="nb-outline-add" onClick={addPage}>
							<Plus className="size-3.5" aria-hidden />
							New page
						</button>
					</div>
					<div className="nb-doc-stage">
						{activePage ? (
							<>
								<input
									className="nb-doc-title"
									value={activePage.title}
									onChange={(e) => updateActivePage({ title: e.target.value })}
									aria-label="Page title"
									placeholder="Page title"
								/>
								<NotebookNotesEditor
									key={activePage.id}
									value={activePage.html}
									projectId={project.id}
									onChange={(html) => updateActivePage({ html })}
									onImageUploaded={() => void loadAssets()}
								/>
							</>
						) : (
							<BlankState
								icon={<FileText className="size-7" />}
								title="Start writing"
								body="Create a page to open a manuscript-style editor. Paste figures, tables, and notes as you work."
							>
								<button type="button" className="nb-btn nb-btn-primary" onClick={addPage}>
									New page
								</button>
							</BlankState>
						)}
					</div>
				</div>
			)}

			{tab === "survey" && (
				<div role="tabpanel" id="nb-panel-survey" aria-labelledby="nb-tab-survey" className="nb-panel-fill">
				<NotebookQuestionnaire
					projectId={project.id}
					onBusy={setBusy}
					onError={setError}
					onCaptureChange={setQuestionnaires}
					onOpenInData={(id) => {
						setDatasetId(id);
						setTab("data");
						void loadAssets();
						void onSelectDataset(id);
					}}
				/>
				</div>
			)}

			{tab === "data" && (
				<div className="nb-data" role="tabpanel" id="nb-panel-data" aria-labelledby="nb-tab-data">
					<div className="nb-switcher">
						<p className="nb-switcher-label">Datasets</p>
						<div className="nb-switcher-scroll" role="list">
							{datasets.map((ds) => (
								<div key={ds.id} className={`nb-chip ${ds.id === datasetId ? "is-on" : ""}`} role="listitem">
									<button type="button" className="nb-chip-open" onClick={() => void onSelectDataset(ds.id)}>
										<span>{ds.title}</span>
										<small>{ds.format || ds.fileName || "dataset"}</small>
									</button>
									<button
										type="button"
										className="nb-chip-remove"
										aria-label={`Remove ${ds.title}`}
										onClick={() => {
											void deleteDataset(ds.id).then(() => {
												setDatasets((prev) => prev.filter((d) => d.id !== ds.id));
												if (datasetId === ds.id) {
													setDatasetId(null);
													setPlot(null);
												}
											});
										}}
									>
										×
									</button>
								</div>
							))}
						</div>
						<label className="nb-data-upload">
							<Upload className="size-3.5" aria-hidden />
							Upload
							<input
								type="file"
								accept=".csv,.tsv,.json,.xlsx,.xls,.txt"
								hidden
								onChange={(e) => {
									const file = e.target.files?.[0];
									e.target.value = "";
									if (file) void onUploadDataset(file);
								}}
							/>
						</label>
					</div>
					<div className="nb-data-stage">
						{datasetId ? (
							<>
								<div className="nb-data-toolbar">
									<label className="nb-data-field">
										<span>Chart</span>
										<select value={chartType} onChange={(e) => setChartType(e.target.value as GraphChartType)}>
											{GRAPH_CHART_GROUPS.map((group) => (
												<optgroup key={group.label} label={group.label}>
													{group.options.map((opt) => (
														<option key={opt.value} value={opt.value}>
															{opt.label}
														</option>
													))}
												</optgroup>
											))}
										</select>
									</label>
									<label className="nb-data-field nb-data-field-grow">
										<span>Ask AI</span>
										<input
											value={plotPrompt}
											onChange={(e) => setPlotPrompt(e.target.value)}
											placeholder="Plot mean yield by treatment as a bar chart"
										/>
									</label>
									<button type="button" className="nb-data-plot" onClick={() => void onPlot()} disabled={Boolean(busy)}>
										{busy.startsWith("Plot") ? "Plotting…" : "Plot with AI"}
									</button>
								</div>
								{plot ? (
									<NotebookPlot
										plot={plot}
										onSavePicture={async (dataUrl, fileName) => {
											const created = await createDocument({
												title: fileName.replace(/\.png$/i, ""),
												fileName,
												fileMime: "image/png",
												fileData: dataUrl,
												projectId: project.id,
											});
											setDocuments((prev) => [created, ...prev]);
											setImageUrls((prev) => ({ ...prev, [created.id]: dataUrl }));
										}}
									/>
								) : (
									<BlankState
										icon={<BarChart3 className="size-7" />}
										title="Ready to plot"
										body="Choose a chart type and describe the figure. The plot will appear here."
									/>
								)}
								{previewRows ? (
									<details className="nb-data-preview">
										<summary>Data preview</summary>
										<pre aria-label="Dataset preview">{previewRows}</pre>
									</details>
								) : null}
							</>
						) : (
							<BlankState
								icon={<BarChart3 className="size-7" />}
								title="No dataset selected"
								body="Upload a CSV, TSV, JSON, or Excel file, then generate a figure with AI."
							>
								<label className="nb-btn nb-btn-primary">
									<Upload className="size-3.5" />
									Upload dataset
									<input
										type="file"
										accept=".csv,.tsv,.json,.xlsx,.xls,.txt"
										hidden
										onChange={(e) => {
											const file = e.target.files?.[0];
											e.target.value = "";
											if (file) void onUploadDataset(file);
										}}
									/>
								</label>
							</BlankState>
						)}
					</div>
				</div>
			)}

			{tab === "images" && (
				<div className="nb-media" role="tabpanel" id="nb-panel-images" aria-labelledby="nb-tab-images">
					<header className="nb-media-toolbar">
						<div>
							<p className="nb-media-kicker">Figure library</p>
							<h2>Pictures</h2>
						</div>
						<label className="nb-btn nb-btn-primary">
							<Upload className="size-3.5" />
							Upload pictures
							<input
								type="file"
								accept="image/jpeg,image/png,image/gif,image/webp"
								multiple
								hidden
								onChange={(e) => {
									const files = e.target.files;
									e.target.value = "";
									void onUploadImages(files);
								}}
							/>
						</label>
					</header>
					{images.length === 0 ? (
						<BlankState
							icon={<ImagePlus className="size-8" />}
							title="Figure library is empty"
							body="Drop gels, instrument photos, screenshots, or exported plots. JPEG, PNG, GIF, or WebP up to 8 MB."
						>
							<label className="nb-btn nb-btn-primary">
								<Upload className="size-3.5" />
								Choose files
								<input
									type="file"
									accept="image/jpeg,image/png,image/gif,image/webp"
									multiple
									hidden
									onChange={(e) => {
										const files = e.target.files;
										e.target.value = "";
										void onUploadImages(files);
									}}
								/>
							</label>
						</BlankState>
					) : (
						<ul className="nb-media-grid">
							{images.map((img) => (
								<li key={img.id} className="nb-media-card">
									<div className="nb-media-thumb">
										{imageUrls[img.id] ? (
											// eslint-disable-next-line @next/next/no-img-element
											<img src={imageUrls[img.id]} alt={img.title} />
										) : (
											<span>Loading…</span>
										)}
										<div className="nb-media-actions">
											<button
												type="button"
												className="nb-icon-btn"
												disabled={!imageUrls[img.id]}
												aria-label="Download picture"
												onClick={() => {
													if (imageUrls[img.id]) downloadDataUrl(imageUrls[img.id], img.fileName || img.title);
												}}
											>
												<Download className="size-3.5" />
											</button>
											<button
												type="button"
												className="nb-icon-btn nb-icon-btn-danger"
												aria-label="Remove picture"
												onClick={() => {
													void deleteDocument(img.id).then(() => {
														setDocuments((prev) => prev.filter((d) => d.id !== img.id));
													});
												}}
											>
												<Trash2 className="size-3.5" />
											</button>
										</div>
									</div>
									<p>{img.title}</p>
								</li>
							))}
						</ul>
					)}
				</div>
			)}

			{tab === "lab" && (
				<div className="nb-lab" role="tabpanel" id="nb-panel-lab" aria-labelledby="nb-tab-lab">
					<header className="nb-media-toolbar">
						<div>
							<p className="nb-media-kicker">Electronic lab log</p>
							<h2>Lab work</h2>
						</div>
					</header>
					<div className="nb-lab-composer">
						<label className="nb-lab-field">
							<span>Title</span>
							<input value={labTitle} onChange={(e) => setLabTitle(e.target.value)} placeholder="Experiment, protocol, or observation" />
						</label>
						<label className="nb-lab-field">
							<span>Notes</span>
							<textarea value={labBody} onChange={(e) => setLabBody(e.target.value)} placeholder="Reagents, conditions, results…" rows={4} />
						</label>
						<button type="button" className="nb-btn nb-btn-primary" onClick={addLabEntry}>
							<Plus className="size-3.5" />
							Add entry
						</button>
					</div>
					{notebook.labEntries.length === 0 ? (
						<BlankState
							icon={<FlaskConical className="size-8" />}
							title="No lab entries yet"
							body="Log protocols, reagents, and observations as you work. Attach pictures from the library."
						/>
					) : (
						<ol className="nb-lab-timeline">
							{notebook.labEntries.map((entry) => (
								<li key={entry.id}>
									<div className="nb-lab-dot" aria-hidden />
									<article className="nb-lab-card">
										<header>
											<div>
												<strong>{entry.title}</strong>
												<time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>
											</div>
											<button
												type="button"
												className="nb-icon-btn nb-icon-btn-danger"
												aria-label="Remove lab entry"
												onClick={() => removeLabEntry(entry.id)}
											>
												<Trash2 className="size-3.5" />
											</button>
										</header>
										{entry.body ? <p>{entry.body}</p> : null}
										{entry.imageDocumentIds.length > 0 && (
											<div className="nb-lab-thumbs">
												{entry.imageDocumentIds.map((id) =>
													imageUrls[id] ? (
														// eslint-disable-next-line @next/next/no-img-element
														<img key={id} src={imageUrls[id]} alt="" />
													) : null,
												)}
											</div>
										)}
										{images.length > 0 && (
											<label className="nb-lab-attach">
												<Paperclip className="size-3.5" />
												<select
													defaultValue=""
													onChange={(e) => {
														if (e.target.value) attachLabImage(entry.id, e.target.value);
														e.target.value = "";
													}}
												>
													<option value="">Attach picture</option>
													{images.map((img) => (
														<option key={img.id} value={img.id}>
															{img.title}
														</option>
													))}
												</select>
											</label>
										)}
									</article>
								</li>
							))}
						</ol>
					)}
				</div>
			)}
				</div>
			</div>
		</div>
	);
}

function BlankState({
	icon,
	title,
	body,
	children,
}: {
	icon: ReactNode;
	title: string;
	body: string;
	children?: ReactNode;
}) {
	return (
		<div className="nb-blank">
			<div className="nb-blank-icon" aria-hidden>
				{icon}
			</div>
			<h3>{title}</h3>
			<p>{body}</p>
			{children}
		</div>
	);
}

function readFileAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === "string") resolve(reader.result);
			else reject(new Error("Could not read file."));
		};
		reader.onerror = () => reject(new Error("Could not read file."));
		reader.readAsDataURL(file);
	});
}
