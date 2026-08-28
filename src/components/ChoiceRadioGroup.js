/**
 * Radio-style choice buttons used inside a guess/answer input during a game
 * turn (as opposed to ChoiceButtons.js, used on the main deck card).
 * Functionally the same idea, kept separate because GameView's styling
 * context (dark overlay, compact layout) differs from the card.
 */

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { fonts, radii } from "../theme";

export default function ChoiceRadioGroup({ choices, choice, onChange, colors }) {
  return (
    <View style={styles.wrap}>
      {choices.options.map((opt) => {
        const active = choice === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(active ? null : opt)}
            style={[
              styles.btn,
              { backgroundColor: active ? colors.accentDim : colors.surface2, borderColor: active ? colors.accent : colors.border },
            ]}
          >
            <Text style={{ color: active ? colors.accent : colors.ink, fontFamily: fonts.bodyMedium, fontSize: 14 }}>
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});
