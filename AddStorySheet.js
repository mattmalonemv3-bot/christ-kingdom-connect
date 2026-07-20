// components/AddStorySheet.js
//
// Presented when the user taps "+" on their story slot. Handles the
// full pick -> upload -> createStory flow itself and calls onDone()
// with the new story row so the parent can refresh its story list.
//
// Usage:
//   const [addOpen, setAddOpen] = useState(false);
//   <AddStorySheet visible={addOpen} userId={me.id} onClose={() => setAddOpen(false)}
//     onDone={(story) => setStoryGroups(prev => addStoryToGroups(prev, story))} />

import React, { useState } from "react";
import { View, Text, Modal, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { Image as ImageIcon, Video as VideoIcon, Camera, X } from "lucide-react-native";
import { pickAndUploadImage, pickAndUploadVideo } from "../lib/uploads";
import { createStory } from "../lib/stories";

export default function AddStorySheet({ visible, userId, onClose, onDone }) {
  const [busy, setBusy] = useState(false);

  const run = async (action) => {
    setBusy(true);
    try {
      const story = await action();
      if (story) onDone(story);
      onClose();
    } catch (err) {
      Alert.alert("Couldn't add to your story", err.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const addPhotoFromLibrary = () =>
    run(async () => {
      const url = await pickAndUploadImage({ userId, folder: "stories", aspect: [9, 16] });
      if (!url) return null;
      return createStory({ authorId: userId, mediaUrl: url, mediaType: "image" });
    });

  const addPhotoFromCamera = () =>
    run(async () => {
      const url = await pickAndUploadImage({ userId, folder: "stories", aspect: [9, 16], fromCamera: true });
      if (!url) return null;
      return createStory({ authorId: userId, mediaUrl: url, mediaType: "image" });
    });

  const addVideo = (fromCamera) =>
    run(async () => {
      const result = await pickAndUploadVideo({ userId, fromCamera });
      if (!result) return null;
      return createStory({
        authorId: userId,
        mediaUrl: result.url,
        mediaType: "video",
        durationSeconds: result.durationSeconds,
      });
    });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={busy ? undefined : onClose}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Add to Your Story</Text>

          {busy ? (
            <View style={styles.busyRow}>
              <ActivityIndicator color="#C9A45C" />
              <Text style={styles.busyText}>Uploading…</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity style={styles.row} onPress={addPhotoFromCamera}>
                <Camera size={18} color="#D8D5C9" />
                <Text style={styles.rowText}>Take a photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.row} onPress={() => addVideo(true)}>
                <VideoIcon size={18} color="#D8D5C9" />
                <Text style={styles.rowText}>Record a video (15s)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.row} onPress={addPhotoFromLibrary}>
                <ImageIcon size={18} color="#D8D5C9" />
                <Text style={styles.rowText}>Choose photo from library</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.row} onPress={() => addVideo(false)}>
                <VideoIcon size={18} color="#D8D5C9" />
                <Text style={styles.rowText}>Choose video from library</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.row} onPress={onClose}>
                <X size={18} color="#7C7A88" />
                <Text style={[styles.rowText, { color: "#7C7A88" }]}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0F0F14", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#2E3140", alignSelf: "center", marginBottom: 16 },
  title: { color: "#F2EFE9", fontSize: 16, fontWeight: "600", marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#1C1C24" },
  rowText: { color: "#D8D5C9", fontSize: 15 },
  busyRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 20 },
  busyText: { color: "#9A98A6", fontSize: 14 },
});
