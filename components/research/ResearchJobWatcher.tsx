"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AulaModal } from "@/components/aula/AulaModal";
import { useAuth } from "@/hooks/useAuth";
import {
	fetchActiveResearchJob,
	fetchResearchJobById,
	type ResearchJob,
} from "@/lib/research-jobs-api";
import {
	clearTrackedResearchJob,
	getTrackedResearchJob,
	isTerminalResearchJobStatus,
	markTrackedResearchJobNotified,
	type TrackedResearchJob,
} from "@/lib/research-job-tracker";
import { savedResearchPagePath } from "@/lib/saved-research-routes";

const POLL_MS = 4000;

type CompletionState = {
	job: ResearchJob;
	kind: "completed" | "failed";
};

function savedVariantForRole(role: string | undefined): "lecturer" | "student" {
	return role === "student" ? "student" : "lecturer";
}

function isResearchPaperPath(pathname: string | null): boolean {
	return pathname === "/research/paper" || pathname === "/student/research/paper";
}

export function ResearchJobWatcher() {
	const { user, loading } = useAuth();
	const router = useRouter();
	const pathname = usePathname();
	const onPaperWorkspace = isResearchPaperPath(pathname);
	const [tracked, setTracked] = useState<TrackedResearchJob | null>(null);
	const [runningJob, setRunningJob] = useState<ResearchJob | null>(null);
	const [completion, setCompletion] = useState<CompletionState | null>(null);

	const refreshTracked = useCallback(() => {
		setTracked(getTrackedResearchJob());
	}, []);

	useEffect(() => {
		refreshTracked();
		const onChange = () => refreshTracked();
		window.addEventListener("aula-research-job-changed", onChange);
		window.addEventListener("storage", onChange);
		return () => {
			window.removeEventListener("aula-research-job-changed", onChange);
			window.removeEventListener("storage", onChange);
		};
	}, [refreshTracked]);

	useEffect(() => {
		if (loading || !user) {
			setRunningJob(null);
			return;
		}

		let cancelled = false;

		const poll = async () => {
			const local = getTrackedResearchJob();
			if (!local) {
				const active = await fetchActiveResearchJob();
				if (cancelled) return;
				setRunningJob(active);
				return;
			}

			const job = await fetchResearchJobById(local.jobId);
			if (cancelled) return;

			if (!job) {
				setRunningJob(null);
				return;
			}

			if (!isTerminalResearchJobStatus(job.status)) {
				setRunningJob(job);
				return;
			}

			setRunningJob(null);

			// Paper workspace owns completion UX while the user is still there.
			if (onPaperWorkspace && !local.notified) {
				return;
			}

			if (!local.notified) {
				markTrackedResearchJobNotified(job.id);
				if (job.status === "completed" && job.savedResearchId) {
					setCompletion({ job, kind: "completed" });
				} else if (job.status === "failed") {
					setCompletion({ job, kind: "failed" });
				} else {
					clearTrackedResearchJob(job.id);
				}
				refreshTracked();
			} else {
				clearTrackedResearchJob(job.id);
				refreshTracked();
			}
		};

		void poll();
		const timer = window.setInterval(() => void poll(), POLL_MS);
		const onFocus = () => void poll();
		window.addEventListener("focus", onFocus);

		return () => {
			cancelled = true;
			window.clearInterval(timer);
			window.removeEventListener("focus", onFocus);
		};
	}, [loading, user, tracked?.jobId, refreshTracked, onPaperWorkspace]);

	const dismissCompletion = useCallback(() => {
		if (completion) {
			clearTrackedResearchJob(completion.job.id);
		}
		setCompletion(null);
		refreshTracked();
	}, [completion, refreshTracked]);

	const viewPaper = useCallback(() => {
		if (!completion?.job.savedResearchId) {
			dismissCompletion();
			return;
		}
		const path = savedResearchPagePath(
			completion.job.savedResearchId,
			savedVariantForRole(user?.role),
		);
		dismissCompletion();
		router.push(path);
	}, [completion, dismissCompletion, router, user?.role]);

	const showChip = Boolean(
		!onPaperWorkspace &&
			runningJob &&
			(runningJob.status === "queued" || runningJob.status === "running"),
	);

	return (
		<>
			{showChip ? (
				<div className="research-job-chip" role="status" aria-live="polite">
					<span className="research-job-chip-dot" aria-hidden />
					<span className="research-job-chip-label">Generating research…</span>
					<span className="research-job-chip-topic" title={runningJob?.topic}>
						{runningJob?.topic}
					</span>
				</div>
			) : null}

			<AulaModal
				open={Boolean(completion)}
				title={
					completion?.kind === "completed"
						? "Research paper ready"
						: "Research generation failed"
				}
				description={
					completion?.kind === "completed"
						? "Your research finished in the background and was saved to your library."
						: completion?.job.error || "Something went wrong while generating your paper."
				}
				onClose={dismissCompletion}
				footer={
					completion?.kind === "completed" ? (
						<>
							<button type="button" className="ghost-btn" onClick={dismissCompletion}>
								Dismiss
							</button>
							<button type="button" className="primary-btn" onClick={viewPaper}>
								View paper
							</button>
						</>
					) : (
						<button type="button" className="primary-btn" onClick={dismissCompletion}>
							Dismiss
						</button>
					)
				}
			>
				{completion?.kind === "completed" ? (
					<p className="research-job-popup-body">
						You can keep working — open the paper whenever you are ready.
					</p>
				) : (
					<p className="research-job-popup-body">
						You can try generating again from Research when you are ready.
					</p>
				)}
			</AulaModal>
		</>
	);
}
