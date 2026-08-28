/**
 * Full-screen, step-by-step view of a single round. Ported from the web
 * app's GameView.jsx — same branching on (role, status):
 *
 *   - B during 'awaiting_b':  guess A's answer -> reveal -> answer it yourself
 *   - A during 'awaiting_a':  see B's guess of you -> guess B's answer -> reveal
 *   - not your turn:          a calm "waiting on @them" screen
 *   - 'complete':             the recap, readable by both
 *
 * Receives `round` via the navigation route params (set by GamesListScreen).
 */

import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../context/AppContext";
import { getChoices } from "../data/choices";
import { roleOf, isYourTurn, guessVerdict, submitBTurn, submitAGuess } from "../services/gameService";
import ChoiceRadioGroup from "../components/ChoiceRadioGroup";
import { fonts, radii } from "../theme";

export default function GameViewScreen({ route, navigation, colors }) {
  const { round, onSubmitted } = route.params;
  const { user } = useApp();
  const role = roleOf(round, user?.id);
  const yourTurn = isYourTurn(round, user?.id);

  const flow =
    round.status === "complete" ? "recap" : !yourTurn ? "waiting" : role === "B" ? "bturn" : "aturn";

  const [step, setStep] = useState(flow === "bturn" ? "guess" : flow === "aturn" ? "seeGuess" : flow);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [guessChoice, setGuessChoice] = useState(null);
  const [guessText, setGuessText] = useState("");
  const [guessSkipped, setGuessSkipped] = useState(false);
  const [ansChoice, setAnsChoice] = useState(null);
  const [ansText, setAnsText] = useState("");

  const q = round.question;
  const choices = q ? getChoices(q) : null;
  const hasChoices = !!choices;

  const aName = role === "A" ? "You" : `@${round.fromUsername ?? "them"}`;
  const bName = role === "B" ? "You" : `@${round.toUsername ?? "them"}`;
  const aPoss = role === "A" ? "Your" : `${aName}'s`;
  const bPoss = role === "B" ? "Your" : `${bName}'s`;
  const opponent = role === "B" ? `@${round.fromUsername ?? "them"}` : `@${round.toUsername ?? "them"}`;

  const localGuess = { text: guessText, choice: guessChoice, skipped: guessSkipped };
  const guessReady = guessSkipped || (hasChoices ? !!guessChoice : !!guessText.trim());
  const answerReady = hasChoices ? !!ansChoice : !!ansText.trim();

  const close = () => navigation.goBack();

  const finishBTurn = async () => {
    setBusy(true);
    setError("");
    try {
      await submitBTurn(round.id, { guess: localGuess, answer: { text: ansText, choice: ansChoice } });
      onSubmitted?.();
      setDone(true);
    } catch (e) {
      setError(e?.message ?? "Couldn't send. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const finishAGuess = async () => {
    setBusy(true);
    setError("");
    try {
      await submitAGuess(round.id, { guess: localGuess });
      onSubmitted?.();
      setStep("reveal");
    } catch (e) {
      setError(e?.message ?? "Couldn't save your guess. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Pressable onPress={close} hitSlop={12}>
          <Text style={{ color: colors.inkMuted, fontSize: 22 }}>✕</Text>
        </Pressable>
        <Text style={[styles.headerOpponent, { color: colors.ink, fontFamily: fonts.bodyMedium }]}>{opponent}</Text>
        <Text style={[styles.headerCategory, { color: colors.inkMuted }]}>{q?.category}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[styles.question, { color: colors.ink, fontFamily: fonts.display }]}>
          {choices?.displayText ?? q?.text ?? "(question unavailable)"}
        </Text>

        {done ? (
          <DoneScreen opponent={opponent} onClose={close} colors={colors} />
        ) : flow === "recap" ? (
          <Recap round={round} hasChoices={hasChoices} aName={aName} bName={bName} aPoss={aPoss} bPoss={bPoss} onClose={close} colors={colors} />
        ) : flow === "waiting" ? (
          <Waiting round={round} opponent={opponent} onClose={close} colors={colors} />
        ) : flow === "bturn" ? (
          <BTurn
            step={step}
            setStep={setStep}
            round={round}
            choices={choices}
            hasChoices={hasChoices}
            aName={aName}
            guessChoice={guessChoice}
            setGuessChoice={setGuessChoice}
            guessText={guessText}
            setGuessText={setGuessText}
            setGuessSkipped={setGuessSkipped}
            localGuess={localGuess}
            ansChoice={ansChoice}
            setAnsChoice={setAnsChoice}
            ansText={ansText}
            setAnsText={setAnsText}
            guessReady={guessReady}
            answerReady={answerReady}
            busy={busy}
            onFinish={finishBTurn}
            colors={colors}
          />
        ) : (
          <ATurn
            step={step}
            setStep={setStep}
            round={round}
            choices={choices}
            hasChoices={hasChoices}
            bName={bName}
            guessChoice={guessChoice}
            setGuessChoice={setGuessChoice}
            guessText={guessText}
            setGuessText={setGuessText}
            setGuessSkipped={setGuessSkipped}
            localGuess={localGuess}
            guessReady={guessReady}
            busy={busy}
            onFinish={finishAGuess}
            onClose={close}
            colors={colors}
          />
        )}

        {!!error && <Text style={[styles.error, { color: colors.red }]}>{error}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── B's turn ──────────────────────────────────────────────────────────────────

function BTurn({
  step, setStep, round, choices, hasChoices, aName,
  guessChoice, setGuessChoice, guessText, setGuessText, setGuessSkipped,
  localGuess, ansChoice, setAnsChoice, ansText, setAnsText,
  guessReady, answerReady, busy, onFinish, colors,
}) {
  if (step === "guess") {
    return (
      <>
        <Banner kind="prompt" colors={colors}>Guess what {aName} answered.</Banner>
        {!!round.note && <NoteBlock label={`${aName}'s note`} text={round.note} colors={colors} />}
        <GuessInput
          choices={choices} hasChoices={hasChoices}
          choice={guessChoice} setChoice={setGuessChoice}
          text={guessText} setText={setGuessText}
          placeholder={`What do you think ${aName} said?`}
          colors={colors}
        />
        <View style={styles.actions}>
          {!hasChoices && (
            <Pressable onPress={() => { setGuessSkipped(true); setStep("reveal"); }}>
              <Text style={{ color: colors.inkMuted, fontFamily: fonts.bodyMedium }}>Skip guess</Text>
            </Pressable>
          )}
          <PrimaryButton disabled={!guessReady} onPress={() => setStep("reveal")} colors={colors}>
            Reveal {aName}'s answer
          </PrimaryButton>
        </View>
      </>
    );
  }

  if (step === "reveal") {
    const verdict = guessVerdict(localGuess, round.aAnswer);
    return (
      <>
        <VerdictBanner verdict={verdict} skipped={localGuess.skipped} subjectPoss="Your" colors={colors} />
        {!localGuess.skipped && <AnswerCard label="You guessed" answer={localGuess} hasChoices={hasChoices} muted colors={colors} />}
        <AnswerCard label={`${aName} actually said`} answer={round.aAnswer} hasChoices={hasChoices} highlight colors={colors} />
        <View style={styles.actions}>
          <PrimaryButton onPress={() => setStep("answer")} colors={colors}>Now answer it yourself</PrimaryButton>
        </View>
      </>
    );
  }

  return (
    <>
      <Banner kind="prompt" colors={colors}>Your turn — how do you answer?</Banner>
      <GuessInput
        choices={choices} hasChoices={hasChoices}
        choice={ansChoice} setChoice={setAnsChoice}
        text={ansText} setText={setAnsText}
        placeholder="Type your answer…"
        colors={colors}
      />
      <View style={styles.actions}>
        <PrimaryButton disabled={!answerReady || busy} onPress={onFinish} colors={colors}>
          {busy ? "Sending…" : `Send back to ${aName}`}
        </PrimaryButton>
      </View>
    </>
  );
}

// ── A's turn ──────────────────────────────────────────────────────────────────

function ATurn({
  step, setStep, round, choices, hasChoices, bName,
  guessChoice, setGuessChoice, guessText, setGuessText, setGuessSkipped,
  localGuess, guessReady, busy, onFinish, onClose, colors,
}) {
  if (step === "seeGuess") {
    const bGuessedRight = guessVerdict(round.bGuess, round.aAnswer);
    return (
      <>
        <Banner kind="info" colors={colors}>{bName} played your round!</Banner>
        <VerdictBanner verdict={bGuessedRight} skipped={round.bGuess.skipped} subjectName={bName} context="reading you" colors={colors} />
        {!round.bGuess.skipped && <AnswerCard label={`${bName} guessed you'd say`} answer={round.bGuess} hasChoices={hasChoices} muted colors={colors} />}
        <AnswerCard label="Your answer was" answer={round.aAnswer} hasChoices={hasChoices} colors={colors} />
        <View style={styles.actions}>
          <PrimaryButton onPress={() => setStep("guess")} colors={colors}>Now guess what {bName} said</PrimaryButton>
        </View>
      </>
    );
  }

  if (step === "guess") {
    return (
      <>
        <Banner kind="prompt" colors={colors}>Guess what {bName} actually answered.</Banner>
        <GuessInput
          choices={choices} hasChoices={hasChoices}
          choice={guessChoice} setChoice={setGuessChoice}
          text={guessText} setText={setGuessText}
          placeholder={`What do you think ${bName} said?`}
          colors={colors}
        />
        <View style={styles.actions}>
          {!hasChoices && (
            <Pressable disabled={busy} onPress={() => { setGuessSkipped(true); onFinish(); }}>
              <Text style={{ color: colors.inkMuted, fontFamily: fonts.bodyMedium }}>Skip guess</Text>
            </Pressable>
          )}
          <PrimaryButton disabled={!guessReady || busy} onPress={onFinish} colors={colors}>
            {busy ? "Saving…" : `Reveal ${bName}'s answer`}
          </PrimaryButton>
        </View>
      </>
    );
  }

  const verdict = guessVerdict(localGuess, round.bAnswer);
  return (
    <>
      <VerdictBanner verdict={verdict} skipped={localGuess.skipped} subjectPoss="Your" colors={colors} />
      {!localGuess.skipped && <AnswerCard label="You guessed" answer={localGuess} hasChoices={hasChoices} muted colors={colors} />}
      <AnswerCard label={`${bName} actually said`} answer={round.bAnswer} hasChoices={hasChoices} highlight colors={colors} />
      <Banner kind="done" colors={colors}>Round complete — saved to your archive.</Banner>
      <BackButton onPress={onClose} colors={colors} />
    </>
  );
}

// ── Waiting / Recap / Done ──────────────────────────────────────────────────

function Waiting({ round, opponent, onClose, colors }) {
  const msg =
    round.status === "awaiting_b"
      ? `Waiting for ${opponent} to guess your answer.`
      : `Waiting for ${opponent} to guess your answer back.`;
  return (
    <View style={styles.center}>
      <Text style={{ fontSize: 40 }}>⏳</Text>
      <Text style={[styles.waitingText, { color: colors.ink, fontFamily: fonts.body }]}>{msg}</Text>
      <Text style={[styles.waitingSub, { color: colors.inkMuted }]}>You'll be nudged when it's your move.</Text>
      <BackButton onPress={onClose} colors={colors} />
    </View>
  );
}

function Recap({ round, hasChoices, aName, bName, aPoss, bPoss, onClose, colors }) {
  const bOnA = guessVerdict(round.bGuess, round.aAnswer);
  const aOnB = guessVerdict(round.aGuess, round.bAnswer);
  return (
    <>
      <Banner kind="done" colors={colors}>Round complete</Banner>
      <AnswerCard label={`${aPoss} answer`} answer={round.aAnswer} hasChoices={hasChoices} highlight colors={colors} />
      <AnswerCard label={`${bName} guessed`} answer={round.bGuess} hasChoices={hasChoices} verdict={bOnA} muted colors={colors} />
      <View style={[styles.divider, { borderColor: colors.border }]} />
      <AnswerCard label={`${bPoss} answer`} answer={round.bAnswer} hasChoices={hasChoices} highlight colors={colors} />
      <AnswerCard label={`${aName} guessed`} answer={round.aGuess} hasChoices={hasChoices} verdict={aOnB} muted colors={colors} />
      <BackButton onPress={onClose} colors={colors} />
    </>
  );
}

function DoneScreen({ opponent, onClose, colors }) {
  return (
    <View style={styles.center}>
      <Text style={{ fontSize: 34, color: colors.accent }}>✓</Text>
      <Text style={[styles.waitingText, { color: colors.ink, fontFamily: fonts.body }]}>Sent back to {opponent}.</Text>
      <Text style={[styles.waitingSub, { color: colors.inkMuted }]}>
        They'll see how you did and guess your answer next.
      </Text>
      <BackButton onPress={onClose} colors={colors} />
    </View>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────────────

function PrimaryButton({ children, onPress, disabled, colors }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.primaryBtn, { backgroundColor: disabled ? colors.surface2 : colors.accent }]}
    >
      <Text style={{ color: disabled ? colors.inkFaint : "#1a1820", fontFamily: fonts.bodyMedium, fontSize: 15 }}>
        {children}
      </Text>
    </Pressable>
  );
}

function BackButton({ onPress, colors }) {
  return (
    <Pressable onPress={onPress} style={[styles.backBtn, { borderColor: colors.border }]}>
      <Text style={{ color: colors.ink, fontFamily: fonts.bodyMedium }}>‹ Back to games</Text>
    </Pressable>
  );
}

function Banner({ kind, children, colors }) {
  const bg = kind === "correct" ? colors.accentDim : kind === "wrong" ? colors.redDim : colors.surface2;
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Text style={{ color: colors.ink, fontFamily: fonts.bodyMedium }}>{children}</Text>
    </View>
  );
}

function VerdictBanner({ verdict, skipped, subjectName, subjectPoss, context, colors }) {
  const who = subjectPoss ?? (subjectName ? `${subjectName}'s` : "The");
  if (skipped) return <Banner kind="neutral" colors={colors}>{who} guess was skipped — here's the answer.</Banner>;
  if (verdict === null) return <Banner kind="neutral" colors={colors}>No right answer here — compare and see.</Banner>;
  if (verdict) {
    return (
      <Banner kind="correct" colors={colors}>
        🎯 {subjectName ? `${subjectName} nailed it${context ? ` — good at ${context}!` : "!"}` : "Nailed it!"}
      </Banner>
    );
  }
  return <Banner kind="wrong" colors={colors}>❌ {subjectName ? `${subjectName} missed this one.` : "Not quite."}</Banner>;
}

function NoteBlock({ label, text, colors }) {
  return (
    <View style={[styles.note, { backgroundColor: colors.surface2 }]}>
      <Text style={{ color: colors.inkMuted, fontSize: 12, fontFamily: fonts.bodyMedium }}>{label}</Text>
      <Text style={{ color: colors.ink, marginTop: 4 }}>{text}</Text>
    </View>
  );
}

function AnswerCard({ label, answer, hasChoices, highlight, muted, verdict, colors }) {
  const choice = answer?.choice ?? null;
  const text = answer?.text ?? "";
  const empty = !choice && !text.trim();
  const bg = highlight ? colors.accentDim : muted ? colors.surface2 : colors.surface;
  return (
    <View style={[styles.answerCard, { backgroundColor: bg, borderColor: colors.border }]}>
      <View style={styles.answerLabelRow}>
        <Text style={{ color: colors.inkMuted, fontSize: 12, fontFamily: fonts.bodyMedium }}>{label}</Text>
        {verdict === true && <Text style={{ color: colors.accent, fontSize: 12 }}>right ✓</Text>}
        {verdict === false && <Text style={{ color: colors.red, fontSize: 12 }}>wrong ✗</Text>}
      </View>
      {empty ? (
        <Text style={{ color: colors.inkFaint, fontStyle: "italic", marginTop: 6 }}>
          {answer?.skipped ? "(skipped)" : "(no answer)"}
        </Text>
      ) : (
        <>
          {!!choice && (
            <Text style={{ color: colors.ink, fontFamily: fonts.bodyMedium, marginTop: 6 }}>{choice}</Text>
          )}
          {!!text.trim() && (
            <Text style={{ color: colors.ink, marginTop: 6 }}>
              {hasChoices && choice ? `“${text.trim()}”` : text.trim()}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

function GuessInput({ choices, hasChoices, choice, setChoice, text, setText, placeholder, colors }) {
  return (
    <View style={{ gap: 12 }}>
      {hasChoices && <ChoiceRadioGroup choices={choices} choice={choice} onChange={setChoice} colors={colors} />}
      <TextInput
        style={[styles.textarea, { color: colors.ink, borderColor: colors.border, backgroundColor: colors.surface2 }]}
        placeholder={hasChoices ? "Add a note (optional)…" : placeholder}
        placeholderTextColor={colors.inkFaint}
        value={text}
        onChangeText={setText}
        multiline
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerOpponent: { fontSize: 15 },
  headerCategory: { fontSize: 12 },
  body: { padding: 20, gap: 16 },
  question: { fontSize: 20, lineHeight: 27 },
  center: { alignItems: "center", gap: 8, paddingVertical: 24 },
  waitingText: { fontSize: 16, textAlign: "center", marginTop: 8 },
  waitingSub: { fontSize: 13, textAlign: "center" },
  actions: { gap: 12, alignItems: "flex-start" },
  primaryBtn: {
    alignSelf: "stretch",
    paddingVertical: 14,
    borderRadius: radii.pill,
    alignItems: "center",
  },
  backBtn: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignSelf: "center",
  },
  banner: {
    padding: 14,
    borderRadius: radii.card,
  },
  note: {
    padding: 12,
    borderRadius: 12,
  },
  answerCard: {
    padding: 14,
    borderRadius: radii.card,
    borderWidth: 1,
  },
  answerLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    minHeight: 70,
    fontSize: 15,
    textAlignVertical: "top",
  },
  divider: {
    borderTopWidth: 1,
    marginVertical: 4,
  },
  error: {
    fontSize: 13,
  },
});
