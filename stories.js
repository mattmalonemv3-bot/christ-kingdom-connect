// lib/stories.js
import { supabase } from "./supabaseClient";

/**
 * Active (non-expired) stories from people you follow, plus your
 * own — grouped by author the way the Feed screen's story bar wants
 * them: [{ author, stories: [...] }, ...], your own group first.
 */
export async function getActiveStories(currentUserId) {
  const { data, error } = await supabase
    .from("stories")
    .select(`id, media_url, created_at, expires_at, author:profiles ( id, username, display_name, avatar_url )`)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });
  if (error) throw error;

  const grouped = new Map();
  for (const story of data) {
    const authorId = story.author.id;
    if (!grouped.has(authorId)) grouped.set(authorId, { author: story.author, stories: [] });
    grouped.get(authorId).stories.push(story);
  }

  const groups = [...grouped.values()];
  // Your own stories first (so "Your Story" always sits at the front of the bar)
  groups.sort((a, b) => (a.author.id === currentUserId ? -1 : b.author.id === currentUserId ? 1 : 0));
  return groups;
}

/**
 * Call after uploads.js has already given you a public URL —
 * pickAndUploadImage() for photos, pickAndUploadVideo() for video.
 */
export async function createStory({ authorId, mediaUrl, mediaType = "image", durationSeconds = null }) {
  const { data, error } = await supabase
    .from("stories")
    .insert({ author_id: authorId, media_url: mediaUrl, media_type: mediaType, duration_seconds: durationSeconds })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteStory(storyId) {
  const { error } = await supabase.from("stories").delete().eq("id", storyId);
  if (error) throw error;
}
