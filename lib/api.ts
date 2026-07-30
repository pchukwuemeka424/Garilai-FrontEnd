/** Backend origin for split dev (Next on :3000, API on :3141). Empty = same origin. */
import { getStoredToken } from "@/lib/auth";

export function getBackendOrigin(): string {
	if (typeof window === "undefined") return "";

	const host = window.location.hostname || "127.0.0.1";
	const isLocalHost = host === "localhost" || host === "127.0.0.1";

	// Local Next dev should hit the local API even when NEXT_PUBLIC_* points at production
	// (avoids stale production routes during feature work).
	if (process.env.NODE_ENV === "development" && isLocalHost) {
		return "http://127.0.0.1:3141";
	}

	const env = process.env.NEXT_PUBLIC_FEYNMAN_BACKEND?.trim();
	if (env) return env.replace(/\/$/, "");

	if (process.env.NODE_ENV === "development") {
		const backendHost = host === "localhost" ? "127.0.0.1" : host;
		return `http://${backendHost}:3141`;
	}
	return "";
}

export function apiUrl(path: string): string {
	const origin = getBackendOrigin();
	const normalized = path.startsWith("/") ? path : `/${path}`;
	return origin ? `${origin}${normalized}` : normalized;
}

export function wsUrl(): string {
	const origin = getBackendOrigin();
	const base =
		origin
			? (() => {
					const url = new URL(origin);
					const protocol = url.protocol === "https:" ? "wss:" : "ws:";
					return `${protocol}//${url.host}/ws`;
				})()
			: (() => {
					const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
					const host = typeof window !== "undefined" ? window.location.host : "localhost";
					return `${protocol}//${host}/ws`;
				})();

	const token = typeof window !== "undefined" ? getStoredToken() : null;
	if (!token) return base;
	return `${base}?token=${encodeURIComponent(token)}`;
}
