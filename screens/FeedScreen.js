// screens/FeedScreen.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Image,
  StyleSheet, RefreshControl, ActivityIndicator, Alert,
} from "react-native";
import { Crown, Send, Bell, Heart, MessageCircle, Share2 } from "lucide-react-native";
import { getFeed, createPost, likePost, unlikePost, deletePost } from "../lib/posts";
import { getActiveStories } from "../lib/stories";
import StoryBar from "../components/StoryBar";
import StoryViewer from "../components/StoryViewer";
import AddStorySheet from "../components/AddStorySheet";
import ComposerImageAttach from "../components/ComposerImageAttach";
import ContentOptionsMenu from "../components/ContentOptionsMenu";
import CommentsScreen from "./CommentsScreen";
import NotificationsScreen from "./NotificationsScreen";
import { getUnreadCount, subscribeToNotifications } from "../lib/notifications";
import { colors, toneForId, initialsFor } from "../theme";

// Today's verse — swap this for a small rotating table later if you
// want it to change daily; a static value is a fine starting point.
const VERSE = { ref: "Philippians 4:13", text: "I can do all things through Christ who strengthens me" };

export default function FeedScreen({ me, openReport }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [storyGroups, setStoryGroups] = useState([]);
  const [viewerGroup, setViewerGroup] = useState(null);
  const [addStoryOpen, setAddStoryOpen] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [composerImage, setComposerImage] = useState(null);
  const [posting, setPosting] = useState(false);
  const [activePost, setActivePost] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const [feedData, storyData] = await Promise.all([getFeed({ currentUserId: me.id }), getActiveStories(me.id)]);
      setPosts(feedData);
      setStoryGroups(storyData);
    } catch {
      Alert.alert("Couldn't load your feed", "Pull down to try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [me.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getUnreadCount(me.id).then(setUnreadCount).catch(() => {});
    const unsubscribe = subscribeToNotifications(me.id, () => setUnreadCount((c) => c + 1));
    return unsubscribe;
  }, [me.id]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleToggleLike = async (post) => {
    // optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, liked_by_me: !p.liked_by_me, like_count: p.liked_by_me ? p.like_count - 1 : p.like_count + 1 }
          : p
      )
    );
    try {
      if (post.liked_by_me) await unlikePost({ postId: post.id, userId: me.id });
      else await likePost({ postId: post.id, userId: me.id });
    } catch {
      load(); // reconcile on failure
    }
  };

  const handlePost = async () => {
    if (!composerText.trim() && !composerImage) return;
    setPosting(true);
    try {
      await createPost({ authorId: me.id, body: composerText.trim(), imageUrl: composerImage });
      setComposerText("");
      setComposerImage(null);
      load();
    } catch {
      Alert.alert("Couldn't post", "Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = (postId) => {
    Alert.alert("Delete this post?", null, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deletePost(postId);
          setPosts((prev) => prev.filter((p) => p.id !== postId));
        },
      },
    ]);
  };

  const handleAddStoryDone = () => {
    load(); // simplest correct refresh — story grouping logic lives server-side already
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (activePost) {
    return (
      <CommentsScreen
        post={activePost}
        me={me}
        openReport={openReport}
        onBack={() => setActivePost(null)}
        onCommentAdded={() =>
          setPosts((prev) =>
            prev.map((p) => (p.id === activePost.id ? { ...p, comment_count: p.comment_count + 1 } : p))
          )
        }
      />
    );
  }

  if (showNotifications) {
    return (
      <NotificationsScreen
        me={me}
        onBack={() => {
          setShowNotifications(false);
          setUnreadCount(0);
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Crown size={22} color={colors.gold} fill={colors.gold} />
          <Text style={styles.appTitle}>Kingdom</Text>
        </View>
        <View style={styles.topBarRight}>
          <Send size={20} color={colors.text} />
          <TouchableOpacity onPress={() => setShowNotifications(true)} style={{ position: "relative" }}>
            <Bell size={20} color={colors.text} />
            {unreadCount > 0 && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
        ListHeaderComponent={
          <>
            <StoryBar
              groups={storyGroups}
              currentUserId={me.id}
              currentUserAvatar={me.avatar_url}
              onAddStory={() => setAddStoryOpen(true)}
              onViewGroup={setViewerGroup}
            />
            <View style={styles.composerBlock}>
              <View style={styles.composerRow}>
                <TextInput
                  style={styles.composerInput}
                  placeholder="What's on your heart?"
                  placeholderTextColor={colors.textFaint}
                  value={composerText}
                  onChangeText={setComposerText}
                  multiline
                />
                <ComposerImageAttach userId={me.id} imageUrl={composerImage} onChange={setComposerImage} />
              </View>
              {(composerText.trim() || composerImage) && (
                <TouchableOpacity style={styles.postButton} onPress={handlePost} disabled={posting}>
                  <Text style={styles.postButtonText}>{posting ? "Posting…" : "Post"}</Text>
                </TouchableOpacity>
              )}
              <View style={styles.verseCard}>
                <Text style={styles.verseText} numberOfLines={1}>"{VERSE.text}"</Text>
                <Text style={styles.verseRef}>{VERSE.ref}</Text>
              </View>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <PostCard post={item} me={me} onToggleLike={handleToggleLike} onDelete={handleDelete} openReport={openReport} onOpenComments={() => setActivePost(item)} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No posts yet — be the first to share something.</Text>
          </View>
        }
      />

      <StoryViewer group={viewerGroup} onClose={() => setViewerGroup(null)} />
      <AddStorySheet
        visible={addStoryOpen}
        userId={me.id}
        onClose={() => setAddStoryOpen(false)}
        onDone={handleAddStoryDone}
      />
    </View>
  );
}

function PostCard({ post, me, onToggleLike, onDelete, openReport, onOpenComments }) {
  const tone = toneForId(post.author.id);
  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        {post.author.avatar_url ? (
          <Image source={{ uri: post.author.avatar_url }} style={styles.postAvatar} />
        ) : (
          <View style={[styles.postAvatarPlaceholder, { backgroundColor: tone }]}>
            <Text style={styles.postAvatarInitials}>{initialsFor(post.author.display_name)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.postAuthor}>{post.author.display_name}</Text>
          <Text style={styles.postMeta}>@{post.author.username} · {timeAgo(post.created_at)}</Text>
        </View>
        <ContentOptionsMenu
          currentUserId={me.id}
          authorId={post.author.id}
          targetType="post"
          targetId={post.id}
          onReport={openReport}
          onDelete={() => onDelete(post.id)}
        />
      </View>

      {post.body ? <Text style={styles.postBody}>{post.body}</Text> : null}
      {post.image_url && <Image source={{ uri: post.image_url }} style={styles.postImage} />}

      <View style={styles.postActions}>
        <TouchableOpacity style={styles.postActionButton} onPress={() => onToggleLike(post)}>
          <Heart size={17} color={post.liked_by_me ? colors.danger : "#8A8896"} fill={post.liked_by_me ? colors.danger : "none"} />
          <Text style={[styles.postActionText, post.liked_by_me && { color: colors.danger }]}>{post.like_count}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.postActionButton} onPress={onOpenComments}>
          <MessageCircle size={17} color="#8A8896" />
          <Text style={styles.postActionText}>{post.comment_count}</Text>
        </TouchableOpacity>
        <Share2 size={17} color="#8A8896" style={{ marginLeft: "auto" }} />
      </View>
    </View>
  );
}

function timeAgo(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" },
  topBar: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  topBarLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  appTitle: { color: colors.text, fontSize: 22, fontWeight: "600" },
  topBarRight: { flexDirection: "row", gap: 16 },
  unreadDot: { position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  composerBlock: { padding: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  composerRow: {
    flexDirection: "row", alignItems: "flex-end", gap: 10, borderWidth: 1,
    borderColor: "#2E3140", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12,
  },
  composerInput: { flex: 1, color: colors.text, fontSize: 14, maxHeight: 100 },
  postButton: { alignSelf: "flex-end", backgroundColor: colors.gold, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 },
  postButtonText: { color: "#161209", fontWeight: "700", fontSize: 13 },
  verseCard: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1, borderColor: colors.borderGold, borderRadius: 12, backgroundColor: "#161209",
    paddingHorizontal: 14, paddingVertical: 12,
  },
  verseText: { color: "#D8D5C9", fontSize: 13, fontStyle: "italic", flex: 1, marginRight: 8 },
  verseRef: { color: colors.gold, fontSize: 12, fontWeight: "600" },
  postCard: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  postHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  postAvatar: { width: 40, height: 40, borderRadius: 20 },
  postAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  postAvatarInitials: { color: "#C8CAD6", fontSize: 13, fontWeight: "600" },
  postAuthor: { color: colors.text, fontSize: 14, fontWeight: "600" },
  postMeta: { color: colors.textFaint, fontSize: 12 },
  postBody: { color: "#D8D5C9", fontSize: 15, lineHeight: 21, marginBottom: 10 },
  postImage: { width: "100%", height: 220, borderRadius: 14, marginBottom: 10 },
  postActions: { flexDirection: "row", alignItems: "center", gap: 24 },
  postActionButton: { flexDirection: "row", alignItems: "center", gap: 6 },
  postActionText: { color: "#8A8896", fontSize: 13 },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { color: colors.textMuted, fontSize: 14 },
});
