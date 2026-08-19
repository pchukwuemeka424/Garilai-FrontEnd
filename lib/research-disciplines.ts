export type Discipline = {
	id: string;
	label: string;
};

export type DisciplineGroup = {
	id: string;
	label: string;
	disciplines: Discipline[];
};

function byLabel(a: { label: string }, b: { label: string }): number {
	return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
}

export const DISCIPLINE_GROUPS: DisciplineGroup[] = [
	{
		id: "business",
		label: "Business & Applied",
		disciplines: [
			{ id: "accounting", label: "Accounting" },
			{ id: "architecture", label: "Architecture" },
			{ id: "business-administration", label: "Business Administration" },
			{ id: "communication", label: "Communication & Media Studies" },
			{ id: "entrepreneurship", label: "Entrepreneurship" },
			{ id: "finance", label: "Finance" },
			{ id: "health-administration", label: "Health Administration" },
			{ id: "hospitality", label: "Hospitality & Tourism" },
			{ id: "human-resources", label: "Human Resource Management" },
			{ id: "journalism", label: "Journalism" },
			{ id: "library-science", label: "Library & Information Science" },
			{ id: "management", label: "Management" },
			{ id: "marketing", label: "Marketing" },
			{ id: "public-administration", label: "Public Administration" },
			{ id: "public-health", label: "Public Health" },
			{ id: "sports-science", label: "Sports Science & Kinesiology" },
			{ id: "supply-chain", label: "Supply Chain & Logistics" },
			{ id: "urban-planning", label: "Urban Planning" },
		].sort(byLabel),
	},
	{
		id: "humanities",
		label: "Humanities & Arts",
		disciplines: [
			{ id: "art-history", label: "Art History" },
			{ id: "classics", label: "Classics" },
			{ id: "comparative-literature", label: "Comparative Literature" },
			{ id: "creative-writing", label: "Creative Writing" },
			{ id: "cultural-studies", label: "Cultural Studies" },
			{ id: "design", label: "Design" },
			{ id: "film-studies", label: "Film & Media Arts" },
			{ id: "fine-arts", label: "Fine Arts" },
			{ id: "history", label: "History" },
			{ id: "linguistics", label: "Linguistics" },
			{ id: "literature", label: "Literature" },
			{ id: "modern-languages", label: "Modern Languages" },
			{ id: "music", label: "Music" },
			{ id: "philosophy", label: "Philosophy" },
			{ id: "theatre", label: "Theatre & Performance" },
			{ id: "theology", label: "Theology & Religious Studies" },
		].sort(byLabel),
	},
	{
		id: "social",
		label: "Social Sciences",
		disciplines: [
			{ id: "anthropology", label: "Anthropology" },
			{ id: "archaeology", label: "Archaeology" },
			{ id: "clinical-psychology", label: "Clinical Psychology" },
			{ id: "criminology", label: "Criminology" },
			{ id: "demography", label: "Demography" },
			{ id: "development-economics", label: "Development Economics" },
			{ id: "development-studies", label: "Development Studies" },
			{ id: "economics", label: "Economics" },
			{ id: "education", label: "Education" },
			{ id: "educational-psychology", label: "Educational Psychology" },
			{ id: "gender-studies", label: "Gender Studies" },
			{ id: "human-geography", label: "Human Geography" },
			{ id: "interdisciplinary", label: "Interdisciplinary Studies" },
			{ id: "international-relations", label: "International Relations" },
			{ id: "law", label: "Law" },
			{ id: "political-science", label: "Political Science" },
			{ id: "psychology", label: "Psychology" },
			{ id: "public-policy", label: "Public Policy" },
			{ id: "social-work", label: "Social Work" },
			{ id: "sociology", label: "Sociology" },
			{ id: "special-education", label: "Special Education" },
		].sort(byLabel),
	},
	{
		id: "stem",
		label: "STEM",
		disciplines: [
			{ id: "aerospace-engineering", label: "Aerospace Engineering" },
			{ id: "agriculture", label: "Agriculture & Agronomy" },
			{ id: "applied-mathematics", label: "Applied Mathematics" },
			{ id: "artificial-intelligence", label: "Artificial Intelligence" },
			{ id: "astronomy", label: "Astronomy & Astrophysics" },
			{ id: "biochemistry", label: "Biochemistry" },
			{ id: "biology", label: "Biology" },
			{ id: "biomedical-engineering", label: "Biomedical Engineering" },
			{ id: "biotechnology", label: "Biotechnology" },
			{ id: "chemical-engineering", label: "Chemical Engineering" },
			{ id: "chemistry", label: "Chemistry" },
			{ id: "civil-engineering", label: "Civil Engineering" },
			{ id: "computer-science", label: "Computer Science" },
			{ id: "cybersecurity", label: "Cybersecurity" },
			{ id: "data-science", label: "Data Science" },
			{ id: "dentistry", label: "Dentistry" },
			{ id: "earth-science", label: "Earth Science / Geology" },
			{ id: "ecology", label: "Ecology" },
			{ id: "electrical-engineering", label: "Electrical Engineering" },
			{ id: "engineering", label: "Engineering (General)" },
			{ id: "environmental-science", label: "Environmental Science" },
			{ id: "food-science", label: "Food Science & Technology" },
			{ id: "forestry", label: "Forestry" },
			{ id: "genetics", label: "Genetics" },
			{ id: "geography", label: "Geography" },
			{ id: "industrial-engineering", label: "Industrial Engineering" },
			{ id: "information-systems", label: "Information Systems" },
			{ id: "mathematics", label: "Mathematics" },
			{ id: "mechanical-engineering", label: "Mechanical Engineering" },
			{ id: "medicine", label: "Medicine & Health Sciences" },
			{ id: "meteorology", label: "Meteorology & Climate Science" },
			{ id: "microbiology", label: "Microbiology" },
			{ id: "neuroscience", label: "Neuroscience" },
			{ id: "nursing", label: "Nursing" },
			{ id: "oceanography", label: "Oceanography" },
			{ id: "pharmacy", label: "Pharmacy" },
			{ id: "physics", label: "Physics" },
			{ id: "software-engineering", label: "Software Engineering" },
			{ id: "statistics", label: "Statistics" },
			{ id: "veterinary-science", label: "Veterinary Science" },
		].sort(byLabel),
	},
];

export const DEFAULT_DISCIPLINE = "computer-science";

export function getDisciplineLabel(id: string): string {
	if (id === "other" || id === "others") return "Others";
	for (const group of DISCIPLINE_GROUPS) {
		const match = group.disciplines.find((d) => d.id === id);
		if (match) return match.label;
	}
	return id;
}
