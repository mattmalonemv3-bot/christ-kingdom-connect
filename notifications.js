// lib/notifications.js
//
// Setup:
//   npx expo install expo-notifications expo-device expo-constants
//
// Push notifications require a real device (not the simulator) and,
// for standalone builds, an EAS project set up for push credentials.
// See: https://docs.expo.dev/push-notifications/push-notifications-setup/

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabaseClient";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Requests permission, gets an Expo push token, and saves it to the
 * signed-in user's profile. Call once after login (see App.js). Safe
 * to call repeatedly — it's just an upsert of the current token.
 */
export async function registerForPushNotifications(userId) {
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device — skipping in simulator.");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission was not granted.");
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  const token = tokenResponse.data;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { error } = await supabase.from("profiles").update({ expo_push_token: token }).eq("id", userId);
  if (error) throw error;

  return token;
}

/** Call on sign-out so a shared/reset device doesn't keep receiving this person's pushes. */
export async function clearPushToken(userId) {
  const { error } = await supabase.from("profiles").update({ expo_push_token: null }).eq("id", userId);
  if (error) throw error;
}

// ---------------- In-app notification list (the bell icon) ----------------

export async function getMyNotifications({ limit = 30 } = {}) {
  const { data, error } = await supabase
    .from("notifications")
    .select(`id, type, body, target_type, target_id, is_read, created_at, actor:profiles!notifications_actor_id_fkey ( id, display_name, avatar_url )`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getUnreadCount(userId) {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw error;
  return count ?? 0;
}

export async function markAllNotificationsRead(userId) {
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
  if (error) throw error;
}

/** Realtime — badge/list updates the moment a new notification lands, no polling. */
export function subscribeToNotifications(userId, onNew) {
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      (payload) => onNew(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
