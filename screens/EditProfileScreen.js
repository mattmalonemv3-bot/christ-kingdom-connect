// screens/EditProfileScreen.js
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, Image, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { ArrowLeft, Camera } from "lucide-react-native";
import { updateProfile } from "../lib/auth";
import { pickAndUploadImage, deleteMedia } from "../lib/uploads";
import { colors, toneForId, initialsFor } from "../theme";

export default function EditProfileScreen({ me, onBack, onSaved }) {
  const [displayName, setDisplayName] = useState(me.display_name || "");
  const [bio, setBio] = useState(me.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(me.avatar_url || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChangeAvatar = async () => {
    setUploadingAvatar(true);
    try {
      const newUrl = await pickAndUploadImage({ userId: me.id, folder: "avatars", aspect: [1, 1] });
      if (newUrl) {
        const oldUrl = avatarUrl;
        setAvatarUrl(newUrl);
        // best-effort cleanup of the old file — not worth blocking the UI on
        if (oldUrl) deleteMedia(oldUrl).catch(() => {});
      }
    } catch (err) {
      Alert.alert("Couldn't update photo", err.message || "Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert("Display name is required");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateProfile(me.id, {
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        avatar_url: avatarUrl,
      });
      onSaved(updated);
      onBack();
    } catch {
      Alert.alert("Couldn't save changes", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          <Text style={styles.saveText}>{saving ? "Saving…" : "Save"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <TouchableOpacity style={styles.avatarWrap} onPress={handleChangeAvatar} disabled={uploadingAvatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: toneForId(me.id) }]}>
              <Text style={styles.avatarInitials}>{initialsFor(displayName || me.display_name)}</Text>
            </View>
          )}
          <View style={styles.cameraBadge}>
            {uploadingAvatar ? <ActivityIndicator size="small" color="#161209" /> : <Camera size={14} color="#161209" />}
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarHint}>Tap to change photo</Text>

        <Text style={styles.label}>Display name</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your name"
          placeholderTextColor={colors.textFaint}
        />

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          value={bio}
          onChangeText={setBio}
          placeholder="A short line about you"
          placeholderTextColor={colors.textFaint}
          multiline
          maxLength={140}
        />
        <Text style={styles.charCount}>{bio.length}/140</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 17, fontWeight: "600" },
  saveText: { color: colors.gold, fontSize: 15, fontWeight: "600" },
  content: { padding: 20, alignItems: "center" },
  avatarWrap: { position: "relative", marginTop: 8 },
  avatar: { width: 92, height: 92, borderRadius: 46 },
  avatarPlaceholder: { width: 92, height: 92, borderRadius: 46, justifyContent: "center", alignItems: "center" },
  avatarInitials: { color: "#C8CAD6", fontSize: 26, fontWeight: "700" },
  cameraBadge: {
    position: "absolute", bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.gold, justifyContent: "center", alignItems: "center", borderWidth: 3, borderColor: colors.bg,
  },
  avatarHint: { color: colors.textMuted, fontSize: 12, marginTop: 10, marginBottom: 24 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "600", alignSelf: "flex-start", marginBottom: 6, marginTop: 12 },
  input: { width: "100%", borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 15 },
  bioInput: { minHeight: 70, textAlignVertical: "top" },
  charCount: { color: colors.textFaint, fontSize: 11, alignSelf: "flex-end", marginTop: 4 },
});
