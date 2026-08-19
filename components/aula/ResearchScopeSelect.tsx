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

import { SCOPE_OPTIONS, type ResearchScope } from "@/lib/research-ideas";

type Props = {
	id?: string;
	value: ResearchScope | "";
	onChange: (scope: ResearchScope | "") => void;
	label?: string;
	labelIcon?: ReactNode;
	hint?: string;
	placeholder?: string;
	searchPlaceholder?: string;
	wrapClassName?: string;
	selectClassName?: string;
};

export function ResearchScopeSelect({
	id,
	value,
	onChange,
	label = "Research Type",
	labelIcon,
	hint = "Select the output type that best matches your project.",
	placeholder = "Select research type",
	searchPlaceholder = "Search research types…",
	wrapClassName,
	selectClassName,
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

	const selected = value ? SCOPE_OPTIONS.find((opt) => opt.id === value) : undefined;
	const isPlaceholder = !value;

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return SCOPE_OPTIONS.filter(
			(opt) =>
				!q ||
				opt.label.toLowerCase().includes(q) ||
				opt.id.toLowerCase().includes(q) ||
				opt.hint.toLowerCase().includes(q),
		);
	}, [query]);

	const placeMenu = () => {
		const el = rootRef.current?.querySelector(".discipline-select-trigger") as HTMLElement | null;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const spaceBelow = window.innerHeight - rect.bottom;
		const openUp = spaceBelow < 280 && rect.top > spaceBelow;
		const width = Math.max(rect.width, 240);
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
	}, [open]);

	const pick = (next: ResearchScope) => {
		onChange(next);
		setOpen(false);
	};

	const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
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
			setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
			return;
		}
		if (e.key === "ArrowUp") {
			e.preventDefault();
			setHighlight((h) => Math.max(h - 1, 0));
			return;
		}
		if (e.key === "Enter") {
			e.preventDefault();
			const opt = filtered[highlight];
			if (opt) pick(opt.id);
		}
	};

	const triggerClass = [
		"discipline-select-trigger",
		"ref-style-select",
		selectClassName ?? "",
		labelIcon ? "research-form-select-with-icon" : "",
		isPlaceholder ? "research-form-select-placeholder" : "",
		open ? "discipline-select-trigger-open" : "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div
			ref={rootRef}
			className={
				wrapClassName
					? `ref-source-select-wrap discipline-select ${wrapClassName}`
					: "ref-source-select-wrap discipline-select"
			}
		>
			<label className="research-field-label research-field-label-row" htmlFor={fieldId}>
				{labelIcon && <span className="research-field-icon research-field-icon-violet">{labelIcon}</span>}
				<span>{label}</span>
			</label>
			{hint && <p className="research-input-hint">{hint}</p>}
			<div className={labelIcon ? "ref-style-select-inner research-select-icon-wrap" : "ref-style-select-inner"}>
				{labelIcon && (
					<span className="research-select-leading-icon research-select-leading-icon-violet" aria-hidden>
						{labelIcon}
					</span>
				)}
				<button
					type="button"
					id={fieldId}
					className={triggerClass}
					aria-haspopup="listbox"
					aria-expanded={open}
					aria-controls={listboxId}
					onClick={() => setOpen((o) => !o)}
					onKeyDown={onTriggerKeyDown}
				>
					<span className="discipline-select-value">{isPlaceholder ? placeholder : selected?.label}</span>
					<svg
						className={`ref-style-select-chevron${open ? " discipline-select-chevron-open" : ""}`}
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
				</button>
			</div>

			{open && (
				<div
					className="discipline-select-popover"
					role="presentation"
					style={menuStyle}
					onKeyDown={onListKeyDown}
				>
					<div className="discipline-select-search">
						<svg
							className="discipline-select-search-icon"
							width="15"
							height="15"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							aria-hidden
						>
							<circle cx="11" cy="11" r="7" />
							<path d="m20 20-3.5-3.5" strokeLinecap="round" />
						</svg>
						<input
							ref={searchRef}
							type="search"
							className="discipline-select-search-input"
							placeholder={searchPlaceholder}
							value={query}
							onChange={(e) => {
								setQuery(e.target.value);
								setHighlight(0);
							}}
							aria-label={searchPlaceholder}
							autoComplete="off"
						/>
					</div>
					<ul id={listboxId} className="discipline-select-list" role="listbox" aria-label={label}>
						{filtered.length === 0 ? (
							<li className="discipline-select-empty">No matching scopes</li>
						) : (
							filtered.map((opt, index) => {
								const active = opt.id === value;
								const highlighted = index === highlight;
								return (
									<li key={opt.id} role="option" aria-selected={active}>
										<button
											type="button"
											className={[
												"discipline-select-option",
												"discipline-select-option-with-hint",
												active ? "discipline-select-option-active" : "",
												highlighted ? "discipline-select-option-highlight" : "",
											]
												.filter(Boolean)
												.join(" ")}
											onMouseEnter={() => setHighlight(index)}
											onClick={() => pick(opt.id)}
										>
											<span className="discipline-select-option-label">{opt.label}</span>
											<span className="discipline-select-option-hint">{opt.hint}</span>
										</button>
									</li>
								);
							})
						)}
					</ul>
				</div>
			)}

			{selected && <p className="research-scope-selected-hint">{selected.hint}</p>}
		</div>
	);
}
