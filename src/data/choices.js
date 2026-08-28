/**
 * Q Game - Choice Extractor
 *
 * Parses choice options embedded in question text so the UI can offer
 * tap-to-select buttons. Returns null for free-response questions.
 *
 * Patterns handled:
 *   - Rate scale:   "Rate how much you X. (1 = LOW, 3 = HIGH)"
 *   - Multi-option: "STEM? A, B, C, or D[.?]"
 *   - Binary:       "Would you rather X or Y?" / "Which is worse: X or Y?"
 */

import { CATEGORIES } from "./questions";

const BINARY_PREFIXES = [
  /^Would you rather\s+/i,
  /^Which is worse[:\s]+/i,
];

/**
 * @typedef {Object} Choices
 * @property {"scale" | "multi" | "binary"} type
 * @property {string[]} options       - button labels (in display order)
 * @property {string} [displayText]   - question text to display (may differ from raw)
 */

/**
 * @param {{ id: string, category: string, text: string }} question
 * @returns {Choices | null}
 */
export function getChoices(question) {
  if (!question) return null;
  const { text, category } = question;

  if (category === CATEGORIES.RATE_BELIEVE || category === CATEGORIES.RATE_LIKE) {
    const scale = extractScale(text);
    if (scale) return scale;
  }

  const multi = extractMulti(text);
  if (multi) return multi;

  if (category === CATEGORIES.WOULD_YOU_RATHER || category === CATEGORIES.WHICH_IS_WORSE) {
    const binary = extractBinary(text);
    if (binary) return binary;
  }

  return null;
}

/** "(1 = not at all, 3 = absolutely)" → 1/2/3 buttons */
function extractScale(text) {
  const match = text.match(/\(\s*1\s*=\s*([^,]+?)\s*,\s*(\d+)\s*=\s*([^)]+?)\s*\)/);
  if (!match) return null;
  const max = parseInt(match[2], 10);
  if (!Number.isFinite(max) || max < 2 || max > 10) return null;
  const lowLabel = match[1].trim();
  const highLabel = match[3].trim();

  const options = [];
  for (let i = 1; i <= max; i++) {
    if (i === 1) options.push(`1 — ${lowLabel}`);
    else if (i === max) options.push(`${max} — ${highLabel}`);
    else options.push(String(i));
  }

  // Strip the scale annotation from the displayed question
  const displayText = text.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return { type: "scale", options, displayText };
}

/**
 * Multi-option formats:
 *   "STEM? A, B, C, or D[.?]"        — stem ends in question mark
 *   "STEM... A, B, C, or D?"         — stem ends in ellipsis (three dots or "…")
 */
function extractMulti(text) {
  // Find the earliest stem terminator: "?", "...", or "…"
  const sepMatch = text.match(/\?|\.\.\.|…/);
  if (!sepMatch) return null;

  const sepIdx = sepMatch.index;
  const sep = sepMatch[0];
  const stemEnd = sepIdx + sep.length;
  if (stemEnd >= text.length) return null;

  // Normalize the displayed stem: keep "?" as-is, replace "..." / "…" with "…"
  const rawStem = text.slice(0, sepIdx).trim();
  const stem = sep === "?" ? `${rawStem}?` : `${rawStem}…`;

  const tail = text.slice(stemEnd).trim().replace(/[.?]\s*$/, "");

  // Require comma-separated options with an "or " before the last one
  if (!/,/.test(tail) || !/(^|[,\s])or\s+/i.test(tail)) return null;

  const parts = tail.split(/,\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  parts[parts.length - 1] = parts[parts.length - 1].replace(/^or\s+/i, "").trim();
  if (parts.some((p) => p.length === 0 || p.length > 80)) return null;

  return { type: "multi", options: parts, displayText: stem };
}

/** "Would you rather X or Y?" → ["X", "Y"] */
function extractBinary(text) {
  // Strip leading category prefix
  let body = text.trim().replace(/[?.]$/, "");
  for (const re of BINARY_PREFIXES) {
    if (re.test(body)) {
      body = body.replace(re, "");
      break;
    }
  }

  // Find the last " or " — that's the separator between the two options
  const orRegex = /\s+or\s+/gi;
  let lastMatch = null;
  let m;
  while ((m = orRegex.exec(body)) !== null) lastMatch = m;
  if (!lastMatch) return null;

  const a = body.slice(0, lastMatch.index).trim().replace(/[,;:]$/, "").trim();
  const b = body.slice(lastMatch.index + lastMatch[0].length).trim();
  if (!a || !b) return null;

  // Keep the original question as the displayed text — buttons sit below it
  return { type: "binary", options: [a, b] };
}
