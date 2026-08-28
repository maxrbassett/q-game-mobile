/**
 * Q Game - Design Tokens
 *
 * Ported from the web app's src/styles/globals.css CSS custom properties.
 * Two palettes (dark/light); useTheme() below picks one and persists an
 * explicit override across launches.
 */

import { useState, useEffect, useCallback } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const palettes = {
  dark: {
    bg: "#0f0e11",
    surface: "#1a1820",
    surface2: "#232130",
    border: "rgba(255,255,255,0.08)",

    ink: "#f0ece8",
    inkMuted: "rgba(240,236,232,0.5)",
    inkFaint: "rgba(240,236,232,0.2)",

    accent: "#e8c547",
    accentDim: "rgba(232,197,71,0.15)",
    accentGlow: "rgba(232,197,71,0.35)",

    red: "#e85d47",
    redDim: "rgba(232,93,71,0.15)",

    frameBg: "#07060a",
  },
  light: {
    bg: "#f5f1ea",
    surface: "#fffdf8",
    surface2: "#ede6d8",
    border: "rgba(26,24,32,0.10)",

    ink: "#1a1820",
    inkMuted: "rgba(26,24,32,0.55)",
    inkFaint: "rgba(26,24,32,0.25)",

    accent: "#b8902a",
    accentDim: "rgba(184,144,42,0.15)",
    accentGlow: "rgba(184,144,42,0.35)",

    red: "#d04d33",
    redDim: "rgba(208,77,51,0.12)",

    frameBg: "#ebe5d8",
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

const THEME_KEY = "qgame_theme";

/**
 * Persisted theme ("dark" | "light"). Defaults to the system preference on
 * first load, then sticks with the user's explicit choice.
 * @returns {[ "dark" | "light", () => void, ReturnType<typeof palettes.dark> ]}
 */
export function useTheme() {
  const [theme, setTheme] = useState(() => Appearance.getColorScheme() ?? "dark");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (stored === "dark" || stored === "light") setTheme(stored);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(THEME_KEY, theme).catch(() => {});
  }, [theme, loaded]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }, []);

  return [theme, toggle, palettes[theme]];
}
