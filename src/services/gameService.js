/**
 * Q Game - Game (rounds) service.
 *
 * A "round" is a two-sided guessing game built on the `sent_questions` table:
 *
 *   1. A answers a question and sends it          -> status 'awaiting_b'
 *   2. B guesses A's answer, sees it, answers too  -> status 'awaiting_a'
 *   3. A guesses B's answer, sees it               -> status 'complete'
 *
 * A = initiator (from_user_id), B = recipient (to_user_id). Every call returns
 * normalized round objects the UI can render directly — the question and both
 * parties' usernames are hydrated via joins.
 *
 * Correctness ("did the guess match?") is derived here, not stored. It only
 * applies to choice questions; free-text guesses have no objective verdict.
 */

import { supabase } from "./supabase";

function ready() {
  if (!supabase) throw new Error("Supabase client not configured");
}

// Select shape shared by every round query — joins question + both usernames.
const SELECT =
  "id, status, from_user_id, to_user_id, question_id, note, " +
  "sent_at, b_played_at, completed_at, " +
  "a_answer_text, a_answer_choice, " +
  "b_guess_text, b_guess_choice, b_guess_skipped, " +
  "b_answer_text, b_answer_choice, " +
  "a_guess_text, a_guess_choice, a_guess_skipped, " +
  "question:questions ( id, category, text, tags ), " +
  "sender:profiles!sent_questions_from_user_id_fkey ( username, display_name ), " +
  "recipient:profiles!sent_questions_to_user_id_fkey ( username, display_name )";

function normalize(row) {
  return {
    id: row.id,
    status: row.status,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    questionId: row.question_id,
    note: row.note ?? null,
    sentAt: row.sent_at,
    bPlayedAt: row.b_played_at,
    completedAt: row.completed_at,
    aAnswer: { text: row.a_answer_text ?? "", choice: row.a_answer_choice ?? null },
    bGuess: {
      text: row.b_guess_text ?? "",
      choice: row.b_guess_choice ?? null,
      skipped: !!row.b_guess_skipped,
    },
    bAnswer: { text: row.b_answer_text ?? "", choice: row.b_answer_choice ?? null },
    aGuess: {
      text: row.a_guess_text ?? "",
      choice: row.a_guess_choice ?? null,
      skipped: !!row.a_guess_skipped,
    },
    question: row.question ?? null,
    fromUsername: row.sender?.username ?? null,
    fromDisplayName: row.sender?.display_name ?? null,
    toUsername: row.recipient?.username ?? null,
    toDisplayName: row.recipient?.display_name ?? null,
  };
}

// ── Pure helpers (no I/O) — also used by the UI ───────────────────────────────

/** 'A' if the user initiated the round, 'B' if they received it, else null. */
export function roleOf(round, userId) {
  if (round.fromUserId === userId) return "A";
  if (round.toUserId === userId) return "B";
  return null;
}

/**
 * Is it this user's move? B acts while 'awaiting_b'; A acts while 'awaiting_a'.
 */
export function isYourTurn(round, userId) {
  if (round.status === "awaiting_b") return round.toUserId === userId;
  if (round.status === "awaiting_a") return round.fromUserId === userId;
  return false;
}

/**
 * Verdict for a guess against the real answer. Only choice questions get a
 * true/false; free-text and skipped guesses return null (no objective answer).
 */
export function guessVerdict(guess, actual) {
  if (!guess || guess.skipped) return null;
  if (actual?.choice == null) return null; // free-text — non-scored
  return guess.choice === actual.choice;
}

// ── Start a round ─────────────────────────────────────────────────────────────

/**
 * @param {string} fromUserId
 * @param {string} toUserId
 * @param {string} questionId
 * @param {{text?: string, choice?: string|null}} aAnswer  A's own answer
 * @param {string|null} note
 * @returns {Promise<string>} new round id
 */
export async function startRound(fromUserId, toUserId, questionId, aAnswer, note = null) {
  ready();
  if (fromUserId === toUserId) throw new Error("You can't send a question to yourself.");
  const trimmedNote = (note ?? "").trim();
  const { data, error } = await supabase
    .from("sent_questions")
    .insert({
      from_user_id: fromUserId,
      to_user_id: toUserId,
      question_id: questionId,
      note: trimmedNote || null,
      status: "awaiting_b",
      a_answer_text: (aAnswer?.text ?? "").trim(),
      a_answer_choice: aAnswer?.choice ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// ── B's turn: guess A's answer + give your own ───────────────────────────────

/**
 * @param {string} roundId
 * @param {object} payload
 * @param {{text?: string, choice?: string|null, skipped?: boolean}} payload.guess
 * @param {{text?: string, choice?: string|null}} payload.answer
 */
export async function submitBTurn(roundId, { guess, answer }) {
  ready();
  const { error } = await supabase
    .from("sent_questions")
    .update({
      b_guess_text: (guess?.text ?? "").trim(),
      b_guess_choice: guess?.choice ?? null,
      b_guess_skipped: !!guess?.skipped,
      b_answer_text: (answer?.text ?? "").trim(),
      b_answer_choice: answer?.choice ?? null,
      status: "awaiting_a",
      b_played_at: new Date().toISOString(),
    })
    .eq("id", roundId);
  if (error) throw error;
}

// ── A's turn: guess B's answer (closes the round) ────────────────────────────

/**
 * @param {string} roundId
 * @param {object} payload
 * @param {{text?: string, choice?: string|null, skipped?: boolean}} payload.guess
 */
export async function submitAGuess(roundId, { guess }) {
  ready();
  const { error } = await supabase
    .from("sent_questions")
    .update({
      a_guess_text: (guess?.text ?? "").trim(),
      a_guess_choice: guess?.choice ?? null,
      a_guess_skipped: !!guess?.skipped,
      status: "complete",
      completed_at: new Date().toISOString(),
    })
    .eq("id", roundId);
  if (error) throw error;
}

export async function deleteRound(roundId) {
  ready();
  const { error } = await supabase.from("sent_questions").delete().eq("id", roundId);
  if (error) throw error;
}

// ── Username search (autocomplete) ───────────────────────────────────────────

/**
 * Prefix-match usernames. Caller passes the current user id so the autocomplete
 * never offers them themselves.
 */
export async function searchUsernames(query, selfId) {
  ready();
  const q = String(query ?? "").trim().toLowerCase();
  if (q.length < 2) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .ilike("username", `${q}%`)
    .not("id", "eq", selfId)
    .limit(5);
  if (error) {
    console.warn("[game] searchUsernames:", error.message);
    return [];
  }
  return (data ?? []).map((p) => ({
    id: p.id,
    username: p.username,
    displayName: p.display_name ?? null,
  }));
}

/**
 * Every user with a claimed username (except the caller), alphabetical. Used to
 * populate the recipient dropdown so you can pick a friend without typing —
 * fine while the user base is small; the recipient picker filters client-side.
 */
export async function listUsers(selfId, limit = 100) {
  ready();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name")
    .not("id", "eq", selfId)
    .not("username", "is", null)
    .order("username", { ascending: true })
    .limit(limit);
  if (error) {
    console.warn("[game] listUsers:", error.message);
    return [];
  }
  return (data ?? []).map((p) => ({
    id: p.id,
    username: p.username,
    displayName: p.display_name ?? null,
  }));
}

// ── Lists ────────────────────────────────────────────────────────────────────

/**
 * Every round the user is part of (either side), newest first. The UI splits
 * these into "your turn", "waiting", and "archive".
 */
export async function listRounds(userId) {
  ready();
  const { data, error } = await supabase
    .from("sent_questions")
    .select(SELECT)
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .order("sent_at", { ascending: false });
  if (error) {
    console.warn("[game] listRounds:", error.message);
    return [];
  }
  return (data ?? []).map(normalize);
}

// ── Counts ───────────────────────────────────────────────────────────────────

/**
 * How many rounds are waiting on THIS user to move: rounds sent to them that
 * still need B's turn, plus rounds they sent that have come back for A's guess.
 */
export async function getYourTurnCount(userId) {
  ready();
  const [b, a] = await Promise.all([
    supabase
      .from("sent_questions")
      .select("id", { count: "exact", head: true })
      .eq("to_user_id", userId)
      .eq("status", "awaiting_b"),
    supabase
      .from("sent_questions")
      .select("id", { count: "exact", head: true })
      .eq("from_user_id", userId)
      .eq("status", "awaiting_a"),
  ]);
  if (b.error) console.warn("[game] getYourTurnCount(b):", b.error.message);
  if (a.error) console.warn("[game] getYourTurnCount(a):", a.error.message);
  return (b.count ?? 0) + (a.count ?? 0);
}

// ── Realtime ─────────────────────────────────────────────────────────────────

/**
 * Subscribe to inserts/updates affecting either side of this user's rounds.
 * Returns an `unsubscribe()` thunk. `onChange` fires on every event; the caller
 * decides how to refresh (usually: re-fetch rounds + your-turn count).
 */
export function subscribeToRounds(userId, onChange) {
  if (!supabase || !userId) return () => {};
  const channel = supabase
    .channel(`rounds:${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "sent_questions", filter: `to_user_id=eq.${userId}` },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "sent_questions", filter: `from_user_id=eq.${userId}` },
      onChange,
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
