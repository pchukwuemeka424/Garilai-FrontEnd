"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { BrandLogo } from "@/components/BrandLogo";
import { SiteFooter } from "@/components/SiteFooter";
import { APP_NAME } from "@/lib/brand";

const QUICK_LINKS = [
	{ href: "/", label: "Home" },
	{ href: "/research", label: "Research Assistant" },
	{ href: "/login", label: "Sign in" },
	{ href: "/register", label: "Create account" },
] as const;

export default function NotFound() {
	const router = useRouter();

	return (
		<div className="home-page not-found-page">
			<header className="home-header not-found-header">
				<div className="home-header-inner not-found-header-inner">
					<Link href="/" className="home-logo" aria-label={`${APP_NAME} home`}>
						<BrandLogo height={44} className="home-logo-img" priority />
					</Link>
					<div className="not-found-header-actions">
						<Link href="/login" className="home-btn home-btn-ghost-dark">
							Sign in
						</Link>
						<Link href="/" className="home-btn home-btn-primary">
							Go home
						</Link>
					</div>
				</div>
			</header>

			<main className="not-found-main">
				<div className="not-found-panel" role="status" aria-live="polite">
					<p className="not-found-code" aria-hidden="true">
						404
					</p>
					<p className="not-found-eyebrow">Page not found</p>
					<h1 className="not-found-title">This page is not available</h1>
					<p className="not-found-lead">
						The link may be broken, outdated, or mistyped. Check the URL, or continue from one of the
						destinations below.
					</p>

					<div className="not-found-actions">
						<Link href="/" className="home-btn home-btn-primary home-btn-lg">
							Return home
						</Link>
						<button
							type="button"
							className="home-btn home-btn-ghost-dark home-btn-lg"
							onClick={() => router.back()}
						>
							Go back
						</button>
					</div>

					<nav className="not-found-links" aria-label="Helpful destinations">
						{QUICK_LINKS.map((link) => (
							<Link key={link.href} href={link.href} className="not-found-link">
								{link.label}
							</Link>
						))}
					</nav>
				</div>
			</main>

			<SiteFooter />
		</div>
	);
}
