import type { NextConfig } from "next";

const DEV_BACKEND = process.env.FEYNMAN_BACKEND_URL ?? "http://127.0.0.1:3141";

const nextConfig: NextConfig = {
	output: "export",
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
			new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
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
		if (process.env.NODE_ENV !== "development") {
			return [];
		}
		return [
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
