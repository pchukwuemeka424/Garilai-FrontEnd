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

export default async function LecturerResearchPaperRedirect({ searchParams }: Props) {
	const sp = await searchParams;
	redirect(`/research${toQuery(sp)}`);
}
