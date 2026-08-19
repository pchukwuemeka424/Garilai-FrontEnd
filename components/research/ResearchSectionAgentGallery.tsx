"use client";

import { getResearchSectionAgentGroups, type ResearchSectionAgent } from "@/lib/research-section-agents";
import type { ResearchScope } from "@/lib/research-ideas";

type Props = {
	selectedScope: ResearchScope | "";
	selectedHeading: string;
	onPick: (scope: ResearchScope, agent: ResearchSectionAgent) => void;
};

export function ResearchSectionAgentGallery({ selectedScope, selectedHeading, onPick }: Props) {
	const groups = getResearchSectionAgentGroups();

	return (
		<div className="research-agent-gallery">
			<div className="research-agent-gallery-head">
				<p className="research-field-label">Section agents</p>
				<p className="research-input-hint">
					Pick an agent to open that research type. Generate still writes the full document.
				</p>
			</div>
			{groups.map((group) => (
				<section
					key={group.scope}
					className="research-agent-type-group"
					aria-labelledby={`agent-type-${group.scope}`}
				>
					<div className="research-agent-type-heading">
						<h3 id={`agent-type-${group.scope}`}>{group.label}</h3>
						<p>{group.hint}</p>
					</div>
					<div className="research-agent-grid">
						{group.agents.map((agent) => {
							const active = selectedScope === group.scope && selectedHeading === agent.heading;
							return (
								<button
									key={agent.heading}
									type="button"
									className={`research-agent-card${active ? " research-agent-card-active" : ""}`}
									onClick={() => onPick(group.scope, agent)}
									aria-pressed={active}
								>
									<span className="research-agent-card-role">{agent.role}</span>
									<span className="research-agent-card-name">{agent.name}</span>
									<span className="research-agent-card-work">{agent.work}</span>
								</button>
							);
						})}
					</div>
				</section>
			))}
		</div>
	);
}
