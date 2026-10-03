/**
 * Generates the full institutional compliance / assurance PDF pack for universities.
 * Run: node docs/security/generate-institutional-compliance-pack.mjs
 *
 * Does NOT claim SOC 2 / ISO certification — readiness and control alignment only.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, mkdirSync } from "node:fs";
import { createInstitutionalDoc, ACCENT, BODY, BRAND } from "./lib/institutional-pdf.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = __dirname;
const DATE = "3 October 2026";
const VERSION = "1.0";

function out(name) {
	return join(OUT_DIR, name);
}

// —— 1. SOC 2 Readiness ——
createInstitutionalDoc({
	filename: out("GARIL-AI-SOC2-Readiness-Mapping.pdf"),
	title: "SOC 2 Readiness & Control Mapping",
	subtitle: "Alignment to AICPA Trust Services Criteria (Security)",
	docType: "Compliance readiness — not a formal attestation",
	footerLabel: "GARIL AI — SOC 2 Readiness Mapping  ·  Not a SOC 2 report",
	date: DATE,
	version: VERSION,
	disclaimer:
		"This document describes readiness and control alignment. It is not a SOC 2 Type I or Type II report, and it has not been issued by an independent CPA firm. Formal SOC 2 attestation requires an external audit engagement.",
	build: (d) => {
		d.h1("1. Purpose");
		d.para(
			"Universities often ask whether a SaaS or research platform is “SOC 2 compliant.” Formal SOC 2 status can only be granted through an independent CPA attestation. This document maps GARIL AI’s implemented controls to the AICPA Trust Services Criteria (primarily Security / Common Criteria) so institutional ICT and procurement teams can assess fitness for a university pilot or deployment.",
		);
		d.callout(
			"Current status",
			"GARIL AI has completed a defensive security audit and remediation (Sep–Oct 2026). Controls below are implemented in the product and recommended operating model. A formal SOC 2 Type II engagement can be commissioned when required by a partner institution.",
		);

		d.h1("2. Trust Services Criteria covered");
		d.bullet("CC1 — Control environment (governance roles, policies, accountability)");
		d.bullet("CC2 — Communication & information (legal docs, policy acceptance, admin audit)");
		d.bullet("CC3 — Risk assessment (defensive audit, remediation roadmap)");
		d.bullet("CC4 — Monitoring (audit logs, admin analytics, operational monitoring expectations)");
		d.bullet("CC5 — Control activities (authZ, rate limits, default-deny APIs)");
		d.bullet("CC6 — Logical & physical access (identity, MFA-ready password policy, scoped admin)");
		d.bullet("CC7 — System operations (backups restricted, health checks, incident process)");
		d.bullet("CC8 — Change management (versioned releases; CI/dependency scanning backlog)");
		d.bullet("CC9 — Risk mitigation (vendor AI/API subprocessors, university feature gates)");

		d.h1("3. Control mapping (Security TSC)");
		d.table(
			["Criterion", "Control in GARIL AI", "Evidence / location"],
			[
				[
					"CC6.1 Access security",
					"Authenticated sessions; default-deny APIs; active-user checks",
					"Auth JWT; public-api allowlist; requireAuthUser",
				],
				[
					"CC6.2 Prior to access",
					"Registration gated to onboarded universities; policy acceptance",
					"Auth register + legal/policy flows",
				],
				[
					"CC6.3 Role-based access",
					"Super-admin vs university-scoped admin; portal student/supervisor roles",
					"Admin console + portal auth",
				],
				[
					"CC6.6 Credentials",
					"scrypt password hashing; hashed reset tokens; stronger password policy",
					"Auth & password-policy modules",
				],
				[
					"CC6.7 Transmission",
					"TLS at reverse proxy; HSTS in production app headers; CORS allowlist",
					"Deploy proxy + Helmet + CORS_ORIGIN",
				],
				[
					"CC7.2 Monitor",
					"Admin audit events; governance telemetry for AI use",
					"Audit + AI governance services",
				],
				[
					"CC7.3/7.4 Incidents",
					"Incident & alert modules in governance console; IR overview document",
					"Admin incidents/alerts + IR PDF",
				],
				[
					"CC7.5 Recovery",
					"Super-admin database backup tooling; institutional backup policy expected",
					"Admin backup APIs",
				],
				[
					"CC9.2 Vendors",
					"Documented subprocessors (LLM, email, hosting, storage)",
					"Subprocessors PDF",
				],
			],
		);

		d.h1("4. Availability, Confidentiality, Privacy (optional criteria)");
		d.para(
			"Many university contracts focus on Security. Where Availability, Confidentiality, or Privacy criteria are requested:",
		);
		d.bullet("Availability — reverse-proxy TLS, health endpoint, VPS sizing guidance in pilot pack; SLA terms are commercial.");
		d.bullet("Confidentiality — university-scoped admin data access; research ownership filters; private object storage.");
		d.bullet("Privacy — policy acceptance, retention/deletion requests, privacy settings module; see Data Protection PDF.");

		d.h1("5. Gaps & roadmap (transparency)");
		d.bullet("Independent SOC 2 Type II audit period — not yet commissioned");
		d.bullet("httpOnly cookie session architecture (planned continuous improvement)");
		d.bullet("Formal dependency vulnerability scanning in CI (planned)");
		d.bullet("Encrypted backup-at-rest policy ownership with hosting institution");
		d.bullet("Optional malware scanning on uploads");

		d.h1("6. How universities should use this");
		d.bullet("Attach to security questionnaires as “SOC 2 readiness / control mapping”");
		d.bullet("Do not represent this PDF as a completed SOC 2 attestation");
		d.bullet("Request a formal SOC 2 engagement if the institution’s procurement policy requires an AICPA report");
	},
});

// —— 2. Data Protection & Privacy ——
createInstitutionalDoc({
	filename: out("GARIL-AI-Data-Protection-Privacy-Overview.pdf"),
	title: "Data Protection & Privacy Overview",
	subtitle: "UK GDPR / GDPR-oriented summary for university partners",
	docType: "Privacy & data protection",
	footerLabel: "GARIL AI — Data Protection & Privacy Overview  ·  Institutional use",
	date: DATE,
	version: VERSION,
	disclaimer:
		"This is an operational privacy summary to support institutional DPIAs and procurement. It is not formal legal advice. Partner universities remain controllers for student/staff personal data they introduce into the platform unless a signed DPA states otherwise.",
	build: (d) => {
		d.h1("1. Roles");
		d.para(
			"In a typical university deployment, the university is the data controller for personal data of its staff and students. GARIL AI (operator/host) acts as a data processor (or joint controller only where explicitly contracted). A Data Processing Agreement (DPA) should be executed before live personal data is processed.",
		);

		d.h1("2. Categories of data processed");
		d.table(
			["Category", "Examples", "Purpose"],
			[
				["Identity & account", "Name, email, role, institution, faculty/programme", "Authentication, access control, tenancy"],
				["Academic activity", "Research projects, papers, notes, supervision workflow", "Provide research/learning features"],
				["AI interaction", "Prompts, model outputs, token usage", "AI assistance; governance & quotas"],
				["Admin/governance", "Audit logs, incidents, policies, retention requests", "Accountability & compliance"],
				["Technical", "Session tokens, IP (via proxy logs), file metadata", "Security & operations"],
			],
		);

		d.h1("3. Lawful bases (typical)");
		d.bullet("Public task / legitimate interests — delivering university research & learning services");
		d.bullet("Contract — where users register under institutional terms");
		d.bullet("Consent — where policy acceptance or optional processing requires it");
		d.para(
			"Universities should confirm lawful basis mapping in their DPIA. GARIL AI supports policy acceptance versioning in-product.",
		);

		d.h1("4. Security of processing (Art. 32 alignment)");
		d.bullet("Access control with default-deny APIs and university scoping");
		d.bullet("Passwords hashed (scrypt); reset tokens hashed; short-lived sessions (24h access JWT)");
		d.bullet("TLS in transit (institutional reverse proxy); security headers; CORS allowlist");
		d.bullet("Rate limiting on authentication and AI endpoints");
		d.bullet("HTML/markdown sanitisation to reduce XSS risk");
		d.bullet("Super-admin-only full-database backups");
		d.bullet("Defensive security audit completed with Critical findings remediated (Oct 2026)");

		d.h1("5. International transfers");
		d.para(
			"Depending on hosting and AI provider regions, personal data or prompt content may be processed outside the UK/EEA. Universities should review subprocessors (see Subprocessors PDF) and apply SCCs / UK IDTA as required in the DPA.",
		);

		d.h1("6. Retention & rights");
		d.bullet("In-product retention policies and deletion-request workflows for governance teams");
		d.bullet("Users/admins can manage research assets they own; institutional admins act within university scope");
		d.bullet("Subject access / erasure requests should be routed via the university DPO to the operator under the DPA");

		d.h1("7. DPIA support");
		d.para(
			"This pack (Security Assurance, SOC 2 Readiness, Subprocessors, Incident Response) is intended as input to a university Data Protection Impact Assessment for AI-assisted research tools. Contact the partnership team for a completed questionnaire workbook if required.",
		);
	},
});

// —— 3. Information Security Policy ——
createInstitutionalDoc({
	filename: out("GARIL-AI-Information-Security-Policy.pdf"),
	title: "Information Security Policy Summary",
	subtitle: "Organisational & product security principles",
	docType: "Policy summary",
	footerLabel: "GARIL AI — Information Security Policy Summary",
	date: DATE,
	version: VERSION,
	disclaimer:
		"Summary of security principles for partner institutions. Detailed runbooks remain internal. Production configuration obligations for hosts are listed in Section 5.",
	build: (d) => {
		d.h1("1. Policy objective");
		d.para(
			"Protect the confidentiality, integrity, and availability of university and user data processed by GARIL AI, and ensure responsible use of AI features within institutional governance.",
		);

		d.h1("2. Scope");
		d.bullet("GARIL AI web application, API, databases, and optional object storage");
		d.bullet("Administrative and portal users (students, supervisors, university admins, platform admins)");
		d.bullet("Subprocessors used for hosting, email, and AI inference");

		d.h1("3. Principles");
		d.bullet("Least privilege — role and university scoping for administrative access");
		d.bullet("Defence in depth — authN/authZ, rate limits, headers, sanitisation, audit");
		d.bullet("Secure by default — default-deny APIs; opt-in bootstrap admin; no weak hardcoded secrets");
		d.bullet("Privacy by design — ownership filters, retention/deletion tooling, non-enumerating password reset");
		d.bullet("Accountability — audit logs for sensitive admin actions; AI use telemetry where enabled");

		d.h1("4. Access management");
		d.bullet("Unique user accounts; strong passwords (minimum 10 characters with letter and number)");
		d.bullet("Session tokens expire (24 hours); inactive accounts cannot use the API");
		d.bullet("Platform backups and break-glass data exports limited to super administrators");
		d.bullet("University administrators manage only their institution’s tenancy");

		d.h1("5. Production obligations (operator / host)");
		d.bullet("Unique AUTH_SECRET; CORS_ORIGIN allowlist; TLS at the edge");
		d.bullet("Disable DEFAULT_ADMIN_ENABLED after first bootstrap; rotate bootstrap credentials");
		d.bullet("Keep application nodes private behind a reverse proxy");
		d.bullet("Keep object-storage buckets private; apply institutional backup encryption/retention");
		d.bullet("Monitor auth failures, uptime, and AI spend");

		d.h1("6. Acceptable use (summary)");
		d.para(
			"Users must not attempt to bypass access controls, exfiltrate others’ data, or use the AI features for unlawful content. Full AI Acceptable Use is defined in the AI Governance PDF.",
		);

		d.h1("7. Review");
		d.para(
			"This policy summary is reviewed after material product security changes and at least annually. Last security audit remediation: October 2026.",
		);
	},
});

// —— 4. AI Governance ——
createInstitutionalDoc({
	filename: out("GARIL-AI-AI-Governance-Acceptable-Use.pdf"),
	title: "AI Governance & Acceptable Use",
	subtitle: "Responsible AI for research, instruction and learning",
	docType: "AI governance",
	footerLabel: "GARIL AI — AI Governance & Acceptable Use",
	date: DATE,
	version: VERSION,
	disclaimer:
		"Guidance for institutional adoption of AI-assisted research tools. Universities should overlay local academic integrity and research ethics policies.",
	build: (d) => {
		d.h1("1. Purpose");
		d.para(
			"GARIL AI provides governed AI assistance for research and learning. This document sets expectations for universities, supervisors, and students so AI use remains transparent, accountable, and aligned with academic integrity.",
		);

		d.h1("2. Platform governance features");
		d.bullet("University feature flags — enable/disable research assistant, advanced research, assessment, supervision modules");
		d.bullet("Student token quotas — institutional control of AI consumption");
		d.bullet("Policy evaluation hooks and AI contribution / provenance records in the governance console");
		d.bullet("Audit and integrity-oriented telemetry for AI surfaces where enabled");
		d.bullet("Authentication required for AI generation and literature search APIs");

		d.h1("3. Acceptable use");
		d.bullet("Use AI outputs as assistance — users remain responsible for accuracy, citation, and academic honesty");
		d.bullet("Do not submit highly sensitive personal data or special-category data into prompts unless institutional policy and DPA allow it");
		d.bullet("Do not use the platform to generate malware, harassment, or content prohibited by university policy or law");
		d.bullet("Do not attempt to jailbreak, extract system prompts, or bypass quotas/feature gates");
		d.bullet("Respect copyright and licensing when uploading materials for AI context");

		d.h1("4. Human oversight");
		d.para(
			"Supervisors and faculty should treat model output as untrusted draft material. Critical claims, statistics, and citations must be verified against primary sources. GARIL AI includes literature retrieval aids but does not replace academic review.",
		);

		d.h1("5. Transparency to students");
		d.bullet("Institutions should disclose that AI tools are in use in modules/assessments as required by local policy");
		d.bullet("Contribution statements / provenance features support disclosure workflows where enabled");

		d.h1("6. Model providers");
		d.para(
			"Inference is provided via configured third-party model APIs (see Subprocessors). Prompt and context data are processed by those providers under their terms and the university’s DPA schedule.",
		);
	},
});

// —— 5. Incident Response ——
createInstitutionalDoc({
	filename: out("GARIL-AI-Incident-Response-Overview.pdf"),
	title: "Incident Response Overview",
	subtitle: "Detection, escalation, and institutional notification",
	docType: "Operational resilience",
	footerLabel: "GARIL AI — Incident Response Overview",
	date: DATE,
	version: VERSION,
	disclaimer:
		"High-level IR overview for partners. Detailed internal playbooks are maintained by the operating team. Regulatory notification timelines depend on the university’s jurisdiction and DPA.",
	build: (d) => {
		d.h1("1. Objectives");
		d.bullet("Detect and contain security or availability incidents quickly");
		d.bullet("Protect university and user data");
		d.bullet("Communicate clearly with institutional contacts");
		d.bullet("Learn and harden after each incident");

		d.h1("2. Incident categories");
		d.table(
			["Severity", "Examples", "Target initial response"],
			[
				["Critical", "Confirmed breach of personal data; auth bypass; ransomware", "Within 1 hour of detection"],
				["High", "Privilege escalation; widespread service outage; AI cost abuse spike", "Within 4 hours"],
				["Medium", "Suspicious admin activity; partial degradation", "Within 1 business day"],
				["Low", "Minor anomalies; failed attack attempts with no impact", "Next maintenance window"],
			],
		);

		d.h1("3. Response phases");
		d.bullet("Identify — monitoring, user reports, audit anomalies, provider alerts");
		d.bullet("Contain — revoke sessions/credentials, disable abusive accounts, isolate services");
		d.bullet("Eradicate & recover — patch, rotate secrets, restore from clean backups if needed");
		d.bullet("Notify — university security / DPO contacts per DPA; regulators if legally required");
		d.bullet("Review — post-incident report; control improvements");

		d.h1("4. Platform capabilities that support IR");
		d.bullet("Governance console incidents & alerts modules");
		d.bullet("Administrative audit trail for sensitive actions");
		d.bullet("Ability to suspend users and reset credentials");
		d.bullet("Super-admin backups for recovery planning");
		d.bullet("Rate limits reducing credential-stuffing and AI-abuse blast radius");

		d.h1("5. University contacts");
		d.para(
			"Before go-live, each university should provide: primary ICT/security contact, DPO/privacy contact, and out-of-hours escalation path. Notification channels are defined in the DPA or pilot agreement.",
		);
	},
});

// —— 6. Subprocessors ——
createInstitutionalDoc({
	filename: out("GARIL-AI-Subprocessors-Data-Flows.pdf"),
	title: "Subprocessors & Data Flows",
	subtitle: "Third parties that may process institutional data",
	docType: "Privacy schedule support",
	footerLabel: "GARIL AI — Subprocessors & Data Flows",
	date: DATE,
	version: VERSION,
	disclaimer:
		"Illustrative schedule based on the standard GARIL AI architecture. Exact vendors and regions depend on the deployment (self-hosted university VPS vs managed hosting). Update this schedule in the signed DPA.",
	build: (d) => {
		d.h1("1. Data flow (standard deployment)");
		d.bullet("User browser → TLS reverse proxy / CDN → GARIL AI web & API");
		d.bullet("API → MongoDB (accounts, research, governance data)");
		d.bullet("API → optional S3-compatible object storage (uploads/assets)");
		d.bullet("API → LLM provider (prompts/context for AI features)");
		d.bullet("API → literature/search APIs as configured (e.g. OpenAlex, PubMed, Tavily)");
		d.bullet("API → transactional email provider (password reset / notices)");

		d.h1("2. Typical subprocessors");
		d.table(
			["Function", "Typical provider", "Data involved"],
			[
				["Hosting / VPS", "Institution or designated host (e.g. Coolify/VPS)", "Full application stack & DB"],
				["AI inference", "OpenRouter (routes to model vendors)", "Prompts, context, outputs, usage"],
				["Email", "Resend (or configured SMTP/ESP)", "Name, email, reset links"],
				["Object storage", "MinIO/S3-compatible (optional)", "Uploaded files & metadata"],
				["Literature APIs", "OpenAlex, NCBI/PubMed, others as enabled", "Search queries; generally non-account PII"],
			],
		);

		d.h1("3. University control");
		d.bullet("Feature flags can disable AI or modules per university");
		d.bullet("Institutions should instruct users not to paste unnecessary special-category data into prompts");
		d.bullet("Self-hosted deployments keep primary data on university-controlled infrastructure");

		d.h1("4. Change management");
		d.para(
			"Material subprocessor changes will be communicated to institutional contacts as required by the DPA (typically advance notice for non-emergency changes).",
		);
	},
});

// —— 7. University Security FAQ ——
createInstitutionalDoc({
	filename: out("GARIL-AI-University-Security-FAQ.pdf"),
	title: "University Security FAQ",
	subtitle: "Short answers for ICT, procurement & DPIA questionnaires",
	docType: "Questionnaire aid",
	footerLabel: "GARIL AI — University Security FAQ",
	date: DATE,
	version: VERSION,
	disclaimer:
		"Concise answers for common university security questionnaires. Pair with the Security Assurance and SOC 2 Readiness PDFs for detail.",
	build: (d) => {
		const qa = (q, a) => {
			d.h2(q);
			d.para(a);
		};

		d.h1("Frequently asked questions");
		qa(
			"Has GARIL AI undergone a security audit?",
			"Yes. A defensive security audit was completed (September 2026) with remediation verified in October 2026. Critical findings were closed. See the Institutional Security Assurance Summary.",
		);
		qa(
			"Are you SOC 2 certified?",
			"Not yet. We provide a SOC 2 readiness and control mapping. A formal SOC 2 Type II attestation requires an independent CPA engagement, which can be commissioned when a partner requires it.",
		);
		qa(
			"Is data isolated per university?",
			"Yes for administrative scope: university admins are constrained to their institution. Research and portal assets are ownership/tenant filtered. Platform-wide backups are super-admin only.",
		);
		qa(
			"How is authentication handled?",
			"Email/password with scrypt hashing, JWT access tokens (24h), hashed password-reset tokens, active-status enforcement, rate-limited auth endpoints, and default-deny API access.",
		);
		qa(
			"Is encryption used?",
			"TLS is required at the reverse proxy for production. Security headers including HSTS are enabled in production. Database/object-storage encryption at rest should be enabled on the hosting infrastructure per institutional standards.",
		);
		qa(
			"Where is data stored?",
			"On the deployment’s MongoDB and optional S3-compatible storage (often a university or partner VPS). AI prompts are processed by the configured model provider — see Subprocessors PDF.",
		);
		qa(
			"Can we complete a DPIA?",
			"Yes. Use the Data Protection Overview, Subprocessors, Incident Response, and AI Governance documents as DPIA inputs. We can support workshops with university DPOs.",
		);
		qa(
			"What happens in a breach?",
			"Follow the Incident Response Overview: contain, investigate, notify institutional security/DPO contacts under the DPA, and remediate. Regulatory notification is coordinated with the university controller.",
		);
		qa(
			"Do you support right to erasure / retention?",
			"Governance tooling includes retention policies and deletion-request workflows. Operational erasure is executed under the university’s instructions and DPA timelines.",
		);
		qa(
			"Can AI be disabled for our university?",
			"Yes. University feature flags control research assistant, advanced research, supervision, and assessment modules, alongside student token quotas.",
		);

		d.h1("Document pack checklist");
		d.bullet("GARIL-AI-University-Security-Assurance.pdf");
		d.bullet("GARIL-AI-SOC2-Readiness-Mapping.pdf");
		d.bullet("GARIL-AI-Data-Protection-Privacy-Overview.pdf");
		d.bullet("GARIL-AI-Information-Security-Policy.pdf");
		d.bullet("GARIL-AI-AI-Governance-Acceptable-Use.pdf");
		d.bullet("GARIL-AI-Incident-Response-Overview.pdf");
		d.bullet("GARIL-AI-Subprocessors-Data-Flows.pdf");
		d.bullet("GARIL-AI-University-Security-FAQ.pdf (this document)");
		d.bullet("Internal only: GARIL-AI-Security-Audit-Report.pdf");
	},
});

// —— Index README ——
const readme = `# GARIL AI — Institutional Security & Compliance Pack

**Version:** ${VERSION}  
**Date:** ${DATE}  
**Audience:** Partner universities (ICT, procurement, DPO, academic leadership)

## How to present to a university

Give partners the **assurance pack** below. Keep the detailed internal audit report internal unless under NDA and specifically requested by a security team.

| Share with university | File |
|----------------------|------|
| Security assurance summary | \`GARIL-AI-University-Security-Assurance.pdf\` |
| SOC 2 readiness (not a certificate) | \`GARIL-AI-SOC2-Readiness-Mapping.pdf\` |
| Privacy / DPIA input | \`GARIL-AI-Data-Protection-Privacy-Overview.pdf\` |
| Information security policy | \`GARIL-AI-Information-Security-Policy.pdf\` |
| AI governance & AUP | \`GARIL-AI-AI-Governance-Acceptable-Use.pdf\` |
| Incident response | \`GARIL-AI-Incident-Response-Overview.pdf\` |
| Subprocessors & data flows | \`GARIL-AI-Subprocessors-Data-Flows.pdf\` |
| Security FAQ | \`GARIL-AI-University-Security-FAQ.pdf\` |

| Internal / restricted | File |
|----------------------|------|
| Technical defensive audit (findings) | \`GARIL-AI-Security-Audit-Report.pdf\` |

## Important wording

- **Do say:** “Completed defensive security audit; Critical findings remediated; SOC 2 control readiness mapping available.”
- **Do not say:** “We are SOC 2 certified / ISO 27001 certified” unless an independent auditor has issued that attestation.

## Regenerate

\`\`\`bash
# University assurance summary
node docs/security/generate-university-security-assurance-pdf.mjs

# Full compliance pack (SOC2 readiness, privacy, policies, IR, FAQ, …)
node docs/security/generate-institutional-compliance-pack.mjs

# Internal technical audit PDF
node docs/security/generate-security-audit-pdf.mjs
\`\`\`

Or generate everything:

\`\`\`bash
node docs/security/generate-all-security-docs.mjs
\`\`\`
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "README.md"), readme);
console.log(`Wrote ${join(OUT_DIR, "README.md")}`);
