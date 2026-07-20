// screens/CommentsScreen.js
//
// Usage from FeedScreen: tapping the comment icon on a post sets
// activePostId, which renders this conditionally over the feed.
//
//   {activePost && (
//     <CommentsScreen post={activePost} me={me} openReport={openReport}
//       onBack={() => setActivePost(null)}
//       onCommentAdded={() => bumpCommentCount(activePost.id)} />
//   )}

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Image, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { ArrowLeft, Send } from "lucide-react-native";
import { getComments, addComment, deleteComment } from "../lib/posts";
import ContentOptionsMenu from "../components/ContentOptionsMenu";
import { colors, toneForId, initialsFor } from "../theme";

export default function CommentsScreen({ post, me, openReport, onBack, onCommentAdded }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await getComments(post.id);
      setComments(data);
    } finally {
      setLoading(false);
    }
  }, [post.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    const body = text.trim();
    setText("");
    try {
      const newComment = await addComment({ postId: post.id, authorId: me.id, body });
      setComments((prev) => [...prev, { ...newComment, author: { id: me.id, username: me.username, display_name: me.display_name, avatar_url: me.avatar_url } }]);
      onCommentAdded?.();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch {
      Alert.alert("Couldn't post comment", "Please try again.");
      setText(body);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteComment = (commentId) => {
    Alert.alert("Delete this comment?", null, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setComments((prev) => prev.filter((c) => c.id !== commentId));
          try {
            await deleteComment(commentId);
          } catch {
            load(); // reconcile on failure
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Comments</Text>
        <View style={{ width: 20 }} />
      </View>

      <View style={styles.originalPost}>
        <Text style={styles.originalAuthor}>{post.author.display_name}</Text>
        <Text style={styles.originalBody} numberOfLines={3}>{post.body}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={comments}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, gap: 14, flexGrow: 1 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No comments yet — be the first to encourage them.</Text>}
          renderItem={({ item }) => (
            <View style={styles.commentRow}>
              {item.author.avatar_url ? (
                <Image source={{ uri: item.author.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: toneForId(item.author.id) }]}>
                  <Text style={styles.avatarInitials}>{initialsFor(item.author.display_name)}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={styles.commentHeaderRow}>
                  <Text style={styles.commentAuthor}>{item.author.display_name}</Text>
                  <Text style={styles.commentTime}>{timeAgo(item.created_at)}</Text>
                  <View style={{ marginLeft: "auto" }}>
                    <ContentOptionsMenu
                      currentUserId={me.id}
                      authorId={item.author.id}
                      targetType="comment"
                      targetId={item.id}
                      onReport={openReport}
                      onDelete={() => handleDeleteComment(item.id)}
                    />
                  </View>
                </View>
                <Text style={styles.commentBody}>{item.body}</Text>
              </View>
            </View>
          )}
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Write a comment…"
          placeholderTextColor={colors.textFaint}
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity onPress={handleSend} disabled={sending || !text.trim()}>
          <Send size={20} color={text.trim() ? colors.gold : colors.textFaint} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 17, fontWeight: "600" },
  originalPost: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  originalAuthor: { color: colors.gold, fontSize: 12, fontWeight: "600", marginBottom: 4 },
  originalBody: { color: colors.textMuted, fontSize: 13 },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: "center", marginTop: 30 },
  commentRow: { flexDirection: "row", gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  avatarPlaceholder: { width: 34, height: 34, borderRadius: 17, justifyContent: "center", alignItems: "center" },
  avatarInitials: { color: "#C8CAD6", fontSize: 11, fontWeight: "600" },
  commentHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  commentAuthor: { color: colors.text, fontSize: 13, fontWeight: "600" },
  commentTime: { color: colors.textFaint, fontSize: 11 },
  commentBody: { color: "#D8D5C9", fontSize: 14, marginTop: 2, lineHeight: 19 },
  inputRow: {
    flexDirection: "row", alignItems: "flex-end", gap: 12, padding: 16,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  input: {
    flex: 1, color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border,
    borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10, maxHeight: 100,
  },
});
