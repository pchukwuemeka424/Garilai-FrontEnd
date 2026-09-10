"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
	BarChart3,
	Check,
	ChevronLeft,
	ClipboardList,
	Download,
	FileSpreadsheet,
	FileText,
	FlaskConical,
	ImagePlus,
	Images,
	Loader2,
	Paperclip,
	Pencil,
	Plus,
	Sparkles,
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

type DatasetPreview = {
	headers: string[];
	rows: string[][];
	totalLines: number;
	truncated: boolean;
};

function isImageFile(file: File): boolean {
	return file.type.startsWith("image/") && /jpeg|jpg|png|gif|webp/i.test(file.type);
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
	const cells: string[] = [];
	let current = "";
	let inQuotes = false;
	for (let i = 0; i < line.length; i += 1) {
		const ch = line[i];
		if (ch === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"';
				i += 1;
			} else {
				inQuotes = !inQuotes;
			}
			continue;
		}
		if (ch === delimiter && !inQuotes) {
			cells.push(current.trim());
			current = "";
			continue;
		}
		current += ch;
	}
	cells.push(current.trim());
	return cells;
}

function parseDatasetPreview(raw: string, formatHint: string): DatasetPreview | null {
	const text = raw.replace(/^\uFEFF/, "").trim();
	if (!text) return null;

	const format = formatHint.toLowerCase();
	if (format.includes("json") || text.startsWith("{") || text.startsWith("[")) {
		try {
			const parsed: unknown = JSON.parse(text);
			if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object" && parsed[0]) {
				const headers = Array.from(
					new Set(
						parsed.flatMap((row) =>
							row && typeof row === "object" ? Object.keys(row as Record<string, unknown>) : [],
						),
					),
				).slice(0, 12);
				const rows = parsed.slice(0, 40).map((row) =>
					headers.map((key) => {
						const value = row && typeof row === "object" ? (row as Record<string, unknown>)[key] : "";
						if (value == null) return "";
						if (typeof value === "object") return JSON.stringify(value);
						return String(value);
					}),
				);
				return {
					headers,
					rows,
					totalLines: parsed.length,
					truncated: parsed.length > rows.length,
				};
			}
		} catch {
			/* fall through to delimited parse */
		}
	}

	const delimiter = format.includes("tsv") || text.includes("\t") ? "\t" : ",";
	const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
	if (lines.length === 0) return null;
	const headers = splitDelimitedLine(lines[0], delimiter).slice(0, 12);
	const dataLines = lines.slice(1, 41);
	const rows = dataLines.map((line) => {
		const cells = splitDelimitedLine(line, delimiter);
		return headers.map((_, i) => cells[i] ?? "");
	});
	return {
		headers,
		rows,
		totalLines: Math.max(0, lines.length - 1),
		truncated: lines.length - 1 > rows.length || headers.length < splitDelimitedLine(lines[0], delimiter).length,
	};
}

function formatDatasetMeta(ds: ResearchDataset): string {
	const format = (ds.format || "").trim().toUpperCase();
	const fileName = (ds.fileName || ds.sizeLabel || "").trim();
	if (format && fileName) return `${format} · ${fileName}`;
	return format || fileName || "Dataset";
}

export function NotebookWorkspace({
	project,
	notebooksHref,
	onProjectChange,
	initialDocuments = [],
	initialDatasets = [],
	initialQuestionnaires = [],
}: {
	project: ResearchProject;
	notebooksHref: string;
	onProjectChange: (next: ResearchProject) => void;
	initialDocuments?: ResearchDocument[];
	initialDatasets?: ResearchDataset[];
	initialQuestionnaires?: ResearchQuestionnaire[];
}) {
	const [tab, setTab] = useState<Tab>("materials");
	const [notebook, setNotebook] = useState<ResearchNotebookData>(
		project.notebookData ?? emptyNotebookData(),
	);
	const [pageId, setPageId] = useState<string | null>(notebook.pages[0]?.id ?? null);
	const [datasets, setDatasets] = useState<ResearchDataset[]>(initialDatasets);
	const [documents, setDocuments] = useState<ResearchDocument[]>(initialDocuments);
	const [questionnaires, setQuestionnaires] = useState<ResearchQuestionnaire[]>(initialQuestionnaires);
	const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
	const [datasetId, setDatasetId] = useState<string | null>(null);
	const [preview, setPreview] = useState<DatasetPreview | null>(null);
	const [previewReady, setPreviewReady] = useState(false);
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
	const files = useMemo(
		() => documents.filter((d) => !isImageDocument(d.fileMime)),
		[documents],
	);
	const activePage = notebook.pages.find((p) => p.id === pageId) ?? null;
	const activeDataset = datasets.find((ds) => ds.id === datasetId) ?? null;

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
		if (!datasetId) {
			setPreview(null);
			setPreviewReady(false);
			return;
		}
		let cancelled = false;
		setPreviewReady(false);
		(async () => {
			try {
				const file = await fetchDatasetFile(datasetId);
				if (cancelled) return;
				if (!file?.data) {
					setPreview(null);
					setPreviewReady(true);
					return;
				}
				const textLike =
					/csv|tsv|json|text|plain/i.test(file.mime) || /\.(csv|tsv|json|txt)$/i.test(file.name);
				if (!textLike) {
					setPreview(null);
					setPreviewReady(true);
					return;
				}
				try {
					const raw = file.data.includes("base64,")
						? atob(file.data.split("base64,")[1] ?? "")
						: file.data;
					const formatHint = file.name.split(".").pop() || file.mime || "";
					setPreview(parseDatasetPreview(raw.slice(0, 120_000), formatHint));
				} catch {
					setPreview(null);
				}
			} catch {
				if (!cancelled) setPreview(null);
			} finally {
				if (!cancelled) setPreviewReady(true);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [datasetId]);

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
			setPlot(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Upload failed.");
		} finally {
			setBusy("");
		}
	}

	function onSelectDataset(id: string) {
		if (id === datasetId) return;
		setDatasetId(id);
		setPlot(null);
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

	async function onUploadFiles(list: FileList | null) {
		if (!list?.length) return;
		setError("");
		setBusy("Uploading files…");
		try {
			for (const file of Array.from(list)) {
				if (isImageFile(file)) {
					throw new Error("Use the Pictures tab for images.");
				}
				if (file.size > 32 * 1024 * 1024) {
					throw new Error("Files must be 32 MB or smaller.");
				}
				const data = await readFileAsDataUrl(file);
				const created = await createDocument({
					title: file.name.replace(/\.[^.]+$/, "") || file.name,
					fileName: file.name,
					fileMime: file.type || "application/octet-stream",
					fileData: data,
					projectId: project.id,
				});
				setDocuments((prev) => [created, ...prev]);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "File upload failed.");
		} finally {
			setBusy("");
		}
	}

	async function onDownloadFile(doc: ResearchDocument) {
		setError("");
		setBusy(`Downloading ${doc.fileName || doc.title}…`);
		try {
			const file = await fetchDocumentFile(doc.id);
			if (!file?.data) throw new Error("Could not download file.");
			downloadDataUrl(file.data, file.name || doc.fileName || doc.title);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not download file.");
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
		{
			id: "materials",
			label: "Document",
			icon: <FileText className="size-3.5" />,
			count: files.length,
		},
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
							className="nb-effort-circle"
							aria-label={`Overall score of user’s input: ${effort.userEffortScore} out of 100`}
						>
							<svg className="size-10 -rotate-90" viewBox="0 0 36 36" aria-hidden>
								<circle
									cx="18"
									cy="18"
									r="14"
									fill="none"
									stroke="#e2e8f0"
									strokeWidth="3.2"
								/>
								<circle
									cx="18"
									cy="18"
									r="14"
									fill="none"
									stroke="#2563eb"
									strokeWidth="3.2"
									strokeDasharray="88"
									strokeDashoffset={88 - (88 * Math.max(0, Math.min(100, effort.userEffortScore))) / 100}
									strokeLinecap="round"
								/>
							</svg>
							<div className="nb-effort-circle-text">
								<span className="nb-effort-circle-score">{effort.userEffortScore}</span>
								<span className="nb-effort-circle-denom">/100</span>
							</div>
						</div>
						<div className="nb-effort-copy">
							<div className="nb-effort-header-row">
								<p id="nb-effort-title" className="nb-effort-label">
									User Effort Score
								</p>
								<span className="nb-effort-band-pill">{effort.userBandLabel}</span>
							</div>
							<div
								className="nb-effort-bar"
								role="progressbar"
								aria-valuemin={0}
								aria-valuemax={100}
								aria-valuenow={effort.userEffortScore}
								aria-label={`User effort score: ${effort.userEffortScore} percent`}
							>
								<span style={{ width: `${Math.max(0, Math.min(100, effort.userEffortScore))}%` }} />
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
					<button type="button" className="nb-btn nb-btn-ghost nb-compile-btn" onClick={() => void compileNote()} disabled={compiling}>
						<Download className="size-3.5 mr-1" aria-hidden />
						{compiling ? "Compiling…" : "Export report"}
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
					<section className="nb-files" aria-label="Uploaded files">
						<header className="nb-files-toolbar">
							<div>
								<p className="nb-media-kicker">Source files</p>
								<h2>Uploaded files</h2>
							</div>
							<label className="nb-btn nb-btn-primary">
								<Upload className="size-3.5" />
								Upload files
								<input
									type="file"
									accept=".pdf,.doc,.docx,.txt,.md,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
									multiple
									hidden
									onChange={(e) => {
										const list = e.target.files;
										e.target.value = "";
										void onUploadFiles(list);
									}}
								/>
							</label>
						</header>
						{files.length === 0 ? (
							<p className="nb-files-empty">
								No PDFs or documents in this notebook yet. Upload briefs, papers, or notes here — they stay with
								this project for Research Assistant and generation.
							</p>
						) : (
							<ul className="nb-files-list">
								{files.map((doc) => (
									<li key={doc.id} className="nb-files-row">
										<span className="nb-files-icon" aria-hidden>
											<Paperclip className="size-4" />
										</span>
										<span className="nb-files-meta">
											<strong>{doc.title || doc.fileName}</strong>
											<small>
												{[doc.fileName, doc.kind, doc.sizeLabel].filter(Boolean).join(" · ")}
											</small>
										</span>
										<span className="nb-files-actions">
											<button
												type="button"
												className="nb-icon-btn"
												aria-label={`Download ${doc.fileName || doc.title}`}
												onClick={() => void onDownloadFile(doc)}
											>
												<Download className="size-3.5" />
											</button>
											<button
												type="button"
												className="nb-icon-btn nb-icon-btn-danger"
												aria-label={`Remove ${doc.fileName || doc.title}`}
												onClick={() => {
													void deleteDocument(doc.id).then(() => {
														setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
													});
												}}
											>
												<Trash2 className="size-3.5" />
											</button>
										</span>
									</li>
								))}
							</ul>
						)}
					</section>
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
						setPlot(null);
						setTab("data");
						void loadAssets();
					}}
				/>
				</div>
			)}

			{tab === "data" && (
				<div className="nb-data" role="tabpanel" id="nb-panel-data" aria-labelledby="nb-tab-data">
					<header className="nb-data-head">
						<div>
							<p className="nb-data-kicker">Analysis studio</p>
							<h2>Data</h2>
							<p className="nb-data-lead">
								Upload tabular files, inspect columns, and generate publication-ready figures with AI.
							</p>
						</div>
						<label className="nb-btn nb-btn-primary">
							<Upload className="size-3.5" aria-hidden />
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
					</header>

					<div className="nb-data-shell">
						<aside className="nb-data-library" aria-label="Dataset library">
							<div className="nb-data-library-head">
								<p>Datasets</p>
								<span>{datasets.length}</span>
							</div>
							{datasets.length === 0 ? (
								<div className="nb-data-library-empty">
									<FileSpreadsheet className="size-5" aria-hidden />
									<p>No datasets yet</p>
									<span>CSV, TSV, JSON, or Excel</span>
								</div>
							) : (
								<ul className="nb-data-library-list">
									{datasets.map((ds) => (
										<li key={ds.id} className={ds.id === datasetId ? "is-on" : ""}>
											<button
												type="button"
												className="nb-data-file"
												onClick={() => onSelectDataset(ds.id)}
											>
												<span className="nb-data-file-icon" aria-hidden>
													<FileSpreadsheet className="size-4" />
												</span>
												<span className="nb-data-file-copy">
													<strong>{ds.title}</strong>
													<small>{formatDatasetMeta(ds)}</small>
												</span>
												<span className="nb-data-file-badge">{(ds.format || "file").toUpperCase()}</span>
											</button>
											<button
												type="button"
												className="nb-data-remove"
												aria-label={`Remove ${ds.title}`}
												onClick={() => {
													void deleteDataset(ds.id).then(() => {
														setDatasets((prev) => {
															const next = prev.filter((d) => d.id !== ds.id);
															if (datasetId === ds.id) {
																setDatasetId(next[0]?.id ?? null);
																setPlot(null);
															}
															return next;
														});
													});
												}}
											>
												<Trash2 className="size-3.5" />
											</button>
										</li>
									))}
								</ul>
							)}
						</aside>

						<div className="nb-data-stage">
							{activeDataset ? (
								<>
									<section className="nb-data-active" aria-label="Selected dataset">
										<div className="nb-data-active-copy">
											<p className="nb-data-kicker">Active dataset</p>
											<h3>{activeDataset.title}</h3>
											<p>{formatDatasetMeta(activeDataset)}</p>
										</div>
										{preview ? (
											<div className="nb-data-active-stats" aria-label="Dataset shape">
												<div>
													<strong>{preview.totalLines.toLocaleString()}</strong>
													<span>Rows</span>
												</div>
												<div>
													<strong>{preview.headers.length}</strong>
													<span>Columns</span>
												</div>
												<div>
													<strong>{(activeDataset.format || "file").toUpperCase()}</strong>
													<span>Format</span>
												</div>
											</div>
										) : null}
									</section>

									<section className="nb-data-composer" aria-label="Plot composer">
										<div className="nb-data-composer-head">
											<span className="nb-data-composer-icon" aria-hidden>
												<Sparkles className="size-4" />
											</span>
											<div>
												<p className="nb-data-kicker">Figure builder</p>
												<strong>Describe the chart you need</strong>
											</div>
										</div>
										<div className="nb-data-toolbar">
											<label className="nb-data-field">
												<span>Chart type</span>
												<select
													value={chartType}
													onChange={(e) => setChartType(e.target.value as GraphChartType)}
												>
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
												<span>Prompt</span>
												<input
													value={plotPrompt}
													onChange={(e) => setPlotPrompt(e.target.value)}
													placeholder="e.g. Plot mean yield by treatment as a grouped bar chart"
													onKeyDown={(e) => {
														if (e.key === "Enter" && !busy) {
															e.preventDefault();
															void onPlot();
														}
													}}
												/>
											</label>
											<button
												type="button"
												className="nb-data-plot"
												onClick={() => void onPlot()}
												disabled={Boolean(busy)}
											>
												<Sparkles className="size-3.5" aria-hidden />
												{busy.startsWith("Plot") ? "Plotting…" : "Plot with AI"}
											</button>
										</div>
									</section>

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
										<div className="nb-data-canvas-empty">
											<div className="nb-blank-icon" aria-hidden>
												<BarChart3 className="size-7" />
											</div>
											<h3>Ready to plot</h3>
											<p>
												Choose a chart type and describe the figure. The plot will appear here for review,
												export, and saving to Pictures.
											</p>
										</div>
									)}

									{preview && preview.headers.length > 0 ? (
										<section className="nb-data-preview" aria-label="Dataset preview">
											<header className="nb-data-preview-head">
												<div>
													<p className="nb-data-kicker">Table preview</p>
													<strong>
														Showing {preview.rows.length.toLocaleString()} of{" "}
														{preview.totalLines.toLocaleString()} rows
													</strong>
												</div>
												{preview.truncated ? <span className="nb-data-preview-note">Truncated for speed</span> : null}
											</header>
											<div className="nb-data-preview-scroll">
												<table>
													<thead>
														<tr>
															{preview.headers.map((header) => (
																<th key={header} scope="col">
																	{header || "—"}
																</th>
															))}
														</tr>
													</thead>
													<tbody>
														{preview.rows.map((row, rowIndex) => (
															<tr key={`preview-row-${rowIndex}`}>
																{row.map((cell, cellIndex) => (
																	<td key={`${rowIndex}-${cellIndex}`}>{cell || "—"}</td>
																))}
															</tr>
														))}
													</tbody>
												</table>
											</div>
										</section>
									) : previewReady ? (
										<p className="nb-data-preview-fallback">
											Preview unavailable for this file type. You can still plot with AI using the figure
											builder above.
										</p>
									) : (
										<p className="nb-data-preview-fallback">Loading table preview…</p>
									)}
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
