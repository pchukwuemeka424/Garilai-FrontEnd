import Image from "next/image";

import { APP_LOGO_SRC, APP_MARK_SRC, APP_NAME } from "@/lib/brand";

type MarkProps = {
	size?: number;
	className?: string;
};

/** Compact GA shield mark. */
export function BrandMark({ size = 28, className }: MarkProps) {
	return (
		<Image
			src={APP_MARK_SRC}
			alt=""
			width={size}
			height={Math.round(size * (358 / 501))}
			className={className ?? "brand-mark-img"}
			priority
		/>
	);
}

type LogoProps = {
	/** Visual height in px; width scales with the wordmark aspect ratio. */
	height?: number;
	className?: string;
	priority?: boolean;
};

/** Full GARIL AI horizontal logo. */
export function BrandLogo({ height = 40, className, priority }: LogoProps) {
	const width = Math.round(height * (1024 / 244));
	return (
		<Image
			src={APP_LOGO_SRC}
			alt={APP_NAME}
			width={width}
			height={height}
			className={className ?? "brand-logo-img"}
			priority={priority}
		/>
	);
}
