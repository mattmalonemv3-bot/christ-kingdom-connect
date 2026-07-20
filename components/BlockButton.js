// components/BlockButton.js
//
// Drop into any profile screen (not on your own profile).
// Handles its own confirmation dialog and state.
//
// Usage:
//   <BlockButton currentUserId={me.id} targetUserId={profile.id} targetName={profile.display_name} />

import React, { useState, useEffect } from "react";
import { TouchableOpacity, Text, Alert, StyleSheet } from "react-native";
import { blockUser, unblockUser, getBlockedUsers } from "../lib/moderation";

export default function BlockButton({ currentUserId, targetUserId, targetName }) {
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    getBlockedUsers(currentUserId)
      .then((list) => {
        if (mounted) setIsBlocked(list.some((u) => u.id === targetUserId));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [currentUserId, targetUserId]);

  const handlePress = () => {
    if (isBlocked) {
      confirmUnblock();
    } else {
      confirmBlock();
    }
  };

  const confirmBlock = () => {
    Alert.alert(
      `Block ${targetName}?`,
      "They won't be able to follow you, comment on your posts, or message you. They won't be notified that you blocked them.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              await blockUser({ blockerId: currentUserId, blockedId: targetUserId });
              setIsBlocked(true);
            } catch {
              Alert.alert("Couldn't block this user", "Please try again.");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const confirmUnblock = () => {
    Alert.alert(`Unblock ${targetName}?`, null, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unblock",
        onPress: async () => {
          setLoading(true);
          try {
            await unblockUser({ blockerId: currentUserId, blockedId: targetUserId });
            setIsBlocked(false);
          } catch {
            Alert.alert("Couldn't unblock this user", "Please try again.");
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <TouchableOpacity style={styles.button} onPress={handlePress} disabled={loading}>
      <Text style={styles.text}>{isBlocked ? "Unblock" : "Block"}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { paddingVertical: 10, paddingHorizontal: 16 },
  text: { color: "#C0483E", fontSize: 14, fontWeight: "600" },
});
