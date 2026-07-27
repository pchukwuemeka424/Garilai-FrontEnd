"use client";

import { ResearchJobWatcher } from "@/components/research/ResearchJobWatcher";
import { AuthProvider } from "@/hooks/useAuth";

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<AuthProvider>
			{children}
			<ResearchJobWatcher />
		</AuthProvider>
	);
}
