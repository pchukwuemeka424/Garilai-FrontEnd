"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
	SidebarBrand,
	SidebarNav,
	SidebarNavLink,
	SidebarProfile,
	SidebarSection,
} from "@/components/sidebar/SidebarPrimitives";
import { useAuth } from "@/hooks/useAuth";
import { ADMIN_LOGIN_PATH, ADMIN_NAV_GROUPS, isAdminNavActive } from "@/lib/admin-nav";
import { canAccessFeature, type GovernanceFeature } from "@/lib/admin-roles";

type Props = {
	id?: string;
	className?: string;
	onNavigate?: () => void;
};

export function AdminSidebar({ id = "admin-sidebar", className, onNavigate }: Props) {
	const pathname = usePathname();
	const { user, logout } = useAuth();

	if (!user) return null;

	const handleLogout = () => {
		onNavigate?.();
		logout(ADMIN_LOGIN_PATH);
	};

	return (
		<aside
			id={id}
			className={`admin-sidebar app-sidebar${className ? ` ${className}` : ""}`}
			aria-label="Admin navigation"
		>
			<SidebarBrand href="/admin" badge="Governance" onNavigate={onNavigate} />

			<div className="admin-sidebar-nav">
				{ADMIN_NAV_GROUPS.map((group) => {
					const visibleItems = group.items.filter((item) => {
						if (!item.feature) return true;
						return canAccessFeature(user.role, item.feature as GovernanceFeature);
					});
					if (visibleItems.length === 0) return null;
					return (
						<SidebarSection key={group.id} label={group.label}>
							<SidebarNav>
								{visibleItems.map((item) => (
									<SidebarNavLink
										key={item.id}
										href={item.href}
										iconId={item.iconId}
										label={item.label}
										description={item.description}
										active={isAdminNavActive(pathname, item.href)}
										onNavigate={onNavigate}
									/>
								))}
							</SidebarNav>
						</SidebarSection>
					);
				})}

				<div className="admin-sidebar-actions">
					<Link href="/dashboard" className="admin-sidebar-home" onClick={onNavigate}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
							<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinejoin="round" />
							<path d="M9 22V12h6v10" strokeLinejoin="round" />
						</svg>
						Back to app
					</Link>
					<button type="button" className="admin-sidebar-logout" onClick={handleLogout}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
							<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
						Log out
					</button>
				</div>

				<SidebarProfile user={user} />
			</div>
		</aside>
	);
}
