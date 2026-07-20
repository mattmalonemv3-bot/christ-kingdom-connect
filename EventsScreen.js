// screens/EventsScreen.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { Calendar, Star, MapPin, ChevronRight } from "lucide-react-native";
import { getEvents, registerForEvent } from "../lib/church";
import { colors } from "../theme";

export default function EventsScreen({ me }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("All");
  const [registeredIds, setRegisteredIds] = useState(new Set());

  const load = useCallback(async () => {
    try {
      const data = await getEvents({ upcomingOnly: filter === "Upcoming" });
      setEvents(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRegister = async (eventId) => {
    setRegisteredIds((prev) => new Set(prev).add(eventId));
    try {
      await registerForEvent({ eventId, userId: me.id });
      Alert.alert("You're registered!", "We'll see you there.");
    } catch {
      setRegisteredIds((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
      Alert.alert("Couldn't register", "Please try again.");
    }
  };

  const filteredEvents = events.filter((e) => {
    if (filter === "This Month") {
      const d = new Date(e.starts_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    return true;
  });

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
        <View>
          <Text style={styles.title}>Events</Text>
          <Text style={styles.subtitle}>Christ Kingdom Community Church</Text>
        </View>
        <Calendar size={20} color={colors.text} />
      </View>

      <View style={styles.filterRow}>
        {["All", "This Month", "Upcoming"].map((f) => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.pill, filter === f && styles.pillActive]}>
            <Text style={[styles.pillText, filter === f && styles.pillTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredEvents}
        keyExtractor={(e) => e.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.gold} />}
        contentContainerStyle={{ padding: 16, gap: 14 }}
        ListEmptyComponent={<Text style={styles.emptyText}>No events scheduled right now.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.card, item.is_featured && styles.cardFeatured]}>
            {item.is_featured && (
              <View style={styles.featuredPill}>
                <Star size={10} color={colors.goldBright} fill={colors.goldBright} />
                <Text style={styles.featuredText}>FEATURED</Text>
              </View>
            )}
            <Text style={styles.eventTitle}>{item.title}</Text>
            <Text style={styles.eventDate}>{formatEventDate(item.starts_at, item.ends_at)}</Text>
            {item.location && (
              <View style={styles.locationRow}>
                <MapPin size={12} color={colors.textMuted} />
                <Text style={styles.eventLocation}>{item.location}</Text>
              </View>
            )}
            {item.description ? <Text style={styles.eventDesc}>{item.description}</Text> : null}

            <TouchableOpacity
              style={[styles.registerButton, registeredIds.has(item.id) && styles.registeredButton]}
              onPress={() => handleRegister(item.id)}
              disabled={registeredIds.has(item.id)}
            >
              <Text style={styles.registerButtonText}>
                {registeredIds.has(item.id) ? "You're Registered" : "Register Now"}
              </Text>
              {!registeredIds.has(item.id) && <ChevronRight size={14} color="#161209" />}
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

function formatEventDate(startsAt, endsAt) {
  const start = new Date(startsAt);
  const dateStr = start.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  const startTime = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (!endsAt) return `${dateStr} · ${startTime}`;
  const endTime = new Date(endsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${dateStr} · ${startTime} — ${endTime}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 24, fontWeight: "700" },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  filterRow: { flexDirection: "row", gap: 8, padding: 16, paddingBottom: 0 },
  pill: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: "#2E3140" },
  pillActive: { backgroundColor: "#3A2E12", borderColor: colors.borderGold },
  pillText: { color: colors.textMuted, fontSize: 13, fontWeight: "500" },
  pillTextActive: { color: colors.goldBright },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 20 },
  cardFeatured: { borderColor: colors.borderGold, backgroundColor: "#0F0B05" },
  featuredPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#2A2013", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 10 },
  featuredText: { color: colors.goldBright, fontSize: 10, fontWeight: "700" },
  eventTitle: { color: colors.text, fontSize: 17, fontWeight: "600", marginBottom: 4 },
  eventDate: { color: colors.gold, fontSize: 13, marginBottom: 4 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  eventLocation: { color: colors.textMuted, fontSize: 13 },
  eventDesc: { color: "#D8D5C9", fontSize: 13, marginBottom: 14 },
  registerButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.gold, borderRadius: 999, paddingVertical: 12 },
  registeredButton: { backgroundColor: "#2E3524" },
  registerButtonText: { color: "#161209", fontWeight: "700", fontSize: 14 },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: "center", marginTop: 20 },
});
