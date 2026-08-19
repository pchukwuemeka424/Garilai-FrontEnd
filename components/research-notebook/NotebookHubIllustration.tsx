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
			<defs>
				<linearGradient id="nbHubSky" x1="60" y1="20" x2="380" y2="260" gradientUnits="userSpaceOnUse">
					<stop stopColor="#dbeafe" />
					<stop offset="1" stopColor="#bfdbfe" stopOpacity="0.35" />
				</linearGradient>
				<linearGradient id="nbHubPageL" x1="40" y1="120" x2="200" y2="250" gradientUnits="userSpaceOnUse">
					<stop stopColor="#ffffff" />
					<stop offset="1" stopColor="#e0edff" />
				</linearGradient>
				<linearGradient id="nbHubPageR" x1="200" y1="110" x2="360" y2="250" gradientUnits="userSpaceOnUse">
					<stop stopColor="#f8fbff" />
					<stop offset="1" stopColor="#c7ddfb" />
				</linearGradient>
				<linearGradient id="nbHubDoc" x1="250" y1="18" x2="360" y2="200" gradientUnits="userSpaceOnUse">
					<stop stopColor="#ffffff" />
					<stop offset="1" stopColor="#d7e8ff" />
				</linearGradient>
				<linearGradient id="nbHubBlock" x1="300" y1="150" x2="390" y2="240" gradientUnits="userSpaceOnUse">
					<stop stopColor="#cfe3ff" />
					<stop offset="0.6" stopColor="#93c5fd" />
					<stop offset="1" stopColor="#60a5fa" />
				</linearGradient>
				<filter id="nbHubSoft" x="-20%" y="-20%" width="140%" height="140%">
					<feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#93c5fd" floodOpacity="0.35" />
				</filter>
			</defs>

			<ellipse cx="210" cy="248" rx="148" ry="18" fill="#93c5fd" opacity="0.22" />
			<circle cx="318" cy="58" r="52" fill="#bfdbfe" opacity="0.45" />
			<circle cx="78" cy="72" r="28" fill="#dbeafe" opacity="0.7" />
			<circle cx="388" cy="168" r="22" fill="#bfdbfe" opacity="0.5" />

			<g filter="url(#nbHubSoft)">
				<path
					d="M248 42c0-8 6.5-14.5 14.5-14.5H338c9 0 16.5 7.4 16.5 16.5v148c0 9-7.5 16.5-16.5 16.5h-75.5c-8 0-14.5-6.5-14.5-14.5V42Z"
					fill="url(#nbHubDoc)"
					stroke="#93c5fd"
					strokeWidth="1.5"
				/>
				<circle cx="306" cy="78" r="22" fill="#eff6ff" stroke="#7dd3fc" strokeWidth="8" />
				<circle cx="306" cy="78" r="22" stroke="#3b82f6" strokeWidth="8" strokeDasharray="42 90" strokeLinecap="round" />
				<rect x="268" y="118" width="76" height="7" rx="3.5" fill="#bfdbfe" />
				<rect x="268" y="132" width="62" height="7" rx="3.5" fill="#dbeafe" />
				<rect x="268" y="146" width="70" height="7" rx="3.5" fill="#bfdbfe" />
				<rect x="268" y="160" width="48" height="7" rx="3.5" fill="#dbeafe" />
			</g>

			<g opacity="0.95">
				<rect x="328" y="168" width="58" height="46" rx="10" fill="url(#nbHubBlock)" />
				<rect x="336" y="178" width="42" height="6" rx="3" fill="#eff6ff" opacity="0.85" />
				<rect x="336" y="190" width="28" height="6" rx="3" fill="#eff6ff" opacity="0.65" />
				<rect x="302" y="198" width="44" height="36" rx="9" fill="#93c5fd" opacity="0.55" />
			</g>

			<g filter="url(#nbHubSoft)">
				<path
					d="M48 128c0-8 7-14 16-14h128c4 0 8 2 10 6l8 14v86c0 10-8 18-18 18H64c-9 0-16-7-16-16v-94Z"
					fill="url(#nbHubPageL)"
					stroke="#93c5fd"
					strokeWidth="1.6"
				/>
				<path
					d="M210 134c2-4 6-6 10-6h128c9 0 16 6 16 14v94c0 9-7 16-16 16H220c-10 0-18-8-18-18v-86l8-14Z"
					fill="url(#nbHubPageR)"
					stroke="#7dd3fc"
					strokeWidth="1.6"
				/>
				<path
					d="M202 126c8 10 8 28 0 108"
					stroke="#60a5fa"
					strokeWidth="3"
					strokeLinecap="round"
					opacity="0.55"
				/>
				<rect x="72" y="148" width="86" height="6" rx="3" fill="#93c5fd" opacity="0.55" />
				<rect x="72" y="164" width="72" height="6" rx="3" fill="#bfdbfe" />
				<rect x="72" y="180" width="80" height="6" rx="3" fill="#93c5fd" opacity="0.45" />
				<rect x="72" y="196" width="58" height="6" rx="3" fill="#dbeafe" />
				<rect x="232" y="156" width="90" height="6" rx="3" fill="#60a5fa" opacity="0.35" />
				<rect x="232" y="172" width="76" height="6" rx="3" fill="#93c5fd" opacity="0.4" />
				<rect x="232" y="188" width="84" height="6" rx="3" fill="#bfdbfe" />
			</g>

			<g fill="#93c5fd">
				<path d="M86 46l3.2 8.2L98 57.4l-8.2 3.2L86 69l-3.2-8.4L74.6 57.4l8.2-3.2L86 46Z" />
				<path d="M196 28l2.4 6.2L205 36.6l-6.2 2.4L196 45l-2.4-6L187.4 36.6l6.2-2.4L196 28Z" opacity="0.8" />
				<path d="M372 92l2.6 6.6L381 101.2l-6.6 2.6L372 110.4l-2.6-6.6-6.6-2.6 6.6-2.6L372 92Z" />
				<path d="M38 168l2 5.2L45.4 175.2 40 177.2 38 182.4l-2-5.2-5.4-2 5.4-2L38 168Z" opacity="0.7" />
				<path d="M168 232l1.8 4.6 4.6 1.8-4.6 1.8L168 245l-1.8-4.8-4.6-1.8 4.6-1.8L168 232Z" />
			</g>
		</svg>
	);
}
