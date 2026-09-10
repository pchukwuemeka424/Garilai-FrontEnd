"use client";

import { canonicalizeSectionTitle, sectionHeadingId } from "@/lib/research-paper-sections";
import { getScopeRefineChips } from "@/lib/research-scope-brief";

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
