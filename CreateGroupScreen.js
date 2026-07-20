// screens/CreateGroupScreen.js
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { createGroup } from "../lib/social";
import { colors } from "../theme";

export default function CreateGroupScreen({ me, onBack, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert("Name required", "Give your group a name.");
      return;
    }
    setSaving(true);
    try {
      const group = await createGroup({ name: name.trim(), description: description.trim() || null, createdBy: me.id });
      onCreated(group);
    } catch {
      Alert.alert("Couldn't create group", "Please try again.");
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
        <Text style={styles.title}>New Group</Text>
        <TouchableOpacity onPress={handleCreate} disabled={saving}>
          <Text style={styles.createText}>{saving ? "Creating…" : "Create"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>Group name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Young Adults CKCC"
          placeholderTextColor={colors.textFaint}
        />
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.descInput]}
          value={description}
          onChangeText={setDescription}
          placeholder="What's this group about?"
          placeholderTextColor={colors.textFaint}
          multiline
        />
        <Text style={styles.hint}>You'll be added as the group's leader automatically.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 17, fontWeight: "600" },
  createText: { color: colors.gold, fontSize: 15, fontWeight: "600" },
  content: { padding: 20 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 15 },
  descInput: { minHeight: 90, textAlignVertical: "top" },
  hint: { color: colors.textFaint, fontSize: 12, marginTop: 16 },
});
