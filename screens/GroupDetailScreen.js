// screens/GroupDetailScreen.js
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, FlatList, Image, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { ArrowLeft, Users, Crown } from "lucide-react-native";
import { getGroupDetail, joinGroup, leaveGroup } from "../lib/social";
import { colors, toneForId, initialsFor } from "../theme";

export default function GroupDetailScreen({ groupId, me, onBack }) {
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getGroupDetail({ groupId, currentUserId: me.id });
      setGroup(data);
    } finally {
      setLoading(false);
    }
  }, [groupId, me.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleMembership = async () => {
    setBusy(true);
    try {
      if (group.is_member) {
        await leaveGroup({ groupId, userId: me.id });
      } else {
        await joinGroup({ groupId, userId: me.id });
      }
      await load();
    } catch {
      Alert.alert("Something went wrong", "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !group) {
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
        <Text style={styles.title} numberOfLines={1}>{group.name}</Text>
        <View style={{ width: 20 }} />
      </View>

      <FlatList
        data={group.members}
        keyExtractor={(m) => m.user.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.groupName}>{group.name}</Text>
            {group.description ? <Text style={styles.groupDesc}>{group.description}</Text> : null}
            <View style={styles.metaRow}>
              <Users size={13} color={colors.textMuted} />
              <Text style={styles.metaText}>{group.member_count} member{group.member_count === 1 ? "" : "s"}</Text>
            </View>

            <TouchableOpacity
              style={[styles.joinButton, group.is_member && styles.leaveButton]}
              onPress={handleToggleMembership}
              disabled={busy}
            >
              <Text style={[styles.joinButtonText, group.is_member && styles.leaveButtonText]}>
                {busy ? "…" : group.is_member ? "Leave Group" : "Join Group"}
              </Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Members</Text>
          </View>
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View style={styles.memberRow}>
            {item.user.avatar_url ? (
              <Image source={{ uri: item.user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: toneForId(item.user.id) }]}>
                <Text style={styles.avatarInitials}>{initialsFor(item.user.display_name)}</Text>
              </View>
            )}
            <Text style={styles.memberName}>{item.user.display_name}</Text>
            {item.role === "leader" && <Crown size={13} color={colors.gold} fill={colors.gold} style={{ marginLeft: 6 }} />}
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
  title: { color: colors.text, fontSize: 16, fontWeight: "600", flex: 1, textAlign: "center", marginHorizontal: 12 },
  header: { padding: 16 },
  groupName: { color: colors.text, fontSize: 22, fontWeight: "700" },
  groupDesc: { color: colors.textMuted, fontSize: 14, marginTop: 6, lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  metaText: { color: colors.textMuted, fontSize: 13 },
  joinButton: { backgroundColor: colors.gold, borderRadius: 999, paddingVertical: 12, alignItems: "center", marginTop: 16, marginBottom: 24 },
  leaveButton: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.danger },
  joinButtonText: { color: "#161209", fontWeight: "700", fontSize: 14 },
  leaveButtonText: { color: colors.danger },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "600", marginBottom: 4 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  avatarInitials: { color: "#C8CAD6", fontSize: 12, fontWeight: "600" },
  memberName: { color: colors.text, fontSize: 14 },
});
