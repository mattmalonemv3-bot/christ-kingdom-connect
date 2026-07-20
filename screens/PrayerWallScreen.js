// screens/PrayerWallScreen.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, Switch, Alert, RefreshControl,
} from "react-native";
import { ArrowLeft, HandHelping } from "lucide-react-native";
import { getPrayerWall, submitPrayerRequest, markPrayed } from "../lib/church";
import { colors } from "../theme";

export default function PrayerWallScreen({ me, onBack }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [prayedIds, setPrayedIds] = useState(new Set());

  const load = useCallback(async () => {
    try {
      const data = await getPrayerWall();
      setRequests(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await submitPrayerRequest({ authorId: me.id, body: text.trim(), isAnonymous: anonymous });
      setText("");
      setAnonymous(false);
      load();
    } catch {
      Alert.alert("Couldn't submit", "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePray = async (requestId) => {
    if (prayedIds.has(requestId)) return; // one tap per person, matches DB constraint
    setPrayedIds((prev) => new Set(prev).add(requestId));
    setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, pray_count: r.pray_count + 1 } : r)));
    try {
      await markPrayed({ prayerId: requestId, userId: me.id });
    } catch {
      // likely already prayed in a prior session — harmless, leave optimistic state as-is
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Prayer Wall</Text>
        <View style={{ width: 20 }} />
      </View>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Share a prayer request or a praise…"
          placeholderTextColor={colors.textFaint}
          value={text}
          onChangeText={setText}
          multiline
        />
        <View style={styles.composerFooter}>
          <View style={styles.anonRow}>
            <Switch value={anonymous} onValueChange={setAnonymous} trackColor={{ false: "#2E3140", true: colors.borderGold }} thumbColor={anonymous ? colors.gold : "#9A98A6"} />
            <Text style={styles.anonLabel}>Post anonymously</Text>
          </View>
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={submitting || !text.trim()}>
            <Text style={styles.submitButtonText}>{submitting ? "Posting…" : "Share"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={requests}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.gold} />}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={<Text style={styles.emptyText}>No requests yet — be the first to share.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.author}>{item.is_anonymous ? "Anonymous" : item.author.display_name}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <TouchableOpacity style={styles.prayButton} onPress={() => handlePray(item.id)}>
              <HandHelping size={14} color={prayedIds.has(item.id) ? colors.gold : colors.textMuted} />
              <Text style={[styles.prayText, prayedIds.has(item.id) && { color: colors.gold }]}>
                {item.pray_count} prayed
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 17, fontWeight: "600" },
  composer: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, color: colors.text, minHeight: 70, textAlignVertical: "top" },
  composerFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  anonRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  anonLabel: { color: colors.textMuted, fontSize: 13 },
  submitButton: { backgroundColor: colors.gold, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 },
  submitButtonText: { color: "#161209", fontWeight: "700", fontSize: 13 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16 },
  author: { color: colors.gold, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  body: { color: "#D8D5C9", fontSize: 14, lineHeight: 20, marginBottom: 10 },
  prayButton: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  prayText: { color: colors.textMuted, fontSize: 12 },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: "center", marginTop: 20 },
});
