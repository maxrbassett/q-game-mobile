/**
 * Q Game - Tag Utilities
 *
 * Tags live in two places:
 *   1. Built-in: question.tags (string[]) in questions.js, plus a label map below.
 *   2. User-created: persisted via storageService (custom labels keyed by slug).
 *
 * Per-question tag overrides also live in storage — when present, they fully
 * replace the data's tag list for that question.
 */

// Friendly display names for the slugs that already exist in the data.
// Anything not listed here falls back to `humanizeTag(slug)`.
export const BUILT_IN_TAG_LABELS = {
  "adults":           "For adults",
  "kids":             "For kids",
  "kids-silly":       "For kids (silly)",
  "seniors-cruise":   "Seniors cruise",
  "siblings-cruise":  "Siblings cruise",
  "work-conference":  "Work conference",
};

/** Convert a free-text tag name into a kebab-case slug. */
export function slugify(label) {
  return String(label)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Fallback display name when a slug isn't in BUILT_IN_TAG_LABELS or customTags. */
export function humanizeTag(slug) {
  if (!slug) return "";
  return slug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

/**
 * Returns the display label for a tag slug, checking custom tags first,
 * then the built-in label map, then falling back to humanizing the slug.
 * @param {string} slug
 * @param {Record<string, { label: string }>} [customTags]
 */
export function tagLabel(slug, customTags = {}) {
  if (customTags[slug]?.label) return customTags[slug].label;
  if (BUILT_IN_TAG_LABELS[slug]) return BUILT_IN_TAG_LABELS[slug];
  return humanizeTag(slug);
}

/** Set of every tag slug appearing in the provided question list. */
export function getBuiltInTagSlugs(questions) {
  const set = new Set();
  for (const q of questions ?? []) {
    if (Array.isArray(q.tags)) q.tags.forEach((t) => set.add(t));
  }
  return set;
}

/**
 * Effective tag list for a question — uses the user's override if present,
 * otherwise the data's tags.
 * @param {{ id: string, tags?: string[] }} question
 * @param {Record<string, string[]>} overrides
 * @returns {string[]}
 */
export function effectiveTagsFor(question, overrides) {
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, question.id)) {
    return overrides[question.id];
  }
  return question.tags ?? [];
}
