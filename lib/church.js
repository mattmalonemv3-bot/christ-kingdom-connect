// lib/church.js
// Everything specific to CKCC as the single featured church:
// events, livestream, sermons — plus the global prayer wall.
import { supabase } from "./supabaseClient";

// ---------------- Events ----------------

export async function getEvents({ upcomingOnly = false } = {}) {
  let query = supabase.from("events").select("*").order("starts_at", { ascending: true });
  if (upcomingOnly) query = query.gte("starts_at", new Date().toISOString());
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function registerForEvent({ eventId, userId }) {
  const { error } = await supabase
    .from("event_registrations")
    .insert({ event_id: eventId, user_id: userId });
  if (error) throw error;
}

/** Church-admin only — enforced by RLS, so this will fail silently succeed only for admins. */
export async function createEvent(event) {
  const { data, error } = await supabase.from("events").insert(event).select().single();
  if (error) throw error;
  return data;
}

// ---------------- Prayer Wall (global) ----------------

export async function getPrayerWall({ limit = 20 } = {}) {
  const { data, error } = await supabase
    .from("prayer_requests")
    .select(
      `id, body, is_anonymous, is_answered, created_at,
       author:profiles ( id, username, display_name, avatar_url ),
       prayer_responses ( user_id )`
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((p) => ({ ...p, pray_count: p.prayer_responses.length }));
}

export async function submitPrayerRequest({ authorId, body, isAnonymous = false }) {
  const { data, error } = await supabase
    .from("prayer_requests")
    .insert({ author_id: authorId, body, is_anonymous: isAnonymous })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markPrayed({ prayerId, userId }) {
  const { error } = await supabase
    .from("prayer_responses")
    .insert({ prayer_id: prayerId, user_id: userId });
  if (error) throw error;
}

// ---------------- Watch: livestream, sermons, live chat ----------------

export async function getLiveStream() {
  const { data, error } = await supabase
    .from("streams")
    .select("*")
    .eq("is_live", true)
    .order("scheduled_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data; // null if nothing is live right now
}

export async function getSermons({ limit = 20 } = {}) {
  const { data, error } = await supabase
    .from("sermons")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getStreamChat(streamId) {
  const { data, error } = await supabase
    .from("stream_chat_messages")
    .select(`id, body, created_at, user:profiles ( id, username, display_name, avatar_url )`)
    .eq("stream_id", streamId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return data;
}

export async function sendStreamChat({ streamId, userId, body }) {
  const { data, error } = await supabase
    .from("stream_chat_messages")
    .insert({ stream_id: streamId, user_id: userId, body })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Realtime subscription — new chat messages appear live during the broadcast. */
export function subscribeToStreamChat(streamId, onMessage) {
  const channel = supabase
    .channel(`stream-chat-${streamId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "stream_chat_messages", filter: `stream_id=eq.${streamId}` },
      (payload) => onMessage(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
