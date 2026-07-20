// screens/MeScreen.js
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { Settings, Calendar, Bookmark, HandHelping, Users, ChevronRight, Crown, ShieldCheck, LogOut } from "lucide-react-native";
import { supabase } from "../lib/supabaseClient";
import { signOut } from "../lib/auth";
import { clearPushToken } from "../lib/notifications";
import { colors, toneForId, initialsFor } from "../theme";

export default function MeScreen({ me, onOpenModerationQueue, onOpenEditProfile }) {
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [postsRes, followersRes, followingRes] = await Promise.all([
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", me.id),
        supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", me.id),
        supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", me.id),
      ]);
      setStats({
        posts: postsRes.count ?? 0,
        followers: followersRes.count ?? 0,
        following: followingRes.count ?? 0,
      });
    } finally {
      setLoading(false);
    }
  }, [me.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSignOut = () => {
    Alert.alert("Sign out?", null, [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => {
          await clearPushToken(me.id).catch(() => {});
          signOut();
        } },
    ]);
  };

  const menu = [
    { icon: Calendar, label: "Events" },
    { icon: Bookmark, label: "Saved" },
    { icon: HandHelping, label: "Prayer Requests" },
    { icon: Users, label: "Groups" },
    ...(me.is_church_admin ? [{ icon: ShieldCheck, label: "Moderation Queue", onPress: onOpenModerationQueue }] : []),
    { icon: Settings, label: "Settings" },
  ];

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
        <Text style={styles.username}>@{me.username}</Text>
        <TouchableOpacity onPress={handleSignOut}>
          <LogOut size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <View style={styles.headerRow}>
          {me.avatar_url ? (
            <Image source={{ uri: me.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: toneForId(me.id) }]}>
              <Text style={styles.avatarInitials}>{initialsFor(me.display_name)}</Text>
            </View>
          )}
          <View style={styles.statsRow}>
            <Stat label="Posts" value={stats.posts} />
            <Stat label="Followers" value={stats.followers} />
            <Stat label="Following" value={stats.following} />
          </View>
        </View>

        <Text style={styles.displayName}>{me.display_name}</Text>
        {me.bio ? <Text style={styles.bio}>{me.bio}</Text> : null}

        <TouchableOpacity style={styles.editButton} onPress={onOpenEditProfile}>
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>

        {me.is_church_admin && (
          <View style={styles.adminBadge}>
            <Crown size={18} color={colors.gold} fill={colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.adminBadgeTitle}>Church Admin</Text>
              <Text style={styles.adminBadgeSubtitle}>You can post official CKCC events, streams, and sermons</Text>
            </View>
          </View>
        )}

        <View style={styles.menuCard}>
          {menu.map((m, i) => (
            <TouchableOpacity
              key={m.label}
              style={[styles.menuRow, i < menu.length - 1 && styles.menuRowBorder]}
              onPress={m.onPress}
            >
              <m.icon size={18} color={colors.gold} />
              <Text style={styles.menuLabel}>{m.label}</Text>
              <ChevronRight size={16} color={colors.textFaint} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  username: { color: colors.text, fontSize: 18, fontWeight: "600" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 24, marginBottom: 16 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center" },
  avatarInitials: { color: "#C8CAD6", fontSize: 22, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: 24 },
  stat: { alignItems: "center" },
  statValue: { color: colors.text, fontSize: 17, fontWeight: "700" },
  statLabel: { color: colors.textMuted, fontSize: 12 },
  displayName: { color: colors.text, fontWeight: "600", fontSize: 15 },
  bio: { color: colors.textMuted, fontSize: 13, marginTop: 2, marginBottom: 16 },
  editButton: { borderWidth: 1, borderColor: "#2E3140", borderRadius: 999, paddingVertical: 11, alignItems: "center", marginBottom: 16 },
  editButtonText: { color: colors.text, fontSize: 14, fontWeight: "500" },
  adminBadge: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.borderGold, borderRadius: 16, padding: 16, marginBottom: 16 },
  adminBadgeTitle: { color: colors.goldBright, fontWeight: "600" },
  adminBadgeSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  menuCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  menuLabel: { flex: 1, color: colors.text, fontSize: 14 },
});
