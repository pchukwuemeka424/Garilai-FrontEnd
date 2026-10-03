/**
 * University-facing Security Assurance Summary (no exploit content, no internal IDs).
 * Run: node docs/security/generate-university-security-assurance-pdf.mjs
 */
import { jsPDF } from "jspdf";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "GARIL-AI-University-Security-Assurance.pdf");

const BRAND = [18, 32, 48];
const ACCENT = [34, 120, 70];
const MUTED = [90, 90, 90];
const BODY = [35, 40, 48];

function wrap(doc, text, maxWidth) {
	return doc.splitTextToSize(text, maxWidth);
}

function newDoc() {
	const doc = new jsPDF({ unit: "pt", format: "a4" });
	const margin = 52;
	const pageW = doc.internal.pageSize.getWidth();
	const pageH = doc.internal.pageSize.getHeight();
	const maxW = pageW - margin * 2;
	let y = margin;
	let page = 1;

	const ensure = (need) => {
		if (y + need > pageH - margin - 28) {
			footer();
			doc.addPage();
			page += 1;
			y = margin;
		}
	};

	const footer = () => {
		doc.setDrawColor(210);
		doc.setLineWidth(0.5);
		doc.line(margin, pageH - 40, pageW - margin, pageH - 40);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(8);
		doc.setTextColor(130);
		doc.text(
			"GARIL AI — Institutional Security Assurance Summary  ·  Confidential to partner institutions",
			margin,
			pageH - 26,
		);
		doc.text(String(page), pageW - margin, pageH - 26, { align: "right" });
	};

	const h1 = (t) => {
		ensure(34);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(14);
		doc.setTextColor(...BRAND);
		doc.text(t, margin, y);
		y += 10;
		doc.setDrawColor(...ACCENT);
		doc.setLineWidth(2);
		doc.line(margin, y, margin + 56, y);
		y += 16;
	};

	const para = (t, opts = {}) => {
		doc.setFont("helvetica", opts.bold ? "bold" : "normal");
		doc.setFontSize(opts.size || 10);
		doc.setTextColor(...(opts.color || BODY));
		const lines = wrap(doc, t, opts.width || maxW);
		for (const line of lines) {
			ensure(14);
			doc.text(line, opts.x ?? margin, y);
			y += opts.leading || 13;
		}
		y += opts.after ?? 8;
	};

	const bullet = (t) => {
		doc.setFont("helvetica", "normal");
		doc.setFontSize(10);
		doc.setTextColor(...BODY);
		const lines = wrap(doc, t, maxW - 16);
		for (let i = 0; i < lines.length; i++) {
			ensure(14);
			if (i === 0) {
				doc.setFillColor(...ACCENT);
				doc.circle(margin + 4, y - 3, 2.2, "F");
			}
			doc.text(lines[i], margin + 14, y);
			y += 13;
		}
		y += 4;
	};

	const controlCard = (title, items) => {
		ensure(28 + items.length * 16);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(11);
		doc.setTextColor(...BRAND);
		doc.text(title, margin, y);
		y += 14;
		for (const item of items) bullet(item);
		y += 6;
	};

	// —— Cover ——
	doc.setFillColor(...BRAND);
	doc.rect(0, 0, pageW, pageH, "F");

	doc.setFillColor(...ACCENT);
	doc.rect(0, 0, 8, pageH, "F");

	doc.setTextColor(255);
	doc.setFont("helvetica", "bold");
	doc.setFontSize(11);
	doc.text("INSTITUTIONAL PARTNER DOCUMENT", margin + 12, 88);

	doc.setFontSize(28);
	doc.text("GARIL AI", margin + 12, 140);
	doc.setFontSize(18);
	doc.setFont("helvetica", "normal");
	doc.text("Security Assurance Summary", margin + 12, 168);

	doc.setFontSize(11);
	doc.setTextColor(200);
	doc.text(
		"Governed AI for Research, Instruction and Learning",
		margin + 12,
		196,
	);

	y = 240;
	doc.setDrawColor(80, 100, 120);
	doc.setLineWidth(0.8);
	doc.line(margin + 12, y, pageW - margin, y);
	y = 268;

	doc.setTextColor(230);
	doc.setFontSize(10.5);
	const meta = [
		["Document type", "Security assurance summary for universities"],
		["Assessment nature", "Defensive security audit & hardening review"],
		["Assessment period", "September – October 2026"],
		["Scope", "Web application, API, authentication, data isolation, AI surfaces"],
		["Prepared for", "Partner universities and institutional stakeholders"],
		["Classification", "Confidential — for authorised institutional use"],
	];
	for (const [k, v] of meta) {
		doc.setFont("helvetica", "bold");
		doc.setTextColor(170);
		doc.text(k, margin + 12, y);
		doc.setFont("helvetica", "normal");
		doc.setTextColor(235);
		doc.text(v, margin + 150, y);
		y += 22;
	}

	y = pageH - 120;
	doc.setFillColor(255, 255, 255);
	doc.roundedRect(margin + 12, y - 28, maxW - 12, 56, 4, 4, "F");
	doc.setFont("helvetica", "bold");
	doc.setFontSize(11);
	doc.setTextColor(...ACCENT);
	doc.text("Assurance statement", margin + 28, y - 6);
	doc.setFont("helvetica", "normal");
	doc.setFontSize(9.5);
	doc.setTextColor(...BODY);
	const assure = wrap(
		doc,
		"GARIL AI has undergone a defensive security audit. Critical and high-priority findings were remediated. The platform is configured with institutional-grade access control, tenant isolation, and hardened API surfaces suitable for university deployment.",
		maxW - 44,
	);
	let ay = y + 10;
	for (const line of assure) {
		doc.text(line, margin + 28, ay);
		ay += 12;
	}

	footer();
	doc.addPage();
	page = 2;
	y = margin;

	// —— Body ——
	h1("1. Purpose of this document");
	para(
		"This summary is prepared for universities evaluating or operating GARIL AI. It confirms that the platform has been subject to a structured defensive security audit and subsequent hardening, and that core controls expected of an institutional research and learning system are in place.",
	);
	para(
		"It is written for academic leadership, ICT/security officers, and data-protection stakeholders. It does not disclose internal vulnerability identifiers, attack procedures, or exploitation details.",
	);

	h1("2. Assurance statement");
	para(
		"GARIL AI completed a defensive security audit covering authentication and authorisation, multi-tenant data isolation, API exposure, session handling, AI/cost controls, upload and storage handling, and privacy-sensitive administrative functions.",
	);
	para(
		"All Critical findings identified in the audit have been remediated. High-priority hardening items (including open API lockdown, rate limiting, backup privilege restriction, WebSocket authentication, and default admin bootstrap controls) have been implemented. The platform is assessed as suitable for controlled institutional deployment when operated with the production configuration checklist in Section 6.",
	);

	// Status banner
	ensure(70);
	doc.setFillColor(236, 247, 240);
	doc.roundedRect(margin, y - 8, maxW, 58, 4, 4, "F");
	doc.setFont("helvetica", "bold");
	doc.setFontSize(11);
	doc.setTextColor(...ACCENT);
	doc.text("Audit outcome (October 2026)", margin + 14, y + 8);
	doc.setFont("helvetica", "normal");
	doc.setFontSize(10);
	doc.setTextColor(...BODY);
	para(
		"Critical issues: remediated  ·  High-priority hardening: implemented  ·  Residual work: continuous improvement (session-cookie migration, advanced upload scanning, edge CSP).",
		{ x: margin + 14, width: maxW - 28, after: 4, size: 9.5 },
	);
	y += 8;

	h1("3. What was assessed");
	bullet("Identity, authentication, and password lifecycle (including reset flows)");
	bullet("Role-based and university-scoped authorisation for admin and portal surfaces");
	bullet("Default-deny protection of APIs (public allowlist only for health, registration, login, and public legal pages)");
	bullet("Research, chat, and AI endpoints — authentication, feature gates, and usage quotas");
	bullet("Session and WebSocket security (no tokens in URLs; authenticated channels)");
	bullet("Cross-tenant isolation expectations for university-scoped administrators");
	bullet("Administrative backups and privileged data export access");
	bullet("CORS, security headers, rate limiting, and secrets handling");
	bullet("Rendering of user/model content (XSS hardening via sanitisation)");

	h1("4. Security controls in place");
	controlCard("Access control & tenancy", [
		"Authenticated sessions required for protected APIs and application features",
		"University-scoped administration — campus admins cannot manage other institutions",
		"Platform-wide database backups restricted to super administrators",
		"Inactive or suspended accounts are rejected on subsequent requests",
	]);
	controlCard("Data protection & privacy", [
		"Passwords stored using modern salted hashing (scrypt); reset tokens hashed at rest",
		"Research assets and portal projects filtered by ownership / tenant",
		"Password-reset responses designed to avoid account enumeration",
		"Public health endpoint discloses no infrastructure metadata",
	]);
	controlCard("Application & API hardening", [
		"Default-deny API policy with an explicit public allowlist",
		"Production CORS restricted to configured institutional origins",
		"Rate limiting on authentication and AI endpoints to reduce abuse and cost risk",
		"Security headers via application middleware (including HSTS in production HTTPS)",
		"HTML and markdown output sanitised before browser rendering",
	]);
	controlCard("AI governance & cost control", [
		"AI generation and literature search require authenticated users",
		"University feature flags and student token quotas enforced where applicable",
		"Per-user chat session isolation to prevent cross-user interference",
	]);

	h1("5. Governance alignment for universities");
	para(
		"GARIL AI is designed for institutional research and learning contexts. Security controls support common university expectations around access governance, departmental/university scoping, auditability, and responsible AI use:",
	);
	bullet("Role-based console access for governance, faculty, compliance, and audit personas");
	bullet("Audit logging for sensitive administrative actions");
	bullet("Registration gated to onboarded universities");
	bullet("Policy acceptance and legal document management for institutional terms");
	bullet("Retention and deletion request workflows for data-governance processes");

	h1("6. Production configuration expected of the institution");
	para(
		"Security outcomes depend on correct deployment. Partner universities (or their hosting provider) should ensure:",
	);
	bullet("Strong unique AUTH_SECRET and restricted CORS_ORIGIN allowlist in production");
	bullet("TLS termination at the institutional reverse proxy / CDN");
	bullet("Bootstrap administrator credentials rotated and bootstrap mode disabled after first setup");
	bullet("Application servers not exposed directly to the public internet (proxy-only)");
	bullet("Object storage buckets kept private; institutional backup encryption and retention as per local policy");
	bullet("Operational monitoring of authentication failures and AI spend");

	h1("7. Continuous assurance");
	para(
		"Security is an ongoing programme. Following the audit remediation, GARIL AI maintains a continuous-improvement backlog including deeper session-cookie architecture, expanded upload validation, dependency scanning in CI, and periodic re-assessment. A third-party penetration test can be commissioned under a formal rules-of-engagement once the institution requires it.",
	);
	para(
		"This document affirms that the platform has undergone defensive security audit and hardening suitable for university partnership. It is not a formal certification (e.g. ISO 27001 or SOC 2), nor a guarantee against all future threats.",
	);

	h1("8. Contact & document control");
	para("Document title: GARIL AI — Institutional Security Assurance Summary");
	para("Version: 1.0  ·  Date: 3 October 2026");
	para(
		"Related internal artefact (technical detail, not for general distribution): GARIL-AI-Security-Audit-Report.pdf",
	);
	para(
		"For institutional security questionnaires, DPIA inputs, or a walkthrough with university ICT teams, contact the GARIL AI deployment / partnership team.",
	);

	// Closing box
	ensure(90);
	y += 8;
	doc.setFillColor(...BRAND);
	doc.roundedRect(margin, y, maxW, 72, 4, 4, "F");
	doc.setFont("helvetica", "bold");
	doc.setFontSize(12);
	doc.setTextColor(255);
	doc.text("Summary for institutional stakeholders", margin + 16, y + 24);
	doc.setFont("helvetica", "normal");
	doc.setFontSize(10);
	doc.setTextColor(220);
	const close = wrap(
		doc,
		"GARIL AI has been security-audited and hardened. Critical risks were closed; institutional access control, tenant isolation, and API protections are active. The platform is ready for university deployment under the production controls above.",
		maxW - 32,
	);
	let cy = y + 42;
	for (const line of close) {
		doc.text(line, margin + 16, cy);
		cy += 12;
	}

	footer();
	mkdirSync(__dirname, { recursive: true });
	doc.save(OUT);
	console.log(`Wrote ${OUT}`);
}

newDoc();
