import Link from "next/link";

import { BrandLogo } from "@/components/BrandLogo";
import { SiteFooter } from "@/components/SiteFooter";
import { APP_COMPANY, APP_NAME } from "@/lib/brand";
import type { LegalDocument } from "@/lib/legal-documents";

type Props = {
	document: LegalDocument;
};

export function LegalDocumentPage({ document }: Props) {
	const { title, updatedLabel, intro, sections } = document;

	return (
		<div className="legal-page">
			<header className="legal-page-header">
				<Link href="/" className="legal-page-brand" aria-label={`${APP_NAME} home`}>
					<BrandLogo height={36} />
				</Link>
				<nav className="legal-page-nav" aria-label="Legal">
					<Link href="/terms" className="legal-page-nav-link">
						Terms
					</Link>
					<Link href="/privacy" className="legal-page-nav-link">
						Privacy
					</Link>
					<Link href="/aup" className="legal-page-nav-link">
						AUP
					</Link>
					<Link href="/register" className="legal-page-nav-link">
						Register
					</Link>
				</nav>
			</header>

			<main className="legal-page-main">
				<p className="legal-page-eyebrow">{APP_COMPANY}</p>
				<h1 className="legal-page-title">{title}</h1>
				<p className="legal-page-updated">{updatedLabel}</p>
				<p className="legal-page-intro">{intro}</p>

				{sections.map((section, sectionIndex) => (
					<section key={`${section.title}-${sectionIndex}`} className="legal-page-section">
						<h2 className="legal-page-section-title">{section.title}</h2>
						{section.paragraphs.map((paragraph, paragraphIndex) => (
							<p key={`${sectionIndex}-${paragraphIndex}`} className="legal-page-paragraph">
								{paragraph}
							</p>
						))}
					</section>
				))}

				<p className="legal-page-contact">
					Questions about this document:{" "}
					<a href="mailto:hello@trustledai.com">hello@trustledai.com</a>
				</p>
			</main>

			<SiteFooter />
		</div>
	);
}
