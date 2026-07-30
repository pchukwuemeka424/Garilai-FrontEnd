import { validateReference, type ReferenceInput } from "@/lib/citation-format";
import { parsePastedReferences, type ParsedReference } from "@/lib/citation-parse";
import { getSourceBucket } from "@/lib/source-types";

export type ValidationSeverity = "error" | "warning" | "info";

export type ValidationIssue = {
	id: string;
	severity: ValidationSeverity;
	code: string;
	message: string;
	field?: keyof ReferenceInput | "duplicate" | "doiLookup";
};

export type ValidatedReference = {
	index: number;
	original: string;
	parsed: ParsedReference;
	issues: ValidationIssue[];
	score: number;
	status: "pass" | "review" | "fail";
};

export type ValidationReport = {
	total: number;
	passed: number;
	needsReview: number;
	failed: number;
	issueCount: { error: number; warning: number; info: number };
	overallScore: number;
	entries: ValidatedReference[];
	summary: string[];
};

const DOI_PATTERN = /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i;
const URL_PATTERN = /^https?:\/\/[^\s]+$/i;
const YEAR_MIN = 1600;
const YEAR_MAX = new Date().getFullYear() + 1;

function trim(s: string | undefined): string {
	return (s ?? "").trim();
}

function normalizeTitle(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function doiLooksValid(doi: string): boolean {
	const clean = doi
		.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
		.replace(/^doi:\s*/i, "")
		.trim();
	return DOI_PATTERN.test(clean);
}

function yearLooksValid(year: string): boolean {
	if (!/^\d{4}$/.test(year)) return false;
	const n = Number(year);
	return n >= YEAR_MIN && n <= YEAR_MAX;
}

function authorFormatIssues(authors: string): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const raw = trim(authors);
	if (!raw) return issues;

	if (!/[;,]/.test(raw) && raw.split(/\s+/).length > 4) {
		issues.push({
			id: "author-separator",
			severity: "info",
			code: "AUTHOR_FORMAT",
			message: "Multiple authors work best as “Last, First; Last, First”.",
			field: "authors",
		});
	}

	if (/\bet\s+al\.?\b/i.test(raw) && !/;/.test(raw) && raw.split(/\s+/).length <= 4) {
		issues.push({
			id: "author-etal",
			severity: "info",
			code: "AUTHOR_ETAL",
			message: "“et al.” detected — expand authors when style rules require a full list.",
			field: "authors",
		});
	}

	return issues;
}

function fieldIssues(ref: ReferenceInput): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const required = validateReference(ref);

	for (const message of required) {
		const isHard =
			/required/i.test(message) &&
			!/recommended/i.test(message);
		issues.push({
			id: `field-${message.slice(0, 24)}`,
			severity: isHard ? "error" : "warning",
			code: isHard ? "MISSING_REQUIRED" : "MISSING_RECOMMENDED",
			message,
		});
	}

	const year = trim(ref.year);
	if (year && !yearLooksValid(year)) {
		issues.push({
			id: "year-invalid",
			severity: "error",
			code: "INVALID_YEAR",
			message: `Year “${year}” looks invalid (expected ${YEAR_MIN}–${YEAR_MAX}).`,
			field: "year",
		});
	}

	const doi = trim(ref.doi);
	if (doi && !doiLooksValid(doi)) {
		issues.push({
			id: "doi-format",
			severity: "error",
			code: "INVALID_DOI",
			message: "DOI format looks invalid. Expected like 10.1234/example.",
			field: "doi",
		});
	}

	const url = trim(ref.url);
	if (url && !URL_PATTERN.test(url)) {
		issues.push({
			id: "url-format",
			severity: "warning",
			code: "INVALID_URL",
			message: "URL should start with http:// or https://.",
			field: "url",
		});
	}

	const bucket = getSourceBucket(ref.sourceType);
	if (bucket === "journal" && trim(ref.journal) && !trim(ref.volume) && !trim(ref.pages) && !doi) {
		issues.push({
			id: "journal-locator",
			severity: "warning",
			code: "MISSING_LOCATOR",
			message: "Journal entry is missing volume/pages or a DOI.",
			field: "volume",
		});
	}

	if (bucket === "website" && trim(ref.url) && !trim(ref.accessDate)) {
		issues.push({
			id: "access-date",
			severity: "info",
			code: "MISSING_ACCESS_DATE",
			message: "Access date is recommended for web sources in APA/Harvard.",
			field: "accessDate",
		});
	}

	if (!doi && !url && bucket !== "book") {
		issues.push({
			id: "no-identifier",
			severity: "info",
			code: "NO_IDENTIFIER",
			message: "No DOI or URL — add one when available for verifiability.",
		});
	}

	issues.push(...authorFormatIssues(ref.authors));
	return issues;
}

function scoreFromIssues(issues: ValidationIssue[]): number {
	let score = 100;
	for (const issue of issues) {
		if (issue.severity === "error") score -= 22;
		else if (issue.severity === "warning") score -= 10;
		else score -= 3;
	}
	return Math.max(0, Math.min(100, score));
}

function statusFromScore(score: number, issues: ValidationIssue[]): ValidatedReference["status"] {
	if (issues.some((i) => i.severity === "error") || score < 55) return "fail";
	if (issues.some((i) => i.severity === "warning") || score < 85) return "review";
	return "pass";
}

function findDuplicates(entries: { index: number; ref: ReferenceInput }[]): Map<number, ValidationIssue[]> {
	const byIndex = new Map<number, ValidationIssue[]>();
	const doiMap = new Map<string, number>();
	const titleMap = new Map<string, number>();

	for (const { index, ref } of entries) {
		const doi = trim(ref.doi)
			.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
			.replace(/^doi:\s*/i, "")
			.toLowerCase();
		const titleKey = `${normalizeTitle(ref.title)}|${trim(ref.year)}`;

		if (doi) {
			const prev = doiMap.get(doi);
			if (prev !== undefined) {
				const msg = `Duplicate DOI also found in reference ${prev + 1}.`;
				const issue: ValidationIssue = {
					id: `dup-doi-${index}`,
					severity: "error",
					code: "DUPLICATE_DOI",
					message: msg,
					field: "duplicate",
				};
				byIndex.set(index, [...(byIndex.get(index) ?? []), issue]);
				byIndex.set(prev, [
					...(byIndex.get(prev) ?? []),
					{
						...issue,
						id: `dup-doi-${prev}`,
						message: `Duplicate DOI also found in reference ${index + 1}.`,
					},
				]);
			} else {
				doiMap.set(doi, index);
			}
		}

		if (trim(ref.title)) {
			const prev = titleMap.get(titleKey);
			if (prev !== undefined) {
				const issue: ValidationIssue = {
					id: `dup-title-${index}`,
					severity: "warning",
					code: "DUPLICATE_TITLE",
					message: `Possible duplicate of reference ${prev + 1} (same title and year).`,
					field: "duplicate",
				};
				byIndex.set(index, [...(byIndex.get(index) ?? []), issue]);
				byIndex.set(prev, [
					...(byIndex.get(prev) ?? []),
					{
						...issue,
						id: `dup-title-${prev}`,
						message: `Possible duplicate of reference ${index + 1} (same title and year).`,
					},
				]);
			} else {
				titleMap.set(titleKey, index);
			}
		}
	}

	return byIndex;
}

/** Validate a list of structured references (e.g. bibliography entries). */
export function validateReferenceList(entries: ReferenceInput[]): ValidationReport {
	const parsed: ParsedReference[] = entries.map((reference) => ({
		reference,
		confidence: "high",
		warnings: [],
		original: [reference.authors, reference.title, reference.year].filter(Boolean).join(". "),
	}));
	return buildReport(parsed);
}

/** Parse pasted bibliography text and run the full validator. */
export function validatePastedBibliography(text: string): ValidationReport {
	const parsed = parsePastedReferences(text);
	return buildReport(parsed);
}

function buildReport(parsed: ParsedReference[]): ValidationReport {
	const dupIssues = findDuplicates(
		parsed.map((p, index) => ({ index, ref: p.reference })),
	);

	const entries: ValidatedReference[] = parsed.map((p, index) => {
		const parseIssues: ValidationIssue[] = p.warnings.map((message, i) => ({
			id: `parse-${index}-${i}`,
			severity: p.confidence === "low" ? "warning" : "info",
			code: "PARSE_WARNING",
			message,
		}));

		const issues = [
			...fieldIssues(p.reference),
			...parseIssues,
			...(dupIssues.get(index) ?? []),
		];

		const score = scoreFromIssues(issues);
		return {
			index,
			original: p.original,
			parsed: p,
			issues,
			score,
			status: statusFromScore(score, issues),
		};
	});

	return { ...summarize(entries), entries };
}

export type DoiLookupResult = {
	ok: boolean;
	doi: string;
	title?: string;
	message: string;
};

/** Verify a DOI exists via Crossref (client-side, keyless). */
export async function verifyDoi(doi: string): Promise<DoiLookupResult> {
	const clean = doi
		.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
		.replace(/^doi:\s*/i, "")
		.trim();

	if (!clean) {
		return { ok: false, doi: clean, message: "Enter a DOI to verify." };
	}
	if (!doiLooksValid(clean)) {
		return { ok: false, doi: clean, message: "DOI format is invalid." };
	}

	try {
		const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(clean)}`, {
			headers: { Accept: "application/json" },
		});
		if (res.status === 404) {
			return { ok: false, doi: clean, message: "DOI not found in Crossref." };
		}
		if (!res.ok) {
			return { ok: false, doi: clean, message: `Crossref lookup failed (HTTP ${res.status}).` };
		}
		const json = (await res.json()) as { message?: { title?: string[] } };
		const title = json.message?.title?.[0];
		return {
			ok: true,
			doi: clean,
			title,
			message: title ? `Verified: “${title}”` : "DOI verified in Crossref.",
		};
	} catch {
		return { ok: false, doi: clean, message: "Could not reach Crossref. Try again." };
	}
}

/** Batch-verify DOIs present on validated entries (sequential to be polite to Crossref). */
export async function verifyDoisInReport(
	report: ValidationReport,
	onProgress?: (done: number, total: number) => void,
): Promise<Map<number, DoiLookupResult>> {
	const results = new Map<number, DoiLookupResult>();
	const withDoi = report.entries.filter((e) => trim(e.parsed.reference.doi));
	let done = 0;

	for (const entry of withDoi) {
		const doi = trim(entry.parsed.reference.doi);
		const result = await verifyDoi(doi);
		results.set(entry.index, result);
		done += 1;
		onProgress?.(done, withDoi.length);
	}

	return results;
}

function summarize(entries: ValidatedReference[]): Omit<ValidationReport, "entries"> {
	const issueCount = { error: 0, warning: 0, info: 0 };
	for (const entry of entries) {
		for (const issue of entry.issues) {
			issueCount[issue.severity] += 1;
		}
	}

	const passed = entries.filter((e) => e.status === "pass").length;
	const needsReview = entries.filter((e) => e.status === "review").length;
	const failed = entries.filter((e) => e.status === "fail").length;
	const overallScore =
		entries.length === 0
			? 0
			: Math.round(entries.reduce((sum, e) => sum + e.score, 0) / entries.length);

	const summary: string[] = [];
	if (entries.length === 0) {
		summary.push("Paste a bibliography to validate citations before submission.");
	} else {
		summary.push(`${entries.length} reference${entries.length === 1 ? "" : "s"} checked.`);
		if (failed) summary.push(`${failed} need fixes before submission.`);
		if (needsReview) summary.push(`${needsReview} should be reviewed.`);
		if (passed && !failed && !needsReview) summary.push("All references look submission-ready.");
		if (issueCount.error === 0 && issueCount.warning > 0) {
			summary.push("No blocking errors — address warnings for a stronger bibliography.");
		}
	}

	return {
		total: entries.length,
		passed,
		needsReview,
		failed,
		issueCount,
		overallScore,
		summary,
	};
}

export function mergeDoiLookups(
	report: ValidationReport,
	lookups: Map<number, DoiLookupResult>,
): ValidationReport {
	const entries = report.entries.map((entry) => {
		const lookup = lookups.get(entry.index);
		if (!lookup) return entry;

		const extra: ValidationIssue = lookup.ok
			? {
					id: `doi-ok-${entry.index}`,
					severity: "info",
					code: "DOI_VERIFIED",
					message: lookup.message,
					field: "doiLookup",
				}
			: {
					id: `doi-fail-${entry.index}`,
					severity: "error",
					code: "DOI_NOT_FOUND",
					message: lookup.message,
					field: "doiLookup",
				};

		const issues = [
			...entry.issues.filter((i) => i.field !== "doiLookup"),
			extra,
		];
		const score = scoreFromIssues(issues);
		return {
			...entry,
			issues,
			score,
			status: statusFromScore(score, issues),
		};
	});

	return { ...summarize(entries), entries };
}
