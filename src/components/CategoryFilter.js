import React from "react";
import { ScrollView, View, Text, Pressable, StyleSheet } from "react-native";
import { useApp } from "../context/AppContext";
import { CATEGORIES } from "../data/questions";
import { CATEGORY_COLORS, fonts, radii } from "../theme";

const CATEGORY_ICONS = {
  [CATEGORIES.WOULD_YOU_RATHER]: "⚖️",
  [CATEGORIES.WHICH_IS_WORSE]: "😬",
  [CATEGORIES.HOW_MUCH]: "💸",
  [CATEGORIES.RATE_BELIEVE]: "🤔",
  [CATEGORIES.RATE_LIKE]: "❤️",
  [CATEGORIES.HAVE_YOU_EVER]: "✋",
  [CATEGORIES.TELL_A_TIME]: "💬",
};

export default function CategoryFilter({ colors }) {
  const { activeCategory, activeTag, selectCategory, selectTag, clearFilter, allTags } = useApp();
  const categories = Object.values(CATEGORIES);
  const noneActive = !activeCategory && !activeTag;
  const tagsToShow = allTags.filter((t) => t.count > 0 || t.isCustom);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      <Pill label="All" active={noneActive} onPress={clearFilter} color={colors.accent} colors={colors} />
      {categories.map((category) => (
        <Pill
          key={category}
          label={category}
          icon={CATEGORY_ICONS[category]}
          active={activeCategory === category}
          onPress={() => selectCategory(category)}
          color={CATEGORY_COLORS[category] ?? colors.accent}
          colors={colors}
        />
      ))}
      {tagsToShow.length > 0 && (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {tagsToShow.map((t) => (
            <Pill
              key={t.slug}
              label={t.label}
              icon="#"
              active={activeTag === t.slug}
              onPress={() => selectTag(t.slug)}
              color={colors.accent}
              colors={colors}
            />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function Pill({ label, icon, active, onPress, color, colors }) {
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
      {!!icon && <Text style={{ fontSize: 13 }}>{icon} </Text>}
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
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 13,
  },
  divider: {
    width: 1,
    height: 20,
    marginHorizontal: 4,
  },
});
