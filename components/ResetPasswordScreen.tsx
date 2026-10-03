"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AuthField } from "@/components/auth/AuthField";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { apiUrl } from "@/lib/api";

function ResetPasswordForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const token = searchParams.get("token")?.trim() ?? "";

	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setMessage(null);

		if (!token) {
			setError("This reset link is missing or invalid. Request a new one.");
			return;
		}
		if (password.length < 10 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
			setError("Password must be at least 10 characters and include a letter and a number.");
			return;
		}
		if (password !== confirm) {
			setError("Passwords do not match.");
			return;
		}

		setSubmitting(true);
		try {
			const res = await fetch(apiUrl("/api/auth/reset-password"), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token, password }),
			});
			const data = (await res.json()) as { message?: string; error?: string };
			if (!res.ok) throw new Error(data.error ?? "Unable to reset password.");
			setMessage(data.message ?? "Password updated. You can sign in with your new password.");
			setTimeout(() => router.push("/login"), 1500);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<AuthSplitLayout
			title="Reset password"
			subtitle="Choose a new password for your Garil AI account. You’ll be redirected to sign in when done."
			footer={
				<p>
					<Link href="/forgot-password" className="login-link">
						Request a new reset link
					</Link>
					{" · "}
					<Link href="/login" className="login-link">
						Sign in
					</Link>
				</p>
			}
		>
			{!token ? (
				<div className="login-alert login-alert-error" role="alert">
					This reset link is missing or invalid.{" "}
					<Link href="/forgot-password" className="login-link">
						Request a new one
					</Link>
					.
				</div>
			) : (
				<form className="login-form" onSubmit={handleSubmit} noValidate>
					<div className="login-form-fields">
						<AuthField
							id="reset-password"
							label="New password"
							type="password"
							placeholder="At least 10 characters, with a letter and number"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							autoComplete="new-password"
							required
							minLength={8}
						/>
						<AuthField
							id="reset-password-confirm"
							label="Confirm password"
							type="password"
							placeholder="Re-enter new password"
							value={confirm}
							onChange={(e) => setConfirm(e.target.value)}
							autoComplete="new-password"
							required
							minLength={8}
						/>
					</div>

					{error && (
						<div className="login-alert login-alert-error" role="alert">
							{error}
						</div>
					)}

					{message && (
						<div className="login-alert login-alert-success" role="status">
							{message} Redirecting to sign in…
						</div>
					)}

					<button type="submit" className="login-btn" disabled={submitting || Boolean(message)}>
						{submitting ? "Updating…" : message ? "Password updated" : "Update password"}
					</button>
				</form>
			)}
		</AuthSplitLayout>
	);
}

export function ResetPasswordScreen() {
	return (
		<Suspense
			fallback={
				<AuthSplitLayout title="Reset password" subtitle="Loading…">
					<p className="login-form-note">Loading reset form…</p>
				</AuthSplitLayout>
			}
		>
			<ResetPasswordForm />
		</Suspense>
	);
}
