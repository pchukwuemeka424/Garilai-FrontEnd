"use client";

import { useEffect, useState } from "react";

import { StudentTokenQuotaBar } from "@/components/StudentTokenQuota";
import { SavedResearchPanel } from "@/components/aula/SavedResearchPanel";
import { parseNotificationsPayload } from "@/components/portal/features/notifications/student-notifications";
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
import {
	AULA_ADMIN_ITEM,
	AULA_NAV_GROUPS,
	AULA_QUICK_ACCESS,
	type AulaNavItem,
} from "@/lib/aula-nav";
import { apiFetch } from "@/lib/portal-api";
import { researchTokenAllowance } from "@/lib/student-tokens";

type Props = {
	user: AuthUser;
	id?: string;
	className?: string;
	onNavigate?: () => void;
};

function toolDescription(id: string): string | undefined {
	return AULA_QUICK_ACCESS.find((tool) => tool.id === id)?.description;
}

function AulaNavItemLink({
	item,
	onNavigate,
	badge,
}: {
	item: AulaNavItem;
	onNavigate?: () => void;
	badge?: string;
}) {
	return (
		<SidebarNavLink
			href={item.href}
			iconId={item.id}
			label={item.label}
			description={item.description ?? toolDescription(item.id)}
			badge={badge ?? item.badge}
			onNavigate={onNavigate}
		/>
	);
}

export function AulaSidebar({ user, id, className, onNavigate }: Props) {
	const { logout } = useAuth();
	const [unreadCount, setUnreadCount] = useState(0);
	const groups = [...AULA_NAV_GROUPS];
	if (user.role === "admin") {
		groups[0] = {
			...groups[0]!,
			items: [...groups[0]!.items, AULA_ADMIN_ITEM],
		};
	}

	const roleBadge = user.role === "admin" ? "Admin" : "Lecturer";
	const showTokens = Boolean(user.tokenQuota || researchTokenAllowance(user.role));

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
			className={className ? `aula-sidebar app-sidebar ${className}` : "aula-sidebar app-sidebar"}
			aria-label="Dashboard navigation"
		>
			<SidebarBrand href="/dashboard" badge={roleBadge} onNavigate={onNavigate} />

			<div className="sb-scroll">
				{groups.map((group) => (
					<SidebarSection key={group.id} label={group.label}>
						<SidebarNav>
							{group.items.map((item) => (
								<AulaNavItemLink
									key={item.id}
									item={item}
									onNavigate={onNavigate}
									badge={
										item.id === "supervision" && unreadCount > 0
											? unreadCount > 99
												? "99+"
												: String(unreadCount)
											: item.badge
									}
								/>
							))}
						</SidebarNav>
					</SidebarSection>
				))}

				<SidebarSection label="Library">
					<SidebarNav>
						<SavedResearchPanel onNavigate={onNavigate} />
					</SidebarNav>
				</SidebarSection>

				<div className="sb-actions">
					<SidebarSignOut onLogout={handleLogout} />
				</div>
			</div>

			<SidebarProfile user={user}>
				{showTokens && <StudentTokenQuotaBar quota={user.tokenQuota} role={user.role} />}
			</SidebarProfile>
		</aside>
	);
}
