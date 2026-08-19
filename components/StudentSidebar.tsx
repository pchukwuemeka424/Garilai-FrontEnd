"use client";

import { useEffect, useState } from "react";

import { SavedResearchPanel } from "@/components/aula/SavedResearchPanel";
import { parseNotificationsPayload } from "@/components/portal/features/notifications/student-notifications";
import { StudentTokenQuotaBar } from "@/components/StudentTokenQuota";
import {
	SidebarBrand,
	SidebarNav,
	SidebarNavLink,
	SidebarProfile,
	SidebarSection,
	SidebarSignOut,
} from "@/components/sidebar/SidebarPrimitives";
import { useAuth } from "@/hooks/useAuth";
import type { AuthUser } from "@/lib/auth";
import { apiFetch } from "@/lib/portal-api";
import {
	STUDENT_ASSISTANT_ITEM,
	STUDENT_DASHBOARD_ITEM,
	STUDENT_NOTEBOOK_ITEM,
	STUDENT_RESEARCH_ITEM,
} from "@/lib/student-nav";

type Props = {
	user: AuthUser;
	id?: string;
	className?: string;
	onNavigate?: () => void;
};

export function StudentSidebar({ user, id, className, onNavigate }: Props) {
	const { logout } = useAuth();
	const [unreadCount, setUnreadCount] = useState(0);

	useEffect(() => {
		let cancelled = false;
		void apiFetch("/api/v1/notifications")
			.then((data) => {
				if (cancelled) return;
				setUnreadCount(parseNotificationsPayload(data).unreadCount);
			})
			.catch(() => {
				if (!cancelled) setUnreadCount(0);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const handleLogout = () => {
		onNavigate?.();
		logout();
	};

	return (
		<aside
			id={id}
			className={className ? `stu-sidebar app-sidebar ${className}` : "stu-sidebar app-sidebar"}
			aria-label="Student navigation"
		>
			<SidebarBrand href="/student/dashboard" badge="Student" onNavigate={onNavigate} />

			<div className="sb-scroll">
				<SidebarSection label="Main">
					<SidebarNav>
						{[
							STUDENT_DASHBOARD_ITEM,
							STUDENT_RESEARCH_ITEM,
							STUDENT_NOTEBOOK_ITEM,
							STUDENT_ASSISTANT_ITEM,
						].map((item) => (
							<SidebarNavLink
								key={item.id}
								href={item.href}
								iconId={item.id}
								label={item.label}
								description={item.description}
								onNavigate={onNavigate}
								badge={
									item.id === "assistant" && unreadCount > 0
										? unreadCount > 99
											? "99+"
											: String(unreadCount)
										: undefined
								}
							/>
						))}
					</SidebarNav>
				</SidebarSection>

				<SidebarSection label="Library">
					<SidebarNav>
						<SavedResearchPanel variant="student" onNavigate={onNavigate} />
					</SidebarNav>
				</SidebarSection>

				<div className="sb-actions">
					<SidebarSignOut onLogout={handleLogout} />
				</div>
			</div>

			<SidebarProfile user={user}>
				<StudentTokenQuotaBar quota={user.tokenQuota} role={user.role} />
			</SidebarProfile>
		</aside>
	);
}
