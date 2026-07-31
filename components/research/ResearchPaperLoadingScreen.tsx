"use client";

import { useSmoothProgress } from "@/hooks/useSmoothProgress";

type Props = {
	projectName: string;
	preparing?: boolean;
	studentUI?: boolean;
	/** Server/job progress 0–100. During preparing, omit or pass a low estimate. */
	progress?: number;
	complete?: boolean;
};

function statusLabel(preparing: boolean, percent: number): string {
	if (preparing && percent < 28) return "Preparing your research paper…";
	if (percent < 42) return "Gathering literature…";
	if (percent < 88) return "Generating your research paper…";
	if (percent < 97) return "Completing citations & references…";
	return "Finalizing your research paper…";
}

function statusDetail(preparing: boolean, percent: number): string {
	if (preparing && percent < 28) {
		return "Searching literature and building your outline first.";
	}
	if (percent >= 90) {
		return "Almost done — saving your paper next.";
	}
	return "This may take a few minutes. You can navigate to other pages — we will notify you when it is ready.";
}

export function ResearchPaperLoadingScreen({
	projectName,
	preparing = false,
	studentUI = false,
	progress = 20,
	complete = false,
}: Props) {
	const percent = useSmoothProgress(Math.max(progress, 20), {
		complete,
		active: true,
		floor: 20,
		autoCreep: true,
	});

	return (
		<div
			className={`research-paper-loading${studentUI ? " research-paper-loading-student" : ""}`}
			role="status"
			aria-live="polite"
			aria-busy={!complete}
		>
			<div className="research-paper-loading-card">
				<p className="research-paper-loading-eyebrow">Research project</p>
				<h2 className="research-paper-loading-title">{projectName}</h2>
				<div className="research-paper-loading-status">
					<span className="research-outline-spinner research-paper-loading-spinner" aria-hidden />
					<div className="research-paper-loading-copy">
						<p className="research-paper-loading-label">{statusLabel(preparing, percent)}</p>
						<p className="research-paper-loading-detail">{statusDetail(preparing, percent)}</p>
					</div>
				</div>

				<div
					className="research-paper-loading-progress"
					role="progressbar"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={percent}
					aria-label="Research generation progress"
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
			</div>
		</div>
	);
}
