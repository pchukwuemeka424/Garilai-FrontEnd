/**
 * Regenerate all security / compliance PDFs.
 * Run: node docs/security/generate-all-security-docs.mjs
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const scripts = [
	"generate-security-audit-pdf.mjs",
	"generate-university-security-assurance-pdf.mjs",
	"generate-institutional-compliance-pack.mjs",
];

let failed = false;
for (const script of scripts) {
	console.log(`\n=== ${script} ===`);
	const result = spawnSync(process.execPath, [join(dir, script)], {
		stdio: "inherit",
	});
	if (result.status !== 0) failed = true;
}

process.exit(failed ? 1 : 0);
