import React, { useState, useEffect } from "react";
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Home, Compass, Calendar, Tv, User } from "lucide-react-native";
import { supabase } from "./lib/supabaseClient";
import { getProfile, onAuthStateChange } from "./lib/auth";
import { loadBlockedTerms } from "./lib/moderation";
import { registerForPushNotifications } from "./lib/notifications";
import { useReportModal } from "./components/ReportModal";
import { colors } from "./theme";

import AuthScreen from "./screens/AuthScreen";
import FeedScreen from "./screens/FeedScreen";
import ExploreScreen from "./screens/ExploreScreen";
import PrayerWallScreen from "./screens/PrayerWallScreen";
import EventsScreen from "./screens/EventsScreen";
import WatchScreen from "./screens/WatchScreen";
import MeScreen from "./screens/MeScreen";
import EditProfileScreen from "./screens/EditProfileScreen";
import ModerationQueueScreen from "./screens/ModerationQueueScreen";

const TABS = [
  { key: "Feed", icon: Home },
  { key: "Explore", icon: Compass },
  { key: "Events", icon: Calendar },
  { key: "Watch", icon: Tv },
  { key: "Me", icon: User },
];

export default function App() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("Feed");
  const [subScreen, setSubScreen] = useState(null);

  const { ReportModal, openReport } = useReportModal(profile?.id);

  useEffect(() => {
    loadBlockedTerms().catch(() => {});
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const unsubscribe = onAuthStateChange((s) => setSession(s));
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    getProfile(session.user.id).then(setProfile).catch(() => setProfile(null));
  }, [session]);

  useEffect(() => {
    if (!profile) return;
    registerForPushNotifications(profile.id).catch(() => {});
  }, [profile?.id]);

  if (session === undefined || (session && !profile)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  return (
    <View style={styles.shell}>
      <View style={styles.screenArea}>
        {tab === "Feed" && <FeedScreen me={profile} openReport={openReport} />}
        {tab === "Explore" && subScreen !== "prayerWall" && (
          <ExploreScreen me={profile} onOpenPrayerWall={() => setSubScreen("prayerWall")} />
        )}
        {tab === "Explore" && subScreen === "prayerWall" && (
          <PrayerWallScreen me={profile} onBack={() => setSubScreen(null)} />
        )}
        {tab === "Events" && <EventsScreen me={profile} />}
        {tab === "Watch" && <WatchScreen me={profile} />}
        {tab === "Me" && subScreen === "editProfile" && (
          <EditProfileScreen
            me={profile}
            onBack={() => setSubScreen(null)}
            onSaved={(updated) => setProfile(updated)}
          />
        )}
        {tab === "Me" && subScreen !== "moderationQueue" && subScreen !== "editProfile" && (
          <MeScreen
            me={profile}
            onOpenModerationQueue={() => setSubScreen("moderationQueue")}
            onOpenEditProfile={() => setSubScreen("editProfile")}
          />
        )}
        {tab === "Me" && subScreen === "moderationQueue" && (
          <ModerationQueueScreen currentAdminId={profile.id} />
        )}
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={styles.tabButton}
              onPress={() => {
                setTab(t.key);
                setSubScreen(null);
              }}
            >
              <t.icon size={22} color={active ? colors.gold : "#6E6C78"} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.key}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ReportModal />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.bg },
  loadingContainer: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" },
  screenArea: { flex: 1 },
  tabBar: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 10, paddingBottom: 22 },
  tabButton: { flex: 1, alignItems: "center", gap: 3 },
  tabLabel: { fontSize: 11, color: "#6E6C78" },
  tabLabelActive: { color: colors.gold },
});
