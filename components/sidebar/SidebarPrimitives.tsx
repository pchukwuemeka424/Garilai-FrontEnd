"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { BrandMark } from "@/components/BrandLogo";
import { NavIcon } from "@/components/aula/NavIcon";
import type { AuthUser } from "@/lib/auth";
import { userInitials } from "@/lib/aula-utils";
import { isSupervisionPath } from "@/lib/aula-nav";
import { isStudentAssistantPath } from "@/lib/student-nav";
import { APP_COMPANY, APP_COMPANY_URL, APP_NAME, APP_TAGLINE } from "@/lib/brand";

import { navIconTone } from "@/lib/colors";

export function SidebarBrand({
	href,
	badge,
	onNavigate,
}: {
	href: string;
	badge?: string;
	onNavigate?: () => void;
}) {
	return (
		<div className="sb-header">
			<Link href={href} className="sb-brand" onClick={onNavigate}>
				<span className="sb-brand-mark" aria-hidden>
					<BrandMark size={28} />
				</span>
				<span className="sb-brand-text">
					<span className="sb-brand-row">
						<span className="sb-brand-name">{APP_NAME}</span>
						{badge && <span className="sb-brand-badge">{badge}</span>}
					</span>
					<span className="sb-brand-tagline">{APP_TAGLINE}</span>
				</span>
			</Link>
		</div>
	);
}

export function SidebarSection({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="sb-section">
			<p className="sb-section-label">{label}</p>
			{children}
		</div>
	);
}

export function SidebarNavLink({
	href,
	iconId,
	label,
	description,
	badge,
	active,
	onNavigate,
}: {
	href: string;
	iconId: string;
	label: string;
	description?: string;
	badge?: string;
	active?: boolean;
	onNavigate?: () => void;
}) {
	const pathname = usePathname() ?? "";
	const base = href.split("#")[0] ?? href;
	const isDashboard = base === "/dashboard" || base === "/student/dashboard";
	let pathActive =
		pathname === base || (!isDashboard && pathname.startsWith(`${base}/`));
	if (iconId === "research" && pathname.includes("/research/notebook")) {
		pathActive = false;
	}
	if (iconId === "supervision") {
		pathActive = isSupervisionPath(pathname);
	}
	if (iconId === "assistant") {
		pathActive = isStudentAssistantPath(pathname);
	}
	const isActive = active ?? pathActive;
	const tone = navIconTone(iconId);

	return (
		<Link
			href={href}
			className={`sb-link${isActive ? " sb-link-active" : ""}`}
			onClick={onNavigate}
			style={
				{
					"--sb-icon-bg": tone.bg,
					"--sb-icon-fg": tone.fg,
				} as CSSProperties
			}
		>
			<span className="sb-link-icon" aria-hidden>
				<NavIcon id={iconId} size={18} />
			</span>
			<span className="sb-link-text">
				<span className="sb-link-label">{label}</span>
				{description && <span className="sb-link-desc">{description}</span>}
			</span>
			{badge && <span className="sb-link-badge">{badge}</span>}
		</Link>
	);
}

export function SidebarNav({ children }: { children: ReactNode }) {
	return <nav className="sb-nav">{children}</nav>;
}

function hrefIsActive(pathname: string, href: string) {
	const base = href.split("#")[0] ?? href;
	return pathname === base || pathname.startsWith(`${base}/`);
}

export function SidebarFolder({
	iconId,
	label,
	description,
	childHrefs,
	children,
}: {
	iconId: string;
	label: string;
	description?: string;
	childHrefs: string[];
	children: ReactNode;
}) {
	const pathname = usePathname() ?? "";
	const childActive = childHrefs.some((href) => hrefIsActive(pathname, href));
	const [open, setOpen] = useState(childActive);
	const tone = navIconTone(iconId);

	useEffect(() => {
		if (childActive) setOpen(true);
	}, [childActive]);

	return (
		<div className={`sb-folder${open ? " sb-folder-open" : ""}${childActive ? " sb-folder-active" : ""}`}>
			<button
				type="button"
				className="sb-link sb-folder-toggle"
				aria-expanded={open}
				onClick={() => setOpen((value) => !value)}
				style={
					{
						"--sb-icon-bg": tone.bg,
						"--sb-icon-fg": tone.fg,
					} as CSSProperties
				}
			>
				<span className="sb-link-icon" aria-hidden>
					<NavIcon id={iconId} size={18} />
				</span>
				<span className="sb-link-text">
					<span className="sb-link-label">{label}</span>
					{description && <span className="sb-link-desc">{description}</span>}
				</span>
				<span className="sb-folder-chevron" aria-hidden>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				</span>
			</button>
			{open && (
				<div className="sb-folder-items" role="group" aria-label={label}>
					{children}
				</div>
			)}
		</div>
	);
}

export function SidebarSignOut({ onLogout }: { onLogout: () => void }) {
	return (
		<button type="button" className="sb-signout" onClick={onLogout}>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
				<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
			</svg>
			Sign out
		</button>
	);
}

export function SidebarProfile({
	user,
	onLogout,
	children,
}: {
	user: AuthUser;
	onLogout?: () => void;
	children?: ReactNode;
}) {
	const initials = userInitials(user.name);
	const meta = [user.department, user.institution].filter(Boolean).join(" · ");

	return (
		<div className="sb-footer">
			{children}
			<div className="sb-profile">
				<span className="sb-profile-avatar" aria-hidden>
					{initials}
				</span>
				<div className="sb-profile-info">
					<p className="sb-profile-name">{user.name}</p>
					<p className="sb-profile-email">{user.email}</p>
					{meta && <p className="sb-profile-meta">{meta}</p>}
				</div>
			</div>
			{onLogout && <SidebarSignOut onLogout={onLogout} />}
			<p className="sb-copy">
				© {new Date().getFullYear()} {APP_COMPANY}
				{" · "}
				<a href={APP_COMPANY_URL} target="_blank" rel="noopener noreferrer" className="sb-copy-link">
					trustledai.com
				</a>
			</p>
		</div>
	);
}
