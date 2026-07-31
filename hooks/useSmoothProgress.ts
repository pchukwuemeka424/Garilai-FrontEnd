"use client";

import { useEffect, useState } from "react";

/**
 * Smoothly counts displayed progress toward a target percentage.
 * Never drops while active; snaps to 100 when `complete` is true.
 * When `autoCreep` is on, keeps advancing slowly toward 92% even if the
 * server target stalls — so generation UIs never sit at 0%.
 */
export function useSmoothProgress(
	target: number,
	options?: {
		complete?: boolean;
		active?: boolean;
		/** Minimum displayed % while active (default 0). */
		floor?: number;
		/** Softly advance while waiting for a higher server target. */
		autoCreep?: boolean;
	},
) {
	const complete = Boolean(options?.complete);
	const active = options?.active !== false;
	const floor = Math.max(0, Math.min(99, Math.round(options?.floor ?? 0)));
	const autoCreep = Boolean(options?.autoCreep);
	const [display, setDisplay] = useState(floor);

	useEffect(() => {
		if (complete) {
			setDisplay(100);
			return;
		}
		if (!active) return;

		const goal = Math.max(floor, Math.min(99, Math.round(target)));

		// Jump display up to floor immediately when generation starts.
		setDisplay((prev) => Math.max(prev, floor, Math.min(goal, floor)));

		const timer = window.setInterval(() => {
			setDisplay((prev) => {
				if (prev < goal) {
					const step = goal - prev > 12 ? 3 : goal - prev > 5 ? 2 : 1;
					return Math.min(goal, prev + step);
				}
				if (autoCreep && prev < 92) {
					return prev + 1;
				}
				return prev;
			});
		}, autoCreep ? 1400 : 180);

		return () => window.clearInterval(timer);
	}, [target, complete, active, floor, autoCreep]);

	return complete ? 100 : display;
}
