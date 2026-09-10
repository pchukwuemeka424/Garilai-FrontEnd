"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
	ArrowLeft,
	ArrowRight,
	Calendar,
	Check,
	ChevronDown,
	CircleHelp,
	ClipboardList,
	Info,
} from "lucide-react";
import { Input } from "@/components/portal/ui/input";
import { Select } from "@/components/portal/ui/select";
import { apiFetch } from "@/lib/portal-api";
import {
	PROJECT_TYPES,
	projectAdvisorLabel,
	projectAdvisorNoun,
	projectCreationGuidance,
	projectCreationSetupBlurb,
	projectCreationSubmitCta,
	projectCreationSubmitPending,
	projectCreationVerbLabel,
	projectTitleFieldLabel,
	type ProjectType,
} from "@/lib/portal/project-types";
import { COURSE_YEAR_OPTIONS } from "@/lib/portal/course-years";
import { assignmentInstructionsToText } from "@/lib/portal/assignment-instructions";
import { cn } from "@/lib/portal/cn";

type Supervisor = {
	id: string;
	name: string;
	email: string;
	role: string;
};

type SupervisorsResponse = {
	university: {
		id: string;
		name: string;
		slug?: string;
		country?: string;
	};
	supervisors: Supervisor[];
};

type PublishedBrief = {
	_id: string;
	title: string;
	courseName?: string;
	courseYear?: string;
	maxScore?: number;
	instructions?: string;
	wordCountMin?: number | null;
	wordCountMax?: number | null;
	dueAt?: string | null;
};

const INSTRUCTIONS_PREVIEW_CHARS = 180;

function briefWordCountLabel(brief: PublishedBrief) {
	const min = typeof brief.wordCountMin === "number" ? brief.wordCountMin : null;
	const max = typeof brief.wordCountMax === "number" ? brief.wordCountMax : null;
	if (min != null && max != null) {
		return `${min.toLocaleString()}-${max.toLocaleString()} words`;
	}
	if (min != null) return `At least ${min.toLocaleString()} words`;
	if (max != null) return `Up to ${max.toLocaleString()} words`;
	return null;
}

function formatBriefDueDate(dueAt?: string | null) {
	if (!dueAt) return null;
	const date = new Date(dueAt);
	if (Number.isNaN(date.getTime())) return null;
	return date.toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

function formatToday() {
	return new Intl.DateTimeFormat(undefined, {
		weekday: "long",
		month: "long",
		day: "numeric",
	}).format(new Date());
}

function FieldSelect({
	className,
	...props
}: React.ComponentProps<typeof Select>) {
	return (
		<div className="stu-new-select-wrap">
			<Select className={cn("stu-new-control", className)} {...props} />
			<ChevronDown aria-hidden className="stu-new-select-chevron" size={16} />
		</div>
	);
}

function Field({
	label,
	hint,
	required,
	children,
}: {
	label: string;
	hint?: string;
	required?: boolean;
	children: React.ReactNode;
}) {
	return (
		<label className="stu-new-field">
			<span className="stu-new-label">
				{label}
				{required ? <em aria-hidden>*</em> : null}
			</span>
			{children}
			{hint ? <span className="stu-new-hint">{hint}</span> : null}
		</label>
	);
}

export default function NewProjectPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const fromAssignments = searchParams.get("from") === "assignments";
	const [title, setTitle] = useState("");
	const [studentMatNo, setStudentMatNo] = useState("");
	const [courseYear, setCourseYear] = useState("");
	const [courseName, setCourseName] = useState("");
	const [projectType, setProjectType] = useState<ProjectType | "">(
		fromAssignments ? "assignment" : "",
	);
	const [supervisorId, setSupervisorId] = useState("");
	const [assignmentBriefId, setAssignmentBriefId] = useState("");
	const [briefs, setBriefs] = useState<PublishedBrief[]>([]);
	const [loadingBriefs, setLoadingBriefs] = useState(false);
	const [expandedBriefId, setExpandedBriefId] = useState<string | null>(null);
	const [universityName, setUniversityName] = useState("");
	const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
	const [loadingSupervisors, setLoadingSupervisors] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const isAssignment = projectType === "assignment";
	const backHref =
		fromAssignments || isAssignment ? "/student/assignments" : "/student/projects";
	const backLabel =
		fromAssignments || isAssignment ? "Back to assignments" : "Back to projects";

	useEffect(() => {
		apiFetch("/api/v1/supervisors")
			.then((data) => {
				const payload = data as SupervisorsResponse;
				setUniversityName(payload.university.name);
				setSupervisors(payload.supervisors);
			})
			.catch((err) =>
				setError(
					err instanceof Error
						? err.message
						: "Could not load lecturers/supervisors for your university",
				),
			)
			.finally(() => setLoadingSupervisors(false));
	}, []);

	useEffect(() => {
		if (!isAssignment || !supervisorId || !courseYear.trim()) {
			setBriefs([]);
			setAssignmentBriefId("");
			setExpandedBriefId(null);
			setLoadingBriefs(false);
			return;
		}
		let cancelled = false;
		setLoadingBriefs(true);
		setAssignmentBriefId("");
		setExpandedBriefId(null);
		const params = new URLSearchParams({
			lecturerId: supervisorId,
			courseYear: courseYear.trim(),
		});
		apiFetch(`/api/v1/assignment-briefs?${params.toString()}`)
			.then((data) => {
				if (cancelled) return;
				setBriefs(data as PublishedBrief[]);
			})
			.catch(() => {
				if (!cancelled) setBriefs([]);
			})
			.finally(() => {
				if (!cancelled) setLoadingBriefs(false);
			});
		return () => {
			cancelled = true;
		};
	}, [isAssignment, supervisorId, courseYear]);

	function onSelectBrief(briefId: string) {
		setAssignmentBriefId(briefId);
		const brief = briefs.find((b) => b._id === briefId);
		if (!brief) return;
		if (brief.courseName?.trim()) {
			setCourseName(brief.courseName.trim());
		}
		if (brief.title?.trim()) {
			setTitle(brief.title.trim());
		}
	}

	const briefsRequireSelection = isAssignment && briefs.length > 0;

	const selected = useMemo(
		() => PROJECT_TYPES.find((t) => t.value === projectType),
		[projectType],
	);

	const guidance = projectCreationGuidance(projectType);
	const titleFieldLabel = projectTitleFieldLabel(projectType);
	const advisorNoun = projectAdvisorNoun(projectType);
	const advisorLabel = projectAdvisorLabel(projectType);
	const advisorPlural = `${advisorNoun}s`;

	function selectProjectType(next: ProjectType) {
		const wasAssignment = projectType === "assignment";
		const willBeAssignment = next === "assignment";
		setProjectType(next);
		setError(null);
		if (wasAssignment !== willBeAssignment) {
			setSupervisorId("");
			setAssignmentBriefId("");
			setCourseYear("");
			setCourseName("");
			setStudentMatNo("");
			setBriefs([]);
			setExpandedBriefId(null);
			if (willBeAssignment) setTitle("");
		}
	}

	function validateAssignmentDetails(): string | null {
		if (title.trim().length < 3) {
			return `Enter ${titleFieldLabel.toLowerCase()} (at least 3 characters)`;
		}
		if (studentMatNo.trim().length < 2) {
			return "Enter your Mat No / Student No (at least 2 characters)";
		}
		if (courseName.trim().length < 2) {
			return "Enter the course name (at least 2 characters)";
		}
		return null;
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		if (!projectType) {
			setError("Select a project type");
			return;
		}

		if (isAssignment) {
			if (!supervisorId) {
				setError("Select a lecturer from your university");
				return;
			}
			if (courseYear.trim().length < 1) {
				setError("Select the year / level");
				return;
			}
			if (briefs.length > 0 && !assignmentBriefId) {
				setError("Select one of the published assignments from your lecturer");
				return;
			}
			const detailsError = validateAssignmentDetails();
			if (detailsError) {
				setError(detailsError);
				return;
			}
		} else {
			if (title.trim().length < 3) {
				setError(`Enter ${titleFieldLabel.toLowerCase()} (at least 3 characters)`);
				return;
			}
			if (!supervisorId) {
				setError(`Select a ${advisorNoun} from your university`);
				return;
			}
		}

		setLoading(true);
		try {
			const project = (await apiFetch("/api/v1/projects", {
				method: "POST",
				body: JSON.stringify({
					title: title.trim(),
					projectType,
					supervisorId,
					topic: title.trim(),
					...(isAssignment
						? {
								studentMatNo: studentMatNo.trim(),
								courseYear: courseYear.trim(),
								courseName: courseName.trim(),
								...(assignmentBriefId ? { assignmentBriefId } : {}),
							}
						: {}),
				}),
			})) as { _id: string };
			router.push(
				isAssignment
					? `/student/assignments/${project._id}`
					: `/student/projects/${project._id}`,
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not create project");
		} finally {
			setLoading(false);
		}
	}

	const canSubmit =
		Boolean(projectType) &&
		!loading &&
		!loadingSupervisors &&
		Boolean(supervisorId) &&
		(!isAssignment ||
			(!loadingBriefs &&
				courseYear.trim().length > 0 &&
				(!briefsRequireSelection || Boolean(assignmentBriefId))));

	function renderBriefList() {
		if (!courseYear.trim()) {
			return (
				<div className="stu-new-panel-empty">
					<span className="stu-new-panel-icon" aria-hidden>
						<ClipboardList size={18} strokeWidth={1.75} />
					</span>
					<strong>Select lecturer and year</strong>
					<p>Published briefs from your lecturer will appear here.</p>
				</div>
			);
		}

		if (loadingBriefs) {
			return (
				<div className="stu-new-panel-empty stu-new-panel-loading">
					Loading published assignments...
				</div>
			);
		}

		if (briefs.length === 0) {
			return (
				<div className="stu-new-panel-empty">
					<span className="stu-new-panel-icon is-muted" aria-hidden>
						<ClipboardList size={18} strokeWidth={1.75} />
					</span>
					<strong>No briefs for {courseYear.trim()}</strong>
					<p>You can continue without a brief, or ask your lecturer to publish one.</p>
				</div>
			);
		}

		return (
			<ul className="stu-new-briefs" role="listbox" aria-label="Published assignments">
				{briefs.map((brief) => {
					const isSelected = assignmentBriefId === brief._id;
					const instructions = assignmentInstructionsToText(brief.instructions || "");
					const expanded = expandedBriefId === brief._id;
					const needsExpand = instructions.length > INSTRUCTIONS_PREVIEW_CHARS;
					const preview =
						!expanded && needsExpand
							? `${instructions.slice(0, INSTRUCTIONS_PREVIEW_CHARS).trimEnd()}...`
							: instructions;
					const due = formatBriefDueDate(brief.dueAt);
					const wordsLabel = briefWordCountLabel(brief);

					return (
						<li key={brief._id} role="option" aria-selected={isSelected}>
							<div
								role="button"
								tabIndex={0}
								onClick={() => onSelectBrief(brief._id)}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										onSelectBrief(brief._id);
									}
								}}
								className={cn("stu-new-brief", isSelected && "is-on")}
							>
								<span className="stu-new-brief-icon" aria-hidden>
									<ClipboardList size={15} strokeWidth={1.75} />
								</span>
								<div className="stu-new-brief-copy">
									<div className="stu-new-brief-top">
										<p>{brief.title}</p>
										<span className="stu-new-brief-check" aria-hidden>
											{isSelected ? <Check size={12} /> : null}
										</span>
									</div>
									<p className="stu-new-brief-meta">
										{brief.courseName?.trim() ? (
											<span>{brief.courseName.trim()}</span>
										) : null}
										{due ? (
											<span>
												<Calendar size={12} />
												Due {due}
											</span>
										) : null}
										{wordsLabel ? <span>{wordsLabel}</span> : null}
										{typeof brief.maxScore === "number" ? (
											<span>{brief.maxScore} marks</span>
										) : null}
									</p>
									{instructions ? (
										<div className="stu-new-brief-instructions">
											<p>{expanded ? instructions : preview}</p>
											{needsExpand ? (
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														setExpandedBriefId(expanded ? null : brief._id);
													}}
												>
													{expanded ? "Show less" : "Show more"}
												</button>
											) : null}
										</div>
									) : null}
								</div>
							</div>
						</li>
					);
				})}
			</ul>
		);
	}

	const pageTitle = `${projectCreationVerbLabel(projectType)} ${
		selected?.label.toLowerCase() ?? "project"
	}`;

	return (
		<div className="stu-new">
			<header className="stu-new-intro">
				<div className="stu-new-intro-copy">
					<Link href={backHref} className="stu-new-back">
						<ArrowLeft size={15} />
						{backLabel}
					</Link>
					<p className="stu-new-eyebrow">{formatToday()}</p>
					<h1>{pageTitle}</h1>
					<p>{projectCreationSetupBlurb(projectType)}</p>
				</div>
			</header>

			<form className="stu-new-form" onSubmit={onSubmit}>
				{error ? (
					<p className="stu-new-error" role="alert">
						{error}
					</p>
				) : null}

				<div className="stu-new-shell">
					<div className="stu-new-pane">
						<div className="stu-new-pane-head">
							<h2>Details</h2>
							<p>
								{isAssignment
									? "Type, lecturer, year, and your student details."
									: "Type, supervisor, and working title."}
							</p>
						</div>

						<div className="stu-new-grid">
							<Field
								label="Type"
								required
								hint={
									selected?.description ||
									"Assignment, dissertation, thesis, or another type."
								}
							>
								<FieldSelect
									value={projectType}
									onChange={(e) => {
										const next = e.target.value as ProjectType;
										if (next) selectProjectType(next);
									}}
									required
									aria-label="Project type"
								>
									<option value="" disabled>
										Select type...
									</option>
									{PROJECT_TYPES.map((type) => (
										<option key={type.value} value={type.value}>
											{type.label}
										</option>
									))}
								</FieldSelect>
							</Field>

							<Field
								label={advisorLabel}
								required
								hint={
									universityName
										? universityName
										: "From your registered university"
								}
							>
								<FieldSelect
									value={supervisorId}
									onChange={(e) => {
										setSupervisorId(e.target.value);
										setAssignmentBriefId("");
										if (isAssignment) setCourseYear("");
									}}
									required
									disabled={loadingSupervisors || supervisors.length === 0}
								>
									<option value="" disabled>
										{loadingSupervisors
											? `Loading ${advisorPlural}...`
											: supervisors.length === 0
												? `No ${advisorPlural} available`
												: `Select ${advisorNoun}...`}
									</option>
									{supervisors.map((supervisor) => (
										<option key={supervisor.id} value={supervisor.id}>
											{supervisor.name} · {supervisor.email}
										</option>
									))}
								</FieldSelect>
							</Field>
						</div>

						{!loadingSupervisors && supervisors.length === 0 ? (
							<div className="stu-new-notice">
								<CircleHelp size={15} aria-hidden />
								<p>
									No {advisorPlural} are registered for{" "}
									{universityName || "your university"} yet. Ask a {advisorNoun} to
									register with the same university, then refresh this page.
								</p>
							</div>
						) : null}

						{isAssignment ? (
							<Field label="Year / level" required>
								<FieldSelect
									value={courseYear}
									onChange={(e) => setCourseYear(e.target.value)}
									required
								>
									<option value="" disabled>
										Select year...
									</option>
									{COURSE_YEAR_OPTIONS.map((opt) => (
										<option key={opt.value} value={opt.value}>
											{opt.label}
										</option>
									))}
								</FieldSelect>
							</Field>
						) : null}

						<div className="stu-new-divider">
							<Field label={titleFieldLabel} required>
								<Input
									className="stu-new-control"
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									placeholder={
										isAssignment
											? "e.g. Week 4 lab report - software testing"
											: "e.g. AI-assisted thesis supervision in higher education"
									}
									required
									minLength={3}
								/>
							</Field>
						</div>

						{isAssignment ? (
							<div className="stu-new-grid">
								<Field label="Mat No / Student No" required>
									<Input
										className="stu-new-control"
										value={studentMatNo}
										onChange={(e) => setStudentMatNo(e.target.value)}
										placeholder="e.g. CSC/2021/0123"
										required
										minLength={2}
										maxLength={64}
										autoComplete="off"
									/>
								</Field>
								<Field label="Course name" required>
									<Input
										className="stu-new-control"
										value={courseName}
										onChange={(e) => setCourseName(e.target.value)}
										placeholder="e.g. Software Engineering"
										required
										minLength={2}
										maxLength={200}
										autoComplete="off"
									/>
								</Field>
							</div>
						) : null}
					</div>

					<div className="stu-new-pane stu-new-pane-side">
						{isAssignment ? (
							<>
								<div className="stu-new-pane-head">
									<h2>
										Published brief
										{briefsRequireSelection ? (
											<em className="stu-new-required" aria-hidden>
												*
											</em>
										) : null}
									</h2>
									<p>
										{courseYear.trim()
											? `Briefs for ${courseYear.trim()}.`
											: "Choose a lecturer and year to load briefs."}
									</p>
								</div>
								{renderBriefList()}
							</>
						) : selected && guidance ? (
							<div className="stu-new-guidance">
								<div className="stu-new-pane-head">
									<h2>{selected.label}</h2>
									<p>{selected.description}</p>
								</div>
								<div className="stu-new-tip">
									<Info size={15} aria-hidden />
									<p>{guidance.tip}</p>
								</div>
							</div>
						) : (
							<div className="stu-new-panel-empty">
								<span className="stu-new-panel-icon" aria-hidden>
									<Info size={18} strokeWidth={1.75} />
								</span>
								<strong>Select a type</strong>
								<p>Structure and supervision details will appear here.</p>
							</div>
						)}
					</div>
				</div>

				<div className="stu-new-footer">
					<Link href={backHref} className="stu-new-btn stu-new-btn-ghost">
						Cancel
					</Link>
					<button
						type="submit"
						disabled={!canSubmit}
						className="stu-new-btn stu-new-btn-primary"
					>
						{loading
							? projectCreationSubmitPending(projectType)
							: projectCreationSubmitCta(projectType)}
						{!loading ? <ArrowRight size={15} /> : null}
					</button>
				</div>
			</form>
		</div>
	);
}
