"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

type SharedProps = {
	label?: string;
	hint?: string;
	error?: string;
	span?: boolean;
	compact?: boolean;
	className?: string;
	leading?: ReactNode;
};

type InputProps = SharedProps &
	Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
		multiline?: false;
	};

type TextareaProps = SharedProps &
	Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
		multiline: true;
	};

export type AdminInputProps = InputProps | TextareaProps;

export function AdminInput(props: AdminInputProps) {
	const autoId = useId();
	const {
		label,
		hint,
		error,
		span = false,
		compact = false,
		className,
		leading,
		id,
		disabled,
		...rest
	} = props;
	const fieldId = id ?? autoId;

	const control = props.multiline ? (
		<textarea
			id={fieldId}
			disabled={disabled}
			className={[
				"admin-input",
				"admin-input-textarea",
				compact ? "admin-input-compact" : "",
				error ? "admin-input-invalid" : "",
				leading ? "admin-input-with-leading" : "",
			]
				.filter(Boolean)
				.join(" ")}
			{...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
		/>
	) : (
		<input
			id={fieldId}
			disabled={disabled}
			className={[
				"admin-input",
				compact ? "admin-input-compact" : "",
				error ? "admin-input-invalid" : "",
				leading ? "admin-input-with-leading" : "",
			]
				.filter(Boolean)
				.join(" ")}
			{...(rest as InputHTMLAttributes<HTMLInputElement>)}
		/>
	);

	const field = (
		<div
			className={[
				"admin-field",
				compact ? "admin-field-compact" : "",
				disabled ? "admin-field-disabled" : "",
				error ? "admin-field-error" : "",
				className ?? "",
			]
				.filter(Boolean)
				.join(" ")}
		>
			{label ? (
				<label className="admin-field-label" htmlFor={fieldId}>
					{label}
					{props.required ? " *" : ""}
				</label>
			) : null}
			<div className={`admin-input-wrap${leading ? " admin-input-wrap-leading" : ""}`}>
				{leading ? (
					<span className="admin-input-leading" aria-hidden>
						{leading}
					</span>
				) : null}
				{control}
			</div>
			{hint && !error ? <p className="admin-field-hint">{hint}</p> : null}
			{error ? <p className="admin-field-error-text">{error}</p> : null}
		</div>
	);

	if (span) return <div className="admin-form-span">{field}</div>;
	return field;
}
