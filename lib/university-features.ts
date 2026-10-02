export const UNIVERSITY_FEATURE_KEYS = [
	"researchAssistant",
	"researchNotebook",
	"studentAssessment",
	"supervisionAssistant",
	"advancedResearch",
] as const;

export type UniversityFeatureKey = (typeof UNIVERSITY_FEATURE_KEYS)[number];

export type UniversityFeatures = Record<UniversityFeatureKey, boolean>;

export const DEFAULT_UNIVERSITY_FEATURES: UniversityFeatures = {
	researchAssistant: true,
	researchNotebook: true,
	studentAssessment: true,
	supervisionAssistant: true,
	advancedResearch: true,
};

export const UNIVERSITY_FEATURE_LABELS: Record<UniversityFeatureKey, { label: string; description: string }> = {
	researchAssistant: {
		label: "Research Assistant AI",
		description: "AI research ideas, outlines, and paper generation for students and lecturers.",
	},
	researchNotebook: {
		label: "Research Notebook AI",
		description: "AI-assisted notes, datasets, figures, and lab workspace.",
	},
	studentAssessment: {
		label: "Student Assessment AI hub",
		description: "Student AI-assisted projects hub, assignments, and feedback.",
	},
	supervisionAssistant: {
		label: "Supervision AI",
		description: "Lecturer AI-assisted supervision of theses, chapter AI review, and supervisees.",
	},
	advancedResearch: {
		label: "Advanced Research AI",
		description: "Live generate, effort reports, and advanced AI research scopes.",
	},
};

export function normalizeUniversityFeatures(
	raw: Partial<UniversityFeatures> | null | undefined,
): UniversityFeatures {
	const out = { ...DEFAULT_UNIVERSITY_FEATURES };
	if (!raw || typeof raw !== "object") return out;
	for (const key of UNIVERSITY_FEATURE_KEYS) {
		if (typeof raw[key] === "boolean") out[key] = raw[key];
	}
	return out;
}
