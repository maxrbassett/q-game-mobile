/**
 * The main swipeable card, ported to match the web app's QuestionCard.jsx
 * feature set: progress bar + counter, category label, question text (or
 * choice buttons), a tag row, a footer (answered badge / send / favorite),
 * a separate collapsible "answer / additional thoughts" section, and
 * full-width Prev/Next buttons.
 *
 * Swipe left/right (or the nav buttons) move through the deck.
 *
 * The gesture/animation stack here is deliberate. The card sits inside a
 * ScrollView (the answer section below it has to scroll), so the swipe uses
 * Gesture Handler's native recognizer — core PanResponder arbitrates on the
 * JS thread and fights the enclosing ScrollView for the touch. The drag
 * itself is driven by Reanimated shared values on the UI thread rather than
 * core Animated: mixing `Animated.timing({useNativeDriver: true})` with
 * per-frame `setValue()` calls leaves the native node holding the last
 * animated value, which stranded the card off-screen (it looked like cards
 * were vanishing). Shared values keep drag, fling, and reset in one system.
 */

import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Dimensions } from "react-native";
import { ScrollView, Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
} from "react-native-reanimated";
import { useApp } from "../context/AppContext";
import { getChoices } from "../data/choices";
import { tagLabel } from "../data/tags";
import { CATEGORY_COLORS, fonts, radii } from "../theme";
import ChoiceButtons from "./ChoiceButtons";
import TagPickerModal from "./TagPickerModal";
import { haptics } from "../services/haptics";

const SWIPE_THRESHOLD = 100;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function QuestionCard({ colors, navigation }) {
  const {
    currentQuestion,
    currentIndex,
    deck,
    nextQuestion,
    prevQuestion,
    toggleFavorite,
    isFavorite,
    getAnswer,
    saveAnswer,
    deleteAnswer,
    getTagsForQuestion,
    setTagsForQuestion,
    selectTag,
    user,
  } = useApp();

  const translateX = useSharedValue(0);
  const [answerOpen, setAnswerOpen] = useState(true);
  const [answerText, setAnswerText] = useState("");
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);

  const choices = currentQuestion ? getChoices(currentQuestion) : null;
  const hasChoices = !!choices;
  const questionTags = currentQuestion ? getTagsForQuestion(currentQuestion) : [];
  const favorite = currentQuestion ? isFavorite(currentQuestion.id) : false;

  // Reset local answer draft + reopen the answer section when the card changes.
  useEffect(() => {
    if (!currentQuestion) return;
    const existing = getAnswer(currentQuestion.id);
    setAnswerText(existing?.text ?? "");
    setSelectedChoice(existing?.choice ?? null);
    setAnswerOpen(true);
  }, [currentQuestion?.id]);

  /**
   * Runs on the JS thread once the fly-out finishes: swap the question and
   * snap the card back to centre in the same tick, so the incoming card is
   * never painted at the old off-screen offset. Doing the reset here (rather
   * than keying it off a question-id change) also covers the case where the
   * index doesn't actually move — swiping right at index 0 — which would
   * otherwise leave the card stranded off-screen.
   */
  const commitAdvance = useCallback(
    (goNext) => {
      haptics.light();
      if (goNext) nextQuestion();
      else prevQuestion();
      translateX.value = 0;
    },
    [nextQuestion, prevQuestion, translateX]
  );

  const flyOut = useCallback(
    (goNext) => {
      translateX.value = withTiming(
        (goNext ? -1 : 1) * SCREEN_WIDTH * 1.2,
        { duration: 180 },
        (finished) => {
          if (finished) runOnJS(commitAdvance)(goNext);
        }
      );
    },
    [commitAdvance, translateX]
  );

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.2, { duration: 180 }, (finished) => {
          if (finished) runOnJS(commitAdvance)(true);
        });
      } else if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SCREEN_WIDTH * 1.2, { duration: 180 }, (finished) => {
          if (finished) runOnJS(commitAdvance)(false);
        });
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const deg = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-8, 0, 8],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateX: translateX.value }, { rotate: `${deg}deg` }],
    };
  });

  if (!currentQuestion) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.inkMuted, fontFamily: fonts.body }}>No questions yet.</Text>
      </View>
    );
  }

  const accent = CATEGORY_COLORS[currentQuestion.category] ?? colors.accent;
  const displayText = choices?.displayText ?? currentQuestion.text;
  const existingAnswer = getAnswer(currentQuestion.id);
  const hasAnswer = !!existingAnswer;

  const persist = (nextChoice, nextText) => {
    const text = (nextText ?? "").trim();
    if (!text && !nextChoice) {
      deleteAnswer(currentQuestion.id);
    } else {
      saveAnswer(currentQuestion.id, { text, choice: nextChoice ?? null });
    }
  };

  const handleChoiceSelect = (option) => {
    haptics.selection();
    const next = selectedChoice === option ? null : option;
    setSelectedChoice(next);
    persist(next, answerText);
  };

  const handleSave = () => {
    haptics.success();
    persist(selectedChoice, answerText);
  };

  const handleDelete = () => {
    deleteAnswer(currentQuestion.id);
    setAnswerText("");
    setSelectedChoice(null);
  };

  const handleRemoveTag = (slug) => {
    setTagsForQuestion(currentQuestion.id, questionTags.filter((t) => t !== slug));
  };

  const toggleLabel = hasChoices
    ? answerText
      ? "Edit additional thoughts"
      : "Add additional thoughts"
    : hasAnswer
      ? "Edit my answer"
      : "Write my answer";

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.wrapContent} keyboardShouldPersistTaps="handled">
      {/* Progress bar + counter */}
      <View style={[styles.progressTrack, { backgroundColor: colors.surface2 }]}>
        <View
          style={[
            styles.progressBar,
            { backgroundColor: accent, width: `${((currentIndex + 1) / Math.max(deck.length, 1)) * 100}%` },
          ]}
        />
      </View>
      <Text style={[styles.counter, { color: colors.inkFaint }]}>
        {currentIndex + 1} / {deck.length}
      </Text>

      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderTopColor: accent,
            },
            cardAnimatedStyle,
          ]}
        >
          <Text style={[styles.categoryText, { color: accent, fontFamily: fonts.bodyMedium }]}>
            {currentQuestion.category}
          </Text>

          <Text style={[styles.questionText, { color: colors.ink, fontFamily: fonts.display }]}>
            {displayText}
          </Text>

          {hasChoices && (
            <ChoiceButtons choices={choices} selected={selectedChoice} onSelect={handleChoiceSelect} colors={colors} />
          )}

          <View style={styles.tagRow}>
            {questionTags.map((slug) => (
              <TagChip key={slug} slug={slug} colors={colors} onPress={selectTag} onRemove={handleRemoveTag} />
            ))}
            <Pressable
              onPress={() => setTagPickerOpen(true)}
              style={[styles.tagAddBtn, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.inkMuted, fontSize: 12 }}>+ tag</Text>
            </Pressable>
          </View>

          <View style={styles.footerRow}>
            {hasAnswer ? (
              <Text style={[styles.answeredBadge, { color: "#47e87a" }]}>✓ Answered</Text>
            ) : (
              <View />
            )}
            <View style={styles.footerRight}>
              {!!user && (
                <Pressable
                  disabled={!hasAnswer}
                  onPress={() =>
                    navigation.navigate("SendModal", { question: currentQuestion, answer: existingAnswer })
                  }
                  style={[
                    styles.roundBtn,
                    { backgroundColor: colors.surface2, opacity: hasAnswer ? 1 : 0.35 },
                  ]}
                >
                  <Text style={{ fontSize: 18, color: hasAnswer ? colors.accent : colors.inkMuted }}>➤</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => {
                  haptics.medium();
                  toggleFavorite(currentQuestion.id);
                }}
                style={[styles.roundBtn, { backgroundColor: colors.surface2 }]}
              >
                <Text style={{ fontSize: 20, color: favorite ? colors.accent : colors.inkMuted }}>
                  {favorite ? "♥" : "♡"}
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>

      {/* Answer / additional-thoughts section */}
      <View style={[styles.answerSection, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Pressable style={styles.answerToggle} onPress={() => setAnswerOpen((v) => !v)}>
          <Text style={{ fontSize: 15 }}>✎</Text>
          <Text style={[styles.answerToggleText, { color: colors.inkMuted, fontFamily: fonts.body }]}>
            {toggleLabel}
          </Text>
          <Text style={{ color: colors.inkFaint, marginLeft: "auto" }}>{answerOpen ? "︿" : "﹀"}</Text>
        </Pressable>

        {answerOpen && (
          <View style={styles.answerBody}>
            <TextInput
              style={[styles.textarea, { color: colors.ink, borderColor: colors.border, backgroundColor: colors.surface2 }]}
              placeholder={hasChoices ? "Additional thoughts (optional)…" : "Type your answer here…"}
              placeholderTextColor={colors.inkFaint}
              value={answerText}
              onChangeText={setAnswerText}
              multiline
            />
            <View style={styles.answerActions}>
              {hasAnswer && (
                <Pressable onPress={handleDelete}>
                  <Text style={{ color: colors.red, fontFamily: fonts.bodyMedium }}>Delete</Text>
                </Pressable>
              )}
              <Pressable
                onPress={handleSave}
                disabled={!answerText.trim() && !hasAnswer}
                style={[
                  styles.saveBtn,
                  { backgroundColor: !answerText.trim() && !hasAnswer ? colors.surface2 : accent, marginLeft: "auto" },
                ]}
              >
                <Text style={{ color: !answerText.trim() && !hasAnswer ? colors.inkFaint : "#1a1820", fontFamily: fonts.bodyMedium }}>
                  {hasAnswer ? "Update" : "Save"} {hasChoices ? "Notes" : "Answer"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <View style={styles.navRow}>
        <Pressable
          onPress={() => currentIndex > 0 && flyOut(false)}
          disabled={currentIndex === 0}
          style={[styles.navButton, { borderColor: colors.border, backgroundColor: colors.surface, opacity: currentIndex === 0 ? 0.35 : 1 }]}
        >
          <Text style={{ color: colors.inkMuted, fontFamily: fonts.bodyMedium }}>‹ Prev</Text>
        </Pressable>
        <Pressable
          onPress={() => flyOut(true)}
          style={[styles.navButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <Text style={{ color: colors.inkMuted, fontFamily: fonts.bodyMedium }}>Next ›</Text>
        </Pressable>
      </View>

      <Text style={[styles.swipeHint, { color: colors.inkFaint }]}>← swipe or tap Prev / Next →</Text>

      <TagPickerModal
        visible={tagPickerOpen}
        question={currentQuestion}
        onClose={() => setTagPickerOpen(false)}
        colors={colors}
      />
    </ScrollView>
  );
}

function TagChip({ slug, colors, onPress, onRemove }) {
  const { customTags } = useApp();
  const label = tagLabel(slug, customTags);
  return (
    <View style={[styles.tagChip, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
      <Pressable onPress={() => onPress(slug)}>
        <Text style={{ color: colors.inkMuted, fontSize: 12 }}>{label}</Text>
      </Pressable>
      <Pressable onPress={() => onRemove(slug)} hitSlop={6} style={{ marginLeft: 4 }}>
        <Text style={{ color: colors.inkFaint, fontSize: 12 }}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  wrapContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    height: 2,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 2,
  },
  counter: {
    textAlign: "right",
    fontSize: 11,
    letterSpacing: 0.5,
    marginTop: -6,
  },
  card: {
    width: "100%",
    borderRadius: radii.card,
    borderWidth: 1,
    borderTopWidth: 3,
    padding: 20,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 6,
  },
  categoryText: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  questionText: {
    fontSize: 22,
    lineHeight: 30,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 100,
    borderWidth: 1,
  },
  tagAddBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 100,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  answeredBadge: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
  },
  footerRight: {
    flexDirection: "row",
    gap: 8,
    marginLeft: "auto",
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  answerSection: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  answerToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
  },
  answerToggleText: {
    fontSize: 14,
  },
  answerBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 12,
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    fontSize: 15,
    textAlignVertical: "top",
  },
  answerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  saveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
  },
  navRow: {
    flexDirection: "row",
    gap: 10,
  },
  navButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  swipeHint: {
    textAlign: "center",
    fontSize: 11,
  },
});
