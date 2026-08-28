/**
 * Renders the tap-to-select buttons for a parsed `Choices` object
 * (scale | multi | binary — see src/data/choices.js).
 */

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { palettes, fonts, radii } from "../theme";

export default function ChoiceButtons({ choices, selected, onSelect, colors }) {
  const c = colors ?? palettes.dark;
  const isBinary = choices.type === "binary";

  return (
    <View style={isBinary ? styles.binaryRow : styles.wrap}>
      {choices.options.map((option) => {
        const active = selected === option;
        return (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            style={[
              isBinary ? styles.binaryButton : styles.pill,
              {
                backgroundColor: active ? c.accentDim : c.surface2,
                borderColor: active ? c.accent : c.border,
              },
            ]}
          >
            <Text
              style={[
                isBinary ? styles.binaryText : styles.pillText,
                { color: active ? c.accent : c.ink, fontFamily: fonts.bodyMedium },
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
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 15,
  },
  binaryRow: {
    flexDirection: "column",
    gap: 12,
    width: "100%",
  },
  binaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: radii.card,
    borderWidth: 1,
  },
  binaryText: {
    fontSize: 16,
    textAlign: "center",
  },
});
