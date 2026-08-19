"use client";

import { canonicalizeSectionTitle, sectionHeadingId } from "@/lib/research-paper-sections";
import {
	getScopeChecklistItems,
	getScopeRailHeadings,
	getScopeRefineChips,
} from "@/lib/research-scope-brief";
import { getScopeProfile } from "@/lib/research-scope-profiles";

function headingTextFromNode(node: Element): string {
	return (node.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function scrollToPaperSection(heading: string) {
	const id = sectionHeadingId(heading);
	const byId = document.getElementById(id);
	if (byId) {
		byId.scrollIntoView({ behavior: "smooth", block: "start" });
		return;
	}
	const canonical = (canonicalizeSectionTitle(heading) ?? heading).toLowerCase();
	const nodes = document.querySelectorAll(".chat-paper-markdown h2, .chat-paper-markdown h3");
	for (const node of nodes) {
		const text = headingTextFromNode(node).toLowerCase();
		const nodeCanonical = (canonicalizeSectionTitle(text) ?? text).toLowerCase();
		if (nodeCanonical === canonical || text.includes(canonical) || canonical.includes(text)) {
			node.scrollIntoView({ behavior: "smooth", block: "start" });
			return;
		}
	}
}

export function ResearchScopeSectionRail({
	scope,
	visible,
}: {
	scope: string | null | undefined;
	visible: boolean;
}) {
	if (!visible) return null;
	const headings = getScopeRailHeadings(scope);
	const checklist = getScopeChecklistItems(scope);
	const label = getScopeProfile(scope).label;

	return (
		<aside className="scope-tools-rail" aria-label={`${label} structure`}>
			<section className="scope-tools-card">
				<p className="scope-tools-kicker">{label}</p>
				<h2 className="scope-tools-title">Sections</h2>
				<nav className="scope-section-rail">
					{headings.map((heading) => (
						<button
							key={heading}
							type="button"
							className="scope-section-rail-btn"
							onClick={() => scrollToPaperSection(heading)}
						>
							{heading}
						</button>
					))}
				</nav>
			</section>
			<section className="scope-tools-card">
				<p className="scope-tools-kicker">Reader checklist</p>
				<h2 className="scope-tools-title">Must include</h2>
				<ul className="scope-checklist">
					{checklist.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			</section>
		</aside>
	);
}

export function ResearchScopeRefineChips({
	scope,
	visible,
	disabled,
	onSelect,
}: {
	scope: string | null | undefined;
	visible: boolean;
	disabled?: boolean;
	onSelect: (prompt: string) => void;
}) {
	if (!visible) return null;
	const chips = getScopeRefineChips(scope);
	if (!chips.length) return null;

	return (
		<div className="scope-refine-chips" role="group" aria-label="Type-specific revisions">
			{chips.map((chip) => (
				<button
					key={chip.id}
					type="button"
					className="scope-refine-chip"
					disabled={disabled}
					onClick={() => onSelect(chip.prompt)}
				>
					{chip.label}
				</button>
			))}
		</div>
	);
}
