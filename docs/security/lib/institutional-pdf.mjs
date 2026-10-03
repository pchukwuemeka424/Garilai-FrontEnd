/**
 * Shared layout helpers for institutional security / compliance PDFs.
 */
import { jsPDF } from "jspdf";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const BRAND = [18, 32, 48];
export const ACCENT = [34, 120, 70];
export const BODY = [35, 40, 48];
export const MUTED = [100, 105, 115];
export const WARN = [160, 100, 20];

export function createInstitutionalDoc(options) {
	const {
		title,
		subtitle,
		docType,
		footerLabel,
		filename,
		date = "3 October 2026",
		version = "1.0",
		disclaimer,
		build,
	} = options;

	const doc = new jsPDF({ unit: "pt", format: "a4" });
	const margin = 52;
	const pageW = doc.internal.pageSize.getWidth();
	const pageH = doc.internal.pageSize.getHeight();
	const maxW = pageW - margin * 2;
	let y = margin;
	let page = 1;

	const wrap = (text, width = maxW) => doc.splitTextToSize(text, width);

	const footer = () => {
		doc.setDrawColor(210);
		doc.setLineWidth(0.5);
		doc.line(margin, pageH - 40, pageW - margin, pageH - 40);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(7.5);
		doc.setTextColor(130);
		doc.text(footerLabel, margin, pageH - 26);
		doc.text(String(page), pageW - margin, pageH - 26, { align: "right" });
	};

	const ensure = (need) => {
		if (y + need > pageH - margin - 28) {
			footer();
			doc.addPage();
			page += 1;
			y = margin;
		}
	};

	const h1 = (t) => {
		ensure(36);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(13.5);
		doc.setTextColor(...BRAND);
		doc.text(t, margin, y);
		y += 8;
		doc.setDrawColor(...ACCENT);
		doc.setLineWidth(2);
		doc.line(margin, y, margin + 48, y);
		y += 16;
	};

	const h2 = (t) => {
		ensure(24);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(11);
		doc.setTextColor(...BRAND);
		doc.text(t, margin, y);
		y += 14;
	};

	const para = (t, opts = {}) => {
		doc.setFont("helvetica", opts.bold ? "bold" : "normal");
		doc.setFontSize(opts.size || 9.8);
		doc.setTextColor(...(opts.color || BODY));
		const lines = wrap(t, opts.width || maxW);
		for (const line of lines) {
			ensure(13);
			doc.text(line, opts.x ?? margin, y);
			y += opts.leading || 12.5;
		}
		y += opts.after ?? 7;
	};

	const bullet = (t) => {
		doc.setFont("helvetica", "normal");
		doc.setFontSize(9.8);
		doc.setTextColor(...BODY);
		const lines = wrap(t, maxW - 16);
		for (let i = 0; i < lines.length; i++) {
			ensure(13);
			if (i === 0) {
				doc.setFillColor(...ACCENT);
				doc.circle(margin + 3.5, y - 3, 2, "F");
			}
			doc.text(lines[i], margin + 14, y);
			y += 12.5;
		}
		y += 3;
	};

	const callout = (heading, text, tone = "ok") => {
		const color = tone === "warn" ? [255, 248, 230] : [236, 247, 240];
		const headingColor = tone === "warn" ? WARN : ACCENT;
		const lines = wrap(text, maxW - 28);
		const h = 28 + lines.length * 12;
		ensure(h + 8);
		doc.setFillColor(...color);
		doc.roundedRect(margin, y - 6, maxW, h, 4, 4, "F");
		doc.setFont("helvetica", "bold");
		doc.setFontSize(9.5);
		doc.setTextColor(...headingColor);
		doc.text(heading, margin + 12, y + 8);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(9);
		doc.setTextColor(...BODY);
		let cy = y + 22;
		for (const line of lines) {
			doc.text(line, margin + 12, cy);
			cy += 12;
		}
		y += h + 10;
	};

	const table = (headers, rows) => {
		const colW = maxW / headers.length;
		ensure(28 + rows.length * 28);
		doc.setFillColor(...BRAND);
		doc.rect(margin, y - 10, maxW, 18, "F");
		doc.setFont("helvetica", "bold");
		doc.setFontSize(8);
		doc.setTextColor(255);
		headers.forEach((h, i) => {
			doc.text(h, margin + 6 + i * colW, y + 2);
		});
		y += 16;
		doc.setFont("helvetica", "normal");
		doc.setFontSize(8.2);
		for (const row of rows) {
			const cellLines = row.map((cell) => wrap(String(cell), colW - 10));
			const rowH = Math.max(...cellLines.map((l) => l.length)) * 11 + 8;
			ensure(rowH + 4);
			doc.setDrawColor(225);
			doc.setLineWidth(0.4);
			doc.line(margin, y - 8, pageW - margin, y - 8);
			doc.setTextColor(...BODY);
			cellLines.forEach((lines, i) => {
				lines.forEach((line, li) => {
					doc.text(line, margin + 6 + i * colW, y + li * 11);
				});
			});
			y += rowH;
		}
		y += 10;
	};

	const cover = () => {
		doc.setFillColor(...BRAND);
		doc.rect(0, 0, pageW, pageH, "F");
		doc.setFillColor(...ACCENT);
		doc.rect(0, 0, 8, pageH, "F");

		doc.setTextColor(255);
		doc.setFont("helvetica", "bold");
		doc.setFontSize(10);
		doc.text(docType.toUpperCase(), margin + 12, 90);

		doc.setFontSize(24);
		doc.text("GARIL AI", margin + 12, 140);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(16);
		doc.text(title, margin + 12, 168);
		if (subtitle) {
			doc.setFontSize(11);
			doc.setTextColor(190);
			doc.text(subtitle, margin + 12, 192);
		}

		doc.setDrawColor(70, 90, 110);
		doc.setLineWidth(0.8);
		doc.line(margin + 12, 220, pageW - margin, 220);

		doc.setFontSize(10);
		doc.setTextColor(210);
		const meta = [
			["Version", version],
			["Date", date],
			["Audience", "Partner universities & institutional stakeholders"],
			["Classification", "Confidential — authorised institutional use"],
		];
		let my = 250;
		for (const [k, v] of meta) {
			doc.setFont("helvetica", "bold");
			doc.setTextColor(160);
			doc.text(k, margin + 12, my);
			doc.setFont("helvetica", "normal");
			doc.setTextColor(230);
			doc.text(v, margin + 130, my);
			my += 20;
		}

		if (disclaimer) {
			doc.setFillColor(255, 255, 255);
			const dLines = wrap(disclaimer, maxW - 40);
			const boxH = 36 + dLines.length * 11;
			const by = pageH - 80 - boxH;
			doc.roundedRect(margin + 12, by, maxW - 12, boxH, 4, 4, "F");
			doc.setFont("helvetica", "bold");
			doc.setFontSize(9);
			doc.setTextColor(...WARN);
			doc.text("Important notice", margin + 28, by + 16);
			doc.setFont("helvetica", "normal");
			doc.setFontSize(8.5);
			doc.setTextColor(...BODY);
			let dy = by + 30;
			for (const line of dLines) {
				doc.text(line, margin + 28, dy);
				dy += 11;
			}
		}

		footer();
		doc.addPage();
		page = 2;
		y = margin;
	};

	cover();

	const api = { doc, margin, pageW, pageH, maxW, ensure, h1, h2, para, bullet, callout, table, wrap, get y() { return y; }, set y(v) { y = v; }, get page() { return page; } };

	build(api);

	footer();
	mkdirSync(dirname(filename), { recursive: true });
	doc.save(filename);
	console.log(`Wrote ${filename}`);
}
