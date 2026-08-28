/**
 * Q Game - App Context (Phase 2: + auth)
 *
 * Owns the deck, favorites/answers (device or cloud depending on sign-in),
 * and auth state. Mirrors the web app's AppContext.jsx "one context, one
 * storage seam" convention: components call useApp(), never storageService
 * or supabase directly.
 *
 * Auth is email/password for now (see src/screens/SignInScreen.js for why —
 * Expo Go can't do OAuth's custom-scheme redirect). When `user` flips from
 * null -> signed-in, guest data is migrated to the cloud, then all per-user
 * state is re-read from there. Signing out drops back to device storage.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import {
  getFavorites,
  toggleFavorite as toggleFav,
  getAnswers,
  saveAnswer as persistAnswer,
  deleteAnswer as removeAnswer,
  migrateGuestDataToCloud,
  deriveStats,
} from "../services/storageService";
import { supabase, isCloudEnabled } from "../services/supabase";
import { QUESTIONS, getQuestions } from "../data/questions";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [profile, setProfile] = useState(null);
  const prevUserIdRef = useRef(null);

  const [allQuestions] = useState(QUESTIONS);

  const [favorites, setFavorites] = useState(new Set());
  const [answers, setAnswers] = useState({});
  const [ready, setReady] = useState(false);

  const [activeCategory, setActiveCategory] = useState(null);
  const [deck, setDeck] = useState(() => getQuestions({ questions: QUESTIONS }));
  const [currentIndex, setCurrentIndex] = useState(0);

  const userId = user?.id ?? null;

  // ── Bootstrap auth ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setUser(data?.session?.user ?? null);
        setAuthReady(true);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // ── Refresh per-user state whenever the active user changes ────────────────
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const prev = prevUserIdRef.current;
      if (!prev && userId) {
        try {
          await migrateGuestDataToCloud(userId);
        } catch (e) {
          console.warn("[auth] migration failed:", e?.message);
        }
      }
      prevUserIdRef.current = userId;

      const [favs, ans] = await Promise.all([getFavorites(userId), getAnswers(userId)]);
      if (cancelled) return;
      setFavorites(favs);
      setAnswers(ans);
      setReady(true);
    }
    refresh();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // ── Profile (username, display name) ────────────────────────────────────
  const refreshProfile = useCallback(async () => {
    if (!supabase || !userId) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    if (error) console.warn("[profile] fetch:", error.message);
    setProfile(data ?? null);
  }, [userId]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

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
      setDeck(getQuestions({ questions: allQuestions, category: activeCategory }));
      return 0;
    });
  }, [deck.length, allQuestions, activeCategory]);

  const prevQuestion = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const currentQuestion = deck[currentIndex] ?? null;

  // ── Favorites ────────────────────────────────────────────────────────────────
  const toggleFavorite = useCallback(
    async (questionId) => {
      await toggleFav(userId, questionId);
      setFavorites(await getFavorites(userId));
    },
    [userId]
  );

  const isFavorite = useCallback((questionId) => favorites.has(questionId), [favorites]);

  const favoriteQuestions = useMemo(
    () => allQuestions.filter((q) => favorites.has(q.id)),
    [favorites, allQuestions]
  );

  // ── Answers ──────────────────────────────────────────────────────────────────
  const saveAnswer = useCallback(
    async (questionId, payload) => {
      await persistAnswer(userId, questionId, payload);
      setAnswers(await getAnswers(userId));
    },
    [userId]
  );

  const deleteAnswer = useCallback(
    async (questionId) => {
      await removeAnswer(userId, questionId);
      setAnswers(await getAnswers(userId));
    },
    [userId]
  );

  const getAnswer = useCallback((questionId) => answers[questionId] || null, [answers]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(
    () => deriveStats(allQuestions, answers, favorites),
    [allQuestions, answers, favorites]
  );

  // ── Auth actions ─────────────────────────────────────────────────────────
  const signUpWithEmail = useCallback(async (email, password) => {
    if (!supabase) throw new Error("Sign-in is unavailable: Supabase not configured");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signInWithEmail = useCallback(async (email, password) => {
    if (!supabase) throw new Error("Sign-in is unavailable: Supabase not configured");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const claimUsername = useCallback(
    async (username) => {
      if (!supabase || !userId) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").update({ username }).eq("id", userId);
      if (error) throw error;
      await refreshProfile();
    },
    [userId, refreshProfile]
  );

  const value = useMemo(
    () => ({
      ready,
      isCloudEnabled,
      user,
      authReady,
      profile,
      signUpWithEmail,
      signInWithEmail,
      signOut,
      claimUsername,
      refreshProfile,
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
      user,
      authReady,
      profile,
      signUpWithEmail,
      signInWithEmail,
      signOut,
      claimUsername,
      refreshProfile,
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
