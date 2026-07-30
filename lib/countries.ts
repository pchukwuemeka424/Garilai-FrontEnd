export type RegisterCountry = {
	code: string;
	label: string;
};

export const REGISTER_COUNTRIES: RegisterCountry[] = [
	{ code: "NG", label: "Nigeria" },
	{ code: "GB", label: "United Kingdom" },
	{ code: "US", label: "United States" },
	{ code: "GH", label: "Ghana" },
	{ code: "KE", label: "Kenya" },
	{ code: "ZA", label: "South Africa" },
	{ code: "CA", label: "Canada" },
	{ code: "IN", label: "India" },
];

export function getRegisterCountry(code: string): RegisterCountry | undefined {
	return REGISTER_COUNTRIES.find((c) => c.code === code);
}
