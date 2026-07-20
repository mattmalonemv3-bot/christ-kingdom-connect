// screens/ModerationQueueScreen.js
//
// Gate this route behind is_church_admin — e.g. in your navigator,
// only add it to the stack if getProfile(user.id).is_church_admin is true.
// RLS enforces this server-side too, so even a modified client can't
// pull the queue without admin standing.

import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert,
} from "react-native";
import { Check, X, UserX, Clock } from "lucide-react-native";
import { getReportQueue, removeReportedContent, dismissReport, suspendUser } from "../lib/moderation";

const REASON_LABELS = {
  spam: "Spam or scam",
  harassment: "Harassment",
  hate_speech: "Hate speech",
  sexual_content: "Sexual content",
  violence: "Violence or threats",
  impersonation: "Impersonation",
  false_teaching_flagged: "Flagged teaching",
  other: "Other",
};

export default function ModerationQueueScreen({ currentAdminId }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingOn, setActingOn] = useState(null); // report id currently being processed

  const load = useCallback(async () => {
    try {
      const data = await getReportQueue({ status: "pending" });
      setReports(data);
    } catch {
      Alert.alert("Couldn't load reports", "Pull down to try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleRemove = (report) => {
    Alert.alert(
      "Remove this content?",
      "It will be hidden from the app immediately. This is logged and reversible from the moderation log.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setActingOn(report.id);
            try {
              await removeReportedContent({
                report,
                moderatorId: currentAdminId,
                reason: REASON_LABELS[report.reason] || report.reason,
              });
              setReports((prev) => prev.filter((r) => r.id !== report.id));
            } catch {
              Alert.alert("Action failed", "Please try again.");
            } finally {
              setActingOn(null);
            }
          },
        },
      ]
    );
  };

  const handleDismiss = async (report) => {
    setActingOn(report.id);
    try {
      await dismissReport({ reportId: report.id, moderatorId: currentAdminId });
      setReports((prev) => prev.filter((r) => r.id !== report.id));
    } catch {
      Alert.alert("Action failed", "Please try again.");
    } finally {
      setActingOn(null);
    }
  };

  const handleSuspendAuthor = (report) => {
    Alert.alert(
      "Suspend this user?",
      "This suspends the reported content's author for 7 days. Use for repeat or serious violations.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Suspend 7 days",
          style: "destructive",
          onPress: async () => {
            // Note: requires resolving target_id -> author_id first if target_type
            // isn't 'profile'. Kept simple here — wire up the author lookup for
            // your specific content tables, or report directly against a profile.
            if (report.target_type !== "profile") {
              Alert.alert(
                "Author lookup needed",
                "Resolve the author_id for this content type before suspending — see the comment in this handler."
              );
              return;
            }
            setActingOn(report.id);
            try {
              await suspendUser({
                userId: report.target_id,
                moderatorId: currentAdminId,
                days: 7,
                reason: REASON_LABELS[report.reason] || report.reason,
              });
              await dismissReport({ reportId: report.id, moderatorId: currentAdminId });
              setReports((prev) => prev.filter((r) => r.id !== report.id));
            } catch {
              Alert.alert("Action failed", "Please try again.");
            } finally {
              setActingOn(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#C9A45C" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Moderation Queue</Text>
        <Text style={styles.subtitle}>{reports.length} pending report{reports.length === 1 ? "" : "s"}</Text>
      </View>

      <FlatList
        data={reports}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C9A45C" />}
        contentContainerStyle={reports.length === 0 && styles.emptyContainer}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Check size={28} color="#3A5C42" />
            <Text style={styles.emptyText}>Queue is clear</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.reasonPill}>
                <Text style={styles.reasonPillText}>{REASON_LABELS[item.reason] || item.reason}</Text>
              </View>
              <View style={styles.timeRow}>
                <Clock size={12} color="#7C7A88" />
                <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
              </View>
            </View>

            <Text style={styles.meta}>
              {capitalize(item.target_type)} · reported by {item.reporter?.display_name || "a member"}
            </Text>

            {item.details ? <Text style={styles.details}>"{item.details}"</Text> : null}

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.removeButton]}
                onPress={() => handleRemove(item)}
                disabled={actingOn === item.id}
              >
                <X size={15} color="#F2EFE9" />
                <Text style={styles.actionButtonText}>Remove content</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.suspendButton]}
                onPress={() => handleSuspendAuthor(item)}
                disabled={actingOn === item.id}
              >
                <UserX size={15} color="#F2EFE9" />
                <Text style={styles.actionButtonText}>Suspend user</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.dismissButton]}
                onPress={() => handleDismiss(item)}
                disabled={actingOn === item.id}
              >
                <Check size={15} color="#9A98A6" />
                <Text style={[styles.actionButtonText, { color: "#9A98A6" }]}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function capitalize(s) {
  return s ? s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : s;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0E" },
  center: { flex: 1, backgroundColor: "#0A0A0E", justifyContent: "center", alignItems: "center" },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  title: { color: "#F2EFE9", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#9A98A6", fontSize: 13, marginTop: 2 },
  emptyContainer: { flexGrow: 1, justifyContent: "center" },
  empty: { alignItems: "center", gap: 8 },
  emptyText: { color: "#9A98A6", fontSize: 14 },
  card: {
    marginHorizontal: 16, marginBottom: 12, backgroundColor: "#101015",
    borderRadius: 16, borderWidth: 1, borderColor: "#24242C", padding: 16,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  reasonPill: { backgroundColor: "#3D1219", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  reasonPillText: { color: "#E8B4B0", fontSize: 11, fontWeight: "600" },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  timeText: { color: "#7C7A88", fontSize: 11 },
  meta: { color: "#9A98A6", fontSize: 12, marginBottom: 8 },
  details: { color: "#D8D5C9", fontSize: 13, fontStyle: "italic", marginBottom: 12 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  actionButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  removeButton: { backgroundColor: "#4A1414" },
  suspendButton: { backgroundColor: "#3A2E12" },
  dismissButton: { backgroundColor: "#17171D", borderWidth: 1, borderColor: "#24242C" },
  actionButtonText: { color: "#F2EFE9", fontSize: 12, fontWeight: "600" },
});
