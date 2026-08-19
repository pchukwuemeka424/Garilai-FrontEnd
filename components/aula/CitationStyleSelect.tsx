"use client";

import {
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type KeyboardEvent,
} from "react";

import { CITATION_STYLE_GROUPS, type CitationStyle } from "@/lib/citation-styles";

type Props = {
	id?: string;
	value: CitationStyle | "";
	onChange: (style: CitationStyle | "") => void;
	placeholder?: string;
	searchPlaceholder?: string;
	label?: string;
	hideLabel?: boolean;
};

type StyleOption = {
	id: CitationStyle;
	label: string;
	hint: string;
	groupLabel: string;
};

export function CitationStyleSelect({
	id,
	value,
	onChange,
	placeholder = "Select References style",
	searchPlaceholder = "Search citation styles…",
	label = "Reference style",
	hideLabel = false,
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

	const allOptions = useMemo<StyleOption[]>(
		() =>
			CITATION_STYLE_GROUPS.flatMap((group) =>
				group.styles.map((style) => ({
					...style,
					groupLabel: group.label,
				})),
			),
		[],
	);

	const selected = value ? allOptions.find((style) => style.id === value) : undefined;
	const isPlaceholder = !value;

	const filteredGroups = useMemo(() => {
		const q = query.trim().toLowerCase();
		return CITATION_STYLE_GROUPS.map((group) => ({
			...group,
			styles: group.styles.filter(
				(style) =>
					!q ||
					style.label.toLowerCase().includes(q) ||
					style.id.toLowerCase().includes(q) ||
					style.hint.toLowerCase().includes(q) ||
					group.label.toLowerCase().includes(q),
			),
		})).filter((group) => group.styles.length > 0);
	}, [query]);

	const flatFiltered = useMemo(
		() => filteredGroups.flatMap((group) => group.styles),
		[filteredGroups],
	);

	const placeMenu = () => {
		const el = rootRef.current?.querySelector(".discipline-select-trigger") as HTMLElement | null;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const spaceBelow = window.innerHeight - rect.bottom;
		const openUp = spaceBelow < 320 && rect.top > spaceBelow;
		const width = Math.max(rect.width, 280);
		setMenuStyle({
			position: "fixed",
			zIndex: 1400,
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

	const pick = (next: CitationStyle) => {
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
			if (opt) pick(opt.id);
		}
	};

	const triggerClass = [
		"discipline-select-trigger",
		"ref-style-select",
		"research-form-select",
		"citation-style-select-trigger",
		isPlaceholder ? "research-form-select-placeholder" : "",
		open ? "discipline-select-trigger-open" : "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div ref={rootRef} className="ref-style-select-wrap citation-style-select discipline-select">
			{!hideLabel ? (
				<label className="ref-style-select-label research-field-label" htmlFor={fieldId}>
					{label}
				</label>
			) : null}
			<div className="ref-style-select-inner">
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
					<span className="discipline-select-value">
						{isPlaceholder ? placeholder : selected?.label}
					</span>
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

			{selected?.hint && !open && !hideLabel ? (
				<p className="research-scope-selected-hint">{selected.hint}</p>
			) : null}

			{open && (
				<div
					className="discipline-select-popover citation-style-select-popover"
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
						{filteredGroups.length === 0 ? (
							<li className="discipline-select-empty">No matching citation styles</li>
						) : (
							filteredGroups.map((group) => (
								<li key={group.id} className="discipline-select-group" role="presentation">
									<div className="discipline-select-group-label">{group.label}</div>
									<ul className="discipline-select-group-list" role="group" aria-label={group.label}>
										{group.styles.map((style) => {
											const enabledIndex = flatFiltered.findIndex((opt) => opt.id === style.id);
											const active = style.id === value;
											const highlighted = enabledIndex === highlight;
											return (
												<li key={style.id} role="option" aria-selected={active}>
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
														onMouseEnter={() => {
															if (enabledIndex >= 0) setHighlight(enabledIndex);
														}}
														onClick={() => pick(style.id)}
													>
														<span className="discipline-select-option-label">{style.label}</span>
														<span className="discipline-select-option-hint">{style.hint}</span>
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
}
