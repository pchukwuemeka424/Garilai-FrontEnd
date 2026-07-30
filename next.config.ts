import type { NextConfig } from "next";

const DEV_BACKEND = process.env.FEYNMAN_BACKEND_URL ?? "http://127.0.0.1:3141";

const nextConfig: NextConfig = {
	// Static export is for production builds only. Keeping it on in `next dev`
	// breaks rewrites (API/WS proxy) and can leave webpack HMR serving stale chunks.
	...(process.env.NODE_ENV === "production" ? { output: "export" as const } : {}),
	images: {
		unoptimized: true,
	},
	turbopack: {
		root: import.meta.dirname,
	},
	// Ideas / outline generation can exceed the default ~30s rewrite proxy timeout.
	experimental: {
		proxyTimeout: 180_000,
	},
	// pptxgenjs (Research Note PPTX export) uses dynamic `import('node:fs')` /
	// `import('node:https')`. Webpack does not understand the `node:` scheme in
	// client bundles — strip the prefix and stub Node builtins for the browser.
	webpack: (config, { isServer, webpack }) => {
		config.plugins.push(
			new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
				resource.request = resource.request.replace(/^node:/, "");
			}),
		);
		if (!isServer) {
			config.resolve.fallback = {
				...config.resolve.fallback,
				fs: false,
				https: false,
				"image-size": false,
				os: false,
				path: false,
				"fs/promises": false,
			};
		}
		return config;
	},
	async rewrites() {
		const prettyUniversityDetail = {
			source: "/super-admin/universities/:slug((?!detail$)[^/]+)",
			destination: "/super-admin/universities/detail?slug=:slug",
		};

		if (process.env.NODE_ENV !== "development") {
			// Static export ignores rewrites at runtime; Fastify serves the SPA fallback instead.
			return [];
		}
		return [
			prettyUniversityDetail,
			{
				source: "/api/:path*",
				destination: `${DEV_BACKEND}/api/:path*`,
			},
			{
				source: "/ws",
				destination: `${DEV_BACKEND}/ws`,
			},
		];
	},
};

export default nextConfig;
