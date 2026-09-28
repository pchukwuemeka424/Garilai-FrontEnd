"use client";

import { useEffect, useId, useState } from "react";

import { APP_NAME } from "@/lib/brand";
import {
	COOKIE_CONSENT_OPEN_EVENT,
	getCookieConsent,
	openCookieConsent,
	setCookieConsent,
	type CookieConsentChoice,
} from "@/lib/cookie-consent";

function CookieIcon() {
	return (
		<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
			<circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
			<circle cx="9.2" cy="10" r="1.05" fill="currentColor" />
			<circle cx="13.6" cy="8.6" r="0.9" fill="currentColor" />
			<circle cx="14.4" cy="13.2" r="1.1" fill="currentColor" />
			<circle cx="9.6" cy="14.6" r="0.85" fill="currentColor" />
		</svg>
	);
}

export function CookieConsentBanner() {
	const titleId = useId();
	const copyId = useId();
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		if (!getCookieConsent()) setVisible(true);

		const onOpen = () => setVisible(true);
		window.addEventListener(COOKIE_CONSENT_OPEN_EVENT, onOpen);
		return () => window.removeEventListener(COOKIE_CONSENT_OPEN_EVENT, onOpen);
	}, []);

	function choose(choice: CookieConsentChoice) {
		setCookieConsent(choice);
		setVisible(false);
	}

	if (!visible) return null;

	return (
		<div className="cookie-consent" role="dialog" aria-modal="false" aria-labelledby={titleId} aria-describedby={copyId}>
			<div className="cookie-consent-card">
				<div className="cookie-consent-copy">
					<span className="cookie-consent-icon" aria-hidden>
						<CookieIcon />
					</span>
					<div>
						<p className="cookie-consent-title" id={titleId}>
							Cookies on {APP_NAME}
						</p>
						<p className="cookie-consent-text" id={copyId}>
							We use essential cookies to keep the site working. Optional cookies help us understand how{" "}
							{APP_NAME} is used. You can accept or decline optional cookies.
						</p>
					</div>
				</div>
				<div className="cookie-consent-actions">
					<button type="button" className="home-btn home-btn-ghost-dark" onClick={() => choose("declined")}>
						Decline
					</button>
					<button type="button" className="home-btn home-btn-primary" onClick={() => choose("accepted")}>
						Accept
					</button>
				</div>
			</div>
		</div>
	);
}

export function CookieSettingsButton({ className }: { className?: string }) {
	return (
		<button type="button" className={className ?? "site-footer-link"} onClick={openCookieConsent}>
			Cookies
		</button>
	);
}
