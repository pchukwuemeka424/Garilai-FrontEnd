import {
	AlignmentType,
	Document,
	HeadingLevel,
	Packer,
	Paragraph,
	Table,
	TableCell,
	TableRow,
	TextRun,
	WidthType,
	type IParagraphOptions,
} from "docx";

export type ProjectDocxPage = {
	title: string;
	content?: string;
};

export type ProjectDocxInput = {
	title: string;
	projectType?: string;
	abstract?: string;
	pages: ProjectDocxPage[];
	filename?: string;
};

type InlineMark = {
	bold?: boolean;
	italics?: boolean;
	underline?: boolean;
};

type BlockChild = Paragraph | Table;

function decodeEntities(value: string): string {
	return value
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'")
		.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
		.replace(/&#x([0-9a-f]+);/gi, (_, n) =>
			String.fromCharCode(Number.parseInt(n, 16)),
		);
}

function alignmentFromStyle(style: string | null): IParagraphOptions["alignment"] {
	const align = (style || "").match(/text-align\s*:\s*(left|right|center|justify)/i)?.[1];
	switch ((align || "").toLowerCase()) {
		case "center":
			return AlignmentType.CENTER;
		case "right":
			return AlignmentType.RIGHT;
		case "justify":
			return AlignmentType.BOTH;
		default:
			return AlignmentType.BOTH;
	}
}

function collectRuns(node: Node, marks: InlineMark = {}): TextRun[] {
	if (node.nodeType === Node.TEXT_NODE) {
		const text = decodeEntities(node.textContent || "").replace(/\s+/g, " ");
		if (!text) return [];
		return [
			new TextRun({
				text,
				bold: marks.bold,
				italics: marks.italics,
				underline: marks.underline ? {} : undefined,
				font: "Times New Roman",
				size: 24,
			}),
		];
	}
	if (node.nodeType !== Node.ELEMENT_NODE) return [];

	const el = node as HTMLElement;
	const tag = el.tagName.toLowerCase();
	if (tag === "br") {
		return [new TextRun({ break: 1 })];
	}
	if (tag === "img") {
		const alt = el.getAttribute("alt")?.trim() || "Image";
		return [
			new TextRun({
				text: `[${alt}]`,
				italics: true,
				font: "Times New Roman",
				size: 22,
			}),
		];
	}

	const next: InlineMark = { ...marks };
	if (tag === "strong" || tag === "b") next.bold = true;
	if (tag === "em" || tag === "i") next.italics = true;
	if (tag === "u") next.underline = true;

	const runs: TextRun[] = [];
	for (const child of Array.from(el.childNodes)) {
		runs.push(...collectRuns(child, next));
	}
	return runs;
}

function paragraphFromElement(
	el: HTMLElement,
	opts: Partial<IParagraphOptions> = {},
): Paragraph {
	const runs = collectRuns(el);
	return new Paragraph({
		alignment: alignmentFromStyle(el.getAttribute("style")),
		spacing: { after: 200, line: 360 },
		children: runs.length
			? runs
			: [new TextRun({ text: "", font: "Times New Roman", size: 24 })],
		...opts,
	});
}

function listItems(el: HTMLElement, ordered: boolean): Paragraph[] {
	const items = Array.from(el.children).filter(
		(child) => child.tagName.toLowerCase() === "li",
	) as HTMLElement[];
	return items.map((li, index) => {
		const marker = ordered ? `${index + 1}. ` : "• ";
		const body = collectRuns(li);
		return new Paragraph({
			alignment: AlignmentType.BOTH,
			spacing: { after: 120, line: 360 },
			indent: { left: 720 },
			children: [
				new TextRun({ text: marker, font: "Times New Roman", size: 24 }),
				...body,
			],
		});
	});
}

function tableFromElement(el: HTMLElement): Table {
	const rows = Array.from(el.querySelectorAll("tr"));
	const tableRows =
		rows.length > 0
			? rows.map((row) => {
					const cells = Array.from(row.querySelectorAll("th,td")) as HTMLElement[];
					const cellEls = cells.length
						? cells
						: [null];
					return new TableRow({
						children: cellEls.map((cell) =>
							new TableCell({
								width: { size: 2340, type: WidthType.DXA },
								children: [
									cell
										? paragraphFromElement(cell, {
												alignment: AlignmentType.LEFT,
												spacing: { after: 80, line: 276 },
											})
										: new Paragraph({ children: [] }),
								],
							}),
						),
					});
				})
			: [
					new TableRow({
						children: [
							new TableCell({
								width: { size: 9360, type: WidthType.DXA },
								children: [new Paragraph({ children: [] })],
							}),
						],
					}),
				];

	return new Table({
		width: { size: 9360, type: WidthType.DXA },
		rows: tableRows,
	});
}

function blocksFromHtml(html: string): BlockChild[] {
	const source = String(html || "").trim();
	if (!source) return [];

	const doc = new DOMParser().parseFromString(
		`<div id="garil-export-root">${source}</div>`,
		"text/html",
	);
	const root = doc.getElementById("garil-export-root");
	if (!root) return [];

	const out: BlockChild[] = [];

	const walk = (node: Node) => {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = decodeEntities(node.textContent || "").replace(/\s+/g, " ").trim();
			if (!text) return;
			out.push(
				new Paragraph({
					alignment: AlignmentType.BOTH,
					spacing: { after: 200, line: 360 },
					children: [
						new TextRun({ text, font: "Times New Roman", size: 24 }),
					],
				}),
			);
			return;
		}
		if (node.nodeType !== Node.ELEMENT_NODE) return;

		const el = node as HTMLElement;
		const tag = el.tagName.toLowerCase();

		if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4") {
			const level =
				tag === "h1"
					? HeadingLevel.HEADING_1
					: tag === "h2"
						? HeadingLevel.HEADING_2
						: tag === "h3"
							? HeadingLevel.HEADING_3
							: HeadingLevel.HEADING_4;
			out.push(
				paragraphFromElement(el, {
					heading: level,
					spacing: { before: 240, after: 160, line: 276 },
				}),
			);
			return;
		}
		if (tag === "p" || tag === "blockquote") {
			out.push(paragraphFromElement(el));
			return;
		}
		if (tag === "ul") {
			out.push(...listItems(el, false));
			return;
		}
		if (tag === "ol") {
			out.push(...listItems(el, true));
			return;
		}
		if (tag === "table") {
			out.push(tableFromElement(el));
			out.push(new Paragraph({ children: [] }));
			return;
		}
		if (tag === "hr") {
			out.push(
				new Paragraph({
					spacing: { before: 120, after: 120 },
					children: [
						new TextRun({
							text: "────────────────────────────────",
							font: "Times New Roman",
							size: 20,
						}),
					],
				}),
			);
			return;
		}
		if (tag === "br") {
			out.push(new Paragraph({ children: [] }));
			return;
		}
		if (tag === "section" || tag === "div" || tag === "article" || tag === "figure") {
			for (const child of Array.from(el.childNodes)) walk(child);
			return;
		}
		if (tag === "img") {
			const alt = el.getAttribute("alt")?.trim() || "Image";
			out.push(
				new Paragraph({
					alignment: AlignmentType.CENTER,
					spacing: { after: 200 },
					children: [
						new TextRun({
							text: `[${alt}]`,
							italics: true,
							font: "Times New Roman",
							size: 22,
						}),
					],
				}),
			);
			return;
		}

		// Fallback: treat as a paragraph container
		if (el.childNodes.length === 0) return;
		const hasBlockChild = Array.from(el.children).some((child) =>
			/^(p|h[1-6]|ul|ol|table|div|section|article|blockquote)$/i.test(
				child.tagName,
			),
		);
		if (hasBlockChild) {
			for (const child of Array.from(el.childNodes)) walk(child);
			return;
		}
		out.push(paragraphFromElement(el));
	};

	for (const child of Array.from(root.childNodes)) walk(child);
	return out;
}

function safeFilename(title: string, fallback = "project"): string {
	const base = String(title || fallback)
		.replace(/[^\w\-]+/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_|_$/g, "")
		.slice(0, 60);
	return `${base || fallback}.docx`;
}

export function buildProjectDocument(input: ProjectDocxInput): Document {
	const children: BlockChild[] = [
		new Paragraph({
			heading: HeadingLevel.TITLE,
			alignment: AlignmentType.CENTER,
			spacing: { after: 240 },
			children: [
				new TextRun({
					text: input.title || "Untitled project",
					bold: true,
					font: "Times New Roman",
					size: 36,
				}),
			],
		}),
	];

	if (input.projectType) {
		children.push(
			new Paragraph({
				alignment: AlignmentType.CENTER,
				spacing: { after: 360 },
				children: [
					new TextRun({
						text: String(input.projectType).replace(/_/g, " "),
						italics: true,
						font: "Times New Roman",
						size: 22,
					}),
				],
			}),
		);
	}

	const abstract = String(input.abstract || "").trim();
	if (abstract) {
		children.push(
			new Paragraph({
				heading: HeadingLevel.HEADING_1,
				spacing: { before: 200, after: 160 },
				children: [
					new TextRun({
						text: "Abstract",
						bold: true,
						font: "Times New Roman",
						size: 28,
					}),
				],
			}),
		);
		if (/<[a-z][\s\S]*>/i.test(abstract)) {
			children.push(...blocksFromHtml(abstract));
		} else {
			children.push(
				new Paragraph({
					alignment: AlignmentType.BOTH,
					spacing: { after: 200, line: 360 },
					children: [
						new TextRun({
							text: abstract,
							font: "Times New Roman",
							size: 24,
						}),
					],
				}),
			);
		}
	}

	const pages = Array.isArray(input.pages) ? input.pages : [];
	if (pages.length === 0) {
		children.push(
			new Paragraph({
				spacing: { before: 200 },
				children: [
					new TextRun({
						text: "No pages exported.",
						italics: true,
						font: "Times New Roman",
						size: 24,
					}),
				],
			}),
		);
	} else {
		for (const page of pages) {
			const title = String(page.title || "Untitled").trim() || "Untitled";
			children.push(
				new Paragraph({
					heading: HeadingLevel.HEADING_1,
					spacing: { before: 360, after: 200 },
					children: [
						new TextRun({
							text: title,
							bold: true,
							font: "Times New Roman",
							size: 28,
						}),
					],
				}),
			);
			const body = blocksFromHtml(page.content || "");
			if (body.length) children.push(...body);
			else {
				children.push(
					new Paragraph({
						children: [
							new TextRun({
								text: "",
								font: "Times New Roman",
								size: 24,
							}),
						],
					}),
				);
			}
		}
	}

	return new Document({
		styles: {
			default: {
				document: {
					run: {
						font: "Times New Roman",
						size: 24,
					},
					paragraph: {
						spacing: { line: 360, after: 200 },
					},
				},
			},
		},
		sections: [
			{
				properties: {
					page: {
						margin: {
							top: 1440,
							right: 1440,
							bottom: 1440,
							left: 1440,
						},
					},
				},
				children,
			},
		],
	});
}

export async function downloadProjectDocx(input: ProjectDocxInput): Promise<string> {
	const filename = input.filename?.endsWith(".docx")
		? input.filename
		: safeFilename(input.filename || input.title);
	const doc = buildProjectDocument(input);
	const blob = await Packer.toBlob(doc);
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.rel = "noopener";
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
	return filename;
}
