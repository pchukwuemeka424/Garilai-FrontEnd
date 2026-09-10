import type { Editor } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { isHeadingOrHeaderLine, isReferenceEntryLine } from "./fact-check-citations";

/** Highlight colours used in supervisor review annotations. */
export const REVIEW_HIGHLIGHT_COLORS = {
  strength: "#86efac",
  weakness: "#fde047",
  /** Claims / statements that need an in-text citation. */
  citation: "#fdba74",
  /** Contradictory, inaccurate, or unsubstantiated wrong claim. */
  wrongClaim: "#fca5a5",
} as const;

/** Short warning labels shown on highlighted sentences. */
export const REVIEW_HIGHLIGHT_LABELS = {
  strength: "Strength",
  weakness: "Weakness",
  citation: "Needs citation",
  wrongClaim: "Wrong claim",
} as const;

export type ReviewHighlightKind = keyof typeof REVIEW_HIGHLIGHT_COLORS;

export function reviewKindFromColor(
  color: string | null | undefined,
): ReviewHighlightKind | null {
  if (!color) return null;
  const c = color.trim().toLowerCase().replace(/\s+/g, "");
  for (const [kind, hex] of Object.entries(REVIEW_HIGHLIGHT_COLORS)) {
    if (c === hex.toLowerCase()) return kind as ReviewHighlightKind;
  }
  return null;
}

export type ReviewTextHighlights = {
  strengths?: string[];
  weaknesses?: string[];
  /** Passages that assert facts/claims without an in-text citation. */
  citations?: string[];
  wrongClaims?: string[];
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
    .filter((s) => s.length >= 15 && !isHeadingOrHeaderLine(s));
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
      /\b(very|really|thing|stuff|a lot|interesting|good|bad)\b/gi,
    ) || []
  ).length;

  let strengths = 45;
  if (wordCount >= 80) strengths += 10;
  if (wordCount >= 180) strengths += 10;
  if (wordCount >= 350) strengths += 8;
  strengths += Math.min(18, academicHits * 3);
  strengths += Math.min(12, citationHits * 4);
  strengths -= Math.min(14, vagueHits * 2);
  if (avgSentenceLen > 38) strengths -= 6;
  if (avgSentenceLen < 8 && wordCount > 40) strengths -= 8;

  let weaknesses = 20;
  if (wordCount < 60) weaknesses += 25;
  else if (wordCount < 120) weaknesses += 10;
  if (citationHits === 0 && wordCount >= 80) weaknesses += 15;
  weaknesses += Math.min(16, vagueHits * 3);
  if (avgSentenceLen > 40) weaknesses += 8;

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

function splitSentences(plain: string): string[] {
  return plain
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length >= 20 &&
        !isHeadingOrHeaderLine(s) &&
        !isReferenceEntryLine(s),
    );
}

function hasInTextCitation(sentence: string) {
  return /\((?:[^)]*\d{4}[^)]*)\)|\[\d+\]|\bet al\./i.test(sentence);
}

/** Score a sentence for genuine weakness signals (vagueness, lack of substance). */
function sentenceIssueScore(sentence: string): number {
  if (isHeadingOrHeaderLine(sentence) || isReferenceEntryLine(sentence)) {
    return 0;
  }
  let score = 0;
  const lower = sentence.toLowerCase();
  const words = sentence.split(/\s+/).filter(Boolean);

  if (words.length > 45) score += 2;
  if (words.length < 6) score += 2;

  const vague =
    lower.match(
      /\b(very|really|thing|stuff|a lot|nice|maybe|somewhat|etc)\b/g,
    ) || [];
  score += Math.min(6, vague.length * 2);

  if (
    /\b(completely unproven|unsubstantiated|obviously true|without any doubt|everyone knows)\b/i.test(
      sentence,
    )
  ) {
    score += 5;
  }

  if (words.length < 10 && !hasInTextCitation(sentence)) score += 1;

  return score;
}

function sentenceStrengthScore(sentence: string): number {
  if (isHeadingOrHeaderLine(sentence) || isReferenceEntryLine(sentence)) {
    return 0;
  }
  let score = 0;
  const words = sentence.split(/\s+/).filter(Boolean);
  if (words.length >= 12 && words.length <= 42) score += 3;
  if (hasInTextCitation(sentence)) score += 4;
  if (
    /\b(however|therefore|furthermore|moreover|consequently|in contrast|this suggests|the evidence|analysis|framework|hypothesis|argues that|demonstrates)\b/i.test(
      sentence,
    )
  ) {
    score += 3;
  }
  if (sentenceIssueScore(sentence) >= 4) score -= 5;
  return score;
}

function sentenceWrongClaimScore(sentence: string): number {
  if (isHeadingOrHeaderLine(sentence) || isReferenceEntryLine(sentence)) {
    return 0;
  }
  let score = 0;
  if (
    /\b(always|never|all|none|impossible|completely|without question|everyone knows|proves that|no exception|guarantee[sd]?)\b/i.test(
      sentence,
    )
  ) {
    score += 5;
  }
  if (/\b(100%|fails? less|superior to|the only way)\b/i.test(sentence)) {
    score += 4;
  }
  return score;
}

function takeRanked(
  items: Array<{ sentence: string; index: number; score: number }>,
  used: Set<number>,
  minScore: number,
  limit: number,
): string[] {
  const out: string[] = [];
  const ranked = [...items]
    .filter((r) => !used.has(r.index) && r.score >= minScore)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  for (const item of ranked) {
    if (out.length >= limit) break;
    out.push(item.sentence);
    used.add(item.index);
  }
  return out;
}

/**
 * Produce selective Strength, Weakness, Needs-citation, and Wrong-claim excerpts.
 * Headings, titles, sub-headings, and reference list items are STRICTLY excluded.
 */
export function pickFallbackHighlightQuotes(
  plainText: string,
): ReviewTextHighlights {
  const plain = normalizeWhitespace(plainText);
  if (plain.length < 24) {
    return { strengths: [], weaknesses: [], citations: [], wrongClaims: [] };
  }

  const sentences = splitSentences(plain);
  if (sentences.length === 0) {
    return { strengths: [], weaknesses: [], citations: [], wrongClaims: [] };
  }

  const ranked = sentences.map((sentence, index) => ({
    sentence: sentence.slice(0, 280),
    index,
    issue: sentenceIssueScore(sentence),
    strength: sentenceStrengthScore(sentence),
    wrong: sentenceWrongClaimScore(sentence),
  }));

  const used = new Set<number>();
  const weaknesses = takeRanked(
    ranked.map((r) => ({
      sentence: r.sentence,
      index: r.index,
      score: r.issue,
    })),
    used,
    3,
    4,
  );
  const wrongClaims = takeRanked(
    ranked.map((r) => ({
      sentence: r.sentence,
      index: r.index,
      score: r.wrong,
    })),
    used,
    5,
    3,
  );
  const citations = pickFallbackCitationQuotes(plain, used);
  const strengths = takeRanked(
    ranked.map((r) => ({
      sentence: r.sentence,
      index: r.index,
      score: r.strength,
    })),
    used,
    5,
    3,
  );

  return { strengths, weaknesses, citations, wrongClaims };
}

export function hasReviewHighlightQuotes(
  quotes: ReviewTextHighlights | null | undefined,
): boolean {
  if (!quotes) return false;
  return (
    (quotes.weaknesses?.length || 0) +
      (quotes.citations?.length || 0) +
      (quotes.wrongClaims?.length || 0) +
      (quotes.strengths?.length || 0) >
    0
  );
}

export function quotesFromFactCheckClaims(
  claims:
    | Array<{ sentence?: string; status?: string }>
    | null
    | undefined,
): ReviewTextHighlights {
  const citations: string[] = [];
  const wrongClaims: string[] = [];
  for (const claim of claims || []) {
    const sentence = normalizeWhitespace(String(claim.sentence || "")).slice(
      0,
      280,
    );
    if (
      sentence.length < 8 ||
      isHeadingOrHeaderLine(sentence) ||
      isReferenceEntryLine(sentence)
    ) {
      continue;
    }
    if (claim.status === "needs_citation" && citations.length < 6) {
      citations.push(sentence);
    } else if (
      (claim.status === "wrong_claim" ||
        claim.status === "mismatched_citation") &&
      wrongClaims.length < 4
    ) {
      wrongClaims.push(sentence);
    }
  }
  return { strengths: [], weaknesses: [], citations, wrongClaims };
}

/**
 * Find claim-like sentences that lack an in-text citation
 * (Author, Year) / [n] / et al.
 * Excludes headings and reference entries.
 */
export function pickFallbackCitationQuotes(
  plainText: string,
  alreadyUsed: Set<number> = new Set(),
): string[] {
  const plain = normalizeWhitespace(plainText);
  const sentences = splitSentences(plain);
  if (sentences.length === 0) return [];

  const hasCitation = hasInTextCitation;

  const looksLikeEmpiricalOrTheoreticalClaim = (sentence: string) =>
    /\b(fail|compute|latency|throughput|performance|study|studies|experiment|survey|users?|students?|universit\w+|nigerian|african|platform|empirical|demonstrate|show|indicat\w+|prove|consensus|raft|paxos|partitioning|hashing|byzantine|cap theorem|replication|cost|minutes|hours)\b/i.test(
      sentence,
    ) || /\b\d{2,}\b/.test(sentence);

  const ranked = sentences
    .map((sentence, index) => ({
      sentence: sentence.slice(0, 280),
      index,
      score:
        (!hasCitation(sentence) ? 4 : 0) +
        (looksLikeEmpiricalOrTheoreticalClaim(sentence) ? 5 : 0) +
        (sentence.split(/\s+/).length > 12 ? 2 : 0),
    }))
    .filter(
      (r) =>
        !alreadyUsed.has(r.index) &&
        !hasCitation(r.sentence) &&
        !isHeadingOrHeaderLine(r.sentence) &&
        !isReferenceEntryLine(r.sentence) &&
        r.score >= 6,
    )
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const citations: string[] = [];
  for (const item of ranked) {
    if (citations.length >= 4) break;
    citations.push(item.sentence);
    alreadyUsed.add(item.index);
  }
  return citations;
}

/**
 * Merge quote sets cleanly.
 */
export function mergeHighlightQuotes(
  primary: ReviewTextHighlights | null | undefined,
  secondary: ReviewTextHighlights,
): ReviewTextHighlights {
  const uniq = (items: string[]) => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      if (isHeadingOrHeaderLine(item) || isReferenceEntryLine(item)) continue;
      const key = normalizeWhitespace(item).toLowerCase().slice(0, 80);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  };

  return {
    strengths: uniq([
      ...(primary?.strengths || []),
      ...(secondary.strengths || []),
    ]).slice(0, 4),
    weaknesses: uniq([
      ...(primary?.weaknesses || []),
      ...(secondary.weaknesses || []),
    ]).slice(0, 4),
    citations: uniq([
      ...(primary?.citations || []),
      ...(secondary.citations || []),
    ]).slice(0, 6),
    wrongClaims: uniq([
      ...(primary?.wrongClaims || []),
      ...(secondary.wrongClaims || []),
    ]).slice(0, 4),
  };
}

type TextPart = {
  pos: number;
  text: string;
  plainStart: number;
  isHeading?: boolean;
};

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
      const parent = doc.resolve(pos).parent;
      const isHeading =
        parent?.type.name === "heading" ||
        isHeadingOrHeaderLine(node.text) ||
        isReferenceEntryLine(node.text);
      parts.push({
        pos,
        text: node.text,
        plainStart: plain.length,
        isHeading,
      });
      plain += node.text;
    }
    return true;
  });

  return { parts, plain };
}

function mapPlainIndexToPos(
  parts: TextPart[],
  index: number,
): { pos: number; isHeading: boolean } | null {
  if (parts.length === 0) return null;

  for (const part of parts) {
    const start = part.plainStart;
    const end = start + part.text.length;
    if (index >= start && index < end) {
      return {
        pos: part.pos + (index - start),
        isHeading: Boolean(part.isHeading),
      };
    }
    if (index === end) {
      return {
        pos: part.pos + part.text.length,
        isHeading: Boolean(part.isHeading),
      };
    }
  }

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    const start = part.plainStart;
    if (index < start) {
      return { pos: part.pos, isHeading: Boolean(part.isHeading) };
    }
  }
  const last = parts[parts.length - 1]!;
  return {
    pos: last.pos + last.text.length,
    isHeading: Boolean(last.isHeading),
  };
}

function findPlainRange(
  plain: string,
  quote: string,
): { start: number; end: number } | null {
  const source = plain;
  const needle = normalizeWhitespace(quote);
  if (needle.length < 8) return null;

  const pattern = needle
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/ /g, "\\s+");
  const match = new RegExp(pattern, "i").exec(source);
  if (match && match.index != null) {
    return { start: match.index, end: match.index + match[0].length };
  }

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

  return null;
}

function collectHighlightJobs(
  highlights: ReviewTextHighlights,
): Array<{ quote: string; color: string; label: string }> {
  const jobs: Array<{ quote: string; color: string; label: string }> = [];
  const push = (
    quotes: string[] | undefined,
    color: string,
    label: string,
  ) => {
    for (const quote of quotes || []) {
      if (
        normalizeWhitespace(quote).length >= 8 &&
        !isHeadingOrHeaderLine(quote) &&
        !isReferenceEntryLine(quote)
      ) {
        jobs.push({ quote, color, label });
      }
    }
  };
  // Issues first so they win overlaps; strengths fill remaining passages.
  push(
    highlights.wrongClaims,
    REVIEW_HIGHLIGHT_COLORS.wrongClaim,
    REVIEW_HIGHLIGHT_LABELS.wrongClaim,
  );
  push(
    highlights.citations,
    REVIEW_HIGHLIGHT_COLORS.citation,
    REVIEW_HIGHLIGHT_LABELS.citation,
  );
  push(
    highlights.weaknesses,
    REVIEW_HIGHLIGHT_COLORS.weakness,
    REVIEW_HIGHLIGHT_LABELS.weakness,
  );
  push(
    highlights.strengths,
    REVIEW_HIGHLIGHT_COLORS.strength,
    REVIEW_HIGHLIGHT_LABELS.strength,
  );
  return jobs;
}

/**
 * Apply Strength / Weakness / Needs-citation / Wrong-claim marks inside a TipTap editor.
 * NEVER highlights headings, sub-headings, or reference list items.
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

  const jobs = collectHighlightJobs(highlights);

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

    const fromRes = mapPlainIndexToPos(parts, range.start);
    const toRes = mapPlainIndexToPos(parts, range.end);
    if (!fromRes || !toRes || toRes.pos <= fromRes.pos) continue;

    // Strict guard: skip if start or end is in a heading
    if (fromRes.isHeading || toRes.isHeading) continue;

    // Check parent node type
    const parentNode = editor.state.doc.resolve(fromRes.pos).parent;
    if (parentNode?.type.name === "heading") continue;

    tr = tr.addMark(
      fromRes.pos,
      toRes.pos,
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
 * DOM-based highlighter for read-only rendered HTML.
 * Strictly skips headings and reference entries.
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

  type CharMap = { node: Text; offset: number; isHeading: boolean } | "gap";

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
      const parent = textNode.parentElement;
      const isHeading = Boolean(
        parent?.closest("h1, h2, h3, h4, h5, h6, [data-heading='true']") ||
          isHeadingOrHeaderLine(textNode.nodeValue || "") ||
          isReferenceEntryLine(textNode.nodeValue || ""),
      );

      const block = parent?.closest("p, div, li, h1, h2, h3, h4, h5, h6");
      if (lastBlock && block && block !== lastBlock && plain.length > 0) {
        if (!/\s$/.test(plain)) {
          plain += " ";
          map.push("gap");
        }
      }
      lastBlock = block ?? null;

      const val = textNode.nodeValue || "";
      for (let i = 0; i < val.length; i++) {
        map.push({ node: textNode, offset: i, isHeading });
        plain += val[i];
      }
      node = walker.nextNode();
    }
    return { plain, map };
  }

  const jobs = collectHighlightJobs(highlights);

  jobs.sort(
    (a, b) =>
      normalizeWhitespace(b.quote).length - normalizeWhitespace(a.quote).length,
  );

  for (const job of jobs) {
    const { plain, map } = rebuildPlain();
    const range = findPlainRange(plain, job.quote);
    if (!range) continue;

    let startMap: CharMap | undefined;
    let endMap: CharMap | undefined;

    for (let i = range.start; i < range.end && i < map.length; i++) {
      const item = map[i];
      if (item && item !== "gap") {
        if (!startMap) startMap = item;
        endMap = item;
      }
    }

    if (
      !startMap ||
      startMap === "gap" ||
      !endMap ||
      endMap === "gap" ||
      startMap.node !== endMap.node ||
      startMap.isHeading ||
      endMap.isHeading
    ) {
      continue;
    }

    const textNode = startMap.node;
    const sOff = startMap.offset;
    const eOff = endMap.offset + 1;
    const full = textNode.nodeValue || "";
    if (sOff >= eOff || eOff > full.length) continue;

    const before = full.slice(0, sOff);
    const mid = full.slice(sOff, eOff);
    const after = full.slice(eOff);

    const parent = textNode.parentNode;
    if (!parent) continue;

    const mark = doc.createElement("mark");
    mark.style.backgroundColor = job.color;
    mark.setAttribute("data-color", job.color);
    mark.setAttribute("data-review-flag", job.label);
    const kind = reviewKindFromColor(job.color);
    if (kind) mark.setAttribute("data-review", kind);
    mark.textContent = mid;

    const frag = doc.createDocumentFragment();
    if (before) frag.appendChild(doc.createTextNode(before));
    frag.appendChild(mark);
    if (after) frag.appendChild(doc.createTextNode(after));
    parent.replaceChild(frag, textNode);
  }

  return root.innerHTML;
}
