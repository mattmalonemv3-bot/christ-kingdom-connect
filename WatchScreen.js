// screens/WatchScreen.js
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, TouchableOpacity, FlatList, TextInput, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { Play, Search, Send } from "lucide-react-native";
import { getLiveStream, getSermons, getStreamChat, sendStreamChat, subscribeToStreamChat } from "../lib/church";
import { colors } from "../theme";

export default function WatchScreen({ me }) {
  const [tab, setTab] = useState("All");
  const [liveStream, setLiveStream] = useState(null);
  const [sermons, setSermons] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(true);
  const chatListRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [stream, sermonData] = await Promise.all([getLiveStream(), getSermons()]);
      setLiveStream(stream);
      setSermons(sermonData);
      if (stream) {
        const chat = await getStreamChat(stream.id);
        setChatMessages(chat);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime chat — new messages appear live while the stream is on
  useEffect(() => {
    if (!liveStream) return;
    const unsubscribe = subscribeToStreamChat(liveStream.id, (message) => {
      setChatMessages((prev) => [...prev, message]);
      setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 50);
    });
    return unsubscribe;
  }, [liveStream]);

  const handleSendChat = async () => {
    if (!chatInput.trim() || !liveStream) return;
    const text = chatInput.trim();
    setChatInput("");
    try {
      await sendStreamChat({ streamId: liveStream.id, userId: me.id, body: text });
    } catch {
      // realtime subscription will reconcile; nothing else to do here
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  const visibleSermons = tab === "Sermons" || tab === "All" ? sermons : [];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Watch</Text>
        <Search size={20} color={colors.text} />
      </View>

      <View style={styles.filterRow}>
        {["All", "Sermons", "Worship", "Live"].map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.pill, tab === t && styles.pillActive]}>
            <Text style={[styles.pillText, tab === t && styles.pillTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={visibleSermons}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          liveStream ? (
            <View style={styles.liveCard}>
              <View style={styles.liveCardHeader}>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveBadgeText}>LIVE NOW</Text>
                </View>
              </View>

              {liveStream.playback_url ? (
                <Video
                  source={{ uri: liveStream.playback_url }}
                  style={styles.player}
                  resizeMode={ResizeMode.COVER}
                  useNativeControls
                  shouldPlay
                />
              ) : (
                <View style={styles.playerPlaceholder}>
                  <Play size={22} color={colors.bg} />
                </View>
              )}

              <View style={{ padding: 14 }}>
                <Text style={styles.streamTitle}>{liveStream.title}</Text>
                <Text style={styles.streamSubtitle}>Christ Kingdom Community Church</Text>

                <Text style={styles.chatLabel}>LIVE CHAT</Text>
                <FlatList
                  ref={chatListRef}
                  data={chatMessages}
                  keyExtractor={(m) => m.id}
                  style={{ maxHeight: 180 }}
                  renderItem={({ item }) => (
                    <Text style={styles.chatLine}>
                      <Text style={styles.chatName}>{item.user.display_name} </Text>
                      <Text style={styles.chatBody}>{item.body}</Text>
                    </Text>
                  )}
                />
                <View style={styles.chatInputRow}>
                  <TextInput
                    style={styles.chatInput}
                    placeholder="Say something…"
                    placeholderTextColor={colors.textFaint}
                    value={chatInput}
                    onChangeText={setChatInput}
                    onSubmitEditing={handleSendChat}
                  />
                  <TouchableOpacity onPress={handleSendChat}>
                    <Send size={18} color={colors.gold} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.notLiveCard}>
              <Text style={styles.notLiveText}>Nothing is live right now — check back Sunday morning.</Text>
            </View>
          )
        }
        ListFooterComponentStyle={{ marginTop: sermons.length ? 16 : 0 }}
        ListFooterComponent={sermons.length > 0 ? <Text style={styles.sectionTitle}>Recent Sermons</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.sermonRow}>
            <View style={styles.sermonThumb}>
              <Play size={16} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sermonTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.sermonMeta}>
                {item.speaker}{item.duration_seconds ? ` · ${Math.round(item.duration_seconds / 60)} min` : ""}
              </Text>
            </View>
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  title: { color: colors.text, fontSize: 24, fontWeight: "700" },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  pill: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: "#2E3140" },
  pillActive: { backgroundColor: "#3A2E12", borderColor: colors.borderGold },
  pillText: { color: colors.textMuted, fontSize: 13, fontWeight: "500" },
  pillTextActive: { color: colors.goldBright },
  liveCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, overflow: "hidden", marginBottom: 20 },
  liveCardHeader: { flexDirection: "row", justifyContent: "space-between", padding: 12 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#4A1414", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#F0938A" },
  liveBadgeText: { color: "#F0938A", fontSize: 11, fontWeight: "700" },
  player: { width: "100%", height: 200, backgroundColor: "#000" },
  playerPlaceholder: { width: "100%", height: 200, backgroundColor: "#161209", justifyContent: "center", alignItems: "center" },
  streamTitle: { color: colors.text, fontSize: 15, fontWeight: "600" },
  streamSubtitle: { color: colors.textMuted, fontSize: 13, marginBottom: 12 },
  chatLabel: { color: colors.textFaint, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 },
  chatLine: { fontSize: 13, marginBottom: 6 },
  chatName: { color: colors.gold, fontWeight: "600" },
  chatBody: { color: "#D8D5C9" },
  chatInputRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  chatInput: { flex: 1, color: colors.text, fontSize: 13 },
  notLiveCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 24, alignItems: "center", marginBottom: 20 },
  notLiveText: { color: colors.textMuted, fontSize: 14, textAlign: "center" },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "600", marginBottom: 12 },
  sermonRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, marginBottom: 10 },
  sermonThumb: { width: 56, height: 40, borderRadius: 8, backgroundColor: "#161209", justifyContent: "center", alignItems: "center" },
  sermonTitle: { color: colors.text, fontSize: 14, fontWeight: "600" },
  sermonMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
