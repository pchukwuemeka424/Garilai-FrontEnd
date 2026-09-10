export function NotebookHubIllustration() {
	return (
		<svg
			className="nb-hub-illustration-svg"
			viewBox="0 0 420 280"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden
			focusable="false"
		>
			{/* Base structural boundary / frame */}
			<rect x="20" y="24" width="380" height="232" rx="16" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />

			{/* Subtle grid pattern in workspace background */}
			<g stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3">
				<line x1="20" y1="80" x2="400" y2="80" />
				<line x1="20" y1="136" x2="400" y2="136" />
				<line x1="20" y1="192" x2="400" y2="192" />
				<line x1="140" y1="24" x2="140" y2="256" />
				<line x1="270" y1="24" x2="270" y2="256" />
			</g>

			{/* Left Card: Document / Manuscript preview */}
			<g>
				<rect x="42" y="52" width="124" height="176" rx="8" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
				{/* Document header */}
				<rect x="56" y="68" width="60" height="6" rx="3" fill="#0f172a" />
				<rect x="56" y="80" width="96" height="3" rx="1.5" fill="#94a3b8" />
				{/* Paragraph lines */}
				<rect x="56" y="96" width="96" height="4" rx="2" fill="#e2e8f0" />
				<rect x="56" y="106" width="88" height="4" rx="2" fill="#e2e8f0" />
				<rect x="56" y="116" width="92" height="4" rx="2" fill="#e2e8f0" />
				<rect x="56" y="126" width="70" height="4" rx="2" fill="#e2e8f0" />
				{/* Document callout box */}
				<rect x="56" y="142" width="96" height="42" rx="6" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1" />
				<rect x="66" y="152" width="50" height="4" rx="2" fill="#2563eb" />
				<rect x="66" y="162" width="76" height="3" rx="1.5" fill="#64748b" />
				<rect x="66" y="170" width="64" height="3" rx="1.5" fill="#94a3b8" />
				{/* Footer meta tag */}
				<rect x="56" y="198" width="34" height="14" rx="4" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1" />
				<rect x="62" y="203" width="22" height="4" rx="2" fill="#2563eb" />
			</g>

			{/* Center Card: Analytical Figure & Chart */}
			<g>
				<rect x="182" y="44" width="196" height="114" rx="10" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
				{/* Chart header bar */}
				<rect x="198" y="58" width="84" height="6" rx="3" fill="#0f172a" />
				<rect x="338" y="56" width="26" height="10" rx="3" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1" />
				<rect x="343" y="60" width="16" height="2" rx="1" fill="#059669" />
				{/* Chart axes */}
				<line x1="206" y1="134" x2="362" y2="134" stroke="#cbd5e1" strokeWidth="1.5" />
				<line x1="206" y1="78" x2="206" y2="134" stroke="#cbd5e1" strokeWidth="1.5" />
				{/* Solid bar series */}
				<rect x="220" y="104" width="16" height="30" rx="3" fill="#2563eb" />
				<rect x="244" y="88" width="16" height="46" rx="3" fill="#0f172a" />
				<rect x="268" y="96" width="16" height="38" rx="3" fill="#059669" />
				<rect x="292" y="80" width="16" height="54" rx="3" fill="#2563eb" />
				<rect x="316" y="92" width="16" height="42" rx="3" fill="#64748b" />
				<rect x="340" y="74" width="16" height="60" rx="3" fill="#059669" />
			</g>

			{/* Bottom Right Card: Lab dataset matrix */}
			<g>
				<rect x="182" y="168" width="196" height="68" rx="10" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
				<rect x="198" y="180" width="72" height="5" rx="2.5" fill="#0f172a" />
				{/* Table grid rows */}
				<rect x="198" y="194" width="164" height="16" rx="4" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
				<rect x="206" y="200" width="24" height="4" rx="2" fill="#64748b" />
				<rect x="244" y="200" width="36" height="4" rx="2" fill="#94a3b8" />
				<rect x="296" y="200" width="28" height="4" rx="2" fill="#2563eb" />
				<rect x="338" y="200" width="18" height="4" rx="2" fill="#059669" />
				{/* Row 2 */}
				<rect x="198" y="214" width="164" height="14" rx="4" fill="#ffffff" />
				<rect x="206" y="219" width="28" height="4" rx="2" fill="#94a3b8" />
				<rect x="244" y="219" width="30" height="4" rx="2" fill="#cbd5e1" />
				<rect x="296" y="219" width="32" height="4" rx="2" fill="#94a3b8" />
				<rect x="338" y="219" width="16" height="4" rx="2" fill="#cbd5e1" />
			</g>

			{/* Precision indicator dots */}
			<circle cx="34" cy="38" r="3" fill="#2563eb" />
			<circle cx="44" cy="38" r="3" fill="#e2e8f0" />
			<circle cx="54" cy="38" r="3" fill="#e2e8f0" />
		</svg>
	);
}
