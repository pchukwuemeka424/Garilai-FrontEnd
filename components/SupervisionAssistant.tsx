"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AulaLayout } from "@/components/AulaLayout";
import { NavIcon } from "@/components/aula/NavIcon";
import { parseNotificationsPayload } from "@/components/portal/features/notifications/student-notifications";
import { IconArrowRight } from "@/components/ui/ButtonIcon";
import { AULA_PROJECT_FOLDER_ITEMS } from "@/lib/aula-nav";
import { apiFetch } from "@/lib/portal-api";

function formatBadge(count: number) {
	return count > 99 ? "99+" : String(count);
}

type Overview = {
	projectCount?: number;
	assignmentCount?: number;
	studentCount?: number;
	pendingReviews?: number;
};

type ToolBadge = {
	count: number;
	label: string;
	tone: "count" | "alert";
};

export function SupervisionAssistant() {
	const [unreadCount, setUnreadCount] = useState(0);
	const [projectCount, setProjectCount] = useState(0);
	const [assignmentCount, setAssignmentCount] = useState(0);
	const [studentCount, setStudentCount] = useState(0);
	const [reviewAlerts, setReviewAlerts] = useState(0);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			const [notifyResult, overviewResult] = await Promise.allSettled([
				apiFetch("/api/v1/notifications"),
				apiFetch("/api/v1/analytics/overview") as Promise<Overview>,
			]);

			if (cancelled) return;

			if (notifyResult.status === "fulfilled") {
				setUnreadCount(parseNotificationsPayload(notifyResult.value).unreadCount);
			}

			if (overviewResult.status === "fulfilled") {
				const overview = overviewResult.value || {};
				setProjectCount(Number(overview.projectCount || 0));
				setAssignmentCount(Number(overview.assignmentCount || 0));
				setStudentCount(Number(overview.studentCount || 0));
				setReviewAlerts(Number(overview.pendingReviews || 0));
			}
		}

		void load();
		return () => {
			cancelled = true;
		};
	}, []);

	function badgeFor(toolId: string): ToolBadge | null {
		if (toolId === "notifications" && unreadCount > 0) {
			return { count: unreadCount, label: `${unreadCount} unread`, tone: "alert" };
		}
		if (toolId === "projects") {
			return {
				count: projectCount,
				label: `${projectCount} ${projectCount === 1 ? "project" : "projects"}`,
				tone: "count",
			};
		}
		if (toolId === "assignments") {
			return {
				count: assignmentCount,
				label: `${assignmentCount} ${assignmentCount === 1 ? "assignment" : "assignments"}`,
				tone: "count",
			};
		}
		if (toolId === "students") {
			return {
				count: studentCount,
				label: `${studentCount} ${studentCount === 1 ? "student" : "students"}`,
				tone: "count",
			};
		}
		if (toolId === "reviews" && reviewAlerts > 0) {
			return { count: reviewAlerts, label: `${reviewAlerts} pending reviews`, tone: "alert" };
		}
		return null;
	}

	return (
		<AulaLayout showRightPanel={false}>
			<div className="aula-dash aula-dash--full">
				<header className="aula-dash-hero">
					<div className="aula-dash-hero-copy">
						<p className="aula-dash-kicker">Lecturer workspace</p>
						<h1 className="aula-dash-title">Supervision Assistant</h1>
						<p className="aula-dash-subtitle">
							Supervise student work from one place — projects, reviews, assignments, students, and
							analytics.
						</p>
					</div>
					<div className="aula-dash-hero-actions">
						<Link href="/notifications" className="ghost-btn aula-dash-icon-btn">
							<NavIcon id="notifications" size={16} />
							Notifications
							{unreadCount > 0 ? (
								<span className="aula-notify-badge" aria-label={`${unreadCount} unread`}>
									{formatBadge(unreadCount)}
								</span>
							) : null}
						</Link>
					</div>
				</header>

				<section className="aula-dash-section">
					<div className="aula-dash-section-head">
						<div>
							<h2 className="aula-dash-section-title">Supervision tools</h2>
							<p className="aula-dash-section-desc">Open a tool to continue supervising this workspace.</p>
						</div>
					</div>
					<div className="aula-dash-tools aula-dash-tools--cols-4" role="navigation" aria-label="Supervision tools">
						{AULA_PROJECT_FOLDER_ITEMS.map((tool) => {
							const badge = badgeFor(tool.id);
							return (
								<article key={tool.id} className={`aula-dash-tool aula-dash-tool-${tool.iconColor}`}>
									<div className="aula-dash-tool-top">
										<span className={`aula-dash-tool-icon aula-quick-icon-${tool.iconColor}`} aria-hidden>
											<NavIcon id={tool.id} size={26} />
										</span>
										{badge ? (
											<span
												className={
													badge.tone === "alert" ? "aula-notify-badge" : "aula-dash-count-badge"
												}
												aria-label={badge.label}
											>
												{formatBadge(badge.count)}
											</span>
										) : null}
									</div>
									<h3 className="aula-dash-tool-title">{tool.label}</h3>
									<p className="aula-dash-tool-desc">{tool.description}</p>
									<div className="aula-dash-tool-actions">
										<Link href={tool.href} className="primary-btn aula-dash-tool-open">
											Open
											<IconArrowRight size={14} />
										</Link>
									</div>
								</article>
							);
						})}
					</div>
				</section>
			</div>
		</AulaLayout>
	);
}
