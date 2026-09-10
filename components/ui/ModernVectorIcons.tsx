import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
	size?: number;
};

/**
 * Modern colored vector icon: Research Assistant (Electric Blue & Indigo Gradient)
 */
export function VectorResearchIcon({ size = 48, className, ...props }: IconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 48 48"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			aria-hidden
			{...props}
		>
			<defs>
				<linearGradient id="vr-bg" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
					<stop stopColor="#3B82F6" />
					<stop offset="1" stopColor="#1D4ED8" />
				</linearGradient>
				<linearGradient id="vr-accent" x1="16" y1="12" x2="36" y2="32" gradientUnits="userSpaceOnUse">
					<stop stopColor="#93C5FD" />
					<stop offset="1" stopColor="#60A5FA" />
				</linearGradient>
				<filter id="vr-glow" x="0" y="0" width="48" height="48" filterUnits="userSpaceOnUse">
					<feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#2563EB" floodOpacity="0.28" />
				</filter>
			</defs>

			{/* Background rounded squircle */}
			<rect x="4" y="4" width="40" height="40" rx="12" fill="url(#vr-bg)" filter="url(#vr-glow)" />

			{/* Microscope base & arm */}
			<path
				d="M14 36H34M24 36V28M24 28C28.4183 28 32 24.4183 32 20C32 15.5817 28.4183 12 24 12"
				stroke="#EFF6FF"
				strokeWidth="2.5"
				strokeLinecap="round"
			/>
			{/* Lens tube */}
			<path
				d="M18 12L25 19L21 23L14 16L18 12Z"
				fill="url(#vr-accent)"
				stroke="#EFF6FF"
				strokeWidth="2"
				strokeLinejoin="round"
			/>
			{/* Top eyepiece */}
			<path d="M15 9L19 13" stroke="#EFF6FF" strokeWidth="2.5" strokeLinecap="round" />
			{/* Lens focus beam / Sparkle */}
			<circle cx="28" cy="18" r="2.2" fill="#FFFFFF" />
			<path
				d="M34 10L35 12L37 13L35 14L34 16L33 14L31 13L33 12L34 10Z"
				fill="#FDE047"
			/>
		</svg>
	);
}

/**
 * Modern colored vector icon: Research Notebook (Teal & Emerald Gradient)
 */
export function VectorNotebookIcon({ size = 48, className, ...props }: IconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 48 48"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			aria-hidden
			{...props}
		>
			<defs>
				<linearGradient id="vn-bg" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
					<stop stopColor="#14B8A6" />
					<stop offset="1" stopColor="#0F766E" />
				</linearGradient>
				<linearGradient id="vn-page" x1="12" y1="10" x2="36" y2="38" gradientUnits="userSpaceOnUse">
					<stop stopColor="#FFFFFF" />
					<stop offset="1" stopColor="#CCFBF1" />
				</linearGradient>
				<filter id="vn-glow" x="0" y="0" width="48" height="48" filterUnits="userSpaceOnUse">
					<feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0D9488" floodOpacity="0.28" />
				</filter>
			</defs>

			{/* Background squircle */}
			<rect x="4" y="4" width="40" height="40" rx="12" fill="url(#vn-bg)" filter="url(#vn-glow)" />

			{/* Notebook book body */}
			<rect x="13" y="11" width="22" height="26" rx="3.5" fill="url(#vn-page)" />
			{/* Binder spine & rings */}
			<path d="M17 11V37" stroke="#0D9488" strokeWidth="2" strokeDasharray="1 3" />
			{/* Text lines */}
			<path d="M21 17H30" stroke="#0F766E" strokeWidth="2" strokeLinecap="round" />
			<path d="M21 22H28" stroke="#0F766E" strokeWidth="2" strokeLinecap="round" />
			{/* Bar chart inside notebook */}
			<rect x="21" y="29" width="2.5" height="4" rx="0.8" fill="#14B8A6" />
			<rect x="25" y="26" width="2.5" height="7" rx="0.8" fill="#0D9488" />
			<rect x="29" y="27.5" width="2.5" height="5.5" rx="0.8" fill="#5EEAD4" />
			{/* Decorative star sparkle */}
			<path
				d="M35 8L36 10L38 11L36 12L35 14L34 12L32 11L34 10L35 8Z"
				fill="#FDE047"
			/>
		</svg>
	);
}

/**
 * Modern colored vector icon: Supervision Assistant (Violet & Royal Purple Gradient)
 */
export function VectorSupervisionIcon({ size = 48, className, ...props }: IconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 48 48"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			aria-hidden
			{...props}
		>
			<defs>
				<linearGradient id="vs-bg" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
					<stop stopColor="#8B5CF6" />
					<stop offset="1" stopColor="#6D28D9" />
				</linearGradient>
				<linearGradient id="vs-cap" x1="14" y1="14" x2="34" y2="30" gradientUnits="userSpaceOnUse">
					<stop stopColor="#EDE9FE" />
					<stop offset="1" stopColor="#DDD6FE" />
				</linearGradient>
				<filter id="vs-glow" x="0" y="0" width="48" height="48" filterUnits="userSpaceOnUse">
					<feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#7C3AED" floodOpacity="0.28" />
				</filter>
			</defs>

			{/* Background squircle */}
			<rect x="4" y="4" width="40" height="40" rx="12" fill="url(#vs-bg)" filter="url(#vs-glow)" />

			{/* Graduation Cap Diamond */}
			<path
				d="M24 13L36 19L24 25L12 19L24 13Z"
				fill="url(#vs-cap)"
				stroke="#FFFFFF"
				strokeWidth="1.5"
				strokeLinejoin="round"
			/>
			{/* Cap Skull base */}
			<path
				d="M17 22.5V28C17 28 19.5 31 24 31C28.5 31 31 28 31 28V22.5"
				stroke="#FFFFFF"
				strokeWidth="2"
				strokeLinecap="round"
			/>
			{/* Tassel */}
			<path d="M32 20.5V27M32 27L33.5 29M32 27L30.5 29" stroke="#FDE047" strokeWidth="2" strokeLinecap="round" />
			{/* Verification check bubble */}
			<circle cx="33" cy="33" r="5" fill="#10B981" />
			<path d="M31 33L32.5 34.5L35.5 31.5" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

/**
 * Modern colored vector icon: Analytics & Metrics (Pink & Rose Gradient)
 */
export function VectorAnalyticsIcon({ size = 48, className, ...props }: IconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 48 48"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			aria-hidden
			{...props}
		>
			<defs>
				<linearGradient id="va-bg" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
					<stop stopColor="#EC4899" />
					<stop offset="1" stopColor="#BE185D" />
				</linearGradient>
				<filter id="va-glow" x="0" y="0" width="48" height="48" filterUnits="userSpaceOnUse">
					<feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#DB2777" floodOpacity="0.28" />
				</filter>
			</defs>

			<rect x="4" y="4" width="40" height="40" rx="12" fill="url(#va-bg)" filter="url(#va-glow)" />

			{/* Chart columns */}
			<rect x="13" y="27" width="4.5" height="9" rx="1.5" fill="#FCE7F3" />
			<rect x="20" y="21" width="4.5" height="15" rx="1.5" fill="#FFFFFF" />
			<rect x="27" y="16" width="4.5" height="20" rx="1.5" fill="#FCE7F3" />
			<rect x="34" y="23" width="4.5" height="13" rx="1.5" fill="#FBCFE8" />

			{/* Growth curve line */}
			<path
				d="M13 25L21 18L28 13L36 19"
				stroke="#FDE047"
				strokeWidth="2.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<circle cx="28" cy="13" r="2" fill="#FFFFFF" stroke="#FDE047" strokeWidth="1.5" />
		</svg>
	);
}

/**
 * Modern colored vector icon: Citations & Bibliography (Amber & Gold Gradient)
 */
export function VectorCitationsIcon({ size = 48, className, ...props }: IconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 48 48"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			aria-hidden
			{...props}
		>
			<defs>
				<linearGradient id="vc-bg" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
					<stop stopColor="#F59E0B" />
					<stop offset="1" stopColor="#D97706" />
				</linearGradient>
				<filter id="vc-glow" x="0" y="0" width="48" height="48" filterUnits="userSpaceOnUse">
					<feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#D97706" floodOpacity="0.28" />
				</filter>
			</defs>

			<rect x="4" y="4" width="40" height="40" rx="12" fill="url(#vc-bg)" filter="url(#vc-glow)" />

			{/* Quotation mark 1 */}
			<path
				d="M16 26C16 22 18 19 21 17L22.5 19C20.5 20.2 19.5 21.8 19.5 23.5H22.5V29H16V26Z"
				fill="#FFFFFF"
			/>
			{/* Quotation mark 2 */}
			<path
				d="M26 26C26 22 28 19 31 17L32.5 19C30.5 20.2 29.5 21.8 29.5 23.5H32.5V29H26V26Z"
				fill="#FFFFFF"
			/>
			{/* Institutional badge tick */}
			<circle cx="34" cy="14" r="3.5" fill="#10B981" />
			<path d="M32.5 14L33.5 15L35.5 13" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
		</svg>
	);
}

/**
 * Modern colored vector icon: AI Spark Prism (Multi-color vibrant star)
 */
export function VectorAiSparkIcon({ size = 48, className, ...props }: IconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 48 48"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			aria-hidden
			{...props}
		>
			<defs>
				<linearGradient id="vp-bg" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
					<stop stopColor="#6366F1" />
					<stop offset="0.5" stopColor="#EC4899" />
					<stop offset="1" stopColor="#F59E0B" />
				</linearGradient>
				<filter id="vp-glow" x="0" y="0" width="48" height="48" filterUnits="userSpaceOnUse">
					<feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#8B5CF6" floodOpacity="0.32" />
				</filter>
			</defs>

			<rect x="4" y="4" width="40" height="40" rx="12" fill="url(#vp-bg)" filter="url(#vp-glow)" />

			{/* Primary 4-pointed Star */}
			<path
				d="M24 10C24 17.5 17.5 24 10 24C17.5 24 24 30.5 24 38C24 30.5 30.5 24 38 24C30.5 24 24 17.5 24 10Z"
				fill="#FFFFFF"
			/>
			{/* Secondary small star */}
			<path
				d="M34 11C34 13.5 32 15 30 15C32 15 34 16.5 34 19C34 16.5 36 15 38 15C36 15 34 13.5 34 11Z"
				fill="#FDE047"
			/>
		</svg>
	);
}
