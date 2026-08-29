/**
 * Q Game - Design Tokens
 *
 * Instead of a system-driven dark/light toggle, the app has four named
 * "vibes" the user picks once on the Welcome screen (src/screens/
 * WelcomeScreen.js) and can change later from the Account screen. Each vibe
 * is a complete, self-contained palette (not a dark/light pair) — some are
 * dark-background, some light, whichever suits the personality.
 */

import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const VIBES = {
  partier: {
    label: "Partier",
    tagline: "Bold, loud, up for anything",
    emoji: "🎉",
    isDark: true,
    colors: {
      bg: "#180a20",
      surface: "#261233",
      surface2: "#371a49",
      border: "rgba(255,255,255,0.10)",

      ink: "#fdf2ff",
      inkMuted: "rgba(253,242,255,0.55)",
      inkFaint: "rgba(253,242,255,0.22)",

      accent: "#ff2e88",
      accentDim: "rgba(255,46,136,0.18)",
      accentGlow: "rgba(255,46,136,0.4)",

      red: "#ff5252",
      redDim: "rgba(255,82,82,0.15)",

      frameBg: "#0d0512",
    },
  },
  thinker: {
    label: "Thinker",
    tagline: "Subtle, sharp, always weighing it",
    emoji: "🧠",
    isDark: true,
    colors: {
      bg: "#12161c",
      surface: "#1b2129",
      surface2: "#242c36",
      border: "rgba(255,255,255,0.07)",

      ink: "#eef1f4",
      inkMuted: "rgba(238,241,244,0.5)",
      inkFaint: "rgba(238,241,244,0.2)",

      accent: "#7fb8a4",
      accentDim: "rgba(127,184,164,0.15)",
      accentGlow: "rgba(127,184,164,0.3)",

      red: "#d97a6c",
      redDim: "rgba(217,122,108,0.12)",

      frameBg: "#0a0d11",
    },
  },
  surfer: {
    label: "Surfer",
    tagline: "Easygoing, salt air, go with it",
    emoji: "🌊",
    isDark: false,
    colors: {
      bg: "#f0f9f8",
      surface: "#ffffff",
      surface2: "#dcf0ee",
      border: "rgba(10,60,60,0.10)",

      ink: "#0b3d3a",
      inkMuted: "rgba(11,61,58,0.55)",
      inkFaint: "rgba(11,61,58,0.25)",

      accent: "#ff8657",
      accentDim: "rgba(255,134,87,0.15)",
      accentGlow: "rgba(255,134,87,0.35)",

      red: "#e0503a",
      redDim: "rgba(224,80,58,0.12)",

      frameBg: "#d8ece9",
    },
  },
  dreamer: {
    label: "Dreamer",
    tagline: "Soft-focus, head in the clouds",
    emoji: "✨",
    isDark: false,
    colors: {
      bg: "#fbf3fb",
      surface: "#ffffff",
      surface2: "#f3e6f7",
      border: "rgba(90,60,110,0.10)",

      ink: "#3a2a4a",
      inkMuted: "rgba(58,42,74,0.55)",
      inkFaint: "rgba(58,42,74,0.22)",

      accent: "#9b7fe8",
      accentDim: "rgba(155,127,232,0.15)",
      accentGlow: "rgba(155,127,232,0.35)",

      red: "#e0698f",
      redDim: "rgba(224,105,143,0.12)",

      frameBg: "#f0e2f2",
    },
  },
};

export const CATEGORY_COLORS = {
  "Would You Rather": "#e8c547",
  "Which Is Worse": "#e85d47",
  "How Much Would It Take": "#47c5e8",
  "Rate How Much You Believe": "#9b47e8",
  "Rate How Much You Like": "#e847c5",
  "Have You Ever": "#47e87a",
  "Tell About a Time": "#e88547",
  "Your Opinion": "#47e8c5",
};

export const radii = {
  card: 20,
  pill: 100,
};

export const fonts = {
  display: "Fraunces_500Medium",
  displaySemibold: "Fraunces_600SemiBold",
  body: "DMSans_400Regular",
  bodyMedium: "DMSans_500Medium",
};

const VIBE_KEY = "qgame_vibe";
const DEFAULT_VIBE = "thinker";

/**
 * Persisted vibe selection. `vibeId` is `null` until AsyncStorage has been
 * read (`ready` flips true) or until the user has never picked one — the
 * caller (App.js) uses that to decide whether to show WelcomeScreen.
 * @returns {[ string|null, (id: string) => void, object, boolean ]}
 *   [vibeId, setVibe, colors, ready]
 */
export function useVibe() {
  const [vibeId, setVibeId] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(VIBE_KEY).then((stored) => {
      if (stored && VIBES[stored]) setVibeId(stored);
      setReady(true);
    });
  }, []);

  const setVibe = useCallback((id) => {
    if (!VIBES[id]) return;
    setVibeId(id);
    AsyncStorage.setItem(VIBE_KEY, id).catch(() => {});
  }, []);

  const colors = VIBES[vibeId ?? DEFAULT_VIBE].colors;

  return [vibeId, setVibe, colors, ready];
}
