// screens/ExploreScreen.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, FlatList, Image, StyleSheet,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { HandHelping, ChevronRight, Users, Search, Plus } from "lucide-react-native";
import { getSuggestedPeople, getGroups, followUser, unfollowUser, getFollowingIds } from "../lib/social";
import GroupDetailScreen from "./GroupDetailScreen";
import CreateGroupScreen from "./CreateGroupScreen";
import { colors, toneForId, initialsFor } from "../theme";

export default function ExploreScreen({ me, onOpenPrayerWall }) {
  const [tab, setTab] = useState("People");
  const [people, setPeople] = useState([]);
  const [groups, setGroups] = useState([]);
  const [followingIds, setFollowingIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const load = useCallback(async () => {
    try {
      const [peopleData, groupsData, followingData] = await Promise.all([
        getSuggestedPeople({ userId: me.id }),
        getGroups(),
        getFollowingIds(me.id),
      ]);
      setPeople(peopleData);
      setGroups(groupsData);
      setFollowingIds(new Set(followingData));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [me.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleFollow = async (personId) => {
    const nowFollowing = followingIds.has(personId);
    setFollowingIds((prev) => {
      const next = new Set(prev);
      nowFollowing ? next.delete(personId) : next.add(personId);
      return next;
    });
    try {
      if (nowFollowing) await unfollowUser({ followerId: me.id, followingId: personId });
      else await followUser({ followerId: me.id, followingId: personId });
    } catch {
      load(); // reconcile on failure
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (activeGroupId) {
    return <GroupDetailScreen groupId={activeGroupId} me={me} onBack={() => setActiveGroupId(null)} />;
  }

  if (creatingGroup) {
    return (
      <CreateGroupScreen
        me={me}
        onBack={() => setCreatingGroup(false)}
        onCreated={(group) => {
          setCreatingGroup(false);
          setGroups((prev) => [{ ...group, member_count: 1 }, ...prev]);
          setActiveGroupId(group.id);
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Explore</Text>
        <Search size={20} color={colors.text} />
      </View>

      <View style={styles.tabRow}>
        {["Trending", "People", "Groups"].map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={styles.tabButton}>
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>{t}</Text>
            {tab === t && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {tab === "Trending" && (
        <View style={{ padding: 16 }}>
          <TouchableOpacity style={styles.prayerWallCard} onPress={onOpenPrayerWall}>
            <HandHelping size={20} color={colors.gold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.prayerWallTitle}>Prayer Wall</Text>
              <Text style={styles.prayerWallSubtitle}>Pray for others · Share a praise · Request prayer</Text>
            </View>
            <ChevronRight size={18} color={colors.textFaint} />
          </TouchableOpacity>
        </View>
      )}

      {tab === "People" && (
        <FlatList
          data={people}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.gold} />}
          ListEmptyComponent={<Text style={styles.emptyText}>No suggestions right now — check back soon.</Text>}
          renderItem={({ item }) => (
            <View style={styles.personRow}>
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: toneForId(item.id) }]}>
                  <Text style={styles.avatarInitials}>{initialsFor(item.display_name)}</Text>
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.personName} numberOfLines={1}>{item.display_name}</Text>
                {item.bio ? <Text style={styles.personBio} numberOfLines={1}>{item.bio}</Text> : null}
              </View>
              <TouchableOpacity
                style={[styles.followButton, followingIds.has(item.id) && styles.followingButton]}
                onPress={() => handleToggleFollow(item.id)}
              >
                <Text style={[styles.followButtonText, followingIds.has(item.id) && styles.followingButtonText]}>
                  {followingIds.has(item.id) ? "Following" : "Follow"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {tab === "Groups" && (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListHeaderComponent={
            <TouchableOpacity style={styles.newGroupButton} onPress={() => setCreatingGroup(true)}>
              <Plus size={16} color={colors.gold} />
              <Text style={styles.newGroupButtonText}>Start a Group</Text>
            </TouchableOpacity>
          }
          ListEmptyComponent={<Text style={styles.emptyText}>No groups yet — be the first to start one.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.groupCard} onPress={() => setActiveGroupId(item.id)}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={styles.groupName}>{item.name}</Text>
                <Users size={16} color={colors.textFaint} />
              </View>
              {item.description ? <Text style={styles.groupDesc}>{item.description}</Text> : null}
              <Text style={styles.groupMembers}>{item.member_count} member{item.member_count === 1 ? "" : "s"}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  title: { color: colors.text, fontSize: 24, fontWeight: "700" },
  tabRow: { flexDirection: "row", gap: 24, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabButton: { paddingBottom: 10 },
  tabLabel: { color: colors.textMuted, fontSize: 14, fontWeight: "500" },
  tabLabelActive: { color: colors.gold },
  tabUnderline: { height: 2, backgroundColor: colors.gold, marginTop: 8, borderRadius: 1 },
  prayerWallCard: {
    flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.borderGold,
    borderRadius: 16, padding: 16,
  },
  prayerWallTitle: { color: colors.text, fontWeight: "600", fontSize: 15 },
  prayerWallSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  personRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  avatarInitials: { color: "#C8CAD6", fontWeight: "600" },
  personName: { color: colors.text, fontSize: 14, fontWeight: "600" },
  personBio: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  followButton: { backgroundColor: colors.gold, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  followingButton: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.borderGold },
  followButtonText: { color: "#161209", fontSize: 12, fontWeight: "700" },
  followingButtonText: { color: colors.gold },
  groupCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16 },
  newGroupButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: colors.borderGold, borderRadius: 14, paddingVertical: 14, marginBottom: 4 },
  newGroupButtonText: { color: colors.goldBright, fontWeight: "600", fontSize: 14 },
  groupName: { color: colors.text, fontWeight: "600", fontSize: 15 },
  groupDesc: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  groupMembers: { color: colors.textFaint, fontSize: 12, marginTop: 8 },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: "center", marginTop: 20 },
});
