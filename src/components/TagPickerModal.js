/**
 * Search/create/toggle tags for a question. Ported from the web app's
 * TagPicker.jsx as a React Native Modal instead of a floating overlay div.
 */

import React, { useMemo, useState } from "react";
import { Modal, View, Text, TextInput, Pressable, FlatList, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../context/AppContext";
import { slugify } from "../data/tags";
import { fonts, radii } from "../theme";
import { haptics } from "../services/haptics";

export default function TagPickerModal({ visible, question, onClose, colors }) {
  const { allTags, createTag, getTagsForQuestion, setTagsForQuestion } = useApp();

  const [selected, setSelected] = useState(() => new Set(question ? getTagsForQuestion(question) : []));
  const [query, setQuery] = useState("");

  // Reset local selection whenever the modal opens for a (possibly new) question.
  const [openedFor, setOpenedFor] = useState(null);
  if (visible && question && openedFor !== question.id) {
    setOpenedFor(question.id);
    setSelected(new Set(getTagsForQuestion(question)));
    if (query) setQuery("");
  }

  const trimmedQuery = query.trim();
  const querySlug = slugify(trimmedQuery);

  const filteredTags = useMemo(() => {
    if (!trimmedQuery) return allTags;
    const q = trimmedQuery.toLowerCase();
    return allTags.filter((t) => t.label.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q));
  }, [allTags, trimmedQuery]);

  const exactMatchExists = useMemo(() => allTags.some((t) => t.slug === querySlug), [allTags, querySlug]);

  const toggle = (slug) => {
    haptics.selection();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!trimmedQuery || exactMatchExists) return;
    const slug = await createTag(trimmedQuery);
    if (slug) {
      setSelected((prev) => new Set(prev).add(slug));
      setQuery("");
    }
  };

  const handleSave = () => {
    if (question) setTagsForQuestion(question.id, Array.from(selected));
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.ink, fontFamily: fonts.display }]}>Tags</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={{ color: colors.inkMuted, fontSize: 22 }}>✕</Text>
          </Pressable>
        </View>

        <TextInput
          style={[styles.search, { color: colors.ink, borderColor: colors.border, backgroundColor: colors.surface2 }]}
          placeholder="Search or create a tag…"
          placeholderTextColor={colors.inkFaint}
          autoCapitalize="none"
          autoCorrect={false}
          value={query}
          onChangeText={setQuery}
        />

        <FlatList
          style={styles.list}
          data={filteredTags}
          keyExtractor={(t) => t.slug}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            !trimmedQuery ? (
              <Text style={{ color: colors.inkFaint, padding: 16 }}>No tags yet. Type to create one.</Text>
            ) : null
          }
          renderItem={({ item }) => {
            const checked = selected.has(item.slug);
            return (
              <Pressable style={styles.row} onPress={() => toggle(item.slug)}>
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: checked ? colors.accent : colors.border, backgroundColor: checked ? colors.accent : "transparent" },
                  ]}
                >
                  {checked && <Text style={{ color: "#1a1820", fontSize: 12 }}>✓</Text>}
                </View>
                <Text style={[styles.rowLabel, { color: colors.ink }]}>{item.label}</Text>
                {item.isCustom && (
                  <Text style={{ color: colors.inkFaint, fontSize: 10, marginRight: 6 }}>custom</Text>
                )}
                <Text style={{ color: colors.inkFaint, fontSize: 12 }}>{item.count}</Text>
              </Pressable>
            );
          }}
          ListFooterComponent={
            trimmedQuery && !exactMatchExists ? (
              <Pressable style={styles.row} onPress={handleCreate}>
                <View style={[styles.checkbox, { borderColor: colors.accent, borderStyle: "dashed" }]}>
                  <Text style={{ color: colors.accent, fontSize: 12 }}>+</Text>
                </View>
                <Text style={{ color: colors.ink }}>
                  Create "<Text style={{ fontFamily: fonts.bodyMedium }}>{trimmedQuery}</Text>"
                </Text>
              </Pressable>
            ) : null
          }
        />

        <View style={styles.actions}>
          <Pressable style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={onClose}>
            <Text style={{ color: colors.ink }}>Cancel</Text>
          </Pressable>
          <Pressable style={[styles.saveBtn, { backgroundColor: colors.accent }]} onPress={handleSave}>
            <Text style={{ color: "#1a1820", fontFamily: fonts.bodyMedium }}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontSize: 22 },
  search: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    fontSize: 15,
  },
  list: { flex: 1, marginTop: 12, paddingHorizontal: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1 },
  actions: {
    flexDirection: "row",
    gap: 10,
    padding: 20,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: "center",
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.pill,
    alignItems: "center",
  },
});
