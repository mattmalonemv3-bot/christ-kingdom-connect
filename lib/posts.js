// lib/posts.js
import { supabase } from "./supabaseClient";

/**
 * Global feed — every believer's posts, newest first.
 * Pass currentUserId so each post comes back with `liked_by_me`.
 * Swap this for a "following-only" feed later by joining on `follows`.
 */
export async function getFeed({ currentUserId, limit = 20, before = null } = {}) {
  let query = supabase
    .from("posts")
    .select(
      `id, body, image_url, scripture_ref, scripture_text, is_church_official, created_at,
       author:profiles!posts_author_id_fkey ( id, username, display_name, avatar_url ),
       post_likes ( user_id ),
       post_comments ( id )`
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;
  if (error) throw error;

  // Shape it the way the UI wants: like_count, comment_count, liked_by_me
  return data.map((post) => ({
    ...post,
    like_count: post.post_likes.length,
    comment_count: post.post_comments.length,
    liked_by_me: currentUserId ? post.post_likes.some((l) => l.user_id === currentUserId) : false,
  }));
}

export async function createPost({ authorId, body, imageUrl, scriptureRef, scriptureText }) {
  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: authorId,
      body,
      image_url: imageUrl ?? null,
      scripture_ref: scriptureRef ?? null,
      scripture_text: scriptureText ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePost(postId) {
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw error;
}

export async function likePost({ postId, userId }) {
  const { error } = await supabase.from("post_likes").insert({ post_id: postId, user_id: userId });
  if (error) throw error;
}

export async function unlikePost({ postId, userId }) {
  const { error } = await supabase
    .from("post_likes")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function getComments(postId) {
  const { data, error } = await supabase
    .from("post_comments")
    .select(`id, body, created_at, author:profiles ( id, username, display_name, avatar_url )`)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function addComment({ postId, authorId, body }) {
  const { data, error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, author_id: authorId, body })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteComment(commentId) {
  const { error } = await supabase.from("post_comments").delete().eq("id", commentId);
  if (error) throw error;
}
