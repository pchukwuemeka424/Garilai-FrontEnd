import { redirect } from "next/navigation";

type Props = {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toQuery(sp: Record<string, string | string[] | undefined>): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(sp)) {
		if (Array.isArray(value)) {
			for (const item of value) params.append(key, item);
		} else if (value) {
			params.set(key, value);
		}
	}
	const query = params.toString();
	return query ? `?${query}` : "";
}

/** Legacy /research/assignment → /research/generate/assignment */
export default async function LecturerAssignmentRedirect({ searchParams }: Props) {
	redirect(`/research/generate/assignment${toQuery(await searchParams)}`);
}
