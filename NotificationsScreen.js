// screens/NotificationsScreen.js
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, FlatList, Image, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { ArrowLeft, Heart, MessageCircle, UserPlus, HandHelping } from "lucide-react-native";
import { getMyNotifications, markAllNotificationsRead } from "../lib/notifications";
import { colors, toneForId, initialsFor } from "../theme";

const ICONS = {
  like: { Icon: Heart, color: colors.danger },
  comment: { Icon: MessageCircle, color: colors.gold },
  follow: { Icon: UserPlus, color: colors.gold },
  prayer_response: { Icon: HandHelping, color: colors.gold },
};

export default function NotificationsScreen({ me, onBack }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getMyNotifications();
      setNotifications(data);
      markAllNotificationsRead(me.id).catch(() => {}); // best-effort — opening the list is "read"
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [me.id]);

  useEffect(() => {
    load();
  }, [load]);

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
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 20 }} />
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.gold} />}
        contentContainerStyle={{ padding: 16, gap: 4 }}
        ListEmptyComponent={<Text style={styles.emptyText}>Nothing yet — activity on your posts and profile will show up here.</Text>}
        renderItem={({ item }) => {
          const { Icon, color } = ICONS[item.type] || { Icon: Heart, color: colors.textMuted };
          return (
            <View style={[styles.row, !item.is_read && styles.rowUnread]}>
              <View style={styles.avatarWrap}>
                {item.actor?.avatar_url ? (
                  <Image source={{ uri: item.actor.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: toneForId(item.actor?.id || item.id) }]}>
                    <Text style={styles.avatarInitials}>{initialsFor(item.actor?.display_name || "")}</Text>
                  </View>
                )}
                <View style={styles.iconBadge}>
                  <Icon size={11} color={color} fill={item.type === "like" ? color : "none"} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

function timeAgo(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 17, fontWeight: "600" },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: "center", marginTop: 30, paddingHorizontal: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderRadius: 12, paddingHorizontal: 8 },
  rowUnread: { backgroundColor: "#12100A" },
  avatarWrap: { position: "relative", width: 40, height: 40 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  avatarInitials: { color: "#C8CAD6", fontSize: 12, fontWeight: "600" },
  iconBadge: {
    position: "absolute", bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.bg, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: colors.bg,
  },
  body: { color: colors.text, fontSize: 14 },
  time: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
});
