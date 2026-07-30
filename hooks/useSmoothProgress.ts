"use client";

import { useEffect, useState } from "react";

/**
 * Smoothly counts displayed progress toward a target percentage.
 * Never drops while active; snaps to 100 when `complete` is true.
 */
export function useSmoothProgress(
	target: number,
	options?: { complete?: boolean; active?: boolean },
) {
	const complete = Boolean(options?.complete);
	const active = options?.active !== false;
	const [display, setDisplay] = useState(0);

	useEffect(() => {
		if (complete) {
			setDisplay(100);
			return;
		}
		if (!active) return;

		const goal = Math.max(0, Math.min(99, Math.round(target)));
		const timer = window.setInterval(() => {
			setDisplay((prev) => {
				if (prev === goal) return prev;
				if (prev < goal) return Math.min(goal, prev + (goal - prev > 8 ? 2 : 1));
				return prev;
			});
		}, 180);

		return () => window.clearInterval(timer);
	}, [target, complete, active]);

	return complete ? 100 : display;
}
