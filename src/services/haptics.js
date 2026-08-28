/**
 * Thin wrapper around expo-haptics. Every call is wrapped in a no-throw
 * guard — haptics are a nice-to-have, never worth crashing a turn over
 * (e.g. the iOS Simulator has no Taptic Engine and would otherwise reject).
 */

import * as Haptics from "expo-haptics";

function safe(fn) {
  try {
    fn();
  } catch {}
}

export const haptics = {
  selection: () => safe(() => Haptics.selectionAsync()),
  light: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
