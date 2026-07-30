"use client";

import {
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type KeyboardEvent,
	type ReactNode,
} from "react";

export type AdminSelectOption = {
	value: string;
	label: string;
	disabled?: boolean;
	hint?: string;
};

export type AdminSelectGroup = {
	id: string;
	label: string;
	options: AdminSelectOption[];
};

type Props = {
	id?: string;
	label?: string;
	value: string;
	onChange: (value: string) => void;
	options?: AdminSelectOption[];
	groups?: AdminSelectGroup[];
	placeholder?: string;
	searchPlaceholder?: string;
	disabled?: boolean;
	required?: boolean;
	/** Show search input when option count exceeds this (default 8). Pass 0 to always search. */
	searchThreshold?: number;
	/** Compact trigger for filters / row actions */
	compact?: boolean;
	/** Allow clearing back to empty value */
	clearable?: boolean;
	className?: string;
	"aria-label"?: string;
	span?: boolean;
};

function Chevron({ open }: { open: boolean }) {
	return (
		<svg
			className={`admin-select-chevron${open ? " admin-select-chevron-open" : ""}`}
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

function flattenOptions(
	options: AdminSelectOption[] | undefined,
	groups: AdminSelectGroup[] | undefined,
): AdminSelectOption[] {
	if (groups?.length) return groups.flatMap((g) => g.options);
	return options ?? [];
}

export function AdminSelect({
	id,
	label,
	value,
	onChange,
	options,
	groups,
	placeholder = "Select…",
	searchPlaceholder = "Search…",
	disabled = false,
	required = false,
	searchThreshold = 8,
	compact = false,
	clearable = false,
	className,
	"aria-label": ariaLabel,
	span = false,
}: Props) {
	const autoId = useId();
	const fieldId = id ?? autoId;
	const listboxId = `${fieldId}-listbox`;
	const rootRef = useRef<HTMLDivElement>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [highlight, setHighlight] = useState(0);
	const [menuStyle, setMenuStyle] = useState<CSSProperties | undefined>();

	const allOptions = useMemo(() => flattenOptions(options, groups), [options, groups]);
	const selected = allOptions.find((o) => o.value === value);
	const searchable = allOptions.length >= searchThreshold;

	const filteredGroups = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (groups?.length) {
			return groups
				.map((g) => ({
					...g,
					options: g.options.filter(
						(o) =>
							!q ||
							o.label.toLowerCase().includes(q) ||
							o.value.toLowerCase().includes(q) ||
							(o.hint ?? "").toLowerCase().includes(q),
					),
				}))
				.filter((g) => g.options.length > 0);
		}
		const filtered = (options ?? []).filter(
			(o) =>
				!q ||
				o.label.toLowerCase().includes(q) ||
				o.value.toLowerCase().includes(q) ||
				(o.hint ?? "").toLowerCase().includes(q),
		);
		return filtered.length ? [{ id: "all", label: "", options: filtered }] : [];
	}, [groups, options, query]);

	const flatFiltered = useMemo(
		() => filteredGroups.flatMap((g) => g.options.filter((o) => !o.disabled)),
		[filteredGroups],
	);

	const placeMenu = () => {
		const el = rootRef.current?.querySelector(".admin-select-trigger") as HTMLElement | null;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const spaceBelow = window.innerHeight - rect.bottom;
		const openUp = spaceBelow < 240 && rect.top > spaceBelow;
		const width = Math.max(rect.width, compact ? 192 : rect.width);
		setMenuStyle({
			position: "fixed",
			left: Math.min(rect.left, window.innerWidth - width - 8),
			width,
			...(openUp
				? { bottom: window.innerHeight - rect.top + 6, top: "auto" }
				: { top: rect.bottom + 6, bottom: "auto" }),
		});
	};

	useEffect(() => {
		if (!open) return;
		setQuery("");
		setHighlight(0);
		placeMenu();
		const t = window.setTimeout(() => searchRef.current?.focus(), 0);
		const onDoc = (e: MouseEvent) => {
			if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
		};
		const onReposition = () => placeMenu();
		document.addEventListener("mousedown", onDoc);
		window.addEventListener("resize", onReposition);
		window.addEventListener("scroll", onReposition, true);
		return () => {
			window.clearTimeout(t);
			document.removeEventListener("mousedown", onDoc);
			window.removeEventListener("resize", onReposition);
			window.removeEventListener("scroll", onReposition, true);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- place from open trigger only
	}, [open, compact]);

	const pick = (next: string) => {
		onChange(next);
		setOpen(false);
	};

	const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
		if (disabled) return;
		if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			setOpen(true);
		}
	};

	const onListKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Escape") {
			e.preventDefault();
			setOpen(false);
			return;
		}
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setHighlight((h) => Math.min(h + 1, Math.max(flatFiltered.length - 1, 0)));
			return;
		}
		if (e.key === "ArrowUp") {
			e.preventDefault();
			setHighlight((h) => Math.max(h - 1, 0));
			return;
		}
		if (e.key === "Enter") {
			e.preventDefault();
			const opt = flatFiltered[highlight];
			if (opt) pick(opt.value);
		}
	};

	const triggerLabel = selected?.label ?? placeholder;
	const isPlaceholder = !selected;

	const field: ReactNode = (
		<div
			ref={rootRef}
			className={[
				"admin-select",
				compact ? "admin-select-compact" : "",
				open ? "admin-select-open" : "",
				disabled ? "admin-select-disabled" : "",
				className ?? "",
			]
				.filter(Boolean)
				.join(" ")}
		>
			{label ? (
				<label className="admin-select-label" htmlFor={fieldId}>
					{label}
					{required ? " *" : ""}
				</label>
			) : null}
			<button
				type="button"
				id={fieldId}
				className={`admin-select-trigger${isPlaceholder ? " admin-select-trigger-placeholder" : ""}`}
				disabled={disabled}
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-controls={listboxId}
				aria-label={ariaLabel ?? label}
				aria-required={required || undefined}
				onClick={() => !disabled && setOpen((o) => !o)}
				onKeyDown={onTriggerKeyDown}
			>
				<span className="admin-select-value">{triggerLabel}</span>
				<Chevron open={open} />
			</button>

			{open && (
				<div
					className="admin-select-popover"
					role="presentation"
					style={menuStyle}
					onKeyDown={onListKeyDown}
				>
					{searchable && (
						<div className="admin-select-search">
							<input
								ref={searchRef}
								type="search"
								className="admin-select-search-input"
								placeholder={searchPlaceholder}
								value={query}
								onChange={(e) => {
									setQuery(e.target.value);
									setHighlight(0);
								}}
								aria-label={searchPlaceholder}
							/>
						</div>
					)}
					<ul id={listboxId} className="admin-select-list" role="listbox" aria-label={ariaLabel ?? label}>
						{clearable && value && (
							<li role="option" aria-selected={false}>
								<button
									type="button"
									className="admin-select-option admin-select-option-clear"
									onClick={() => pick("")}
								>
									Clear selection
								</button>
							</li>
						)}
						{filteredGroups.length === 0 ? (
							<li className="admin-select-empty">No matches</li>
						) : (
							filteredGroups.map((group) => (
								<li key={group.id} className="admin-select-group" role="presentation">
									{group.label ? (
										<div className="admin-select-group-label">{group.label}</div>
									) : null}
									<ul className="admin-select-group-list" role="group" aria-label={group.label || undefined}>
										{group.options.map((opt) => {
											const enabledIndex = flatFiltered.findIndex((o) => o.value === opt.value);
											const active = opt.value === value;
											const highlighted = enabledIndex === highlight && !opt.disabled;
											return (
												<li key={opt.value} role="option" aria-selected={active} aria-disabled={opt.disabled}>
													<button
														type="button"
														disabled={opt.disabled}
														className={[
															"admin-select-option",
															active ? "admin-select-option-active" : "",
															highlighted ? "admin-select-option-highlight" : "",
														]
															.filter(Boolean)
															.join(" ")}
														onMouseEnter={() => {
															if (!opt.disabled && enabledIndex >= 0) setHighlight(enabledIndex);
														}}
														onClick={() => {
															if (!opt.disabled) pick(opt.value);
														}}
													>
														<span className="admin-select-option-label">{opt.label}</span>
														{opt.hint ? (
															<span className="admin-select-option-hint">{opt.hint}</span>
														) : null}
													</button>
												</li>
											);
										})}
									</ul>
								</li>
							))
						)}
					</ul>
				</div>
			)}
		</div>
	);

	if (span) {
		return <div className="admin-form-span">{field}</div>;
	}
	return field;
}
