/**
 * Q Game - App Context (Phase 2: + auth)
 *
 * Owns the deck, favorites/answers (device or cloud depending on sign-in),
 * and auth state. Mirrors the web app's AppContext.jsx "one context, one
 * storage seam" convention: components call useApp(), never storageService
 * or supabase directly.
 *
 * Auth supports Google (the provider the web app uses, so existing accounts
 * work) and email/password. When `user` flips from null -> signed-in, guest
 * data is migrated to the cloud, then all per-user state is re-read from
 * there. Signing out drops back to device storage.
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
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import {
  getFavorites,
  toggleFavorite as toggleFav,
  getAnswers,
  saveAnswer as persistAnswer,
  deleteAnswer as removeAnswer,
  getCustomTags,
  saveCustomTag,
  getQuestionTagOverrides,
  setQuestionTags as persistQuestionTags,
  migrateGuestDataToCloud,
  deriveStats,
} from "../services/storageService";
import { supabase, isCloudEnabled } from "../services/supabase";
import { QUESTIONS, getQuestions } from "../data/questions";
import {
  slugify,
  effectiveTagsFor,
  tagLabel,
  getBuiltInTagSlugs,
  BUILT_IN_TAG_LABELS,
} from "../data/tags";
import { getYourTurnCount, subscribeToRounds } from "../services/gameService";

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
  const [customTags, setCustomTags] = useState({});
  const [tagOverrides, setTagOverrides] = useState({});
  const [ready, setReady] = useState(false);

  const [activeCategory, setActiveCategory] = useState(null);
  const [activeTag, setActiveTag] = useState(null);
  const [deck, setDeck] = useState(() => getQuestions({ questions: QUESTIONS }));
  const [currentIndex, setCurrentIndex] = useState(0);

  const [yourTurnCount, setYourTurnCount] = useState(0);

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

      const [favs, ans, ct, overrides] = await Promise.all([
        getFavorites(userId),
        getAnswers(userId),
        getCustomTags(userId),
        getQuestionTagOverrides(userId),
      ]);
      if (cancelled) return;
      setFavorites(favs);
      setAnswers(ans);
      setCustomTags(ct);
      setTagOverrides(overrides);
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

  // ── Your-turn badge: fetch count + subscribe to realtime round changes ─────
  const refreshGames = useCallback(async () => {
    if (!userId) {
      setYourTurnCount(0);
      return;
    }
    setYourTurnCount(await getYourTurnCount(userId));
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setYourTurnCount(0);
      return;
    }
    refreshGames();
    const unsub = subscribeToRounds(userId, () => {
      refreshGames();
    });
    return unsub;
  }, [userId, refreshGames]);

  // ── Rebuild deck whenever the pool or filter changes ────────────────────────
  useEffect(() => {
    setDeck(
      getQuestions({ questions: allQuestions, category: activeCategory, tag: activeTag, tagOverrides })
    );
    setCurrentIndex(0);
  }, [allQuestions, activeCategory, activeTag, tagOverrides]);

  // ── Filter ──────────────────────────────────────────────────────────────────
  const selectCategory = useCallback((category) => {
    setActiveCategory(category);
    setActiveTag(null);
  }, []);

  const selectTag = useCallback((tag) => {
    setActiveTag(tag);
    setActiveCategory(null);
  }, []);

  const clearFilter = useCallback(() => {
    setActiveCategory(null);
    setActiveTag(null);
  }, []);

  // ── Deck navigation ─────────────────────────────────────────────────────────
  const nextQuestion = useCallback(() => {
    setCurrentIndex((i) => {
      if (i < deck.length - 1) return i + 1;
      setDeck(
        getQuestions({ questions: allQuestions, category: activeCategory, tag: activeTag, tagOverrides })
      );
      return 0;
    });
  }, [deck.length, allQuestions, activeCategory, activeTag, tagOverrides]);

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

  // ── Tags ─────────────────────────────────────────────────────────────────────
  const allTags = useMemo(() => {
    const builtInSlugs = getBuiltInTagSlugs(allQuestions);
    const customSlugs = Object.keys(customTags);
    const seen = new Set([...builtInSlugs, ...customSlugs, ...Object.keys(BUILT_IN_TAG_LABELS)]);

    const counts = {};
    for (const q of allQuestions) {
      const tags = effectiveTagsFor(q, tagOverrides);
      for (const t of tags) {
        counts[t] = (counts[t] || 0) + 1;
        seen.add(t);
      }
    }

    return Array.from(seen)
      .map((slug) => ({
        slug,
        label: tagLabel(slug, customTags),
        count: counts[slug] || 0,
        isCustom: !BUILT_IN_TAG_LABELS[slug] && !builtInSlugs.has(slug),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [customTags, tagOverrides, allQuestions]);

  const getTagsForQuestion = useCallback(
    (question) => effectiveTagsFor(question, tagOverrides),
    [tagOverrides]
  );

  const setTagsForQuestion = useCallback(
    async (questionId, tagSlugs) => {
      await persistQuestionTags(userId, questionId, tagSlugs);
      setTagOverrides(await getQuestionTagOverrides(userId));
    },
    [userId]
  );

  const createTag = useCallback(
    async (label) => {
      const trimmed = String(label).trim();
      if (!trimmed) return null;
      const slug = slugify(trimmed);
      if (!slug) return null;
      const builtIn = getBuiltInTagSlugs(allQuestions);
      if (!BUILT_IN_TAG_LABELS[slug] && !builtIn.has(slug)) {
        await saveCustomTag(userId, slug, trimmed);
        setCustomTags(await getCustomTags(userId));
      }
      return slug;
    },
    [userId, allQuestions]
  );

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(
    () => deriveStats(allQuestions, answers, favorites),
    [allQuestions, answers, favorites]
  );

  // ── Auth actions ─────────────────────────────────────────────────────────

  /**
   * Google OAuth via an in-app browser session.
   *
   * Supabase brokers the whole exchange: Google only ever redirects to
   * Supabase's own /auth/v1/callback (already registered in the Google Cloud
   * console for the web app), and Supabase then redirects back here. So the
   * only place this app's redirect URL has to be allowlisted is Supabase
   * itself — Auth > URL Configuration > Redirect URLs.
   *
   * In Expo Go, Linking.createURL() yields an exp://<lan-ip>:8081/--/... URL
   * that changes with the network, so the allowlist needs a wildcard entry
   * (exp://**). A standalone build uses the stable qgame:// scheme declared
   * in app.json instead.
   */
  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error("Sign-in is unavailable: Supabase not configured");

    const redirectTo = Linking.createURL("auth-callback");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data?.url) throw new Error("Couldn't start Google sign-in.");

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success") return false; // user dismissed the sheet

    // PKCE returns ?code=... on the redirect; trade it for a session.
    const code = Linking.parse(result.url)?.queryParams?.code;
    if (!code) throw new Error("Google sign-in didn't return a code.");
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(String(code));
    if (exchangeError) throw exchangeError;
    return true;
  }, []);

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
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      signOut,
      claimUsername,
      refreshProfile,
      yourTurnCount,
      refreshGames,
      allQuestions,
      activeCategory,
      activeTag,
      selectCategory,
      selectTag,
      clearFilter,
      allTags,
      customTags,
      getTagsForQuestion,
      setTagsForQuestion,
      createTag,
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
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      signOut,
      claimUsername,
      refreshProfile,
      yourTurnCount,
      refreshGames,
      allQuestions,
      activeCategory,
      activeTag,
      selectCategory,
      selectTag,
      clearFilter,
      allTags,
      customTags,
      getTagsForQuestion,
      setTagsForQuestion,
      createTag,
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
