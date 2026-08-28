import React from "react";
import { ScrollView, Text, Pressable, StyleSheet } from "react-native";
import { useApp } from "../context/AppContext";
import { CATEGORIES } from "../data/questions";
import { CATEGORY_COLORS, fonts, radii } from "../theme";

export default function CategoryFilter({ colors }) {
  const { activeCategory, selectCategory, clearFilter } = useApp();
  const categories = Object.values(CATEGORIES);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <Pill
        label="All"
        active={!activeCategory}
        onPress={clearFilter}
        color={colors.accent}
        colors={colors}
      />
      {categories.map((category) => (
        <Pill
          key={category}
          label={category}
          active={activeCategory === category}
          onPress={() => selectCategory(category)}
          color={CATEGORY_COLORS[category] ?? colors.accent}
          colors={colors}
        />
      ))}
    </ScrollView>
  );
}

function Pill({ label, active, onPress, color, colors }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: active ? `${color}26` : colors.surface2,
          borderColor: active ? color : colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.pillText,
          { color: active ? color : colors.inkMuted, fontFamily: fonts.bodyMedium },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 13,
  },
});
