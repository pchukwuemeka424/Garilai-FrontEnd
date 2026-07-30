"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { studentHasResearchTokens } from "@/components/StudentTokenQuota";
import { useAuth } from "@/hooks/useAuth";
import { researchTokenAllowance } from "@/lib/student-tokens";

const DISMISS_KEY_PREFIX = "garil:token-exhausted-dismissed:";

export const TOKEN_EXHAUSTED_TITLE = "Research token allowance exhausted";

export const TOKEN_EXHAUSTED_MESSAGE =
	"Your allocated research tokens have been fully used, so AI-powered research features are temporarily unavailable. Please contact your university administrator or IT support to request a token reset. Once your allowance has been restored, you may continue using research tools without interruption.";

export const TOKEN_EXHAUSTED_SHORT =
	"Your research tokens are exhausted. Please contact your university to request a reset.";

type Props = {
	/** When true, show immediately even if previously dismissed this session. */
	force?: boolean;
	onDismiss?: () => void;
};

function dismissStorageKey(userId: string): string {
	return `${DISMISS_KEY_PREFIX}${userId}`;
}

export function TokenExhaustedModal({ force = false, onDismiss }: Props) {
	const { user } = useAuth();
	const titleId = useId();
	const descId = useId();
	const okRef = useRef<HTMLButtonElement>(null);
	const [mounted, setMounted] = useState(false);
	const [open, setOpen] = useState(false);

	const hasQuota =
		Boolean(user?.tokenQuota) || researchTokenAllowance(user?.role) != null;
	const depleted =
		Boolean(user) &&
		hasQuota &&
		!studentHasResearchTokens(user?.tokenQuota, user?.role);

	const handleDismiss = useCallback(() => {
		if (user) {
			try {
				sessionStorage.setItem(dismissStorageKey(user.id), "1");
			} catch {
				/* ignore quota / private mode */
			}
		}
		setOpen(false);
		onDismiss?.();
	}, [user, onDismiss]);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!mounted || !user) {
			setOpen(false);
			return;
		}

		if (!depleted) {
			try {
				sessionStorage.removeItem(dismissStorageKey(user.id));
			} catch {
				/* ignore */
			}
			setOpen(false);
			return;
		}

		if (force) {
			setOpen(true);
			return;
		}

		try {
			const dismissed = sessionStorage.getItem(dismissStorageKey(user.id));
			setOpen(dismissed !== "1");
		} catch {
			setOpen(true);
		}
	}, [mounted, user, depleted, force]);

	useEffect(() => {
		if (!open) return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") handleDismiss();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [open, handleDismiss]);

	useEffect(() => {
		if (open) okRef.current?.focus();
	}, [open]);

	if (!open || !mounted) return null;

	return createPortal(
		<div
			className="modal-backdrop confirm-dialog-backdrop"
			role="presentation"
			onClick={handleDismiss}
		>
			<div
				className="confirm-dialog token-exhausted-dialog"
				role="alertdialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={descId}
				onClick={(e) => e.stopPropagation()}
			>
				<div className="confirm-dialog-icon token-exhausted-icon" aria-hidden>
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path
							d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
							stroke="currentColor"
							strokeWidth="1.75"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</div>

				<h2 id={titleId} className="confirm-dialog-title">
					{TOKEN_EXHAUSTED_TITLE}
				</h2>
				<p id={descId} className="confirm-dialog-description">
					{TOKEN_EXHAUSTED_MESSAGE}
				</p>

				<div className="confirm-dialog-actions">
					<button
						ref={okRef}
						type="button"
						className="primary-btn confirm-dialog-confirm"
						onClick={handleDismiss}
					>
						Understood
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
