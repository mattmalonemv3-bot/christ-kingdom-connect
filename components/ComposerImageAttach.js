// components/ComposerImageAttach.js
//
// Drop into the Feed composer next to the text input. Manages its
// own local preview state; hands the final uploaded URL up to the
// parent via onChange so the parent's createPost() call can use it.
//
// Usage:
//   const [imageUrl, setImageUrl] = useState(null);
//   <ComposerImageAttach userId={me.id} imageUrl={imageUrl} onChange={setImageUrl} />
//   ...
//   <Button onPress={() => createPost({ authorId: me.id, body, imageUrl })} />

import React, { useState } from "react";
import { View, Image, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { Image as ImageIcon, X } from "lucide-react-native";
import { pickAndUploadImage } from "../lib/uploads";

export default function ComposerImageAttach({ userId, imageUrl, onChange }) {
  const [uploading, setUploading] = useState(false);

  const handlePick = async () => {
    setUploading(true);
    try {
      const url = await pickAndUploadImage({ userId, folder: "posts", aspect: [4, 3] });
      if (url) onChange(url);
    } catch (err) {
      Alert.alert("Couldn't add photo", err.message || "Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (imageUrl) {
    return (
      <View style={styles.previewWrap}>
        <Image source={{ uri: imageUrl }} style={styles.preview} />
        <TouchableOpacity style={styles.removeButton} onPress={() => onChange(null)}>
          <X size={14} color="#F2EFE9" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={handlePick} disabled={uploading}>
      {uploading ? <ActivityIndicator size="small" color="#C9A45C" /> : <ImageIcon size={18} color="#8A7440" />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  previewWrap: { position: "relative", alignSelf: "flex-start", marginTop: 8 },
  preview: { width: 96, height: 96, borderRadius: 12 },
  removeButton: {
    position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: "#3D1219", justifyContent: "center", alignItems: "center",
  },
});
