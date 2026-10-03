/** PM2 all-in-one — `pm2 start deploy/all-in-one/ecosystem.config.cjs` */
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

module.exports = {
	apps: [
		{
			name: "garil-ai",
			cwd: root,
			script: "backend/dist/index.js",
			interpreter: "node",
			instances: 1,
			exec_mode: "fork",
			env: {
				NODE_ENV: "production",
			},
			max_memory_restart: "1G",
			time: true,
		},
	],
};
