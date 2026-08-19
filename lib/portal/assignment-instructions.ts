import { htmlToPlainText } from "@/lib/portal/repair-text";

export type InstructionBlock =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] };

const LOOKS_LIKE_HTML = /<\/?[a-z][\s\S]*>/i;
const BLOCK_RE =
  /<(ul|ol)\b[^>]*>[\s\S]*?<\/\1>|<p\b[^>]*>[\s\S]*?<\/p>|<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi;

function stripInstructionNoise(raw: string) {
  return String(raw || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?(?:html|body|head|meta|span|font|section|article|div)\b[^>]*>/gi, "")
    .trim();
}

function looksLikeHtml(value: string) {
  return LOOKS_LIKE_HTML.test(value);
}

function blocksFromPlainText(source: string): InstructionBlock[] {
  const blocks: InstructionBlock[] = [];
  const chunks = source
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  for (const chunk of chunks) {
    const lines = chunk.split(/\n/).map((line) => line.trim()).filter(Boolean);
    const allBullets =
      lines.length > 0 && lines.every((line) => /^[•\-*]\s+\S/.test(line));
    if (allBullets) {
      blocks.push({
        type: "list",
        items: lines.map((line) => line.replace(/^[•\-*]\s+/, "")),
      });
    } else {
      blocks.push({ type: "p", text: chunk });
    }
  }
  return blocks;
}

function pushPlain(blocks: InstructionBlock[], html: string) {
  const text = htmlToPlainText(html).replace(/\n{3,}/g, "\n\n").trim();
  if (text) blocks.push(...blocksFromPlainText(text));
}

/** Parse stored brief copy (plain text or HTML) into readable blocks. */
export function parseAssignmentInstructions(raw: string): InstructionBlock[] {
  const source = stripInstructionNoise(raw);
  if (!source) return [];

  if (!looksLikeHtml(source)) {
    return blocksFromPlainText(source);
  }

  const blocks: InstructionBlock[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const html = source;
  BLOCK_RE.lastIndex = 0;
  while ((match = BLOCK_RE.exec(html))) {
    pushPlain(blocks, html.slice(last, match.index));
    const chunk = match[0];
    const list = chunk.match(/^<(ul|ol)\b[^>]*>([\s\S]*)<\/(?:ul|ol)>$/i);
    if (list) {
      const items = [...list[2].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
        .map((item) => htmlToPlainText(item[1]).trim())
        .filter(Boolean);
      if (items.length) blocks.push({ type: "list", items });
    } else {
      const inner = chunk.replace(/^<[^>]+>/, "").replace(/<\/[^>]+>$/, "");
      const text = htmlToPlainText(inner).trim();
      if (text) blocks.push({ type: "p", text });
    }
    last = match.index + chunk.length;
  }
  pushPlain(blocks, html.slice(last));
  return blocks;
}

/** Flatten brief instructions to readable plain text (no HTML tags). */
export function assignmentInstructionsToText(raw: string): string {
  return parseAssignmentInstructions(raw)
    .map((block) =>
      block.type === "list"
        ? block.items.map((item) => `• ${item}`).join("\n")
        : block.text,
    )
    .join("\n\n")
    .trim();
}
