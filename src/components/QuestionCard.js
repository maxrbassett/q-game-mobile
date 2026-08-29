/**
 * The main swipeable card: category label, question text (or choice
 * buttons), a free-response input, and a favorite toggle. Swipe left/right
 * (or the arrow buttons) move through the deck, mirroring the web app's
 * useSwipe touch-threshold behavior via PanResponder + Animated.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
} from "react-native";
import { useApp } from "../context/AppContext";
import { getChoices } from "../data/choices";
import { CATEGORY_COLORS, fonts, radii } from "../theme";
import ChoiceButtons from "./ChoiceButtons";
import { haptics } from "../services/haptics";

const SWIPE_THRESHOLD = 100;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function QuestionCard({ colors, navigation }) {
  const {
    currentQuestion,
    nextQuestion,
    prevQuestion,
    toggleFavorite,
    isFavorite,
    getAnswer,
    saveAnswer,
    user,
  } = useApp();

  const position = useRef(new Animated.ValueXY()).current;
  const [text, setText] = useState("");

  const choices = currentQuestion ? getChoices(currentQuestion) : null;
  const savedAnswer = currentQuestion ? getAnswer(currentQuestion.id) : null;
  const favorite = currentQuestion ? isFavorite(currentQuestion.id) : false;

  // Reset local text draft when the card changes.
  useEffect(() => {
    setText(savedAnswer?.text ?? "");
  }, [currentQuestion?.id]);

  const animateOffThenAdvance = (direction, advance) => {
    haptics.light();
    Animated.timing(position, {
      toValue: { x: direction * SCREEN_WIDTH * 1.2, y: 0 },
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      position.setValue({ x: 0, y: 0 });
      advance();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_e, gesture) => {
        position.setValue({ x: gesture.dx, y: 0 });
      },
      onPanResponderRelease: (_e, gesture) => {
        if (gesture.dx < -SWIPE_THRESHOLD) {
          animateOffThenAdvance(-1, nextQuestion);
        } else if (gesture.dx > SWIPE_THRESHOLD) {
          animateOffThenAdvance(1, prevQuestion);
        } else {
          Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  if (!currentQuestion) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.inkMuted, fontFamily: fonts.body }}>No questions yet.</Text>
      </View>
    );
  }

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ["-8deg", "0deg", "8deg"],
  });

  const accent = CATEGORY_COLORS[currentQuestion.category] ?? colors.accent;
  const displayText = choices?.displayText ?? currentQuestion.text;
  const hasAnswer = !!(savedAnswer && (savedAnswer.choice || savedAnswer.text?.trim()));

  const handleChoiceSelect = (option) => {
    haptics.selection();
    const nextChoice = savedAnswer?.choice === option ? null : option;
    saveAnswer(currentQuestion.id, { choice: nextChoice, text: "" });
  };

  const handleTextBlur = () => {
    const trimmed = text.trim();
    if (trimmed) saveAnswer(currentQuestion.id, { text: trimmed, choice: null });
  };

  return (
    <View style={styles.wrap}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            transform: [{ translateX: position.x }, { rotate }],
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={[styles.categoryPill, { backgroundColor: `${accent}26`, borderColor: accent }]}>
            <Text style={[styles.categoryText, { color: accent, fontFamily: fonts.bodyMedium }]}>
              {currentQuestion.category}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              haptics.medium();
              toggleFavorite(currentQuestion.id);
            }}
            hitSlop={12}
          >
            <Text style={{ fontSize: 22, color: favorite ? colors.accent : colors.inkFaint }}>
              {favorite ? "★" : "☆"}
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.questionText, { color: colors.ink, fontFamily: fonts.display }]}>
          {displayText}
        </Text>

        {choices ? (
          <ChoiceButtons
            choices={choices}
            selected={savedAnswer?.choice ?? null}
            onSelect={handleChoiceSelect}
            colors={colors}
          />
        ) : (
          <TextInput
            style={[
              styles.input,
              { color: colors.ink, borderColor: colors.border, backgroundColor: colors.surface2, fontFamily: fonts.body },
            ]}
            placeholder="Your answer…"
            placeholderTextColor={colors.inkFaint}
            value={text}
            onChangeText={setText}
            onEndEditing={handleTextBlur}
            multiline
          />
        )}

        {!!user && (
          <View style={styles.footerRow}>
            {hasAnswer && (
              <Text style={{ color: colors.inkMuted, fontSize: 12, fontFamily: fonts.bodyMedium }}>
                ✓ Answered
              </Text>
            )}
            <Pressable
              disabled={!hasAnswer}
              onPress={() =>
                navigation.navigate("SendModal", { question: currentQuestion, answer: savedAnswer })
              }
              style={[
                styles.sendBtn,
                { borderColor: colors.border, backgroundColor: hasAnswer ? colors.accentDim : colors.surface2 },
              ]}
            >
              <Text style={{ color: hasAnswer ? colors.accent : colors.inkFaint, fontFamily: fonts.bodyMedium, fontSize: 13 }}>
                Send to a friend
              </Text>
            </Pressable>
          </View>
        )}
      </Animated.View>

      <View style={styles.navRow}>
        <Pressable
          onPress={() => animateOffThenAdvance(1, prevQuestion)}
          style={[styles.navButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <Text style={{ color: colors.inkMuted, fontSize: 20 }}>‹</Text>
        </Pressable>
        <Pressable
          onPress={() => animateOffThenAdvance(-1, nextQuestion)}
          style={[styles.navButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <Text style={{ color: colors.inkMuted, fontSize: 20 }}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    minHeight: 340,
    borderRadius: radii.card,
    borderWidth: 1,
    padding: 24,
    justifyContent: "flex-start",
    gap: 20,
    // A floating card reads as more "game-like" than a flat bordered box.
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 6,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  questionText: {
    fontSize: 24,
    lineHeight: 32,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    minHeight: 90,
    fontSize: 16,
    textAlignVertical: "top",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sendBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginLeft: "auto",
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 20,
    paddingHorizontal: 8,
  },
  navButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
});
