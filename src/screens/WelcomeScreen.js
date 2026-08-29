/**
 * First-launch screen: pick a "vibe" (one of four named personality
 * palettes — see src/theme.js) before entering the app. Persisted via
 * useVibe(), so this only shows once per install unless the user resets it
 * from the Account screen.
 *
 * Rendered standalone (no navigation stack yet) from App.js, before
 * RootNavigator mounts — nothing else in the app needs to exist yet for
 * this screen to work.
 */

import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { VIBES, fonts, radii } from "../theme";
import { haptics } from "../services/haptics";

const VIBE_ORDER = ["partier", "thinker", "surfer", "dreamer"];

export default function WelcomeScreen({ onPick }) {
  const [selected, setSelected] = useState(null);

  const handlePick = (id) => {
    haptics.selection();
    setSelected(id);
    // Small pause so the tap's highlight is visible before the app switches
    // its entire palette out from under the user.
    setTimeout(() => onPick(id), 220);
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: "#12161c" }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { fontFamily: fonts.display }]}>Q Game</Text>
        <Text style={styles.subtitle}>What's your vibe?</Text>
        <Text style={styles.hint}>Pick a look — you can change it later.</Text>
      </View>

      <View style={styles.grid}>
        {VIBE_ORDER.map((id) => {
          const vibe = VIBES[id];
          const active = selected === id;
          return (
            <Pressable
              key={id}
              onPress={() => handlePick(id)}
              style={[
                styles.card,
                {
                  backgroundColor: vibe.colors.bg,
                  borderColor: active ? vibe.colors.accent : "transparent",
                },
              ]}
            >
              <Text style={styles.emoji}>{vibe.emoji}</Text>
              <Text style={[styles.cardLabel, { color: vibe.colors.ink, fontFamily: fonts.displaySemibold }]}>
                {vibe.label}
              </Text>
              <Text style={[styles.cardTagline, { color: vibe.colors.inkMuted }]}>{vibe.tagline}</Text>
              <View style={styles.swatchRow}>
                <View style={[styles.swatch, { backgroundColor: vibe.colors.accent }]} />
                <View style={[styles.swatch, { backgroundColor: vibe.colors.surface2 }]} />
                <View style={[styles.swatch, { backgroundColor: vibe.colors.ink }]} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },
  title: {
    color: "#fff",
    fontSize: 30,
  },
  subtitle: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "DMSans_500Medium",
    marginTop: 12,
  },
  hint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginTop: 4,
  },
  grid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    gap: 16,
  },
  card: {
    width: "45%",
    flexGrow: 1,
    borderRadius: radii.card,
    borderWidth: 2,
    padding: 18,
    justifyContent: "flex-end",
    minHeight: 190,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 5,
  },
  emoji: {
    fontSize: 30,
    marginBottom: 10,
  },
  cardLabel: {
    fontSize: 19,
  },
  cardTagline: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  swatchRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 14,
  },
  swatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
});
