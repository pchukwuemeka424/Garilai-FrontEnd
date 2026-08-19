import { apiUrl } from "@/lib/api";
import { authHeaders } from "@/lib/auth";

function toPortalUrl(input: string) {
	if (/^https?:\/\//i.test(input)) return input;
	let path = input.startsWith("/") ? input : `/${input}`;
	if (path.startsWith("/api/v1/")) path = `/api/portal/${path.slice("/api/v1/".length)}`;
	else if (!path.startsWith("/api/portal/") && !path.startsWith("/api/")) {
		path = `/api/portal${path}`;
	}
	return apiUrl(path);
}

async function readApiJson(res: Response) {
	const json = (await res.json().catch(() => null)) as {
		success?: boolean;
		data?: unknown;
		error?: { message?: string };
	} | null;
	if (!res.ok || json?.success === false) {
		throw new Error(
			json?.error?.message ||
				(res.status ? `Request failed (${res.status})` : "Request failed"),
		);
	}
	if (json && "data" in json) return json.data;
	return json;
}

export async function apiFetch(input: string, init: RequestInit = {}) {
	const headers = new Headers(init.headers);
	const auth = authHeaders() as Record<string, string>;
	for (const [key, value] of Object.entries(auth)) headers.set(key, value);
	if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
		headers.set("Content-Type", "application/json");
	}
	const res = await fetch(toPortalUrl(input), { ...init, headers });
	return readApiJson(res);
}

/** Convert a FormData file upload into the JSON payload the portal API expects. */
export async function apiUpload(input: string, formData: FormData) {
	const file = formData.get("file");
	if (!(file instanceof File)) throw new Error("Upload a file");
	const data = await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result || ""));
		reader.onerror = () => reject(new Error("Could not read the file"));
		reader.readAsDataURL(file);
	});
	return apiFetch(input, {
		method: "POST",
		body: JSON.stringify({
			fileName: file.name,
			mimeType: file.type,
			data,
			mode: String(formData.get("mode") || "append"),
		}),
	});
}
