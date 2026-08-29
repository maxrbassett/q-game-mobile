/**
 * Renders the tap-to-select buttons for a parsed `Choices` object
 * (scale | multi | binary — see src/data/choices.js).
 *
 * Matches the web app's QuestionCard.module.css layout: binary/multi are a
 * single column of full-width rectangular buttons, scale is a 3-column
 * grid of compact tiles. All share the same 12px-radius rectangular style
 * (not a pill) — the pill shape is reserved for filter chips elsewhere.
 */

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { VIBES, fonts } from "../theme";

export default function ChoiceButtons({ choices, selected, onSelect, colors }) {
  const c = colors ?? VIBES.thinker.colors;
  const isScale = choices.type === "scale";

  return (
    <View style={isScale ? styles.scaleGrid : styles.column}>
      {choices.options.map((option) => {
        const active = selected === option;
        return (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            style={[
              isScale ? styles.scaleButton : styles.button,
              {
                backgroundColor: active ? c.accentDim : c.surface2,
                borderColor: active ? c.accent : c.border,
              },
            ]}
          >
            <Text
              style={[
                isScale ? styles.scaleText : styles.buttonText,
                { color: active ? c.accent : c.ink, fontFamily: fonts.body },
              ]}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    gap: 8,
  },
  button: {
    width: "100%",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 15,
  },
  scaleGrid: {
    flexDirection: "row",
    gap: 8,
  },
  scaleButton: {
    flex: 1,
    minHeight: 56,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scaleText: {
    fontSize: 13,
    textAlign: "center",
  },
});
