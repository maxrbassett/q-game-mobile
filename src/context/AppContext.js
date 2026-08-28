/**
 * Q Game - App Context (Phase 1: guest mode)
 *
 * Subset of the web app's AppContext.jsx — the deck, favorites, and answers,
 * all backed by AsyncStorage via storageService.js. No auth yet (Phase 2)
 * and no tags/games yet (Phase 2/3) — this covers exactly what DeckScreen
 * needs today. Mirrors the web app's "one context, one storage seam"
 * convention: components call useApp(), never storageService directly.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import {
  getFavorites,
  toggleFavorite as toggleFav,
  getAnswers,
  saveAnswer as persistAnswer,
  deleteAnswer as removeAnswer,
  deriveStats,
} from "../services/storageService";
import { QUESTIONS, getQuestions } from "../data/questions";

const AppContext = createContext(null);
const GUEST_USER_ID = null;

export function AppProvider({ children }) {
  const [allQuestions] = useState(QUESTIONS);

  const [favorites, setFavorites] = useState(new Set());
  const [answers, setAnswers] = useState({});
  const [ready, setReady] = useState(false);

  const [activeCategory, setActiveCategory] = useState(null);
  const [deck, setDeck] = useState(() => getQuestions({ questions: QUESTIONS }));
  const [currentIndex, setCurrentIndex] = useState(0);

  // ── Bootstrap per-user (device) state ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      const [favs, ans] = await Promise.all([
        getFavorites(GUEST_USER_ID),
        getAnswers(GUEST_USER_ID),
      ]);
      if (cancelled) return;
      setFavorites(favs);
      setAnswers(ans);
      setReady(true);
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Rebuild deck whenever the pool or filter changes ────────────────────────
  useEffect(() => {
    setDeck(getQuestions({ questions: allQuestions, category: activeCategory }));
    setCurrentIndex(0);
  }, [allQuestions, activeCategory]);

  // ── Filter ──────────────────────────────────────────────────────────────────
  const selectCategory = useCallback((category) => {
    setActiveCategory(category);
  }, []);

  const clearFilter = useCallback(() => {
    setActiveCategory(null);
  }, []);

  // ── Deck navigation ─────────────────────────────────────────────────────────
  const nextQuestion = useCallback(() => {
    setCurrentIndex((i) => {
      if (i < deck.length - 1) return i + 1;
      // Reshuffle when the deck is exhausted, same as the web app.
      setDeck(getQuestions({ questions: allQuestions, category: activeCategory }));
      return 0;
    });
  }, [deck.length, allQuestions, activeCategory]);

  const prevQuestion = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const currentQuestion = deck[currentIndex] ?? null;

  // ── Favorites ────────────────────────────────────────────────────────────────
  const toggleFavorite = useCallback(async (questionId) => {
    await toggleFav(GUEST_USER_ID, questionId);
    setFavorites(await getFavorites(GUEST_USER_ID));
  }, []);

  const isFavorite = useCallback((questionId) => favorites.has(questionId), [favorites]);

  const favoriteQuestions = useMemo(
    () => allQuestions.filter((q) => favorites.has(q.id)),
    [favorites, allQuestions]
  );

  // ── Answers ──────────────────────────────────────────────────────────────────
  const saveAnswer = useCallback(async (questionId, payload) => {
    await persistAnswer(GUEST_USER_ID, questionId, payload);
    setAnswers(await getAnswers(GUEST_USER_ID));
  }, []);

  const deleteAnswer = useCallback(async (questionId) => {
    await removeAnswer(GUEST_USER_ID, questionId);
    setAnswers(await getAnswers(GUEST_USER_ID));
  }, []);

  const getAnswer = useCallback((questionId) => answers[questionId] || null, [answers]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(
    () => deriveStats(allQuestions, answers, favorites),
    [allQuestions, answers, favorites]
  );

  const value = useMemo(
    () => ({
      ready,
      allQuestions,
      activeCategory,
      selectCategory,
      clearFilter,
      deck,
      currentIndex,
      currentQuestion,
      nextQuestion,
      prevQuestion,
      toggleFavorite,
      isFavorite,
      favoriteQuestions,
      saveAnswer,
      deleteAnswer,
      getAnswer,
      stats,
    }),
    [
      ready,
      allQuestions,
      activeCategory,
      selectCategory,
      clearFilter,
      deck,
      currentIndex,
      currentQuestion,
      nextQuestion,
      prevQuestion,
      toggleFavorite,
      isFavorite,
      favoriteQuestions,
      saveAnswer,
      deleteAnswer,
      getAnswer,
      stats,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp() must be used within an AppProvider");
  return ctx;
}
