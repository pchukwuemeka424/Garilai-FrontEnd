"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { FeatureAiUseNoticeModal } from "@/components/legal/FeatureAiUseNoticeModal";
import {
	hasAcceptedFeatureAiNotice,
	type FeatureAiNoticeConfig,
} from "@/lib/feature-ai-notice";

/**
 * Gate a feature behind an AI acceptable-use notice.
 * Decline navigates to the matching dashboard.
 * Acceptance is remembered in localStorage until the notice version changes.
 */
export function useFeatureAiNoticeGate(
	config: FeatureAiNoticeConfig,
	dashboardHref: string,
) {
	const router = useRouter();
	const [open, setOpen] = useState(() => !hasAcceptedFeatureAiNotice(config));

	useEffect(() => {
		setOpen(!hasAcceptedFeatureAiNotice(config));
		// Intentionally keyed by storage key.
		// eslint-disable-next-line react-hooks/exhaustive-deps -- config identity is stable via storageKey
	}, [config.storageKey]);

	const modal = (
		<FeatureAiUseNoticeModal
			open={open}
			config={config}
			onAccept={() => setOpen(false)}
			onDecline={() => {
				setOpen(false);
				router.replace(dashboardHref);
			}}
		/>
	);

	return { aiNoticeOpen: open, aiNoticeModal: modal };
}
