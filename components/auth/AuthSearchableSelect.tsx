"use client";

import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type KeyboardEvent,
	type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type AuthSearchableSelectOption = {
	value: string;
	label: string;
	disabled?: boolean;
};

type Props = {
	id?: string;
	label: string;
	hint?: string;
	icon?: ReactNode;
	error?: string;
	value: string;
	onChange: (value: string) => void;
	options: AuthSearchableSelectOption[];
	placeholder?: string;
	searchPlaceholder?: string;
	disabled?: boolean;
	required?: boolean;
	/** Remount/reset search when this changes (e.g. country code). */
	resetKey?: string;
};

function normalizeSearch(value: string) {
	return value
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/['’`]/g, "");
}

function matchesQuery(option: AuthSearchableSelectOption, query: string) {
	const tokens = normalizeSearch(query).split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return true;
	const haystack = normalizeSearch(`${option.label} ${option.value}`);
	return tokens.every((token) => haystack.includes(token));
}

function Chevron({ open }: { open: boolean }) {
	return (
		<svg
			className={`auth-select-chevron${open ? " auth-searchable-chevron-open" : ""}`}
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			aria-hidden
		>
			<path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

export function AuthSearchableSelect({
	id,
	label,
	hint,
	icon,
	error,
	value,
	onChange,
	options,
	placeholder = "Select…",
	searchPlaceholder = "Search…",
	disabled = false,
	required = false,
	resetKey,
}: Props) {
	const autoId = useId();
	const fieldId = id ?? autoId;
	const listboxId = `${fieldId}-listbox`;
	const rootRef = useRef<HTMLDivElement>(null);
	const popoverRef = useRef<HTMLDivElement>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLUListElement>(null);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [highlight, setHighlight] = useState(0);
	const [menuStyle, setMenuStyle] = useState<CSSProperties | undefined>();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	// Country swap or disable must clear open search state.
	useEffect(() => {
		setOpen(false);
		setQuery("");
		setHighlight(0);
	}, [resetKey]);

	useEffect(() => {
		if (!disabled) return;
		setOpen(false);
		setQuery("");
		setHighlight(0);
	}, [disabled]);

	const selected = useMemo(
		() => options.find((o) => o.value === value),
		[options, value],
	);

	const filtered = useMemo(
		() => options.filter((option) => matchesQuery(option, query)),
		[options, query],
	);

	const enabled = useMemo(
		() => filtered.filter((o) => !o.disabled),
		[filtered],
	);

	const placeMenu = useCallback(() => {
		const el = rootRef.current?.querySelector(
			".auth-searchable-trigger",
		) as HTMLElement | null;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const menuMax = 280;
		const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - 8);
		const spaceAbove = Math.max(0, rect.top - 8);
		const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
		const available = openUp ? spaceAbove : spaceBelow;
		const maxHeight = Math.min(menuMax, Math.max(available, 160));
		setMenuStyle({
			position: "fixed",
			left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
			width: rect.width,
			maxHeight,
			zIndex: 10000,
			...(openUp
				? { bottom: window.innerHeight - rect.top + 6, top: "auto" }
				: { top: rect.bottom + 6, bottom: "auto" }),
		});
	}, []);

	const focusSearch = useCallback(() => {
		const input = searchRef.current;
		if (!input || document.activeElement === input) return;
		input.focus({ preventScroll: true });
	}, []);

	useLayoutEffect(() => {
		if (!open) return;
		placeMenu();
		focusSearch();
	}, [open, placeMenu, focusSearch]);

	useEffect(() => {
		if (!open) return;

		const onDocDown = (e: Event) => {
			const path = e.composedPath();
			if (rootRef.current && path.includes(rootRef.current)) return;
			if (popoverRef.current && path.includes(popoverRef.current)) return;
			setOpen(false);
		};

		const onReposition = (e: Event) => {
			if (popoverRef.current && e.composedPath().includes(popoverRef.current)) return;
			placeMenu();
		};

		const list = listRef.current;
		const onWheel = (e: WheelEvent) => {
			if (!list) return;
			const max = list.scrollHeight - list.clientHeight;
			if (max <= 0) return;
			e.preventDefault();
			e.stopPropagation();
			list.scrollTop = Math.min(max, Math.max(0, list.scrollTop + e.deltaY));
		};

		document.addEventListener("pointerdown", onDocDown, true);
		window.addEventListener("resize", onReposition);
		window.addEventListener("scroll", onReposition, true);
		list?.addEventListener("wheel", onWheel, { passive: false });

		return () => {
			document.removeEventListener("pointerdown", onDocDown, true);
			window.removeEventListener("resize", onReposition);
			window.removeEventListener("scroll", onReposition, true);
			list?.removeEventListener("wheel", onWheel);
		};
	}, [open, mounted, placeMenu]);

	useEffect(() => {
		if (!open) return;
		if (listRef.current) listRef.current.scrollTop = 0;
	}, [open, query]);

	const pick = (next: string) => {
		onChange(next);
		setQuery("");
		setHighlight(0);
		setOpen(false);
	};

	const openMenu = () => {
		if (disabled) return;
		const trigger = rootRef.current?.querySelector(".auth-searchable-trigger");
		if (trigger instanceof HTMLElement) {
			const rect = trigger.getBoundingClientRect();
			const spaceBelow = window.innerHeight - rect.bottom;
			const spaceAbove = rect.top;
			if (spaceBelow < 240 && spaceAbove < 240) {
				trigger.scrollIntoView({ block: "center", inline: "nearest" });
			}
		}
		setQuery("");
		setHighlight(0);
		setOpen(true);
	};

	const toggleMenu = () => {
		if (disabled) return;
		if (open) {
			setOpen(false);
			return;
		}
		openMenu();
	};

	const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
		if (disabled) return;
		if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			openMenu();
			return;
		}
		if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
			e.preventDefault();
			setQuery(e.key);
			setHighlight(0);
			setOpen(true);
		}
	};

	const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Escape") {
			e.preventDefault();
			setOpen(false);
			return;
		}
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setHighlight((h) => Math.min(h + 1, Math.max(enabled.length - 1, 0)));
			return;
		}
		if (e.key === "ArrowUp") {
			e.preventDefault();
			setHighlight((h) => Math.max(h - 1, 0));
			return;
		}
		if (e.key === "Enter") {
			e.preventDefault();
			e.stopPropagation();
			const opt = enabled[highlight];
			if (opt) pick(opt.value);
		}
	};

	const triggerLabel = selected?.label ?? placeholder;
	const isPlaceholder = !selected;

	const popover =
		open && mounted
			? createPortal(
					<div
						ref={popoverRef}
						className="auth-searchable-popover"
						role="presentation"
						style={menuStyle}
						onMouseDown={(e) => {
							e.stopPropagation();
						}}
					>
						<div className="auth-searchable-search">
							<input
								ref={searchRef}
								type="text"
								className="auth-searchable-search-input"
								placeholder={searchPlaceholder}
								value={query}
								onChange={(e) => {
									setQuery(e.target.value);
									setHighlight(0);
								}}
								onKeyDown={onSearchKeyDown}
								onMouseDown={(e) => e.stopPropagation()}
								autoFocus
								autoComplete="off"
								autoCorrect="off"
								spellCheck={false}
								aria-label={searchPlaceholder}
								aria-controls={listboxId}
								aria-autocomplete="list"
								role="searchbox"
							/>
						</div>
						<div className="auth-searchable-list-shell">
							<ul
								ref={listRef}
								id={listboxId}
								className="auth-searchable-list"
								role="listbox"
								aria-label={label}
							>
								{filtered.length === 0 ? (
									<li className="auth-searchable-empty">No matches</li>
								) : (
									filtered.map((opt) => {
										const enabledIndex = enabled.findIndex(
											(o) => o.value === opt.value,
										);
										const active = opt.value === value;
										const highlighted =
											enabledIndex === highlight && !opt.disabled;
										return (
											<li
												key={opt.value}
												role="option"
												aria-selected={active}
												aria-disabled={opt.disabled || undefined}
											>
												<button
													type="button"
													tabIndex={-1}
													disabled={opt.disabled}
													className={[
														"auth-searchable-option",
														active ? "auth-searchable-option-active" : "",
														highlighted
															? "auth-searchable-option-highlight"
															: "",
													]
														.filter(Boolean)
														.join(" ")}
													onMouseEnter={() => {
														if (!opt.disabled && enabledIndex >= 0) {
															setHighlight(enabledIndex);
														}
													}}
													onMouseDown={(e) => {
														e.preventDefault();
														e.stopPropagation();
														if (!opt.disabled) pick(opt.value);
													}}
												>
													{opt.label}
												</button>
											</li>
										);
									})
								)}
							</ul>
						</div>
					</div>,
					document.body,
				)
			: null;

	return (
		<div
			ref={rootRef}
			className={`auth-field auth-searchable-select${error ? " auth-field-error" : ""}${
				disabled ? " auth-searchable-select-disabled" : ""
			}${open ? " auth-searchable-select-open" : ""}`}
		>
			<label className="auth-field-label" htmlFor={fieldId}>
				{label}
				{hint && <span className="auth-field-hint">{hint}</span>}
			</label>
			<div className="auth-field-control auth-field-control-select">
				{icon && (
					<span className="auth-field-icon" aria-hidden>
						{icon}
					</span>
				)}
				<button
					type="button"
					id={fieldId}
					className={`auth-input auth-select auth-searchable-trigger${
						isPlaceholder ? " auth-select-placeholder" : ""
					}`}
					disabled={disabled}
					aria-haspopup="listbox"
					aria-expanded={open}
					aria-controls={listboxId}
					aria-required={required || undefined}
					onClick={toggleMenu}
					onKeyDown={onTriggerKeyDown}
				>
					<span className="auth-searchable-value">{triggerLabel}</span>
				</button>
				<Chevron open={open} />
			</div>
			{popover}
			{error && <p className="auth-field-error-text">{error}</p>}
		</div>
	);
}
