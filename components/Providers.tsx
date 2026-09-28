"use client";

import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { PolicyAcceptanceGate } from "@/components/legal/PolicyAcceptanceGate";
import { ResearchJobWatcher } from "@/components/research/ResearchJobWatcher";
import { AuthProvider } from "@/hooks/useAuth";

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<AuthProvider>
			<PolicyAcceptanceGate>
				{children}
				<ResearchJobWatcher />
				<CookieConsentBanner />
			</PolicyAcceptanceGate>
		</AuthProvider>
	);
}
