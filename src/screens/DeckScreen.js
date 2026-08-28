import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../context/AppContext";
import CategoryFilter from "../components/CategoryFilter";
import QuestionCard from "../components/QuestionCard";
import { fonts } from "../theme";

export default function DeckScreen({ colors }) {
  const { ready, stats } = useApp();

  if (!ready) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]}>
        <View style={styles.center}>
          <Text style={{ color: colors.inkMuted, fontFamily: fonts.body }}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display }]}>Q Game</Text>
        <Text style={[styles.subtitle, { color: colors.inkMuted, fontFamily: fonts.body }]}>
          {stats.answered} of {stats.totalQuestions} answered
        </Text>
      </View>
      <CategoryFilter colors={colors} />
      <QuestionCard colors={colors} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 28,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
});
