/**
 * Q Game - Storage Service
 *
 * Device-local persistence via AsyncStorage. Ported from the web app's
 * storageService.js, which routes between localStorage (guest) and Supabase
 * (signed-in) based on a userId argument — this file keeps that same shape
 * (userId as the first arg to every function) so Phase 2 can add a cloud
 * branch without changing any call sites, exactly like the web app did.
 *
 * For now every function ignores userId and always reads/writes AsyncStorage.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  FAVORITES: "qgame_favorites",
  ANSWERS: "qgame_answers",
  CUSTOM_TAGS: "qgame_custom_tags",
  QUESTION_TAGS: "qgame_question_tags",
};

async function read(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function write(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// ── Favorites ────────────────────────────────────────────────────────────────

export async function getFavorites(_userId) {
  return new Set(await read(KEYS.FAVORITES, []));
}

export async function toggleFavorite(_userId, questionId) {
  const favs = new Set(await read(KEYS.FAVORITES, []));
  const next = favs.has(questionId) ? (favs.delete(questionId), false) : (favs.add(questionId), true);
  await write(KEYS.FAVORITES, Array.from(favs));
  return next;
}

// ── Answers ──────────────────────────────────────────────────────────────────

export async function getAnswers(_userId) {
  return read(KEYS.ANSWERS, {});
}

export async function saveAnswer(_userId, questionId, payload) {
  const answers = await read(KEYS.ANSWERS, {});
  const text = (payload?.text ?? "").trim();
  const choice = payload?.choice ?? null;
  answers[questionId] = { text, choice, timestamp: Date.now() };
  await write(KEYS.ANSWERS, answers);
}

export async function deleteAnswer(_userId, questionId) {
  const answers = await read(KEYS.ANSWERS, {});
  delete answers[questionId];
  await write(KEYS.ANSWERS, answers);
}

// ── Custom Tags ──────────────────────────────────────────────────────────────

export async function getCustomTags(_userId) {
  return read(KEYS.CUSTOM_TAGS, {});
}

export async function saveCustomTag(_userId, slug, label) {
  const tags = await read(KEYS.CUSTOM_TAGS, {});
  tags[slug] = { label, createdAt: tags[slug]?.createdAt ?? Date.now() };
  await write(KEYS.CUSTOM_TAGS, tags);
}

export async function deleteCustomTag(_userId, slug) {
  const tags = await read(KEYS.CUSTOM_TAGS, {});
  delete tags[slug];
  await write(KEYS.CUSTOM_TAGS, tags);
}

// ── Per-question tag overrides ───────────────────────────────────────────────

export async function getQuestionTagOverrides(_userId) {
  return read(KEYS.QUESTION_TAGS, {});
}

export async function setQuestionTags(_userId, questionId, tagSlugs) {
  const overrides = await read(KEYS.QUESTION_TAGS, {});
  overrides[questionId] = Array.from(new Set(tagSlugs));
  await write(KEYS.QUESTION_TAGS, overrides);
}

// ── Stats (derived, no extra storage needed) ─────────────────────────────────

export function deriveStats(allQuestions, answers, favorites) {
  return {
    totalQuestions: allQuestions.length,
    answered: Object.keys(answers).length,
    favorites: favorites.size,
    percentComplete: allQuestions.length
      ? Math.round((Object.keys(answers).length / allQuestions.length) * 100)
      : 0,
  };
}
