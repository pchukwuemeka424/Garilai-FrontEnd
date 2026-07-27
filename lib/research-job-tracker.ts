import type { ResearchJobStatus } from "@/lib/research-jobs-api";

const STORAGE_KEY = "aula.research.job.track";

export type TrackedResearchJob = {
	jobId: string;
	topic: string;
	/** Prevents the completion popup from showing again after dismiss / local handle. */
	notified: boolean;
	startedAt: string;
};

function canUseStorage(): boolean {
	return typeof window !== "undefined";
}

export function getTrackedResearchJob(): TrackedResearchJob | null {
	if (!canUseStorage()) return null;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as TrackedResearchJob;
		if (!parsed?.jobId) return null;
		return parsed;
	} catch {
		return null;
	}
}

export function setTrackedResearchJob(input: {
	jobId: string;
	topic: string;
}): TrackedResearchJob {
	const tracked: TrackedResearchJob = {
		jobId: input.jobId,
		topic: input.topic,
		notified: false,
		startedAt: new Date().toISOString(),
	};
	if (canUseStorage()) {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tracked));
		window.dispatchEvent(new CustomEvent("aula-research-job-changed"));
	}
	return tracked;
}

export function markTrackedResearchJobNotified(jobId: string): void {
	const current = getTrackedResearchJob();
	if (!current || current.jobId !== jobId) return;
	const next = { ...current, notified: true };
	if (canUseStorage()) {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
		window.dispatchEvent(new CustomEvent("aula-research-job-changed"));
	}
}

export function clearTrackedResearchJob(jobId?: string): void {
	if (!canUseStorage()) return;
	if (jobId) {
		const current = getTrackedResearchJob();
		if (current && current.jobId !== jobId) return;
	}
	window.localStorage.removeItem(STORAGE_KEY);
	window.dispatchEvent(new CustomEvent("aula-research-job-changed"));
}

export function isTerminalResearchJobStatus(status: ResearchJobStatus): boolean {
	return status === "completed" || status === "failed" || status === "cancelled";
}
