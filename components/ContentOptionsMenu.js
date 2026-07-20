// components/ContentOptionsMenu.js
//
// The three-dot "..." menu on a post/comment/prayer request. Shows
// "Report" for other people's content, "Delete" for your own.
//
// Usage inside a post card:
//   <ContentOptionsMenu
//     currentUserId={me.id}
//     authorId={post.author_id}
//     targetType="post"
//     targetId={post.id}
//     onReport={openReport}          // from useReportModal()
//     onDelete={() => handleDelete(post.id)}
//   />

import React, { useState } from "react";
import { TouchableOpacity, View, Text, Modal, StyleSheet } from "react-native";
import { MoreHorizontal, Flag, Trash2, X } from "lucide-react-native";

export default function ContentOptionsMenu({
  currentUserId,
  authorId,
  targetType,
  targetId,
  onReport,
  onDelete,
}) {
  const [open, setOpen] = useState(false);
  const isOwner = currentUserId === authorId;

  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <MoreHorizontal size={18} color="#8A8896" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            {!isOwner && (
              <TouchableOpacity
                style={styles.row}
                onPress={() => {
                  setOpen(false);
                  onReport({ targetType, targetId });
                }}
              >
                <Flag size={18} color="#D8D5C9" />
                <Text style={styles.rowText}>Report</Text>
              </TouchableOpacity>
            )}
            {isOwner && (
              <TouchableOpacity
                style={styles.row}
                onPress={() => {
                  setOpen(false);
                  onDelete();
                }}
              >
                <Trash2 size={18} color="#C0483E" />
                <Text style={[styles.rowText, { color: "#C0483E" }]}>Delete</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.row} onPress={() => setOpen(false)}>
              <X size={18} color="#7C7A88" />
              <Text style={[styles.rowText, { color: "#7C7A88" }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0F0F14", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingVertical: 8, paddingBottom: 24 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  rowText: { color: "#D8D5C9", fontSize: 15, fontWeight: "500" },
});
