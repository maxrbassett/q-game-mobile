/**
 * The main swipeable card, ported to match the web app's QuestionCard.jsx
 * feature set: progress bar + counter, category label, question text (or
 * choice buttons), a tag row, a footer (answered badge / send / favorite),
 * a separate collapsible "answer / additional thoughts" section, and
 * full-width Prev/Next buttons.
 *
 * Swipe left/right (or the nav buttons) move through the deck. Uses
 * react-native-gesture-handler's Pan gesture rather than core PanResponder —
 * the card lives inside a ScrollView (the answer section below it needs to
 * scroll), and PanResponder's JS-thread-only gesture arbitration doesn't
 * negotiate cleanly with an enclosing ScrollView (symptom: the swipe
 * randomly "gets stuck"). Gesture Handler's native recognizer resolves that
 * correctly via activeOffsetX/failOffsetY below.
 */

import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Animated, Dimensions } from "react-native";
import { ScrollView, Gesture, GestureDetector } from "react-native-gesture-handler";
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

  const position = useRef(new Animated.ValueXY()).current;
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

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      position.setValue({ x: e.translationX, y: 0 });
    })
    .onEnd((e) => {
      if (e.translationX < -SWIPE_THRESHOLD) {
        animateOffThenAdvance(-1, nextQuestion);
      } else if (e.translationX > SWIPE_THRESHOLD) {
        animateOffThenAdvance(1, prevQuestion);
      } else {
        Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
      }
    });

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
              transform: [{ translateX: position.x }, { rotate }],
            },
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
          onPress={() => currentIndex > 0 && animateOffThenAdvance(1, prevQuestion)}
          disabled={currentIndex === 0}
          style={[styles.navButton, { borderColor: colors.border, backgroundColor: colors.surface, opacity: currentIndex === 0 ? 0.35 : 1 }]}
        >
          <Text style={{ color: colors.inkMuted, fontFamily: fonts.bodyMedium }}>‹ Prev</Text>
        </Pressable>
        <Pressable
          onPress={() => animateOffThenAdvance(-1, nextQuestion)}
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
