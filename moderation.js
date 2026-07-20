// lib/moderation.js
import { supabase } from "./supabaseClient";

// ---------------- Reporting ----------------

/**
 * File a report against a post, comment, prayer request, profile,
 * group, or stream chat message.
 * targetType must be one of: 'post' | 'comment' | 'prayer_request' | 'profile' | 'group' | 'stream_chat_message'
 * reason must be one of: 'spam' | 'harassment' | 'hate_speech' | 'sexual_content' |
 *   'violence' | 'false_teaching_flagged' | 'impersonation' | 'other'
 */
export async function reportContent({ reporterId, targetType, targetId, reason, details }) {
  const { data, error } = await supabase
    .from("reports")
    .insert({
      reporter_id: reporterId,
      target_type: targetType,
      target_id: targetId,
      reason,
      details: details ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------------- Blocking ----------------

export async function blockUser({ blockerId, blockedId }) {
  const { error } = await supabase.from("blocks").insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw error;

  // A block is mutual in spirit even though it's stored one-directionally:
  // also remove any existing follow relationship in either direction.
  await supabase.from("follows").delete().eq("follower_id", blockerId).eq("following_id", blockedId);
  await supabase.from("follows").delete().eq("follower_id", blockedId).eq("following_id", blockerId);
}

export async function unblockUser({ blockerId, blockedId }) {
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);
  if (error) throw error;
}

export async function getBlockedUsers(blockerId) {
  const { data, error } = await supabase
    .from("blocks")
    .select(`blocked_id, blocked:profiles!blocks_blocked_id_fkey ( id, username, display_name, avatar_url )`)
    .eq("blocker_id", blockerId);
  if (error) throw error;
  return data.map((row) => row.blocked);
}

/**
 * Get the set of user ids the current user has blocked OR who have
 * blocked the current user — use this to filter a feed client-side
 * in addition to whatever RLS already hides.
 */
export async function getMutualBlockIds(userId) {
  const [blockedByMe, blockedMe] = await Promise.all([
    supabase.from("blocks").select("blocked_id").eq("blocker_id", userId),
    supabase.from("blocks").select("blocker_id").eq("blocked_id", userId),
  ]);
  if (blockedByMe.error) throw blockedByMe.error;
  if (blockedMe.error) throw blockedMe.error;
  return new Set([
    ...blockedByMe.data.map((r) => r.blocked_id),
    ...blockedMe.data.map((r) => r.blocker_id),
  ]);
}

// ---------------- Pre-submit content filter ----------------
// First line of defense only — catches obvious spam/prohibited terms
// before a post ever reaches the server. This is NOT a substitute for
// the human report queue below; treat it as a courtesy check.

let _termCache = null;

export async function loadBlockedTerms() {
  const { data, error } = await supabase.from("blocked_terms").select("term, severity");
  if (error) throw error;
  _termCache = data;
  return data;
}

/**
 * Returns { allowed: boolean, flagged: boolean, matches: string[] }
 * Call loadBlockedTerms() once at app startup, then this runs locally
 * with no network round-trip on every keystroke/submit.
 */
export function checkContent(text) {
  if (!_termCache) return { allowed: true, flagged: false, matches: [] };
  const lower = text.toLowerCase();
  const matches = _termCache.filter((t) => lower.includes(t.term.toLowerCase()));
  const blocking = matches.some((m) => m.severity === "block");
  return {
    allowed: !blocking,
    flagged: matches.length > 0,
    matches: matches.map((m) => m.term),
  };
}

// ---------------- Admin moderation queue ----------------
// These calls only succeed for profiles with is_church_admin = true —
// enforced server-side by RLS, not just hidden in the UI.

const AUTHOR_COLUMN_BY_TYPE = {
  post: { table: "posts", column: "author_id" },
  comment: { table: "post_comments", column: "author_id" },
  prayer_request: { table: "prayer_requests", column: "author_id" },
  stream_chat_message: { table: "stream_chat_messages", column: "user_id" },
  profile: { table: "profiles", column: "id" },
  group: { table: "groups", column: "created_by" },
};

/**
 * Resolve the profile id responsible for a reported item, regardless
 * of target_type — needed before suspend/ban since `reports` only
 * stores the content id, not who authored it.
 */
export async function getReportedContentAuthor(report) {
  const mapping = AUTHOR_COLUMN_BY_TYPE[report.target_type];
  if (!mapping) return null;

  const { data, error } = await supabase
    .from(mapping.table)
    .select(mapping.column)
    .eq("id", report.target_id)
    .maybeSingle();
  if (error) throw error;
  return data ? data[mapping.column] : null;
}

export async function getReportQueue({ status = "pending", limit = 50 } = {}) {
  const { data, error } = await supabase
    .from("reports")
    .select(`*, reporter:profiles!reports_reporter_id_fkey ( username, display_name )`)
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data;
}

/**
 * Remove a reported piece of content, log the action, and mark the
 * report actioned — all three in one call so the audit trail can
 * never get out of sync with what's actually visible.
 */
export async function removeReportedContent({ report, moderatorId, reason }) {
  const table =
    report.target_type === "post" ? "posts" :
    report.target_type === "comment" ? "post_comments" :
    report.target_type === "prayer_request" ? "prayer_requests" :
    report.target_type === "stream_chat_message" ? "stream_chat_messages" :
    null;

  if (table) {
    const { error: updateErr } = await supabase
      .from(table)
      .update({ is_removed: true, removed_reason: reason, removed_at: new Date().toISOString() })
      .eq("id", report.target_id);
    if (updateErr) throw updateErr;
  }

  await logModerationAction({
    moderatorId,
    targetType: report.target_type,
    targetId: report.target_id,
    action: "content_removed",
    reason,
    reportId: report.id,
  });

  await updateReportStatus({ reportId: report.id, status: "actioned", moderatorId });
}

export async function dismissReport({ reportId, moderatorId }) {
  await updateReportStatus({ reportId, status: "dismissed", moderatorId });
  await logModerationAction({
    moderatorId,
    targetType: "report",
    targetId: reportId,
    action: "report_dismissed",
  });
}

async function updateReportStatus({ reportId, status, moderatorId }) {
  const { error } = await supabase
    .from("reports")
    .update({ status, reviewed_by: moderatorId, reviewed_at: new Date().toISOString() })
    .eq("id", reportId);
  if (error) throw error;
}

export async function suspendUser({ userId, moderatorId, days = 7, reason }) {
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({ is_suspended: true, suspended_until: until })
    .eq("id", userId);
  if (error) throw error;

  await logModerationAction({ moderatorId, targetType: "profile", targetId: userId, action: "user_suspended", reason });
}

export async function banUser({ userId, moderatorId, reason }) {
  const { error } = await supabase
    .from("profiles")
    .update({ is_banned: true, ban_reason: reason })
    .eq("id", userId);
  if (error) throw error;

  await logModerationAction({ moderatorId, targetType: "profile", targetId: userId, action: "user_banned", reason });
}

async function logModerationAction({ moderatorId, targetType, targetId, action, reason, reportId }) {
  const { error } = await supabase.from("moderation_actions").insert({
    moderator_id: moderatorId,
    target_type: targetType,
    target_id: targetId,
    action,
    reason: reason ?? null,
    report_id: reportId ?? null,
  });
  if (error) throw error;
}
