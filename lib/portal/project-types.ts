export type ProjectType =
  | "dissertation"
  | "thesis"
  | "research"
  | "project"
  | "capstone"
  | "publication"
  | "assignment";

export type ProjectSectionDef = {
  key: string;
  label: string;
  placeholder: string;
};

export const PROJECT_TYPES: {
  value: ProjectType;
  label: string;
  description: string;
}[] = [
  {
    value: "dissertation",
    label: "Dissertation",
    description: "Postgraduate dissertation with full chapter structure",
  },
  {
    value: "thesis",
    label: "Thesis",
    description: "MPhil / PhD thesis with extended chapters",
  },
  {
    value: "research",
    label: "Research paper",
    description: "Research article / paper sections",
  },
  {
    value: "project",
    label: "Project",
    description: "Undergraduate / HND project report",
  },
  {
    value: "capstone",
    label: "Capstone",
    description: "Capstone project deliverables",
  },
  {
    value: "publication",
    label: "Publication",
    description: "Journal / conference publication draft",
  },
  {
    value: "assignment",
    label: "Assignment",
    description: "Coursework / term paper assignment",
  },
];

const CHAPTER_TABS: ProjectSectionDef[] = [
  {
    key: "abstract",
    label: "Abstract",
    placeholder: "Write a concise abstract of your work…",
  },
  {
    key: "introduction",
    label: "Introduction",
    placeholder: "Background, problem statement, objectives, research questions…",
  },
  {
    key: "literature",
    label: "Literature Review",
    placeholder: "Review related literature and identify the research gap…",
  },
  {
    key: "methodology",
    label: "Methodology",
    placeholder: "Describe design, population, sampling, instruments, analysis…",
  },
  {
    key: "results",
    label: "Results",
    placeholder: "Present findings with tables, figures, and interpretation…",
  },
  {
    key: "discussion",
    label: "Discussion & Conclusion",
    placeholder: "Discuss findings, implications, limitations, recommendations…",
  },
  {
    key: "references",
    label: "References",
    placeholder: "List references in your chosen citation style…",
  },
];

export const PROJECT_SECTION_TEMPLATES: Record<ProjectType, ProjectSectionDef[]> =
  {
    dissertation: CHAPTER_TABS,
    thesis: [
      {
        key: "abstract",
        label: "Abstract",
        placeholder: "Thesis abstract…",
      },
      {
        key: "introduction",
        label: "Introduction",
        placeholder: "Introduce the thesis topic and contribution…",
      },
      {
        key: "literature",
        label: "Literature Review",
        placeholder: "Critical review of literature…",
      },
      {
        key: "methodology",
        label: "Methodology",
        placeholder: "Research design and methods…",
      },
      {
        key: "findings",
        label: "Findings",
        placeholder: "Present and analyse findings…",
      },
      {
        key: "discussion",
        label: "Discussion",
        placeholder: "Discuss implications and contribution to knowledge…",
      },
      {
        key: "conclusion",
        label: "Conclusion",
        placeholder: "Conclude and recommend future work…",
      },
      {
        key: "references",
        label: "References",
        placeholder: "Reference list…",
      },
    ],
    research: [
      {
        key: "title_page",
        label: "Title & Authors",
        placeholder: "Title, authors, affiliation…",
      },
      {
        key: "abstract",
        label: "Abstract",
        placeholder: "Structured abstract…",
      },
      {
        key: "introduction",
        label: "Introduction",
        placeholder: "Context and research problem…",
      },
      {
        key: "methods",
        label: "Methods",
        placeholder: "Methods and materials…",
      },
      {
        key: "results",
        label: "Results",
        placeholder: "Results…",
      },
      {
        key: "discussion",
        label: "Discussion",
        placeholder: "Discussion…",
      },
      {
        key: "references",
        label: "References",
        placeholder: "References…",
      },
    ],
    project: [
      {
        key: "abstract",
        label: "Abstract",
        placeholder: "Project abstract…",
      },
      {
        key: "introduction",
        label: "Introduction",
        placeholder: "Project background and objectives…",
      },
      {
        key: "literature",
        label: "Literature Review",
        placeholder: "Related work…",
      },
      {
        key: "design",
        label: "System / Project Design",
        placeholder: "Architecture, design, tools…",
      },
      {
        key: "implementation",
        label: "Implementation",
        placeholder: "Implementation details…",
      },
      {
        key: "testing",
        label: "Testing & Evaluation",
        placeholder: "Tests, results, evaluation…",
      },
      {
        key: "conclusion",
        label: "Conclusion",
        placeholder: "Conclusion and recommendations…",
      },
      {
        key: "references",
        label: "References",
        placeholder: "References…",
      },
    ],
    capstone: [
      {
        key: "executive_summary",
        label: "Executive Summary",
        placeholder: "Executive summary…",
      },
      {
        key: "problem",
        label: "Problem Statement",
        placeholder: "Define the problem…",
      },
      {
        key: "solution",
        label: "Proposed Solution",
        placeholder: "Describe your solution…",
      },
      {
        key: "implementation",
        label: "Implementation",
        placeholder: "How you built it…",
      },
      {
        key: "outcomes",
        label: "Outcomes",
        placeholder: "Results and impact…",
      },
      {
        key: "reflection",
        label: "Reflection",
        placeholder: "Lessons learned…",
      },
      {
        key: "references",
        label: "References",
        placeholder: "References…",
      },
    ],
    publication: [
      {
        key: "abstract",
        label: "Abstract",
        placeholder: "Publication abstract…",
      },
      {
        key: "introduction",
        label: "Introduction",
        placeholder: "Introduction…",
      },
      {
        key: "related_work",
        label: "Related Work",
        placeholder: "Related work…",
      },
      {
        key: "contribution",
        label: "Contribution",
        placeholder: "Your contribution…",
      },
      {
        key: "evaluation",
        label: "Evaluation",
        placeholder: "Evaluation and results…",
      },
      {
        key: "conclusion",
        label: "Conclusion",
        placeholder: "Conclusion…",
      },
      {
        key: "references",
        label: "References",
        placeholder: "References…",
      },
    ],
    // Single writing surface — not split into chapters/sections
    assignment: [
      {
        key: "document",
        label: "Assignment",
        placeholder:
          "Write your full assignment here, or import a Word/PDF draft…",
      },
    ],
  };

/** Assignments use one writing page; other types keep multi-section chapters. */
export function isSinglePageProjectType(type?: string | null): boolean {
  return type === "assignment";
}

export function getSectionsForType(type: ProjectType): ProjectSectionDef[] {
  return PROJECT_SECTION_TEMPLATES[type] ?? PROJECT_SECTION_TEMPLATES.project;
}

export function emptySectionsForType(type: ProjectType): Record<string, string> {
  return Object.fromEntries(
    getSectionsForType(type).map((section) => [section.key, ""]),
  );
}

export function projectTypeLabel(type: string) {
  return PROJECT_TYPES.find((t) => t.value === type)?.label ?? type;
}

/** Lowercase type noun for prose, e.g. "assignment". Falls back to "project". */
export function projectTypeNoun(type?: string | null) {
  if (!type) return "project";
  const label = PROJECT_TYPES.find((t) => t.value === type)?.label;
  return label ? label.toLowerCase() : "project";
}

/**
 * Student create-flow action verb.
 * Assignments → "submit"; other types → "create".
 * (API still creates the project; labels only.)
 */
export function projectCreationVerb(type?: string | null) {
  return type === "assignment" ? "submit" : "create";
}

/** Capitalized create-flow verb, e.g. "Submit" / "Create". */
export function projectCreationVerbLabel(type?: string | null) {
  const verb = projectCreationVerb(type);
  return verb.charAt(0).toUpperCase() + verb.slice(1);
}

/** Primary CTA on the final create step. */
export function projectCreationSubmitCta(type?: string | null) {
  const noun = projectTypeNoun(type);
  if (type === "assignment") return "Submit assignment";
  return `Create ${noun} and open editor`;
}

/** Pending label while the create request runs. */
export function projectCreationSubmitPending(type?: string | null) {
  return type === "assignment" ? "Submitting…" : "Creating…";
}

/** Field / step label for the working title, e.g. "Assignment title". */
export function projectTitleFieldLabel(type?: string | null) {
  const label = type
    ? PROJECT_TYPES.find((t) => t.value === type)?.label
    : null;
  return label ? `${label} title` : "Project title";
}

/**
 * Noun for the writable unit in editor/submit UI.
 * Assignments (single-page) → "assignment"; other types → "chapter".
 */
export function projectWritingUnitNoun(type?: string | null) {
  return isSinglePageProjectType(type) ? projectTypeNoun(type) : "chapter";
}

/** Capitalized writing-unit noun, e.g. "Assignment" / "Chapter". */
export function projectWritingUnitLabel(type?: string | null) {
  const noun = projectWritingUnitNoun(type);
  return noun.charAt(0).toUpperCase() + noun.slice(1);
}

/** Field label for the writing-unit title, e.g. "Assignment title". */
export function projectWritingUnitTitleLabel(type?: string | null) {
  return `${projectWritingUnitLabel(type)} title`;
}

/**
 * Lowercase noun for the academic advisor shown in student UI.
 * Assignments → "lecturer"; other types → "supervisor".
 * (API/role fields remain `supervisor`.)
 */
export function projectAdvisorNoun(type?: string | null) {
  return type === "assignment" ? "lecturer" : "supervisor";
}

/** Capitalized advisor noun, e.g. "Lecturer" / "Supervisor". */
export function projectAdvisorLabel(type?: string | null) {
  const noun = projectAdvisorNoun(type);
  return noun.charAt(0).toUpperCase() + noun.slice(1);
}

export type ProjectHowItWorksStep = {
  title: string;
  body: string;
};

export type ProjectCreationGuidance = {
  tip: string;
  setupBlurb: string;
  structureHint: string;
  titleHint: string;
  titleChecklist: readonly [string, string, string];
  descriptionPlaceholder: string;
  /** Action-card teaser on the project detail page. */
  howItWorksTeaser: string;
  /** Expanded “How it works” steps on the project detail page. */
  howItWorksSteps: readonly [
    ProjectHowItWorksStep,
    ProjectHowItWorksStep,
    ProjectHowItWorksStep,
  ];
};

const DEFAULT_HOW_IT_WORKS_TEASER = "See the research writing workflow";

const DEFAULT_HOW_IT_WORKS_STEPS = [
  {
    title: "1. Add or import chapters",
    body: "Create sections manually or upload a Word/PDF draft.",
  },
  {
    title: "2. Write on a full page",
    body: "Open any chapter to edit in the full-width editor.",
  },
  {
    title: "3. Submit for review",
    body: "Send chapters to your supervisor from the editor page.",
  },
] as const;

const DEFAULT_SETUP_BLURB =
  "Set up a research folder in three short steps. You’ll open the editor immediately after creating it.";

const DEFAULT_STRUCTURE_HINT =
  "This sets the recommended chapter structure. You can still rename and add chapters freely in the editor.";

const DEFAULT_TITLE_HINT =
  "Use a clear title. You can refine it later; it also becomes your initial topic for supervisor approval.";

const DEFAULT_TITLE_CHECKLIST = [
  "Name the topic, not just the course or department",
  "Keep it specific enough for a supervisor to understand",
  "Avoid abbreviations unless they are widely known",
] as const;

/** Per-category creation tips and step guidance. */
export const PROJECT_TYPE_GUIDANCE: Record<ProjectType, ProjectCreationGuidance> =
  {
    dissertation: {
      tip: "Best for postgraduate work with a full chapter structure and supervisor reviews.",
      setupBlurb:
        "Set up your dissertation in three short steps. You’ll open the editor immediately after creating it.",
      structureHint:
        "This sets the recommended chapter structure for a dissertation. You can still rename and add chapters freely in the editor.",
      titleHint:
        "Use a clear dissertation title. You can refine it later; it also becomes your initial topic for supervisor approval.",
      titleChecklist: [
        "Name the research topic, not just the course or department",
        "Keep it specific enough for a supervisor to understand",
        "Avoid abbreviations unless they are widely known",
      ],
      descriptionPlaceholder: "Brief overview of your dissertation focus…",
      howItWorksTeaser: "See the dissertation writing workflow",
      howItWorksSteps: [
        {
          title: "1. Add or import chapters",
          body: "Create dissertation chapters manually or upload a Word/PDF draft.",
        },
        {
          title: "2. Write on a full page",
          body: "Open any chapter to edit in the full-width editor.",
        },
        {
          title: "3. Submit for review",
          body: "Send chapters to your supervisor from the editor page.",
        },
      ],
    },
    thesis: {
      tip: "Use for MPhil/PhD theses with extended literature and findings chapters.",
      setupBlurb:
        "Set up your thesis in three short steps. You’ll open the editor immediately after creating it.",
      structureHint:
        "This sets the recommended chapter structure for a thesis. You can still rename and add chapters freely in the editor.",
      titleHint:
        "Use a clear thesis title. You can refine it later; it also becomes your initial topic for supervisor approval.",
      titleChecklist: [
        "Name the research topic, not just the course or department",
        "Keep it specific enough for a supervisor to understand",
        "Avoid abbreviations unless they are widely known",
      ],
      descriptionPlaceholder: "Brief overview of your thesis focus…",
      howItWorksTeaser: "See the thesis writing workflow",
      howItWorksSteps: [
        {
          title: "1. Add or import chapters",
          body: "Create thesis chapters manually or upload a Word/PDF draft.",
        },
        {
          title: "2. Write on a full page",
          body: "Open any chapter to edit in the full-width editor.",
        },
        {
          title: "3. Submit for review",
          body: "Send chapters to your supervisor from the editor page.",
        },
      ],
    },
    research: {
      tip: "Shorter article-style sections for research papers and journal drafts.",
      setupBlurb:
        "Set up your research paper in three short steps. You’ll open the editor immediately after creating it.",
      structureHint:
        "This sets the recommended article-style sections. You can still rename and add sections freely in the editor.",
      titleHint:
        "Use a clear paper title. You can refine it later; it also becomes your initial topic for supervisor approval.",
      titleChecklist: [
        "Name the research question or contribution, not just the course",
        "Keep it specific enough for a supervisor to understand",
        "Avoid abbreviations unless they are widely known",
      ],
      descriptionPlaceholder: "Brief overview of your research focus…",
      howItWorksTeaser: "See the research paper writing workflow",
      howItWorksSteps: [
        {
          title: "1. Add or import sections",
          body: "Create article sections manually or upload a Word/PDF draft.",
        },
        {
          title: "2. Write on a full page",
          body: "Open any section to edit in the full-width editor.",
        },
        {
          title: "3. Submit for review",
          body: "Send sections to your supervisor from the editor page.",
        },
      ],
    },
    project: {
      tip: "Undergraduate / HND project reports with design and implementation chapters.",
      setupBlurb:
        "Set up your project report in three short steps. You’ll open the editor immediately after creating it.",
      structureHint:
        "This sets the recommended report chapters (design, implementation, testing). You can still rename and add chapters freely in the editor.",
      titleHint:
        "Use a clear project title. You can refine it later; it also becomes your initial topic for supervisor approval.",
      titleChecklist: [...DEFAULT_TITLE_CHECKLIST],
      descriptionPlaceholder: "Brief overview of your project focus…",
      howItWorksTeaser: "See the project report writing workflow",
      howItWorksSteps: [
        {
          title: "1. Add or import chapters",
          body: "Create report chapters manually or upload a Word/PDF draft.",
        },
        {
          title: "2. Write on a full page",
          body: "Open any chapter to edit in the full-width editor.",
        },
        {
          title: "3. Submit for review",
          body: "Send chapters to your supervisor from the editor page.",
        },
      ],
    },
    capstone: {
      tip: "Outcome-focused deliverables: problem, solution, implementation, reflection.",
      setupBlurb:
        "Set up your capstone in three short steps. You’ll open the editor immediately after creating it.",
      structureHint:
        "This sets outcome-focused deliverable sections. You can still rename and add sections freely in the editor.",
      titleHint:
        "Use a clear capstone title. You can refine it later; it also becomes your initial topic for supervisor approval.",
      titleChecklist: [
        "Name the problem or deliverable, not just the course or department",
        "Keep it specific enough for a supervisor to understand",
        "Avoid abbreviations unless they are widely known",
      ],
      descriptionPlaceholder: "Brief overview of your capstone focus…",
      howItWorksTeaser: "See the capstone deliverable workflow",
      howItWorksSteps: [
        {
          title: "1. Add or import sections",
          body: "Create deliverable sections manually or upload a Word/PDF draft.",
        },
        {
          title: "2. Write on a full page",
          body: "Open any section to edit in the full-width editor.",
        },
        {
          title: "3. Submit for review",
          body: "Send sections to your supervisor from the editor page.",
        },
      ],
    },
    publication: {
      tip: "Conference or journal drafts with contribution and evaluation sections.",
      setupBlurb:
        "Set up your publication draft in three short steps. You’ll open the editor immediately after creating it.",
      structureHint:
        "This sets contribution and evaluation sections typical of conference/journal drafts. You can still rename and add sections freely in the editor.",
      titleHint:
        "Use a clear publication title. You can refine it later; it also becomes your initial topic for supervisor approval.",
      titleChecklist: [
        "Name the contribution, not just the venue or course",
        "Keep it specific enough for a supervisor to understand",
        "Avoid abbreviations unless they are widely known",
      ],
      descriptionPlaceholder: "Brief overview of your publication focus…",
      howItWorksTeaser: "See the publication draft workflow",
      howItWorksSteps: [
        {
          title: "1. Add or import sections",
          body: "Create publication sections manually or upload a Word/PDF draft.",
        },
        {
          title: "2. Write on a full page",
          body: "Open any section to edit in the full-width editor.",
        },
        {
          title: "3. Submit for review",
          body: "Send sections to your supervisor from the editor page.",
        },
      ],
    },
    assignment: {
      tip: "Coursework and term papers on a single writing page — no chapter split.",
      setupBlurb:
        "Choose your lecturer and published brief, then confirm your details. You’ll get one writing page to draft or import into.",
      structureHint:
        "Assignments stay on one page (not split into chapters). Write everything there, or import a Word/PDF as a single document.",
      titleHint:
        "Use a clear assignment title. You can refine it later; it also becomes your initial topic for lecturer approval.",
      titleChecklist: [
        "Name the topic or brief, not just the course code",
        "Keep it specific enough for a lecturer to understand",
        "Avoid abbreviations unless they are widely known",
      ],
      descriptionPlaceholder: "Brief overview of the assignment brief…",
      howItWorksTeaser: "See the assignment writing workflow",
      howItWorksSteps: [
        {
          title: "1. Write or import",
          body: "Open the single writing page, or upload a Word/PDF — the full draft stays on one page.",
        },
        {
          title: "2. Edit in the full editor",
          body: "Use the full-width editor for the whole assignment (headings stay in the same page).",
        },
        {
          title: "3. Submit for review",
          body: "Send your assignment to your lecturer from the editor page.",
        },
      ],
    },
  };

export function projectCreationGuidance(
  type?: string | null,
): ProjectCreationGuidance | null {
  if (!type) return null;
  return PROJECT_TYPE_GUIDANCE[type as ProjectType] ?? null;
}

/** Fallback blurb when no category is selected yet. */
export function projectCreationSetupBlurb(type?: string | null) {
  return projectCreationGuidance(type)?.setupBlurb ?? DEFAULT_SETUP_BLURB;
}

export function projectCreationStructureHint(type?: string | null) {
  return (
    projectCreationGuidance(type)?.structureHint ?? DEFAULT_STRUCTURE_HINT
  );
}

export function projectCreationTitleHint(type?: string | null) {
  const guidance = projectCreationGuidance(type);
  if (guidance) return guidance.titleHint;
  const noun = projectTypeNoun(type);
  if (type) {
    return `Use a clear ${noun} title. You can refine it later; it also becomes your initial topic for ${projectAdvisorNoun(type)} approval.`;
  }
  return DEFAULT_TITLE_HINT;
}

export function projectCreationTitleChecklist(type?: string | null) {
  return (
    projectCreationGuidance(type)?.titleChecklist ?? DEFAULT_TITLE_CHECKLIST
  );
}

export function projectHowItWorksTeaser(type?: string | null) {
  return (
    projectCreationGuidance(type)?.howItWorksTeaser ?? DEFAULT_HOW_IT_WORKS_TEASER
  );
}

export function projectHowItWorksSteps(type?: string | null) {
  return (
    projectCreationGuidance(type)?.howItWorksSteps ?? DEFAULT_HOW_IT_WORKS_STEPS
  );
}
