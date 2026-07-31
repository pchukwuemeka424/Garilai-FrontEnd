/**
 * Research Note stays on the light shell only.
 * Dark / system (OS night) theming was removed — keep this stub so any
 * leftover imports still resolve without flipping the notebook background.
 */
export type Theme = "light";

export function resolveTheme(_theme?: Theme): "light" {
	return "light";
}

export function useTheme() {
	return {
		theme: "light" as const,
		resolved: "light" as const,
		setTheme: (_t: Theme) => {},
		cycle: () => {},
	};
}
