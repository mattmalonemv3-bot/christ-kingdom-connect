// lib/social.js
import { supabase } from "./supabaseClient";

export async function followUser({ followerId, followingId }) {
  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: followerId, following_id: followingId });
  if (error) throw error;
}

export async function unfollowUser({ followerId, followingId }) {
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("following_id", followingId);
  if (error) throw error;
}

export async function getFollowingIds(userId) {
  const { data, error } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);
  if (error) throw error;
  return data.map((r) => r.following_id);
}

/** Simple "suggested for you" — people you don't already follow, newest members first.
 *  Good enough to launch with; can be replaced with a real ranking function later. */
export async function getSuggestedPeople({ userId, limit = 10 }) {
  const following = await getFollowingIds(userId);
  const excludeIds = [...following, userId];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, country")
    .not("id", "in", `(${excludeIds.join(",") || "00000000-0000-0000-0000-000000000000"})`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// ---------------- Groups ----------------

export async function getGroups() {
  const { data, error } = await supabase
    .from("groups")
    .select(`id, name, description, created_at, group_members ( user_id )`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((g) => ({ ...g, member_count: g.group_members.length }));
}

export async function getGroupDetail({ groupId, currentUserId }) {
  const { data, error } = await supabase
    .from("groups")
    .select(
      `id, name, description, created_at, created_by,
       creator:profiles!groups_created_by_fkey ( id, display_name ),
       group_members ( role, user:profiles ( id, username, display_name, avatar_url ) )`
    )
    .eq("id", groupId)
    .single();
  if (error) throw error;

  return {
    ...data,
    members: data.group_members,
    member_count: data.group_members.length,
    is_member: data.group_members.some((m) => m.user.id === currentUserId),
  };
}

export async function leaveGroup({ groupId, userId }) {
  const { error } = await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
  if (error) throw error;
}

export async function createGroup({ name, description, createdBy }) {
  const { data, error } = await supabase
    .from("groups")
    .insert({ name, description, created_by: createdBy })
    .select()
    .single();
  if (error) throw error;

  // creator auto-joins as leader
  await supabase.from("group_members").insert({ group_id: data.id, user_id: createdBy, role: "leader" });
  return data;
}

export async function joinGroup({ groupId, userId }) {
  const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: userId });
  if (error) throw error;
}
