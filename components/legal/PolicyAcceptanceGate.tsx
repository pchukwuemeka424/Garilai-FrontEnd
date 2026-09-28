"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { LegalDocumentModal } from "@/components/legal/LegalDocumentModal";
import { useAuth } from "@/hooks/useAuth";
import { apiUrl } from "@/lib/api";
import { authHeaders, type AuthUser } from "@/lib/auth";
import type { LegalDocumentId } from "@/lib/legal-documents";

export function PolicyAcceptanceGate({ children }: { children: React.ReactNode }) {
	const { user, refreshUser, logout } = useAuth();
	const titleId = useId();
	const [mounted, setMounted] = useState(false);
	const [accepted, setAccepted] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [legalModal, setLegalModal] = useState<LegalDocumentId | null>(null);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		setAccepted(false);
		setError(null);
	}, [user?.id, user?.needsPolicyAcceptance]);

	const needsGate = Boolean(user && user.needsPolicyAcceptance);

	const onAccept = useCallback(async () => {
		if (!accepted) {
			setError("Please agree to the Terms of Service, Privacy Policy, and Acceptable Use Policy.");
			return;
		}
		setSubmitting(true);
		setError(null);
		try {
			const res = await fetch(apiUrl("/api/auth/accept-policies"), {
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeaders() },
				body: JSON.stringify({ acceptedPolicies: true }),
			});
			const data = (await res.json()) as { user?: AuthUser; error?: string };
			if (!res.ok) throw new Error(data.error ?? "Unable to record acceptance.");
			await refreshUser();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	}, [accepted, refreshUser]);

	return (
		<>
			{children}
			{mounted && needsGate
				? createPortal(
						<div className="modal-backdrop legal-doc-modal-backdrop policy-acceptance-backdrop" role="presentation">
							<div
								className="legal-doc-modal policy-acceptance-modal"
								role="dialog"
								aria-modal="true"
								aria-labelledby={titleId}
							>
								<header className="legal-doc-modal-header">
									<div>
										<p className="legal-doc-modal-eyebrow">Policy update</p>
										<h2 id={titleId} className="legal-doc-modal-title">
											Please review and accept updated policies
										</h2>
										<p className="legal-doc-modal-updated">
											Our Terms, Privacy Policy, or Acceptable Use Policy have changed. Accept to continue
											using GARIL AI.
										</p>
									</div>
								</header>

								<div className="legal-doc-modal-body">
									<label className="login-consent">
										<input
											type="checkbox"
											checked={accepted}
											onChange={(e) => setAccepted(e.target.checked)}
											disabled={submitting}
										/>
										<span>
											I agree to the{" "}
											<button
												type="button"
												className="login-link login-link-button"
												onClick={() => setLegalModal("terms")}
											>
												Terms of Service
											</button>
											,{" "}
											<button
												type="button"
												className="login-link login-link-button"
												onClick={() => setLegalModal("privacy")}
											>
												Privacy Policy
											</button>
											, and{" "}
											<button
												type="button"
												className="login-link login-link-button"
												onClick={() => setLegalModal("aup")}
											>
												Acceptable Use Policy
											</button>
											.
										</span>
									</label>
									{error && (
										<p className="login-alert login-alert-error" role="alert">
											{error}
										</p>
									)}
								</div>

								<footer className="legal-doc-modal-footer policy-acceptance-footer">
									<button
										type="button"
										className="legal-doc-modal-action"
										onClick={() => logout()}
										disabled={submitting}
									>
										Sign out
									</button>
									<button
										type="button"
										className="legal-doc-modal-action legal-doc-modal-action-primary"
										onClick={() => void onAccept()}
										disabled={submitting || !accepted}
									>
										{submitting ? "Saving…" : "Accept and continue"}
									</button>
								</footer>
							</div>
						</div>,
						document.body,
					)
				: null}
			<LegalDocumentModal documentId={legalModal} onClose={() => setLegalModal(null)} />
		</>
	);
}
