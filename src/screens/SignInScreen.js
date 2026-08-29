/**
 * Account screen: email/password sign-in/sign-up, then a username claim
 * gate, then a signed-in summary with sign-out. Presented as a modal from
 * DeckScreen. Ported from the web app's SignInModal.jsx, with Google
 * replaced by email/password (see AppContext.js header comment for why).
 */

import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../context/AppContext";
import { fonts, radii, VIBES } from "../theme";
import { haptics } from "../services/haptics";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const VIBE_ORDER = ["partier", "thinker", "surfer", "dreamer"];

function VibePicker({ vibeId, setVibe, colors }) {
  if (!setVibe) return null;
  return (
    <View style={{ gap: 10 }}>
      <Text style={[styles.sectionLabel, { color: colors.inkMuted }]}>Appearance</Text>
      <View style={styles.vibeRow}>
        {VIBE_ORDER.map((id) => {
          const vibe = VIBES[id];
          const active = vibeId === id;
          return (
            <Pressable
              key={id}
              onPress={() => {
                haptics.selection();
                setVibe(id);
              }}
              style={[
                styles.vibeChip,
                {
                  backgroundColor: vibe.colors.bg,
                  borderColor: active ? colors.accent : "transparent",
                },
              ]}
            >
              <Text style={{ fontSize: 18 }}>{vibe.emoji}</Text>
              <Text style={{ color: vibe.colors.ink, fontFamily: fonts.bodyMedium, fontSize: 12, marginTop: 4 }}>
                {vibe.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function SignInScreen({ navigation, colors, vibeId, setVibe }) {
  const { isCloudEnabled, user, profile, signUpWithEmail, signInWithEmail, signOut, claimUsername } =
    useApp();

  const [mode, setMode] = useState("signIn"); // "signIn" | "signUp"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [usernameInput, setUsernameInput] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);

  const handleAuthSubmit = async () => {
    setAuthError("");
    setSubmitting(true);
    try {
      if (mode === "signUp") {
        await signUpWithEmail(email.trim(), password);
        setAuthError("Check your email to confirm your account, then sign in.");
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch (err) {
      setAuthError(err?.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaimUsername = async () => {
    const name = usernameInput.trim().toLowerCase();
    if (!USERNAME_RE.test(name)) {
      setUsernameError("3-20 chars: lowercase letters, numbers, underscores.");
      return;
    }
    setSavingUsername(true);
    setUsernameError("");
    try {
      await claimUsername(name);
    } catch (err) {
      setUsernameError(err?.code === "23505" ? "That username is taken. Try another." : err?.message);
    } finally {
      setSavingUsername(false);
    }
  };

  let body;
  if (!isCloudEnabled) {
    body = (
      <Text style={[styles.hint, { color: colors.inkMuted }]}>
        Sign-in isn't configured for this build. Add EXPO_PUBLIC_SUPABASE_URL and
        EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.local and restart the dev server.
      </Text>
    );
  } else if (!user) {
    body = (
      <View style={{ gap: 14 }}>
        <Text style={[styles.lede, { color: colors.ink, fontFamily: fonts.body }]}>
          {mode === "signUp"
            ? "Create an account to sync your favorites and answers, and to play the two-sided game."
            : "Sign in to sync your favorites and answers across devices."}
        </Text>
        <TextInput
          style={[styles.input, { color: colors.ink, borderColor: colors.border, backgroundColor: colors.surface2 }]}
          placeholder="Email"
          placeholderTextColor={colors.inkFaint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={[styles.input, { color: colors.ink, borderColor: colors.border, backgroundColor: colors.surface2 }]}
          placeholder="Password"
          placeholderTextColor={colors.inkFaint}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {!!authError && <Text style={[styles.error, { color: colors.red }]}>{authError}</Text>}
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
          onPress={handleAuthSubmit}
          disabled={submitting || !email || !password}
        >
          <Text style={styles.primaryBtnText}>
            {submitting ? "Please wait…" : mode === "signUp" ? "Create account" : "Sign in"}
          </Text>
        </Pressable>
        <Pressable onPress={() => setMode(mode === "signUp" ? "signIn" : "signUp")}>
          <Text style={[styles.link, { color: colors.accent }]}>
            {mode === "signUp" ? "Already have an account? Sign in" : "New here? Create an account"}
          </Text>
        </Pressable>
      </View>
    );
  } else if (profile && !profile.username) {
    body = (
      <View style={{ gap: 14 }}>
        <Text style={[styles.lede, { color: colors.ink, fontFamily: fonts.body }]}>Pick a username</Text>
        <Text style={[styles.hint, { color: colors.inkMuted }]}>
          This is how friends will find you when sending questions. Letters, numbers, underscores. 3-20 characters.
        </Text>
        <TextInput
          style={[styles.input, { color: colors.ink, borderColor: colors.border, backgroundColor: colors.surface2 }]}
          placeholder="yourname"
          placeholderTextColor={colors.inkFaint}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          value={usernameInput}
          onChangeText={(v) => setUsernameInput(v.toLowerCase())}
        />
        {!!usernameError && <Text style={[styles.error, { color: colors.red }]}>{usernameError}</Text>}
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
          onPress={handleClaimUsername}
          disabled={savingUsername}
        >
          <Text style={styles.primaryBtnText}>{savingUsername ? "Saving…" : "Claim username"}</Text>
        </Pressable>
      </View>
    );
  } else {
    body = (
      <View style={{ gap: 14 }}>
        <Text style={[styles.lede, { color: colors.ink, fontFamily: fonts.body }]}>
          Signed in as <Text style={{ color: colors.accent }}>@{profile?.username}</Text>
        </Text>
        <Pressable
          style={[styles.secondaryBtn, { borderColor: colors.border }]}
          onPress={async () => {
            await signOut();
            navigation.goBack();
          }}
        >
          <Text style={{ color: colors.ink }}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display }]}>Account</Text>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={{ color: colors.inkMuted, fontSize: 22 }}>✕</Text>
          </Pressable>
        </View>
        <VibePicker vibeId={vibeId} setVibe={setVibe} colors={colors} />
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 20 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 24 },
  lede: { fontSize: 16 },
  hint: { fontSize: 13, lineHeight: 18 },
  error: { fontSize: 13 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: radii.pill,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#1a1820",
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
  },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: radii.pill,
    alignItems: "center",
    borderWidth: 1,
  },
  link: {
    fontSize: 14,
    textAlign: "center",
  },
  sectionLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  vibeRow: {
    flexDirection: "row",
    gap: 10,
  },
  vibeChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 2,
  },
});
