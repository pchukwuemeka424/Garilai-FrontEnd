import type { Editor } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";

/** Highlight colours used in supervisor review annotations. */
export const REVIEW_HIGHLIGHT_COLORS = {
  strength: "#86efac",
  weakness: "#fde047",
  /** Claims / statements that need an in-text citation. */
  citation: "#fdba74",
} as const;

/** Short warning labels shown on highlighted sentences. */
export const REVIEW_HIGHLIGHT_LABELS = {
  strength: "Strength",
  weakness: "Weakness",
  citation: "Claim needs in-text citation",
} as const;

export type ReviewHighlightKind = keyof typeof REVIEW_HIGHLIGHT_COLORS;

export type ReviewTextHighlights = {
  strengths?: string[];
  weaknesses?: string[];
  /** Passages that assert facts/claims without an in-text citation. */
  citations?: string[];
};

/** 0–100 scores for each review dimension. */
export type AreaScores = {
  strengths: number;
  weaknesses: number;
  overall: number;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Heuristic 0–100 scores for Strengths / Weaknesses
 * when no LLM scores are available.
 */
export function computeAreaScores(plainText: string): AreaScores {
  const plain = normalizeWhitespace(plainText);
  const words = plain ? plain.split(" ").filter(Boolean) : [];
  const wordCount = words.length;
  const sentences = plain
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const avgSentenceLen =
    sentences.length > 0 ? wordCount / sentences.length : wordCount;

  const citationHits = (
    plain.match(
      /\((?:[A-Z][a-z]+(?:\s+&\s+[A-Z][a-z]+)*,\s*)?\d{4}\)|\[\d+\]|et al\./g,
    ) || []
  ).length;
  const academicHits = (
    plain.match(
      /\b(however|therefore|furthermore|moreover|significant|analysis|methodology|framework|hypothesis|evidence|literature)\b/gi,
    ) || []
  ).length;
  const vagueHits = (
    plain.match(
      /\b(very|really|thing|stuff|a lot|interesting|important|good|bad)\b/gi,
    ) || []
  ).length;

  let strengths = 42;
  if (wordCount >= 80) strengths += 12;
  if (wordCount >= 180) strengths += 10;
  if (wordCount >= 350) strengths += 8;
  strengths += Math.min(18, academicHits * 3);
  strengths += Math.min(12, citationHits * 4);
  strengths -= Math.min(14, vagueHits * 2);
  if (avgSentenceLen > 38) strengths -= 6;
  if (avgSentenceLen < 8 && wordCount > 40) strengths -= 8;

  let weaknesses = 28;
  if (wordCount < 60) weaknesses += 30;
  else if (wordCount < 120) weaknesses += 16;
  if (citationHits === 0 && wordCount >= 80) weaknesses += 18;
  weaknesses += Math.min(16, vagueHits * 3);
  if (avgSentenceLen > 40) weaknesses += 10;
  if (academicHits < 2 && wordCount >= 100) weaknesses += 12;
  if (sentences.length <= 2 && wordCount >= 80) weaknesses += 8;
  weaknesses = Math.max(weaknesses - Math.floor(strengths / 8), 12);

  strengths = clampScore(strengths);
  weaknesses = clampScore(weaknesses);

  const overall = clampScore(
    strengths * 0.65 + (100 - weaknesses) * 0.35,
  );

  return { strengths, weaknesses, overall };
}

export function parseAreaScores(
  value: unknown,
  fallback: AreaScores,
): AreaScores {
  if (!value || typeof value !== "object") return fallback;
  const obj = value as Record<string, unknown>;
  const strengths =
    typeof obj.strengths === "number" ? obj.strengths : fallback.strengths;
  const weaknesses =
    typeof obj.weaknesses === "number" ? obj.weaknesses : fallback.weaknesses;
  const overall =
    typeof obj.overall === "number"
      ? obj.overall
      : clampScore(strengths * 0.65 + (100 - weaknesses) * 0.35);
  return {
    strengths: clampScore(strengths),
    weaknesses: clampScore(weaknesses),
    overall: clampScore(overall),
  };
}

export function stripReviewMarks(html: string) {
  return String(html || "")
    .replace(
      /<span\b[^>]*class="[^"]*review-flag-badge[^"]*"[^>]*>[\s\S]*?<\/span>/gi,
      "",
    )
    .replace(/<\/?mark\b[^>]*>/gi, "");
}

function snapToWord(text: string, index: number, prefer: "start" | "end") {
  if (index <= 0) return 0;
  if (index >= text.length) return text.length;
  if (/\s/.test(text[index] || "")) return index;
  if (prefer === "start") {
    const prev = text.lastIndexOf(" ", index);
    return prev === -1 ? index : prev + 1;
  }
  const next = text.indexOf(" ", index);
  return next === -1 ? text.length : next;
}

function splitSentences(plain: string): string[] {
  return plain
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20);
}

/** Score a sentence for weakness signals (higher = more issue-like). */
function sentenceIssueScore(sentence: string): number {
  let score = 0;
  const lower = sentence.toLowerCase();
  const words = sentence.split(/\s+/).filter(Boolean);

  if (words.length > 35) score += 3;
  if (words.length > 50) score += 2;
  if (words.length < 8) score += 2;

  const vague =
    lower.match(
      /\b(very|really|thing|stuff|a lot|interesting|important|good|bad|nice|maybe|somewhat|various|etc)\b/g,
    ) || [];
  score += Math.min(6, vague.length * 2);

  if (
    /\b(however|but|although|despite|nevertheless|unfortunately|limited|lack|unclear|insufficient|weak|missing|fail|cannot|unable)\b/i.test(
      sentence,
    )
  ) {
    score += 4;
  }

  if (
    /\b(should|need to|must|could be|would benefit|recommend|suggest|improve|clarify|expand|strengthen|further research)\b/i.test(
      sentence,
    )
  ) {
    score += 3;
  }

  if (!/\((?:[^)]*\d{4}[^)]*)\)|\[\d+\]|et al\./i.test(sentence) && words.length > 18) {
    score += 2;
  }

  if (
    /\b(this study|this paper|we argue|findings (show|indicate|suggest)|results (show|indicate))\b/i.test(
      sentence,
    )
  ) {
    score -= 2;
  }

  return score;
}

/**
 * Produce Weakness and missing-citation excerpts across the document.
 * Strengths are not highlighted.
 */
export function pickFallbackHighlightQuotes(
  plainText: string,
): ReviewTextHighlights {
  const plain = normalizeWhitespace(plainText);
  if (plain.length < 24) {
    return { strengths: [], weaknesses: [], citations: [] };
  }

  const sentences = splitSentences(plain);

  if (sentences.length === 0) {
    const len = plain.length;
    let t1 = snapToWord(plain, Math.floor(len / 2), "end");
    if (t1 < 12) t1 = Math.floor(len / 2);
    return {
      strengths: [],
      weaknesses: [plain.slice(0, t1).trim()].filter((s) => s.length >= 8),
      citations: [],
    };
  }

  const ranked = sentences.map((sentence, index) => ({
    sentence: sentence.slice(0, 280),
    index,
    issue: sentenceIssueScore(sentence),
  }));

  const weaknessCandidates = [...ranked]
    .filter(
      (r) => r.issue >= 3 || r.index >= Math.floor(sentences.length * 0.2),
    )
    .sort((a, b) => b.issue - a.issue || a.index - b.index);

  const weaknesses: string[] = [];
  const used = new Set<number>();
  for (const item of weaknessCandidates) {
    if (weaknesses.length >= 8) break;
    if (used.has(item.index)) continue;
    weaknesses.push(item.sentence);
    used.add(item.index);
  }

  if (weaknesses.length === 0 && sentences.length >= 1) {
    const mid = sentences[Math.floor(sentences.length / 2)];
    if (mid) weaknesses.push(mid.slice(0, 280));
  }

  const citations = pickFallbackCitationQuotes(plain, used);

  return { strengths: [], weaknesses, citations };
}

/**
 * Find claim-like sentences that lack an in-text citation
 * (Author, Year) / [n] / et al.
 */
export function pickFallbackCitationQuotes(
  plainText: string,
  alreadyUsed: Set<number> = new Set(),
): string[] {
  const plain = normalizeWhitespace(plainText);
  const sentences = splitSentences(plain);
  if (sentences.length === 0) return [];

  const hasCitation = (sentence: string) =>
    /\((?:[^)]*\d{4}[^)]*)\)|\[\d+\]|\bet al\./i.test(sentence);

  const looksLikeClaim = (sentence: string) =>
    /\b(studies?|research|evidence|findings?|results?|literature|scholars?|authors?|data|statistics?|percent|%|significant|demonstrat\w+|show(?:s|ed|ing)?|indicat\w+|suggest\w+|report\w+|found that|according to|it is (?:known|clear|evident)|has been (?:shown|argued|reported))\b/i.test(
      sentence,
    ) || /\b\d{2,}\b/.test(sentence);

  const ranked = sentences
    .map((sentence, index) => ({
      sentence: sentence.slice(0, 280),
      index,
      score:
        (!hasCitation(sentence) ? 4 : 0) +
        (looksLikeClaim(sentence) ? 5 : 0) +
        (sentence.split(/\s+/).length > 16 ? 1 : 0),
    }))
    .filter((r) => !alreadyUsed.has(r.index) && !hasCitation(r.sentence) && r.score >= 5)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const citations: string[] = [];
  for (const item of ranked) {
    if (citations.length >= 8) break;
    citations.push(item.sentence);
    alreadyUsed.add(item.index);
  }
  return citations;
}

/**
 * Merge quote sets, preferring Weaknesses and Citations coverage.
 * Strength quotes are dropped (not highlighted).
 */
export function mergeHighlightQuotes(
  primary: ReviewTextHighlights | null | undefined,
  secondary: ReviewTextHighlights,
): ReviewTextHighlights {
  const uniq = (items: string[]) => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      const key = normalizeWhitespace(item).toLowerCase().slice(0, 80);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  };

  return {
    strengths: [],
    weaknesses: uniq([
      ...(primary?.weaknesses || []),
      ...(secondary.weaknesses || []),
    ]).slice(0, 10),
    citations: uniq([
      ...(primary?.citations || []),
      ...(secondary.citations || []),
    ]).slice(0, 10),
  };
}

type TextPart = { pos: number; text: string; plainStart: number };

/**
 * Build plain text with spaces between textblocks (matches HTML→text extraction)
 * and track each text node's start index in that plain string.
 */
function collectTextParts(doc: PMNode): { parts: TextPart[]; plain: string } {
  const parts: TextPart[] = [];
  let plain = "";
  let pendingSep = false;

  doc.descendants((node, pos) => {
    if (node.isTextblock) {
      if (pendingSep && plain.length > 0 && !/\s$/.test(plain)) {
        plain += " ";
      }
      pendingSep = true;
      return true;
    }
    if (node.isText && node.text) {
      parts.push({ pos, text: node.text, plainStart: plain.length });
      plain += node.text;
    }
    return true;
  });

  return { parts, plain };
}

function mapPlainIndexToPos(parts: TextPart[], index: number): number | null {
  if (parts.length === 0) return null;

  // Snap into the nearest text part if the index lands on a separator gap.
  for (const part of parts) {
    const start = part.plainStart;
    const end = start + part.text.length;
    if (index >= start && index < end) {
      return part.pos + (index - start);
    }
    if (index === end) {
      return part.pos + part.text.length;
    }
  }

  // Before first / after last / in gap: snap to closest boundary
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    const start = part.plainStart;
    if (index < start) {
      return part.pos;
    }
  }
  const last = parts[parts.length - 1]!;
  return last.pos + last.text.length;
}

function findPlainRange(
  plain: string,
  quote: string,
): { start: number; end: number } | null {
  const source = plain;
  const needle = normalizeWhitespace(quote);
  if (needle.length < 8) return null;

  // Exact / flexible whitespace match
  const pattern = needle
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/ /g, "\\s+");
  const match = new RegExp(pattern, "i").exec(source);
  if (match && match.index != null) {
    return { start: match.index, end: match.index + match[0].length };
  }

  // Soft fallback: first 48 chars of quote
  const soft = needle.slice(0, Math.min(48, needle.length));
  if (soft.length >= 12) {
    const softPattern = soft
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/ /g, "\\s+");
    const softMatch = new RegExp(softPattern, "i").exec(source);
    if (softMatch && softMatch.index != null) {
      const end = Math.min(
        source.length,
        softMatch.index +
          Math.max(softMatch[0].length, Math.floor(needle.length * 0.6)),
      );
      return { start: softMatch.index, end };
    }
  }

  // Last resort: compacted alphanumeric match (ignores punctuation/spacing drift)
  const compact = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const compactPlain = compact(source);
  const compactNeedle = compact(needle).slice(0, 64);
  if (compactNeedle.length >= 12) {
    const at = compactPlain.indexOf(compactNeedle);
    if (at >= 0) {
      // Map compacted index roughly back by walking source chars
      let compactIdx = 0;
      let start = -1;
      let end = -1;
      for (let i = 0; i < source.length; i++) {
        if (/[a-z0-9]/i.test(source[i]!)) {
          if (compactIdx === at) start = i;
          compactIdx++;
          if (compactIdx === at + compactNeedle.length) {
            end = i + 1;
            break;
          }
        }
      }
      if (start >= 0 && end > start) return { start, end };
    }
  }

  return null;
}

/**
 * Apply Weaknesses / Citations marks inside a TipTap editor.
 * Returns the resulting HTML.
 */
export function applyHighlightsToEditor(
  editor: Editor,
  highlights: ReviewTextHighlights,
): string {
  const highlightType = editor.schema.marks.highlight;
  if (!highlightType) return editor.getHTML();

  // Clear existing highlight marks
  const clearTr = editor.state.tr;
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const from = pos;
    const to = pos + node.nodeSize;
    if (node.marks.some((m) => m.type === highlightType)) {
      clearTr.removeMark(from, to, highlightType);
    }
  });
  if (clearTr.docChanged || clearTr.steps.length > 0) {
    editor.view.dispatch(clearTr);
  }

  const jobs: Array<{ quote: string; color: string }> = [];
  // Strengths are intentionally not highlighted.
  for (const quote of highlights.weaknesses || []) {
    if (normalizeWhitespace(quote).length >= 8) {
      jobs.push({ quote, color: REVIEW_HIGHLIGHT_COLORS.weakness });
    }
  }
  for (const quote of highlights.citations || []) {
    if (normalizeWhitespace(quote).length >= 8) {
      jobs.push({ quote, color: REVIEW_HIGHLIGHT_COLORS.citation });
    }
  }

  // Apply longer quotes first
  jobs.sort(
    (a, b) =>
      normalizeWhitespace(b.quote).length - normalizeWhitespace(a.quote).length,
  );

  const used: Array<{ start: number; end: number }> = [];
  let tr = editor.state.tr;
  const { parts, plain } = collectTextParts(editor.state.doc);

  for (const job of jobs) {
    const range = findPlainRange(plain, job.quote);
    if (!range) continue;
    if (used.some((u) => range.start < u.end && range.end > u.start)) continue;

    const from = mapPlainIndexToPos(parts, range.start);
    const to = mapPlainIndexToPos(parts, range.end);
    if (from == null || to == null || to <= from) continue;

    tr = tr.addMark(
      from,
      to,
      highlightType.create({ color: job.color }),
    );
    used.push(range);
  }

  if (tr.docChanged || tr.steps.length > 0) {
    editor.view.dispatch(tr);
  }

  return editor.getHTML();
}

/**
 * DOM-based highlighter kept for non-editor HTML (e.g. student feedback view).
 * Inserts spaces between block text nodes so quotes from stripped HTML can match.
 */
export function applyReviewHighlights(
  html: string,
  highlights: ReviewTextHighlights,
): string {
  if (typeof DOMParser === "undefined") return html;

  const cleaned = stripReviewMarks(html);
  const doc = new DOMParser().parseFromString(
    `<div id="root">${cleaned}</div>`,
    "text/html",
  );
  const root = doc.getElementById("root");
  if (!root) return cleaned;

  type CharMap = { node: Text; offset: number } | "gap";

  function rebuildPlain() {
    const walker = root!.ownerDocument.createTreeWalker(
      root!,
      NodeFilter.SHOW_TEXT,
    );
    const map: CharMap[] = [];
    let plain = "";
    let lastBlock: Element | null = null;
    let node = walker.nextNode();
    while (node) {
      const textNode = node as Text;
      const block =
        textNode.parentElement?.closest(
          "p, h1, h2, h3, h4, li, td, th, blockquote, pre, div",
        ) ?? null;
      if (
        lastBlock &&
        block &&
        block !== lastBlock &&
        plain.length > 0 &&
        !/\s$/.test(plain)
      ) {
        plain += " ";
        map.push("gap");
      }
      lastBlock = block;
      const value = textNode.nodeValue || "";
      for (let i = 0; i < value.length; i++) {
        plain += value[i];
        map.push({ node: textNode, offset: i });
      }
      node = walker.nextNode();
    }
    return { plain, map };
  }

  const jobs: Array<{
    quote: string;
    color: string;
    kind: ReviewHighlightKind;
    label: string;
  }> = [];
  for (const q of highlights.weaknesses || []) {
    jobs.push({
      quote: normalizeWhitespace(q),
      color: REVIEW_HIGHLIGHT_COLORS.weakness,
      kind: "weakness",
      label: REVIEW_HIGHLIGHT_LABELS.weakness,
    });
  }
  for (const q of highlights.citations || []) {
    jobs.push({
      quote: normalizeWhitespace(q),
      color: REVIEW_HIGHLIGHT_COLORS.citation,
      kind: "citation",
      label: REVIEW_HIGHLIGHT_LABELS.citation,
    });
  }
  jobs.sort((a, b) => b.quote.length - a.quote.length);

  for (const job of jobs) {
    if (job.quote.length < 8) continue;
    const { plain, map } = rebuildPlain();
    const range = findPlainRange(plain, job.quote);
    if (!range) continue;

    let startIdx = range.start;
    let endIdx = Math.max(range.end - 1, range.start);
    while (startIdx < map.length && map[startIdx] === "gap") startIdx++;
    while (endIdx > startIdx && map[endIdx] === "gap") endIdx--;
    const startMap = map[startIdx];
    const endMap = map[endIdx];
    if (!startMap || startMap === "gap" || !endMap || endMap === "gap") continue;

    try {
      const r = root.ownerDocument.createRange();
      r.setStart(startMap.node, startMap.offset);
      r.setEnd(endMap.node, endMap.offset + 1);
      const mark = root.ownerDocument.createElement("mark");
      mark.className = "review-flag";
      mark.setAttribute("data-color", job.color);
      mark.setAttribute("data-review", job.kind);
      mark.setAttribute("data-label", job.label);
      mark.setAttribute("title", job.label);
      mark.setAttribute(
        "style",
        `background-color: ${job.color}; color: inherit`,
      );

      const badge = root.ownerDocument.createElement("span");
      badge.className = `review-flag-badge review-flag-badge--${job.kind}`;
      badge.setAttribute("aria-label", job.label);
      badge.textContent = job.label;

      try {
        r.surroundContents(mark);
      } catch {
        const frag = r.extractContents();
        mark.appendChild(frag);
        r.insertNode(mark);
      }
      // Place the warning badge at the start of the highlighted sentence.
      mark.insertBefore(badge, mark.firstChild);
    } catch {
      // skip failed wrap
    }
  }

  return root.innerHTML;
}
