/**
 * List of rounds the user is part of, split into Your turn / Waiting /
 * Archive sections. Ported from the web app's GamesList.jsx. Tapping a row
 * navigates to GameViewScreen with the round in route params.
 */

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../context/AppContext";
import { listRounds, roleOf, isYourTurn, guessVerdict, deleteRound } from "../services/gameService";
import { fonts, radii } from "../theme";

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function GamesListScreen({ navigation, colors }) {
  const { user, refreshGames } = useApp();
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const r = await listRounds(user.id);
    setRounds(r);
    setLoading(false);
    refreshGames?.();
  }, [user, refreshGames]);

  useEffect(() => {
    load();
    const unsub = navigation.addListener("focus", load);
    return unsub;
  }, [load, navigation]);

  if (!user) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]}>
        <View style={styles.empty}>
          <Text style={{ color: colors.inkMuted, fontFamily: fonts.body, textAlign: "center" }}>
            Sign in to play the two-sided game with friends.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const uid = user.id;
  const yourTurn = rounds.filter((r) => isYourTurn(r, uid));
  const waiting = rounds.filter((r) => r.status !== "complete" && !isYourTurn(r, uid));
  const archive = rounds.filter((r) => r.status === "complete");

  const handleDelete = async (round) => {
    await deleteRound(round.id);
    setRounds((prev) => prev.filter((r) => r.id !== round.id));
    refreshGames?.();
  };

  const openRound = (round) => {
    navigation.navigate("GameView", { round, onSubmitted: load });
  };

  const sections = [
    { title: "Your turn", data: yourTurn },
    { title: "Waiting", data: waiting },
    { title: "Archive", data: archive, deletable: true },
  ].filter((s) => s.data.length > 0);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display }]}>Games</Text>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={{ color: colors.inkMuted, fontSize: 22 }}>✕</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.empty}>
          <Text style={{ color: colors.inkMuted }}>Loading…</Text>
        </View>
      ) : rounds.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 32 }}>🎲</Text>
          <Text style={{ color: colors.ink, fontFamily: fonts.body, marginTop: 8, textAlign: "center" }}>
            No games yet.
          </Text>
          <Text style={{ color: colors.inkMuted, fontSize: 13, marginTop: 4, textAlign: "center" }}>
            Answer a question, tap send, and challenge a friend to guess your answer.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(s) => s.title}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item: section }) => (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.inkMuted, fontFamily: fonts.bodyMedium }]}>
                {section.title} <Text style={{ color: colors.accent }}>{section.data.length}</Text>
              </Text>
              {section.data.map((round) => (
                <RoundRow
                  key={round.id}
                  round={round}
                  uid={uid}
                  colors={colors}
                  onOpen={openRound}
                  onDelete={section.deletable ? handleDelete : null}
                />
              ))}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function RoundRow({ round, uid, colors, onOpen, onDelete }) {
  const role = roleOf(round, uid);
  const opponent = role === "B" ? round.fromUsername : round.toUsername;
  const yours = isYourTurn(round, uid);

  let pill;
  if (round.status === "complete") pill = "Done";
  else if (yours) pill = "Your turn";
  else pill = `Waiting on @${opponent ?? "them"}`;

  let score = null;
  if (round.status === "complete") {
    const bOnA = guessVerdict(round.bGuess, round.aAnswer);
    const aOnB = guessVerdict(round.aGuess, round.bAnswer);
    const youCorrect = role === "A" ? aOnB : bOnA;
    const themCorrect = role === "A" ? bOnA : aOnB;
    const mark = (v) => (v === null ? "—" : v ? "✓" : "✗");
    score = `You ${mark(youCorrect)} · @${opponent ?? "them"} ${mark(themCorrect)}`;
  }

  return (
    <View style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Pressable style={styles.rowBtn} onPress={() => onOpen(round)}>
        <View style={styles.rowTop}>
          <Text style={{ color: colors.inkMuted, fontSize: 13 }}>
            {role === "B" ? "from " : "to "}
            <Text style={{ color: colors.ink, fontFamily: fonts.bodyMedium }}>@{opponent ?? "unknown"}</Text>
          </Text>
          <Text
            style={[
              styles.pill,
              {
                color: round.status === "complete" ? colors.inkMuted : yours ? colors.accent : colors.inkFaint,
                backgroundColor: round.status === "complete" ? colors.surface2 : yours ? colors.accentDim : colors.surface2,
              },
            ]}
          >
            {pill}
          </Text>
        </View>
        <Text style={{ color: colors.ink, marginTop: 6 }} numberOfLines={2}>
          {round.question?.text ?? "(question unavailable)"}
        </Text>
        <View style={styles.rowMeta}>
          <Text style={{ color: colors.inkMuted, fontSize: 12 }}>
            {score ?? round.question?.category}
          </Text>
          <Text style={{ color: colors.inkFaint, fontSize: 12 }}>
            {timeAgo(round.completedAt ?? round.bPlayedAt ?? round.sentAt)}
          </Text>
        </View>
      </Pressable>
      {onDelete && (
        <Pressable onPress={() => onDelete(round)} hitSlop={10} style={styles.deleteBtn}>
          <Text style={{ color: colors.inkFaint, fontSize: 16 }}>🗑</Text>
        </Pressable>
      )}
    </View>
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
  title: { fontSize: 24 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  section: { paddingHorizontal: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  row: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: radii.card,
    marginBottom: 8,
    overflow: "hidden",
  },
  rowBtn: { flex: 1, padding: 14 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pill: {
    fontSize: 11,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 100,
    overflow: "hidden",
  },
  rowMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  deleteBtn: { justifyContent: "center", paddingHorizontal: 14 },
});
