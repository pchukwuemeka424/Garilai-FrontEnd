"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { useAdminGuard } from "@/hooks/useAdminGuard";
import { adminPageInstructionsForPath } from "@/lib/admin-nav";

type Props = {
	title: string;
	subtitle?: string;
	/** Override auto-resolved page guide from admin nav */
	instructions?: string | null;
	breadcrumb?: string;
	actions?: ReactNode;
	children: ReactNode;
};

export function AdminPageGuide({ children }: { children: ReactNode }) {
	return (
		<aside className="admin-page-guide" role="note">
			<div className="admin-page-guide-icon" aria-hidden>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
					<circle cx="12" cy="12" r="10" />
					<path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
				</svg>
			</div>
			<div className="admin-page-guide-body">
				<p className="admin-page-guide-label">What this page is for</p>
				<p className="admin-page-guide-text">{children}</p>
			</div>
		</aside>
	);
}

export function AdminShell({ title, subtitle, instructions, breadcrumb, actions, children }: Props) {
	const { user, loading, ready } = useAdminGuard();
	const pathname = usePathname();
	const [sidebarOpen, setSidebarOpen] = useState(false);

	const guide =
		instructions === null
			? undefined
			: (instructions ?? adminPageInstructionsForPath(pathname));

	useEffect(() => {
		if (!sidebarOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setSidebarOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [sidebarOpen]);

	if (loading || !ready) {
		return (
			<div className="admin">
				<p className="admin-loading muted">Loading admin…</p>
			</div>
		);
	}

	return (
		<div className="admin">
			{sidebarOpen && (
				<button
					type="button"
					className="admin-sidebar-backdrop"
					aria-label="Close navigation"
					onClick={() => setSidebarOpen(false)}
				/>
			)}

			<AdminSidebar
				className={sidebarOpen ? "admin-sidebar-open" : undefined}
				onNavigate={() => setSidebarOpen(false)}
			/>

			<div className="admin-shell">
				<header className="admin-topbar">
					<div className="admin-topbar-start">
						<button
							type="button"
							className="admin-menu-btn"
							aria-label="Open navigation"
							aria-expanded={sidebarOpen}
							aria-controls="admin-sidebar"
							onClick={() => setSidebarOpen(true)}
						>
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
								<path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
							</svg>
						</button>
						<div className="admin-topbar-titles">
							{breadcrumb && <p className="admin-breadcrumb">{breadcrumb}</p>}
							<h1 className="admin-page-title">{title}</h1>
							{subtitle && <p className="admin-page-subtitle">{subtitle}</p>}
						</div>
					</div>
					<div className="admin-topbar-end">
						{user && (
							<span className="admin-user-pill" title={user.email}>
								<span className="admin-user-pill-dot" aria-hidden />
								{user.name}
							</span>
						)}
						{actions}
					</div>
				</header>

				<main className="admin-content">
					{guide ? <AdminPageGuide>{guide}</AdminPageGuide> : null}
					{children}
				</main>
			</div>
		</div>
	);
}

export function AdminStatCard({
	label,
	value,
	hint,
	trend,
	accent,
}: {
	label: string;
	value: number | string;
	hint?: string;
	trend?: "up" | "down" | "neutral";
	accent?: "primary" | "success" | "warning" | "danger";
}) {
	return (
		<div className={`admin-stat${accent ? ` admin-stat-${accent}` : ""}`}>
			<div className="admin-stat-head">
				<p className="admin-stat-label">{label}</p>
				{trend && (
					<span className={`admin-stat-trend admin-stat-trend-${trend}`} aria-hidden>
						{trend === "up" ? "↑" : trend === "down" ? "↓" : "•"}
					</span>
				)}
			</div>
			<p className="admin-stat-value">
				{typeof value === "number" ? value.toLocaleString() : value}
			</p>
			{hint && <p className="admin-stat-hint">{hint}</p>}
		</div>
	);
}

export function AdminPanel({
	title,
	description,
	actions,
	children,
	className,
}: {
	title?: string;
	description?: string;
	actions?: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	return (
		<section className={`admin-panel${className ? ` ${className}` : ""}`}>
			{(title || actions) && (
				<div className="admin-panel-head">
					<div>
						{title && <h2 className="admin-panel-title">{title}</h2>}
						{description && <p className="admin-panel-desc">{description}</p>}
					</div>
					{actions && <div className="admin-panel-actions">{actions}</div>}
				</div>
			)}
			<div className="admin-panel-body">{children}</div>
		</section>
	);
}

export function formatAdminDate(value: string | null): string {
	if (!value) return "—";
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

export function formatAdminRelative(value: string | null): string {
	if (!value) return "Never";
	const date = new Date(value);
	const diffMs = Date.now() - date.getTime();
	const diffMins = Math.floor(diffMs / 60_000);
	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	const diffHours = Math.floor(diffMins / 60);
	if (diffHours < 24) return `${diffHours}h ago`;
	const diffDays = Math.floor(diffHours / 24);
	if (diffDays < 30) return `${diffDays}d ago`;
	return formatAdminDate(value);
}

const TOPIC_MAX_WORDS = 8;

export function formatSessionTopic(topic: string, maxWords = TOPIC_MAX_WORDS): string {
	const trimmed = topic.trim();
	if (!trimmed) return trimmed;

	const words = trimmed.split(/\s+/).filter(Boolean);
	if (words.length <= maxWords) return trimmed;

	return `${words.slice(0, maxWords).join(" ")}…`;
}

export function isSessionTopicTruncated(topic: string, maxWords = TOPIC_MAX_WORDS): boolean {
	const words = topic.trim().split(/\s+/).filter(Boolean);
	return words.length > maxWords;
}
