"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

import { EyeIcon, EyeOffIcon } from "@/components/auth/AuthIcons";

type Props = InputHTMLAttributes<HTMLInputElement> & {
	label: string;
	hint?: string;
	icon?: ReactNode;
	error?: string;
};

export function AuthField({ label, hint, icon, error, id, className, type, ...inputProps }: Props) {
	const generatedId = useId();
	const fieldId = id ?? generatedId;
	const isPassword = type === "password";
	const [visible, setVisible] = useState(false);
	const inputType = isPassword ? (visible ? "text" : "password") : type;

	const inputClassName = [
		"auth-input",
		icon ? "auth-input-with-icon" : null,
		isPassword ? "auth-input-with-toggle" : null,
		className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div className={`auth-field${error ? " auth-field-error" : ""}`}>
			<label className="auth-field-label" htmlFor={fieldId}>
				{label}
				{hint && <span className="auth-field-hint">{hint}</span>}
			</label>
			<div className="auth-field-control">
				{icon && (
					<span className="auth-field-icon" aria-hidden>
						{icon}
					</span>
				)}
				<input id={fieldId} type={inputType} className={inputClassName} {...inputProps} />
				{isPassword ? (
					<button
						type="button"
						className="auth-field-toggle"
						onClick={() => setVisible((v) => !v)}
						aria-label={visible ? "Hide password" : "Show password"}
						aria-pressed={visible}
						tabIndex={-1}
					>
						{visible ? <EyeOffIcon /> : <EyeIcon />}
					</button>
				) : null}
			</div>
			{error && <p className="auth-field-error-text">{error}</p>}
		</div>
	);
}
