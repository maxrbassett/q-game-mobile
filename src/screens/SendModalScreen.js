/**
 * Recipient picker + note, then starts a round. Ported from the web app's
 * SendModal.jsx. Receives `question` and `answer` via route params (set by
 * QuestionCard's send button).
 */

import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../context/AppContext";
import { listUsers, startRound } from "../services/gameService";
import { getChoices } from "../data/choices";
import { fonts, radii } from "../theme";
import { haptics } from "../services/haptics";

export default function SendModalScreen({ route, navigation, colors }) {
  const { question, answer } = route.params;
  const { user } = useApp();

  const [query, setQuery] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [picked, setPicked] = useState(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState(null);

  const choices = question ? getChoices(question) : null;
  const answerLabel = answer?.choice ?? (answer?.text?.trim() ? `“${answer.text.trim()}”` : "—");

  useEffect(() => {
    let cancelled = false;
    listUsers(user?.id).then((list) => {
      if (cancelled) return;
      setAllUsers(list);
      setLoadingUsers(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? allUsers.filter(
        (p) => p.username.toLowerCase().includes(q) || (p.displayName && p.displayName.toLowerCase().includes(q))
      )
    : allUsers;

  const handleSend = async () => {
    if (!picked || !question) return;
    setSending(true);
    setError("");
    try {
      await startRound(user.id, picked.id, question.id, answer ?? {}, note);
      haptics.success();
      setSentTo(picked);
    } catch (err) {
      setError(err?.message ?? "Failed to send.");
    } finally {
      setSending(false);
    }
  };

  if (sentTo) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]}>
        <View style={styles.successBlock}>
          <Text style={{ fontSize: 40, color: colors.accent }}>✓</Text>
          <Text style={[styles.successText, { color: colors.ink, fontFamily: fonts.body }]}>
            Round started with <Text style={{ color: colors.accent }}>@{sentTo.username}</Text>
          </Text>
          <Text style={{ color: colors.inkMuted, fontSize: 13, textAlign: "center", marginTop: 4 }}>
            They'll guess your answer, then it comes back for you to guess theirs.
          </Text>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: colors.accent, marginTop: 20 }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={{ color: "#1a1820", fontFamily: fonts.bodyMedium }}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display }]}>Start a round</Text>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={{ color: colors.inkMuted, fontSize: 22 }}>✕</Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 20, gap: 16, flex: 1 }}>
        {!!question && (
          <View style={[styles.preview, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
            <Text style={{ color: colors.accent, fontSize: 11, textTransform: "uppercase" }}>{question.category}</Text>
            <Text style={{ color: colors.ink, marginTop: 6 }}>{choices?.displayText ?? question.text}</Text>
            <View style={styles.previewAnswer}>
              <Text style={{ color: colors.inkMuted, fontSize: 12 }}>Your answer (they'll guess it)</Text>
              <Text style={{ color: colors.ink, fontFamily: fonts.bodyMedium }}>{answerLabel}</Text>
            </View>
          </View>
        )}

        <Text style={[styles.label, { color: colors.inkMuted }]}>To</Text>
        {picked ? (
          <View style={styles.pickedRow}>
            <Text style={{ color: colors.ink, fontFamily: fonts.bodyMedium }}>
              @{picked.username}
              {picked.displayName ? ` · ${picked.displayName}` : ""}
            </Text>
            <Pressable onPress={() => { setPicked(null); setQuery(""); }}>
              <Text style={{ color: colors.accent }}>Change</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <TextInput
              style={[styles.input, { color: colors.ink, borderColor: colors.border, backgroundColor: colors.surface2 }]}
              placeholder="search or pick a friend"
              placeholderTextColor={colors.inkFaint}
              autoCapitalize="none"
              autoCorrect={false}
              value={query}
              onChangeText={(v) => setQuery(v.toLowerCase())}
            />
            <FlatList
              data={filtered}
              keyExtractor={(p) => p.id}
              style={{ maxHeight: 220 }}
              ListEmptyComponent={
                <Text style={{ color: colors.inkFaint, padding: 10 }}>
                  {loadingUsers ? "Loading…" : allUsers.length === 0 ? "No other users yet." : "No matches."}
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.resultRow, { borderColor: colors.border }]}
                  onPress={() => { setPicked(item); setQuery(`@${item.username}`); }}
                >
                  <Text style={{ color: colors.ink, fontFamily: fonts.bodyMedium }}>@{item.username}</Text>
                  {!!item.displayName && <Text style={{ color: colors.inkMuted, fontSize: 12 }}>{item.displayName}</Text>}
                </Pressable>
              )}
            />
          </>
        )}

        <Text style={[styles.label, { color: colors.inkMuted }]}>Note (optional)</Text>
        <TextInput
          style={[styles.textarea, { color: colors.ink, borderColor: colors.border, backgroundColor: colors.surface2 }]}
          placeholder="thought of you when I saw this…"
          placeholderTextColor={colors.inkFaint}
          value={note}
          onChangeText={setNote}
          maxLength={500}
          multiline
        />

        {!!error && <Text style={{ color: colors.red, fontSize: 13 }}>{error}</Text>}

        <Pressable
          style={[styles.primaryBtn, { backgroundColor: !picked || sending ? colors.surface2 : colors.accent }]}
          onPress={handleSend}
          disabled={!picked || sending}
        >
          <Text style={{ color: !picked || sending ? colors.inkFaint : "#1a1820", fontFamily: fonts.bodyMedium }}>
            {sending ? "Sending…" : "Send"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  title: { fontSize: 22 },
  preview: { padding: 14, borderRadius: radii.card, borderWidth: 1 },
  previewAnswer: { marginTop: 10, gap: 2 },
  label: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 15 },
  pickedRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  textarea: { borderWidth: 1, borderRadius: 14, padding: 12, minHeight: 60, textAlignVertical: "top" },
  primaryBtn: { paddingVertical: 14, borderRadius: radii.pill, alignItems: "center" },
  successBlock: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  successText: { fontSize: 16, textAlign: "center", marginTop: 12 },
});
