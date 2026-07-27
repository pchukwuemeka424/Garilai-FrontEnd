import {
	APP_COMPANY,
	APP_COMPANY_URL,
	APP_FOOTER_RIGHT,
	APP_NAME,
	APP_TAGLINE,
} from "@/lib/brand";

type Props = {
	className?: string;
	variant?: "page" | "auth";
};

export function SiteFooter({ className, variant = "page" }: Props) {
	const year = new Date().getFullYear();

	return (
		<footer className={`site-footer site-footer-${variant}${className ? ` ${className}` : ""}`}>
			<div className="site-footer-inner">
				<p className="site-footer-brand">
					© {year} {APP_COMPANY}. {APP_NAME}.
				</p>
				<p className="site-footer-tagline">{APP_TAGLINE}</p>
				<p className="site-footer-meta">
					<span>{APP_FOOTER_RIGHT}</span>
					<span className="site-footer-sep" aria-hidden>
						·
					</span>
					<a href={APP_COMPANY_URL} target="_blank" rel="noopener noreferrer" className="site-footer-link">
						trustledai.com
					</a>
				</p>
			</div>
		</footer>
	);
}
