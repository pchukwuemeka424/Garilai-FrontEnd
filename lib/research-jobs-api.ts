import { apiUrl } from "@/lib/api";
import { authHeaders } from "@/lib/auth";

export type ResearchJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type ResearchJob = {
	id: string;
	userId: string;
	sessionId: string | null;
	topic: string;
	status: ResearchJobStatus;
	/** 0–100 generation progress from the server. */
	progress: number;
	savedResearchId: string | null;
	error: string | null;
	createdAt: string;
	updatedAt: string;
};

export async function startResearchPaperJob(input: {
	prompt: string;
	topic?: string;
}): Promise<ResearchJob> {
	const res = await fetch(apiUrl("/api/research/jobs"), {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders() },
		body: JSON.stringify({
			prompt: input.prompt,
			...(input.topic?.trim() ? { topic: input.topic.trim() } : {}),
		}),
	});
	const data = (await res.json()) as { job?: ResearchJob; error?: string };
	if (!res.ok) throw new Error(data.error ?? "Could not start research generation.");
	if (!data.job) throw new Error("Could not start research generation.");
	return data.job;
}

export async function fetchActiveResearchJob(): Promise<ResearchJob | null> {
	try {
		const res = await fetch(apiUrl("/api/research/jobs/active"), { headers: authHeaders() });
		if (res.status === 401) return null;
		if (!res.ok) return null;
		const data = (await res.json()) as { job?: ResearchJob | null };
		return data.job ?? null;
	} catch {
		return null;
	}
}

export async function fetchResearchJobById(id: string): Promise<ResearchJob | null> {
	try {
		const res = await fetch(apiUrl(`/api/research/jobs/${encodeURIComponent(id)}`), {
			headers: authHeaders(),
		});
		if (res.status === 404 || res.status === 401) return null;
		if (!res.ok) return null;
		const data = (await res.json()) as { job?: ResearchJob };
		return data.job ?? null;
	} catch {
		return null;
	}
}

export async function cancelResearchJob(id: string): Promise<ResearchJob | null> {
	try {
		const res = await fetch(apiUrl(`/api/research/jobs/${encodeURIComponent(id)}/cancel`), {
			method: "POST",
			headers: authHeaders(),
		});
		if (!res.ok) return null;
		const data = (await res.json()) as { job?: ResearchJob };
		return data.job ?? null;
	} catch {
		return null;
	}
}
