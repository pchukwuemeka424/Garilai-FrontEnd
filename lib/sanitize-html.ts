import DOMPurify from "isomorphic-dompurify";

/** Sanitize untrusted HTML before injecting into the DOM. */
export function sanitizeHtml(html: string): string {
	return DOMPurify.sanitize(html, {
		USE_PROFILES: { html: true },
		FORBID_TAGS: ["script", "iframe", "object", "embed", "form"],
		FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "style"],
	});
}
