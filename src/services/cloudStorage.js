/**
 * Q Game - Cloud storage (Supabase) implementation.
 *
 * Mirrors the function signatures in storageService.js but persists to the
 * authenticated user's rows in Supabase. Returns the same shapes the local
 * implementation returns (Set for favorites, plain objects for the rest),
 * so AppContext can route between them transparently.
 */

import { supabase } from "./supabase";

function assertReady() {
  if (!supabase) throw new Error("Supabase client not configured");
}

// ── Favorites ────────────────────────────────────────────────────────────────

export async function getFavorites(userId) {
  assertReady();
  const { data, error } = await supabase
    .from("user_favorites")
    .select("question_id")
    .eq("user_id", userId);
  if (error) {
    console.warn("[cloud] getFavorites:", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.question_id));
}

export async function toggleFavorite(userId, questionId) {
  assertReady();
  const { data: existing } = await supabase
    .from("user_favorites")
    .select("question_id")
    .eq("user_id", userId)
    .eq("question_id", questionId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("user_favorites")
      .delete()
      .eq("user_id", userId)
      .eq("question_id", questionId);
    if (error) console.warn("[cloud] toggleFavorite delete:", error.message);
    return false;
  }
  const { error } = await supabase
    .from("user_favorites")
    .insert({ user_id: userId, question_id: questionId });
  if (error) console.warn("[cloud] toggleFavorite insert:", error.message);
  return true;
}

// ── Answers ──────────────────────────────────────────────────────────────────

export async function getAnswers(userId) {
  assertReady();
  const { data, error } = await supabase
    .from("user_answers")
    .select("question_id, text, choice, updated_at")
    .eq("user_id", userId);
  if (error) {
    console.warn("[cloud] getAnswers:", error.message);
    return {};
  }
  const out = {};
  for (const row of data ?? []) {
    out[row.question_id] = {
      text: row.text ?? "",
      choice: row.choice ?? null,
      timestamp: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
    };
  }
  return out;
}

export async function saveAnswer(userId, questionId, payload) {
  assertReady();
  const text = (payload?.text ?? "").trim();
  const choice = payload?.choice ?? null;
  const { error } = await supabase
    .from("user_answers")
    .upsert(
      { user_id: userId, question_id: questionId, text, choice, updated_at: new Date().toISOString() },
      { onConflict: "user_id,question_id" },
    );
  if (error) console.warn("[cloud] saveAnswer:", error.message);
}

export async function deleteAnswer(userId, questionId) {
  assertReady();
  const { error } = await supabase
    .from("user_answers")
    .delete()
    .eq("user_id", userId)
    .eq("question_id", questionId);
  if (error) console.warn("[cloud] deleteAnswer:", error.message);
}

// ── Custom tags ──────────────────────────────────────────────────────────────

export async function getCustomTags(userId) {
  assertReady();
  const { data, error } = await supabase
    .from("user_custom_tags")
    .select("slug, label, created_at")
    .eq("user_id", userId);
  if (error) {
    console.warn("[cloud] getCustomTags:", error.message);
    return {};
  }
  const out = {};
  for (const row of data ?? []) {
    out[row.slug] = {
      label: row.label,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    };
  }
  return out;
}

export async function saveCustomTag(userId, slug, label) {
  assertReady();
  const { error } = await supabase
    .from("user_custom_tags")
    .upsert(
      { user_id: userId, slug, label },
      { onConflict: "user_id,slug" },
    );
  if (error) console.warn("[cloud] saveCustomTag:", error.message);
}

export async function deleteCustomTag(userId, slug) {
  assertReady();
  const { error } = await supabase
    .from("user_custom_tags")
    .delete()
    .eq("user_id", userId)
    .eq("slug", slug);
  if (error) console.warn("[cloud] deleteCustomTag:", error.message);
}

// ── Per-question tag overrides ───────────────────────────────────────────────

export async function getQuestionTagOverrides(userId) {
  assertReady();
  const { data, error } = await supabase
    .from("user_question_tags")
    .select("question_id, tag_slugs")
    .eq("user_id", userId);
  if (error) {
    console.warn("[cloud] getQuestionTagOverrides:", error.message);
    return {};
  }
  const out = {};
  for (const row of data ?? []) {
    out[row.question_id] = row.tag_slugs ?? [];
  }
  return out;
}

export async function setQuestionTags(userId, questionId, tagSlugs) {
  assertReady();
  const unique = Array.from(new Set(tagSlugs));
  const { error } = await supabase
    .from("user_question_tags")
    .upsert(
      { user_id: userId, question_id: questionId, tag_slugs: unique, updated_at: new Date().toISOString() },
      { onConflict: "user_id,question_id" },
    );
  if (error) console.warn("[cloud] setQuestionTags:", error.message);
}

// ── Bulk migration (used once when a guest signs in) ─────────────────────────

/**
 * Copies guest-mode localStorage data into the user's cloud rows.
 * Idempotent: re-running merges instead of duplicating.
 *
 * @param {string} userId
 * @param {{
 *   favorites: Iterable<string>,
 *   answers: Record<string, { text: string, choice: string|null }>,
 *   customTags: Record<string, { label: string }>,
 *   questionTagOverrides: Record<string, string[]>,
 * }} local
 */
export async function migrateGuestData(userId, local) {
  assertReady();
  const favRows = Array.from(local.favorites ?? []).map((qid) => ({
    user_id: userId,
    question_id: qid,
  }));
  const answerRows = Object.entries(local.answers ?? {}).map(([qid, a]) => ({
    user_id: userId,
    question_id: qid,
    text: a?.text ?? "",
    choice: a?.choice ?? null,
    updated_at: new Date().toISOString(),
  }));
  const tagRows = Object.entries(local.customTags ?? {}).map(([slug, t]) => ({
    user_id: userId,
    slug,
    label: t?.label ?? slug,
  }));
  const overrideRows = Object.entries(local.questionTagOverrides ?? {}).map(
    ([qid, slugs]) => ({
      user_id: userId,
      question_id: qid,
      tag_slugs: Array.from(new Set(slugs)),
      updated_at: new Date().toISOString(),
    }),
  );

  if (favRows.length) {
    const { error } = await supabase
      .from("user_favorites")
      .upsert(favRows, { onConflict: "user_id,question_id", ignoreDuplicates: true });
    if (error) console.warn("[cloud] migrate favorites:", error.message);
  }
  if (answerRows.length) {
    const { error } = await supabase
      .from("user_answers")
      .upsert(answerRows, { onConflict: "user_id,question_id" });
    if (error) console.warn("[cloud] migrate answers:", error.message);
  }
  if (tagRows.length) {
    const { error } = await supabase
      .from("user_custom_tags")
      .upsert(tagRows, { onConflict: "user_id,slug" });
    if (error) console.warn("[cloud] migrate custom tags:", error.message);
  }
  if (overrideRows.length) {
    const { error } = await supabase
      .from("user_question_tags")
      .upsert(overrideRows, { onConflict: "user_id,question_id" });
    if (error) console.warn("[cloud] migrate overrides:", error.message);
  }
}
