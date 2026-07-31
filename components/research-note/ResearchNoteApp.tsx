"use client";

import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Dashboard } from "@/components/research-note/features/dashboard/Dashboard";
import { SearchModal } from "@/components/research-note/features/search/SearchModal";
import { useSettings } from "@/components/research-note/state/useSettings";
import type { AuthUser as NoteAuthUser } from "@/components/research-note/state/useAuth";

import "@/components/research-note/research-note.css";

/**
 * Research-Note shell — notebook workspace hosted in GARIL AI.
 * Auth from parent app; projects + notebook snapshots in Mongo;
 * AI via project OpenRouter (`llm.service`).
 */
const NotebookView = lazy(() =>
	import("@/components/research-note/features/notebook/NotebookView").then((m) => ({
		default: m.NotebookView,
	})),
);

type View = { kind: "dashboard" } | { kind: "project"; projectId: string };

export type ResearchNoteAuthor = {
	id: string;
	name: string;
	email: string;
};

type Props = {
	author: ResearchNoteAuthor;
	/** Lecturer `/research/note` or student `/student/research/note`. */
	basePath?: string;
};

export function ResearchNoteApp({ author, basePath = "/research/note" }: Props) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const projectFromUrl = searchParams.get("project")?.trim() || "";
	const pageFromUrl = searchParams.get("page")?.trim() || "";
	const [view, setView] = useState<View>(() =>
		projectFromUrl ? { kind: "project", projectId: projectFromUrl } : { kind: "dashboard" },
	);
	const [showSearch, setShowSearch] = useState(false);
	const ai = useSettings();

	const noteUser: NoteAuthUser = {
		id: author.id,
		name: author.name || author.email || "Researcher",
		email: author.email || "",
	};

	useEffect(() => {
		if (!projectFromUrl) return;
		setView((prev) =>
			prev.kind === "project" && prev.projectId === projectFromUrl
				? prev
				: { kind: "project", projectId: projectFromUrl },
		);
	}, [projectFromUrl]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setShowSearch((v) => !v);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	const openProject = (projectId: string, pageId?: string) => {
		setView({ kind: "project", projectId });
		const qs = new URLSearchParams({ project: projectId });
		if (pageId) qs.set("page", pageId);
		router.replace(`${basePath}?${qs.toString()}`, { scroll: false });
	};

	const backToDashboard = () => {
		setView({ kind: "dashboard" });
		router.replace(basePath, { scroll: false });
	};

	const modals = (
		<SearchModal
			open={showSearch}
			onClose={() => setShowSearch(false)}
			onOpenProject={openProject}
			projectId={view.kind === "project" ? view.projectId : undefined}
		/>
	);

	let body: ReactNode;
	if (view.kind === "project") {
		body = (
			<>
				<Suspense
					fallback={
						<div className="flex h-full items-center justify-center text-sm text-[var(--color-muted)]">
							Opening notebook…
						</div>
					}
				>
					<NotebookView
						key={view.projectId}
						projectId={view.projectId}
						settings={ai.settings}
						author={noteUser.name}
						onBack={backToDashboard}
						initialPageId={pageFromUrl || undefined}
					/>
				</Suspense>
				{modals}
			</>
		);
	} else {
		body = (
			<>
				<Dashboard onOpenProject={openProject} />
				{modals}
			</>
		);
	}

	return (
		<div
			className={`research-note-shell${view.kind === "dashboard" ? " research-note-shell-embed" : ""}`}
			data-theme="light"
		>
			{body}
		</div>
	);
}
