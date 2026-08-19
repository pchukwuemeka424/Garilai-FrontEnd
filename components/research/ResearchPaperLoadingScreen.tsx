"use client";

import { IconStop } from "@/components/ui/ButtonIcon";
import { useSmoothProgress } from "@/hooks/useSmoothProgress";
import { getScopeDocumentLabel, getScopeProjectEyebrow } from "@/lib/research-ideas";
import { getScopeRailHeadings } from "@/lib/research-scope-brief";

type Props = {
	projectName: string;
	preparing?: boolean;
	studentUI?: boolean;
	/** Research type for type-aware copy (assignment, thesis, journal, …). */
	scope?: string | null;
	/** Server/job progress 0–100. During preparing, omit or pass a low estimate. */
	progress?: number;
	complete?: boolean;
	onStop?: () => void;
	stopping?: boolean;
};

function statusLabel(preparing: boolean, percent: number, documentLabel: string): string {
	if (preparing && percent < 28) return `Preparing your ${documentLabel}…`;
	if (percent < 42) return `Gathering sources for your ${documentLabel}…`;
	if (percent < 88) return `Generating your ${documentLabel}…`;
	if (percent < 97) return "Completing citations & references…";
	return `Finalizing your ${documentLabel}…`;
}

function statusDetail(preparing: boolean, percent: number, documentLabel: string): string {
	if (preparing && percent < 28) {
		return `Gathering sources and preparing your ${documentLabel}…`;
	}
	if (percent >= 90) {
		return `Almost done — saving your ${documentLabel} next.`;
	}
	return "This may take a few minutes. You can navigate to other pages — we will notify you when it is ready.";
}

export function ResearchPaperLoadingScreen({
	projectName,
	preparing = false,
	studentUI = false,
	scope = null,
	progress = 20,
	complete = false,
	onStop,
	stopping = false,
}: Props) {
	const documentLabel = getScopeDocumentLabel(scope);
	const eyebrow = getScopeProjectEyebrow(scope);
	const sectionSteps = getScopeRailHeadings(scope);
	const percent = useSmoothProgress(Math.max(progress, 20), {
		complete,
		active: true,
		floor: 20,
		autoCreep: true,
	});
	const activeStep =
		sectionSteps.length > 0
			? Math.min(sectionSteps.length - 1, Math.floor((percent / 100) * sectionSteps.length))
			: 0;

	return (
		<div
			className={`research-paper-loading${studentUI ? " research-paper-loading-student" : ""}`}
			role="status"
			aria-live="polite"
			aria-busy={!complete}
		>
			<div className="research-paper-loading-card">
				<p className="research-paper-loading-eyebrow">{eyebrow}</p>
				<h2 className="research-paper-loading-title">{projectName}</h2>
				<div className="research-paper-loading-status">
					<span className="research-outline-spinner research-paper-loading-spinner" aria-hidden />
					<div className="research-paper-loading-copy">
						<p className="research-paper-loading-label">{statusLabel(preparing, percent, documentLabel)}</p>
						<p className="research-paper-loading-detail">{statusDetail(preparing, percent, documentLabel)}</p>
					</div>
				</div>

				<div
					className="research-paper-loading-progress"
					role="progressbar"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={percent}
					aria-label={`${eyebrow} generation progress`}
				>
					<div className="research-paper-loading-progress-head">
						<span className="research-paper-loading-progress-caption">Progress</span>
						<span className="research-paper-loading-progress-value">{percent}%</span>
					</div>
					<div className="research-paper-loading-progress-track">
						<div
							className="research-paper-loading-progress-fill"
							style={{ width: `${percent}%` }}
						/>
					</div>
				</div>

				{sectionSteps.length ? (
					<ol className="research-paper-loading-steps">
						{sectionSteps.map((heading, index) => (
							<li
								key={heading}
								className={
									index < activeStep
										? "is-done"
										: index === activeStep
											? "is-active"
											: undefined
								}
							>
								{heading}
							</li>
						))}
					</ol>
				) : null}

				{onStop && !complete ? (
					<button
						type="button"
						className="research-paper-loading-stop"
						onClick={onStop}
						disabled={stopping}
					>
						<IconStop size={14} />
						{stopping ? "Stopping…" : `Stop generating your ${documentLabel}`}
					</button>
				) : null}
			</div>
		</div>
	);
}
