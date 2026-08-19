"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardList, Plus, Trash2, Upload } from "lucide-react";

import {
	createDocument,
	createQuestionnaire,
	deleteQuestionnaire,
	fetchQuestionnaires,
	importQuestionnaireResponses,
	updateQuestionnaire,
} from "@/lib/research-assets-api";
import {
	newQuestionnaireItem,
	QUESTIONNAIRE_ITEM_KINDS,
	QUESTIONNAIRE_KIND_LABELS,
	type QuestionnaireItem,
	type QuestionnaireItemKind,
	type ResearchQuestionnaire,
} from "@/lib/research-questionnaire";

export function NotebookQuestionnaire({
	projectId,
	onOpenInData,
	onBusy,
	onError,
	onCaptureChange,
}: {
	projectId: string;
	onOpenInData?: (datasetId: string) => void;
	onBusy: (label: string) => void;
	onError: (message: string) => void;
	onCaptureChange?: (rows: ResearchQuestionnaire[]) => void;
}) {
	const [rows, setRows] = useState<ResearchQuestionnaire[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [title, setTitle] = useState("");
	const [population, setPopulation] = useState("");
	const [sampleSize, setSampleSize] = useState("");
	const [distributionNote, setDistributionNote] = useState("");
	const [description, setDescription] = useState("");
	const [items, setItems] = useState<QuestionnaireItem[]>([]);
	const saveTimer = useRef<number | null>(null);

	const active = rows.find((row) => row.id === activeId) ?? null;

	const load = useCallback(async () => {
		const list = await fetchQuestionnaires(projectId);
		setRows(list);
		setLoaded(true);
		setActiveId((current) => current ?? list[0]?.id ?? null);
	}, [projectId]);

	useEffect(() => {
		load().catch((err: unknown) => {
			onError(err instanceof Error ? err.message : "Could not load questionnaires.");
		});
	}, [load, onError]);

	useEffect(() => {
		if (!onCaptureChange || !loaded) return;
		const merged = rows.map((row) =>
			row.id === activeId
				? {
						...row,
						title,
						population,
						description,
						distributionNote,
						items,
					}
				: row,
		);
		onCaptureChange(merged);
	}, [rows, activeId, title, population, description, distributionNote, items, onCaptureChange]);

	useEffect(() => {
		if (!active) {
			setTitle("");
			setPopulation("");
			setSampleSize("");
			setDistributionNote("");
			setDescription("");
			setItems([]);
			return;
		}
		setTitle(active.title);
		setPopulation(active.population);
		setSampleSize(active.sampleSize ? String(active.sampleSize) : "");
		setDistributionNote(active.distributionNote);
		setDescription(active.description);
		setItems(active.items);
	}, [activeId, active?.updatedAt]);

	const persist = useCallback(
		async (patch: Parameters<typeof updateQuestionnaire>[1]) => {
			if (!activeId) return;
			try {
				const next = await updateQuestionnaire(activeId, patch);
				setRows((prev) => prev.map((row) => (row.id === next.id ? next : row)));
			} catch (err: unknown) {
				onError(err instanceof Error ? err.message : "Could not save questionnaire.");
			}
		},
		[activeId, onError],
	);

	function scheduleItems(nextItems: QuestionnaireItem[]) {
		setItems(nextItems);
		if (!activeId) return;
		if (saveTimer.current) window.clearTimeout(saveTimer.current);
		saveTimer.current = window.setTimeout(() => {
			void persist({ items: nextItems });
		}, 700);
	}

	async function onCreate() {
		onBusy("Creating questionnaire…");
		onError("");
		try {
			const created = await createQuestionnaire({
				projectId,
				title: "Untitled questionnaire",
				distributionNote: "",
				items: [],
			});
			setRows((prev) => [created, ...prev]);
			setActiveId(created.id);
		} catch (err: unknown) {
			onError(err instanceof Error ? err.message : "Could not create questionnaire.");
		} finally {
			onBusy("");
		}
	}

	async function onImport(file: File) {
		if (!activeId) return;
		onBusy("Importing responses…");
		onError("");
		try {
			const next = await importQuestionnaireResponses(activeId, { file });
			setRows((prev) => prev.map((row) => (row.id === next.id ? next : row)));
			setItems(next.items);
		} catch (err: unknown) {
			onError(err instanceof Error ? err.message : "Import failed.");
		} finally {
			onBusy("");
		}
	}

	async function onAttachInstrument(file: File) {
		if (!activeId) return;
		onBusy("Uploading instrument…");
		onError("");
		try {
			const dataUrl = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => {
					if (typeof reader.result === "string") resolve(reader.result);
					else reject(new Error("Could not read file."));
				};
				reader.onerror = () => reject(new Error("Could not read file."));
				reader.readAsDataURL(file);
			});
			const doc = await createDocument({
				title: file.name,
				fileName: file.name,
				fileMime: file.type || "application/octet-stream",
				fileData: dataUrl,
				projectId,
			});
			const next = await updateQuestionnaire(activeId, { instrumentDocumentId: doc.id });
			setRows((prev) => prev.map((row) => (row.id === next.id ? next : row)));
		} catch (err: unknown) {
			onError(err instanceof Error ? err.message : "Could not attach instrument.");
		} finally {
			onBusy("");
		}
	}

	return (
		<div className="nb-survey">
			<div className="nb-switcher">
				<p className="nb-switcher-label">Surveys</p>
				<div className="nb-switcher-scroll" role="list">
					{rows.map((row) => (
						<div key={row.id} className={`nb-chip ${row.id === activeId ? "is-on" : ""}`} role="listitem">
							<button type="button" className="nb-chip-open" onClick={() => setActiveId(row.id)}>
								<span>{row.title}</span>
								<small>
									{row.rowCount
										? `${row.rowCount} responses`
										: `${row.items.length} question${row.items.length === 1 ? "" : "s"}`}
								</small>
							</button>
							<button
								type="button"
								className="nb-chip-remove"
								aria-label={`Remove ${row.title}`}
								onClick={() => {
									void deleteQuestionnaire(row.id).then(() => {
										setRows((prev) => prev.filter((item) => item.id !== row.id));
										if (activeId === row.id) setActiveId(null);
									});
								}}
							>
								×
							</button>
						</div>
					))}
				</div>
				<button type="button" className="nb-data-upload" onClick={() => void onCreate()}>
					<Plus className="size-3.5" />
					New
				</button>
			</div>
			<div className="nb-survey-stage">
				{active ? (
					<>
						<div className="nb-survey-meta">
							<label>
								<span>Title</span>
								<input
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									onBlur={() => void persist({ title })}
								/>
							</label>
							<label>
								<span>Population</span>
								<input
									value={population}
									placeholder="e.g. undergraduate nurses"
									onChange={(e) => setPopulation(e.target.value)}
									onBlur={() => void persist({ population })}
								/>
							</label>
							<label>
								<span>Sample size</span>
								<input
									value={sampleSize}
									inputMode="numeric"
									onChange={(e) => setSampleSize(e.target.value)}
									onBlur={() => void persist({ sampleSize: Number(sampleSize) || 0 })}
								/>
							</label>
							<label>
								<span>How it was distributed</span>
								<input
									value={distributionNote}
									placeholder="Paper, Google Form, WhatsApp…"
									onChange={(e) => setDistributionNote(e.target.value)}
									onBlur={() => void persist({ distributionNote })}
								/>
							</label>
							<label className="nb-survey-span">
								<span>Notes</span>
								<textarea
									value={description}
									rows={2}
									onChange={(e) => setDescription(e.target.value)}
									onBlur={() => void persist({ description })}
								/>
							</label>
						</div>
						<div className="nb-survey-actions">
							<label className="nb-btn nb-btn-primary">
								<Upload className="size-3.5" />
								Import responses
								<input
									type="file"
									accept=".csv,.tsv,.xlsx,.txt,text/csv"
									hidden
									onChange={(e) => {
										const file = e.target.files?.[0];
										e.target.value = "";
										if (file) void onImport(file);
									}}
								/>
							</label>
							<label className="nb-btn">
								Attach instrument
								<input
									type="file"
									accept=".pdf,.doc,.docx,application/pdf"
									hidden
									onChange={(e) => {
										const file = e.target.files?.[0];
										e.target.value = "";
										if (file) void onAttachInstrument(file);
									}}
								/>
							</label>
							{active.responseDatasetId ? (
								<button
									type="button"
									className="nb-btn"
									onClick={() => onOpenInData?.(active.responseDatasetId as string)}
								>
									Open in Data / Plot
								</button>
							) : null}
							{active.importedFileName ? (
								<p className="nb-data-hint">
									Imported {active.rowCount} rows from {active.importedFileName}
									{active.instrumentDocumentId ? " · instrument attached" : ""}
								</p>
							) : null}
						</div>
						<div className="nb-survey-items-head">
							<p>Instrument</p>
							<button
								type="button"
								className="nb-outline-add"
								onClick={() => scheduleItems([...items, newQuestionnaireItem({ prompt: "New question" })])}
							>
								Add question
							</button>
						</div>
						{items.length === 0 ? (
							<p className="nb-data-hint">
								Build questions here, or import a spreadsheet — headers become questions automatically.
							</p>
						) : (
							<ul className="nb-survey-items">
								{items.map((item, index) => (
									<li key={item.id}>
										<span className="nb-survey-num">{index + 1}</span>
										<div>
											<input
												value={item.prompt}
												onChange={(e) =>
													scheduleItems(
														items.map((row) =>
															row.id === item.id ? { ...row, prompt: e.target.value } : row,
														),
													)
												}
											/>
											<div className="nb-survey-item-row">
												<select
													value={item.kind}
													onChange={(e) =>
														scheduleItems(
															items.map((row) =>
																row.id === item.id
																	? { ...row, kind: e.target.value as QuestionnaireItemKind }
																	: row,
															),
														)
													}
												>
													{QUESTIONNAIRE_ITEM_KINDS.map((kind) => (
														<option key={kind} value={kind}>
															{QUESTIONNAIRE_KIND_LABELS[kind]}
														</option>
													))}
												</select>
												{item.kind === "likert" ? (
													<>
														<input
															className="nb-survey-scale"
															value={item.scaleMin}
															onChange={(e) =>
																scheduleItems(
																	items.map((row) =>
																		row.id === item.id
																			? { ...row, scaleMin: Number(e.target.value) || 1 }
																			: row,
																	),
																)
															}
														/>
														<input
															className="nb-survey-scale"
															value={item.scaleMax}
															onChange={(e) =>
																scheduleItems(
																	items.map((row) =>
																		row.id === item.id
																			? { ...row, scaleMax: Number(e.target.value) || 5 }
																			: row,
																	),
																)
															}
														/>
													</>
												) : null}
												{item.kind === "multiple_choice" ? (
													<input
														placeholder="Options, comma separated"
														value={item.options.join(", ")}
														onChange={(e) =>
															scheduleItems(
																items.map((row) =>
																	row.id === item.id
																		? {
																				...row,
																				options: e.target.value
																					.split(",")
																					.map((opt) => opt.trim())
																					.filter(Boolean),
																			}
																		: row,
																),
															)
														}
													/>
												) : null}
												{item.column ? <small>Column: {item.column}</small> : null}
											</div>
										</div>
										<button
											type="button"
											className="nb-data-remove"
											aria-label="Remove question"
											onClick={() => scheduleItems(items.filter((row) => row.id !== item.id))}
										>
											<Trash2 className="size-3.5" />
										</button>
									</li>
								))}
							</ul>
						)}
					</>
				) : (
					<BlankSurvey />
				)}
			</div>
		</div>
	);
}

function BlankSurvey() {
	return (
		<div className="nb-blank">
			<div className="nb-blank-icon" aria-hidden>
				<ClipboardList className="size-7" />
			</div>
			<h3>Capture a field survey</h3>
			<p>
				Create a questionnaire for work you already distributed, then import the collated CSV or Excel
				file. Headers become questions automatically.
			</p>
		</div>
	);
}
