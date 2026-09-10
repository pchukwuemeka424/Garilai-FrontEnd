"use client";

import Link from "next/link";
import { useState } from "react";

import { AuthField } from "@/components/auth/AuthField";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { apiUrl } from "@/lib/api";

export function ForgotPasswordScreen() {
	const [email, setEmail] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitting(true);
		setError(null);
		setMessage(null);
		setDevResetUrl(null);
		try {
			const res = await fetch(apiUrl("/api/auth/forgot-password"), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email }),
			});
			const data = (await res.json()) as {
				message?: string;
				devResetUrl?: string;
				error?: string;
			};
			if (!res.ok) throw new Error(data.error ?? "Unable to send reset email.");
			setMessage(data.message ?? "Check your email for reset instructions.");
			if (data.devResetUrl) setDevResetUrl(data.devResetUrl);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<AuthSplitLayout
			title="Forgot password"
			subtitle="Enter your account email and we’ll send a reset link."
			footer={
				<p>
					Remembered it?{" "}
					<Link href="/login" className="login-link">
						Back to sign in
					</Link>
				</p>
			}
		>
			<form className="login-form" onSubmit={handleSubmit} noValidate>
				<div className="login-form-fields">
					<AuthField
						id="forgot-email"
						label="Email"
						type="email"
						placeholder="name@university.edu"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						autoComplete="email"
						required
					/>
				</div>

				{error && (
					<div className="login-alert login-alert-error" role="alert">
						{error}
					</div>
				)}

				{message && (
					<div className="login-alert login-alert-success" role="status">
						{message}
						{devResetUrl ? (
							<p className="login-dev-reset">
								Local development: email is not configured.{" "}
								<a href={devResetUrl} className="login-link">
									Open reset link
								</a>
							</p>
						) : null}
					</div>
				)}

				<button type="submit" className="login-btn" disabled={submitting}>
					{submitting ? "Sending…" : "Send reset link"}
				</button>
			</form>
		</AuthSplitLayout>
	);
}
