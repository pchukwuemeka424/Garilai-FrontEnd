export const COOKIE_CONSENT_KEY = "garil-cookie-consent";
export const COOKIE_CONSENT_OPEN_EVENT = "garil:cookie-consent-open";
export const COOKIE_CONSENT_CHANGE_EVENT = "garil:cookie-consent-change";

export type CookieConsentChoice = "accepted" | "declined";

export function isCookieConsentChoice(value: unknown): value is CookieConsentChoice {
	return value === "accepted" || value === "declined";
}

export function getCookieConsent(): CookieConsentChoice | null {
	if (typeof window === "undefined") return null;
	try {
		const stored = window.localStorage.getItem(COOKIE_CONSENT_KEY);
		return isCookieConsentChoice(stored) ? stored : null;
	} catch {
		return null;
	}
}

export function setCookieConsent(choice: CookieConsentChoice) {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(COOKIE_CONSENT_KEY, choice);
	} catch {
		// Storage can be blocked; the in-memory choice still closes the banner.
	}
	window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGE_EVENT, { detail: choice }));
}

export function openCookieConsent() {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new Event(COOKIE_CONSENT_OPEN_EVENT));
}
