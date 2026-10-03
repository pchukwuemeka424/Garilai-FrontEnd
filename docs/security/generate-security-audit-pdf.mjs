/**
 * Generates GARIL AI Defensive Security Audit PDF (no exploit content).
 * Run: node docs/security/generate-security-audit-pdf.mjs
 */
import { jsPDF } from "jspdf";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "GARIL-AI-Security-Audit-Report.pdf");

const SEVERITY_COLORS = {
	Critical: [180, 35, 35],
	High: [200, 100, 20],
	Medium: [180, 140, 20],
	Low: [60, 110, 160],
	Info: [90, 90, 90],
};

const STATUS_COLORS = {
	Fixed: [34, 120, 70],
	Partial: [160, 120, 30],
	Open: [160, 50, 50],
};

/** @typedef {{ id: string; severity: string; title: string; location: string; description: string; remediation: string; status: "Fixed" | "Partial" | "Open"; fixNotes?: string }} Finding */

/** @type {Finding[]} */
const findings = [
	{
		id: "A1",
		severity: "Critical",
		title: "Unauthenticated user CRUD API",
		location: "backend/src/server.ts (legacy /api/users*)",
		description:
			"GET/POST /api/users and PATCH/DELETE /api/users/:id had no Authorization checks. createUser accepted a role from the request body, enabling account lifecycle abuse and privilege escalation outside the protected admin user APIs.",
		remediation:
			"Remove these legacy routes, or gate every method with requireAdminScope / requireFeatureAccess. Never allow role assignment without the same rules as admin user creation.",
		status: "Fixed",
		fixNotes:
			"Legacy /api/users* routes return HTTP 410. User management is only via scoped /api/admin/users*.",
	},
	{
		id: "A2",
		severity: "Critical",
		title: "Default admin bootstrap can reset a weak known password",
		location: "backend/src/constants/default-admin.ts; bootstrap-admin.service.ts",
		description:
			"Unless DEFAULT_ADMIN_ENABLED=false, startup ensured an admin existed and could overwrite the password hash to match configured/default credentials.",
		remediation:
			"Opt-in bootstrap only; never reset passwords on mismatch; env-only password (≥12 chars); disable after first run.",
		status: "Fixed",
		fixNotes:
			"Create-only when account missing; never overwrites existing password. Password required from DEFAULT_ADMIN_PASSWORD. Production warns to disable after bootstrap.",
	},
	{
		id: "B1",
		severity: "Critical",
		title: "Unauthenticated dashboard, sessions, and outputs",
		location: "backend/src/server.ts (dashboard/sessions/outputs/status/chat)",
		description:
			"Dashboard stats/sessions, session messages, outputs, status, session reset, and chat abort lacked authentication.",
		remediation:
			"Require authentication; scope by userId; restrict cross-user dashboards to admins.",
		status: "Fixed",
		fixNotes:
			"Default-deny auth middleware; dashboard requires admin scope; session messages ownership-checked; chat/status/reset/abort require auth.",
	},
	{
		id: "J1",
		severity: "Critical",
		title: "Unauthenticated user/session listing exposes PII",
		location: "/api/users, /api/dashboard/sessions, session messages",
		description:
			"Names, emails, institutions, roles, and research session content may have been readable without login — severe privacy/GDPR risk if internet-exposed.",
		remediation: "Immediate auth lock; review access logs if routes were publicly reachable.",
		status: "Fixed",
		fixNotes:
			"Routes locked or removed. Operators should still review historical access logs if the API was internet-exposed before the fix.",
	},
	{
		id: "A3",
		severity: "High",
		title: "JWT stored in localStorage",
		location: "lib/auth.ts; hooks/useAuth.tsx",
		description:
			"Bearer JWT in localStorage (feynman_auth_token). Any XSS can exfiltrate the session. No httpOnly / Secure / SameSite cookie session.",
		remediation:
			"Prefer httpOnly Secure SameSite cookies (or BFF); short-lived access tokens with refresh rotation; clear sessions on logout.",
		status: "Partial",
		fixNotes:
			"Access token TTL reduced to 24 hours; XSS mitigated via HTML/markdown sanitization. Full httpOnly cookie/BFF session remains open (P2).",
	},
	{
		id: "A4",
		severity: "High",
		title: "WebSocket token in URL query string",
		location: "lib/api.ts; backend/src/server.ts (WS); hooks/useGarilSocket.ts",
		description:
			"Auth tokens in query strings appear in access logs, proxies, and history. WS also accepted connections without a token.",
		remediation:
			"Authenticate via first-message auth; reject unauthenticated sockets; never put JWTs in URLs.",
		status: "Fixed",
		fixNotes:
			"Client no longer appends ?token=. Server requires { type: \"auth\", token } within 10s; unauthenticated sockets are closed.",
	},
	{
		id: "A5",
		severity: "High",
		title: "Single global ChatService shared across clients",
		location: "backend/src/lib/chat-registry.ts; chat.service.ts",
		description:
			"One in-memory chat session served the process. Concurrent users could interfere with each other’s session, abort, and status streams.",
		remediation: "Per-user chat sessions; require auth before subscribe/prompt/reset/abort.",
		status: "Fixed",
		fixNotes: "ChatSessionRegistry isolates ChatService instances per authenticated userId.",
	},
	{
		id: "B2",
		severity: "High",
		title: "AI generation endpoints callable without auth",
		location: "/api/research/outline, /ideas/generate, /api/papers/search",
		description:
			"When no Bearer token was present, outline/ideas still ran without feature gates or token deduction — anonymous LLM/API cost abuse.",
		remediation:
			"Require auth on all LLM/literature routes; enforce feature flags and quotas; add rate limits.",
		status: "Fixed",
		fixNotes:
			"Auth required via default-deny + requireAuthUser; feature flags and student token deduction enforced; AI routes rate-limited.",
	},
	{
		id: "B3",
		severity: "High",
		title: "Full-database backup for any console admin",
		location: "admin-backup.service.ts; server.ts backup routes",
		description:
			"Backup used requireAdmin (any console admin), dumped all collections with no tenant filter — university admins could obtain platform-wide PII.",
		remediation: "Restrict to requireSuperAdmin; tenant-scoped exports if needed later.",
		status: "Fixed",
		fixNotes: "All /api/admin/backup* routes now require requireSuperAdmin.",
	},
	{
		id: "C1",
		severity: "High",
		title: "Hardcoded default admin credentials in source",
		location: "backend/src/constants/default-admin.ts",
		description:
			"Default email/password existed in repository and docs examples — a likely bootstrap credential for anyone with repo access.",
		remediation: "Delete password constants; env-only bootstrap; fail closed if unset.",
		status: "Fixed",
		fixNotes:
			"Password constant removed. Docs/examples no longer show weak sample passwords.",
	},
	{
		id: "F1",
		severity: "High",
		title: "Default CORS reflects any origin",
		location: "backend/src/server.ts",
		description:
			"When CORS_ORIGIN was unset, origin: true allowed any origin.",
		remediation: "Require explicit CORS_ORIGIN allowlist in production; fail startup if unset.",
		status: "Fixed",
		fixNotes: "Production startup throws if CORS_ORIGIN is missing.",
	},
	{
		id: "G1",
		severity: "High",
		title: "No API rate limiting",
		location: "backend (@fastify/rate-limit)",
		description:
			"Login, password reset, registration, and LLM endpoints lacked throttling.",
		remediation: "Add @fastify/rate-limit (global + stricter on /api/auth/* and AI routes).",
		status: "Fixed",
		fixNotes:
			"Global 300/min; auth login/register 10/min; forgot-password 5/min; AI routes 20–30/min.",
	},
	{
		id: "I1",
		severity: "High",
		title: "Missing auth on numerous production API routes",
		location: "backend/src/lib/public-api.ts; server.ts onRequest hook",
		description:
			"Parallel open APIs beside hardened admin/portal APIs — leftover attack surface.",
		remediation:
			"Default-deny middleware: all /api/* except an allowlist require auth.",
		status: "Fixed",
		fixNotes:
			"Public allowlist: health, auth register/login/forgot/reset, universities catalogue, public legal. Everything else requires an active session.",
	},
	{
		id: "A6",
		severity: "Medium",
		title: "Long-lived JWT (7 days) without revocation",
		location: "backend/src/lib/auth-token.ts; require-auth.ts",
		description:
			"Tokens remained valid until expiry. Password change / suspend / role change may not invalidate existing JWTs.",
		remediation:
			"Shorter access TTL; refresh tokens; tokenVersion or denylist; enforce status === active on every request.",
		status: "Partial",
		fixNotes:
			"TTL reduced to 24h; active status enforced on every API request and admin load. Refresh tokens / revocation list still open (P2).",
	},
	{
		id: "A7",
		severity: "Medium",
		title: "Password-reset email enumeration",
		location: "auth.service.ts; /api/auth/forgot-password",
		description:
			"Missing accounts returned a distinct error revealing whether an address was registered.",
		remediation: "Always return the same 200 message; rate-limit by IP.",
		status: "Fixed",
		fixNotes: "Same success message for all emails; forgot-password rate-limited to 5/min.",
	},
	{
		id: "C2",
		severity: "Medium",
		title: "Fallback AUTH_SECRET outside production",
		location: "backend/src/config/env.ts",
		description:
			"Fixed development secret used when unset outside production — risk if staging ran without NODE_ENV=production.",
		remediation:
			"Fail if AUTH_SECRET missing unless explicitly development; refuse weak/default secrets in production.",
		status: "Fixed",
		fixNotes:
			"Fallback only when NODE_ENV=development. Production rejects missing or default AUTH_SECRET.",
	},
	{
		id: "D1",
		severity: "Medium",
		title: "HTML/markdown rendered without sanitization",
		location: "portal editors; ResearchDocEditor; ReactMarkdown usages",
		description:
			"User- or model-generated HTML injected into the DOM enables XSS, which threatens JWT theft via localStorage.",
		remediation: "Sanitize with DOMPurify / rehype-sanitize; CSP script-src allowlist.",
		status: "Partial",
		fixNotes:
			"isomorphic-dompurify on dangerouslySetInnerHTML paths; rehype-sanitize on ReactMarkdown. App-level CSP still optional at CDN/nginx.",
	},
	{
		id: "E1",
		severity: "Medium",
		title: "Presigned uploads: limited server MIME/malware checks",
		location: "attachment-storage.service.ts; s3.service.ts",
		description:
			"Auth-gated and size-capped (good), but MIME is client-declared; large default max increases abuse risk; no AV scanning observed.",
		remediation:
			"Constrain MIME on complete-upload; shorter presign TTL; per-user quotas; optional AV; keep buckets private.",
		status: "Open",
		fixNotes: "Deferred (P2). Uploads remain auth-gated and size-capped.",
	},
	{
		id: "F2",
		severity: "Medium",
		title: "No application security headers observed",
		location: "Fastify app (@fastify/helmet)",
		description:
			"No CSP, HSTS, frame-ancestors, X-Content-Type-Options, or Referrer-Policy in app or sampled nginx configs.",
		remediation: "Add headers via @fastify/helmet; enable HSTS on HTTPS terminators.",
		status: "Partial",
		fixNotes:
			"Helmet enabled (X-Content-Type-Options, frame options, Referrer-Policy; HSTS in production). CSP left disabled for static UI compatibility — tighten at CDN/nginx if needed.",
	},
	{
		id: "H1",
		severity: "Medium",
		title: "User content flows into AI prompts without hard isolation",
		location: "chat.service.ts; portal-ai prompts",
		description:
			"Custom/system prompt override and document HTML in review pipelines increase prompt-injection risk.",
		remediation:
			"Never let untrusted text set the system role; delimit untrusted input; treat model output as untrusted.",
		status: "Open",
		fixNotes: "Deferred (P2). Policy evaluation remains in place but is not a full isolation boundary.",
	},
	{
		id: "I2",
		severity: "Medium",
		title: "trustProxy: true without documented hop constraints",
		location: "backend/src/server.ts",
		description:
			"Correct behind reverse proxy, but if Node is exposed directly, clients can spoof X-Forwarded-For.",
		remediation: "Expose Node only internally; configure trusted proxy count.",
		status: "Partial",
		fixNotes:
			"Comment documents that Node must be internal-only behind the reverse proxy. Explicit hop-count config still recommended in deploy docs.",
	},
	{
		id: "J2",
		severity: "Medium",
		title: "Platform-wide backups contain full PII",
		location: "admin-backup.service.ts",
		description:
			"JSON backups of all models are high-value data stores; combined with broad admin backup access, tenant isolation may fail.",
		remediation: "Encrypt backups at rest; super-admin only; tenant-scoped exports; retention limits.",
		status: "Partial",
		fixNotes: "Access restricted to super-admin. Encryption at rest and retention policy still open (P3).",
	},
	{
		id: "A8",
		severity: "Low",
		title: "Weak password policy (length only)",
		location: "backend/src/lib/password-policy.ts; auth.service.ts",
		description: "Minimum 8 characters; no complexity, breach-check, or lockout.",
		remediation: "Stronger policy; progressive lockout / CAPTCHA after failures.",
		status: "Partial",
		fixNotes:
			"Minimum 10 characters with letter + number on register/reset/admin set-password. Progressive lockout/CAPTCHA still open.",
	},
	{
		id: "C3",
		severity: "Low",
		title: "Health endpoint discloses S3 metadata",
		location: "/api/health; /api/health/detail",
		description: "May return S3 enabled flag, bucket, endpoint, and error text.",
		remediation: "Public health returns { ok: true } only; detailed diagnostics behind admin auth.",
		status: "Fixed",
		fixNotes: "Public /api/health returns { ok: true }. Detail endpoint is super-admin only.",
	},
	{
		id: "E2",
		severity: "Low",
		title: "Fallback embedding of file bytes in Mongo",
		location: "attachment-storage.service.ts",
		description:
			"On MinIO failure, smaller files fell back into Mongo — increases DB exposure in dumps.",
		remediation: "Fail closed in production when S3 is required.",
		status: "Fixed",
		fixNotes:
			"Production no longer falls back to Mongo embedding when S3 is configured and upload fails.",
	},
	{
		id: "I3",
		severity: "Low",
		title: "Large bodyLimit (25 MB)",
		location: "backend/src/server.ts",
		description: "Increased DoS memory pressure without rate limits.",
		remediation: "Lower global default; keep large bodies only on upload routes.",
		status: "Fixed",
		fixNotes:
			"Global bodyLimit is 2 MB. Document/dataset/portal import routes raise the limit locally (8–25 MB).",
	},
];

const positives = [
	"Password hashing with scrypt + salt + timingSafeEqual",
	"JWT HMAC-SHA256 with AUTH_SECRET required outside local development",
	"Password-reset tokens hashed (SHA-256), 1-hour TTL, cleared after use; non-enumerating responses",
	"Default-deny /api/* middleware with explicit public allowlist",
	"Admin APIs: requireAdminScope / requireSuperAdmin / feature + university scoping + active status",
	"Portal APIs: requirePortalActor + ownership/tenant filters",
	"Per-user ChatSessionRegistry; WebSocket first-message auth (no JWT in URL)",
	"@fastify/rate-limit (global + auth/AI) and @fastify/helmet security headers",
	"HTML/markdown sanitization (DOMPurify / rehype-sanitize)",
	"Research assets generally filtered by userId; path traversal checks on outputs",
	".env files gitignored; LLM/S3/mail secrets documented as backend-only",
	"Governance: audit logs, retention/deletion APIs, registration gated to onboarded universities",
];

const roadmap = [
	[
		"P0",
		"DONE — Auth-protect/remove open /api/users*, dashboard, sessions, outputs, chat; require auth on AI routes; harden admin bootstrap; production CORS_ORIGIN",
	],
	[
		"P1",
		"DONE — Super-admin backups; per-user chat isolation; rate limits; stop JWT in WS query; HTML/markdown sanitization (partial CSP remains)",
	],
	[
		"P2",
		"OPEN — httpOnly cookie sessions + CSRF; token refresh/revocation; stronger upload MIME/AV checks; prompt-injection hard isolation; CSP at CDN",
	],
	[
		"P3",
		"OPEN — Dependency scanning in CI; encrypt backups at rest; formal privacy review of historically exposed routes; progressive login lockout",
	],
];

const deployChecklist = [
	"Set AUTH_SECRET to a unique strong value (never the development default).",
	"Set CORS_ORIGIN to the production web origin allowlist.",
	"After first admin bootstrap: DEFAULT_ADMIN_ENABLED=false and rotate the bootstrap password.",
	"Expose the Node process only behind the reverse proxy (trustProxy assumes a trusted hop).",
	"If the API was public before remediation, review access logs for abuse of former open routes.",
	"Users must re-authenticate after deploy (24h JWT TTL + WebSocket auth change).",
];

function wrap(doc, text, maxWidth) {
	return doc.splitTextToSize(text, maxWidth);
}

function newDoc() {
	const doc = new jsPDF({ unit: "pt", format: "a4" });
	const margin = 48;
	const pageW = doc.internal.pageSize.getWidth();
	const pageH = doc.internal.pageSize.getHeight();
	const maxW = pageW - margin * 2;
	let y = margin;
	let page = 1;

	const ensure = (need) => {
		if (y + need > pageH - margin - 24) {
			footer();
			doc.addPage();
			page += 1;
			y = margin;
		}
	};

	const footer = () => {
		doc.setFontSize(8);
		doc.setTextColor(120);
		doc.text(
			`GARIL AI Defensive Security Audit — Confidential — Page ${page}`,
			margin,
			pageH - 28,
		);
	};

	const h1 = (t) => {
		ensure(36);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(16);
		doc.setTextColor(20);
		doc.text(t, margin, y);
		y += 22;
	};

	const h2 = (t) => {
		ensure(28);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(12);
		doc.setTextColor(30);
		doc.text(t, margin, y);
		y += 16;
	};

	const para = (t, opts = {}) => {
		doc.setFont("helvetica", opts.bold ? "bold" : "normal");
		doc.setFontSize(opts.size || 9.5);
		doc.setTextColor(...(opts.color || [40, 40, 40]));
		const lines = wrap(doc, t, maxW);
		for (const line of lines) {
			ensure(14);
			doc.text(line, margin, y);
			y += 12;
		}
		y += opts.after ?? 6;
	};

	const bullet = (t) => {
		doc.setFont("helvetica", "normal");
		doc.setFontSize(9.5);
		doc.setTextColor(40);
		const lines = wrap(doc, `•  ${t}`, maxW);
		for (const line of lines) {
			ensure(14);
			doc.text(line, margin, y);
			y += 12;
		}
		y += 2;
	};

	const findingBlock = (f) => {
		ensure(110);
		const color = SEVERITY_COLORS[f.severity] || [80, 80, 80];
		doc.setFillColor(...color);
		doc.roundedRect(margin, y - 10, maxW, 18, 2, 2, "F");
		doc.setFont("helvetica", "bold");
		doc.setFontSize(9);
		doc.setTextColor(255);
		doc.text(`${f.severity.toUpperCase()}  ·  ${f.id}  ·  ${f.title}`, margin + 8, y + 2);
		y += 22;

		const statusColor = STATUS_COLORS[f.status] || [80, 80, 80];
		doc.setFont("helvetica", "bold");
		doc.setFontSize(8.5);
		doc.setTextColor(...statusColor);
		doc.text(`Status: ${f.status}`, margin, y);
		y += 12;

		para(`Location: ${f.location}`, { size: 8.5, color: [90, 90, 90], after: 4 });
		para(`Description: ${f.description}`, { after: 4 });
		para(`Remediation: ${f.remediation}`, { after: 4 });
		if (f.fixNotes) {
			para(`Resolution: ${f.fixNotes}`, { after: 12, color: [30, 70, 50] });
		} else {
			y += 8;
		}
	};

	const fixed = findings.filter((f) => f.status === "Fixed").length;
	const partial = findings.filter((f) => f.status === "Partial").length;
	const open = findings.filter((f) => f.status === "Open").length;
	const criticalOpen = findings.filter(
		(f) => f.severity === "Critical" && f.status !== "Fixed",
	).length;

	// Cover
	doc.setFillColor(18, 32, 48);
	doc.rect(0, 0, pageW, pageH, "F");
	doc.setTextColor(255);
	doc.setFont("helvetica", "bold");
	doc.setFontSize(22);
	doc.text("GARIL AI", margin, 120);
	doc.setFontSize(18);
	doc.text("Defensive Security Audit Report", margin, 150);
	doc.setFont("helvetica", "normal");
	doc.setFontSize(11);
	doc.text("Governed AI for Research, Instruction and Learning", margin, 178);
	y = 220;
	doc.setFontSize(10);
	const coverLines = [
		"Assessment type: Defensive / hardening review (not an offensive penetration test)",
		"Scope: Next.js frontend + Fastify API + MongoDB + optional S3/MinIO",
		"Initial review: 28 September 2026",
		"Remediation update: 3 October 2026",
		"Classification: Confidential — internal use",
		"",
		"This report identifies security weaknesses, remediations, and fix status.",
		"It does not include exploits, attack payloads, or reproduction procedures.",
	];
	for (const line of coverLines) {
		doc.text(line, margin, y);
		y += 16;
	}
	doc.setFontSize(9);
	doc.setTextColor(180);
	const riskLine =
		criticalOpen === 0
			? `Overall residual risk: MEDIUM (${fixed} fixed, ${partial} partial, ${open} open)`
			: `Overall residual risk: CRITICAL (${criticalOpen} critical items still open)`;
	doc.text(riskLine, margin, pageH - 80);

	footer();
	doc.addPage();
	page = 2;
	y = margin;

	h1("1. Executive summary");
	para(
		"The September 2026 defensive review rated overall risk Critical because unauthenticated user-management and related open API surfaces could list/create/update/delete users, expose sessions/outputs, and invoke costly AI without login. Governance/admin and portal stacks already had real authorization work, but legacy open routes undermined that model.",
	);
	para(
		`Remediation pass (3 October 2026) implemented P0 and most P1 hardening. Findings: ${findings.filter((f) => f.severity === "Critical").length} Critical, ${findings.filter((f) => f.severity === "High").length} High, ${findings.filter((f) => f.severity === "Medium").length} Medium, ${findings.filter((f) => f.severity === "Low").length} Low — of which ${fixed} Fixed, ${partial} Partial, ${open} Open.`,
	);
	para(
		"Residual risk is Medium: Critical open-API issues are closed. Remaining work is mainly httpOnly cookie sessions, token revocation, upload AV/MIME hardening, prompt-injection isolation, backup encryption, and CSP at the edge.",
	);

	h1("2. Project overview");
	bullet("Frontend: Next.js 16 (React 19); client auth via localStorage Bearer JWT (cookie migration still open)");
	bullet("Backend: Fastify 5 (backend/src/server.ts + portal routes) with default-deny API auth");
	bullet("Database: MongoDB via Mongoose");
	bullet("Object storage: Optional S3-compatible (MinIO)");
	bullet("AI: OpenRouter + literature APIs (OpenAlex, PubMed, Tavily, etc.)");
	bullet("Auth: Custom HS256 JWT (24h TTL); Resend for password-reset email");
	y += 8;

	h1("3. Positive controls in place");
	for (const p of positives) bullet(p);
	y += 8;

	h1("4. Findings and remediation status");
	para(
		"Sorted by severity (Critical → Low). Status: Fixed (closed in code), Partial (materially improved), Open (still outstanding).",
	);
	y += 4;
	for (const f of findings) findingBlock(f);

	h1("5. Remediation roadmap");
	for (const [pri, text] of roadmap) {
		ensure(40);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(10);
		doc.setTextColor(20);
		doc.text(pri, margin, y);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(9.5);
		doc.setTextColor(40);
		const lines = wrap(doc, text, maxW - 36);
		for (let i = 0; i < lines.length; i++) {
			ensure(14);
			doc.text(lines[i], margin + 36, y);
			y += 12;
		}
		y += 8;
	}

	h1("6. Production deploy checklist");
	for (const item of deployChecklist) bullet(item);
	y += 8;

	h1("7. Methodology & limitations");
	para(
		"Method: Static defensive code review of authentication, authorization, secrets handling, input/HTML rendering, uploads, CORS/headers, rate limiting, AI surfaces, and privacy-related APIs. Critical findings were spot-checked against source. The October remediation pass verified fixes in source (default-deny hook, removed /api/users*, bootstrap create-only, WS first-message auth, helmet/rate-limit, etc.).",
	);
	para(
		"Limitations: This is not a live penetration test, dynamic scanning campaign, or red-team engagement. No credentials were exercised against production, no exploits were developed, and secret values from .env were not read or included. Deployed runtime configuration may differ from source defaults.",
	);

	h1("8. Next steps");
	bullet("Confirm production env: AUTH_SECRET, CORS_ORIGIN, DEFAULT_ADMIN_ENABLED=false after bootstrap.");
	bullet("Add integration tests asserting 401/403 on unauthenticated calls to formerly open routes.");
	bullet("Schedule P2 work: httpOnly sessions, refresh/revocation, upload MIME/AV, prompt isolation.");
	bullet("Consider a professional third-party penetration test after P2, under a formal rules-of-engagement.");
	bullet("Regenerate this PDF after further remediations: node docs/security/generate-security-audit-pdf.mjs");

	footer();
	mkdirSync(__dirname, { recursive: true });
	doc.save(OUT);
	console.log(`Wrote ${OUT}`);
	console.log(`Summary: ${fixed} fixed, ${partial} partial, ${open} open`);
}

newDoc();
