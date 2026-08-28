import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../context/AppContext";
import CategoryFilter from "../components/CategoryFilter";
import QuestionCard from "../components/QuestionCard";
import { fonts } from "../theme";

export default function DeckScreen({ colors, navigation }) {
  const { ready, stats, user, profile } = useApp();

  if (!ready) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]}>
        <View style={styles.center}>
          <Text style={{ color: colors.inkMuted, fontFamily: fonts.body }}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const accountLabel = user ? (profile?.username ? `@${profile.username}` : "Account") : "Sign in";

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display }]}>Q Game</Text>
          <Text style={[styles.subtitle, { color: colors.inkMuted, fontFamily: fonts.body }]}>
            {stats.answered} of {stats.totalQuestions} answered
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate("SignIn")}
          style={[styles.accountPill, { borderColor: colors.border, backgroundColor: colors.surface2 }]}
        >
          <Text style={{ color: colors.inkMuted, fontFamily: fonts.bodyMedium, fontSize: 13 }}>
            {accountLabel}
          </Text>
        </Pressable>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
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
  accountPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 100,
    borderWidth: 1,
    marginTop: 6,
  },
});
