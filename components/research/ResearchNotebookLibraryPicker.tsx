"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { IconLibrary, IconSearch } from "@/components/ui/ButtonIcon";
import { fetchProjects, type ResearchProject } from "@/lib/research-assets-api";
import {
	isAssignmentNotebookProject,
	notebookLibraryHref,
	notebookLibraryMeta,
} from "@/lib/research-notebook";

const MAX_SELECTED = 5;

export function ResearchNotebookLibraryPicker({
	selectedIds,
	onChange,
	onUseTitle,
	variant,
	compact = false,
	disabled = false,
}: {
	selectedIds: string[];
	onChange: (ids: string[]) => void;
	onUseTitle?: (notebook: { id: string; title: string }) => void;
	variant: "lecturer" | "student";
	compact?: boolean;
	disabled?: boolean;
}) {
	const [notebooks, setNotebooks] = useState<ResearchProject[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [query, setQuery] = useState("");

	useEffect(() => {
		let alive = true;
		setLoading(true);
		setError(null);
		void fetchProjects()
			.then((projects) => {
				if (!alive) return;
				setNotebooks(projects.filter((project) => !isAssignmentNotebookProject(project)));
			})
			.catch((err: unknown) => {
				if (!alive) return;
				setError(err instanceof Error ? err.message : "Could not load your notebooks.");
			})
			.finally(() => {
				if (alive) setLoading(false);
			});
		return () => {
			alive = false;
		};
	}, []);

	const filtered = useMemo(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return notebooks;
		return notebooks.filter((notebook) => {
			const hay = `${notebook.title} ${notebook.description}`.toLowerCase();
			return hay.includes(needle);
		});
	}, [notebooks, query]);

	const toggle = (notebook: ResearchProject) => {
		if (disabled) return;
		const selected = selectedIds.includes(notebook.id);
		const next = selected
			? selectedIds.filter((id) => id !== notebook.id)
			: [...selectedIds, notebook.id].slice(0, MAX_SELECTED);
		onChange(next);
		if (!selected && next.includes(notebook.id)) {
			onUseTitle?.({ id: notebook.id, title: notebook.title || "Untitled notebook" });
		}
	};

	const notebooksHref = notebookLibraryHref(variant);
	const selectedCount = selectedIds.length;
	const showSearch = notebooks.length > 6;

	return (
		<section
			className={`assign-library${compact ? " assign-library-compact" : ""}`}
			aria-labelledby="assign-library-title"
		>
			<div className="assign-library-head">
				<div>
					<h2 id="assign-library-title" className="assign-library-title">
						<IconLibrary size={15} />
						From your research notebook
						{selectedCount > 0 ? (
							<span className="assign-library-count">
								{selectedCount} selected
							</span>
						) : null}
					</h2>
					<p className="assign-library-help">
						Optional: pick notebooks. Generation uses the whole folder — notes, files, data,
						surveys, figures, and lab work. Assignments are not listed here.
					</p>
				</div>
				<Link href={notebooksHref} className="assign-library-link">
					Open notebooks
				</Link>
			</div>

			{showSearch ? (
				<label className="assign-library-search">
					<IconSearch size={14} />
					<span className="sr-only">Search notebooks</span>
					<input
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search notebooks…"
						disabled={disabled || loading}
					/>
				</label>
			) : null}

			{loading ? (
				<p className="assign-library-state">Loading your notebooks…</p>
			) : error ? (
				<p className="assign-library-error" role="alert">
					{error}
				</p>
			) : notebooks.length === 0 ? (
				<p className="assign-library-state">
					No research notebooks yet. Create one in Research Notebook — assignment work stays under
					Assignments.
				</p>
			) : filtered.length === 0 ? (
				<p className="assign-library-state">No notebooks match that search.</p>
			) : (
				<ul className="assign-library-list">
					{filtered.map((notebook) => {
						const checked = selectedIds.includes(notebook.id);
						const atCap = !checked && selectedIds.length >= MAX_SELECTED;
						return (
							<li key={notebook.id}>
								<label
									className={`assign-library-option${checked ? " is-selected" : ""}`}
								>
									<input
										type="checkbox"
										checked={checked}
										disabled={disabled || atCap}
										onChange={() => toggle(notebook)}
									/>
									<span>
										<strong>{notebook.title || "Untitled notebook"}</strong>
										<small>{notebookLibraryMeta(notebook)}</small>
									</span>
								</label>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
